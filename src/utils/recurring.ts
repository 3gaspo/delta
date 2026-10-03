import { RecurringTransaction, Transaction } from '../types';

export function getNextPeriodDate(currentDate: number, periodicityDays: number): number {
  const d = new Date(currentDate);
  d.setHours(0, 0, 0, 0);
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
  d.setHours(0, 0, 0, 0);
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
    return { newTransactions: [], updatedLastGeneratedDate: rule.lastGeneratedDate || 0 };
  }

  const existingDates = new Set(
    existingTransactions
      .filter(t => t.recurringId === rule.id)
      .map(t => {
        const d = new Date(t.date);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
  );

  const hasOccurrences = existingDates.size > 0;

  // Candidate start date:
  // If occurrences exist and startDate is at or after lastGeneratedDate,
  // we can fast-forward from getNextPeriodDate(rule.lastGeneratedDate).
  // Otherwise (new rule, no occurrences yet, or startDate moved backwards into the past),
  // start from rule.startDate to generate all due/missing occurrences!
  let candidateDate = rule.startDate;
  if (rule.lastGeneratedDate && hasOccurrences && rule.startDate >= rule.lastGeneratedDate) {
    candidateDate = getNextPeriodDate(rule.lastGeneratedDate, rule.periodicityDays);
  }

  // Ensure cutoff includes the entire current calendar day of upToDate (23:59:59.999 local time)
  // so any transaction due today (regardless of hour created or timezone) is generated!
  const targetEnd = new Date(upToDate);
  targetEnd.setHours(23, 59, 59, 999);
  const cutoffTime = targetEnd.getTime();

  const newTransactions: Transaction[] = [];
  let lastGenerated = rule.lastGeneratedDate || 0;
  let iterations = 0;
  const maxIterations = 500; // Safeguard

  while (candidateDate <= cutoffTime && iterations < maxIterations) {
    iterations++;
    const candObj = new Date(candidateDate);
    const dateKey = `${candObj.getFullYear()}-${candObj.getMonth()}-${candObj.getDate()}`;

    if (!existingDates.has(dateKey)) {
      // Recurring transactions are always added at the first instant of that day (00:00:00)
      const txDateObj = new Date(candObj.getFullYear(), candObj.getMonth(), candObj.getDate(), 0, 0, 0, 0);
      const startOfDayTime = txDateObj.getTime();
      const tx: Transaction = {
        id: crypto.randomUUID(),
        amount: rule.amount,
        date: startOfDayTime,
        accountId: rule.accountId,
        categoryId: rule.categoryId || '',
        tagIds: rule.tagIds || [],
        type: rule.type,
        status: rule.status || 'normal',
        name: rule.name,
        description: rule.description || '',
        recurringId: rule.id,
        createdAt: startOfDayTime,
        updatedAt: startOfDayTime
      };
      if (rule.transferAccountId) {
        tx.transferAccountId = rule.transferAccountId;
      }
      if (rule.debtAccountId) {
        tx.debtAccountId = rule.debtAccountId;
      }
      newTransactions.push(tx);
      existingDates.add(dateKey);
      lastGenerated = startOfDayTime;
    } else {
      lastGenerated = candidateDate;
    }

    candidateDate = getNextPeriodDate(candidateDate, rule.periodicityDays);
  }

  return {
    newTransactions,
    updatedLastGeneratedDate: lastGenerated > 0 ? lastGenerated : (rule.lastGeneratedDate || 0)
  };
}
