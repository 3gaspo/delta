import { Transaction, Account, Category, Tag, RecurringTransaction } from '../types';

export function isInitialBalanceTx(t: Transaction): boolean {
  return Boolean(
    t.isInitialBalance ||
    t.description?.toLowerCase() === 'initial balance' ||
    t.name?.toLowerCase().includes('initial balance')
  );
}

export function getAccountBalance(
  accountId: string, 
  transactions: Transaction[],
  accountOrInitialBalance?: Account | number | Account[]
): number {
  let initialOffset = 0;
  if (typeof accountOrInitialBalance === 'number') {
    initialOffset = accountOrInitialBalance;
  } else if (accountOrInitialBalance && typeof accountOrInitialBalance === 'object') {
    if ('initialBalance' in accountOrInitialBalance) {
      initialOffset = (accountOrInitialBalance as Account).initialBalance || 0;
    } else if (Array.isArray(accountOrInitialBalance)) {
      const found = accountOrInitialBalance.find(a => a.id === accountId);
      initialOffset = found?.initialBalance || 0;
    }
  }

  const txSum = transactions
    .filter(t => t.status !== 'hidden' && (t.accountId === accountId || t.transferAccountId === accountId))
    .filter(t => !isInitialBalanceTx(t))
    .reduce((acc, t) => {
      if (t.type === 'income') {
        return t.accountId === accountId ? acc + t.amount : acc;
      } else if (t.type === 'expense') {
        return t.accountId === accountId ? acc - t.amount : acc;
      } else if (t.type === 'transfer') {
        if (t.accountId === accountId) return acc - t.amount;
        if (t.transferAccountId === accountId) return acc + t.amount;
      }
      return acc;
    }, 0);

  return initialOffset + txSum;
}

export interface FinancialTotals {
  regularBalance: number;
  receivables: number;
  payables: number;
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
}

export function computeFinancialTotals(accounts: Account[], transactions: Transaction[]): FinancialTotals {
  const visibleAccounts = accounts.filter(a => !a.hidden);
  const balances = visibleAccounts.reduce((acc, account) => {
    acc[account.id] = getAccountBalance(account.id, transactions, account);
    return acc;
  }, {} as Record<string, number>);

  let regularBalance = 0;
  let receivables = 0;
  let payables = 0;

  visibleAccounts.forEach(account => {
    const bal = balances[account.id] || 0;
    if (account.type === 'regular') {
      regularBalance += bal;
    } else if (account.type === 'debt') {
      if (account.debtDirection === 'receivable') {
        receivables += bal;
      } else if (account.debtDirection === 'payable') {
        payables += bal;
      }
    }
  });

  const totalAssets = Math.max(0, regularBalance) + receivables;
  const totalDebts = Math.abs(payables);
  const netWorth = regularBalance + receivables - payables;

  return {
    regularBalance,
    receivables,
    payables,
    netWorth,
    totalAssets,
    totalDebts
  };
}

export function getStatsAggregation(
  transactions: Transaction[],
  categories: Category[],
  tags: Tag[],
  accounts: Account[],
  filters: {
    accountId: string;
    categoryId: string;
    tagId: string;
    startDate: number;
    endDate: number;
  }
) {
  const hiddenAccountIds = new Set(accounts.filter(a => a.hidden).map(a => a.id));
  const filtered = transactions.filter(t => {
    if (t.status === 'hidden') return false;
    // Hide non-transfer transactions of hidden accounts
    if (t.type !== 'transfer' && hiddenAccountIds.has(t.accountId)) return false;
    if (filters.accountId !== 'all' && t.accountId !== filters.accountId && t.transferAccountId !== filters.accountId) return false;
    if (filters.categoryId !== 'all' && t.categoryId !== filters.categoryId) return false;
    if (filters.tagId !== 'all' && !t.tagIds.includes(filters.tagId)) return false;
    if (t.date < filters.startDate || t.date > filters.endDate) return false;
    return true;
  });

  const nonInitial = filtered.filter(t => !isInitialBalanceTx(t));

  const income = nonInitial.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = nonInitial.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netFlow = income - expenses;

  const byCategory = nonInitial
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.categoryId] = (acc[t.categoryId] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const byTag = filtered
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      t.tagIds.forEach(tagId => {
        acc[tagId] = (acc[tagId] || 0) + t.amount;
      });
      return acc;
    }, {} as Record<string, number>);

  return {
    income,
    expenses,
    netFlow,
    byCategory,
    byTag
  };
}

