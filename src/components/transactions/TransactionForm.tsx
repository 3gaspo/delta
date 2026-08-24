import React, { useState, useMemo } from 'react';
import { useData } from '../../providers/DataProvider';
import { Transaction, RecurringTransaction, TransactionType, TransactionStatus, Category } from '../../types';
import { Button, Input, Select } from '../ui/Base';
import { 
  Calendar, Tag, CreditCard, Layers, AlignLeft, 
  ArrowRightLeft, Repeat, Plus, Trash2, Layers3,
  ArrowUpRight, ArrowDownLeft, Receipt
} from 'lucide-react';
import { parseMoney, formatCurrency, cn } from '../../lib/utils';

export type FormTabMode = 'single' | 'group' | 'transfer' | 'subscription';

interface TransactionFormProps {
  onClose: () => void;
  initialData?: Transaction;
  initialRecurringData?: RecurringTransaction;
  defaultMode?: FormTabMode;
}

interface SubTransactionItem {
  id?: string;
  amount: string;
  type: 'expense' | 'income';
  accountId: string;
  categoryId: string;
  tagsInput: string;
  description: string;
}

export function TransactionForm({ onClose, initialData, initialRecurringData, defaultMode }: TransactionFormProps) {
  const { 
    accounts, categories, tags, transactions, settings,
    addTransaction, updateTransaction, deleteTransaction,
    saveGroupTransaction, deleteGroupTransaction,
    addRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction, addTag 
  } = useData();

  // Deduplicate categories by label
  const availableCategories = useMemo(() => {
    const seen = new Set<string>();
    const list: Category[] = [];
    for (const c of categories) {
      const key = (c.label || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push(c);
      }
    }
    return list;
  }, [categories]);

  // Find existing group transactions if initialData belongs to a group
  const existingGroupSubtransactions = useMemo(() => {
    if (initialData?.groupId) {
      return transactions.filter(t => t.groupId === initialData.groupId);
    }
    return [];
  }, [initialData, transactions]);

  // Determine initial mode based on initialData or initialRecurringData
  const initialMode = useMemo<FormTabMode>(() => {
    if (defaultMode) return defaultMode;
    if (initialRecurringData) {
      return initialRecurringData.type === 'transfer' ? 'transfer' : 'subscription';
    }
    if (initialData?.groupId || existingGroupSubtransactions.length > 0) return 'group';
    if (initialData?.type === 'transfer') return 'transfer';
    if (initialData?.type === 'subscription' || (initialData?.periodicityDays && initialData.periodicityDays > 0)) {
      return 'subscription';
    }
    return 'single';
  }, [defaultMode, initialRecurringData, initialData, existingGroupSubtransactions]);

  const [mode, setMode] = useState<FormTabMode>(initialMode);

  // Common shared state
  const rawAmount = initialRecurringData?.amount ?? initialData?.amount;
  const rawDate = initialRecurringData?.startDate ?? initialData?.date ?? Date.now();
  const rawAccId = initialRecurringData?.accountId ?? initialData?.accountId ?? accounts[0]?.id ?? '';
  const rawCatId = initialRecurringData?.categoryId ?? initialData?.categoryId ?? availableCategories.find(c => c.label === 'Uncategorized')?.id ?? availableCategories[0]?.id ?? '';
  const rawTagIds = initialRecurringData?.tagIds ?? initialData?.tagIds ?? [];
  const rawName = initialRecurringData?.name ?? initialData?.name ?? '';
  const rawStatus = initialRecurringData?.status ?? initialData?.status ?? 'normal';
  const rawDesc = initialRecurringData?.description ?? initialData?.description ?? '';
  const rawTransferAccId = initialRecurringData?.transferAccountId ?? initialData?.transferAccountId ?? accounts.find(a => a.id !== rawAccId)?.id ?? '';

  const [formData, setFormData] = useState({
    amount: rawAmount ? rawAmount.toString() : '',
    name: rawName,
    date: new Date(rawDate).toISOString().split('T')[0],
    accountId: rawAccId,
    categoryId: rawCatId,
    tagIds: rawTagIds,
    type: ((initialRecurringData?.type === 'income' || initialData?.type === 'income') ? 'income' : 'expense') as 'expense' | 'income',
    status: rawStatus as TransactionStatus,
    description: rawDesc,
    transferAccountId: rawTransferAccId
  });

  // Subscription specific state
  const [subscriptionType, setSubscriptionType] = useState<'expense' | 'income'>(
    (initialRecurringData?.type === 'income' || initialData?.type === 'income') ? 'income' : 'expense'
  );

  const initialP = initialRecurringData?.periodicityDays ?? initialData?.periodicityDays;

  const [periodicity, setPeriodicity] = useState<string>(() => {
    if (initialP) {
      if ([7, 14, 30, 90, 365].includes(initialP)) {
        return initialP.toString();
      }
      return 'custom';
    }
    return '30'; // Default monthly for subscription tab
  });

  const [transferPeriodicity, setTransferPeriodicity] = useState<string>(() => {
    if ((initialRecurringData?.type === 'transfer' || initialData?.type === 'transfer') && initialP) {
      if ([7, 14, 30, 90, 365].includes(initialP)) {
        return initialP.toString();
      }
      return 'custom';
    }
    return '0'; // Default one-time for transfer
  });

  const [customPeriod, setCustomPeriod] = useState<string>(
    initialP && ![0, 7, 14, 30, 90, 365].includes(initialP)
      ? initialP.toString()
      : ''
  );

  const [tagsInput, setTagsInput] = useState(
    rawTagIds.map(tid => tags.find(t => t.id === tid)?.label).filter(Boolean).join(', ')
  );

  // Group transaction sub-transactions state
  const defaultSubCat = availableCategories.find(c => c.label === 'Uncategorized')?.id || availableCategories[0]?.id || '';
  const defaultAcc = accounts[0]?.id || '';

  const [subTransactions, setSubTransactions] = useState<SubTransactionItem[]>(() => {
    if (existingGroupSubtransactions.length > 0) {
      return existingGroupSubtransactions.map(t => ({
        id: t.id,
        amount: t.amount.toString(),
        type: (t.type === 'income' ? 'income' : 'expense'),
        accountId: t.accountId,
        categoryId: t.categoryId || defaultSubCat,
        tagsInput: t.tagIds.map(tid => tags.find(tg => tg.id === tid)?.label).filter(Boolean).join(', '),
        description: t.description || ''
      }));
    }
    return [
      { amount: '', type: 'expense', accountId: defaultAcc, categoryId: defaultSubCat, tagsInput: '', description: '' },
      { amount: '', type: 'expense', accountId: defaultAcc, categoryId: defaultSubCat, tagsInput: '', description: '' }
    ];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupTotalAmount = useMemo(() => {
    return subTransactions.reduce((sum, st) => {
      const val = parseMoney(st.amount);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [subTransactions]);

  const handleAddSubTransaction = () => {
    setSubTransactions([
      ...subTransactions,
      { amount: '', type: 'expense', accountId: defaultAcc, categoryId: defaultSubCat, tagsInput: '', description: '' }
    ]);
  };

  const handleRemoveSubTransaction = (index: number) => {
    if (subTransactions.length <= 1) return;
    setSubTransactions(subTransactions.filter((_, i) => i !== index));
  };

  const handleUpdateSubTransaction = (index: number, fields: Partial<SubTransactionItem>) => {
    setSubTransactions(subTransactions.map((st, i) => i === index ? { ...st, ...fields } : st));
  };

  // Process tag string into tag IDs
  const processTags = async (inputStr: string): Promise<string[]> => {
    const tagLabels = inputStr.split(',').map(s => s.trim()).filter(s => s !== '');
    const finalTagIds: string[] = [];

    for (const label of tagLabels) {
      const existingTag = tags.find(t => t.label.toLowerCase() === label.toLowerCase());
      if (existingTag) {
        finalTagIds.push(existingTag.id);
      } else {
        const newId = crypto.randomUUID();
        const now = Date.now();
        const newTag = { id: newId, label, createdAt: now, updatedAt: now };
        await addTag(newTag);
        finalTagIds.push(newId);
      }
    }
    return finalTagIds;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (accounts.length === 0) {
        throw new Error('Please create at least one account first.');
      }

      if (mode === 'single') {
        if (!formData.name.trim()) throw new Error('Transaction name is required');
        const amount = parseMoney(formData.amount);
        if (amount <= 0) throw new Error('Amount must be positive');
        if (!formData.accountId) throw new Error('Account is required');

        const finalTagIds = await processTags(tagsInput);

        const submission: any = {
          name: formData.name.trim(),
          amount,
          date: new Date(formData.date).getTime(),
          accountId: formData.accountId,
          categoryId: formData.categoryId,
          tagIds: finalTagIds,
          type: formData.type,
          status: formData.status,
          description: formData.description.trim(),
          periodicityDays: undefined,
          lastGeneratedDate: undefined,
          transferAccountId: undefined
        };

        if (initialRecurringData) {
          await addTransaction(submission);
          await deleteRecurringTransaction(initialRecurringData.id, false);
        } else if (initialData?.groupId) {
          await deleteGroupTransaction(initialData.groupId);
          await addTransaction(submission);
        } else if (initialData) {
          await updateTransaction(initialData.id, submission);
        } else {
          await addTransaction(submission);
        }
      } else if (mode === 'group') {
        if (!formData.name.trim()) throw new Error('Group title is required');
        if (subTransactions.length === 0) throw new Error('At least one sub-transaction is required');

        const sharedDate = new Date(formData.date).getTime();
        const groupId = initialData?.groupId || crypto.randomUUID();

        const preparedSubtransactions = [];
        for (let i = 0; i < subTransactions.length; i++) {
          const st = subTransactions[i];
          const amt = parseMoney(st.amount);
          if (amt <= 0) throw new Error(`Sub-transaction #${i + 1} has an invalid amount`);
          if (!st.accountId) throw new Error(`Sub-transaction #${i + 1} requires an account`);

          const stTagIds = await processTags(st.tagsInput);

          preparedSubtransactions.push({
            id: st.id,
            groupId,
            name: formData.name.trim(),
            amount: amt,
            date: sharedDate,
            accountId: st.accountId,
            categoryId: st.categoryId,
            tagIds: stTagIds,
            type: st.type,
            status: formData.status,
            description: st.description.trim()
          });
        }

        if (initialRecurringData) {
          await saveGroupTransaction(groupId, preparedSubtransactions);
          await deleteRecurringTransaction(initialRecurringData.id, false);
        } else if (initialData && !initialData.groupId) {
          await deleteTransaction(initialData.id);
          await saveGroupTransaction(groupId, preparedSubtransactions);
        } else {
          await saveGroupTransaction(groupId, preparedSubtransactions);
        }
      } else if (mode === 'transfer') {
        const transferName = formData.name.trim() || 'Transfer';
        const amount = parseMoney(formData.amount);
        if (amount <= 0) throw new Error('Transfer amount must be positive');
        if (!formData.accountId) throw new Error('Source (From) account is required');
        if (!formData.transferAccountId) throw new Error('Destination (To) account is required');
        if (formData.accountId === formData.transferAccountId) {
          throw new Error('Source and destination accounts must be different');
        }

        const periodNum = transferPeriodicity === 'custom' ? parseInt(customPeriod) : parseInt(transferPeriodicity);
        const isRecurringTransfer = !isNaN(periodNum) && periodNum > 0;
        const finalTagIds = await processTags(tagsInput);

        if (isRecurringTransfer) {
          const recurringTransferDoc = {
            name: transferName,
            amount,
            startDate: new Date(formData.date).getTime(),
            accountId: formData.accountId,
            transferAccountId: formData.transferAccountId,
            categoryId: '',
            tagIds: finalTagIds,
            type: 'transfer' as const,
            status: formData.status,
            description: formData.description.trim(),
            periodicityDays: periodNum,
            active: true
          };

          if (initialRecurringData) {
            await updateRecurringTransaction(initialRecurringData.id, recurringTransferDoc);
          } else if (initialData?.groupId) {
            await deleteGroupTransaction(initialData.groupId);
            await addRecurringTransaction(recurringTransferDoc);
          } else if (initialData) {
            await deleteTransaction(initialData.id);
            await addRecurringTransaction(recurringTransferDoc);
          } else {
            await addRecurringTransaction(recurringTransferDoc);
          }
        } else {
          const submission: any = {
            name: transferName,
            amount,
            date: new Date(formData.date).getTime(),
            accountId: formData.accountId,
            transferAccountId: formData.transferAccountId,
            categoryId: '',
            tagIds: finalTagIds,
            type: 'transfer' as TransactionType,
            status: formData.status,
            description: formData.description.trim()
          };

          if (initialRecurringData) {
            await addTransaction(submission);
            await deleteRecurringTransaction(initialRecurringData.id, false);
          } else if (initialData?.groupId) {
            await deleteGroupTransaction(initialData.groupId);
            await addTransaction(submission);
          } else if (initialData) {
            await updateTransaction(initialData.id, submission);
          } else {
            await addTransaction(submission);
          }
        }
      } else if (mode === 'subscription') {
        if (!formData.name.trim()) throw new Error('Subscription name is required');
        const amount = parseMoney(formData.amount);
        if (amount <= 0) throw new Error('Subscription amount must be positive');
        if (!formData.accountId) throw new Error('Account is required');

        const periodNum = periodicity === 'custom' ? parseInt(customPeriod) : parseInt(periodicity);
        if (isNaN(periodNum) || periodNum <= 0) {
          throw new Error('Please select a valid periodicity interval for the recurring subscription');
        }

        const finalTagIds = await processTags(tagsInput);

        const recurringDoc = {
          name: formData.name.trim(),
          amount,
          startDate: new Date(formData.date).getTime(),
          accountId: formData.accountId,
          categoryId: formData.categoryId,
          tagIds: finalTagIds,
          type: subscriptionType === 'income' ? ('income' as const) : ('expense' as const),
          status: formData.status,
          description: formData.description.trim(),
          periodicityDays: periodNum,
          active: true
        };

        if (initialRecurringData) {
          await updateRecurringTransaction(initialRecurringData.id, recurringDoc);
        } else if (initialData?.groupId) {
          await deleteGroupTransaction(initialData.groupId);
          await addRecurringTransaction(recurringDoc);
        } else if (initialData) {
          await deleteTransaction(initialData.id);
          await addRecurringTransaction(recurringDoc);
        } else {
          await addRecurringTransaction(recurringDoc);
        }
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      {accounts.length === 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl text-xs font-semibold">
          No accounts found. Please add an account in the Accounts tab before recording transactions.
        </div>
      )}

      {/* 4-Tab Mode Selector (Icon-only bar with generous click targets and titles) */}
      <div className="grid grid-cols-4 bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl gap-1.5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'single'}
          title="Single Transaction"
          onClick={() => setMode('single')}
          className={cn(
            "py-3 px-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
            mode === 'single'
              ? "bg-white dark:bg-black text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              : "opacity-40 hover:opacity-100 text-foreground"
          )}
        >
          <Receipt size={18} />
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'group'}
          title="Group Transaction"
          onClick={() => setMode('group')}
          className={cn(
            "py-3 px-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
            mode === 'group'
              ? "bg-purple-600 text-white shadow-sm"
              : "opacity-40 hover:opacity-100 text-foreground"
          )}
        >
          <Layers3 size={18} />
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'transfer'}
          title="Account Transfer"
          onClick={() => setMode('transfer')}
          className={cn(
            "py-3 px-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
            mode === 'transfer'
              ? "bg-blue-600 text-white shadow-sm"
              : "opacity-40 hover:opacity-100 text-foreground"
          )}
        >
          <ArrowRightLeft size={18} />
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'subscription'}
          title="Recurring Subscription"
          onClick={() => setMode('subscription')}
          className={cn(
            "py-3 px-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
            mode === 'subscription'
              ? "bg-amber-600 text-white shadow-sm"
              : "opacity-40 hover:opacity-100 text-foreground"
          )}
        >
          <Repeat size={18} />
        </button>
      </div>

      {/* Active Tab Banner Title (No description as requested) */}
      {mode === 'single' && (
        <div className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-black/40 flex items-center justify-center shadow-xs shrink-0 text-foreground">
            <Receipt size={18} />
          </div>
          <h3 className="text-sm font-bold text-foreground">Single Transaction</h3>
        </div>
      )}

      {mode === 'group' && (
        <div className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Layers3 size={18} />
          </div>
          <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300">Group Transaction</h3>
        </div>
      )}

      {mode === 'transfer' && (
        <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <ArrowRightLeft size={18} />
          </div>
          <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">Account Transfer</h3>
        </div>
      )}

      {mode === 'subscription' && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Repeat size={18} />
          </div>
          <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">Recurring Transaction</h3>
        </div>
      )}

      <div className="space-y-4">
        {/* ======================= TAB 1: SINGLE TRANSACTION ======================= */}
        {mode === 'single' && (
          <>
            {/* Type Selector (Expense in Red / Income in Green) */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                Transaction Type
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'expense' })}
                  className={cn(
                    "py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all",
                    formData.type === 'expense'
                      ? "bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 shadow-sm"
                      : "bg-black/5 dark:bg-white/5 border-transparent text-foreground/50 hover:text-foreground"
                  )}
                >
                  <ArrowUpRight size={16} className={formData.type === 'expense' ? "text-red-500" : ""} />
                  <span>Expense</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'income' })}
                  className={cn(
                    "py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all",
                    formData.type === 'income'
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "bg-black/5 dark:bg-white/5 border-transparent text-foreground/50 hover:text-foreground"
                  )}
                >
                  <ArrowDownLeft size={16} className={formData.type === 'income' ? "text-emerald-500" : ""} />
                  <span>Income</span>
                </button>
              </div>
            </div>

            {/* Name */}
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                Name / Merchant
              </span>
              <Input 
                placeholder={formData.type === 'income' ? "e.g. Bonus, Client Payment" : "e.g. Starbucks, Groceries"} 
                icon={AlignLeft}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                className="text-lg font-bold"
              />
            </label>

            {/* Amount */}
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Amount</span>
              <Input 
                placeholder="0.00" 
                type="text" 
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
                className={cn(
                  "text-2xl font-bold py-6",
                  formData.type === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Date</span>
                <Input 
                  type="date" 
                  icon={Calendar}
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Status</span>
                <Select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                >
                  <option value="normal">Normal</option>
                  <option value="pending">Pending</option>
                  <option value="hidden">Hidden</option>
                </Select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Account</span>
                <Select 
                  icon={CreditCard}
                  value={formData.accountId}
                  onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                  required
                >
                  {accounts.length === 0 && <option value="">No Accounts Available</option>}
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Category</span>
                <Select 
                  icon={Layers}
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  required
                >
                  {availableCategories
                    .filter(c => (c.type === 'both' || c.type === formData.type))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </Select>
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Tags (comma separated)</span>
              <Input 
                icon={Tag}
                placeholder="Food, Leisure, Important..."
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Additional Description (Optional)</span>
              <Input 
                icon={AlignLeft}
                placeholder="Details about this transaction..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </label>
          </>
        )}

        {/* ======================= TAB 2: GROUP TRANSACTION ======================= */}
        {mode === 'group' && (
          <>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                Group Title / Shared Name
              </span>
              <Input 
                placeholder="e.g. IKEA Shopping, Supermarket Receipt" 
                icon={AlignLeft}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                className="text-lg font-bold"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Date</span>
                <Input 
                  type="date" 
                  icon={Calendar}
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Status</span>
                <Select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                >
                  <option value="normal">Normal</option>
                  <option value="pending">Pending</option>
                  <option value="hidden">Hidden</option>
                </Select>
              </label>
            </div>

            <div className="pt-2 border-t border-black/10 dark:border-white/10">
              <div className="flex justify-end mb-4">
                <div className="bg-purple-500/10 px-4 py-2 rounded-2xl border border-purple-500/20 flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Total Group Amount:</span>
                  <span className="text-base font-black text-purple-600 dark:text-purple-400">
                    {formatCurrency(groupTotalAmount, settings.currency)}
                  </span>
                </div>
              </div>

              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {subTransactions.map((st, idx) => (
                  <div key={idx} className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 space-y-3 relative group/item">
                    <div className="flex items-center justify-between pb-1 border-b border-black/5 dark:border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-600 dark:text-purple-300 px-2.5 py-1 rounded-md">
                        Sub-Transaction #{idx + 1}
                      </span>
                      {subTransactions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSubTransaction(idx)}
                          className="text-red-500 opacity-60 hover:opacity-100 p-1 transition-opacity flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                          title="Remove item"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                    </div>

                    {/* Subtransaction Type Selector: Expense (Red) / Income (Green) */}
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Type</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateSubTransaction(idx, { type: 'expense' })}
                          className={cn(
                            "py-2 px-3 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-all",
                            st.type === 'expense'
                              ? "bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 shadow-sm"
                              : "bg-black/5 dark:bg-white/5 border-transparent text-foreground/50 hover:text-foreground"
                          )}
                        >
                          <ArrowUpRight size={14} className={st.type === 'expense' ? "text-red-500" : ""} />
                          <span>Expense</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateSubTransaction(idx, { type: 'income' })}
                          className={cn(
                            "py-2 px-3 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-all",
                            st.type === 'income'
                              ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm"
                              : "bg-black/5 dark:bg-white/5 border-transparent text-foreground/50 hover:text-foreground"
                          )}
                        >
                          <ArrowDownLeft size={14} className={st.type === 'income' ? "text-emerald-500" : ""} />
                          <span>Income</span>
                        </button>
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Amount</span>
                      <Input 
                        placeholder="0.00"
                        value={st.amount}
                        onChange={e => handleUpdateSubTransaction(idx, { amount: e.target.value })}
                        required
                        className={cn(
                          "font-bold",
                          st.type === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        )}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">
                        Account
                      </span>
                      <Select
                        icon={CreditCard}
                        value={st.accountId}
                        onChange={e => handleUpdateSubTransaction(idx, { accountId: e.target.value })}
                        required
                      >
                        {accounts.length === 0 && <option value="">No Accounts Available</option>}
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </Select>
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Category</span>
                      <Select
                        icon={Layers}
                        value={st.categoryId}
                        onChange={e => handleUpdateSubTransaction(idx, { categoryId: e.target.value })}
                        required
                      >
                        {availableCategories
                          .filter(c => (c.type === 'both' || c.type === st.type))
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                      </Select>
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Tags (comma separated)</span>
                      <Input 
                        icon={Tag}
                        placeholder="Food, Leisure..."
                        value={st.tagsInput}
                        onChange={e => handleUpdateSubTransaction(idx, { tagsInput: e.target.value })}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Notes / Detail</span>
                      <Input 
                        icon={AlignLeft}
                        placeholder="Sub-item notes..."
                        value={st.description}
                        onChange={e => handleUpdateSubTransaction(idx, { description: e.target.value })}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={handleAddSubTransaction}
                className="w-full mt-3 py-3 border-dashed border-2 flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add Another Sub-Transaction
              </Button>
            </div>
          </>
        )}

        {/* ======================= TAB 3: TRANSFER ======================= */}
        {mode === 'transfer' && (
          <>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                Transfer Title / Name
              </span>
              <Input 
                placeholder="e.g. Savings Deposit, Credit Card Payment" 
                icon={AlignLeft}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                className="text-lg font-bold"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Transfer Amount</span>
              <Input 
                placeholder="0.00" 
                type="text" 
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
                className="text-2xl font-bold py-6 text-blue-600 dark:text-blue-400"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">From Account (Source)</span>
                <Select 
                  icon={CreditCard}
                  value={formData.accountId}
                  onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                  required
                >
                  {accounts.length === 0 && <option value="">No Accounts Available</option>}
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">To Account (Destination)</span>
                <Select 
                  icon={ArrowRightLeft}
                  value={formData.transferAccountId}
                  onChange={e => setFormData({ ...formData, transferAccountId: e.target.value })}
                  required
                >
                  <option value="">Select Destination</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id} disabled={a.id === formData.accountId}>
                      {a.name} {a.id === formData.accountId ? '(Current Source)' : ''}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Start Date</span>
                <Input 
                  type="date" 
                  icon={Calendar}
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Optional Periodicity</span>
                <Select 
                  icon={Repeat}
                  value={transferPeriodicity}
                  onChange={e => setTransferPeriodicity(e.target.value)}
                >
                  <option value="0">One-time (No repeat)</option>
                  <option value="7">Every 7 days (Weekly)</option>
                  <option value="14">Every 14 days (Bi-weekly)</option>
                  <option value="30">Every 30 days (Monthly)</option>
                  <option value="90">Every 90 days (Quarterly)</option>
                  <option value="365">Every 365 days (Yearly)</option>
                  <option value="custom">Custom interval in days...</option>
                </Select>
              </label>
            </div>

            {transferPeriodicity === 'custom' && (
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Repeat Every (Days)</span>
                <Input 
                  type="number"
                  icon={Repeat}
                  placeholder="e.g. 15"
                  value={customPeriod}
                  onChange={e => setCustomPeriod(e.target.value)}
                  min="1"
                  required
                />
              </label>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Status</span>
                <Select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                >
                  <option value="normal">Normal</option>
                  <option value="pending">Pending</option>
                  <option value="hidden">Hidden</option>
                </Select>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Tags (comma separated)</span>
                <Input 
                  icon={Tag}
                  placeholder="Savings, Transfer, Internal..."
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Notes / Description (Optional)</span>
              <Input 
                icon={AlignLeft}
                placeholder="Details about this transfer..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </label>
          </>
        )}

        {/* ======================= TAB 4: SUBSCRIPTION ======================= */}
        {mode === 'subscription' && (
          <>
            {/* Recurring Type Selector: Expense (Subscription) vs Recurring Income */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                Subscription Flow
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubscriptionType('expense')}
                  className={cn(
                    "py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all",
                    subscriptionType === 'expense'
                      ? "bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 shadow-sm"
                      : "bg-black/5 dark:bg-white/5 border-transparent text-foreground/50 hover:text-foreground"
                  )}
                >
                  <ArrowUpRight size={16} className={subscriptionType === 'expense' ? "text-red-500" : ""} />
                  <span>Recurring Expense</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubscriptionType('income')}
                  className={cn(
                    "py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all",
                    subscriptionType === 'income'
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "bg-black/5 dark:bg-white/5 border-transparent text-foreground/50 hover:text-foreground"
                  )}
                >
                  <ArrowDownLeft size={16} className={subscriptionType === 'income' ? "text-emerald-500" : ""} />
                  <span>Recurring Income</span>
                </button>
              </div>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                {subscriptionType === 'expense' ? 'Subscription / Recurring Expense Name' : 'Recurring Income Name'}
              </span>
              <Input 
                placeholder={subscriptionType === 'expense' ? "e.g. Netflix, Spotify, Gym, Apartment Rent" : "e.g. Monthly Salary, Freelance Retainer"} 
                icon={AlignLeft}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                className="text-lg font-bold"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Recurring Amount</span>
              <Input 
                placeholder="0.00" 
                type="text" 
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
                className={cn(
                  "text-2xl font-bold py-6",
                  subscriptionType === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                )}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Periodicity Interval</span>
                <Select 
                  icon={Repeat}
                  value={periodicity}
                  onChange={e => setPeriodicity(e.target.value)}
                >
                  <option value="7">Every 7 days (Weekly)</option>
                  <option value="14">Every 14 days (Bi-weekly)</option>
                  <option value="30">Every 30 days (Monthly)</option>
                  <option value="90">Every 90 days (Quarterly)</option>
                  <option value="365">Every 365 days (Yearly)</option>
                  <option value="custom">Custom interval in days...</option>
                </Select>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Start Date (First Occurrence)</span>
                <Input 
                  type="date" 
                  icon={Calendar}
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </label>
            </div>

            {periodicity === 'custom' && (
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Repeat Every (Days)</span>
                <Input 
                  type="number"
                  icon={Repeat}
                  placeholder="e.g. 15"
                  value={customPeriod}
                  onChange={e => setCustomPeriod(e.target.value)}
                  min="1"
                  required
                />
              </label>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Account</span>
                <Select 
                  icon={CreditCard}
                  value={formData.accountId}
                  onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                  required
                >
                  {accounts.length === 0 && <option value="">No Accounts Available</option>}
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Category</span>
                <Select 
                  icon={Layers}
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  required
                >
                  {availableCategories
                    .filter(c => (c.type === 'both' || c.type === subscriptionType))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </Select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Status</span>
                <Select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                >
                  <option value="normal">Normal</option>
                  <option value="pending">Pending</option>
                  <option value="hidden">Hidden</option>
                </Select>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Tags (comma separated)</span>
                <Input 
                  icon={Tag}
                  placeholder="Subscription, Fixed, Essential..."
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Additional Description (Optional)</span>
              <Input 
                icon={AlignLeft}
                placeholder="Billing notes, renewal info..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </label>
          </>
        )}
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading 
          ? 'Saving...' 
          : mode === 'group' 
            ? 'Save Group Transaction' 
            : mode === 'transfer'
              ? (initialData ? 'Update Transfer' : 'Execute Transfer')
              : mode === 'subscription'
                ? (initialData ? 'Update Subscription' : 'Create Subscription')
                : (initialData ? 'Update Transaction' : 'Record Transaction')}
      </Button>
    </form>
  );
}
