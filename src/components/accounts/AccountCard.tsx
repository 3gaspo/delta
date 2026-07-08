import { Account } from '../../types';
import { useData } from '../../providers/DataProvider';
import { formatCurrency, cn } from '../../lib/utils';
import { getAccountBalance } from '../../utils/financial';
import { Wallet, Landmark, TrendingDown, TrendingUp } from 'lucide-react';

export function AccountCard({ account, onClick }: any) {
  const { transactions, settings } = useData();
  const balance = getAccountBalance(account.id, transactions);
  
  const isDebt = account.type === 'debt';
  const isReceivable = account.debtDirection === 'receivable';

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-6 flex flex-col gap-4 transition-all active:scale-[0.98]",
        account.archived && "opacity-40"
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center",
          isDebt 
            ? (isReceivable ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")
            : "bg-black/5 dark:bg-white/5"
        )}>
          {isDebt 
            ? (isReceivable ? <TrendingUp size={20} /> : <TrendingDown size={20} />)
            : <Landmark size={20} />}
        </div>
        {account.archived && (
          <span className="text-[10px] font-black bg-black/10 dark:bg-white/10 px-2 py-1 rounded-full uppercase">Archived</span>
        )}
      </div>

      <div>
        <h4 className="font-bold text-lg leading-tight mb-1">{account.name}</h4>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
          {isDebt ? (isReceivable ? 'Receivable' : 'Payable') : 'Regular Account'}
        </p>
      </div>

      <div className="mt-2">
        <p className={cn(
          "text-2xl font-bold tracking-tight",
          isDebt && (isReceivable ? "text-emerald-500" : "text-red-500")
        )}>
          {formatCurrency(balance, settings.currency)}
        </p>
      </div>
    </button>
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
