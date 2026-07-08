import { useState, useMemo } from 'react';
import { useData } from '../providers/DataProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { TransactionList } from '../components/transactions/TransactionList';
import { Card, Button, Input, Select } from '../components/ui/Base';
import { Modal } from '../components/ui/Modal';
import { TransactionForm } from '../components/transactions/TransactionForm';
import { Plus, Search, Filter } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { computeFinancialTotals } from '../utils/financial';

export default function Home() {
  const { transactions, accounts, categories, tags, settings, loading } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    accountId: 'all',
    categoryId: 'all',
    tagId: 'all',
    type: 'all',
    status: 'all'
  });

  const totals = useMemo(() => computeFinancialTotals(accounts, transactions), [accounts, transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
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
  }, [transactions, search, filters, categories, accounts]);

  if (loading) return null;

  return (
    <PageContainer 
      title="Delta" 
      actions={
        <Button size="icon" onClick={() => setIsAdding(true)}>
          <Plus size={20} />
        </Button>
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

      <Card label="Transaction History">
        <TransactionList transactions={filteredTransactions} />
      </Card>

      <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} title="New Transaction">
        <TransactionForm onClose={() => setIsAdding(false)} />
      </Modal>
    </PageContainer>
  );
}