export function generateCSV(
  transactions: Transaction[], 
  accounts: Account[], 
  categories: Category[], 
  tags: Tag[],
  currency: string
): string {
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const tagMap = new Map(tags.map(t => [t.id, t]));

  const headers = [
    'transaction_id', 'date', 'created_at', 'updated_at', 'type', 'status', 'amount', 'currency', 
    'description', 'account_id', 'account_name', 'transfer_account_id', 'transfer_account_name', 
    'category_id', 'category_label', 'tag_ids', 'tag_labels', 'included_in_balances', 'included_in_stats'
  ];

  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = transactions.sort((a, b) => a.date - b.date || a.createdAt - b.createdAt).map(t => {
    const acc = accountMap.get(t.accountId);
    const transAcc = t.transferAccountId ? accountMap.get(t.transferAccountId) : null;
    const cat = categoryMap.get(t.categoryId);
    const tTags = t.tagIds.map(id => tagMap.get(id)).filter(Boolean);

    return [
      t.id,
      new Date(t.date).toISOString().split('T')[0],
      new Date(t.createdAt).toISOString(),
      new Date(t.updatedAt).toISOString(),
      t.type,
      t.status,
      t.amount,
      currency,
      t.description || '',
      t.accountId,
      acc ? acc.name : 'Unknown Account',
      t.transferAccountId || '',
      transAcc ? transAcc.name : '',
      t.categoryId,
      cat ? cat.label : 'Uncategorized',
      t.tagIds.join(';'),
      tTags.map(tag => tag?.label).join(';'),
      t.status !== 'hidden',
      t.status !== 'hidden'
    ].map(escape).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function safeDivide(a: number, b: number): number {
  if (b === 0) return 0;
  const res = a / b;
  return isNaN(res) || !isFinite(res) ? 0 : res;
}

export function getMonthlyEquivalent(amount: number, periodicityDays?: number): number {
  if (!amount || isNaN(amount)) return 0;
  if (!periodicityDays || periodicityDays <= 0 || periodicityDays === 30) return amount;
  if (periodicityDays === 7) return (amount * 52) / 12;
  if (periodicityDays === 14) return (amount * 26) / 12;
  if (periodicityDays === 90) return amount / 3;
  if (periodicityDays === 365) return amount / 12;
  return (amount * 365) / (12 * periodicityDays);
}

export interface ExpectedFinancials {
  expectedGains: number;
  expectedExpenses: number;
  expectedDelta: number;
}

export function computeExpectedMonthlyFinancials(
  recurringTransactions: RecurringTransaction[],
  categories: Category[]
): ExpectedFinancials {
  const activeRecurring = (recurringTransactions || []).filter(r => r.active !== false);

  // 1. Expected Gains from recurring income
  let expectedGains = activeRecurring
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + getMonthlyEquivalent(r.amount, r.periodicityDays), 0);

  // Add income categories if they have a budget limit higher than recurring income assigned
  const incomeCategories = (categories || []).filter(c => c.type === 'income' && (c.budgetLimit || 0) > 0);
  incomeCategories.forEach(cat => {
    const recurringInCat = activeRecurring
      .filter(r => r.type === 'income' && r.categoryId === cat.id)
      .reduce((sum, r) => sum + getMonthlyEquivalent(r.amount, r.periodicityDays), 0);
    const catBudget = cat.budgetLimit || 0;
    if (catBudget > recurringInCat) {
      expectedGains += (catBudget - recurringInCat);
    }
  });

  // 2. Expected Expenses from recurring expenses + category budgets
  const recurringExpensesByCat = new Map<string, number>();
  let unassignedRecurringExpenses = 0;

  activeRecurring
    .filter(r => r.type === 'expense')
    .forEach(r => {
      const monthly = getMonthlyEquivalent(r.amount, r.periodicityDays);
      if (r.categoryId) {
        recurringExpensesByCat.set(r.categoryId, (recurringExpensesByCat.get(r.categoryId) || 0) + monthly);
      } else {
        unassignedRecurringExpenses += monthly;
      }
    });

  let expectedExpenses = unassignedRecurringExpenses;

  // Track all expense categories (from categories array or recurring expense tags)
  const allExpenseCategoryIds = new Set([
    ...(categories || []).filter(c => c.type !== 'income').map(c => c.id),
    ...Array.from(recurringExpensesByCat.keys())
  ]);

  allExpenseCategoryIds.forEach(catId => {
    const cat = (categories || []).find(c => c.id === catId);
    const catBudget = (cat && cat.type !== 'income') ? (cat.budgetLimit || 0) : 0;
    const recurringInCat = recurringExpensesByCat.get(catId) || 0;
    expectedExpenses += Math.max(catBudget, recurringInCat);
  });

  const expectedDelta = expectedGains - expectedExpenses;

  return {
    expectedGains,
    expectedExpenses,
    expectedDelta
  };
}
