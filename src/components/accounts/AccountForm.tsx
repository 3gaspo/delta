import React, { useState, useMemo } from 'react';
import { useData } from '../../providers/DataProvider';
import { Account, AccountType, DebtDirection } from '../../types';
import { Button, Input, Select } from '../ui/Base';
import { Landmark, Archive, Wallet, EyeOff, AlertCircle, Trash2, Calculator, Users } from 'lucide-react';
import { isInitialBalanceTx, getAccountBalance } from '../../utils/financial';
import { parseMoney, formatCurrency, cn } from '../../lib/utils';

interface AccountFormProps {
  onClose: () => void;
  initialData?: Account;
  initialDeleteConfirm?: boolean;
}

export function AccountForm({ onClose, initialData, initialDeleteConfirm = false }: AccountFormProps) {
  const { addAccount, updateAccount, deleteAccount, transactions, recurringTransactions, settings } = useData();

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || ('regular' as AccountType),
    debtDirection: initialData?.debtDirection || ('payable' as DebtDirection),
    archived: initialData?.archived || false,
    hidden: initialData?.hidden || false,
    initialBalance: initialData?.initialBalance !== undefined ? initialData.initialBalance.toString() : '0',
    isShared: initialData?.isShared || false,
    defaultMyShareRatio: initialData?.defaultMyShareRatio ?? 0.5
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(initialDeleteConfirm);

  const txSum = useMemo(() => {
    if (!initialData) return 0;
    return getAccountBalance(initialData.id, transactions, { ...initialData, initialBalance: 0 });
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

      if (formData.type === 'regular') {
        submission.isShared = formData.isShared;
        submission.defaultMyShareRatio = formData.isShared ? formData.defaultMyShareRatio : 1.0;
      } else if (formData.type === 'debt') {
        submission.debtDirection = formData.debtDirection;
        submission.isShared = false;
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
      <div className="space-y-4 py-1">
        <div className="flex items-center gap-3 text-red-500">
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Delete "{initialData.name}"?</h3>
            <p className="text-xs text-red-500 font-medium">This cannot be undone.</p>
          </div>
        </div>

        {error && <p className="text-red-500 text-xs font-semibold p-3 bg-red-500/10 rounded-xl">{error}</p>}

        <p className="text-xs text-foreground/70">
          {associatedTxCount > 0 
            ? `Permanently removes this account and its ${associatedTxCount} transaction${associatedTxCount !== 1 ? 's' : ''}.`
            : 'Permanently remove this account.'}
        </p>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            variant="destructive"
            onClick={executeDelete}
            disabled={loading}
            className="w-full text-xs font-bold py-3"
          >
            {loading ? 'Deleting...' : 'Delete Account'}
          </Button>

          {associatedTxCount > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleArchiveInstead}
              disabled={loading}
              className="w-full text-xs font-semibold py-3"
            >
              Archive Instead (Keep History)
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (initialDeleteConfirm) {
                onClose();
              } else {
                setIsConfirmingDelete(false);
              }
            }}
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

        {formData.type === 'regular' && (
          <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl space-y-3 border border-black/5 dark:border-white/5">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Users size={18} />
                </div>
                <div>
                  <span className="text-sm font-bold block text-foreground">Shared Account</span>
                  <span className="text-[10px] opacity-50 block">Split expenses with partner, roommate, or friends</span>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={formData.isShared}
                onChange={e => setFormData({ ...formData, isShared: e.target.checked })}
                className="w-5 h-5 rounded-lg border-none bg-black/10 text-black focus:ring-0 cursor-pointer"
              />
            </label>

            {formData.isShared && (
              <div className="pt-3 border-t border-black/5 dark:border-white/5 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 block">
                  Default Personal Share
                </span>
                <div className="flex items-center gap-2">
                  {[
                    { label: '50% (Half)', val: 0.5 },
                    { label: '100% (Mine)', val: 1.0 },
                    { label: 'Custom', val: 'custom' }
                  ].map(opt => {
                    const isSelected = opt.val === 'custom' 
                      ? (formData.defaultMyShareRatio !== 0.5 && formData.defaultMyShareRatio !== 1.0)
                      : formData.defaultMyShareRatio === opt.val;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          if (opt.val !== 'custom') {
                            setFormData({ ...formData, defaultMyShareRatio: opt.val as number });
                          } else {
                            if (formData.defaultMyShareRatio === 0.5 || formData.defaultMyShareRatio === 1.0) {
                              setFormData({ ...formData, defaultMyShareRatio: 0.6 });
                            }
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          isSelected 
                            ? "bg-foreground text-background" 
                            : "bg-black/5 dark:bg-white/5 hover:bg-black/10 text-foreground/70"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {(formData.defaultMyShareRatio !== 0.5 && formData.defaultMyShareRatio !== 1.0) && (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={Math.round(formData.defaultMyShareRatio * 100)}
                      onChange={e => {
                        const pct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                        setFormData({ ...formData, defaultMyShareRatio: pct / 100 });
                      }}
                      className="w-24 text-center font-bold"
                    />
                    <span className="text-xs font-semibold opacity-60">% My Share</span>
                  </div>
                )}
                <p className="text-[10px] opacity-40 leading-relaxed">
                  Only your share is counted towards your personal expenses and budget, while the true total is deducted from this account.
                </p>
              </div>
            )}
          </div>
        )}

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
