import { useState, useMemo } from 'react';
import { useData } from '../providers/DataProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, Button } from '../components/ui/Base';
import { AccountCard } from '../components/accounts/AccountCard';
import { RecurringList } from '../components/transactions/RecurringList';
import { Modal } from '../components/ui/Modal';
import { AccountForm } from '../components/accounts/AccountForm';
import { AccountDetailModal } from '../components/accounts/AccountDetailModal';
import { AccountReorderModal } from '../components/accounts/AccountReorderModal';
import { TransactionForm, FormTabMode } from '../components/transactions/TransactionForm';
import { Plus, ArrowUpDown, Repeat, Landmark, TrendingDown, AlertTriangle, ArrowRight } from 'lucide-react';
import { computeFinancialTotals, computeExpectedMonthlyFinancials, getActiveCashflowAlerts } from '../utils/financial';
import { Account } from '../types';
import { formatCurrency, cn } from '../lib/utils';

export default function Accounts() {
  const { accounts, transactions, recurringTransactions, categories, settings, loading } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [selectedDetailAccount, setSelectedDetailAccount] = useState<Account | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [isAddingRecurring, setIsAddingRecurring] = useState(false);
  const [recurringAddMode, setRecurringAddMode] = useState<FormTabMode>('subscription');

  const totals = useMemo(() => computeFinancialTotals(accounts, transactions), [accounts, transactions]);
  const expected = useMemo(
    () => computeExpectedMonthlyFinancials(recurringTransactions, categories),
    [recurringTransactions, categories]
  );

  const currentAssets = totals.regularBalance;
  const netDebt = totals.receivables - totals.payables;
  const projectedNetWorth = currentAssets + netDebt + expected.expectedDelta;

  const regularAccounts = accounts.filter(a => a.type === 'regular');
  const debtAccounts = accounts.filter(a => a.type === 'debt');

  const cashflowAlerts = useMemo(() => {
    return getActiveCashflowAlerts(regularAccounts, transactions, recurringTransactions);
  }, [regularAccounts, transactions, recurringTransactions]);

  if (loading) return null;

  return (
    <PageContainer 
      title="Accounts"
      actions={
        <div className="flex items-center gap-2">
          {accounts.length > 1 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsReordering(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold"
              title="Reorder accounts"
            >
              <ArrowUpDown size={15} /> Reorder
            </Button>
          )}
          <Button size="icon" onClick={() => setIsAdding(true)} title="New Account">
            <Plus size={20} />
          </Button>
        </div>
      }
    >
      {/* Overdraft / Below 0 Cashflow Warnings Banner */}
      {cashflowAlerts.length > 0 && (
        <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/25 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle size={17} className="shrink-0" />
              <span>
                Cashflow Alert: {cashflowAlerts.length} {cashflowAlerts.length === 1 ? 'account' : 'accounts'} at risk of going below 0
              </span>
            </div>
            <span className="text-[10px] font-semibold opacity-60">Next 60 Days</span>
          </div>

          <div className="space-y-2">
            {cashflowAlerts.map(alert => {
              const acc = accounts.find(a => a.id === alert.accountId);
              return (
                <div 
                  key={alert.accountId}
                  onClick={() => acc && setSelectedDetailAccount(acc)}
                  className="p-3 rounded-2xl bg-background/80 hover:bg-background border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {alert.accountName}
                      </span>
                      {alert.isShared && (
                        <span className="text-[8px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded">
                          Shared
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                        {alert.isNegativeNow 
                          ? `Currently ${formatCurrency(alert.currentBalance, settings.currency)}` 
                          : `Drops to ${formatCurrency(alert.firstNegativeBalance!, settings.currency)} on ${new Date(alert.firstNegativeDate!).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                      </span>
                    </div>

                    <p className="text-xs text-foreground/70 mt-1">
                      {alert.isNegativeNow ? (
                        <>Account is already below 0. Projected lowest point: <strong className="text-red-500">{formatCurrency(alert.lowestBalance, settings.currency)}</strong>.</>
                      ) : (
                        <>
                          Current: <strong>{formatCurrency(alert.currentBalance, settings.currency)}</strong>. Overdraft triggered on <strong>{new Date(alert.firstNegativeDate!).toLocaleDateString([], { month: 'short', day: 'numeric' })}</strong> by <span className="font-semibold underline underline-offset-2">{alert.triggeringEvent?.name}</span> ({formatCurrency(alert.triggeringEvent?.amount || 0, settings.currency)}).
                          {alert.shortfallAmount && (
                            <> Needs an expected gain or transfer of at least <strong className="text-amber-700 dark:text-amber-300">+{formatCurrency(alert.shortfallAmount, settings.currency)}</strong> before then.</>
                          )}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0 self-end sm:self-center">
                    <span>View Sequence</span>
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-8 p-6 sm:p-8 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-[40px] flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8 items-start">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-40">Current Assets</p>
              <span className="text-[9px] font-bold opacity-30 uppercase">(Total Money)</span>
            </div>
            <p className="text-3xl sm:text-4xl font-black tracking-tighter mt-1">
              {formatCurrency(currentAssets, settings.currency)}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-40">Net Worth</p>
              <span className="text-[9px] font-bold opacity-30 uppercase">(End of Month)</span>
            </div>
            <p className={cn(
              "text-3xl sm:text-4xl font-black tracking-tighter mt-1",
              projectedNetWorth >= 0 ? "text-foreground" : "text-red-500"
            )}>
              {formatCurrency(projectedNetWorth, settings.currency)}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-black/5 dark:border-white/5 grid grid-cols-3 gap-2 sm:gap-4 items-center">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider opacity-40 truncate">
              Exp. Gains
            </p>
            <p className="text-xs sm:text-sm md:text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              +{formatCurrency(expected.expectedGains, settings.currency)}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider opacity-40 truncate">
              Exp. Expenses
            </p>
            <p className="text-xs sm:text-sm md:text-base font-black tracking-tight text-red-600 dark:text-red-400 truncate">
              -{formatCurrency(expected.expectedExpenses, settings.currency)}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider opacity-40 truncate">
              Exp. Delta
            </p>
            <p className={cn(
              "text-xs sm:text-sm md:text-base font-black tracking-tight truncate",
              expected.expectedDelta > 0 
                ? "text-emerald-600 dark:text-emerald-400" 
                : expected.expectedDelta < 0 
                  ? "text-red-600 dark:text-red-400" 
                  : "opacity-60"
            )}>
              {expected.expectedDelta > 0 ? '+' : ''}{formatCurrency(expected.expectedDelta, settings.currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <Card label="Regular Accounts">
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {regularAccounts.map(a => (
              <AccountCard 
                key={a.id} 
                account={a} 
                onClick={() => setSelectedDetailAccount(a)} 
                onEdit={() => setEditingAccount(a)}
                onDelete={() => setDeletingAccount(a)}
              />
            ))}
            {regularAccounts.length === 0 && (
              <div className="p-8 text-center opacity-30 flex flex-col items-center gap-2">
                <Landmark size={24} strokeWidth={1.5} />
                <p className="font-bold uppercase tracking-[0.2em] text-[10px]">No regular accounts</p>
              </div>
            )}
          </div>
        </Card>

        <Card label="Debts & Receivables">
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {debtAccounts.map(a => (
              <AccountCard 
                key={a.id} 
                account={a} 
                onClick={() => setSelectedDetailAccount(a)} 
                onEdit={() => setEditingAccount(a)}
                onDelete={() => setDeletingAccount(a)}
              />
            ))}
            {debtAccounts.length === 0 && (
              <div className="p-8 text-center opacity-30 flex flex-col items-center gap-2">
                <TrendingDown size={24} strokeWidth={1.5} />
                <p className="font-bold uppercase tracking-[0.2em] text-[10px]">No debt accounts</p>
              </div>
            )}
          </div>
        </Card>

        <Card 
          label="Recurring Transactions"
          actions={
            <button
              onClick={() => {
                setRecurringAddMode('subscription');
                setIsAddingRecurring(true);
              }}
              className="text-xs font-bold text-foreground/70 hover:text-foreground hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Recurring
            </button>
          }
        >
          <RecurringList 
            onAddNew={() => {
              setRecurringAddMode('subscription');
              setIsAddingRecurring(true);
            }} 
          />
        </Card>
      </div>

      <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} title="New Account">
        <AccountForm onClose={() => setIsAdding(false)} />
      </Modal>

      <Modal isOpen={!!editingAccount} onClose={() => setEditingAccount(null)} title="Edit Account">
        {editingAccount && <AccountForm onClose={() => setEditingAccount(null)} initialData={editingAccount} />}
      </Modal>

      <Modal isOpen={!!deletingAccount} onClose={() => setDeletingAccount(null)} title="Delete Account">
        {deletingAccount && (
          <AccountForm 
            onClose={() => setDeletingAccount(null)} 
            initialData={deletingAccount} 
            initialDeleteConfirm={true} 
          />
        )}
      </Modal>

      <Modal 
        isOpen={isAddingRecurring} 
        onClose={() => setIsAddingRecurring(false)} 
        title={recurringAddMode === 'transfer' ? "New Recurring Transfer" : "New Recurring Transaction"}
      >
        <TransactionForm 
          onClose={() => setIsAddingRecurring(false)} 
          allowedModes={['subscription', 'transfer']}
          defaultMode={recurringAddMode}
        />
      </Modal>

      <AccountReorderModal isOpen={isReordering} onClose={() => setIsReordering(false)} />

      {selectedDetailAccount && (
        <AccountDetailModal 
          account={selectedDetailAccount} 
          onClose={() => setSelectedDetailAccount(null)} 
        />
      )}
    </PageContainer>
  );
}
