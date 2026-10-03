import React, { useMemo, useState } from 'react';
import { useData } from '../providers/DataProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, Select } from '../components/ui/Base';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { TransactionType } from '../types';
import { isInitialBalanceTx, getAccountBalance, computeFullPeriodAverages, getMyTransactionAmount } from '../utils/financial';
import { 
  startOfMonth, endOfMonth, format, eachMonthOfInterval, 
  startOfYear, startOfWeek, endOfWeek,
  eachWeekOfInterval
} from 'date-fns';
import { PiggyBank, PieChart as LucidePieChart } from 'lucide-react';

export default function Stats() {
  const { transactions, categories, tags, accounts, settings, loading } = useData();
  
  // Global Filters
  const [includeDebts, setIncludeDebts] = useState(true);
  const [globalFilterId, setGlobalFilterId] = useState('all'); // 'cat:id' or 'tag:id'

  // Balance Chart Controls
  const [balancePeriod, setBalancePeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [balanceAccountId, setBalanceAccountId] = useState('all');

  // Cash Flow Chart Controls
  const [flowPeriod, setFlowPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [flowTypeFilter, setFlowTypeFilter] = useState<'all' | TransactionType>('all');
  const [avgPeriod, setAvgPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const stats = useMemo(() => {
    if (!transactions || !categories || !accounts) return null;

    const now = new Date();
    
    // Helper to get filtered transactions based on global filters
    const getFiltered = (limitToAccount?: string) => {
      return transactions.filter(t => {
        if (t.status === 'hidden') return false;
        
        // Find main account
        const acc = accounts.find(a => a.id === t.accountId);
        if (!includeDebts && acc?.type === 'debt') return false;
        
        if (limitToAccount && limitToAccount !== 'all' && t.accountId !== limitToAccount && t.transferAccountId !== limitToAccount) return false;
        
        if (globalFilterId !== 'all') {
          const [type, id] = globalFilterId.split(':');
          if (type === 'tag' && !t.tagIds.includes(id)) return false;
          if (type === 'cat' && t.categoryId !== id) return false;
        }

        return true;
      });
    };

    // 1. Balance Data Generation
    const balanceIntervalStart = balancePeriod === 'monthly' ? startOfYear(now) : startOfMonth(now);
    const balanceIntervalEnd = endOfMonth(now);
    const balanceFiltered = getFiltered(balanceAccountId).filter(t => t.date >= balanceIntervalStart.getTime() && t.date <= balanceIntervalEnd.getTime());

    let currentRunningBalance = 0;
    if (balanceAccountId === 'all') {
      // Calculate total balance of all selected accounts
      currentRunningBalance = accounts
        .filter(a => includeDebts || a.type !== 'debt')
        .reduce((sum, a) => sum + getAccountBalance(a.id, transactions, a), 0);
    } else {
      const a = accounts.find(acc => acc.id === balanceAccountId);
      if (a) {
        currentRunningBalance = getAccountBalance(a.id, transactions, a);
      }
    }

    let balanceData = [];
    if (balancePeriod === 'monthly') {
      const months = eachMonthOfInterval({ start: balanceIntervalStart, end: balanceIntervalEnd });
      balanceData = months.map(m => {
        const mStart = startOfMonth(m).getTime();
        const mEnd = endOfMonth(m).getTime();
        const monthTransactions = balanceFiltered.filter(t => t.date >= mStart && t.date <= mEnd);
        
        let net = 0;
        monthTransactions.forEach(t => {
          if (isInitialBalanceTx(t)) return;
          const isIncome = t.type === 'income';
          const isExpense = t.type === 'expense' || t.type === 'subscription';
          
          if (balanceAccountId === 'all') {
             if (isIncome) net += t.amount;
             if (isExpense) net -= t.amount;
          } else {
             // Specific account
             const isSource = t.accountId === balanceAccountId;
             const isDest = t.transferAccountId === balanceAccountId;
             if (t.type === 'transfer') {
                if (isSource) net -= t.amount;
                if (isDest) net += t.amount;
             } else if (isIncome) {
                net += t.amount;
             } else {
                net -= t.amount;
             }
          }
        });

        return { name: format(m, 'MMM'), net, timestamp: mEnd, value: 0 };
      });
    } else {
      const weeks = eachWeekOfInterval({ start: balanceIntervalStart, end: balanceIntervalEnd });
      balanceData = weeks.map((w, idx) => {
        const wStart = startOfWeek(w).getTime();
        const wEnd = endOfWeek(w).getTime();
        const weekTransactions = balanceFiltered.filter(t => t.date >= wStart && t.date <= wEnd);
        
        let net = 0;
        weekTransactions.forEach(t => {
          if (isInitialBalanceTx(t)) return;
          const isIncome = t.type === 'income';
          const isExpense = t.type === 'expense' || t.type === 'subscription';
          
          if (balanceAccountId === 'all') {
             if (isIncome) net += t.amount;
             if (isExpense) net -= t.amount;
          } else {
             const isSource = t.accountId === balanceAccountId;
             const isDest = t.transferAccountId === balanceAccountId;
             if (t.type === 'transfer') {
                if (isSource) net -= t.amount;
                if (isDest) net += t.amount;
             } else if (isIncome) {
                net += t.amount;
             } else {
                net -= t.amount;
             }
          }
        });

        return { name: `W${idx + 1}`, net, timestamp: wEnd, value: 0 };
      });
    }

    let runningVal = currentRunningBalance;
    for (let i = balanceData.length - 1; i >= 0; i--) {
      balanceData[i].value = runningVal;
      runningVal -= balanceData[i].net;
    }

    // 2. Cash Flow Data
    const flowIntervalStart = flowPeriod === 'monthly' ? startOfYear(now) : startOfMonth(now);
    const flowIntervalEnd = endOfMonth(now);
    const flowFiltered = getFiltered().filter(t => t.date >= flowIntervalStart.getTime() && t.date <= flowIntervalEnd.getTime());

    const flowIntervals = flowPeriod === 'monthly' 
      ? eachMonthOfInterval({ start: flowIntervalStart, end: flowIntervalEnd })
      : eachWeekOfInterval({ start: flowIntervalStart, end: flowIntervalEnd });

    const flowData = flowIntervals.map((interval, idx) => {
      const iStart = (flowPeriod === 'monthly' ? startOfMonth(interval) : startOfWeek(interval)).getTime();
      const iEnd = (flowPeriod === 'monthly' ? endOfMonth(interval) : endOfWeek(interval)).getTime();
      const intervalTransactions = flowFiltered.filter(t => t.date >= iStart && t.date <= iEnd);
      
      const res = {
        name: flowPeriod === 'monthly' ? format(interval, 'MMM') : `W${idx + 1}`,
        income: 0,
        expenses: 0
      };

      intervalTransactions.forEach(t => {
        if (isInitialBalanceTx(t)) return;
        const isExpense = t.type === 'expense' || t.type === 'subscription';
        const isIncome = t.type === 'income';
        
        if (flowTypeFilter !== 'all' && t.type !== flowTypeFilter) return;

        if (isExpense) res.expenses += getMyTransactionAmount(t);
        if (isIncome) res.income += getMyTransactionAmount(t);
      });

      return res;
    });

    const totalExpenses = flowData.reduce((sum, d) => sum + d.expenses, 0);
    const totalIncome = flowData.reduce((sum, d) => sum + d.income, 0);

    const filteredForAverages = getFiltered();
    const periodAverages = computeFullPeriodAverages(filteredForAverages, now);

    // 3. Category Data
    const catFiltered = filteredForAverages.filter(t => !isInitialBalanceTx(t) && t.date >= startOfMonth(now).getTime() && t.date <= endOfMonth(now).getTime());
    const categoryMap = new Map<string, { value: number, budget: number, color: string, monthlyAvg: number | null }>();
    const CHART_COLORS = [
      '#000000', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
      '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'
    ];
    
    categories.forEach((cat, idx) => {
      const total = catFiltered
        .filter(t => t.categoryId === cat.id && (t.type === 'expense' || t.type === 'subscription'))
        .reduce((sum, t) => sum + getMyTransactionAmount(t), 0);
      
      const existingColor = cat.color || CHART_COLORS[idx % CHART_COLORS.length];
      const catAvg = periodAverages.categoryMonthlyAvg[cat.id] ?? null;

      categoryMap.set(cat.label, {
        value: total,
        budget: cat.budgetLimit || 0,
        color: existingColor,
        monthlyAvg: catAvg
      });
    });

    const categoryTotals = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter(c => c.value > 0 || c.budget > 0 || (c.monthlyAvg !== null && c.monthlyAvg > 0));

    return {
      balanceData,
      flowData,
      categoryTotals,
      totalExpenses,
      totalIncome,
      periodAverages
    };
  }, [transactions, categories, accounts, includeDebts, globalFilterId, balancePeriod, balanceAccountId, flowPeriod, flowTypeFilter]);

  if (loading || !stats) return (
    <PageContainer title="Stats">
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="opacity-40 animate-pulse text-xs font-black uppercase tracking-widest">Calculating...</p>
      </div>
    </PageContainer>
  );

  return (
    <PageContainer title="Stats">
      <div className="space-y-12">
        {/* Global Filters */}
        <header>
          <div className="flex flex-col gap-3 p-6 bg-black/5 dark:bg-white/5 rounded-[32px] border border-black/5 dark:border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Filter Analytics</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select 
                value={globalFilterId} 
                onChange={(e) => setGlobalFilterId(e.target.value)} 
                className="h-12 text-xs"
              >
                <option value="all">Compare All</option>
                <optgroup label="Categories">
                  {categories?.map(c => <option key={c.id} value={`cat:${c.id}`}>{c.label}</option>)}
                </optgroup>
                <optgroup label="Tags">
                  {tags?.map(t => <option key={t.id} value={`tag:${t.id}`}>{t.label}</option>)}
                </optgroup>
              </Select>

              <button 
                type="button"
                onClick={() => setIncludeDebts(!includeDebts)}
                className={cn(
                  "flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer",
                  includeDebts 
                    ? "bg-black/5 dark:bg-white/10 text-foreground border-black/10 dark:border-white/10" 
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                )}
              >
                <PiggyBank size={16} />
                {includeDebts ? "Debts Included" : "Debts Excluded"}
              </button>
            </div>
          </div>
        </header>

        {/* 1. Account Evolution */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
            <h2 className="text-lg font-bold tracking-tight">Account Evolution</h2>
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 md:overflow-visible">
              <Select 
                value={balancePeriod} 
                onChange={(e) => setBalancePeriod(e.target.value as any)} 
                className="h-10 py-0 px-3 text-xs w-32 flex-shrink-0"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
              <Select 
                value={balanceAccountId} 
                onChange={(e) => setBalanceAccountId(e.target.value)} 
                className="h-10 py-0 px-3 text-xs w-36"
              >
                <option value="all">All Accounts</option>
                {accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
          </div>
          <Card className="h-[300px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.balanceData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="currentColor" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="currentColor" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.05} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: '1px solid rgba(128,128,128,0.15)', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    padding: '12px 16px'
                  }}
                  itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                  formatter={(value: any) => [formatCurrency(value, settings.currency), 'Balance']}
                />
                <Area type="monotone" dataKey="value" stroke="currentColor" fillOpacity={1} fill="url(#colorVal)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </section>

        {/* 2. Cash Flow */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
            <h2 className="text-lg font-bold tracking-tight">Cash Flow</h2>
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 md:overflow-visible">
              <Select 
                value={flowPeriod} 
                onChange={(e) => setFlowPeriod(e.target.value as any)} 
                className="h-10 py-0 px-3 text-xs w-32 flex-shrink-0"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
              <Select 
                value={flowTypeFilter} 
                onChange={(e) => setFlowTypeFilter(e.target.value as any)} 
                className="h-10 py-0 px-3 text-xs w-36"
              >
                <option value="all">All Types</option>
                <option value="expense">Expenses</option>
                <option value="income">Income</option>
                <option value="subscription">Subscriptions</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl text-center">
              <p className="text-[10px] font-bold uppercase text-red-500 mb-1 tracking-widest opacity-60">Expenses</p>
              <p className="text-2xl font-bold text-red-500 tracking-tight">{formatCurrency(stats.totalExpenses, settings.currency)}</p>
            </div>
            <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-center">
              <p className="text-[10px] font-bold uppercase text-emerald-500 mb-1 tracking-widest opacity-60">Income</p>
              <p className="text-2xl font-bold text-emerald-500 tracking-tight">{formatCurrency(stats.totalIncome, settings.currency)}</p>
            </div>
          </div>
          <Card className="h-[300px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.flowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.05} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: '1px solid rgba(128,128,128,0.15)', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    padding: '12px 16px'
                  }}
                  itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                  formatter={(value: any) => [formatCurrency(value, settings.currency), 'Amount']}
                />
                <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Average Aggregates with Monthly/Yearly toggle */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
                Average Aggregates
              </span>

              {/* Monthly / Yearly Toggle */}
              <div className="flex items-center p-0.5 bg-black/5 dark:bg-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAvgPeriod('monthly')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                    avgPeriod === 'monthly'
                      ? "bg-white dark:bg-black text-foreground shadow-xs"
                      : "text-foreground/50 hover:text-foreground"
                  )}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setAvgPeriod('yearly')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                    avgPeriod === 'yearly'
                      ? "bg-white dark:bg-black text-foreground shadow-xs"
                      : "text-foreground/50 hover:text-foreground"
                  )}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Avg expenses */}
              <div className="p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">
                    avg expenses
                  </p>
                  <div className="mt-1">
                    {(() => {
                      const expVal = avgPeriod === 'monthly'
                        ? stats.periodAverages.monthlyExpensesAvg
                        : stats.periodAverages.yearlyExpensesAvg;
                      if (expVal === null) {
                        return <p className="text-xl font-bold opacity-30 tracking-widest">—</p>;
                      }
                      return (
                        <p className="text-xl font-bold text-red-500 tracking-tight">
                          -{formatCurrency(expVal, settings.currency)}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                <p className="text-[9px] font-medium opacity-40 mt-2">
                  {avgPeriod === 'monthly'
                    ? (stats.periodAverages.fullMonthsCount > 0
                        ? `${stats.periodAverages.fullMonthsCount} full ${stats.periodAverages.fullMonthsCount === 1 ? 'month' : 'months'}`
                        : 'Not enough data')
                    : (stats.periodAverages.fullYearsCount > 0
                        ? `${stats.periodAverages.fullYearsCount} full ${stats.periodAverages.fullYearsCount === 1 ? 'year' : 'years'}`
                        : 'Not enough data')}
                </p>
              </div>

              {/* Avg income */}
              <div className="p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">
                    avg income
                  </p>
                  <div className="mt-1">
                    {(() => {
                      const incVal = avgPeriod === 'monthly'
                        ? stats.periodAverages.monthlyIncomeAvg
                        : stats.periodAverages.yearlyIncomeAvg;
                      if (incVal === null) {
                        return <p className="text-xl font-bold opacity-30 tracking-widest">—</p>;
                      }
                      return (
                        <p className="text-xl font-bold text-emerald-500 tracking-tight">
                          +{formatCurrency(incVal, settings.currency)}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                <p className="text-[9px] font-medium opacity-40 mt-2">
                  {avgPeriod === 'monthly'
                    ? (stats.periodAverages.fullMonthsCount > 0 ? 'Full months only' : 'Not enough data')
                    : (stats.periodAverages.fullYearsCount > 0 ? 'Full years only' : 'Not enough data')}
                </p>
              </div>

              {/* Avg net */}
              <div className="p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">
                    avg net
                  </p>
                  <div className="mt-1">
                    {(() => {
                      const netVal = avgPeriod === 'monthly'
                        ? stats.periodAverages.monthlyNetAvg
                        : stats.periodAverages.yearlyNetAvg;
                      if (netVal === null) {
                        return <p className="text-xl font-bold opacity-30 tracking-widest">—</p>;
                      }
                      return (
                        <p className={cn(
                          "text-xl font-bold tracking-tight",
                          netVal > 0 ? "text-emerald-500" : netVal < 0 ? "text-red-500" : "opacity-60"
                        )}>
                          {netVal > 0 ? '+' : ''}{formatCurrency(netVal, settings.currency)}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                <p className="text-[9px] font-medium opacity-40 mt-2">
                  {avgPeriod === 'monthly'
                    ? (stats.periodAverages.fullMonthsCount > 0 ? 'Full months net flow' : '—')
                    : (stats.periodAverages.fullYearsCount > 0 ? 'Full years net flow' : '—')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. By Category */}
        <section className="space-y-4">
          <div className="px-1">
            <h2 className="text-lg font-bold tracking-tight">By Category</h2>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="flex flex-col lg:flex-row">
              {/* Chart Side */}
              <div className="p-8 border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/5 flex flex-col items-center justify-center bg-black/[0.02] dark:bg-white/[0.02] lg:w-1/2">
                <div className="w-full max-w-[280px] aspect-square">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.categoryTotals}
                        innerRadius="65%"
                        outerRadius="90%"
                        paddingAngle={6}
                        dataKey="value"
                        stroke="none"
                      >
                        {stats.categoryTotals.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '20px', 
                          border: '1px solid rgba(128,128,128,0.15)', 
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                          backgroundColor: 'var(--background)',
                          color: 'var(--foreground)',
                          padding: '12px 16px'
                        }}
                        itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                        formatter={(value: any) => [formatCurrency(value, settings.currency), 'Spent']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Monthly Distribution</p>
                  <p className="text-xs font-semibold opacity-70 mt-1">{stats.categoryTotals.length} Active Categories</p>
                </div>
              </div>

              {/* List Side */}
              <div className="p-6 sm:p-8 flex flex-col min-h-[380px] lg:w-1/2">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-black/5 dark:border-white/5 shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Monthly Budget Progress</p>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
                  <div className="space-y-6">
                    {stats.categoryTotals.map((cat, i) => (
                      <div key={`${cat.name}-${i}`} className="space-y-2.5 group">
                        <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full shadow-xs shrink-0" style={{ backgroundColor: cat.color }} />
                            <div className="flex flex-col gap-0.5">
                               <span className="opacity-90 truncate max-w-[180px] font-bold">{cat.name}</span>
                               <span className="text-[8px] opacity-40 font-semibold">
                                 Current Month • Avg: {cat.monthlyAvg !== null ? `${formatCurrency(cat.monthlyAvg, settings.currency)}/mo` : '—'}
                               </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={cn("text-[11px] font-bold", cat.value > cat.budget && cat.budget > 0 ? "text-red-500" : "")}>
                              {formatCurrency(cat.value, settings.currency)}
                            </span>
                            {cat.budget > 0 && (
                              <span className="text-[9px] opacity-40">
                                / {formatCurrency(cat.budget, settings.currency)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-1000 ease-out",
                              cat.value > cat.budget && cat.budget > 0 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "shadow-xs"
                            )}
                            style={{ 
                              width: `${(cat.budget > 0 && !isNaN(cat.value)) ? Math.min((cat.value / cat.budget) * 100, 100) : (!isNaN(cat.value) && cat.value > 0 ? 100 : 0)}%`,
                              backgroundColor: cat.value > cat.budget && cat.budget > 0 ? undefined : cat.color 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {stats.categoryTotals.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 opacity-30 text-center">
                        <LucidePieChart size={32} strokeWidth={1.5} className="mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">No Category Data</p>
                        <p className="text-[10px] opacity-60 mt-0.5">Add transactions with categories to see insights</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </PageContainer>
  );
}
