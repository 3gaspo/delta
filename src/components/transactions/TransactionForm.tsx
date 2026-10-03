import React, { useState, useMemo } from 'react';
import { useData } from '../../providers/DataProvider';
import { Transaction, RecurringTransaction, TransactionType, TransactionStatus, Category } from '../../types';
import { Button, Input, Select } from '../ui/Base';
import { 
  Calendar, Tag, CreditCard, Layers, AlignLeft, 
  ArrowRightLeft, Repeat, Plus, Trash2, Layers3,
  ArrowUpRight, ArrowDownLeft, Receipt, HandCoins, Users
} from 'lucide-react';
import { parseMoney, formatCurrency, cn } from '../../lib/utils';

export type FormTabMode = 'single' | 'group' | 'transfer' | 'subscription';

interface TransactionFormProps {
  onClose: () => void;
  initialData?: Transaction;
  initialRecurringData?: RecurringTransaction;
  defaultMode?: FormTabMode;
  allowedModes?: FormTabMode[];
}

interface SubTransactionItem {
  id?: string;
  amount: string;
  type: 'expense' | 'income';
  accountId: string;
  categoryId: string;
  tagsInput: string;
  description: string;
  debtAccountId?: string;
  myShareRatio?: number;
  myShareAmount?: string;
}

