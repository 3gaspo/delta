import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import { extractBankTransactions } from '../scripts/bank-extractors.mjs';
import { identifyBankRows, localBookingDate, possibleBankDuplicates, validateBankPayload } from '../src/lib/bankImport';
import type { BankPayload } from '../src/lib/bankImport';
import type { Transaction } from '../src/types';

// Synthetic markup follows the supplied bank structures; no real customer data.
const boursoRow = (id: string, amount: string, pending = false, name = 'Example shop') => `<li data-operations-item data-id="${id}" data-is-auth="${pending}"><span class="list__movement--label-user">${name}</span><span class="list__movement--label-initial">CARD EXAMPLE</span><span class="list-operation-item__category">Food</span><div class="list-operation-item__amount">${amount}</div><div data-account-key="example-account"></div></li>`;
const boursoList = (contents: string) => `<ul data-operations-list><li class="list-operation-date-line">vendredi 9 octobre 2026</li>${contents}</ul>`;
const cicRow = (id: number, debit: string, credit: string) => `<tr id="dynamic.${id}.transactionRow"><td><span id="dynamic.${id}.opDate">06/10/2026</span></td><td><div id="dynamic.${id}.detailCellPanel"><p><span class="eir_showsm">06/10/2026</span><span id="dynamic.${id}.detailCellPanel.S4" role="button">EXAMPLE PAYMENT<br><span class="doux">Transfers</span></span></p><p class="eir_showsm">${debit || credit}</p></div></td><td>${debit}</td><td>${credit}</td></tr>`;
const extract = (html: string, bank = 'boursobank') => extractBankTransactions(parseHTML(html).document, bank, bank === 'cic' ? 'https://www.cic.fr/fr/banque/mouvements.html?webid=example' : 'https://clients.boursobank.com/compte/cav/example-account/');
const payload = (): BankPayload => ({ version: 1, bank: 'cic', accountRef: 'a'.repeat(64), currency: 'EUR', warnings: [], transactions: [{ date: '2026-10-06', amountCents: -690, name: 'Example', description: 'EXAMPLE', bankCategory: 'Fees' }] });

