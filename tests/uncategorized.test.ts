import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectUncategorized } from '../src/utils/uncategorized';
import type { Category, Transaction } from '../src/types';

test('legacy fallback is virtual, conditional and preserves stored references', () => {
  const categories = [{ id: 'legacy', label: 'Uncategorized' }, { id: 'food', label: 'Food' }] as Category[];
  assert.deepEqual(projectUncategorized(categories, [], []).categories.map(c => c.label), ['Food']);
  const transactions = [{ id: 'kept', categoryId: 'legacy', type: 'expense', amount: 12 }] as Transaction[];
  const result = projectUncategorized(categories, transactions, []);
  assert.equal(result.categories.at(-1)?.id, '');
  assert.equal(result.transactions[0].categoryId, '');
  assert.equal(result.transactions[0].amount, 12);
  assert.equal(transactions[0].categoryId, 'legacy');
  assert.equal(categories.length, 2);
  assert.equal(projectUncategorized(categories, [{ ...transactions[0], categoryId: 'food' }], []).categories.length, 1);
  assert.equal(projectUncategorized(categories, [{ ...transactions[0], type: 'transfer' }], []).categories.length, 1);
});
