import { Transaction, Account, Category, Tag } from '../types';

export function getAccountBalance(accountId: string, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.status !== 'hidden' && (t.accountId === accountId || t.transferAccountId === accountId))
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
  const balances = accounts.reduce((acc, account) => {
    acc[account.id] = getAccountBalance(account.id, transactions);
    return acc;
  }, {} as Record<string, number>);

  let regularBalance = 0;
  let receivables = 0;
  let payables = 0;

  accounts.forEach(account => {
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
  const filtered = transactions.filter(t => {
    if (t.status === 'hidden') return false;
    if (filters.accountId !== 'all' && t.accountId !== filters.accountId && t.transferAccountId !== filters.accountId) return false;
    if (filters.categoryId !== 'all' && t.categoryId !== filters.categoryId) return false;
    if (filters.tagId !== 'all' && !t.tagIds.includes(filters.tagId)) return false;
    if (t.date < filters.startDate || t.date > filters.endDate) return false;
    return true;
  });

  const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netFlow = income - expenses;

  const byCategory = filtered
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
