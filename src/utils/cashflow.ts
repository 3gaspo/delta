import { Account, Transaction, RecurringTransaction } from '../types';
import { getAccountBalance, isInitialBalanceTx } from './financial';
import { calculateNextDueDate, getNextPeriodDate } from './recurring';

export interface ProjectedStep {
  date: number;
  name: string;
  type: string;
  amount: number;
  delta: number;
  balanceBefore: number;
  balanceAfter: number;
  isNegative: boolean;
  isRecurring: boolean;
}

export interface AccountCashflowAlert {
  accountId: string;
  accountName: string;
  isShared?: boolean;
  isNegativeNow: boolean;
  willGoNegative: boolean;
  currentBalance: number;
  firstNegativeDate?: number;
  firstNegativeBalance?: number;
  shortfallAmount?: number;
  daysUntilNegative?: number;
  triggeringEvent?: {
    name: string;
    amount: number;
    date: number;
    type: string;
    isRecurring: boolean;
  };
  lowestBalance: number;
  lowestBalanceDate: number;
  sequence: ProjectedStep[];
}

interface ProjectedEvent {
  id: string;
  date: number;
  name: string;
  amount: number;
  delta: number;
  type: string;
  isRecurring: boolean;
  source: 'transaction' | 'recurring';
}

/**
 * Computes the chronological cashflow sequence for an account and checks if/when
 * the account balance will drop below 0 within the given projection horizon (in days).
 */
