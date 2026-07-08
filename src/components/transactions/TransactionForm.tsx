import React, { useState } from 'react';
import { useData } from '../../providers/DataProvider';
import { Transaction, TransactionType, TransactionStatus } from '../../types';
import { Button, Input, Select } from '../ui/Base';
import { Calendar, Tag, CreditCard, Layers, AlignLeft, ArrowRightLeft } from 'lucide-react';
import { parseMoney } from '../../lib/utils';

interface TransactionFormProps {
  onClose: () => void;
  initialData?: Transaction;
}

export function TransactionForm({ onClose, initialData }: TransactionFormProps) {
  const { 
    accounts, categories, tags, 
    addTransaction, updateTransaction, addTag
  } = useData();

  const [formData, setFormData] = useState({
    amount: initialData?.amount.toString() || '',
    name: initialData?.name || '',
    date: new Date(initialData?.date || Date.now()).toISOString().split('T')[0],
    accountId: initialData?.accountId || accounts[0]?.id || '',
    categoryId: initialData?.categoryId || categories.find(c => c.label === 'Uncategorized')?.id || '',
    tagIds: initialData?.tagIds || [],
    type: initialData?.type || 'expense' as TransactionType,
    status: initialData?.status || 'normal' as TransactionStatus,
    description: initialData?.description || '',
    transferAccountId: initialData?.transferAccountId || accounts.find(a => a.id !== initialData?.accountId)?.id || ''
  });

  const [tagsInput, setTagsInput] = useState(
    initialData?.tagIds.map(tid => tags.find(t => t.id === tid)?.label).filter(Boolean).join(', ') || ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const amount = parseMoney(formData.amount);
      if (amount <= 0) throw new Error('Amount must be positive');
      if (!formData.name.trim()) throw new Error('Name is required');
      if (!formData.accountId) throw new Error('Account is required');
      if (formData.type === 'transfer' && !formData.transferAccountId) throw new Error('Transfer account is required');
      if (formData.type === 'transfer' && formData.accountId === formData.transferAccountId) {
        throw new Error('Source and destination accounts must be different');
      }

      // Process tags
      const tagLabels = tagsInput.split(',').map(s => s.trim()).filter(s => s !== '');
      const finalTagIds: string[] = [];

      for (const label of tagLabels) {
        const existingTag = tags.find(t => t.label.toLowerCase() === label.toLowerCase());
        if (existingTag) {
          finalTagIds.push(existingTag.id);
        } else {
          // Create new tag
          const newId = crypto.randomUUID();
          const now = Date.now();
          const newTag = { id: newId, label, createdAt: now, updatedAt: now };
          await addTag(newTag); 
          finalTagIds.push(newId);
        }
      }

      const submission = {
        ...formData,
        amount,
        date: new Date(formData.date).getTime(),
        tagIds: finalTagIds
      };

      if (initialData) {
        await updateTransaction(initialData.id, submission);
      } else {
        await addTransaction(submission);
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

      <div className="space-y-4">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Name</span>
          <Input 
            placeholder="e.g. Starbucks Coffee" 
            icon={AlignLeft}
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
            className="text-lg font-bold"
          />
        </label>

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
              {categories
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
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving...' : initialData ? 'Update Transaction' : 'Record Transaction'}
      </Button>
    </form>
  );
}
