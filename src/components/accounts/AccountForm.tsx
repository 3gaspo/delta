import React, { useState, useEffect } from 'react';
import { useData } from '../../providers/DataProvider';
import { Account, AccountType, DebtDirection, Transaction } from '../../types';
import { Button, Input, Select } from '../ui/Base';
import { Landmark, AlignLeft, ShieldCheck, Archive, Wallet } from 'lucide-react';
import { getAccountBalance } from '../../utils/financial';
import { parseMoney } from '../../lib/utils';

interface AccountFormProps {
  onClose: () => void;
  initialData?: Account;
}

export function AccountForm({ onClose, initialData }: AccountFormProps) {
  const { addAccount, updateAccount, deleteAccount, transactions, addTransaction } = useData();

  const currentBalance = initialData ? getAccountBalance(initialData.id, transactions) : 0;

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'regular' as AccountType,
    debtDirection: initialData?.debtDirection || 'payable' as DebtDirection,
    archived: initialData?.archived || false,
    balance: initialData ? currentBalance.toString() : '0'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.name) throw new Error('Name is required');

      const submission: any = {
        name: formData.name,
        type: formData.type,
        archived: formData.archived
      };

      if (formData.type === 'debt') {
        submission.debtDirection = formData.debtDirection;
      }

      let accountId = initialData?.id;

      if (initialData) {
        await updateAccount(initialData.id, submission);
      } else {
        const result = await addAccount(submission);
        // @ts-ignore - assuming addAccount returns the new id
        accountId = result?.id;
      }

      // Handle balance correction
      const newBalance = parseMoney(formData.balance);
      const diff = initialData ? newBalance - currentBalance : newBalance;

      if (diff !== 0 && accountId) {
        await addTransaction({
          amount: Math.abs(diff),
          date: Date.now(),
          accountId: accountId,
          categoryId: '', // Correction category could be added or just empty
          tagIds: [],
          type: diff > 0 ? 'income' : 'expense',
          status: 'normal',
          description: initialData ? 'Balance Correction' : 'Initial Balance',
          isCorrection: true
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    if (confirm('Delete this account? This cannot be undone.')) {
      try {
        setLoading(true);
        await deleteAccount(initialData.id);
        onClose();
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }
  };

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
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">{initialData ? 'Update Balance' : 'Initial Balance'}</span>
            <Input 
              placeholder="0.00" 
              icon={Wallet}
              value={formData.balance}
              onChange={e => setFormData({ ...formData, balance: e.target.value })}
              required
              className="text-lg font-bold"
            />
          </label>
        </div>

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

        {initialData && (
          <label className="flex items-center gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-2xl cursor-pointer">
            <input 
              type="checkbox" 
              checked={formData.archived}
              onChange={e => setFormData({ ...formData, archived: e.target.checked })}
              className="w-5 h-5 rounded-lg border-none bg-black/10 text-black focus:ring-0"
            />
            <div className="flex items-center gap-2">
              <Archive size={16} />
              <span className="text-sm font-bold uppercase tracking-wider">Archived Account</span>
            </div>
          </label>
        )}
      </div>

      <div className="space-y-3">
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Saving...' : initialData ? 'Update Account' : 'Create Account'}
        </Button>
        {initialData && (
          <Button type="button" variant="destructive" ghost onClick={handleDelete} disabled={loading} className="w-full">
            Delete Account
          </Button>
        )}
      </div>
    </form>
  );
}
