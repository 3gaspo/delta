import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  Account, Transaction, Category, Tag, UserSettings, DataContextValue 
} from '../types';
import { useAuth } from './AuthProvider';
import { db, firebaseReady } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, 
  query, writeBatch, getDocs, getDoc 
} from 'firebase/firestore';

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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<{
    accounts: Account[],
    transactions: Transaction[],
    categories: Category[],
    tags: Tag[],
    settings: UserSettings
  }>({
    accounts: [],
    transactions: [],
    categories: [],
    tags: [],
    settings: DEFAULT_SETTINGS
  });
  const [loading, setLoading] = useState(true);

  // Sync state helper
  const seedDefaults = useCallback(async (uid: string) => {
    const now = Date.now();
    
    const mainAccount: Account = {
      id: crypto.randomUUID(),
      name: 'Main',
      type: 'regular',
      createdAt: now,
      updatedAt: now,
      order: 0
    };

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
      batch.set(doc(db, `users/${uid}/accounts`, mainAccount.id), mainAccount);
      categories.forEach(c => batch.set(doc(db, `users/${uid}/categories`, c.id), c));
      tags.forEach(t => batch.set(doc(db, `users/${uid}/tags`, t.id), t));
      batch.set(doc(db, `users/${uid}/settings`, 'main'), settings);
      await batch.commit();
    } else {
      localStorage.setItem(`delta_${uid}_accounts`, JSON.stringify([mainAccount]));
      localStorage.setItem(`delta_${uid}_categories`, JSON.stringify(categories));
      localStorage.setItem(`delta_${uid}_tags`, JSON.stringify(tags));
      localStorage.setItem(`delta_${uid}_settings`, JSON.stringify(settings));
      localStorage.setItem(`delta_${uid}_transactions`, JSON.stringify([]));
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
        const accounts = snap.docs.map(d => d.data() as Account);
        setData(prev => ({ ...prev, accounts }));
      });

      const unsubTransactions = onSnapshot(collection(db, `users/${uid}/transactions`), (snap) => {
        const transactions = snap.docs.map(d => d.data() as Transaction);
        setData(prev => ({ ...prev, transactions }));
      });

      const unsubCategories = onSnapshot(collection(db, `users/${uid}/categories`), (snap) => {
        const categories = snap.docs.map(d => d.data() as Category);
        setData(prev => ({ ...prev, categories }));
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
          accounts: JSON.parse(localStorage.getItem(`delta_${uid}_accounts`) || '[]'),
          transactions: JSON.parse(localStorage.getItem(`delta_${uid}_transactions`) || '[]'),
          categories: JSON.parse(localStorage.getItem(`delta_${uid}_categories`) || '[]'),
          tags: JSON.parse(localStorage.getItem(`delta_${uid}_tags`) || '[]'),
          settings: JSON.parse(s)
        });
        setLoading(false);
      };
      loadLocal();
    }
  }, [user, authLoading, seedDefaults]);

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

  const addAccount = async (a: any) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const docData = cleanData({ ...a, id, createdAt: now, updatedAt: now });
    if (firebaseReady && db && user) {
      await setDoc(doc(db, `users/${user.uid}/accounts`, id), docData);
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_accounts`) || '[]');
      const updated = [...existing, docData];
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
      const updated = existing.map((item: any) => item.id === id ? { ...item, ...a, updatedAt: now } : item);
      localStorage.setItem(`delta_${user.uid}_accounts`, JSON.stringify(updated));
      setData(prev => ({ ...prev, accounts: updated }));
    }
  };

  const deleteAccount = async (id: string) => {
    // Check if account has transactions
    const hasTransactions = data.transactions.some(t => t.accountId === id || t.transferAccountId === id);
    if (hasTransactions) {
      throw new Error('Cannot delete account with transactions. Archive it instead.');
    }
    if (firebaseReady && db && user) {
      await deleteDoc(doc(db, `users/${user.uid}/accounts`, id));
    } else if (user) {
      const existing = JSON.parse(localStorage.getItem(`delta_${user.uid}_accounts`) || '[]');
      const updated = existing.filter((item: any) => item.id !== id);
      localStorage.setItem(`delta_${user.uid}_accounts`, JSON.stringify(updated));
      setData(prev => ({ ...prev, accounts: updated }));
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
      batch.delete(doc(db, `users/${user.uid}/categories`, id));
      await batch.commit();
    } else if (user) {
      const transactions = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updatedTransactions = transactions.map((t: any) => t.categoryId === id ? { ...t, categoryId: uncategorizedId } : t);
      const categories = JSON.parse(localStorage.getItem(`delta_${user.uid}_categories`) || '[]');
      const updatedCategories = categories.filter((c: any) => c.id !== id);
      
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updatedTransactions));
      localStorage.setItem(`delta_${user.uid}_categories`, JSON.stringify(updatedCategories));
      setData(prev => ({ ...prev, transactions: updatedTransactions, categories: updatedCategories }));
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
      batch.delete(doc(db, `users/${user.uid}/tags`, id));
      await batch.commit();
    } else if (user) {
      const transactions = JSON.parse(localStorage.getItem(`delta_${user.uid}_transactions`) || '[]');
      const updatedTransactions = transactions.map((t: any) => ({ ...t, tagIds: (t.tagIds || []).filter((tid: string) => tid !== id) }));
      const tags = JSON.parse(localStorage.getItem(`delta_${user.uid}_tags`) || '[]');
      const updatedTags = tags.filter((t: any) => t.id !== id);
      
      localStorage.setItem(`delta_${user.uid}_transactions`, JSON.stringify(updatedTransactions));
      localStorage.setItem(`delta_${user.uid}_tags`, JSON.stringify(updatedTags));
      setData(prev => ({ ...prev, transactions: updatedTransactions, tags: updatedTags }));
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
      } else {
        // Full Reset
        const collections = ['transactions', 'accounts', 'categories', 'tags'];
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
        setData(prev => ({ ...prev, transactions: [] }));
      } else {
        localStorage.removeItem(`delta_${uid}_accounts`);
        localStorage.removeItem(`delta_${uid}_transactions`);
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
      addTransaction, updateTransaction, deleteTransaction,
      addAccount, updateAccount, deleteAccount,
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
