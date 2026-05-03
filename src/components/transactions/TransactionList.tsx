import React, { useState } from 'react';
import { Transaction } from '../../types';
import { useData } from '../../providers/DataProvider';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { Button } from '../ui/Base';
import { Trash2, Edit3, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, AlignLeft } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { TransactionForm } from './TransactionForm';

export function TransactionItem({ transaction }: any) {
  const { categories, accounts, deleteTransaction, settings } = useData();
  const [isEditing, setIsEditing] = useState(false);
  
  const category = categories.find(c => c.id === transaction.categoryId);
  const account = accounts.find(a => a.id === transaction.accountId);
  const transferAccount = transaction.transferAccountId ? accounts.find(a => a.id === transaction.transferAccountId) : null;

  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const isHidden = transaction.status === 'hidden';
  const isPending = transaction.status === 'pending';
  const isSubscription = transaction.type === 'subscription';

  const handleDelete = async () => {
    if (confirm('Delete this transaction?')) {
      await deleteTransaction(transaction.id);
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
          isSubscription ? "bg-purple-500/10 text-purple-500" :
          "bg-red-500/10 text-red-500"
        )}>
          {isIncome ? <ArrowDownLeft size={18} /> : 
           isTransfer ? <ArrowRightLeft size={18} /> : 
           isSubscription ? <ArrowUpRight size={18} /> : 
           <ArrowUpRight size={18} />}
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold truncate">
              {transaction.name || category?.label || 'Untitled'}
            </h4>
            {isPending && (
              <span className="text-[8px] font-black uppercase tracking-widest bg-amber-500 text-white px-1 rounded">Pending</span>
            )}
            {isHidden && (
              <span className="text-[8px] font-black uppercase tracking-widest bg-black text-white px-1 rounded">Hidden</span>
            )}
          </div>
          {transaction.description && (
            <p className="text-[10px] opacity-60 mb-1 truncate">{transaction.description}</p>
          )}
          <div className="flex items-center gap-1.5 opacity-40 text-[10px] font-medium uppercase tracking-wider">
            <span>{formatDate(transaction.date)}</span>
            <span>•</span>
            <span>{account?.name}</span>
            {isTransfer && (
              <>
                <ArrowRightLeft size={10} />
                <span>{transferAccount?.name}</span>
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
          isSubscription ? "text-purple-500" :
          "text-red-500"
        )}>
          {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(transaction.amount, settings.currency)}
        </p>
        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setIsEditing(true)} className="p-1 hover:text-blue-500 transition-colors">
            <Edit3 size={14} />
          </button>
          <button onClick={handleDelete} className="p-1 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Transaction">
        <TransactionForm onClose={() => setIsEditing(false)} initialData={transaction} />
      </Modal>
    </div>
  );
}

interface TransactionListProps {
  transactions: Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  const sorted = [...transactions].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);

  if (sorted.length === 0) {
    return (
      <div className="p-12 text-center opacity-20 flex flex-col items-center gap-4">
        <AlignLeft size={48} strokeWidth={1} />
        <p className="font-bold uppercase tracking-[0.2em] text-xs">No transactions</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {sorted.map(t => (
        <TransactionItem key={t.id} transaction={t} />
      ))}
    </div>
  );
}