test('Bourso: signed French amounts, date headings, stable IDs, pending excluded', () => {
  const result = extract(boursoList(boursoRow('a', '−&nbsp;2,40&nbsp;€') + boursoRow('b', '+ 1 234,56 €') + boursoRow('pending', '−13,00 €', true)));
  assert.deepEqual(result.transactions.map(t => [t.sourceId, t.date, t.amountCents]), [['a', '2026-10-09', -240], ['b', '2026-10-09', 123456]]);
  assert.match(result.warnings.join(' '), /1 pending/);
});
test('Bourso: duplicate DOM rows excluded, malformed date or money never guessed', () => {
  const result = extract(boursoList(boursoRow('a', '−2,40 €') + boursoRow('a', '−2,40 €') + boursoRow('b', 'USD 1.25')));
  assert.equal(result.transactions.length, 1);
  assert.match(result.warnings.join(' '), /1 rows/);
  assert.throws(() => extract(boursoList(boursoRow('a', '−2,40 €')).replace('vendredi 9 octobre 2026', 'Unknown date')));
});
test('Bourso: ignores ads and rejects mixed account rows', () => {
  const result = extract(boursoList('<li>Advertisement</li>' + boursoRow('a', '−2,40 €') + boursoRow('b', '−3,00 €').replace('example-account', 'other-account')));
  assert.equal(result.transactions.length, 1);
  assert.match(result.warnings.join(' '), /1 rows/);
});
test('CIC: desktop amounts read once, mobile duplicates ignored, category separated', () => {
  const result = extract(`<table><tbody>${cicRow(0, '-6,90 EUR', '')}${cicRow(1, '', '+1&nbsp;000,00 EUR')}</tbody></table>`, 'cic');
  assert.deepEqual(result.transactions.map(t => [t.date, t.amountCents, t.name, t.bankCategory]), [['2026-10-06', -690, 'EXAMPLE PAYMENT', 'Transfers'], ['2026-10-06', 100000, 'EXAMPLE PAYMENT', 'Transfers']]);
  assert.equal(result.transactions[0].sourceId, undefined);
  assert.match(result.warnings[0], /stable transaction IDs/);
});
test('CIC: positional IDs do not become identity; unreadable rows report warnings', () => {
  const a = extract(`<table>${cicRow(0, '-6,90 EUR', '')}${cicRow(1, '-1,00 EUR', '+1,00 EUR')}</table>`, 'cic');
  const b = extract(`<table>${cicRow(99, '-6,90 EUR', '')}</table>`, 'cic');
  assert.deepEqual(a.transactions, b.transactions);
  assert.match(a.warnings.join(' '), /1 rows/);
});
test('payload boundary rejects invalid dates, amounts, currencies, IDs and oversized input', () => {
  assert.equal(validateBankPayload(payload()).transactions.length, 1);
  for (const patch of [{ currency: 'USD' }, { accountRef: 'raw-bank-id' }, { version: 2 }, { transactions: [] }]) assert.throws(() => validateBankPayload({ ...payload(), ...patch }));
  for (const patch of [{ date: '2026-02-30' }, { amountCents: 1.2 }, { amountCents: 0 }, { name: '' }, { description: 'x'.repeat(2001) }]) assert.throws(() => validateBankPayload({ ...payload(), transactions: [{ ...payload().transactions[0], ...patch }] }));
  assert.throws(() => validateBankPayload({ ...payload(), bank: 'boursobank' }));
  assert.throws(() => validateBankPayload({ ...payload(), transactions: Array(1001).fill(payload().transactions[0]) }));
});
test('identities survive repeated imports, isolate accounts, preserve identical payments', async () => {
  const p = payload();
  p.transactions.push({ ...p.transactions[0] });
  const first = await identifyBankRows(p);
  assert.notEqual(first[0].key, first[1].key);
  assert.deepEqual(first, await identifyBankRows(p));
  assert.notEqual(first[0].key, (await identifyBankRows({ ...p, accountRef: 'b'.repeat(64) }))[0].key);
  const stable = { ...payload(), bank: 'boursobank' as const, transactions: [{ ...p.transactions[0], sourceId: 'bank-id' }] };
  const a = await identifyBankRows(stable);
  stable.transactions[0].name = 'Renamed';
  stable.transactions[0].description = 'Bank updated description';
  assert.equal(a[0].key, (await identifyBankRows(stable))[0].key);
});
test('manual entries and either side of transfers are possible duplicates on the local booking day', () => {
  const tx = { id: 'manual', accountId: 'a', amount: 6.9, date: localBookingDate('2026-10-06'), type: 'expense' } as Transaction;
  assert.equal(possibleBankDuplicates(payload().transactions[0], 'a', [tx]).length, 1);
  assert.equal(possibleBankDuplicates(payload().transactions[0], 'b', [tx]).length, 0);
  const transfer = { ...tx, type: 'transfer' as const, transferAccountId: 'b' };
  assert.equal(possibleBankDuplicates(payload().transactions[0], 'a', [transfer]).length, 1);
  assert.equal(possibleBankDuplicates({ ...payload().transactions[0], amountCents: 690 }, 'b', [transfer]).length, 1);
});
test('userscript bridge accepts only same-window same-origin requests and clears expiring drafts', () => {
  const token = '12345678-1234-1234-1234-123456789abc';
  const draft = { createdAt: Date.now(), payload: payload() };
  const store = new Map<string, any>([['delta-import:' + token, draft], ['delta-import:old', { createdAt: 0 }]]);
  let listener: (event: any) => void;
  const replies: any[] = [];
  const window = { addEventListener: (_: string, fn: any) => { listener = fn; }, postMessage: (value: any) => replies.push(value) };
  runInNewContext(readFileSync('public/delta-bank-import.user.js', 'utf8'), {
    document: { addEventListener: () => {} },
    window, location: { origin: 'https://delta-d85d8.web.app' },
    GM_listValues: () => [...store.keys()], GM_getValue: (k: string) => store.get(k), GM_deleteValue: (k: string) => store.delete(k),
  });
  assert.equal(store.has('delta-import:old'), false);
  const event = { source: window, origin: 'https://delta-d85d8.web.app', data: { type: 'delta-bank-import:request', token } };
  listener!({ ...event, origin: 'https://untrusted.example' });
  listener!({ ...event, source: {} });
  assert.equal(replies.length, 0);
  listener!(event);
  assert.equal(replies[0].payload, draft.payload);
  listener!({ ...event, data: { type: 'delta-bank-import:clear', token } });
  assert.equal(store.has('delta-import:' + token), false);
});

test('DOM bridge uses JSON strings, scopes access to the current draft, and clears drafts', () => {
  const token = '12345678-1234-1234-1234-123456789abc';
  const other = '87654321-4321-4321-4321-cba987654321';
  const store = new Map<string, any>([['delta-import:' + token, { createdAt: Date.now(), payload: payload() }]]);
  const { document, CustomEvent } = parseHTML('<html></html>');
  const replies: any[] = [];
  document.addEventListener('delta-bank-import:reply', (event: any) => {
    assert.equal(typeof event.detail, 'string');
    replies.push(JSON.parse(event.detail));
  });
  runInNewContext(readFileSync('public/delta-bank-import.user.js', 'utf8'), {
    document, CustomEvent, URLSearchParams,
    window: { addEventListener: () => {} },
    location: { origin: 'https://delta-d85d8.web.app', hash: '#bank-import=' + token },
    GM_listValues: () => [...store.keys()], GM_getValue: (key: string) => store.get(key), GM_deleteValue: (key: string) => store.delete(key),
  });
  const request = (detail: unknown) => document.dispatchEvent(new CustomEvent('delta-bank-import:request', { detail }));
  request('not json');
  request(JSON.stringify({ type: 'delta-bank-import:request', token: other }));
  request({ type: 'delta-bank-import:request', token });
  assert.equal(replies.length, 0);
  request(JSON.stringify({ type: 'delta-bank-import:request', token }));
  assert.equal(replies[0].type, 'delta-bank-import:payload');
  assert.deepEqual(replies[0].payload, payload());
  request(JSON.stringify({ type: 'delta-bank-import:clear', token }));
  assert.equal(store.size, 0);
  request(JSON.stringify({ type: 'delta-bank-import:request', token }));
  assert.equal(replies[1].type, 'delta-bank-import:expired');
});
