import { useState, useMemo } from 'react';
import { useData } from '../providers/DataProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, Button } from '../components/ui/Base';
import { AccountCard } from '../components/accounts/AccountCard';
import { RecurringList } from '../components/transactions/RecurringList';
import { Modal } from '../components/ui/Modal';
import { AccountForm } from '../components/accounts/AccountForm';
import { AccountReorderModal } from '../components/accounts/AccountReorderModal';
import { TransactionForm, FormTabMode } from '../components/transactions/TransactionForm';
import { Plus, ArrowUpDown, Repeat, Landmark, TrendingDown } from 'lucide-react';
import { computeFinancialTotals, computeExpectedMonthlyFinancials } from '../utils/financial';
import { Account } from '../types';
import { formatCurrency, cn } from '../lib/utils';

export default function Accounts() {
  const { accounts, transactions, recurringTransactions, categories, settings, loading } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [isAddingRecurring, setIsAddingRecurring] = useState(false);
  const [recurringAddMode, setRecurringAddMode] = useState<FormTabMode>('subscription');

  const totals = useMemo(() => computeFinancialTotals(accounts, transactions), [accounts, transactions]);
  const expected = useMemo(
    () => computeExpectedMonthlyFinancials(recurringTransactions, categories),
    [recurringTransactions, categories]
  );

  const regularAccounts = accounts.filter(a => a.type === 'regular');
  const debtAccounts = accounts.filter(a => a.type === 'debt');

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
      <div className="mb-8 p-6 sm:p-8 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-[40px] flex flex-col gap-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Net Worth</p>
          <p className="text-3xl sm:text-4xl font-black tracking-tighter mt-1">
            {formatCurrency(totals.netWorth, settings.currency)}
          </p>
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
                onClick={() => setEditingAccount(a)} 
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
                onClick={() => setEditingAccount(a)} 
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
    </PageContainer>
  );
}
