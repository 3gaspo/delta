import React, { useState, useEffect } from 'react';
import { useData } from '../../providers/DataProvider';
import { Account } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Base';
import { 
  GripVertical, ChevronUp, ChevronDown, Check, RotateCcw, 
  Landmark, TrendingUp, TrendingDown, EyeOff 
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { getAccountBalance } from '../../utils/financial';

interface AccountReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountReorderModal({ isOpen, onClose }: AccountReorderModalProps) {
  const { accounts, transactions, settings, reorderAccounts } = useData();
  const [regularList, setRegularList] = useState<Account[]>([]);
  const [debtList, setDebtList] = useState<Account[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'regular' | 'debt'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Initialize lists whenever modal opens or accounts change
  useEffect(() => {
    if (isOpen) {
      setRegularList(accounts.filter(a => a.type === 'regular'));
      setDebtList(accounts.filter(a => a.type === 'debt'));
    }
  }, [isOpen, accounts]);

  const moveItem = (fromIndex: number, toIndex: number, listType: 'regular' | 'debt') => {
    if (listType === 'regular') {
      setRegularList(prev => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    } else {
      setDebtList(prev => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedItemId === id) return;
    setDragOverItemId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, listType: 'regular' | 'debt') => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null);
      setDragOverItemId(null);
      return;
    }

    const currentList = listType === 'regular' ? regularList : debtList;
    const fromIndex = currentList.findIndex(a => a.id === draggedItemId);
    const toIndex = currentList.findIndex(a => a.id === targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      moveItem(fromIndex, toIndex, listType);
    }

    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const handleReset = () => {
    setRegularList(accounts.filter(a => a.type === 'regular'));
    setDebtList(accounts.filter(a => a.type === 'debt'));
  };

  const handleValidate = async () => {
    setIsSaving(true);
    try {
      const updates: { id: string; order: number }[] = [];
      
      regularList.forEach((acc, index) => {
        updates.push({ id: acc.id, order: index });
      });

      debtList.forEach((acc, index) => {
        updates.push({ id: acc.id, order: regularList.length + index });
      });

      await reorderAccounts(updates);
      onClose();
    } catch (err) {
      console.error('Failed to reorder accounts:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderAccountRow = (
    account: Account, 
    index: number, 
    totalCount: number, 
    listType: 'regular' | 'debt'
  ) => {
    const balance = getAccountBalance(account.id, transactions, account);
    const isDebt = account.type === 'debt';
    const isReceivable = account.debtDirection === 'receivable';
    const isDragging = draggedItemId === account.id;
    const isDragOver = dragOverItemId === account.id;

    return (
      <div
        key={account.id}
        draggable
        onDragStart={(e) => handleDragStart(e, account.id)}
        onDragOver={(e) => handleDragOver(e, account.id)}
        onDragLeave={() => setDragOverItemId(null)}
        onDrop={(e) => handleDrop(e, account.id, listType)}
        onDragEnd={() => {
          setDraggedItemId(null);
          setDragOverItemId(null);
        }}
        className={cn(
          "flex items-center gap-3 p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 transition-all duration-150",
          isDragging && "opacity-40 scale-95 border-dashed border-primary",
          isDragOver && "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs",
          account.hidden && "opacity-60"
        )}
      >
        {/* Drag Handle & Order Badge */}
        <div className="flex items-center gap-1.5 text-foreground/40 shrink-0 cursor-grab active:cursor-grabbing">
          <GripVertical size={16} />
          <span className="text-[11px] font-mono font-bold w-4 text-center">
            {index + 1}
          </span>
        </div>

        {/* Icon */}
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
          isDebt 
            ? (isReceivable ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")
            : "bg-white dark:bg-black/40 text-foreground shadow-xs"
        )}>
          {isDebt 
            ? (isReceivable ? <TrendingUp size={16} /> : <TrendingDown size={16} />)
            : <Landmark size={16} />}
        </div>

        {/* Name & Balance */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-sm truncate text-foreground">{account.name}</p>
            {account.hidden && (
              <span className="text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                <EyeOff size={8} /> Hidden
              </span>
            )}
          </div>
          <p className="text-xs font-semibold opacity-60">
            {formatCurrency(balance, settings.currency)}
          </p>
        </div>

        {/* Up / Down Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => moveItem(index, index - 1, listType)}
            disabled={index === 0}
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
              index === 0
                ? "opacity-20 cursor-not-allowed text-foreground/30"
                : "bg-white dark:bg-black/40 text-foreground hover:bg-black/10 dark:hover:bg-white/10 shadow-xs active:scale-95"
            )}
            title="Move up"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => moveItem(index, index + 1, listType)}
            disabled={index === totalCount - 1}
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
              index === totalCount - 1
                ? "opacity-20 cursor-not-allowed text-foreground/30"
                : "bg-white dark:bg-black/40 text-foreground hover:bg-black/10 dark:hover:bg-white/10 shadow-xs active:scale-95"
            )}
            title="Move down"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    );
  };

  const hasRegular = regularList.length > 0;
  const hasDebts = debtList.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reorder Accounts">
      <div className="flex flex-col gap-6">
        <p className="text-xs text-foreground/60 leading-relaxed -mt-2">
          Use the arrow buttons or drag and drop items to reorder your accounts. Click <strong>Validate</strong> to apply the new order.
        </p>

        {/* Section Tabs (if both types exist) */}
        {hasRegular && hasDebts && (
          <div className="flex items-center gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all",
                activeTab === 'all'
                  ? "bg-white dark:bg-black/40 text-foreground shadow-xs"
                  : "text-foreground/50 hover:text-foreground"
              )}
            >
              All ({accounts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('regular')}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all",
                activeTab === 'regular'
                  ? "bg-white dark:bg-black/40 text-foreground shadow-xs"
                  : "text-foreground/50 hover:text-foreground"
              )}
            >
              Regular ({regularList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('debt')}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all",
                activeTab === 'debt'
                  ? "bg-white dark:bg-black/40 text-foreground shadow-xs"
                  : "text-foreground/50 hover:text-foreground"
              )}
            >
              Debts ({debtList.length})
            </button>
          </div>
        )}

        {/* Account Lists */}
        <div className="space-y-5">
          {/* Regular Accounts Section */}
          {(activeTab === 'all' || activeTab === 'regular') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                  Regular Accounts ({regularList.length})
                </span>
              </div>
              <div className="space-y-2">
                {regularList.map((account, index) => 
                  renderAccountRow(account, index, regularList.length, 'regular')
                )}
                {regularList.length === 0 && (
                  <div className="p-4 text-center text-xs font-semibold text-foreground/40 bg-black/5 dark:bg-white/5 rounded-2xl">
                    No regular accounts
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Debts Section */}
          {(activeTab === 'all' || activeTab === 'debt') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                  Debts & Receivables ({debtList.length})
                </span>
              </div>
              <div className="space-y-2">
                {debtList.map((account, index) => 
                  renderAccountRow(account, index, debtList.length, 'debt')
                )}
                {debtList.length === 0 && (
                  <div className="p-4 text-center text-xs font-semibold text-foreground/40 bg-black/5 dark:bg-white/5 rounded-2xl">
                    No debt accounts
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-3 border-t border-black/5 dark:border-white/5">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-semibold"
            title="Reset to current order"
          >
            <RotateCcw size={14} /> Reset
          </Button>

          <div className="flex-1 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="text-xs font-semibold"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleValidate}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-5"
            >
              <Check size={16} />
              {isSaving ? 'Saving...' : 'Validate'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
