export type AccountType = 'regular' | 'debt';
export type DebtDirection = 'receivable' | 'payable';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  debtDirection?: DebtDirection;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
  order?: number;
}

export type TransactionType = 'expense' | 'income' | 'transfer' | 'subscription';
export type TransactionStatus = 'normal' | 'pending' | 'hidden';

export interface Transaction {
  id: string;
  amount: number;
  date: number;
  accountId: string;
  categoryId: string;
  tagIds: string[];
  type: TransactionType;
  status: TransactionStatus;
  name: string;
  description?: string;
  transferAccountId?: string;
  createdAt: number;
  updatedAt: number;
  dedupeKey?: string;
  isCorrection?: boolean;
}

export interface Category {
  id: string;
  label: string;
  type?: 'expense' | 'income' | 'both';
  color?: string;
  budgetLimit?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  label: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  darkMode: boolean;
  currency: string;
  initialized: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  uid: string;
  email: string | null;
}

export interface DataContextValue {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  tags: Tag[];
  settings: UserSettings;
  loading: boolean;
  
  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTransaction: (id: string, t: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  addAccount: (a: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAccount: (id: string, a: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  
  addCategory: (c: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCategory: (id: string, c: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  addTag: (t: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTag: (id: string, t: Partial<Tag>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  
  updateSettings: (s: Partial<UserSettings>) => Promise<void>;
  resetData: (mode: 'history' | 'all') => Promise<void>;
}
