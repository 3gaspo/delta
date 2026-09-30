import React, { useState, useMemo } from 'react';
import { RecurringTransaction } from '../../types';
import { useData } from '../../providers/DataProvider';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { 
  Repeat, Calendar, CreditCard, Edit3, Trash2, 
  ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Plus, Play, Pause
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

  const getPeriodBadge = (days: number) => {
    switch (days) {
      case 7: return 'Weekly';
      case 14: return 'Bi-weekly';
      case 30: return 'Monthly';
      case 90: return 'Quarterly';
      case 365: return 'Yearly';
      default: return `Every ${days}d`;
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
              "p-4 sm:p-5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015] flex flex-col gap-3",
              !isActive && "opacity-50"
            )}
          >
            {/* Top Row: Icon + Title & Frequency | Amount & Actions */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs",
                  isIncome ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                  isTransfer ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                  "bg-red-500/10 text-red-600 dark:text-red-400"
                )}>
                  {isIncome ? <ArrowDownLeft size={18} /> : 
                   isTransfer ? <ArrowRightLeft size={18} /> : 
                   <ArrowUpRight size={18} />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug break-words">
                      {rule.name}
                    </h4>
                    {!isActive && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full shrink-0">
                        Paused
                      </span>
                    )}
                  </div>

                  {/* Clean Frequency Badge */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1",
                      isIncome ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                      isTransfer ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                      "bg-red-500/10 text-red-600 dark:text-red-400"
                    )}>
                      <Repeat size={10} />
                      {getPeriodBadge(rule.periodicityDays)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Top-Right: Amount & Quick Actions */}
              <div className="flex flex-col items-end shrink-0 text-right">
                <span className={cn(
                  "font-bold text-base sm:text-lg tracking-tight whitespace-nowrap",
                  isIncome ? "text-emerald-600 dark:text-emerald-400" :
                  isTransfer ? "text-blue-600 dark:text-blue-400" :
                  "text-red-600 dark:text-red-400"
                )}>
                  {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(rule.amount, settings.currency)}
                </span>

                <div className="flex items-center gap-1 mt-1.5">
                  <button 
                    type="button"
                    onClick={() => handleToggleActive(rule)} 
                    className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-foreground/60 hover:text-foreground flex items-center justify-center transition-colors cursor-pointer" 
                    title={isActive ? "Pause rule" : "Resume rule"}
                    aria-label={isActive ? "Pause rule" : "Resume rule"}
                  >
                    {isActive ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditingItem(rule)} 
                    className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-foreground/60 hover:text-foreground flex items-center justify-center transition-colors cursor-pointer" 
                    title="Edit rule"
                    aria-label="Edit rule"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setDeletingItem(rule)} 
                    className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors cursor-pointer" 
                    title="Delete rule"
                    aria-label="Delete rule"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Row: Consistently Aligned Properties Shelf */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-black/[0.02] dark:bg-white/[0.02] p-2.5 rounded-xl border border-black/5 dark:border-white/5">
              {/* Schedule Column */}
              <div className="flex items-center gap-2 text-[11px] text-foreground/70 min-w-0">
                <Calendar size={13} className="opacity-40 shrink-0" />
                <div className="flex items-center gap-1.5 truncate">
                  <span className="opacity-40 text-[9px] font-bold uppercase tracking-wider">Start:</span>
                  <span className="font-medium">{formatDate(rule.startDate)}</span>
                  <span className="opacity-30 mx-0.5">|</span>
                  <span className="opacity-40 text-[9px] font-bold uppercase tracking-wider">Next:</span>
                  <strong className="font-bold text-foreground">{formatDate(nextDueDate)}</strong>
                </div>
              </div>

              {/* Account / Category Column */}
              <div className="flex items-center gap-2 text-[11px] text-foreground/70 min-w-0">
                {isTransfer ? (
                  <div className="flex items-center gap-1.5 truncate">
                    <CreditCard size={13} className="opacity-40 shrink-0" />
                    <span className="truncate font-medium">{account?.name || 'Account'}</span>
                    <ArrowRightLeft size={10} className="opacity-40 shrink-0" />
                    <span className="truncate font-medium">{transferAccount?.name || 'Account'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 truncate">
                    <div className="flex items-center gap-1.5 truncate">
                      <CreditCard size={13} className="opacity-40 shrink-0" />
                      <span className="truncate font-medium">{account?.name || 'Account'}</span>
                    </div>
                    {category && (
                      <div className="flex items-center gap-1 truncate shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: category.color || '#888' }} />
                        <span className="truncate text-foreground/80 font-medium">{category.label}</span>
                      </div>
                    )}
                  </div>
                )}
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
          <div className="space-y-4 py-1">
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

            <p className="text-xs text-foreground/70">
              Choose whether to keep or remove previously generated transactions:
            </p>

            <div className="flex flex-col gap-2 pt-2">
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
