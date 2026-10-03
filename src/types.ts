export type AccountType = 'regular' | 'debt';
export type DebtDirection = 'receivable' | 'payable';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  debtDirection?: DebtDirection;
  initialBalance?: number;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
  hidden?: boolean;
  order?: number;
  isShared?: boolean;
  defaultMyShareRatio?: number;
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
  debtAccountId?: string;
  periodicityDays?: number;
  lastGeneratedDate?: number;
  recurringId?: string;
  createdAt: number;
  updatedAt: number;
  dedupeKey?: string;
  isCorrection?: boolean;
  isInitialBalance?: boolean;
  groupId?: string;
  myShareAmount?: number;
  myShareRatio?: number;
}

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  startDate: number;
  periodicityDays: number;
  accountId: string;
  transferAccountId?: string;
  debtAccountId?: string;
  categoryId?: string;
  tagIds: string[];
  type: 'expense' | 'income' | 'transfer';
  status: TransactionStatus;
  description?: string;
  lastGeneratedDate?: number;
  active?: boolean;
  createdAt: number;
  updatedAt: number;
  myShareAmount?: number;
  myShareRatio?: number;
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
  recurringTransactions: RecurringTransaction[];
  categories: Category[];
  tags: Tag[];
  settings: UserSettings;
  loading: boolean;
  
  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTransaction: (id: string, t: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveGroupTransaction: (groupId: string, subtransactions: any[]) => Promise<void>;
  deleteGroupTransaction: (groupId: string) => Promise<void>;
  
  addRecurringTransaction: (r: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRecurringTransaction: (id: string, r: Partial<RecurringTransaction>) => Promise<void>;
  deleteRecurringTransaction: (id: string, deleteGeneratedHistory?: boolean) => Promise<void>;

  addAccount: (a: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAccount: (id: string, a: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  reorderAccounts: (orderedAccounts: { id: string; order: number }[]) => Promise<void>;
  
  addCategory: (c: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCategory: (id: string, c: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  addTag: (t: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTag: (id: string, t: Partial<Tag>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  
  updateSettings: (s: Partial<UserSettings>) => Promise<void>;
  resetData: (mode: 'history' | 'all') => Promise<void>;
}
