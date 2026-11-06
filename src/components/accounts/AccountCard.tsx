import { formatDate, formatPercent } from '@3gaspo/app-ui/formats';
import React, { useMemo } from 'react';
import { Account } from '../../types';
import { useData } from '../../providers/DataProvider';
import { formatCurrency, cn } from '../../lib/utils';
import { getAccountBalance, computeAccountCashflowAlert } from '../../utils/financial';
import { Landmark, TrendingDown, TrendingUp, EyeOff, Edit3, Trash2, Users, AlertTriangle } from 'lucide-react';

interface AccountCardProps {
  account: Account;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  key?: React.Key;
}

export function AccountCard({ account, onClick, onEdit, onDelete }: AccountCardProps) {
  const { transactions, recurringTransactions, settings } = useData();
  const balance = getAccountBalance(account.id, transactions, account);
  
  const isDebt = account.type === 'debt';
  const isReceivable = balance >= 0;

  const cashflowAlert = useMemo(() => {
    if (account.archived || account.type === 'debt') return null;
    return computeAccountCashflowAlert(account, transactions, recurringTransactions);
  }, [account, transactions, recurringTransactions]);

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
        "account-row w-full transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer group",
        account.archived && "opacity-40",
        account.hidden && "opacity-60 bg-black/[0.02] dark:bg-white/[0.02]"
      )}
    >
      <div className="account-main">
        <div className={cn(
          "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs",
          isDebt 
            ? (isReceivable ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")
            : "bg-ui-section text-foreground"
        )}>
          {isDebt 
            ? (isReceivable ? <TrendingUp size={20} /> : <TrendingDown size={20} />)
            : <Landmark size={20} />}
        </div>

        <div className="account-copy">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h4 title={account.name} className="font-bold text-base text-foreground leading-tight truncate">
              {account.name}
            </h4>
            {account.isShared && (
              <span className="text-[9px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0">
                <Users size={10} /> Shared
              </span>
            )}
            {cashflowAlert && (cashflowAlert.isNegativeNow || cashflowAlert.willGoNegative) && (
              <span 
                className="text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0"
                title={cashflowAlert.isNegativeNow 
                  ? 'Account is currently below 0' 
                  : `Projected to drop below 0 on ${formatDate(cashflowAlert.firstNegativeDate!, 'compact')}`}
              >
                <AlertTriangle size={10} />
                {cashflowAlert.isNegativeNow 
                  ? 'Below 0' 
                  : `Below 0 on ${formatDate(cashflowAlert.firstNegativeDate!, 'compact')}`}
              </span>
            )}
            {account.hidden && (
              <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0">
                <EyeOff size={10} /> Hidden
              </span>
            )}
            {account.archived && (
              <span className="text-[9px] font-bold bg-ui-ink/10 px-2 py-0.5 rounded-full uppercase shrink-0">
                Archived
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">
            {isDebt 
              ? 'Debt account'
              : (account.isShared 
                  ? `${formatPercent(account.defaultMyShareRatio ?? 0.5)} My Share`
                  : 'Regular Account')}
          </p>
        </div>
      </div>

      <div className="account-trailing">
        <div>
          <p className={cn(
            "text-lg sm:text-xl font-bold tracking-tight",
            isDebt && (isReceivable ? "text-emerald-500" : "text-red-500"),
            cashflowAlert?.isNegativeNow && "text-red-500"
          )}>
            {formatCurrency(balance, settings.currency)}
          </p>
          {cashflowAlert && (cashflowAlert.isNegativeNow || cashflowAlert.willGoNegative) && (
            <p className="text-[10px] font-bold text-red-500/90 flex items-center justify-end gap-1 mt-0.5">
              <span>Min: {formatCurrency(cashflowAlert.lowestBalance, settings.currency)}</span>
            </p>
          )}
        </div>

        <div className="account-actions flex items-center">
          <button
            type="button"
            onClick={handleEdit}
            className="ui-icon-button ui-row-action bg-ui-section hover:bg-black/10 dark:hover:bg-white/20 text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
            title={`Edit ${account.name}`}
            aria-label={`Edit ${account.name}`}
          >
            <Edit3 size={14} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="ui-icon-button ui-row-action bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors cursor-pointer"
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
    <div className="ui-section-card bg-ui-section p-6 rounded-[32px] flex flex-col gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-ui-surface", colorClass)}>
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
