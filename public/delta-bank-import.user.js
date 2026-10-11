// ==UserScript==
// @name         Delta — CIC & BoursoBank import
// @namespace    https://delta-d85d8.web.app
// @version      1.1.0
// @description  Review loaded bank transactions in Delta before saving.
// @match        https://www.cic.fr/fr/banque/mouvements.html*
// @match        https://clients.boursobank.com/compte/*
// @match        https://delta-d85d8.web.app/*
// @match        http://localhost:3000/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
'use strict';
function extractBankTransactions(document, bank, sourceUrl) {
  const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
  const money = value => {
    const clean = value.replace(/[\s\u00a0\u202f]/g, '').replace(/−/g, '-').replace(/(?:EUR|€)$/i, '');
    if (!/^[+-]?\d+(?:,\d{2})$/.test(clean)) throw new Error('Unrecognized EUR amount');
    return Math.round(Number(clean.replace(',', '.')) * 100);
  };
  const date = value => {
    const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
    const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const numeric = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const french = normalized.match(/(?:^|\s)(\d{1,2})\s+(\w+)\s+(\d{4})$/);
    const parts = numeric ? [+numeric[3], +numeric[2], +numeric[1]] : french ? [+french[3], months.indexOf(french[2]) + 1, +french[1]] : [];
    const [year, month, day] = parts;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!year || !month || d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) throw new Error('Unrecognized booking date');
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  const transactions = [];
  const warnings = [];
  let rejected = 0;
  let accountRef = '';
  const url = new URL(sourceUrl);
  if (bank === 'boursobank') {
    const lists = document.querySelectorAll('ul[data-operations-list]');
    if (lists.length !== 1) throw new Error('Open one account’s transaction list before importing.');
    accountRef = url.pathname.match(/\/compte\/[^/]+\/([^/]+)/)?.[1] || '';
    let bookingDate = '';
    const seen = new Set();
    for (const row of lists[0].children) {
      if (row.matches('.list-operation-date-line')) {
        try { bookingDate = date(text(row)); } catch { bookingDate = ''; }
        continue;
      }
      if (!row.matches('[data-operations-item]')) continue;
      try {
        const authorization = row.getAttribute('data-is-auth');
        if (!['true', 'false'].includes(authorization)) throw new Error('Unknown operation status');
        const rowAccount = row.querySelector('[data-account-key]')?.getAttribute('data-account-key');
        if (!accountRef) accountRef = rowAccount || '';
        if (rowAccount && accountRef !== rowAccount) throw new Error('Mixed accounts');
        const sourceId = row.getAttribute('data-id');
        const name = text(row.querySelector('.list__movement--label-user'));
        const description = text(row.querySelector('.list__movement--label-initial')) || name;
        const amountCents = money(text(row.querySelector('.list-operation-item__amount')));
        if (!sourceId || !bookingDate || !name || !amountCents) throw new Error('Incomplete operation');
        if (seen.has(sourceId)) continue;
        seen.add(sourceId);
        transactions.push({ sourceId, date: bookingDate, amountCents, name, description, status: authorization === 'true' ? 'pending' : 'normal',
          bankCategory: text(row.querySelector('.list-operation-item__category')) });
      } catch { rejected++; }
    }
  } else if (bank === 'cic') {
    accountRef = url.searchParams.get('webid') || url.searchParams.get('k_webid') || '';
    const rows = document.querySelectorAll('tr[id$=".transactionRow"]');
    for (const row of rows) {
      try {
        const cells = row.querySelectorAll(':scope > td');
        const label = row.querySelector('[id$=".detailCellPanel.S4"]');
        const name = Array.from(label?.childNodes || []).filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
        const debit = text(cells[2]);
        const credit = text(cells[3]);
        if (cells.length !== 4 || !name || Boolean(debit) === Boolean(credit)) throw new Error('Unknown table layout');
        const amountCents = debit ? -Math.abs(money(debit)) : Math.abs(money(credit));
        if (!amountCents) throw new Error('Zero operation');
        transactions.push({ date: date(text(row.querySelector('[id$=".opDate"]'))), amountCents, name, status: 'normal',
          description: name, bankCategory: text(label?.querySelector('.doux')) });
      } catch { rejected++; }
    }
    warnings.push('CIC does not expose stable transaction IDs in this view. Matching uses the booking date, amount and original description; review identical payments carefully.');
  } else throw new Error('Unsupported bank');
  if (!accountRef) throw new Error('Cannot identify this bank account. Open its individual transaction page.');
  if (!transactions.length) throw new Error(`No transactions could be read (${rejected} unreadable).`);
  if (transactions.length > 1000) throw new Error('Limit the displayed range to 1,000 transactions or fewer.');
  if (rejected) warnings.push(`${rejected} rows could not be read and were excluded. Check them in your bank.`);
  // v2 requires an app that preserves pending status; older apps must reject it.
  return { version: 2, bank, accountRef, currency: 'EUR', transactions, warnings };
}
// Embedded by build-userscript.mjs; no remote code or bank requests.
const PREFIX = 'delta-import:';
const TTL = 30 * 60 * 1000;
const isDelta = location.origin === 'https://delta-d85d8.web.app' || location.origin === 'http://localhost:3000';
for (const key of GM_listValues()) {
  if (key.startsWith(PREFIX)) {
    const entry = GM_getValue(key);
    if (!entry || Date.now() - entry.createdAt > TTL) GM_deleteValue(key);
  }
}

