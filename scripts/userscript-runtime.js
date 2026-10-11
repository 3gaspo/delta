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