export function TransactionForm({ onClose, initialData, initialRecurringData, defaultMode, allowedModes }: TransactionFormProps) {
  const { 
    accounts, categories, tags, transactions, settings,
    addTransaction, updateTransaction, deleteTransaction,
    saveGroupTransaction, deleteGroupTransaction,
    addRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction, addTag 
  } = useData();

  const activeModes = useMemo<FormTabMode[]>(() => {
    if (allowedModes && allowedModes.length > 0) return allowedModes;
    if (initialRecurringData) return ['subscription', 'transfer'];
    if (initialData) return ['single', 'group', 'transfer'];
    return ['single', 'group', 'transfer', 'subscription'];
  }, [allowedModes, initialRecurringData, initialData]);

  const isRecurringContext = useMemo(() => {
    if (initialRecurringData) return true;
    if (allowedModes) {
      return allowedModes.includes('subscription') && !allowedModes.includes('single');
    }
    return false;
  }, [initialRecurringData, allowedModes]);

  // Deduplicate categories by label with Uncategorized always at the end
  const availableCategories = useMemo(() => {
    const seen = new Set<string>();
    const nonUncategorized: Category[] = [];
    const uncategorized: Category[] = [];
    for (const c of categories) {
      const key = (c.label || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        const item: Category = {
          ...c,
          type: c.type || 'both'
        };
        if (key === 'uncategorized') {
          uncategorized.push(item);
        } else {
          nonUncategorized.push(item);
        }
      }
    }
    return [...nonUncategorized, ...uncategorized];
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
    if (defaultMode && activeModes.includes(defaultMode)) return defaultMode;
    if (initialRecurringData) {
      return initialRecurringData.type === 'transfer' ? 'transfer' : 'subscription';
    }
    if (initialData?.groupId || existingGroupSubtransactions.length > 0) return 'group';
    if (initialData?.type === 'transfer') return 'transfer';
    if (initialData?.type === 'subscription' || (initialData?.periodicityDays && initialData.periodicityDays > 0)) {
      return 'subscription';
    }
    return activeModes[0] || 'single';
  }, [defaultMode, activeModes, initialRecurringData, initialData, existingGroupSubtransactions]);

  const [mode, setMode] = useState<FormTabMode>(initialMode);

  const formatDateToLocalInputStr = (timestamp: number) => {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatDateToLocalInputStr(Date.now());

  // Common shared state
  const rawAmount = initialRecurringData?.amount ?? initialData?.amount;
  const rawDate = initialRecurringData?.startDate ?? initialData?.date;
  const initialDateStr = rawDate 
    ? formatDateToLocalInputStr(rawDate) 
    : todayStr;
  const rawAccId = initialRecurringData?.accountId ?? initialData?.accountId ?? accounts[0]?.id ?? '';
  const rawCatId = initialRecurringData?.categoryId ?? initialData?.categoryId ?? availableCategories.find(c => c.label === 'Uncategorized')?.id ?? availableCategories[0]?.id ?? '';
  const rawTagIds = initialRecurringData?.tagIds ?? initialData?.tagIds ?? [];
  const rawName = initialRecurringData?.name ?? initialData?.name ?? '';
  const rawStatus = initialRecurringData?.status ?? initialData?.status ?? 'normal';
  const rawDesc = initialRecurringData?.description ?? initialData?.description ?? '';
  const rawTransferAccId = initialRecurringData?.transferAccountId ?? initialData?.transferAccountId ?? accounts.find(a => a.id !== rawAccId)?.id ?? '';
  const rawDebtAccId = initialRecurringData?.debtAccountId ?? initialData?.debtAccountId ?? '';

  const [formData, setFormData] = useState({
    amount: rawAmount ? rawAmount.toString() : '',
    name: rawName,
    date: initialDateStr,
    accountId: rawAccId,
    categoryId: rawCatId,
    tagIds: rawTagIds,
    type: ((initialRecurringData?.type === 'income' || initialData?.type === 'income') ? 'income' : 'expense') as 'expense' | 'income',
    status: rawStatus as TransactionStatus,
    description: rawDesc,
    transferAccountId: rawTransferAccId,
    debtAccountId: rawDebtAccId
  });

  const debtAccounts = useMemo(() => accounts.filter(a => a.type === 'debt'), [accounts]);
  const regularAccounts = useMemo(() => accounts.filter(a => a.type !== 'debt'), [accounts]);

  const selectedAccount = useMemo(() => accounts.find(a => a.id === formData.accountId), [accounts, formData.accountId]);
  const isSelectedAccountShared = Boolean(selectedAccount?.isShared);

  const [myShareRatio, setMyShareRatio] = useState<number>(() => {
    return initialRecurringData?.myShareRatio ?? initialData?.myShareRatio ?? selectedAccount?.defaultMyShareRatio ?? 0.5;
  });

  const [myShareAmount, setMyShareAmount] = useState<string>(() => {
    if (initialRecurringData?.myShareAmount !== undefined) return initialRecurringData.myShareAmount.toString();
    if (initialData?.myShareAmount !== undefined) return initialData.myShareAmount.toString();
    if (rawAmount && selectedAccount?.isShared) {
      const parsed = parseMoney(rawAmount.toString());
      if (parsed > 0) return (parsed * (initialData?.myShareRatio ?? selectedAccount?.defaultMyShareRatio ?? 0.5)).toFixed(2);
    }
    return '';
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
    if (isRecurringContext) {
      return '30'; // Default monthly for recurring transfer
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
        description: t.description || '',
        debtAccountId: t.debtAccountId || '',
        myShareRatio: t.myShareRatio,
        myShareAmount: t.myShareAmount !== undefined ? t.myShareAmount.toString() : ''
      }));
    }
    return [
      { amount: '', type: 'expense', accountId: defaultAcc, categoryId: defaultSubCat, tagsInput: '', description: '', debtAccountId: '', myShareRatio: accounts.find(a => a.id === defaultAcc)?.defaultMyShareRatio ?? 0.5, myShareAmount: '' },
      { amount: '', type: 'expense', accountId: defaultAcc, categoryId: defaultSubCat, tagsInput: '', description: '', debtAccountId: '', myShareRatio: accounts.find(a => a.id === defaultAcc)?.defaultMyShareRatio ?? 0.5, myShareAmount: '' }
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
      { amount: '', type: 'expense', accountId: defaultAcc, categoryId: defaultSubCat, tagsInput: '', description: '', debtAccountId: '' }
    ]);
  };

  const handleRemoveSubTransaction = (index: number) => {
    if (subTransactions.length <= 1) return;
    setSubTransactions(subTransactions.filter((_, i) => i !== index));
  };

  const handleUpdateSubTransaction = (index: number, fields: Partial<SubTransactionItem>) => {
    setSubTransactions(subTransactions.map((st, i) => i === index ? { ...st, ...fields } : st));
  };

  const handleAmountChange = (newAmount: string) => {
    setFormData(prev => ({ ...prev, amount: newAmount }));
    if (isSelectedAccountShared) {
      const parsed = parseMoney(newAmount);
      if (parsed > 0) {
        setMyShareAmount((parsed * myShareRatio).toFixed(2));
      } else {
        setMyShareAmount('');
      }
    }
  };

  const handleAccountChange = (newAccId: string) => {
    const acc = accounts.find(a => a.id === newAccId);
    setFormData(prev => ({ ...prev, accountId: newAccId }));
    if (acc?.isShared) {
      const ratio = acc.defaultMyShareRatio ?? 0.5;
      setMyShareRatio(ratio);
      const parsed = parseMoney(formData.amount);
      if (parsed > 0) {
        setMyShareAmount((parsed * ratio).toFixed(2));
      }
    }
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

  const computeManualDate = (dateStr: string): number => {
    // If modifying an existing transaction and the date day has not been changed:
    if (rawDate && dateStr === initialDateStr) {
      return rawDate;
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const now = new Date();

    // If modifying an existing transaction and the date day was changed to a different day:
    // Preserve the original time of day on the newly selected day
    if (rawDate) {
      const origDate = new Date(rawDate);
      return new Date(
        year,
        month - 1,
        day,
        origDate.getHours(),
        origDate.getMinutes(),
        origDate.getSeconds(),
        origDate.getMilliseconds()
      ).getTime();
    }

    // For brand new transactions:
    const isToday = (
      year === now.getFullYear() &&
      (month - 1) === now.getMonth() &&
      day === now.getDate()
    );

    if (isToday) {
      // New transaction added for today uses current time
      return Date.now();
    }

    // For new transactions added on a past or future date, use start of day (00:00:00) so no artificial noon is added
    return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
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
          date: computeManualDate(formData.date),
          accountId: formData.accountId,
          categoryId: formData.categoryId,
          tagIds: finalTagIds,
          type: formData.type,
          status: formData.status,
          description: formData.description.trim()
        };
        if (formData.debtAccountId) {
          submission.debtAccountId = formData.debtAccountId;
        }
        if (isSelectedAccountShared) {
          const parsedShare = parseMoney(myShareAmount);
          submission.myShareAmount = parsedShare >= 0 ? parsedShare : amount * myShareRatio;
          submission.myShareRatio = myShareRatio;
        }

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

        const sharedDate = computeManualDate(formData.date);
        const groupId = initialData?.groupId || crypto.randomUUID();

        const preparedSubtransactions = [];
        for (let i = 0; i < subTransactions.length; i++) {
          const st = subTransactions[i];
          const amt = parseMoney(st.amount);
          if (amt <= 0) throw new Error(`Sub-transaction #${i + 1} has an invalid amount`);
          if (!st.accountId) throw new Error(`Sub-transaction #${i + 1} requires an account`);

          const stTagIds = await processTags(st.tagsInput);

          const subTx: any = {
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
          };
          if (st.debtAccountId) {
            subTx.debtAccountId = st.debtAccountId;
          }
          const stAcc = accounts.find(a => a.id === st.accountId);
          if (stAcc?.isShared) {
            const parsedShare = parseMoney(st.myShareAmount || '');
            const ratio = st.myShareRatio ?? stAcc.defaultMyShareRatio ?? 0.5;
            subTx.myShareAmount = parsedShare >= 0 && st.myShareAmount ? parsedShare : amt * ratio;
            subTx.myShareRatio = ratio;
          }
          preparedSubtransactions.push(subTx);
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
          const [year, month, day] = formData.date.split('-').map(Number);
          const selectedDate = new Date(year, month - 1, day, 0, 0, 0, 0);

          if (isNaN(selectedDate.getTime())) {
            throw new Error('Please select a valid start date for the recurring transfer.');
          }

          const recurringTransferDoc = {
            name: transferName,
            amount,
            startDate: selectedDate.getTime(),
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
            date: computeManualDate(formData.date),
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

        const [year, month, day] = formData.date.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day, 0, 0, 0, 0);

        if (isNaN(selectedDate.getTime())) {
          throw new Error('Please select a valid start date for the recurring subscription.');
        }

        const recurringDoc: any = {
          name: formData.name.trim(),
          amount,
          startDate: (initialRecurringData?.startDate && formData.date === initialDateStr) 
            ? initialRecurringData.startDate 
            : selectedDate.getTime(),
          accountId: formData.accountId,
          categoryId: formData.categoryId,
          tagIds: finalTagIds,
          type: subscriptionType === 'income' ? ('income' as const) : ('expense' as const),
          status: formData.status,
          description: formData.description.trim(),
          periodicityDays: periodNum,
          active: true
        };
        if (formData.debtAccountId) {
          recurringDoc.debtAccountId = formData.debtAccountId;
        }
        if (isSelectedAccountShared) {
          const parsedShare = parseMoney(myShareAmount);
          recurringDoc.myShareAmount = parsedShare >= 0 ? parsedShare : amount * myShareRatio;
          recurringDoc.myShareRatio = myShareRatio;
        }

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

      {/* Dynamic Tab Mode Selector */}
      {activeModes.length > 1 && (
        <div 
          className={cn(
            "grid bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl gap-1.5",
            activeModes.length === 2 ? "grid-cols-2" : 
            activeModes.length === 3 ? "grid-cols-3" : 
            activeModes.length === 4 ? "grid-cols-4" : "grid-cols-1"
          )} 
          role="tablist"
        >
          {activeModes.includes('single') && (
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
          )}

          {activeModes.includes('group') && (
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
          )}

          {activeModes.includes('transfer') && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'transfer'}
              title={isRecurringContext ? "Recurring Transfer" : "Account Transfer"}
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
          )}

          {activeModes.includes('subscription') && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'subscription'}
              title="Recurring Transaction"
              onClick={() => {
                setMode('subscription');
              }}
              className={cn(
                "py-3 px-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
                mode === 'subscription'
                  ? "bg-amber-600 text-white shadow-sm"
                  : "opacity-40 hover:opacity-100 text-foreground"
              )}
            >
              <Repeat size={18} />
            </button>
          )}
        </div>
      )}

      {/* Active Tab Banner Title */}
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
          <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">
            {isRecurringContext ? 'Recurring Transfer' : 'Account Transfer'}
          </h3>
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
                onChange={e => handleAmountChange(e.target.value)}
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
                  onChange={e => handleAccountChange(e.target.value)}
                  required
                >
                  {accounts.length === 0 && <option value="">No Accounts Available</option>}
                  {regularAccounts.length > 0 && debtAccounts.length > 0 ? (
                    <>
                      <optgroup label="Regular Accounts">
                        {regularAccounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name}{a.isShared ? ' (Shared)' : ''}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Debt Accounts">
                        {debtAccounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.debtDirection === 'receivable' ? 'Receivable' : 'Payable'})
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}{a.isShared ? ' (Shared)' : ''}
                      </option>
                    ))
                  )}
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
                    .filter(c => (!c.type || c.type === 'both' || c.type === formData.type))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </Select>
              </label>
            </div>

            {/* Shared Account Split Control */}
            {isSelectedAccountShared && (
              <div className="p-4 bg-sky-500/5 border border-sky-500/15 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                    <Users size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Shared Account Split</span>
                  </div>
                  <span className="text-[11px] font-semibold opacity-60">
                    Account Total: {formatCurrency(parseMoney(formData.amount) || 0, settings.currency)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {[
                    { label: '50% (Half)', ratio: 0.5 },
                    { label: '100% (Mine)', ratio: 1.0 },
                    { label: 'Custom', ratio: 'custom' }
                  ].map(opt => {
                    const isSelected = opt.ratio === 'custom'
                      ? (myShareRatio !== 0.5 && myShareRatio !== 1.0)
                      : myShareRatio === opt.ratio;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          const parsedTotal = parseMoney(formData.amount) || 0;
                          if (opt.ratio !== 'custom') {
                            setMyShareRatio(opt.ratio as number);
                            setMyShareAmount((parsedTotal * (opt.ratio as number)).toFixed(2));
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          isSelected
                            ? "bg-sky-600 text-white"
                            : "bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 block mb-1">
                      My Share (Personal Expense)
                    </span>
                    <Input
                      placeholder="0.00"
                      value={myShareAmount}
                      onChange={e => {
                        setMyShareAmount(e.target.value);
                        const parsedShare = parseMoney(e.target.value);
                        const parsedTotal = parseMoney(formData.amount) || 0;
                        if (parsedTotal > 0 && parsedShare >= 0) {
                          setMyShareRatio(parsedShare / parsedTotal);
                        }
                      }}
                      className="font-bold text-sm"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 block mb-1">
                      Others' Share
                    </span>
                    <div className="h-10 px-3 flex items-center rounded-xl bg-black/5 dark:bg-white/5 font-semibold text-sm opacity-70">
                      {formatCurrency(
                        Math.max(0, (parseMoney(formData.amount) || 0) - (parseMoney(myShareAmount) || 0)),
                        settings.currency
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-foreground/50 leading-relaxed">
                  Only your share ({formatCurrency(parseMoney(myShareAmount) || 0, settings.currency)}) is counted in your expenses, while the full {formatCurrency(parseMoney(formData.amount) || 0, settings.currency)} is deducted from {selectedAccount?.name}.
                </p>
              </div>
            )}

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Link to Debt</span>
              {debtAccounts.length > 0 ? (
                <Select
                  icon={HandCoins}
                  value={formData.debtAccountId}
                  onChange={e => setFormData({ ...formData, debtAccountId: e.target.value })}
                >
                  <option value="">None</option>
                  {debtAccounts.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.debtDirection === 'receivable' ? 'Receivable - Owed to you' : 'Payable - You owe'})
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-xs text-foreground/40 italic py-1">No debt accounts</p>
              )}
            </label>

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
                        onChange={e => {
                          const val = e.target.value;
                          const stAcc = accounts.find(a => a.id === st.accountId);
                          const ratio = st.myShareRatio ?? stAcc?.defaultMyShareRatio ?? 0.5;
                          const parsed = parseMoney(val);
                          handleUpdateSubTransaction(idx, { 
                            amount: val,
                            myShareAmount: stAcc?.isShared && parsed > 0 ? (parsed * ratio).toFixed(2) : st.myShareAmount
                          });
                        }}
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
                        onChange={e => {
                          const newAccId = e.target.value;
                          const newAcc = accounts.find(a => a.id === newAccId);
                          const ratio = newAcc?.defaultMyShareRatio ?? 0.5;
                          const parsed = parseMoney(st.amount) || 0;
                          handleUpdateSubTransaction(idx, { 
                            accountId: newAccId,
                            myShareRatio: newAcc?.isShared ? ratio : undefined,
                            myShareAmount: newAcc?.isShared && parsed > 0 ? (parsed * ratio).toFixed(2) : undefined
                          });
                        }}
                        required
                      >
                        {accounts.length === 0 && <option value="">No Accounts Available</option>}
                        {regularAccounts.length > 0 && debtAccounts.length > 0 ? (
                          <>
                            <optgroup label="Regular Accounts">
                              {regularAccounts.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.name}{a.isShared ? ' (Shared)' : ''}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Debt Accounts">
                              {debtAccounts.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({a.debtDirection === 'receivable' ? 'Receivable' : 'Payable'})
                                </option>
                              ))}
                            </optgroup>
                          </>
                        ) : (
                          accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name}{a.isShared ? ' (Shared)' : ''}
                            </option>
                          ))
                        )}
                      </Select>
                    </label>

                    {/* Shared Account Split for this sub-transaction */}
                    {accounts.find(a => a.id === st.accountId)?.isShared && (
                      <div className="p-3 bg-sky-500/5 border border-sky-500/15 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                            <Users size={13} /> Shared Split (My Share)
                          </span>
                          <span className="text-[10px] font-semibold opacity-60">
                            Item: {formatCurrency(parseMoney(st.amount) || 0, settings.currency)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {[
                            { label: '50% (Half)', ratio: 0.5 },
                            { label: '100% (Mine)', ratio: 1.0 }
                          ].map(opt => {
                            const stAcc = accounts.find(a => a.id === st.accountId);
                            const currentRatio = st.myShareRatio ?? stAcc?.defaultMyShareRatio ?? 0.5;
                            const isSelected = currentRatio === opt.ratio;
                            return (
                              <button
                                key={opt.label}
                                type="button"
                                onClick={() => {
                                  const amt = parseMoney(st.amount) || 0;
                                  handleUpdateSubTransaction(idx, {
                                    myShareRatio: opt.ratio,
                                    myShareAmount: (amt * opt.ratio).toFixed(2)
                                  });
                                }}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                                  isSelected
                                    ? "bg-sky-600 text-white"
                                    : "bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}

                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[9px] font-bold opacity-40 uppercase">My share:</span>
                            <Input
                              placeholder="0.00"
                              value={st.myShareAmount ?? ''}
                              onChange={e => {
                                const val = e.target.value;
                                const parsedShare = parseMoney(val);
                                const amt = parseMoney(st.amount) || 0;
                                handleUpdateSubTransaction(idx, {
                                  myShareAmount: val,
                                  myShareRatio: amt > 0 && parsedShare >= 0 ? parsedShare / amt : undefined
                                });
                              }}
                              className="h-7 text-xs font-bold w-20 py-0 text-center"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Category</span>
                      <Select
                        icon={Layers}
                        value={st.categoryId}
                        onChange={e => handleUpdateSubTransaction(idx, { categoryId: e.target.value })}
                        required
                      >
                        {availableCategories
                          .filter(c => (!c.type || c.type === 'both' || c.type === st.type))
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                      </Select>
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1.5 block">Link to Debt</span>
                      {debtAccounts.length > 0 ? (
                        <Select
                          icon={HandCoins}
                          value={st.debtAccountId || ''}
                          onChange={e => handleUpdateSubTransaction(idx, { debtAccountId: e.target.value })}
                        >
                          <option value="">None</option>
                          {debtAccounts.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.debtDirection === 'receivable' ? 'Receivable - Owed to you' : 'Payable - You owe'})
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <p className="text-xs text-foreground/40 italic py-1">No debt accounts</p>
                      )}
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
                  {regularAccounts.length > 0 && debtAccounts.length > 0 ? (
                    <>
                      <optgroup label="Regular Accounts">
                        {regularAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Debt Accounts">
                        {debtAccounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.debtDirection === 'receivable' ? 'Receivable' : 'Payable'})
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))
                  )}
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
                  {regularAccounts.length > 0 && debtAccounts.length > 0 ? (
                    <>
                      <optgroup label="Regular Accounts">
                        {regularAccounts.map(a => (
                          <option key={a.id} value={a.id} disabled={a.id === formData.accountId}>
                            {a.name} {a.id === formData.accountId ? '(Current Source)' : ''}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Debt Accounts">
                        {debtAccounts.map(a => (
                          <option key={a.id} value={a.id} disabled={a.id === formData.accountId}>
                            {a.name} ({a.debtDirection === 'receivable' ? 'Receivable' : 'Payable'}) {a.id === formData.accountId ? '(Current Source)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    accounts.map(a => (
                      <option key={a.id} value={a.id} disabled={a.id === formData.accountId}>
                        {a.name} {a.id === formData.accountId ? '(Current Source)' : ''}
                      </option>
                    ))
                  )}
                </Select>
              </label>
            </div>

            {isRecurringContext ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                      Start Date
                    </span>
                    <Input 
                      type="date" 
                      icon={Calendar}
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Transfer Periodicity</span>
                    <Select 
                      icon={Repeat}
                      value={transferPeriodicity}
                      onChange={e => {
                        setTransferPeriodicity(e.target.value);
                      }}
                    >
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
              </>
            ) : (
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
                onChange={e => handleAmountChange(e.target.value)}
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
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                  Start Date
                </span>
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
                  onChange={e => handleAccountChange(e.target.value)}
                  required
                >
                  {accounts.length === 0 && <option value="">No Accounts Available</option>}
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.isShared ? ' (Shared)' : ''}
                    </option>
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
                    .filter(c => (!c.type || c.type === 'both' || c.type === subscriptionType))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </Select>
              </label>
            </div>

            {/* Shared Account Split for Subscription */}
            {isSelectedAccountShared && (
              <div className="p-4 bg-sky-500/5 border border-sky-500/15 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                    <Users size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Shared Recurring Split</span>
                  </div>
                  <span className="text-[11px] font-semibold opacity-60">
                    Account Total: {formatCurrency(parseMoney(formData.amount) || 0, settings.currency)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {[
                    { label: '50% (Half)', ratio: 0.5 },
                    { label: '100% (Mine)', ratio: 1.0 },
                    { label: 'Custom', ratio: 'custom' }
                  ].map(opt => {
                    const isSelected = opt.ratio === 'custom'
                      ? (myShareRatio !== 0.5 && myShareRatio !== 1.0)
                      : myShareRatio === opt.ratio;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          const parsedTotal = parseMoney(formData.amount) || 0;
                          if (opt.ratio !== 'custom') {
                            setMyShareRatio(opt.ratio as number);
                            setMyShareAmount((parsedTotal * (opt.ratio as number)).toFixed(2));
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          isSelected
                            ? "bg-sky-600 text-white"
                            : "bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 block mb-1">
                      My Share (Monthly Expected)
                    </span>
                    <Input
                      placeholder="0.00"
                      value={myShareAmount}
                      onChange={e => {
                        setMyShareAmount(e.target.value);
                        const parsedShare = parseMoney(e.target.value);
                        const parsedTotal = parseMoney(formData.amount) || 0;
                        if (parsedTotal > 0 && parsedShare >= 0) {
                          setMyShareRatio(parsedShare / parsedTotal);
                        }
                      }}
                      className="font-bold text-sm"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 block mb-1">
                      Others' Share
                    </span>
                    <div className="h-10 px-3 flex items-center rounded-xl bg-black/5 dark:bg-white/5 font-semibold text-sm opacity-70">
                      {formatCurrency(
                        Math.max(0, (parseMoney(formData.amount) || 0) - (parseMoney(myShareAmount) || 0)),
                        settings.currency
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-foreground/50 leading-relaxed">
                  Only your share ({formatCurrency(parseMoney(myShareAmount) || 0, settings.currency)}) is counted in your expected monthly {subscriptionType === 'income' ? 'gains' : 'expenses'}.
                </p>
              </div>
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
              ? (isRecurringContext
                  ? (initialRecurringData ? 'Update Recurring Transfer' : 'Create Recurring Transfer')
                  : (initialData ? 'Update Transfer' : 'Execute Transfer'))
              : mode === 'subscription'
                ? (initialRecurringData ? 'Update Recurring Rule' : 'Create Recurring Rule')
                : (initialData ? 'Update Transaction' : 'Record Transaction')}
      </Button>
    </form>
  );
}
