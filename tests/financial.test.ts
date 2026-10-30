import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Account, RecurringTransaction, Transaction } from '../src/types';
import {
  computeFinancialTotals, computeExpectedMonthlyFinancials, computeFullPeriodAverages,
  getAccountBalance, getMyAccountBalance, getMyTransactionAmount, getStatsAggregation,
  computeAccountCashflowAlert,
} from '../src/utils/financial';
import { generateDueTransactions, sortRecurringByNextDate } from '../src/utils/recurring';

const date = (month: number, day: number, hour = 0) => new Date(2026, month - 1, day, hour).getTime();
const shared: Account = { id: 'shared', name: 'Joint', type: 'regular', initialBalance: 1000, isShared: true, defaultMyShareRatio: 0.5, createdAt: 0, updatedAt: 0 };
const personal: Account = { id: 'personal', name: 'Personal', type: 'regular', initialBalance: 200, createdAt: 0, updatedAt: 0 };
const tx = (fields: Partial<Transaction> = {}): Transaction => ({ id: 'tx', name: 'Expense', amount: 100, date: date(2, 1), accountId: 'shared', categoryId: 'food', tagIds: [], type: 'expense', status: 'normal', createdAt: 0, updatedAt: 0, ...fields });
const rule = (fields: Partial<RecurringTransaction> = {}): RecurringTransaction => ({ id: 'rule', name: 'Rent', amount: 100, startDate: date(2, 1), periodicityDays: 30, accountId: 'shared', categoryId: 'food', tagIds: [], type: 'expense', status: 'normal', createdAt: 0, updatedAt: 0, ...fields });

test('assets and net worth use account ownership while the ledger stays at the bank balance', () => {
  const transactions = [tx({ myShareAmount: 25 }), tx({ id: 'transfer', type: 'transfer', accountId: 'personal', transferAccountId: 'shared', amount: 200 })];
  assert.equal(getAccountBalance('shared', transactions, shared), 1100);
  assert.equal(getMyAccountBalance(shared, transactions), 550);
  const payable: Account = { ...personal, id: 'debt', type: 'debt', debtDirection: 'payable', initialBalance: 80 };
  const receivable: Account = { ...payable, id: 'owed', debtDirection: 'receivable', initialBalance: 30 };
  const hidden = { ...personal, id: 'hidden', initialBalance: 9999, hidden: true };
  assert.deepEqual(computeFinancialTotals([shared, personal, payable, receivable, hidden], transactions), {
    regularBalance: 550, receivables: 30, payables: 80, netWorth: 500, totalAssets: 580, totalDebts: 80,
  });
  assert.equal(getMyAccountBalance({ ...shared, defaultMyShareRatio: 0 }, transactions), 0);
  assert.equal(getMyAccountBalance({ ...shared, defaultMyShareRatio: 0.25 }, transactions), 275);
  assert.equal(getMyAccountBalance({ ...shared, initialBalance: -200 }, []), -100);
});

test('stats use explicit shares first and account defaults for legacy transactions', () => {
  const accounts = [shared, personal];
  assert.equal(getMyTransactionAmount(tx(), accounts), 50);
  assert.equal(getMyTransactionAmount(tx({ myShareRatio: 0.25 }), accounts), 25);
  assert.equal(getMyTransactionAmount(tx({ myShareAmount: 0, myShareRatio: 0.5 }), accounts), 0);
  assert.equal(getMyTransactionAmount(tx({ accountId: 'personal' }), accounts), 100);
  const aggregation = getStatsAggregation([tx(), tx({ id: 'custom', myShareAmount: 20 }), tx({ id: 'hidden', status: 'hidden' })], [], [], accounts,
    { accountId: 'all', categoryId: 'all', tagId: 'all', startDate: date(1, 1), endDate: date(3, 1) });
  assert.equal(aggregation.expenses, 70);
  assert.deepEqual(aggregation.byCategory, { food: 70 });
  const averages = computeFullPeriodAverages([tx({ date: date(1, 1) }), tx()], new Date(2026, 2, 1), accounts);
  assert.equal(averages.monthlyExpensesAvg, 50);
});

test('recurring projections and generated entries preserve personal shares, including zero', () => {
  for (const share of [0, 25, 100]) {
    const recurring = rule({ myShareAmount: share, myShareRatio: share / 100 });
    const { newTransactions } = generateDueTransactions(recurring, date(3, 1));
    assert.equal(newTransactions.length, 2);
    assert.ok(newTransactions.every(t => t.myShareAmount === share && t.myShareRatio === share / 100));
    assert.equal(computeExpectedMonthlyFinancials([recurring], [], [shared]).expectedExpenses, share);
  }
  assert.equal(computeExpectedMonthlyFinancials([rule()], [], [shared]).expectedExpenses, 50);
});

test('overdraft forecasts continue to use full account amounts', () => {
  const account = { ...shared, initialBalance: 100 };
  const alert = computeAccountCashflowAlert(account, [tx({ amount: 150, date: date(2, 2), myShareAmount: 25 })], [], 60, date(2, 1));
  assert.equal(alert.currentBalance, 100);
  assert.equal(alert.firstNegativeBalance, -50);
  assert.equal(alert.shortfallAmount, 50);
  assert.equal(alert.willGoNegative, true);
});

test('recurring items sort by calendar date, then expense, income, transfer, then name', () => {
  const rules = [
    rule({ id: 'transfer', name: 'A', type: 'transfer' }),
    rule({ id: 'zexpense', name: 'Z', startDate: date(2, 1, 3) }),
    rule({ id: 'income', name: 'A', type: 'income' }),
    rule({ id: 'expense', name: 'B', startDate: date(2, 1, 18) }),
    rule({ id: 'earlier', type: 'transfer', startDate: date(1, 31) }),
  ];
  assert.deepEqual(sortRecurringByNextDate(rules).map(r => r.id), ['earlier', 'expense', 'zexpense', 'income', 'transfer']);
  assert.equal(rules[0].id, 'transfer');
});
