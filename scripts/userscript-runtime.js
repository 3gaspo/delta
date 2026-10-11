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
