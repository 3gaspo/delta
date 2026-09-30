import React from 'react';
import { Account } from '../../types';
import { useData } from '../../providers/DataProvider';
import { formatCurrency, cn } from '../../lib/utils';
import { getAccountBalance } from '../../utils/financial';
import { Landmark, TrendingDown, TrendingUp, EyeOff, Edit3, Trash2 } from 'lucide-react';

interface AccountCardProps {
  account: Account;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  key?: React.Key;
}

export function AccountCard({ account, onClick, onEdit, onDelete }: AccountCardProps) {
  const { transactions, settings } = useData();
  const balance = getAccountBalance(account.id, transactions, account);
  
  const isDebt = account.type === 'debt';
  const isReceivable = account.debtDirection === 'receivable';

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit();
    else if (onClick) onClick();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete();
    else if (onClick) onClick();
  };

  return (
    <div
      onClick={onClick || onEdit}
      className={cn(
        "w-full p-4 sm:p-5 flex items-center justify-between gap-4 transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer group",
        account.archived && "opacity-40",
        account.hidden && "opacity-60 bg-black/[0.02] dark:bg-white/[0.02]"
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className={cn(
          "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs",
          isDebt 
            ? (isReceivable ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")
            : "bg-black/5 dark:bg-white/10 text-foreground"
        )}>
          {isDebt 
            ? (isReceivable ? <TrendingUp size={20} /> : <TrendingDown size={20} />)
            : <Landmark size={20} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h4 className="font-bold text-base text-foreground leading-tight truncate">
              {account.name}
            </h4>
            {account.hidden && (
              <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0">
                <EyeOff size={10} /> Hidden
              </span>
            )}
            {account.archived && (
              <span className="text-[9px] font-bold bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full uppercase shrink-0">
                Archived
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">
            {isDebt ? (isReceivable ? 'Receivable' : 'Payable') : 'Regular Account'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-right">
        <div>
          <p className={cn(
            "text-lg sm:text-xl font-bold tracking-tight",
            isDebt && (isReceivable ? "text-emerald-500" : "text-red-500")
          )}>
            {formatCurrency(balance, settings.currency)}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleEdit}
            className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-foreground/70 hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={`Edit ${account.name}`}
            aria-label={`Edit ${account.name}`}
          >
            <Edit3 size={14} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors cursor-pointer"
            title={`Delete ${account.name}`}
            aria-label={`Delete ${account.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function TotalCard({ label, amount, currency, icon: Icon, colorClass }: { label: string, amount: number, currency: string, icon: any, colorClass?: string }) {
  return (
    <div className="bg-black/5 dark:bg-white/5 p-6 rounded-[32px] flex flex-col gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-black/20", colorClass)}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">{label}</p>
        <p className={cn("text-2xl font-bold tracking-tighter", colorClass)}>
          {formatCurrency(amount, currency)}
        </p>
      </div>
    </div>
  );
}
