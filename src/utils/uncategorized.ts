import type { Category, Transaction, RecurringTransaction } from '../types';

/** Legacy fallback records remain stored, but are exposed as a virtual group. */
export function projectUncategorized(categories: Category[], transactions: Transaction[], recurringTransactions: RecurringTransaction[]) {
  const actual = categories.filter(category => category.label.trim().toLowerCase() !== 'uncategorized');
  const actualIds = new Set(actual.map(category => category.id));
  const normalize = <T extends { categoryId?: string }>(entry: T): T => actualIds.has(entry.categoryId ?? '') ? entry : { ...entry, categoryId: '' };
  const visibleTransactions = transactions.map(normalize);
  const visibleRecurring = recurringTransactions.map(normalize);
  const hasEntries = visibleTransactions.some(entry => !entry.categoryId && entry.type !== 'transfer')
    || visibleRecurring.some(entry => !entry.categoryId && entry.type !== 'transfer');
  return {
    categories: hasEntries ? [...actual, { id: '', label: 'Uncategorized', color: '#64748b', type: 'both' as const, createdAt: 0, updatedAt: 0 }] : actual,
    transactions: visibleTransactions,
    recurringTransactions: visibleRecurring,
  };
}
