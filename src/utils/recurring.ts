import { RecurringTransaction, Transaction } from '../types';

export function getNextPeriodDate(currentDate: number, periodicityDays: number): number {
  const d = new Date(currentDate);
  if (periodicityDays === 7 || periodicityDays === 14) {
    d.setDate(d.getDate() + periodicityDays);
  } else if (periodicityDays === 30) {
    const targetDay = d.getDate();
    d.setMonth(d.getMonth() + 1);
    if (d.getDate() !== targetDay) {
      d.setDate(0); // Snap to last day of month if overflowed
    }
  } else if (periodicityDays === 90) {
    const targetDay = d.getDate();
    d.setMonth(d.getMonth() + 3);
    if (d.getDate() !== targetDay) {
      d.setDate(0);
    }
  } else if (periodicityDays === 365) {
    const targetDay = d.getDate();
    d.setFullYear(d.getFullYear() + 1);
    if (d.getDate() !== targetDay) {
      d.setDate(0);
    }
  } else {
    d.setDate(d.getDate() + Math.max(1, periodicityDays));
  }
  return d.getTime();
}

export function getPeriodicityLabel(periodicityDays: number): string {
  switch (periodicityDays) {
    case 7:
      return 'Weekly';
    case 14:
      return 'Bi-weekly';
    case 30:
      return 'Monthly';
    case 90:
      return 'Quarterly';
    case 365:
      return 'Yearly';
    default:
      return `Every ${periodicityDays} days`;
  }
}

export function calculateNextDueDate(rule: RecurringTransaction): number {
  if (!rule.periodicityDays || rule.periodicityDays <= 0) {
    return rule.startDate || Date.now();
  }
  if (!rule.lastGeneratedDate) {
    return rule.startDate;
  }
  return getNextPeriodDate(rule.lastGeneratedDate, rule.periodicityDays);
}

export function sortRecurringByNextDate(rules: RecurringTransaction[]): RecurringTransaction[] {
  return [...rules].sort((a, b) => {
    const nextA = calculateNextDueDate(a);
    const nextB = calculateNextDueDate(b);
    if (nextA !== nextB) {
      return nextA - nextB;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

export function generateDueTransactions(
  rule: RecurringTransaction,
  upToDate: number = Date.now(),
  existingTransactions: Transaction[] = []
): { newTransactions: Transaction[]; updatedLastGeneratedDate: number } {
  if (rule.active === false || !rule.periodicityDays || rule.periodicityDays <= 0) {
    return { newTransactions: [], updatedLastGeneratedDate: rule.lastGeneratedDate || rule.startDate };
  }

  const existingDates = new Set(
    existingTransactions
      .filter(t => t.recurringId === rule.id)
      .map(t => {
        const d = new Date(t.date);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
  );

  const newTransactions: Transaction[] = [];
  let candidateDate = rule.lastGeneratedDate
    ? getNextPeriodDate(rule.lastGeneratedDate, rule.periodicityDays)
    : rule.startDate;

  let lastGenerated = rule.lastGeneratedDate || 0;
  let iterations = 0;
  const maxIterations = 500; // Safeguard

  while (candidateDate <= upToDate && iterations < maxIterations) {
    iterations++;
    const candObj = new Date(candidateDate);
    const dateKey = `${candObj.getFullYear()}-${candObj.getMonth()}-${candObj.getDate()}`;

    if (!existingDates.has(dateKey)) {
      const now = Date.now();
      newTransactions.push({
        id: crypto.randomUUID(),
        amount: rule.amount,
        date: candidateDate,
        accountId: rule.accountId,
        transferAccountId: rule.transferAccountId,
        categoryId: rule.categoryId || '',
        tagIds: rule.tagIds || [],
        type: rule.type,
        status: rule.status || 'normal',
        name: rule.name,
        description: rule.description || '',
        recurringId: rule.id,
        createdAt: now,
        updatedAt: now
      });
      existingDates.add(dateKey);
    }

    lastGenerated = candidateDate;
    candidateDate = getNextPeriodDate(candidateDate, rule.periodicityDays);
  }

  return {
    newTransactions,
    updatedLastGeneratedDate: lastGenerated || rule.lastGeneratedDate || rule.startDate
  };
}
