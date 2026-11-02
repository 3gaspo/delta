import { SearchField } from '../components/SearchField';
import { StateFeedback } from '../components/StateFeedback';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../providers/DataProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { TransactionList } from '../components/transactions/TransactionList';
import { Card, Input, Select } from '../components/ui/Base';
import { Modal } from '../components/ui/Modal';
import { TransactionForm, FormTabMode } from '../components/transactions/TransactionForm';
import { Search, Download } from 'lucide-react';
import { FloatingAddButton } from '../components/FloatingAddButton';
import { computeFinancialTotals } from '../utils/financial';

export default function Home() {
  const { transactions, accounts, categories, tags, settings, loading } = useData();
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

  const handleOpenAdd = (mode: FormTabMode = 'single') => {
    setAddDefaultMode(mode);
    setIsAdding(true);
  };

  if (loading) return <PageContainer title="Delta" titleClassName="app-brand-title" homeHeader><StateFeedback kind="loading" /></PageContainer>;

  return (
    <PageContainer 
      title="Delta" 
      titleClassName="app-brand-title"
      homeHeader
      className="app-home-content"
      actions={
        <div className="flex items-center gap-2">
          <Link to="/import" title="Import bank transactions" aria-label="Import bank transactions" className="p-3 rounded-2xl bg-ui-section"><Download size={20} /></Link>
        </div>
      }
    >
      <div className="space-y-4 mb-8">
        <SearchField label="Search transactions" value={search} onChange={setSearch} />
        
        <div className="ui-filter-grid grid grid-cols-2 gap-4">
          <Select 
            aria-label="Account" value={filters.accountId}
            onChange={e => setFilters(prev => ({ ...prev, accountId: e.target.value }))}
          >
            <option value="all">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select 
            aria-label="Transaction type" value={filters.type}
            onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}
          >
            <option value="all">All Types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {/* Transaction History Block */}
        <Card label="Transaction History" className="bg-transparent shadow-none p-0">
          <TransactionList transactions={filteredTransactions} />
        </Card>
      </div>

      <FloatingAddButton label="Add transaction" onClick={() => handleOpenAdd('single')} />
      <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} title="Add transaction">
        <TransactionForm 
          onClose={() => setIsAdding(false)} 
          allowedModes={['single', 'group', 'transfer']} 
          defaultMode={addDefaultMode} 
        />
      </Modal>
    </PageContainer>
  );
}
