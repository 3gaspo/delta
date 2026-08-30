import React, { useState, useMemo } from 'react';
import { RecurringTransaction } from '../../types';
import { useData } from '../../providers/DataProvider';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { 
  Repeat, Calendar, CreditCard, Layers, Edit3, Trash2, 
  ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Plus, Play, Pause, AlertCircle 
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { TransactionForm } from './TransactionForm';
import { Button } from '../ui/Base';
import { calculateNextDueDate, sortRecurringByNextDate } from '../../utils/recurring';

export function RecurringList({ 
  onAddNew,
  recurringTransactions: customRecurringTransactions 
}: { 
  onAddNew?: () => void;
  recurringTransactions?: RecurringTransaction[];
}) {
  const { recurringTransactions: storeRecurringTransactions, categories, accounts, deleteRecurringTransaction, updateRecurringTransaction, settings } = useData();
  const recurringTransactions = customRecurringTransactions ?? storeRecurringTransactions;
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
  const [deletingItem, setDeletingItem] = useState<RecurringTransaction | null>(null);

  const sortedRecurringTransactions = useMemo(() => {
    return sortRecurringByNextDate(recurringTransactions);
  }, [recurringTransactions]);

  const getPeriodLabel = (days: number) => {
    switch (days) {
      case 7: return 'Every 7 days (Weekly)';
      case 14: return 'Every 14 days (Bi-weekly)';
      case 30: return 'Every 30 days (Monthly)';
      case 90: return 'Every 90 days (Quarterly)';
      case 365: return 'Every 365 days (Yearly)';
      default: return `Every ${days} days`;
    }
  };

  const handleToggleActive = async (item: RecurringTransaction) => {
    await updateRecurringTransaction(item.id, {
      active: item.active === false ? true : false
    });
  };

  const confirmDelete = async (deleteHistory: boolean) => {
    if (!deletingItem) return;
    await deleteRecurringTransaction(deletingItem.id, deleteHistory);
    setDeletingItem(null);
  };

  if (recurringTransactions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-3 text-foreground/40">
          <Repeat size={24} />
        </div>
        <p className="text-sm font-semibold opacity-60 mb-4">No recurring transactions yet</p>
        {onAddNew && (
          <Button variant="outline" size="sm" onClick={onAddNew} className="inline-flex items-center gap-1.5 text-xs">
            <Plus size={14} /> Add Recurring Transaction
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-black/5 dark:divide-white/5">
      {sortedRecurringTransactions.map(rule => {
        const category = categories.find(c => c.id === rule.categoryId);
        const account = accounts.find(a => a.id === rule.accountId);
        const transferAccount = rule.transferAccountId ? accounts.find(a => a.id === rule.transferAccountId) : null;
        
        const isIncome = rule.type === 'income';
        const isTransfer = rule.type === 'transfer';
        const isActive = rule.active !== false;

        const nextDueDate = calculateNextDueDate(rule);

        return (
          <div 
            key={rule.id} 
            className={cn(
              "p-4 flex items-center justify-between gap-4 group transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
              !isActive && "opacity-40 grayscale"
            )}
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                isIncome ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                isTransfer ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                "bg-red-500/10 text-red-600 dark:text-red-400"
              )}>
                {isIncome ? <ArrowDownLeft size={18} /> : 
                 isTransfer ? <ArrowRightLeft size={18} /> : 
                 <ArrowUpRight size={18} />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <h4 className="font-bold text-sm text-foreground break-words">
                    {rule.name}
                  </h4>
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0",
                    isIncome ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                    isTransfer ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                    "bg-red-500/10 text-red-600 dark:text-red-400"
                  )}>
                    <Repeat size={10} /> {getPeriodLabel(rule.periodicityDays)}
                  </span>
                  {!isActive && (
                    <span className="text-[8px] font-black uppercase tracking-widest bg-black/60 dark:bg-white/40 text-white dark:text-black px-1.5 py-0.5 rounded shrink-0">
                      Paused
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 opacity-50 text-[11px] font-medium mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} /> Start: {formatDate(rule.startDate)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    Next due: <span className="font-semibold text-foreground">{formatDate(nextDueDate)}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <CreditCard size={11} /> {account?.name || 'No Account'}
                    {isTransfer && transferAccount && (
                      <>
                        <ArrowRightLeft size={10} />
                        <span>{transferAccount.name}</span>
                      </>
                    )}
                  </span>
                  {category && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: category.color || '#888' }} />
                        {category.label}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 flex items-center gap-3">
              <div>
                <p className={cn(
                  "font-bold text-lg",
                  isIncome ? "text-emerald-600 dark:text-emerald-400" :
                  isTransfer ? "text-blue-600 dark:text-blue-400" :
                  "text-red-600 dark:text-red-400"
                )}>
                  {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(rule.amount, settings.currency)}
                </p>
                <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleToggleActive(rule)} 
                    className="p-1 hover:text-amber-500 transition-colors" 
                    title={isActive ? "Pause recurring rule" : "Resume recurring rule"}
                  >
                    {isActive ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button 
                    onClick={() => setEditingItem(rule)} 
                    className="p-1 hover:text-blue-500 transition-colors" 
                    title="Edit Recurring Rule"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button 
                    onClick={() => setDeletingItem(rule)} 
                    className="p-1 hover:text-red-500 transition-colors" 
                    title="Delete Recurring Rule"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Edit Modal */}
      {editingItem && (
        <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Recurring Transaction">
          <TransactionForm 
            onClose={() => setEditingItem(null)} 
            initialRecurringData={editingItem} 
            defaultMode={editingItem.type === 'transfer' ? 'transfer' : 'subscription'} 
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <Modal isOpen={!!deletingItem} onClose={() => setDeletingItem(null)} title="Delete Recurring Transaction">
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Delete "{deletingItem.name}"?
                </h3>
                <p className="text-xs text-red-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-foreground/70 leading-relaxed">
              Would you like to keep past generated transactions in your transaction history, or remove all history associated with this recurring rule?
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <Button 
                variant="secondary" 
                onClick={() => confirmDelete(false)}
                className="w-full text-xs font-semibold py-3"
              >
                Delete Rule Only (Keep Past Transactions)
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => confirmDelete(true)}
                className="w-full text-xs font-bold py-3"
              >
                Delete Rule & All Generated Transactions
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setDeletingItem(null)}
                className="w-full text-xs font-medium py-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
