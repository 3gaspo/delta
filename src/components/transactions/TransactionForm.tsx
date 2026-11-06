import { splitGroupTotal } from '../../utils/groupExpenses';
import { ACTIONS } from '@3gaspo/app-ui/labels';
import { ValidatedForm } from '../ValidatedForm';
import React, { useState, useMemo, useId } from 'react';
import { useData } from '../../providers/DataProvider';
import { Transaction, RecurringTransaction, TransactionType, TransactionStatus, Category } from '../../types';
import { DialogActions } from '../Dialog';
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
  forWhom?: 'me' | 'others';
  status?: TransactionStatus;
  weight?: string;
  amount: string;
  categoryId: string;
  tagsInput: string;
  description: string;
  debtAccountId?: string;
}

export function TransactionForm({ onClose, initialData, initialRecurringData, defaultMode, allowedModes }: TransactionFormProps) {
  const formId = useId();
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
      if (parsed > 0) return (parsed * (initialRecurringData?.myShareRatio ?? initialData?.myShareRatio ?? selectedAccount?.defaultMyShareRatio ?? 0.5)).toFixed(2);
    }
    return '';
  });

  const [isCustomShare, setIsCustomShare] = useState(() => myShareRatio !== 0.5 && myShareRatio !== 1);

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
  const defaultAcc = regularAccounts.find(a => !a.archived)?.id || 'external';
  const [groupAccountId, setGroupAccountId] = useState(existingGroupSubtransactions[0]?.accountId || defaultAcc);
  const [groupTotal, setGroupTotal] = useState(existingGroupSubtransactions.length ? existingGroupSubtransactions.reduce((n, t) => n + t.amount, 0).toFixed(2) : '');
  const [splitMode, setSplitMode] = useState<'amount' | 'ratio'>(existingGroupSubtransactions.length && existingGroupSubtransactions.every(t => t.splitWeight) ? 'ratio' : 'amount');

  const [subTransactions, setSubTransactions] = useState<SubTransactionItem[]>(() => {
    if (existingGroupSubtransactions.length > 0) {
      return existingGroupSubtransactions.map(t => ({
        id: t.id,
        forWhom: t.forWhom || 'me',
        status: t.status,
        weight: String(t.splitWeight || 1),
        amount: t.amount.toString(),
        categoryId: t.categoryId || defaultSubCat,
        tagsInput: t.tagIds.map(tid => tags.find(tg => tg.id === tid)?.label).filter(Boolean).join(', '),
        description: t.description || '',
        debtAccountId: t.debtAccountId || '',
      }));
    }
    return [
      { amount: '', forWhom: 'me', weight: '1', categoryId: defaultSubCat, tagsInput: '', description: '', debtAccountId: '' },
      { amount: '', forWhom: 'others', weight: '1', categoryId: defaultSubCat, tagsInput: '', description: '', debtAccountId: '' }
    ];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupAmounts = useMemo(() => splitMode === 'ratio'
    ? splitGroupTotal(parseMoney(groupTotal), subTransactions.map(st => parseMoney(st.weight ?? '1')))
    : subTransactions.map(st => parseMoney(st.amount)), [splitMode, groupTotal, subTransactions]);
  const groupTotalAmount = groupAmounts.reduce((sum, n) => sum + n, 0);

  const handleAddSubTransaction = () => {
    setSubTransactions([...subTransactions, { amount: '', weight: '1', forWhom: 'others', categoryId: defaultSubCat, tagsInput: '', description: '', debtAccountId: '' }]);
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
      setIsCustomShare(ratio !== 0.5 && ratio !== 1);
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

    // Keep the creation time on the selected local calendar day for ordering.
    return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).getTime();
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

        if (groupAccountId !== 'external' && !regularAccounts.some(a => a.id === groupAccountId)) throw new Error('Choose a payment account');
        if (splitMode === 'ratio' && parseMoney(groupTotal) <= 0) throw new Error('Enter a total to split by ratio');
        if (groupTotal.trim() && (parseMoney(groupTotal) <= 0 || Math.round(groupTotalAmount * 100) !== Math.round(parseMoney(groupTotal) * 100))) throw new Error('The expenses must add up to the total');
        const preparedSubtransactions = [];
        for (let i = 0; i < subTransactions.length; i++) {
          const st = subTransactions[i];
          const amt = groupAmounts[i];
          if (amt <= 0) throw new Error(`Expense #${i + 1} needs a positive amount`);
          if (!debtAccounts.some(a => a.id === st.debtAccountId)) throw new Error(`Expense #${i + 1} needs a debt account`);
          const forWhom = st.forWhom || 'me';
          preparedSubtransactions.push({
            id: st.id, groupId, name: formData.name.trim(), amount: amt, date: sharedDate,
            accountId: groupAccountId, debtAccountId: st.debtAccountId, forWhom,
            categoryId: forWhom === 'me' ? st.categoryId : '',
            tagIds: forWhom === 'me' ? await processTags(st.tagsInput) : [],
            type: 'expense', status: forWhom === 'me' ? st.status || 'normal' : 'normal',
            description: st.description.trim(),
            ...(splitMode === 'ratio' ? { splitWeight: parseMoney(st.weight ?? '1') } : {}),
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
            debtTransferVersion: initialRecurringData?.debtTransferVersion ?? (initialRecurringData ? undefined : 2 as const),
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
            debtTransferVersion: initialData?.debtTransferVersion ?? (initialData?.type === 'transfer' ? undefined : 2),
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
    <ValidatedForm id={formId} onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div role="alert" className="ui-error p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-semibold">
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
            "ui-tabs grid bg-ui-section p-1.5 rounded-2xl gap-1.5",
            activeModes.length === 2 ? "grid-cols-2" : 
            activeModes.length === 3 ? "grid-cols-3" : 
            activeModes.length === 4 ? "grid-cols-4" : "grid-cols-1"
          )} 
          role="tablist" aria-label="Transaction mode"
          onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
            if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
            const tabs = Array.from(event.currentTarget.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
            const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
            event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click();
          }}
        >
          {activeModes.includes('single') && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'single'} tabIndex={mode === 'single' ? 0 : -1}
              title="Single Transaction"
              onClick={() => setMode('single')}
              className={cn(
                "ui-tab py-3 px-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
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
              aria-selected={mode === 'group'} tabIndex={mode === 'group' ? 0 : -1}
              title="Group Transaction"
              onClick={() => setMode('group')}
              className={cn(
                "ui-tab py-3 px-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
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
              aria-selected={mode === 'transfer'} tabIndex={mode === 'transfer' ? 0 : -1}
              title={isRecurringContext ? "Recurring Transfer" : "Account Transfer"}
              onClick={() => setMode('transfer')}
              className={cn(
                "ui-tab py-3 px-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
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
              aria-selected={mode === 'subscription'} tabIndex={mode === 'subscription' ? 0 : -1}
              title="Recurring Transaction"
              onClick={() => {
                setMode('subscription');
              }}
              className={cn(
                "ui-tab py-3 px-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
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
        <div className="flex items-center gap-3 p-3 bg-ui-section rounded-2xl">
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
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                Transaction Type
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'expense' })}
                  className={"ui-button " + (cn(
                    "py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all",
                    formData.type === 'expense'
                      ? "bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 shadow-sm"
                      : "bg-ui-section border-transparent text-foreground/50 hover:text-foreground"
                  ))}
                >
                  <ArrowUpRight size={16} className={formData.type === 'expense' ? "text-red-500" : ""} />
                  <span>Expense</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'income' })}
                  className={"ui-button " + (cn(
                    "py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all",
                    formData.type === 'income'
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "bg-ui-section border-transparent text-foreground/50 hover:text-foreground"
                  ))}
                >
                  <ArrowDownLeft size={16} className={formData.type === 'income' ? "text-emerald-500" : ""} />
                  <span>Income</span>
                </button>
              </div>
            </div>

            {/* Name */}
            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
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
            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Amount</span>
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
              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Date</span>
                <Input 
                  type="date" 
                  icon={Calendar}
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </label>

              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Status</span>
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
              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Account</span>
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
                            {a.name}
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

              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Category</span>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                    { label: '50%', ratio: 0.5 },
                    { label: '100%', ratio: 1.0 },
                    { label: 'Custom', ratio: 'custom' }
                  ].map(opt => {
                    const isSelected = opt.ratio === 'custom'
                      ? isCustomShare
                      : !isCustomShare && myShareRatio === opt.ratio;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          setIsCustomShare(opt.ratio === 'custom');
                          if (opt.ratio === 'custom') {
                            const input = e.currentTarget.form?.querySelector<HTMLInputElement>('input[aria-label="My share"]');
                            input?.focus();
                            input?.select();
                          }
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
                    <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 block mb-1">
                      My share
                    </span>
                    <Input
                      placeholder="0.00"
                      aria-label="My share"
                      inputMode="decimal"
                      value={myShareAmount}
                      onChange={e => {
                        setIsCustomShare(true);
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
                    <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 block mb-1">
                      Others' Share
                    </span>
                    <div className="h-10 px-3 flex items-center rounded-xl bg-ui-section font-semibold text-sm opacity-70">
                      {formatCurrency(
                        Math.max(0, (parseMoney(formData.amount) || 0) - (parseMoney(myShareAmount) || 0)),
                        settings.currency
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Link to Debt</span>
              {debtAccounts.length > 0 ? (
                <Select
                  icon={HandCoins}
                  value={formData.debtAccountId}
                  onChange={e => setFormData({ ...formData, debtAccountId: e.target.value })}
                >
                  <option value="">None</option>
                  {debtAccounts.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-xs text-foreground/40 italic py-1">No debt accounts</p>
              )}
            </label>

            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Tags (comma separated)</span>
              <Input 
                icon={Tag}
                placeholder="Food, Leisure, Important..."
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
              />
            </label>

            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Additional Description (Optional)</span>
              <Input 
                icon={AlignLeft}
                placeholder="Details about this transaction..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </label>
          </>
        )}

        {/* Group expenses use one payer and explicit personal/debt directions. */}
        {mode === 'group' && (<>
          <label className="ui-field-label block">Group title
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </label>
          <label className="ui-field-label block">Payment account
            <Select value={groupAccountId} onChange={e => setGroupAccountId(e.target.value)} required>
              <option value="external">External</option>
              {regularAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="ui-field-label block">Date
              <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
            </label>
            <label className="ui-field-label block">Total {splitMode === 'amount' ? '(optional)' : ''}
              <Input inputMode="decimal" placeholder="0.00" value={groupTotal} onChange={e => setGroupTotal(e.target.value)} required={splitMode === 'ratio'} />
            </label>
          </div>
          <div className="ui-segments">
            {(['amount', 'ratio'] as const).map(value => <button key={value} className="ui-option" type="button" aria-pressed={splitMode === value} onClick={() => {
              if (value === 'amount' && splitMode === 'ratio') setSubTransactions(subTransactions.map((st, i) => ({ ...st, amount: groupAmounts[i].toFixed(2) })));
              setSplitMode(value);
            }}>{value === 'amount' ? 'Amounts' : 'Ratios'}</button>)}
          </div>
          <div className="space-y-4">
            {subTransactions.map((st, idx) => <fieldset key={idx} className="min-w-0 p-4 bg-ui-section rounded-2xl space-y-3">
              <legend className="ui-field-label px-1">Expense {idx + 1}</legend>
              <div className="flex items-center gap-2">
                <div className="ui-segments flex-1">
                  {(['me', 'others'] as const).map(value => <button key={value} type="button" className="ui-option" aria-pressed={(st.forWhom || 'me') === value} onClick={() => handleUpdateSubTransaction(idx, { forWhom: value })}>{value === 'me' ? 'For me' : 'For others'}</button>)}
                </div>
                <button className="ui-icon-button text-red-500" type="button" aria-label={`Remove expense ${idx + 1}`} disabled={subTransactions.length <= 1} onClick={() => handleRemoveSubTransaction(idx)}><Trash2 size={16} /></button>
              </div>
              <label className="ui-field-label block">{splitMode === 'ratio' ? 'Ratio' : 'Amount'}
                <Input inputMode="decimal" value={splitMode === 'ratio' ? st.weight ?? '1' : st.amount} onChange={e => handleUpdateSubTransaction(idx, splitMode === 'ratio' ? { weight: e.target.value } : { amount: e.target.value })} required />
              </label>
              {splitMode === 'ratio' && <p className="ui-meta">{formatCurrency(groupAmounts[idx], settings.currency)}</p>}
              <label className="ui-field-label block">Debt account
                <Select value={st.debtAccountId || ''} onChange={e => handleUpdateSubTransaction(idx, { debtAccountId: e.target.value })} required>
                  <option value="">Choose account</option>
                  {debtAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </label>
              {(st.forWhom || 'me') === 'me' && <>
                <label className="ui-field-label block">Category
                  <Select value={st.categoryId} onChange={e => handleUpdateSubTransaction(idx, { categoryId: e.target.value })} required>
                    {availableCategories.filter(c => c.type !== 'income').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </label>
                <label className="ui-field-label block">Status
                  <Select value={st.status || 'normal'} onChange={e => handleUpdateSubTransaction(idx, { status: e.target.value as TransactionStatus })}>
                    <option value="normal">Normal</option><option value="pending">Pending</option><option value="hidden">Hidden</option>
                  </Select>
                </label>
                <label className="ui-field-label block">Tags
                  <Input value={st.tagsInput} onChange={e => handleUpdateSubTransaction(idx, { tagsInput: e.target.value })} />
                </label>
              </>}
              <label className="ui-field-label block">Notes
                <Input value={st.description} onChange={e => handleUpdateSubTransaction(idx, { description: e.target.value })} />
              </label>
            </fieldset>)}
          </div>
          <p className="ui-meta">Total: {formatCurrency(groupTotalAmount, settings.currency)}</p>
          <Button type="button" variant="secondary" onClick={handleAddSubTransaction}><Plus size={16} /> Add expense</Button>
        </>)}

        {/* ======================= TAB 3: TRANSFER ======================= */}
        {mode === 'transfer' && (
          <>
            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
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

            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Transfer Amount</span>
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
              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">From Account (Source)</span>
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
                            {a.name}
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

              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">To Account (Destination)</span>
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
                            {a.name} {a.id === formData.accountId ? '(Current Source)' : ''}
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
                  <label className="ui-field-label block">
                    <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
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

                  <label className="ui-field-label block">
                    <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Recurring Period</span>
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
                  <label className="ui-field-label block">
                    <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Repeat Every (Days)</span>
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
              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Date</span>
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
              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Status</span>
                <Select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                >
                  <option value="normal">Normal</option>
                  <option value="pending">Pending</option>
                  <option value="hidden">Hidden</option>
                </Select>
              </label>

              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Tags (comma separated)</span>
                <Input 
                  icon={Tag}
                  placeholder="Savings, Transfer, Internal..."
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                />
              </label>
            </div>

            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Notes / Description (Optional)</span>
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
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
                Subscription Flow
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubscriptionType('expense')}
                  className={"ui-button " + (cn(
                    "py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all",
                    subscriptionType === 'expense'
                      ? "bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 shadow-sm"
                      : "bg-ui-section border-transparent text-foreground/50 hover:text-foreground"
                  ))}
                >
                  <ArrowUpRight size={16} className={subscriptionType === 'expense' ? "text-red-500" : ""} />
                  <span>Recurring Expense</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubscriptionType('income')}
                  className={"ui-button " + (cn(
                    "py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all",
                    subscriptionType === 'income'
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "bg-ui-section border-transparent text-foreground/50 hover:text-foreground"
                  ))}
                >
                  <ArrowDownLeft size={16} className={subscriptionType === 'income' ? "text-emerald-500" : ""} />
                  <span>Recurring Income</span>
                </button>
              </div>
            </div>

            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
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

            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Recurring Amount</span>
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
              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">
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

              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Recurring Period</span>
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
            </div>

            {periodicity === 'custom' && (
              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Repeat Every (Days)</span>
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
              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Account</span>
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

              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Category</span>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                    { label: '50%', ratio: 0.5 },
                    { label: '100%', ratio: 1.0 },
                    { label: 'Custom', ratio: 'custom' }
                  ].map(opt => {
                    const isSelected = opt.ratio === 'custom'
                      ? isCustomShare
                      : !isCustomShare && myShareRatio === opt.ratio;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          setIsCustomShare(opt.ratio === 'custom');
                          if (opt.ratio === 'custom') {
                            const input = e.currentTarget.form?.querySelector<HTMLInputElement>('input[aria-label="My share"]');
                            input?.focus();
                            input?.select();
                          }
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
                    <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 block mb-1">
                      My share
                    </span>
                    <Input
                      placeholder="0.00"
                      aria-label="My share"
                      inputMode="decimal"
                      value={myShareAmount}
                      onChange={e => {
                        setIsCustomShare(true);
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
                    <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 block mb-1">
                      Others' Share
                    </span>
                    <div className="h-10 px-3 flex items-center rounded-xl bg-ui-section font-semibold text-sm opacity-70">
                      {formatCurrency(
                        Math.max(0, (parseMoney(formData.amount) || 0) - (parseMoney(myShareAmount) || 0)),
                        settings.currency
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Status</span>
                <Select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                >
                  <option value="normal">Normal</option>
                  <option value="pending">Pending</option>
                  <option value="hidden">Hidden</option>
                </Select>
              </label>

              <label className="ui-field-label block">
                <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Tags (comma separated)</span>
                <Input 
                  icon={Tag}
                  placeholder="Subscription, Fixed, Essential..."
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                />
              </label>
            </div>

            <label className="ui-field-label block">
              <span className="ui-section-title text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 block">Additional Description (Optional)</span>
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

      <DialogActions form={formId} cancel><Button type="submit" disabled={loading} className="w-full">
        {loading ? ACTIONS.saving : mode === 'transfer' && !isRecurringContext ? 'Transfer' : ACTIONS.save}
      </Button></DialogActions>
    </ValidatedForm>
  );
}