export function computeAccountCashflowAlert(
  account: Account,
  transactions: Transaction[],
  recurringTransactions: RecurringTransaction[],
  horizonDays: number = 60,
  now: number = Date.now()
): AccountCashflowAlert {
  const horizonMs = horizonDays * 24 * 60 * 60 * 1000;
  const horizonDate = now + horizonMs;

  // 1. Current balance at now
  const transactionsUpToNow = transactions.filter(t => t.date <= now && t.status !== 'hidden');
  const currentBalance = Math.round(getAccountBalance(account.id, transactionsUpToNow, account) * 100) / 100;

  // 2. Collect future discrete transactions already in the ledger (date > now)
  const futureDiscreteTxs = transactions.filter(t => (
    t.date > now &&
    t.date <= horizonDate &&
    t.status !== 'hidden' &&
    !isInitialBalanceTx(t) &&
    (t.accountId === account.id || t.transferAccountId === account.id)
  ));

  const events: ProjectedEvent[] = [];

  for (const t of futureDiscreteTxs) {
    let delta = 0;
    if (account.type === 'regular') {
      if (t.accountId === account.id) {
        if (t.type === 'expense' || t.type === 'transfer' || t.type === 'subscription') {
          delta = -t.amount;
        } else if (t.type === 'income') {
          delta = +t.amount;
        }
      } else if (t.transferAccountId === account.id) {
        delta = +t.amount;
      }
    } else {
      // For debt accounts
      const isReceivable = account.debtDirection === 'receivable';
      if (t.accountId === account.id) {
        if (isReceivable) {
          delta = t.type === 'expense' ? +t.amount : -t.amount;
        } else {
          delta = t.type === 'income' ? +t.amount : -t.amount;
        }
      } else if (t.transferAccountId === account.id) {
        delta = isReceivable ? +t.amount : -t.amount;
      }
    }

    events.push({
      id: t.id,
      date: t.date,
      name: t.name || (t.type === 'transfer' ? 'Transfer' : 'Transaction'),
      amount: t.amount,
      delta,
      type: t.type,
      isRecurring: Boolean(t.recurringId || t.periodicityDays),
      source: 'transaction'
    });
  }

  // 3. Project upcoming occurrences of active recurring transactions
  const activeRecurring = (recurringTransactions || []).filter(r => (
    r.active !== false &&
    r.periodicityDays > 0 &&
    (r.accountId === account.id || r.transferAccountId === account.id)
  ));

  for (const rule of activeRecurring) {
    let occDate = calculateNextDueDate(rule);

    // If next dueDate has already passed, advance to the first future date > now
    while (occDate <= now && rule.periodicityDays > 0) {
      const next = getNextPeriodDate(occDate, rule.periodicityDays);
      if (next <= occDate) break;
      occDate = next;
    }

    // Generate occurrences up to horizonDate
    let safetyCounter = 0;
    while (occDate <= horizonDate && safetyCounter < 100) {
      safetyCounter++;

      // Check if a discrete transaction was already recorded on this day for this recurring rule
      const occDayStr = new Date(occDate).toDateString();
      const alreadyLogged = transactions.some(t => {
        if (t.status === 'hidden') return false;
        if (t.recurringId === rule.id && new Date(t.date).toDateString() === occDayStr) {
          return true;
        }
        return false;
      });

      if (!alreadyLogged) {
        let delta = 0;
        if (account.type === 'regular') {
          if (rule.accountId === account.id) {
            if (rule.type === 'expense' || rule.type === 'transfer') {
              delta = -rule.amount;
            } else if (rule.type === 'income') {
              delta = +rule.amount;
            }
          } else if (rule.transferAccountId === account.id) {
            delta = +rule.amount;
          }
        } else {
          const isReceivable = account.debtDirection === 'receivable';
          if (rule.accountId === account.id) {
            delta = isReceivable ? (rule.type === 'expense' ? +rule.amount : -rule.amount) : (rule.type === 'income' ? +rule.amount : -rule.amount);
          } else if (rule.transferAccountId === account.id) {
            delta = isReceivable ? +rule.amount : -rule.amount;
          }
        }

        events.push({
          id: `rec-${rule.id}-${occDate}`,
          date: occDate,
          name: rule.name || 'Recurring Rule',
          amount: rule.amount,
          delta,
          type: rule.type,
          isRecurring: true,
          source: 'recurring'
        });
      }

      const next = getNextPeriodDate(occDate, rule.periodicityDays);
      if (next <= occDate) break;
      occDate = next;
    }
  }

  // 4. Sort events chronologically:
  // For events occurring on the same day, process gains (delta > 0) BEFORE deductions (delta < 0)
  events.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date - b.date;
    }
    // Positive income first on the same day
    return b.delta - a.delta;
  });

  // 5. Sequential simulation
  let runningBalance = currentBalance;
  let lowestBalance = currentBalance;
  let lowestBalanceDate = now;

  let willGoNegative = currentBalance < 0;
  let firstNegativeEvent: ProjectedEvent | null = null;
  let firstNegativeBalance: number | null = currentBalance < 0 ? currentBalance : null;
  let firstNegativeDate: number | null = currentBalance < 0 ? now : null;

  const sequence: ProjectedStep[] = [];

  for (const event of events) {
    const balanceBefore = runningBalance;
    runningBalance = Math.round((runningBalance + event.delta) * 100) / 100;
    const balanceAfter = runningBalance;

    const isStepNegative = balanceAfter < 0;

    sequence.push({
      date: event.date,
      name: event.name,
      type: event.type,
      amount: event.amount,
      delta: event.delta,
      balanceBefore,
      balanceAfter,
      isNegative: isStepNegative,
      isRecurring: event.isRecurring
    });

    if (balanceAfter < lowestBalance) {
      lowestBalance = balanceAfter;
      lowestBalanceDate = event.date;
    }

    if (balanceAfter < 0 && firstNegativeEvent === null) {
      willGoNegative = true;
      firstNegativeEvent = event;
      firstNegativeBalance = balanceAfter;
      firstNegativeDate = event.date;
    }
  }

  const daysUntilNegative = firstNegativeDate 
    ? Math.max(0, Math.ceil((firstNegativeDate - now) / (1000 * 60 * 60 * 24)))
    : undefined;

  return {
    accountId: account.id,
    accountName: account.name,
    isShared: account.isShared,
    isNegativeNow: currentBalance < 0,
    willGoNegative,
    currentBalance,
    firstNegativeDate: firstNegativeDate ?? undefined,
    firstNegativeBalance: firstNegativeBalance ?? undefined,
    shortfallAmount: firstNegativeBalance !== null && firstNegativeBalance < 0 
      ? Math.abs(firstNegativeBalance) 
      : undefined,
    daysUntilNegative,
    triggeringEvent: firstNegativeEvent ? {
      name: firstNegativeEvent.name,
      amount: firstNegativeEvent.amount,
      date: firstNegativeEvent.date,
      type: firstNegativeEvent.type,
      isRecurring: firstNegativeEvent.isRecurring
    } : undefined,
    lowestBalance,
    lowestBalanceDate,
    sequence
  };
}

/**
 * Returns a map of all cashflow alerts for the provided accounts.
 */
export function getAccountsCashflowAlerts(
  accounts: Account[],
  transactions: Transaction[],
  recurringTransactions: RecurringTransaction[],
  horizonDays: number = 60,
  now: number = Date.now()
): Map<string, AccountCashflowAlert> {
  const map = new Map<string, AccountCashflowAlert>();
  for (const acc of accounts) {
    // Check all non-archived regular accounts (and any account user tracks)
    if (!acc.archived) {
      const alert = computeAccountCashflowAlert(acc, transactions, recurringTransactions, horizonDays, now);
      map.set(acc.id, alert);
    }
  }
  return map;
}

/**
 * Returns an array of only those accounts that currently have an overdraft risk / alert.
 */
export function getActiveCashflowAlerts(
  accounts: Account[],
  transactions: Transaction[],
  recurringTransactions: RecurringTransaction[],
  horizonDays: number = 60,
  now: number = Date.now()
): AccountCashflowAlert[] {
  const allAlerts = getAccountsCashflowAlerts(accounts, transactions, recurringTransactions, horizonDays, now);
  return Array.from(allAlerts.values()).filter(a => a.willGoNegative || a.isNegativeNow);
}