if (isDelta) {
  // DOM events cross userscript isolated worlds without comparing Window proxies.
  // String details also avoid cross-compartment object access restrictions.
  document.addEventListener('delta-bank-import:request', event => {
    if (typeof event.detail !== 'string' || event.detail.length > 200) return;
    let request;
    try { request = JSON.parse(event.detail); } catch { return; }
    const { type, token } = request || {};
    const currentToken = new URLSearchParams(location.hash.slice(1)).get('bank-import');
    if (!/^[0-9a-f-]{36}$/.test(token || '') || token !== currentToken) return;
    const key = PREFIX + token;
    if (type === 'delta-bank-import:clear') { GM_deleteValue(key); return; }
    if (type !== 'delta-bank-import:request') return;
    const entry = GM_getValue(key);
    const reply = !entry || Date.now() - entry.createdAt > TTL
      ? { type: 'delta-bank-import:expired', token }
      : { type: 'delta-bank-import:payload', token, payload: entry.payload };
    document.dispatchEvent(new CustomEvent('delta-bank-import:reply', { detail: JSON.stringify(reply) }));
  });
  // Keep v1 page compatibility while the app and userscript update separately.
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const { type, token } = event.data || {};
    if (!/^[0-9a-f-]{36}$/.test(token || '')) return;
    const key = PREFIX + token;
    if (type === 'delta-bank-import:clear') { GM_deleteValue(key); return; }
    if (type !== 'delta-bank-import:request') return;
    const entry = GM_getValue(key);
    if (!entry || Date.now() - entry.createdAt > TTL) {
      window.postMessage({ type: 'delta-bank-import:expired', token }, location.origin);
      return;
    }
    window.postMessage({ type: 'delta-bank-import:payload', token, payload: entry.payload }, location.origin);
  });
} else {
  const bank = location.hostname === 'www.cic.fr' ? 'cic' : 'boursobank';
  let opening = false;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:24px;z-index:2147483647;max-width:calc(100vw - 40px)';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = ':host{color-scheme:light dark} .panel{font:14px system-ui;background:#f8f8f7;color:#171717;padding:24px;border-radius:32px;box-shadow:0 12px 40px #0002;width:280px;max-width:100%;box-sizing:border-box} .heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;font-size:22px;font-weight:700;letter-spacing:-.7px} button{font:inherit;cursor:pointer;border:0} .close{border-radius:50%;width:32px;height:32px;background:#00000008;color:inherit;font-size:22px} .import{background:#171717;color:white;border-radius:16px;width:100%;padding:14px;font-weight:600} p{font-size:12px;line-height:1.5;margin:12px 0 0} p:empty{display:none} button:focus-visible{outline:2px solid #888;outline-offset:3px} @media(prefers-color-scheme:dark){.panel{background:#202020;color:#fafafa}.close{background:#ffffff10}.import{background:#fafafa;color:#171717}}';
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Delta bank import');
  const heading = document.createElement('div');
  heading.className = 'heading';
  const title = document.createElement('span');
  title.textContent = 'Delta';
  const dismiss = document.createElement('button');
  dismiss.className = 'close';
  dismiss.textContent = '×';
  dismiss.setAttribute('aria-label', 'Dismiss import prompt');
  dismiss.addEventListener('click', () => host.remove());
  heading.append(title, dismiss);
  const button = document.createElement('button');
  button.textContent = 'Import transactions';
  button.className = 'import';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  panel.append(heading, button, status);
  shadow.append(style, panel);
  async function openImport() {
    if (opening) return;
    opening = true;
    button.disabled = true;
    try {
      const payload = extractBankTransactions(document, bank, location.href);
      // Transfer a hash of the account identifier, never the bank URL or its tokens.
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${bank}:${payload.accountRef}`));
      payload.accountRef = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const token = crypto.randomUUID();
      GM_setValue(PREFIX + token, { createdAt: Date.now(), payload });
      const destination = GM_getValue('delta-local-development', false) ? 'http://localhost:3000' : 'https://delta-d85d8.web.app';
      GM_openInTab(`${destination}/import#bank-import=${token}`, { active: true, insert: true });
      status.textContent = `${payload.transactions.length} transactions opened in Delta.`;
    } catch (error) { status.textContent = error.message || 'Could not read this page.'; }
    finally { opening = false; button.disabled = false; }
  }
  button.addEventListener('click', openImport);
  GM_registerMenuCommand('Delta: show import prompt', () => { document.body.append(host); });
  GM_registerMenuCommand('Delta: toggle localhost development destination', () => {
    const next = !GM_getValue('delta-local-development', false);
    GM_setValue('delta-local-development', next);
    status.textContent = `Destination: ${next ? 'localhost:3000' : 'delta-d85d8.web.app'}.`;
  });
  const selector = bank === 'cic' ? 'tr[id$=".transactionRow"]' : '[data-operations-item]';
  const observer = new MutationObserver(showWhenReady);
  function showWhenReady() {
    if (!document.querySelector(selector)) return;
    observer.disconnect();
    document.body.append(host);
  }
  observer.observe(document.body, { childList: true, subtree: true });
  showWhenReady();
  setTimeout(() => observer.disconnect(), 60000);
}

})();
