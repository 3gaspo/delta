import React, { useState } from 'react';
import { Transaction } from '../../types';
import { useData } from '../../providers/DataProvider';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { Button } from '../ui/Base';
import { 
  Trash2, Edit3, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, 
  AlignLeft, Repeat, Layers3, ChevronDown, ChevronUp, Layers 
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { TransactionForm } from './TransactionForm';

export function TransactionItem({ transaction }: { transaction: Transaction; key?: React.Key }) {
  const { categories, accounts, deleteTransaction, settings } = useData();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState(false);
  
  const category = categories.find(c => c.id === transaction.categoryId);
  const account = accounts.find(a => a.id === transaction.accountId);
  const transferAccount = transaction.transferAccountId ? accounts.find(a => a.id === transaction.transferAccountId) : null;

  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const isHidden = transaction.status === 'hidden';
  const isPending = transaction.status === 'pending';
  const isSubscription = transaction.type === 'subscription';
  const isRecurring = transaction.periodicityDays && transaction.periodicityDays > 0;

  const handleDelete = async () => {
    try {
      setDeletingLoading(true);
      await deleteTransaction(transaction.id);
      setIsDeleting(false);
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div className={cn(
      "p-4 border-b border-black/5 dark:border-white/5 last:border-0 flex items-center justify-between gap-4 group transition-opacity",
      isHidden && "opacity-30 grayscale",
      isPending && "bg-amber-500/5"
    )}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={cn(
          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
          isIncome ? "bg-emerald-500/10 text-emerald-500" : 
          isTransfer ? "bg-blue-500/10 text-blue-500" :
          "bg-red-500/10 text-red-500"
        )}>
          {isIncome ? <ArrowDownLeft size={18} /> : 
           isTransfer ? <ArrowRightLeft size={18} /> : 
           <ArrowUpRight size={18} />}
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h4 className="font-bold text-sm text-foreground break-words">
              {transaction.name || category?.label || 'Untitled'}
            </h4>
            {isRecurring && (
              <span className={cn(
                "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0",
                isIncome ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                isTransfer ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                "bg-red-500/10 text-red-600 dark:text-red-400"
              )}>
                <Repeat size={10} /> {transaction.periodicityDays}d
              </span>
            )}
            {isPending && (
              <span className="text-[8px] font-black uppercase tracking-widest bg-amber-500 text-white px-1 rounded shrink-0">Pending</span>
            )}
            {isHidden && (
              <span className="text-[8px] font-black uppercase tracking-widest bg-black text-white px-1 rounded shrink-0">Hidden</span>
            )}
          </div>
          {transaction.description && (
            <p className="text-[10px] opacity-60 mb-1 truncate">{transaction.description}</p>
          )}
          <div className="flex items-center gap-1.5 opacity-40 text-[10px] font-medium uppercase tracking-wider flex-wrap">
            <span>{formatDate(transaction.date)}</span>
            <span>•</span>
            <span>{account?.name}</span>
            {isTransfer && (
              <>
                <ArrowRightLeft size={10} />
                <span>{transferAccount?.name}</span>
              </>
            )}
            {category && !isTransfer && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <span 
                    className="w-1.5 h-1.5 rounded-full inline-block shrink-0" 
                    style={{ backgroundColor: category.color || '#888' }} 
                  />
                  <span>{category.label}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className={cn(
          "font-bold text-lg",
          isIncome ? "text-emerald-500" : 
          isTransfer ? "text-blue-500" : 
          "text-red-500"
        )}>
          {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(transaction.amount, settings.currency)}
        </p>
        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setIsEditing(true)} className="p-1 hover:text-blue-500 transition-colors" title="Edit">
            <Edit3 size={14} />
          </button>
          <button onClick={() => setIsDeleting(true)} className="p-1 hover:text-red-500 transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Transaction">
        <TransactionForm onClose={() => setIsEditing(false)} initialData={transaction} />
      </Modal>

      <Modal isOpen={isDeleting} onClose={() => setIsDeleting(false)} title="Delete Transaction">
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 text-red-500">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                Delete "{transaction.name || category?.label || 'Transaction'}"?
              </h3>
              <p className="text-xs text-red-500 font-medium">This action cannot be undone.</p>
            </div>
          </div>
          <p className="text-xs text-foreground/70">
            Are you sure you want to delete this transaction for <strong>{formatCurrency(transaction.amount, settings.currency)}</strong>?
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingLoading}
              className="w-full text-xs font-bold py-3"
            >
              {deletingLoading ? 'Deleting...' : 'Delete Transaction'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeleting(false)}
              disabled={deletingLoading}
              className="w-full text-xs font-medium py-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function GroupTransactionItem({ 
  groupId, 
  subtransactions 
}: { 
  groupId: string; 
  subtransactions: Transaction[];
  key?: React.Key;
}) {
  const { categories, accounts, deleteGroupTransaction, settings } = useData();
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const sharedName = subtransactions[0]?.name || 'Group Transaction';
  const sharedDate = subtransactions[0]?.date || Date.now();

  const totalAmount = subtransactions.reduce((sum, st) => {
    if (st.type === 'income') return sum - st.amount;
    return sum + st.amount;
  }, 0);

  const uniqueCategoryLabels = Array.from(new Set(
    subtransactions
      .map(st => categories.find(c => c.id === st.categoryId)?.label)
      .filter(Boolean)
  ));

  const uniqueAccountNames = Array.from(new Set(
    subtransactions
      .map(st => accounts.find(a => a.id === st.accountId)?.name)
      .filter(Boolean)
  ));

  const handleDelete = async () => {
    try {
      setDeletingLoading(true);
      await deleteGroupTransaction(groupId);
      setIsDeleting(false);
    } catch (err) {
      console.error('Failed to delete group transaction:', err);
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div className="border-b border-black/5 dark:border-white/5 last:border-0">
      <div className="p-4 flex items-center justify-between gap-4 group transition-colors hover:bg-purple-500/5">
        <div className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers3 size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold truncate">{sharedName}</h4>
              <span className="text-[8px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                <Layers size={10} /> {subtransactions.length} items
              </span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60 text-[10px] font-medium uppercase tracking-wider mt-0.5">
              <span>{formatDate(sharedDate)}</span>
              <span>•</span>
              <span className="truncate">{uniqueCategoryLabels.join(', ') || 'Group Categories'}</span>
              <span>•</span>
              <span className="truncate">{uniqueAccountNames.join(', ') || 'Accounts'}</span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0 flex items-center gap-3">
          <div>
            <p className="font-bold text-lg text-purple-600 dark:text-purple-400">
              {totalAmount < 0 ? '+' : '-'}{formatCurrency(Math.abs(totalAmount), settings.currency)}
            </p>
            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setExpanded(!expanded)} className="p-1 hover:text-purple-500 transition-colors" title={expanded ? "Collapse" : "Expand"}>
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button onClick={() => setIsEditing(true)} className="p-1 hover:text-blue-500 transition-colors" title="Edit Group">
                <Edit3 size={14} />
              </button>
              <button onClick={() => setIsDeleting(true)} className="p-1 hover:text-red-500 transition-colors" title="Delete Group">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Sub-transactions Breakdown */}
      {expanded && (
        <div className="bg-black/5 dark:bg-white/5 px-6 py-3 space-y-2 border-t border-black/5 dark:border-white/5">
          <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Sub-Transactions Details</p>
          {subtransactions.map((st, idx) => {
            const cat = categories.find(c => c.id === st.categoryId);
            const acc = accounts.find(a => a.id === st.accountId);
            const isInc = st.type === 'income';

            return (
              <div key={st.id || idx} className="flex items-center justify-between text-xs py-1.5 border-b border-black/5 dark:border-white/5 last:border-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span 
                    className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm" 
                    style={{ backgroundColor: cat?.color || '#a855f7' }}
                  />
                  <span className="font-semibold truncate">
                    {cat?.label || 'Uncategorized'}
                  </span>
                  {st.description && (
                    <span className="opacity-50 text-[10px] truncate">— {st.description}</span>
                  )}
                  <span className="text-[9px] opacity-40 px-1.5 py-0.5 bg-black/5 dark:bg-white/5 rounded">
                    {acc?.name}
                  </span>
                </div>
                <span className={cn("font-bold shrink-0 ml-2", isInc ? "text-emerald-500" : "text-red-500")}>
                  {isInc ? '+' : '-'}{formatCurrency(st.amount, settings.currency)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Group Transaction">
        <TransactionForm onClose={() => setIsEditing(false)} initialData={subtransactions[0]} />
      </Modal>

      <Modal isOpen={isDeleting} onClose={() => setIsDeleting(false)} title="Delete Group Transaction">
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 text-red-500">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                Delete "{sharedName}"?
              </h3>
              <p className="text-xs text-red-500 font-medium">This action cannot be undone.</p>
            </div>
          </div>
          <p className="text-xs text-foreground/70">
            Are you sure you want to delete this group transaction and all <strong>{subtransactions.length} sub-transactions</strong>?
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingLoading}
              className="w-full text-xs font-bold py-3"
            >
              {deletingLoading ? 'Deleting...' : 'Delete Group & All Sub-Transactions'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeleting(false)}
              disabled={deletingLoading}
              className="w-full text-xs font-medium py-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface TransactionListProps {
  transactions: Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  // Combine single and grouped transactions
  type HistoryItem = 
    | { type: 'single'; transaction: Transaction; sortDate: number; sortCreatedAt: number }
    | { type: 'group'; groupId: string; subtransactions: Transaction[]; sortDate: number; sortCreatedAt: number };

  const groupedMap = new Map<string, Transaction[]>();
  const singles: Transaction[] = [];

  transactions.forEach(t => {
    if (t.groupId) {
      if (!groupedMap.has(t.groupId)) {
        groupedMap.set(t.groupId, []);
      }
      groupedMap.get(t.groupId)!.push(t);
    } else {
      singles.push(t);
    }
  });

  const historyItems: HistoryItem[] = [];

  singles.forEach(t => {
    historyItems.push({
      type: 'single',
      transaction: t,
      sortDate: t.date,
      sortCreatedAt: t.createdAt
    });
  });

  groupedMap.forEach((subtransactions, groupId) => {
    const sortDate = subtransactions[0]?.date || Date.now();
    const sortCreatedAt = Math.max(...subtransactions.map(s => s.createdAt || 0));
    historyItems.push({
      type: 'group',
      groupId,
      subtransactions,
      sortDate,
      sortCreatedAt
    });
  });

  historyItems.sort((a, b) => b.sortDate - a.sortDate || b.sortCreatedAt - a.sortCreatedAt);

  if (historyItems.length === 0) {
    return (
      <div className="p-12 text-center opacity-20 flex flex-col items-center gap-4">
        <AlignLeft size={48} strokeWidth={1} />
        <p className="font-bold uppercase tracking-[0.2em] text-xs">No transactions</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {historyItems.map(item => {
        if (item.type === 'single') {
          return <TransactionItem key={item.transaction.id} transaction={item.transaction} />;
        }
        return (
          <GroupTransactionItem 
            key={item.groupId} 
            groupId={item.groupId} 
            subtransactions={item.subtransactions} 
          />
        );
      })}
    </div>
  );
}
