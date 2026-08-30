import React, { useState, useMemo } from 'react';
import { useData } from '../../providers/DataProvider';
import { Account, AccountType, DebtDirection } from '../../types';
import { Button, Input, Select } from '../ui/Base';
import { Landmark, Archive, Wallet, EyeOff, AlertCircle, Trash2, Calculator } from 'lucide-react';
import { isInitialBalanceTx } from '../../utils/financial';
import { parseMoney, formatCurrency } from '../../lib/utils';

interface AccountFormProps {
  onClose: () => void;
  initialData?: Account;
}

export function AccountForm({ onClose, initialData }: AccountFormProps) {
  const { addAccount, updateAccount, deleteAccount, transactions, recurringTransactions, settings } = useData();

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || ('regular' as AccountType),
    debtDirection: initialData?.debtDirection || ('payable' as DebtDirection),
    archived: initialData?.archived || false,
    hidden: initialData?.hidden || false,
    initialBalance: initialData?.initialBalance !== undefined ? initialData.initialBalance.toString() : '0'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const txSum = useMemo(() => {
    if (!initialData) return 0;
    return transactions
      .filter(t => t.status !== 'hidden' && (t.accountId === initialData.id || t.transferAccountId === initialData.id))
      .filter(t => !isInitialBalanceTx(t))
      .reduce((acc, t) => {
        if (t.type === 'income') {
          return t.accountId === initialData.id ? acc + t.amount : acc;
        } else if (t.type === 'expense') {
          return t.accountId === initialData.id ? acc - t.amount : acc;
        } else if (t.type === 'transfer') {
          if (t.accountId === initialData.id) return acc - t.amount;
          if (t.transferAccountId === initialData.id) return acc + t.amount;
        }
        return acc;
      }, 0);
  }, [initialData, transactions]);

  const parsedInitial = parseMoney(formData.initialBalance) || 0;
  const currentComputedBalance = parsedInitial + txSum;

  const associatedTxCount = initialData 
    ? transactions.filter(t => t.accountId === initialData.id || t.transferAccountId === initialData.id).length 
    : 0;
  const associatedRecCount = initialData
    ? recurringTransactions.filter(r => r.accountId === initialData.id || r.transferAccountId === initialData.id).length
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.name.trim()) throw new Error('Account name is required');

      const initialBalanceNum = parseMoney(formData.initialBalance) || 0;

      const submission: Partial<Account> = {
        name: formData.name.trim(),
        type: formData.type,
        archived: formData.archived,
        hidden: formData.hidden,
        initialBalance: initialBalanceNum
      };

      if (formData.type === 'debt') {
        submission.debtDirection = formData.debtDirection;
      }

      if (initialData) {
        await updateAccount(initialData.id, submission);
      } else {
        await addAccount(submission);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!initialData) return;
    try {
      setLoading(true);
      setError(null);
      await deleteAccount(initialData.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  const handleArchiveInstead = async () => {
    if (!initialData) return;
    try {
      setLoading(true);
      setError(null);
      await updateAccount(initialData.id, { archived: true });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to archive account');
      setLoading(false);
    }
  };

  if (isConfirmingDelete && initialData) {
    return (
      <div className="space-y-5 py-2">
        <div className="flex items-center gap-3 text-red-500">
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Delete "{initialData.name}"?</h3>
            <p className="text-xs text-red-500 font-medium">This action cannot be undone.</p>
          </div>
        </div>

        {error && <p className="text-red-500 text-xs font-semibold p-3 bg-red-500/10 rounded-xl">{error}</p>}

        <p className="text-xs text-foreground/70 leading-relaxed">
          {associatedTxCount > 0 || associatedRecCount > 0 ? (
            <>
              This account has <strong className="text-foreground">{associatedTxCount} transaction{associatedTxCount !== 1 ? 's' : ''}</strong>
              {associatedRecCount > 0 && <> and <strong className="text-foreground">{associatedRecCount} recurring rule{associatedRecCount !== 1 ? 's' : ''}</strong></>}. 
              Deleting this account will permanently remove it along with all its associated transactions.
            </>
          ) : (
            'Are you sure you want to delete this account? It will be removed permanently.'
          )}
        </p>

        <div className="flex flex-col gap-2.5 pt-2">
          <Button
            type="button"
            variant="destructive"
            onClick={executeDelete}
            disabled={loading}
            className="w-full text-xs font-bold py-3"
          >
            {loading ? 'Deleting...' : (associatedTxCount > 0 ? 'Delete Account & All Transactions' : 'Confirm Delete')}
          </Button>

          {(associatedTxCount > 0 || associatedRecCount > 0) && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleArchiveInstead}
              disabled={loading}
              className="w-full text-xs font-semibold py-3"
            >
              Archive Account Instead (Keep History)
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsConfirmingDelete(false)}
            disabled={loading}
            className="w-full text-xs font-medium py-2"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Account Name</span>
            <Input 
              placeholder="e.g. Bank Account" 
              icon={Landmark}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
              className="text-lg font-bold"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Initial Amount</span>
            <Input 
              placeholder="0.00" 
              icon={Wallet}
              value={formData.initialBalance}
              onChange={e => setFormData({ ...formData, initialBalance: e.target.value })}
              required
              className="text-lg font-bold"
            />
          </label>
        </div>

        {initialData && (
          <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-between border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2 text-foreground/70">
              <Calculator size={16} />
              <span className="text-xs font-medium">Recomputed Current Value</span>
            </div>
            <span className="text-sm font-bold text-foreground">
              {formatCurrency(currentComputedBalance, settings.currency)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Type</span>
            <Select 
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as AccountType })}
            >
              <option value="regular">Regular</option>
              <option value="debt">Debt Account</option>
            </Select>
          </label>
          {formData.type === 'debt' && (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Direction</span>
              <Select 
                value={formData.debtDirection}
                onChange={e => setFormData({ ...formData, debtDirection: e.target.value as DebtDirection })}
              >
                <option value="payable">I owe this (Payable)</option>
                <option value="receivable">I am owed (Receivable)</option>
              </Select>
            </label>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-2xl cursor-pointer">
            <input 
              type="checkbox" 
              checked={formData.hidden}
              onChange={e => setFormData({ ...formData, hidden: e.target.checked })}
              className="w-5 h-5 rounded-lg border-none bg-black/10 text-black focus:ring-0"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <EyeOff size={16} />
                <span className="text-sm font-bold uppercase tracking-wider">Hide Account</span>
              </div>
              <span className="text-[10px] opacity-40">Excluded from net worth and aggregate metrics</span>
            </div>
          </label>

          {initialData && (
            <label className="flex items-center gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-2xl cursor-pointer">
              <input 
              type="checkbox" 
              checked={formData.archived}
              onChange={e => setFormData({ ...formData, archived: e.target.checked })}
              className="w-5 h-5 rounded-lg border-none bg-black/10 text-black focus:ring-0"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Archive size={16} />
                <span className="text-sm font-bold uppercase tracking-wider">Archived Account</span>
              </div>
            </div>
          </label>
        )}
      </div>
    </div>

    <div className="space-y-3">
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving...' : initialData ? 'Update Account' : 'Create Account'}
      </Button>
      {initialData && (
        <Button 
          type="button" 
          variant="destructive" 
          onClick={() => setIsConfirmingDelete(true)} 
          disabled={loading} 
          className="w-full"
        >
          Delete Account
        </Button>
      )}
    </div>
  </form>
  );
}
