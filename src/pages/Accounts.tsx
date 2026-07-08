import { useState, useMemo } from 'react';
import { useData } from '../providers/DataProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, Button } from '../components/ui/Base';
import { AccountCard, TotalCard } from '../components/accounts/AccountCard';
import { Modal } from '../components/ui/Modal';
import { AccountForm } from '../components/accounts/AccountForm';
import { Plus, Wallet, ShieldAlert, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { computeFinancialTotals } from '../utils/financial';
import { Account } from '../types';

import { formatCurrency } from '../lib/utils';

export default function Accounts() {
  const { accounts, transactions, settings, loading } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const totals = useMemo(() => computeFinancialTotals(accounts, transactions), [accounts, transactions]);

  const regularAccounts = accounts.filter(a => a.type === 'regular');
  const debtAccounts = accounts.filter(a => a.type === 'debt');

  if (loading) return null;

  return (
    <PageContainer 
      title="Accounts"
      actions={
        <Button size="icon" onClick={() => setIsAdding(true)}>
          <Plus size={20} />
        </Button>
      }
    >
      <div className="mb-8 p-8 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-[40px] flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Net Worth</p>
        <p className="text-4xl font-black tracking-tighter">
          {formatCurrency(totals.netWorth, settings.currency)}
        </p>
      </div>

      <Card label="Regular Accounts">
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {regularAccounts.map(a => (
            <AccountCard key={a.id} account={a} onClick={() => setEditingAccount(a)} />
          ))}
          {regularAccounts.length === 0 && (
            <div className="p-8 text-center opacity-30 text-xs font-bold uppercase tracking-widest">No accounts</div>
          )}
        </div>
      </Card>

      <Card label="Debts & Receivables">
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {debtAccounts.map(a => (
            <AccountCard key={a.id} account={a} onClick={() => setEditingAccount(a)} />
          ))}
          {debtAccounts.length === 0 && (
            <div className="p-8 text-center opacity-30 text-xs font-bold uppercase tracking-widest">No debts</div>
          )}
        </div>
      </Card>

      <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} title="New Account">
        <AccountForm onClose={() => setIsAdding(false)} />
      </Modal>

      <Modal isOpen={!!editingAccount} onClose={() => setEditingAccount(null)} title="Edit Account">
        {editingAccount && <AccountForm onClose={() => setEditingAccount(null)} initialData={editingAccount} />}
      </Modal>
    </PageContainer>
  );
}
