import React, { useState, useMemo } from 'react';
import { Account, Transaction } from '../../types';
import { useData } from '../../providers/DataProvider';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { getAccountBalance, computeAccountCashflowAlert } from '../../utils/financial';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Base';
import { 
  Landmark, TrendingUp, TrendingDown, Edit3, HandCoins, AlertTriangle, CalendarClock, ArrowRight, Repeat 
} from 'lucide-react';
import { AccountForm } from './AccountForm';

interface AccountDetailModalProps {
  account: Account | null;
  onClose: () => void;
}

export function AccountDetailModal({ account, onClose }: AccountDetailModalProps) {
  const { transactions, recurringTransactions, categories, settings } = useData();
  const [isEditingAccount, setIsEditingAccount] = useState(false);

  const isDebt = account?.type === 'debt';
  const isReceivable = account?.debtDirection === 'receivable';
  const balance = account ? getAccountBalance(account.id, transactions, account) : 0;

  const cashflowAlert = useMemo(() => {
    if (!account) return null;
    return computeAccountCashflowAlert(account, transactions, recurringTransactions);
  }, [account, transactions, recurringTransactions]);

  const [activeTab, setActiveTab] = useState<'activity' | 'cashflow'>(() => {
    return (cashflowAlert?.willGoNegative || cashflowAlert?.isNegativeNow) ? 'cashflow' : 'activity';
  });

  // All transactions touching this account: primary, transfer, or debt link
  const relevantTransactions = useMemo(() => {
    if (!account) return [];
    return transactions
      .filter(t => t.status !== 'hidden' && (
        t.accountId === account.id || 
        t.transferAccountId === account.id || 
        t.debtAccountId === account.id
      ))
      .sort((a, b) => b.date - a.date);
  }, [transactions, account?.id]);

  if (!account) return null;

  return (
    <Modal isOpen={!!account} onClose={onClose} title={account.name}>
      <div className="space-y-5 py-1">
        {/* Account Header Banner */}
        <div className={cn(
          "p-5 rounded-3xl border flex items-center justify-between gap-3",
          isDebt 
            ? (isReceivable 
                ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-950 dark:text-emerald-50" 
                : "bg-red-500/5 border-red-500/15 text-red-950 dark:text-red-50")
            : "bg-black/[0.03] dark:bg-white/[0.03] border-black/5 dark:border-white/5"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs",
              isDebt 
                ? (isReceivable ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400")
                : "bg-black/10 dark:bg-white/10 text-foreground"
            )}>
              {isDebt 
                ? (isReceivable ? <TrendingUp size={24} /> : <TrendingDown size={24} />)
                : <Landmark size={24} />}
            </div>
            <div>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mb-1",
                isDebt 
                  ? (isReceivable 
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" 
                      : "bg-red-500/20 text-red-700 dark:text-red-300")
                  : (account.isShared
                      ? "bg-sky-500/20 text-sky-700 dark:text-sky-300"
                      : "bg-black/10 dark:bg-white/10 text-foreground/80")
              )}>
                {isDebt 
                  ? (isReceivable ? 'Receivable (Owed to you)' : 'Payable (You owe)') 
                  : (account.isShared ? `Shared Account (${Math.round((account.defaultMyShareRatio ?? 0.5) * 100)}% My Share)` : 'Regular Bank Account')}
              </span>
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {formatCurrency(balance, settings.currency)}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditingAccount(true)}
            className="text-xs shrink-0 flex items-center gap-1.5"
          >
            <Edit3 size={13} /> Edit
          </Button>
        </div>

        {/* Overdraft Alert Banner */}
        {cashflowAlert && (cashflowAlert.isNegativeNow || cashflowAlert.willGoNegative) && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-100 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle size={16} className="shrink-0" />
              <span>Overdraft Alert: Cashflow Deficit Projected</span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">
              {cashflowAlert.isNegativeNow ? (
                <>
                  This account currently has a negative balance of <strong className="text-red-500">{formatCurrency(cashflowAlert.currentBalance, settings.currency)}</strong>. 
                  Projected to reach a low of <strong className="text-red-500 font-bold">{formatCurrency(cashflowAlert.lowestBalance, settings.currency)}</strong> on {formatDate(cashflowAlert.lowestBalanceDate)}.
                </>
              ) : (
                <>
                  Current balance is <strong>{formatCurrency(cashflowAlert.currentBalance, settings.currency)}</strong>. 
                  On <strong>{formatDate(cashflowAlert.firstNegativeDate!)}</strong>, this account is projected to drop below 0 to <strong className="text-red-500 font-bold">{formatCurrency(cashflowAlert.firstNegativeBalance!, settings.currency)}</strong> after <span className="font-semibold">{cashflowAlert.triggeringEvent?.name}</span> ({formatCurrency(cashflowAlert.triggeringEvent?.amount || 0, settings.currency)}).
                </>
              )}
            </p>
            {cashflowAlert.shortfallAmount && !cashflowAlert.isNegativeNow && (
              <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-500/15 p-2 rounded-xl flex items-center gap-2">
                <span>💡</span>
                <span>
                  Requires an expected gain or transfer of at least <strong>{formatCurrency(cashflowAlert.shortfallAmount, settings.currency)}</strong> before <strong>{formatDate(cashflowAlert.firstNegativeDate!)}</strong> to avoid dropping below 0.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tab Toggle: Past Activity vs. Projected Cashflow Sequence */}
        <div className="grid grid-cols-2 p-1 bg-black/5 dark:bg-white/5 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={cn(
              "py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5",
              activeTab === 'activity'
                ? "bg-background text-foreground shadow-xs"
                : "text-foreground/50 hover:text-foreground"
            )}
          >
            <span>Activity History</span>
            <span className="text-[10px] opacity-50 font-normal">({relevantTransactions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cashflow')}
            className={cn(
              "py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5",
              activeTab === 'cashflow'
                ? "bg-background text-foreground shadow-xs"
                : "text-foreground/50 hover:text-foreground"
            )}
          >
            <CalendarClock size={13} />
            <span>Cashflow Sequence</span>
            {cashflowAlert && (cashflowAlert.isNegativeNow || cashflowAlert.willGoNegative) && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* TAB 1: ACTIVITY HISTORY */}
        {activeTab === 'activity' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider opacity-40">
                Account Activity ({relevantTransactions.length})
              </h4>
              {account.initialBalance !== undefined && account.initialBalance !== 0 && (
                <span className="text-[10px] opacity-50 font-medium">
                  Initial: {formatCurrency(account.initialBalance, settings.currency)}
                </span>
              )}
            </div>

            <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 divide-y divide-black/5 dark:divide-white/5 max-h-[340px] overflow-y-auto">
              {relevantTransactions.length === 0 ? (
                <div className="p-8 text-center text-xs opacity-40">
                  <p>No transactions recorded yet for {account.name}.</p>
                </div>
              ) : (
                relevantTransactions.map(tx => {
                  const cat = categories.find(c => c.id === tx.categoryId);
                  const isLinkedDebt = tx.debtAccountId === account.id;
                  const isPrimaryAccount = tx.accountId === account.id;
                  const isTransferDest = tx.transferAccountId === account.id;

                  // Calculate impact on this specific account
                  let impactDelta = 0;
                  let impactSign = '';
                  let impactColor = '';

                  if (isLinkedDebt) {
                    if (isReceivable) {
                      impactDelta = tx.type === 'expense' ? tx.amount : -tx.amount;
                    } else {
                      impactDelta = tx.type === 'income' ? tx.amount : -tx.amount;
                    }
                  } else if (isPrimaryAccount) {
                    if (isDebt) {
                      if (isReceivable) {
                        impactDelta = tx.type === 'expense' ? tx.amount : -tx.amount;
                      } else {
                        impactDelta = tx.type === 'income' ? tx.amount : -tx.amount;
                      }
                    } else {
                      impactDelta = tx.type === 'income' ? tx.amount : -tx.amount;
                    }
                  } else if (isTransferDest) {
                    if (isDebt) {
                      impactDelta = isReceivable ? tx.amount : -tx.amount;
                    } else {
                      impactDelta = tx.amount;
                    }
                  }

                  if (impactDelta > 0) {
                    impactSign = '+';
                    impactColor = 'text-emerald-500';
                  } else if (impactDelta < 0) {
                    impactSign = '-';
                    impactColor = 'text-red-500';
                  } else {
                    impactColor = 'opacity-50';
                  }

                  return (
                    <div key={tx.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold truncate text-foreground">
                            {tx.name || cat?.label || 'Transaction'}
                          </span>
                          {isLinkedDebt && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                              <HandCoins size={10} /> Linked Debt
                            </span>
                          )}
                          {tx.groupId && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-black/5 dark:bg-white/10 opacity-70 px-1.5 py-0.2 rounded shrink-0">
                              Group
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] opacity-50 mt-0.5">
                          <span>{formatDate(tx.date)}</span>
                          {cat && <span>• {cat.label}</span>}
                          {tx.type === 'transfer' && <span>• Transfer</span>}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={cn("font-bold text-sm", impactColor)}>
                          {impactSign}{formatCurrency(Math.abs(tx.amount), settings.currency)}
                        </span>
                        {tx.myShareAmount !== undefined && tx.myShareAmount !== tx.amount && (
                          <span className="text-[10px] font-bold text-foreground/50 block">
                            My share: {formatCurrency(tx.myShareAmount, settings.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PROJECTED CASHFLOW SEQUENCE */}
        {activeTab === 'cashflow' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-wider opacity-40">
                Sequential Cashflow Projection (Next 60 Days)
              </h4>
              <span className="text-[10px] opacity-50 font-medium">
                Starting: {formatCurrency(cashflowAlert?.currentBalance ?? balance, settings.currency)}
              </span>
            </div>

            <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 divide-y divide-black/5 dark:divide-white/5 max-h-[340px] overflow-y-auto">
              {!cashflowAlert || cashflowAlert.sequence.length === 0 ? (
                <div className="p-8 text-center text-xs opacity-40">
                  <p>No upcoming transactions or recurring rules projected for {account.name} in the next 60 days.</p>
                </div>
              ) : (
                cashflowAlert.sequence.map((step, idx) => {
                  const isPositiveDelta = step.delta > 0;
                  return (
                    <div 
                      key={`${step.date}-${idx}`} 
                      className={cn(
                        "p-3 flex items-center justify-between gap-3 text-xs transition-colors",
                        step.isNegative && "bg-red-500/[0.04] dark:bg-red-500/[0.08]"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold truncate text-foreground">
                            {step.name}
                          </span>
                          {step.isRecurring && (
                            <span className="text-[8px] font-black uppercase tracking-wider bg-black/5 dark:bg-white/10 opacity-70 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                              <Repeat size={9} /> Recurring
                            </span>
                          )}
                          {step.isNegative && (
                            <span className="text-[8px] font-black uppercase tracking-wider bg-red-500/15 text-red-600 dark:text-red-400 px-1.5 py-0.2 rounded shrink-0">
                              Below 0
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] opacity-50 mt-0.5">
                          <span>{formatDate(step.date)}</span>
                          <span>•</span>
                          <span>
                            {formatCurrency(step.balanceBefore, settings.currency)}
                          </span>
                          <ArrowRight size={10} className="shrink-0 opacity-40" />
                          <span className={cn(
                            "font-bold",
                            step.balanceAfter < 0 ? "text-red-500" : "text-foreground/80"
                          )}>
                            {formatCurrency(step.balanceAfter, settings.currency)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={cn(
                          "font-bold text-sm",
                          isPositiveDelta ? "text-emerald-500" : "text-red-500"
                        )}>
                          {isPositiveDelta ? '+' : ''}{formatCurrency(step.delta, settings.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Projection Summary Shelf */}
            {cashflowAlert && cashflowAlert.sequence.length > 0 && (
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-40 block">Current</span>
                  <span className="font-bold">{formatCurrency(cashflowAlert.currentBalance, settings.currency)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-40 block">Lowest Point</span>
                  <span className={cn(
                    "font-bold",
                    cashflowAlert.lowestBalance < 0 ? "text-red-500" : "text-foreground"
                  )}>
                    {formatCurrency(cashflowAlert.lowestBalance, settings.currency)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-40 block">Lowest Date</span>
                  <span className="font-medium text-[11px] opacity-70">
                    {formatDate(cashflowAlert.lowestBalanceDate)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Account Modal */}
      {isEditingAccount && (
        <Modal isOpen={isEditingAccount} onClose={() => setIsEditingAccount(false)} title="Edit Account">
          <AccountForm onClose={() => setIsEditingAccount(false)} initialData={account} />
        </Modal>
      )}
    </Modal>
  );
}
