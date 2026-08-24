import { useState, useMemo } from 'react';
import { useData } from '../providers/DataProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { TransactionList } from '../components/transactions/TransactionList';
import { RecurringList } from '../components/transactions/RecurringList';
import { Card, Button, Input, Select } from '../components/ui/Base';
import { Modal } from '../components/ui/Modal';
import { TransactionForm, FormTabMode } from '../components/transactions/TransactionForm';
import { Plus, Search, Repeat } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { computeFinancialTotals } from '../utils/financial';

export default function Home() {
  const { transactions, recurringTransactions, accounts, categories, tags, settings, loading } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [addDefaultMode, setAddDefaultMode] = useState<FormTabMode>('single');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    accountId: 'all',
    categoryId: 'all',
    tagId: 'all',
    type: 'all',
    status: 'all'
  });

  const totals = useMemo(() => computeFinancialTotals(accounts, transactions), [accounts, transactions]);

  const hiddenAccountIds = useMemo(() => new Set(accounts.filter(a => a.hidden).map(a => a.id)), [accounts]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Hide all related transactions of a hidden account (except for transfers)
      if (t.type !== 'transfer' && hiddenAccountIds.has(t.accountId)) {
        return false;
      }
      if (search) {
        const query = search.toLowerCase();
        const cat = categories.find(c => c.id === t.categoryId)?.label.toLowerCase() || '';
        const acc = accounts.find(a => a.id === t.accountId)?.name.toLowerCase() || '';
        const name = t.name?.toLowerCase() || '';
        const desc = t.description?.toLowerCase() || '';
        if (!cat.includes(query) && !acc.includes(query) && !name.includes(query) && !desc.includes(query)) return false;
      }
      if (filters.accountId !== 'all' && t.accountId !== filters.accountId && t.transferAccountId !== filters.accountId) return false;
      if (filters.categoryId !== 'all' && t.categoryId !== filters.categoryId) return false;
      if (filters.tagId !== 'all' && !t.tagIds.includes(filters.tagId)) return false;
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      return true;
    });
  }, [transactions, search, filters, categories, accounts, hiddenAccountIds]);

  const filteredRecurringTransactions = useMemo(() => {
    return recurringTransactions.filter(r => {
      if (r.type !== 'transfer' && hiddenAccountIds.has(r.accountId)) {
        return false;
      }
      if (search) {
        const query = search.toLowerCase();
        const cat = categories.find(c => c.id === r.categoryId)?.label.toLowerCase() || '';
        const acc = accounts.find(a => a.id === r.accountId)?.name.toLowerCase() || '';
        const name = r.name?.toLowerCase() || '';
        const desc = r.description?.toLowerCase() || '';
        if (!cat.includes(query) && !acc.includes(query) && !name.includes(query) && !desc.includes(query)) return false;
      }
      if (filters.accountId !== 'all' && r.accountId !== filters.accountId && r.transferAccountId !== filters.accountId) return false;
      if (filters.categoryId !== 'all' && r.categoryId !== filters.categoryId) return false;
      if (filters.tagId !== 'all' && !r.tagIds.includes(filters.tagId)) return false;
      if (filters.type !== 'all') {
        if (filters.type === 'expense' && r.type !== 'expense' && r.type !== 'subscription') return false;
        if (filters.type === 'income' && r.type !== 'income') return false;
        if (filters.type === 'transfer' && r.type !== 'transfer') return false;
      }
      return true;
    });
  }, [recurringTransactions, search, filters, categories, accounts, hiddenAccountIds]);

  const handleOpenAdd = (mode: FormTabMode = 'single') => {
    setAddDefaultMode(mode);
    setIsAdding(true);
  };

  if (loading) return null;

  return (
    <PageContainer 
      title="Delta" 
      actions={
        <div className="flex items-center gap-2">
          <Button size="icon" onClick={() => handleOpenAdd('single')} title="New Transaction">
            <Plus size={20} />
          </Button>
        </div>
      }
    >
      <div className="space-y-4 mb-8">
        <Input 
          icon={Search} 
          placeholder="Search transactions..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <Select 
            value={filters.accountId}
            onChange={e => setFilters(prev => ({ ...prev, accountId: e.target.value }))}
          >
            <option value="all">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select 
            value={filters.type}
            onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}
          >
            <option value="all">All Types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </Select>
        </div>
      </div>

      <div className="space-y-8">
        {/* Transaction History Block */}
        <Card label="Transaction History">
          <TransactionList transactions={filteredTransactions} />
        </Card>

        {/* Recurring Transactions Block */}
        <Card 
          label="Recurring Transactions"
          actions={
            <button
              onClick={() => handleOpenAdd('subscription')}
              className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              <Plus size={14} /> Add Recurring
            </button>
          }
        >
          <RecurringList 
            recurringTransactions={filteredRecurringTransactions}
            onAddNew={() => handleOpenAdd('subscription')} 
          />
        </Card>
      </div>

      <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} title="New Transaction">
        <TransactionForm onClose={() => setIsAdding(false)} defaultMode={addDefaultMode} />
      </Modal>
    </PageContainer>
  );
}
