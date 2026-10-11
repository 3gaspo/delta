// Kept self-contained so the userscript builder can embed this exact function.
export function extractBankTransactions(document, bank, sourceUrl) {
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
