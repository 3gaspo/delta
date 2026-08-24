import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  Account, Transaction, RecurringTransaction, Category, Tag, UserSettings, DataContextValue 
} from '../types';
import { useAuth } from './AuthProvider';
import { db, firebaseReady } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, 
  writeBatch, getDocs 
} from 'firebase/firestore';
import { generateDueTransactions } from '../utils/recurring';

const DataContext = createContext<DataContextValue | undefined>(undefined);

const DEFAULT_SETTINGS: UserSettings = {
  darkMode: false,
  currency: 'EUR',
  initialized: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const CHART_COLORS = [
  '#000000', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'
];

const DEFAULT_CATEGORIES = [
  { label: 'Uncategorized', type: 'both', color: CHART_COLORS[0] },
  { label: 'Food', type: 'expense', color: CHART_COLORS[1] },
  { label: 'Transport', type: 'expense', color: CHART_COLORS[2] },
  { label: 'Housing', type: 'expense', color: CHART_COLORS[3] },
  { label: 'Health', type: 'expense', color: CHART_COLORS[4] },
  { label: 'Leisure', type: 'expense', color: CHART_COLORS[5] },
  { label: 'Salary', type: 'income', color: CHART_COLORS[6] },
];

const DEFAULT_TAGS = [
  { label: 'Essential' },
  { label: 'Optional' },
];

const dedupeCategories = (cats: Category[]): Category[] => {
  const seen = new Set<string>();
  const result: Category[] = [];
  for (const c of cats) {
    const key = (c.label || '').trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }
  return result;
};

const sortAccounts = (accs: Account[]): Account[] => {
  return [...accs].sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : 999999;
    const orderB = b.order !== undefined ? b.order : 999999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<{
    accounts: Account[];
    transactions: Transaction[];
    recurringTransactions: RecurringTransaction[];
    categories: Category[];
    tags: Tag[];
    settings: UserSettings;
  }>({
    accounts: [],
    transactions: [],
    recurringTransactions: [],
    categories: [],
    tags: [],
    settings: DEFAULT_SETTINGS
  });
  const [loading, setLoading] = useState(true);

  // Sync state helper
  const seedDefaults = useCallback(async (uid: string) => {
    const now = Date.now();

    const categories: Category[] = DEFAULT_CATEGORIES.map(c => ({
      ...c,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    })) as Category[];

    const tags: Tag[] = DEFAULT_TAGS.map(t => ({
      ...t,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    })) as Tag[];

    const settings: UserSettings = {
      ...DEFAULT_SETTINGS,
      initialized: true,
      updatedAt: now
    };

    if (firebaseReady && db) {
      const batch = writeBatch(db);
      categories.forEach(c => batch.set(doc(db, `users/${uid}/categories`, c.id), c));
      tags.forEach(t => batch.set(doc(db, `users/${uid}/tags`, t.id), t));
      batch.set(doc(db, `users/${uid}/settings`, 'main'), settings);
      await batch.commit();
    } else {
      localStorage.setItem(`delta_${uid}_accounts`, JSON.stringify([]));
      localStorage.setItem(`delta_${uid}_categories`, JSON.stringify(categories));
      localStorage.setItem(`delta_${uid}_tags`, JSON.stringify(tags));
      localStorage.setItem(`delta_${uid}_settings`, JSON.stringify(settings));
      localStorage.setItem(`delta_${uid}_transactions`, JSON.stringify([]));
      localStorage.setItem(`delta_${uid}_recurring`, JSON.stringify([]));
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const uid = user.uid;
    setLoading(true);

    if (firebaseReady && db) {
      // Firebase Subscriptions
      const unsubAccounts = onSnapshot(collection(db, `users/${uid}/accounts`), (snap) => {
        const accounts = sortAccounts(snap.docs.map(d => d.data() as Account));
        setData(prev => ({ ...prev, accounts }));
      });

      const unsubTransactions = onSnapshot(collection(db, `users/${uid}/transactions`), (snap) => {
        const transactions = snap.docs.map(d => d.data() as Transaction);
        setData(prev => ({ ...prev, transactions }));
      });

      const unsubRecurring = onSnapshot(collection(db, `users/${uid}/recurring`), (snap) => {
        const recurringTransactions = snap.docs.map(d => d.data() as RecurringTransaction);
        setData(prev => ({ ...prev, recurringTransactions }));
      });

      const unsubCategories = onSnapshot(collection(db, `users/${uid}/categories`), (snap) => {
        const categories = snap.docs.map(d => d.data() as Category);
        setData(prev => ({ ...prev, categories: dedupeCategories(categories) }));
      });

      const unsubTags = onSnapshot(collection(db, `users/${uid}/tags`), (snap) => {
        const tags = snap.docs.map(d => d.data() as Tag);
        setData(prev => ({ ...prev, tags }));
      });

      const unsubSettings = onSnapshot(doc(db, `users/${uid}/settings`, 'main'), (snap) => {
        if (snap.exists()) {
          setData(prev => ({ ...prev, settings: snap.data() as UserSettings }));
        } else {
          seedDefaults(uid);
        }
      });

      setLoading(false);
      return () => {
        unsubAccounts();
        unsubTransactions();
        unsubRecurring();
        unsubCategories();
        unsubTags();
        unsubSettings();
      };
    } else {
      // Local Storage
      const loadLocal = () => {
        const s = localStorage.getItem(`delta_${uid}_settings`);
        if (!s) {
          seedDefaults(uid).then(loadLocal);
          return;
        }
        setData({
          accounts: sortAccounts(JSON.parse(localStorage.getItem(`delta_${uid}_accounts`) || '[]')),
          transactions: JSON.parse(localStorage.getItem(`delta_${uid}_transactions`) || '[]'),
          recurringTransactions: JSON.parse(localStorage.getItem(`delta_${uid}_recurring`) || '[]'),
          categories: dedupeCategories(JSON.parse(localStorage.getItem(`delta_${uid}_categories`) || '[]')),
          tags: JSON.parse(localStorage.getItem(`delta_${uid}_tags`) || '[]'),
          settings: JSON.parse(s)
        });
        setLoading(false);
      };
      loadLocal();
    }
  }, [user, authLoading, seedDefaults]);

  // Migration & Auto-generate recurring transactions
  useEffect(() => {
    if (!user || loading) return;

    const uid = user.uid;
    const now = Date.now();

    // Check for legacy transactions that were stored as recurring rules in transactions table
    const legacyRecurring = data.transactions.filter(
      t => (t.type === 'subscription' || (t.periodicityDays && t.periodicityDays > 0)) && !t.recurringId
    );

    if (legacyRecurring.length > 0) {
      const migrateLegacy = async () => {
        const newRecurringRules: RecurringTransaction[] = [];
        const updatedTransactions: Transaction[] = [];

        for (const t of legacyRecurring) {
          const ruleId = crypto.randomUUID();
          const pDays = t.periodicityDays || 30;
          const ruleType = t.type === 'subscription' ? 'expense' : t.type;

          newRecurringRules.push({
            id: ruleId,
            name: t.name,
            amount: t.amount,
            startDate: t.date,
            periodicityDays: pDays,
            accountId: t.accountId,
            transferAccountId: t.transferAccountId,
            categoryId: t.categoryId,
            tagIds: t.tagIds || [],
            type: ruleType,
            status: t.status || 'normal',
            description: t.description || '',
            lastGeneratedDate: t.lastGeneratedDate || t.date,
            active: true,
            createdAt: t.createdAt || now,
            updatedAt: now
          });

          // Convert original transaction to a normal occurrence
          updatedTransactions.push({
            ...t,
            type: ruleType,
            recurringId: ruleId,
            periodicityDays: undefined,
            lastGeneratedDate: undefined,
            updatedAt: now
          });
        }

        if (firebaseReady && db && user) {
          const batch = writeBatch(db);
          newRecurringRules.forEach(r => {
            batch.set(doc(db, `users/${uid}/recurring`, r.id), r);
          });
          updatedTransactions.forEach(ut => {
            batch.set(doc(db, `users/${uid}/transactions`, ut.id), ut);
          });
          await batch.commit();
        } else {
          const existingRec = JSON.parse(localStorage.getItem(`delta_${uid}_recurring`) || '[]');
          const updatedRec = [...existingRec, ...newRecurringRules];
          localStorage.setItem(`delta_${uid}_recurring`, JSON.stringify(updatedRec));

          const existingTx = JSON.parse(localStorage.getItem(`delta_${uid}_transactions`) || '[]');
          const updatedTx = existingTx.map((tx: any) => {
            const found = updatedTransactions.find(u => u.id === tx.id);
            return found || tx;
          });
          localStorage.setItem(`delta_${uid}_transactions`, JSON.stringify(updatedTx));

          setData(prev => ({
            ...prev,
            recurringTransactions: updatedRec,
            transactions: updatedTx
          }));
        }
      };

      migrateLegacy();
      return;
    }

    // Standard auto-generator for active recurring transactions
    if (data.recurringTransactions.length === 0) return;

    const newTransactionsToCreate: Transaction[] = [];
    const recurringUpdates: { id: string; lastGeneratedDate: number }[] = [];

    for (const rule of data.recurringTransactions) {
      if (rule.active === false) continue;

      const { newTransactions, updatedLastGeneratedDate } = generateDueTransactions(
        rule,
        now,
        data.transactions
      );

      if (newTransactions.length > 0) {
        newTransactionsToCreate.push(...newTransactions);
        recurringUpdates.push({
          id: rule.id,
          lastGeneratedDate: updatedLastGeneratedDate
        });
      }
    }

    if (newTransactionsToCreate.length > 0) {
      const processRecurring = async () => {
        if (firebaseReady && db && user) {
          const batch = writeBatch(db);
          newTransactionsToCreate.forEach(nt => {
            batch.set(doc(db, `users/${uid}/transactions`, nt.id), nt);
          });
          recurringUpdates.forEach(ru => {
            batch.update(doc(db, `users/${uid}/recurring`, ru.id), { 
              lastGeneratedDate: ru.lastGeneratedDate, 
              updatedAt: Date.now() 
            });
          });
          await batch.commit();
        } else {
          const existingTx = JSON.parse(localStorage.getItem(`delta_${uid}_transactions`) || '[]');
          const updatedTx = [...existingTx, ...newTransactionsToCreate];
          localStorage.setItem(`delta_${uid}_transactions`, JSON.stringify(updatedTx));

          const existingRec = JSON.parse(localStorage.getItem(`delta_${uid}_recurring`) || '[]');
          const updatedRec = existingRec.map((item: any) => {
            const upd = recurringUpdates.find(u => u.id === item.id);
            return upd ? { ...item, lastGeneratedDate: upd.lastGeneratedDate, updatedAt: Date.now() } : item;
          });
          localStorage.setItem(`delta_${uid}_recurring`, JSON.stringify(updatedRec));

          setData(prev => ({ 
            ...prev, 
            transactions: updatedTx,
            recurringTransactions: updatedRec
          }));
        }
      };
      processRecurring();
    }
  }, [data.transactions, data.recurringTransactions, user, loading]);

  const cleanData = (obj: any) => {
    const clean: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        clean[key] = obj[key];
      }
    });
    return clean;
  };

  // Actions
  const addTransaction = async (t: any) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const docData = cleanData({ ...t, id, createdAt: now, updatedAt: now });
    if (firebaseReady && db && user) {
      await setDoc(doc(db, `users/${user.uid}/transactions`, id), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updated = [...existing, docData];
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updated));
      setData(prev => ({ ...prev, transactions: updated }));
    }
  };

  const updateTransaction = async (id: string, t: any) => {
    const now = Date.now();
    const docData = cleanData({ ...t, updatedAt: now });
    if (firebaseReady && db && user) {
      await updateDoc(doc(db, `users/${user.uid}/transactions`, id), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updated = existing.map((item: any) => item.id === id ? { ...item, ...t, updatedAt: now } : item);
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updated));
      setData(prev => ({ ...prev, transactions: updated }));
    }
  };

  const deleteTransaction = async (id: string) => {
    if (firebaseReady && db && user) {
      await deleteDoc(doc(db, `users/${user.uid}/transactions`, id));
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updated = existing.filter((item: any) => item.id !== id);
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updated));
      setData(prev => ({ ...prev, transactions: updated }));
    }
  };

  // Recurring Actions
  const addRecurringTransaction = async (r: any) => {
    if (!user) return;
    const id = crypto.randomUUID();
    const now = Date.now();

    const rule: RecurringTransaction = {
      ...cleanData(r),
      id,
      active: r.active !== undefined ? r.active : true,
      createdAt: now,
      updatedAt: now
    };

    // Immediately generate any past/current occurrences up to now
    const { newTransactions, updatedLastGeneratedDate } = generateDueTransactions(
      rule,
      now,
      data.transactions
    );

    rule.lastGeneratedDate = updatedLastGeneratedDate;

    if (firebaseReady && db) {
      const batch = writeBatch(db);
      batch.set(doc(db, `users/${user.uid}/recurring`, id), rule);
      newTransactions.forEach(nt => {
        batch.set(doc(db, `users/${user.uid}/transactions`, nt.id), nt);
      });
      await batch.commit();
    } else {
      const existingRec = JSON.parse(localStorage.getItem(`delta_${user.uid}_recurring`) || '[]');
      const updatedRec = [...existingRec, rule];
      localStorage.setItem(`delta_${user.uid}_recurring`, JSON.stringify(updatedRec));

      const existingTx = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updatedTx = [...existingTx, ...newTransactions];
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updatedTx));

      setData(prev => ({
        ...prev,
        recurringTransactions: updatedRec,
        transactions: updatedTx
      }));
    }
  };

  const updateRecurringTransaction = async (id: string, r: any) => {
    if (!user) return;
    const now = Date.now();
    const currentRule = data.recurringTransactions.find(item => item.id === id);
    if (!currentRule) return;

    const updatedRule: RecurringTransaction = {
      ...currentRule,
      ...cleanData(r),
      updatedAt: now
    };

    // Check if new occurrences are due
    const { newTransactions, updatedLastGeneratedDate } = generateDueTransactions(
      updatedRule,
      now,
      data.transactions
    );

    updatedRule.lastGeneratedDate = updatedLastGeneratedDate;

    if (firebaseReady && db) {
      const batch = writeBatch(db);
      batch.set(doc(db, `users/${user.uid}/recurring`, id), updatedRule);
      newTransactions.forEach(nt => {
        batch.set(doc(db, `users/${user.uid}/transactions`, nt.id), nt);
      });
      await batch.commit();
    } else {
      const existingRec = JSON.parse(localStorage.getItem(`delta_${user.uid}_recurring`) || '[]');
      const updatedRec = existingRec.map((item: any) => item.id === id ? updatedRule : item);
      localStorage.setItem(`delta_${user.uid}_recurring`, JSON.stringify(updatedRec));

      const existingTx = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updatedTx = [...existingTx, ...newTransactions];
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updatedTx));

      setData(prev => ({
        ...prev,
        recurringTransactions: updatedRec,
        transactions: updatedTx
      }));
    }
  };

  const deleteRecurringTransaction = async (id: string, deleteGeneratedHistory: boolean = false) => {
    if (!user) return;

    if (firebaseReady && db) {
      const batch = writeBatch(db);
      batch.delete(doc(db, `users/${user.uid}/recurring`, id));
      if (deleteGeneratedHistory) {
        const related = data.transactions.filter(t => t.recurringId === id);
        related.forEach(t => {
          batch.delete(doc(db, `users/${user.uid}/transactions`, t.id));
        });
      }
      await batch.commit();
    } else {
      const existingRec = JSON.parse(localStorage.getItem(`delta_${user.uid}_recurring`) || '[]');
      const updatedRec = existingRec.filter((item: any) => item.id !== id);
      localStorage.setItem(`delta_${user.uid}_recurring`, JSON.stringify(updatedRec));

      let updatedTx = data.transactions;
      if (deleteGeneratedHistory) {
        const existingTx = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
        updatedTx = existingTx.filter((t: any) => t.recurringId !== id);
        localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updatedTx));
      }

      setData(prev => ({
        ...prev,
        recurringTransactions: updatedRec,
        transactions: updatedTx
      }));
    }
  };

  const saveGroupTransaction = async (groupId: string, subtransactions: any[]) => {
    if (!user) return;
    const now = Date.now();
    const existingGroupDocs = data.transactions.filter(t => t.groupId === groupId);
    const existingIds = new Set<string>(existingGroupDocs.map((t: any) => t.id));
    
    const newGroupDocs: any[] = [];
    const keptIds = new Set<string>();

    subtransactions.forEach(st => {
      const id = st.id || crypto.randomUUID();
      keptIds.add(id);
      newGroupDocs.push(cleanData({
        ...st,
        id,
        groupId,
        createdAt: st.createdAt || now,
        updatedAt: now
      }));
    });

    const deletedIds: string[] = [...existingIds].filter(id => !keptIds.has(id));

    if (firebaseReady && db && user) {
      const batch = writeBatch(db);
      newGroupDocs.forEach(docData => {
        batch.set(doc(db, `users/${user.uid}/transactions`, docData.id), docData);
      });
      deletedIds.forEach((id: string) => {
        batch.delete(doc(db, `users/${user.uid}/transactions`, id));
      });
      await batch.commit();
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const filtered = existing.filter((item: any) => !deletedIds.includes(item.id) && item.groupId !== groupId);
      const updated = [...filtered, ...newGroupDocs];
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updated));
      setData(prev => ({ ...prev, transactions: updated }));
    }
  };

  const deleteGroupTransaction = async (groupId: string) => {
    if (!user) return;
    const groupDocs = data.transactions.filter(t => t.groupId === groupId);
    const ids = groupDocs.map(t => t.id);
    if (ids.length === 0) return;

    if (firebaseReady && db && user) {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.delete(doc(db, `users/${user.uid}/transactions`, id));
      });
      await batch.commit();
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updated = existing.filter((item: any) => item.groupId !== groupId);
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updated));
      setData(prev => ({ ...prev, transactions: updated }));
    }
  };

  const addAccount = async (a: any) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const order = a.order !== undefined ? a.order : data.accounts.length;
    const docData = cleanData({ ...a, id, order, createdAt: now, updatedAt: now });
    if (firebaseReady && db && user) {
      await setDoc(doc(db, `users/${user.uid}/accounts`, id), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_accounts`) || '[]');
      const updated = sortAccounts([...existing, docData]);
      localStorage.setItem(`delta_${user.uid}_accounts`, JSON.stringify(updated));
      setData(prev => ({ ...prev, accounts: updated }));
    }
    return docData;
  };

  const updateAccount = async (id: string, a: any) => {
    const now = Date.now();
    const docData = cleanData({ ...a, updatedAt: now });
    if (firebaseReady && db && user) {
      await updateDoc(doc(db, `users/${user.uid}/accounts`, id), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_accounts`) || '[]');
      const updated = sortAccounts(existing.map((item: any) => item.id === id ? { ...item, ...a, updatedAt: now } : item));
      localStorage.setItem(`delta_${user.uid}_accounts`, JSON.stringify(updated));
      setData(prev => ({ ...prev, accounts: updated }));
    }
  };

  const reorderAccounts = async (orderedAccounts: { id: string; order: number }[]) => {
    if (!user) return;
    const now = Date.now();
    if (firebaseReady && db) {
      const batch = writeBatch(db);
      orderedAccounts.forEach(({ id, order }) => {
        batch.update(doc(db, `users/${user.uid}/accounts`, id), { order, updatedAt: now });
      });
      await batch.commit();
    } else {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_accounts`) || '[]');
      const orderMap = new Map(orderedAccounts.map(o => [o.id, o.order]));
      const updated = existing.map((item: any) => {
        if (orderMap.has(item.id)) {
          return { ...item, order: orderMap.get(item.id), updatedAt: now };
        }
        return item;
      });
      const sorted = sortAccounts(updated);
      localStorage.setItem(`delta_${user.uid}_accounts`, JSON.stringify(sorted));
      setData(prev => ({ ...prev, accounts: sorted }));
    }
  };

  const deleteAccount = async (id: string) => {
    if (firebaseReady && db && user) {
      const batch = writeBatch(db);
      // Delete the account
      batch.delete(doc(db, `users/${user.uid}/accounts`, id));

      // Cascade delete associated transactions
      const txsToDelete = data.transactions.filter(t => t.accountId === id || t.transferAccountId === id);
      txsToDelete.forEach(t => {
        batch.delete(doc(db, `users/${user.uid}/transactions`, t.id));
      });

      // Cascade delete associated recurring transactions
      const recsToDelete = data.recurringTransactions.filter(r => r.accountId === id || r.transferAccountId === id);
      recsToDelete.forEach(r => {
        batch.delete(doc(db, `users/${user.uid}/recurring`, r.id));
      });

      await batch.commit();
    } else if (user) {
      const existingAccounts = JSON.parse(localStorage.getItem(`delta_${user.uid}_accounts`) || '[]');
      const updatedAccounts = existingAccounts.filter((item: any) => item.id !== id);
      localStorage.setItem(`delta_${user.uid}_accounts`, JSON.stringify(updatedAccounts));

      const existingTxs = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updatedTxs = existingTxs.filter((item: any) => item.accountId !== id && item.transferAccountId !== id);
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updatedTxs));

      const existingRecs = JSON.parse(localStorage.getItem(`delta_${user.uid}_recurring`) || '[]');
      const updatedRecs = existingRecs.filter((item: any) => item.accountId !== id && item.transferAccountId !== id);
      localStorage.setItem(`delta_${user.uid}_recurring`, JSON.stringify(updatedRecs));

      setData(prev => ({ 
        ...prev, 
        accounts: updatedAccounts,
        transactions: updatedTxs,
        recurringTransactions: updatedRecs
      }));
    }
  };

  const addCategory = async (c: any) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const color = c.color || CHART_COLORS[data.categories.length % CHART_COLORS.length];
    const docData = cleanData({ ...c, id, color, createdAt: now, updatedAt: now });
    if (firebaseReady && db && user) {
      await setDoc(doc(db, `users/${user.uid}/categories`, id), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_categories`) || '[]');
      const updated = [...existing, docData];
      localStorage.setItem(`delta_${user.uid}_categories`, JSON.stringify(updated));
      setData(prev => ({ ...prev, categories: updated }));
    }
  };

  const updateCategory = async (id: string, c: any) => {
    const now = Date.now();
    const docData = cleanData({ ...c, updatedAt: now });
    if (firebaseReady && db && user) {
      await updateDoc(doc(db, `users/${user.uid}/categories`, id), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_categories`) || '[]');
      const updated = existing.map((item: any) => item.id === id ? { ...item, ...c, updatedAt: now } : item);
      localStorage.setItem(`delta_${user.uid}_categories`, JSON.stringify(updated));
      setData(prev => ({ ...prev, categories: updated }));
    }
  };

  const deleteCategory = async (id: string) => {
    // Reassign transactions to Uncategorized
    const defaultCat = data.categories.find(c => c.label === 'Uncategorized');
    const uncategorizedId = defaultCat?.id || crypto.randomUUID();
    
    if (firebaseReady && db && user) {
      const batch = writeBatch(db);
      const affected = data.transactions.filter(t => t.categoryId === id);
      affected.forEach(t => {
        batch.update(doc(db, `users/${user.uid}/transactions`, t.id), { categoryId: uncategorizedId });
      });
      const affectedRecurring = data.recurringTransactions.filter(r => r.categoryId === id);
      affectedRecurring.forEach(r => {
        batch.update(doc(db, `users/${user.uid}/recurring`, r.id), { categoryId: uncategorizedId });
      });
      batch.delete(doc(db, `users/${user.uid}/categories`, id));
      await batch.commit();
    } else if (user) {
      const transactions = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updatedTransactions = transactions.map((t: any) => t.categoryId === id ? { ...t, categoryId: uncategorizedId } : t);
      const recurring = JSON.parse(localStorage.getItem(`delta_${user.uid}_recurring`) || '[]');
      const updatedRecurring = recurring.map((r: any) => r.categoryId === id ? { ...r, categoryId: uncategorizedId } : r);
      const categories = JSON.parse(localStorage.getItem(`delta_${user.uid}_categories`) || '[]');
      const updatedCategories = categories.filter((c: any) => c.id !== id);
      
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updatedTransactions));
      localStorage.setItem(`delta_${user.uid}_recurring`, JSON.stringify(updatedRecurring));
      localStorage.setItem(`delta_${user.uid}_categories`, JSON.stringify(updatedCategories));
      setData(prev => ({ ...prev, transactions: updatedTransactions, recurringTransactions: updatedRecurring, categories: updatedCategories }));
    }
  };

  const addTag = async (t: any) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const docData = cleanData({ ...t, id, createdAt: now, updatedAt: now });
    if (firebaseReady && db && user) {
      await setDoc(doc(db, `users/${user.uid}/tags`, id), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_tags`) || '[]');
      const updated = [...existing, docData];
      localStorage.setItem(`delta_${user.uid}_tags`, JSON.stringify(updated));
      setData(prev => ({ ...prev, tags: updated }));
    }
  };

  const updateTag = async (id: string, t: any) => {
    const now = Date.now();
    const docData = cleanData({ ...t, updatedAt: now });
    if (firebaseReady && db && user) {
      await updateDoc(doc(db, `users/${user.uid}/tags`, id), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_tags`) || '[]');
      const updated = existing.map((item: any) => item.id === id ? { ...item, ...t, updatedAt: now } : item);
      localStorage.setItem(`delta_${user.uid}_tags`, JSON.stringify(updated));
      setData(prev => ({ ...prev, tags: updated }));
    }
  };

  const deleteTag = async (id: string) => {
    if (firebaseReady && db && user) {
      const batch = writeBatch(db);
      const affected = data.transactions.filter(t => t.tagIds.includes(id));
      affected.forEach(t => {
        batch.update(doc(db, `users/${user.uid}/transactions`, t.id), { tagIds: t.tagIds.filter(tid => tid !== id) });
      });
      const affectedRecurring = data.recurringTransactions.filter(r => r.tagIds.includes(id));
      affectedRecurring.forEach(r => {
        batch.update(doc(db, `users/${user.uid}/recurring`, r.id), { tagIds: r.tagIds.filter(tid => tid !== id) });
      });
      batch.delete(doc(db, `users/${user.uid}/tags`, id));
      await batch.commit();
    } else if (user) {
      const transactions = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updatedTransactions = transactions.map((t: any) => ({ ...t, tagIds: (t.tagIds || []).filter((tid: string) => tid !== id) }));
      const recurring = JSON.parse(localStorage.getItem(`delta_${user.uid}_recurring`) || '[]');
      const updatedRecurring = recurring.map((r: any) => ({ ...r, tagIds: (r.tagIds || []).filter((tid: string) => tid !== id) }));
      const tags = JSON.parse(localStorage.getItem(`delta_${user.uid}_tags`) || '[]');
      const updatedTags = tags.filter((t: any) => t.id !== id);
      
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updatedTransactions));
      localStorage.setItem(`delta_${user.uid}_recurring`, JSON.stringify(updatedRecurring));
      localStorage.setItem(`delta_${user.uid}_tags`, JSON.stringify(updatedTags));
      setData(prev => ({ ...prev, transactions: updatedTransactions, recurringTransactions: updatedRecurring, tags: updatedTags }));
    }
  };

  const updateSettings = async (s: any) => {
    const now = Date.now();
    const docData = cleanData({ ...s, updatedAt: now });
    if (firebaseReady && db && user) {
      await updateDoc(doc(db, `users/${user.uid}/settings`, 'main'), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_settings`) || '{}');
      const updated = { ...existing, ...s, updatedAt: now };
      localStorage.setItem(`delta_${user.uid}_settings`, JSON.stringify(updated));
      setData(prev => ({ ...prev, settings: updated }));
    }
  };

  const resetData = async (mode: 'history' | 'all') => {
    if (!user) return;
    const uid = user.uid;
    
    if (firebaseReady && db) {
      const batch = writeBatch(db);
      if (mode === 'history') {
        const snap = await getDocs(collection(db, `users/${uid}/transactions`));
        snap.docs.forEach(d => batch.delete(d.ref));
        const recSnap = await getDocs(collection(db, `users/${uid}/recurring`));
        recSnap.docs.forEach(d => batch.delete(d.ref));
      } else {
        // Full Reset
        const collections = ['transactions', 'recurring', 'accounts', 'categories', 'tags'];
        for (const c of collections) {
          const snap = await getDocs(collection(db, `users/${uid}/${c}`));
          snap.docs.forEach(d => batch.delete(d.ref));
        }
        batch.delete(doc(db, `users/${uid}/settings`, 'main'));
      }
      await batch.commit();
      if (mode === 'all') await seedDefaults(uid);
    } else {
      if (mode === 'history') {
        localStorage.setItem(`delta_${uid}_transactions`, '[]');
        localStorage.setItem(`delta_${uid}_recurring`, '[]');
        setData(prev => ({ ...prev, transactions: [], recurringTransactions: [] }));
      } else {
        localStorage.removeItem(`delta_${uid}_accounts`);
        localStorage.removeItem(`delta_${uid}_transactions`);
        localStorage.removeItem(`delta_${uid}_recurring`);
        localStorage.removeItem(`delta_${uid}_categories`);
        localStorage.removeItem(`delta_${uid}_tags`);
        localStorage.removeItem(`delta_${uid}_settings`);
        await seedDefaults(uid);
      }
    }
  };

  return (
    <DataContext.Provider value={{
      ...data,
      loading,
      addTransaction, updateTransaction, deleteTransaction, saveGroupTransaction, deleteGroupTransaction,
      addRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction,
      addAccount, updateAccount, deleteAccount, reorderAccounts,
      addCategory, updateCategory, deleteCategory,
      addTag, updateTag, deleteTag,
      updateSettings, resetData
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
