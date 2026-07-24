import React, { useState, useMemo } from 'react';
import { useData } from '../../providers/DataProvider';
import { Transaction, TransactionType, TransactionStatus, Category } from '../../types';
import { Button, Input, Select } from '../ui/Base';
import { 
  Calendar, Tag, CreditCard, Layers, AlignLeft, 
  ArrowRightLeft, Repeat, Plus, Trash2, Layers3 
} from 'lucide-react';
import { parseMoney, formatCurrency } from '../../lib/utils';

interface TransactionFormProps {
  onClose: () => void;
  initialData?: Transaction;
}

interface SubTransactionItem {
  id?: string;
  amount: string;
  type: TransactionType;
  accountId: string;
  categoryId: string;
  tagsInput: string;
  description: string;
  transferAccountId?: string;
}

export function TransactionForm({ onClose, initialData }: TransactionFormProps) {
  const { 
    accounts, categories, tags, transactions, settings,
    addTransaction, updateTransaction, saveGroupTransaction, addTag 
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

  const [mode, setMode] = useState<'single' | 'group'>(
    initialData?.groupId || existingGroupSubtransactions.length > 0 ? 'group' : 'single'
  );

  // Single transaction state
  const [formData, setFormData] = useState({
    amount: initialData?.amount.toString() || '',
    name: initialData?.name || '',
    date: new Date(initialData?.date || Date.now()).toISOString().split('T')[0],
    accountId: initialData?.accountId || accounts[0]?.id || '',
    categoryId: initialData?.categoryId || availableCategories.find(c => c.label === 'Uncategorized')?.id || availableCategories[0]?.id || '',
    tagIds: initialData?.tagIds || [],
    type: initialData?.type || 'expense' as TransactionType,
    status: initialData?.status || 'normal' as TransactionStatus,
    description: initialData?.description || '',
    transferAccountId: initialData?.transferAccountId || accounts.find(a => a.id !== initialData?.accountId)?.id || ''
  });

  const [periodicity, setPeriodicity] = useState<string>(
    initialData?.periodicityDays && [7, 14, 30, 90, 365].includes(initialData.periodicityDays)
      ? initialData.periodicityDays.toString()
      : initialData?.periodicityDays
      ? 'custom'
      : '0'
  );

  const [customPeriod, setCustomPeriod] = useState<string>(
    initialData?.periodicityDays && ![0, 7, 14, 30, 90, 365].includes(initialData.periodicityDays)
      ? initialData.periodicityDays.toString()
      : ''
  );

  const [tagsInput, setTagsInput] = useState(
    initialData?.tagIds.map(tid => tags.find(t => t.id === tid)?.label).filter(Boolean).join(', ') || ''
  );

  // Group transaction sub-transactions state
  const defaultSubCat = availableCategories.find(c => c.label === 'Uncategorized')?.id || availableCategories[0]?.id || '';
  const defaultAcc = accounts[0]?.id || '';

  const [subTransactions, setSubTransactions] = useState<SubTransactionItem[]>(() => {
    if (existingGroupSubtransactions.length > 0) {
      return existingGroupSubtransactions.map(t => ({
        id: t.id,
        amount: t.amount.toString(),
        type: t.type,
        accountId: t.accountId,
        categoryId: t.categoryId || defaultSubCat,
        tagsInput: t.tagIds.map(tid => tags.find(tg => tg.id === tid)?.label).filter(Boolean).join(', '),
        description: t.description || '',
        transferAccountId: t.transferAccountId || ''
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
      if (!formData.name.trim()) throw new Error('Shared transaction name is required');

      if (mode === 'single') {
        const amount = parseMoney(formData.amount);
        if (amount <= 0) throw new Error('Amount must be positive');
        if (!formData.accountId) throw new Error('Account is required');
        if (formData.type === 'transfer' && !formData.transferAccountId) throw new Error('Transfer account is required');
        if (formData.type === 'transfer' && formData.accountId === formData.transferAccountId) {
          throw new Error('Source and destination accounts must be different');
        }

        const finalTagIds = await processTags(tagsInput);

        const periodNum = periodicity === 'custom' ? parseInt(customPeriod) : parseInt(periodicity);
        const periodicityDays = (!isNaN(periodNum) && periodNum > 0) ? periodNum : undefined;

        const submission: any = {
          ...formData,
          amount,
          date: new Date(formData.date).getTime(),
          tagIds: finalTagIds,
          periodicityDays,
          lastGeneratedDate: periodicityDays ? (initialData?.lastGeneratedDate || new Date(formData.date).getTime()) : undefined
        };

        if (initialData) {
          await updateTransaction(initialData.id, submission);
        } else {
          await addTransaction(submission);
        }
      } else {
        // Group Mode
        if (subTransactions.length === 0) throw new Error('At least one sub-transaction is required');

        const sharedDate = new Date(formData.date).getTime();
        const groupId = initialData?.groupId || crypto.randomUUID();

        const preparedSubtransactions = [];
        for (let i = 0; i < subTransactions.length; i++) {
          const st = subTransactions[i];
          const amt = parseMoney(st.amount);
          if (amt <= 0) throw new Error(`Sub-transaction #${i + 1} has an invalid amount`);
          if (!st.accountId) throw new Error(`Sub-transaction #${i + 1} requires an account`);
          if (st.type === 'transfer' && !st.transferAccountId) throw new Error(`Sub-transaction #${i + 1} requires a destination account`);

          const stTagIds = await processTags(st.tagsInput);

          preparedSubtransactions.push({
            id: st.id,
            groupId,
            name: formData.name.trim(),
            amount: amt,
            date: sharedDate,
            accountId: st.accountId,
            categoryId: st.type === 'transfer' ? '' : st.categoryId,
            tagIds: stTagIds,
            type: st.type,
            status: formData.status,
            description: st.description.trim(),
            transferAccountId: st.type === 'transfer' ? st.transferAccountId : undefined
          });
        }

        await saveGroupTransaction(groupId, preparedSubtransactions);
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
      {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

      {/* Mode Selector Toggle */}
      <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
            mode === 'single'
              ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
              : 'opacity-50 hover:opacity-100'
          }`}
        >
          Single Transaction
        </button>
        <button
          type="button"
          onClick={() => setMode('group')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
            mode === 'group'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'opacity-50 hover:opacity-100'
          }`}
        >
          <Layers3 size={14} /> Group Transaction
        </button>
      </div>

      <div className="space-y-4">
        {/* Title / Name (Shared) */}
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
            {mode === 'group' ? 'Group Title / Shared Name' : 'Name'}
          </span>
          <Input 
            placeholder={mode === 'group' ? "e.g. IKEA Shopping, Supermarket Receipt" : "e.g. Starbucks Coffee"} 
            icon={AlignLeft}
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
            className="text-lg font-bold"
          />
        </label>

        {/* Single Mode Fields */}
        {mode === 'single' && (
          <>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Amount</span>
              <Input 
                placeholder="0.00" 
                type="text" 
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
                className="text-2xl font-bold py-6"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Type</span>
                <Select 
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as TransactionType })}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                  <option value="subscription">Subscription</option>
                </Select>
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
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Periodicity</span>
                <Select 
                  icon={Repeat}
                  value={periodicity}
                  onChange={e => setPeriodicity(e.target.value)}
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

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                {formData.type === 'transfer' ? 'From Account' : 'Account'}
              </span>
              <Select 
                icon={CreditCard}
                value={formData.accountId}
                onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </label>

            {formData.type === 'transfer' && (
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">To Account</span>
                <Select 
                  icon={ArrowRightLeft}
                  value={formData.transferAccountId}
                  onChange={e => setFormData({ ...formData, transferAccountId: e.target.value })}
                  required
                >
                  <option value="">Select Destination</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id} disabled={a.id === formData.accountId}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </label>
            )}

            {formData.type !== 'transfer' && (
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Category</span>
                <Select 
                  icon={Layers}
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  required
                >
                  {availableCategories
                    .filter(c => (c.type === 'both' || c.type === (formData.type === 'subscription' ? 'expense' : formData.type)))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </Select>
              </label>
            )}

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Tags (comma separated)</span>
              <Input 
                icon={Tag}
                placeholder="Food, Leisure, Urgent..."
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

        {/* Group Mode Fields */}
        {mode === 'group' && (
          <>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Amount</span>
                        <Input 
                          placeholder="0.00"
                          value={st.amount}
                          onChange={e => handleUpdateSubTransaction(idx, { amount: e.target.value })}
                          required
                          className="font-bold"
                        />
                      </label>

                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Type</span>
                        <Select
                          value={st.type}
                          onChange={e => handleUpdateSubTransaction(idx, { type: e.target.value as TransactionType })}
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="transfer">Transfer</option>
                          <option value="subscription">Subscription</option>
                        </Select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">
                        {st.type === 'transfer' ? 'From Account' : 'Account'}
                      </span>
                      <Select
                        icon={CreditCard}
                        value={st.accountId}
                        onChange={e => handleUpdateSubTransaction(idx, { accountId: e.target.value })}
                        required
                      >
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </Select>
                    </label>

                    {st.type === 'transfer' ? (
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">To Account</span>
                        <Select 
                          icon={ArrowRightLeft}
                          value={st.transferAccountId || ''}
                          onChange={e => handleUpdateSubTransaction(idx, { transferAccountId: e.target.value })}
                          required
                        >
                          <option value="">Select Destination</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id} disabled={a.id === st.accountId}>
                              {a.name}
                            </option>
                          ))}
                        </Select>
                      </label>
                    ) : (
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Category</span>
                        <Select
                          icon={Layers}
                          value={st.categoryId}
                          onChange={e => handleUpdateSubTransaction(idx, { categoryId: e.target.value })}
                          required
                        >
                          {availableCategories
                            .filter(c => (c.type === 'both' || c.type === (st.type === 'subscription' ? 'expense' : st.type)))
                            .map(c => (
                              <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </Select>
                      </label>
                    )}

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
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving...' : mode === 'group' ? 'Save Group Transaction' : initialData ? 'Update Transaction' : 'Record Transaction'}
      </Button>
    </form>
  );
}
