// ==UserScript==
// @name         Delta — CIC & BoursoBank import
// @namespace    https://delta-d85d8.web.app
// @version      1.0.0
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
  let pending = 0;
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
      if (row.getAttribute('data-is-auth') === 'true') { pending++; continue; }
      try {
        if (row.getAttribute('data-is-auth') !== 'false') throw new Error('Unknown operation status');
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
        transactions.push({ sourceId, date: bookingDate, amountCents, name, description,
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
        transactions.push({ date: date(text(row.querySelector('[id$=".opDate"]'))), amountCents, name,
          description: name, bankCategory: text(label?.querySelector('.doux')) });
      } catch { rejected++; }
    }
    warnings.push('CIC does not expose stable transaction IDs in this view. Matching uses the booking date, amount and original description; review identical payments carefully.');
  } else throw new Error('Unsupported bank');
  if (!accountRef) throw new Error('Cannot identify this bank account. Open its individual transaction page.');
  if (!transactions.length) throw new Error(`No booked transactions could be read (${pending} pending, ${rejected} unreadable).`);
  if (transactions.length > 1000) throw new Error('Limit the displayed range to 1,000 transactions or fewer.');
  if (rejected) warnings.push(`${rejected} rows could not be read and were excluded. Check them in your bank.`);
  if (pending) warnings.push(`${pending} pending card authorizations were excluded. Import them after they are booked.`);
  return { version: 1, bank, accountRef, currency: 'EUR', transactions, warnings };
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
  let autoObserver;
  let autoTimer;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:24px;z-index:2147483647';
  const shadow = host.attachShadow({ mode: 'closed' });
  const panel = document.createElement('div');
  panel.style.cssText = 'font:14px system-ui;background:#fff;color:#111;padding:16px;border:1px solid #ddd;border-radius:16px;box-shadow:0 4px 24px #0002;max-width:300px';
  const button = document.createElement('button');
  button.textContent = 'Review loaded transactions in Delta';
  button.style.cssText = 'font:inherit;background:#111;color:#fff;border:0;border-radius:10px;padding:12px;cursor:pointer';
  const status = document.createElement('p');
  status.textContent = 'Only loaded, booked EUR transactions. Load older entries in your bank, then click again.';
  status.style.cssText = 'margin:10px 0 0;line-height:1.4';
  panel.append(button, status);
  shadow.append(panel);
  document.body.append(host);
  async function openImport() {
    if (opening) return;
    autoObserver?.disconnect();
    clearTimeout(autoTimer);
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
      status.textContent = `${payload.transactions.length} transactions ready in Delta. ${payload.warnings.join(' ')} Load older entries and click again if needed.`;
    } catch (error) { status.textContent = error.message || 'Could not read this page.'; }
    finally { opening = false; button.disabled = false; }
  }
  button.addEventListener('click', openImport);
  GM_registerMenuCommand('Delta: toggle automatic review on page load', () => {
    const next = !GM_getValue('delta-auto-open', true);
    GM_setValue('delta-auto-open', next);
    status.textContent = `Automatic review ${next ? 'enabled' : 'disabled'} for the next page load.`;
  });
  GM_registerMenuCommand('Delta: toggle localhost development destination', () => {
    const next = !GM_getValue('delta-local-development', false);
    GM_setValue('delta-local-development', next);
    status.textContent = `Destination: ${next ? 'localhost:3000' : 'delta-d85d8.web.app'}.`;
  });
  if (GM_getValue('delta-auto-open', true)) {
    const selector = bank === 'cic' ? 'tr[id$=".transactionRow"]' : '[data-operations-item][data-is-auth="false"]';
    autoObserver = new MutationObserver(schedule);
    function schedule() {
      clearTimeout(autoTimer);
      if (document.querySelector(selector)) autoTimer = setTimeout(openImport, 1000);
    }
    autoObserver.observe(document.body, { childList: true, subtree: true });
    schedule();
    setTimeout(() => autoObserver.disconnect(), 60000);
  }
}

})();
