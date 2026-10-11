import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../providers/DataProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { Button, Card, Input, Select } from '../components/ui/Base';
import { ArrowLeft, CreditCard, Layers, AlignLeft, ArrowRightLeft, Clock3 } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { BankPayload, BankImportSource, identifyBankRows, localBookingDate, possibleBankDuplicates, validateBankPayload } from '../lib/bankImport';

interface ReviewRow {
  source: BankImportSource;
  name: string;
  categoryId: string;
  description: string;
  status: 'normal' | 'pending';
  tagIds: string[];
  transfer: boolean;
  otherAccountId: string;
  share?: number;
  selected?: boolean;
  saved?: string;
  error?: string;
}
const labelClass = 'block text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2';

export default function BankImport() {
  const { accounts, categories, tags, transactions, settings, loading, bankImportReady, bankImportError, importBankTransaction } = useData();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('bank-import') || '');
  const [payload, setPayload] = useState<BankPayload | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const saving = useRef(false);
  const activeAccounts = accounts.filter(a => a.type === 'regular' && !a.archived);
  const account = activeAccounts.find(a => a.id === accountId);
  const knownKeys = new Set(transactions.flatMap(t => t.bankImport ? [t.bankImport.key] : []));

  useEffect(() => {
    if (!token || discarded) return;
    if (!/^[0-9a-f-]{36}$/.test(token)) { setError('Invalid import link. Collect transactions again.'); return; }
    let disposed = false;
    let received = false;
    let interval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    const receiveReply = async (reply: any) => {
      if (reply?.token !== token) return;
      if (reply.type === 'delta-bank-import:expired' && !received) {
        received = true;
        setError('This draft has expired. Return to your bank and click “Import transactions”.');
        clearInterval(interval);
        clearTimeout(timeout);
        return;
      }
      if (reply.type !== 'delta-bank-import:payload' || received) return;
      received = true;
      clearInterval(interval);
      clearTimeout(timeout);
      try {
        const next = validateBankPayload(reply.payload);
        const sources = await identifyBankRows(next);
        if (disposed) return;
        setPayload(next);
        setRows(next.transactions.map((row, i) => ({ source: sources[i], name: row.name, description: '', status: row.status || 'normal',
          categoryId: '', tagIds: [], transfer: false, otherAccountId: '' })));
        setError('');
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'Invalid import draft.'); }
    };
    const receive = (event: MessageEvent) => {
      if (event.source === window && event.origin === location.origin) void receiveReply(event.data);
    };
    const receiveDom = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail !== 'string' || detail.length > 5_000_000) return;
      try { void receiveReply(JSON.parse(detail)); } catch { /* Ignore unrelated events. */ }
    };
    const request = () => {
      const detail = { type: 'delta-bank-import:request', token };
      document.dispatchEvent(new CustomEvent('delta-bank-import:request', { detail: JSON.stringify(detail) }));
      if (!received) window.postMessage(detail, location.origin);
    };
    window.addEventListener('message', receive);
    document.addEventListener('delta-bank-import:reply', receiveDom);
    interval = setInterval(request, 700);
    timeout = setTimeout(() => {
      clearInterval(interval);
      if (!received && !disposed) setError('No userscript response. Update the Delta userscript to version 1.1.0 or later, allow it on this site, then reload this page.');
    }, 10000);
    request();
    return () => {
      disposed = true;
      clearInterval(interval);
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      document.removeEventListener('delta-bank-import:reply', receiveDom);
    };
  }, [token, discarded]);

  const patch = (index: number, changes: Partial<ReviewRow>) => {
    setError('');
    setRows(old => old.map((row, i) => i === index ? { ...row, ...changes } : row));
  };
  const defaultCategory = (index: number) => {
    const type = payload!.transactions[index].amountCents > 0 ? 'income' : 'expense';
    const compatible = categories.filter(c => !c.type || c.type === 'both' || c.type === type);
    return compatible.find(c => c.label.toLowerCase() === 'uncategorized')?.id || '';
  };
  const duplicate = (index: number) => {
    const row = rows[index];
    const original = payload!.transactions[index];
    const exact = knownKeys.has(row.source.key) || Boolean(row.saved);
    const matches = accountId ? possibleBankDuplicates(original, accountId, transactions) : [];
    const repeated = rows.some((other, i) => i !== index && other.source.date === row.source.date && other.source.amountCents === row.source.amountCents && other.source.description === row.source.description);
    return { exact, matches, repeated };
  };
  const isSelected = (index: number) => {
    const info = duplicate(index);
    return !info.exact && (rows[index].selected ?? (!info.matches.length && !info.repeated));
  };
  const selectedCount = rows.filter((_, i) => isSelected(i)).length;

  async function save() {
    if (saving.current || !payload || !account || loading || !bankImportReady || settings.currency !== 'EUR') return;
    saving.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    let saved = 0;
    let skipped = 0;
    const selected = rows.map((row, i) => ({ row, i })).filter(({ i }) => isSelected(i));
    try {
      // Validate the entire selection before making the first write.
      for (const { row, i } of selected) {
        if (!row.name.trim()) throw new Error(`Transaction ${i + 1}: enter a name.`);
        if (row.transfer) {
          if (row.otherAccountId === accountId || !activeAccounts.some(a => a.id === row.otherAccountId)) throw new Error(`Transaction ${i + 1}: choose the other transfer account.`);
        } else {
          const category = categories.find(c => c.id === (row.categoryId || defaultCategory(i)));
          const type = row.source.amountCents > 0 ? 'income' : 'expense';
          if (!category || (category.type && category.type !== 'both' && category.type !== type)) throw new Error(`Transaction ${i + 1}: choose a compatible category.`);
        }
        if (account.isShared && !row.transfer && row.share !== undefined && (!Number.isFinite(row.share) || row.share < 0 || row.share > 100)) throw new Error(`Transaction ${i + 1}: your share must be between 0 and 100%.`);
      }
      for (const { row, i } of selected) {
        try {
          const incoming = row.source.amountCents > 0;
          const amount = Math.abs(row.source.amountCents) / 100;
          const ratio = (row.share ?? (account.defaultMyShareRatio ?? 0.5) * 100) / 100;
          const added = await importBankTransaction({
            name: row.name.trim(), amount, date: localBookingDate(row.source.date),
            accountId: row.transfer && incoming ? row.otherAccountId : accountId,
            transferAccountId: row.transfer ? (incoming ? accountId : row.otherAccountId) : undefined,
            type: row.transfer ? 'transfer' : incoming ? 'income' : 'expense',
            categoryId: row.transfer ? '' : row.categoryId || defaultCategory(i),
            tagIds: row.tagIds.filter(id => tags.some(t => t.id === id)), status: row.status,
            description: row.description, bankImport: row.source,
            ...(account.isShared && !row.transfer ? { myShareRatio: ratio, myShareAmount: Math.round(amount * ratio * 100) / 100 } : {}),
          });
          if (added) saved++; else skipped++;
          patch(i, { saved: added ? 'Imported' : 'Already imported', selected: false, error: undefined });
        } catch (e) {
          patch(i, { error: 'Could not save. This row is still available to retry.' });
          throw e;
        }
      }
      setMessage(`${saved} imported${skipped ? `; ${skipped} already imported` : ''}.`);
    } catch (e) {
      setError(`${saved ? `${saved} saved before stopping. ` : ''}${e instanceof Error ? e.message : 'Saving failed. Please retry.'} Successful rows will not be imported again.`);
    } finally { saving.current = false; setBusy(false); }
  }

  function discard() {
    const detail = { type: 'delta-bank-import:clear', token };
    document.dispatchEvent(new CustomEvent('delta-bank-import:request', { detail: JSON.stringify(detail) }));
    window.postMessage(detail, location.origin);
    history.replaceState(null, '', location.pathname);
    setDiscarded(true);
    setRows([]);
    setPayload(null);
    setError('');
    setMessage('Draft cleared. Saved transactions remain in Delta.');
  }

  return <PageContainer title="Bank import" actions={<Link to="/home" aria-label="Back to transactions" className="p-3 rounded-2xl bg-black/5 dark:bg-white/5"><ArrowLeft size={20} /></Link>}>
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm">{error}</p>}
      {bankImportError && <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm">{bankImportError}</p>}
      {message && <p role="status" className="rounded-2xl bg-emerald-500/10 p-4 text-sm">{message}</p>}
      {!payload && <Card label="Bank connection" className="p-5 space-y-3">
        <a className="inline-block font-medium text-sm underline" href="/delta-bank-import.user.js">Install / update Delta userscript</a>
        {token && !error && !discarded && <p role="status">Waiting for your bank draft…</p>}
      </Card>}
      {payload && <>
        <Card label={payload.bank === 'cic' ? 'CIC' : 'BoursoBank'} className="p-4 space-y-4">
          <h2 className="font-bold text-sm tracking-tight">{rows.length} loaded transactions</h2>
          <div>
            <span className={labelClass}>Account</span>
            <Select aria-label="Delta account for this bank account" icon={CreditCard} value={accountId} disabled={busy || rows.some(r => r.saved)} onChange={e => {
              setAccountId(e.target.value);
              setRows(old => old.map(row => ({ ...row, share: undefined, otherAccountId: '' })));
            }}>
              <option value="">Choose an account</option>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          {!activeAccounts.length && <Link to="/accounts" className="underline text-sm">Create an account first</Link>}
          {settings.currency !== 'EUR' && <p role="alert" className="text-sm">This import is in EUR. Change Delta’s currency to EUR before importing; currency conversion is not supported.</p>}
        </Card>
        {loading || !bankImportReady ? <p role="status">Loading your existing transactions…</p> : rows.map((row, i) => {
          const original = payload.transactions[i];
          const info = duplicate(i);
          const disabled = busy || info.exact;
          const type = original.amountCents > 0 ? 'income' : 'expense';
          return <fieldset key={row.source.key} aria-label={original.name} disabled={disabled} className="rounded-[32px] bg-black/5 dark:bg-white/5 p-4 sm:p-5 min-w-0 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-1">
              <input aria-label={`Select ${original.name}`} type="checkbox" className="h-5 w-5 shrink-0 accent-black dark:accent-white cursor-pointer disabled:cursor-default" checked={isSelected(i)} disabled={disabled} onChange={e => patch(i, { selected: e.target.checked })} />
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold break-words">{original.name}</span><span className="text-[10px] uppercase tracking-wider opacity-40">{original.date}</span></span>
              <span className={cn('font-bold text-sm whitespace-nowrap', type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{formatCurrency(original.amountCents / 100, 'EUR')}</span>
            </label>
            {info.exact && <p className="text-sm text-emerald-700 dark:text-emerald-400">{row.saved || 'Already imported'}</p>}
            {!!info.matches.length && !info.exact && <p className="text-xs text-amber-700 dark:text-amber-400">Possible match: {info.matches.map(t => `${t.name}${t.status === 'pending' ? ' (pending)' : ''}`).slice(0, 3).join(', ')}</p>}
            {info.repeated && !info.exact && <p className="text-xs text-amber-700 dark:text-amber-400">Identical payments in this draft</p>}
            {row.error && <p role="alert" className="text-sm text-red-600">{row.error}</p>}
            {!info.exact && <div className="bg-white dark:bg-black/20 rounded-2xl p-4 space-y-4 shadow-sm">
              <label className="block"><span className={labelClass}>Name</span><Input icon={AlignLeft} value={row.name} maxLength={500} onChange={e => patch(i, { name: e.target.value })} /></label>
              <div><span className={labelClass}>Type</span>
                <Select aria-label="Type" icon={ArrowRightLeft} value={row.transfer ? 'transfer' : type} onChange={e => patch(i, { transfer: e.target.value === 'transfer' })}>
                  <option value={type}>{type === 'income' ? 'Income' : 'Expense'}</option><option value="transfer">Transfer between my accounts</option>
                </Select>
              </div>
              {row.transfer ? <div><span className={labelClass}>{type === 'income' ? 'From account' : 'To account'}</span>
                <Select aria-label={type === 'income' ? 'From account' : 'To account'} icon={CreditCard} value={row.otherAccountId} onChange={e => patch(i, { otherAccountId: e.target.value })}>
                  <option value="">Choose the other account</option>
                  {activeAccounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div> : <div><span className={labelClass}>Category</span>
                <Select aria-label="Category" icon={Layers} value={row.categoryId || defaultCategory(i)} onChange={e => patch(i, { categoryId: e.target.value })}>
                  <option value="">Choose a category</option>
                  {categories.filter(c => !c.type || c.type === 'both' || c.type === type).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </div>}
              <div><span className={labelClass}>Status</span><Select aria-label="Status" icon={Clock3} value={row.status} onChange={e => patch(i, { status: e.target.value as 'normal' | 'pending' })}><option value="normal">Normal</option><option value="pending">Pending</option></Select></div>
              {account?.isShared && !row.transfer && <label className="block"><span className={labelClass}>My share (%)</span><Input type="number" min={0} max={100} step="any" value={row.share ?? (account.defaultMyShareRatio ?? 0.5) * 100} onChange={e => patch(i, { share: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>}
              {!!tags.length && <details><summary className="text-[10px] font-bold uppercase tracking-wider opacity-50 cursor-pointer">Tags ({row.tagIds.length})</summary><div className="flex flex-wrap gap-3 py-2">
                {tags.map(tag => <label key={tag.id} className="text-xs flex items-center gap-2 cursor-pointer"><input type="checkbox" className="h-4 w-4 accent-black dark:accent-white" checked={row.tagIds.includes(tag.id)} onChange={e => patch(i, { tagIds: e.target.checked ? [...row.tagIds, tag.id] : row.tagIds.filter(id => id !== tag.id) })} />{tag.label}</label>)}
              </div></details>}
              <label className="block"><span className={labelClass}>Notes</span><Input icon={AlignLeft} placeholder="Optional" value={row.description} maxLength={2000} onChange={e => patch(i, { description: e.target.value })} /></label>
            </div>}
          </fieldset>;
        })}
        {!!payload.warnings.length && <details className="text-xs opacity-60"><summary className="cursor-pointer">Import notices ({payload.warnings.length})</summary>{payload.warnings.map((warning, i) => <p key={i} className="mt-2">{warning}</p>)}</details>}
        <div className="sticky bottom-24 p-3 rounded-2xl bg-background border border-black/10 dark:border-white/10 space-y-2 shadow-lg">
          <Button className="w-full" onClick={save} disabled={busy || loading || !bankImportReady || !account || !selectedCount || settings.currency !== 'EUR'}>{busy ? 'Saving…' : !account ? 'Choose an account to import' : `Validate ${selectedCount} transactions`}</Button>
          <Button className="w-full" variant="ghost" onClick={discard} disabled={busy}>Clear draft</Button>
        </div>
      </>}
    </div>
  </PageContainer>;
}
