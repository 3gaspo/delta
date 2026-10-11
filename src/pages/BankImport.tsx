import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../providers/DataProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { Button, Input } from '../components/ui/Base';
import { BankPayload, BankImportSource, identifyBankRows, localBookingDate, possibleBankDuplicates, validateBankPayload } from '../lib/bankImport';

interface ReviewRow {
  source: BankImportSource;
  name: string;
  categoryId: string;
  description: string;
  tagIds: string[];
  transfer: boolean;
  otherAccountId: string;
  share?: number;
  selected?: boolean;
  saved?: string;
  error?: string;
}
const selectClass = 'w-full bg-black/5 dark:bg-white/10 rounded-xl p-3 text-foreground';

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
    const receive = async (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.token !== token) return;
      if (event.data.type === 'delta-bank-import:expired' && !received) {
        setError('This draft has expired. Return to your bank and click “Review loaded transactions in Delta”.');
        clearInterval(interval);
        return;
      }
      if (event.data.type !== 'delta-bank-import:payload' || received) return;
      received = true;
      clearInterval(interval);
      try {
        const next = validateBankPayload(event.data.payload);
        const sources = await identifyBankRows(next);
        if (disposed) return;
        setPayload(next);
        setRows(next.transactions.map((row, i) => ({ source: sources[i], name: row.name, description: row.description,
          categoryId: '', tagIds: [], transfer: false, otherAccountId: '' })));
        setError('');
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'Invalid import draft.'); }
    };
    const request = () => window.postMessage({ type: 'delta-bank-import:request', token }, location.origin);
    window.addEventListener('message', receive);
    const interval = setInterval(request, 700);
    request();
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!received && !disposed) setError('No userscript response. Enable the Delta userscript on this site, then reload this page.');
    }, 10000);
    return () => { disposed = true; clearInterval(interval); clearTimeout(timeout); window.removeEventListener('message', receive); };
  }, [token, discarded]);

  const patch = (index: number, changes: Partial<ReviewRow>) => setRows(old => old.map((row, i) => i === index ? { ...row, ...changes } : row));
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
    return Boolean(account) && !info.exact && (rows[index].selected ?? (!info.matches.length && !info.repeated));
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
            tagIds: row.tagIds.filter(id => tags.some(t => t.id === id)), status: 'normal',
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
    window.postMessage({ type: 'delta-bank-import:clear', token }, location.origin);
    history.replaceState(null, '', location.pathname);
    setDiscarded(true);
    setRows([]);
    setPayload(null);
    setError('');
    setMessage('Draft cleared. Saved transactions remain in Delta.');
  }

  return <PageContainer title="Bank import">
    <div className="space-y-5">
      <Link to="/home" className="text-sm underline">Back to transactions</Link>
      {error && <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm">{error}</p>}
      {bankImportError && <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm">{bankImportError}</p>}
      {message && <p role="status" className="rounded-2xl bg-emerald-500/10 p-4 text-sm">{message}</p>}
      {!payload && <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-5 space-y-3">
        <h2 className="font-bold">Connect your bank pages</h2>
        <p className="text-sm">Install the Delta script in Tampermonkey, then open your CIC or BoursoBank transaction list. A draft opens here automatically. Nothing is saved until you validate.</p>
        <a className="inline-block underline font-medium" href="/delta-bank-import.user.js">Install Delta userscript</a>
        <p className="text-sm opacity-70">Only loaded, booked EUR transactions are collected. Use your bank’s “Plus d’opérations” or “Mouvements précédents” to load older entries, then click the Delta button again.</p>
        {token && !error && !discarded && <p role="status">Waiting for your bank draft…</p>}
      </div>}
      {payload && <>
        <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-5 space-y-3">
          <h2 className="font-bold">{payload.bank === 'cic' ? 'CIC' : 'BoursoBank'} · {rows.length} loaded transactions</h2>
          <p className="text-sm opacity-70">Booking dates · EUR · review before saving. Bank categories are shown as hints.</p>
          {payload.warnings.map((warning, i) => <p key={i} className="text-sm">{warning}</p>)}
          {payload.bank === 'cic' && <p className="text-sm">Identical CIC payments may match differently when you load a partial date range. Matching rows are left unchecked for review.</p>}
          <label className="block text-sm font-medium">Delta account for this bank account
            <select className={`${selectClass} mt-2`} value={accountId} disabled={busy || rows.some(r => r.saved)} onChange={e => {
              setAccountId(e.target.value);
              setRows(old => old.map(row => ({ ...row, selected: undefined, share: undefined, otherAccountId: '' })));
            }}>
              <option value="">Choose an account</option>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          {!activeAccounts.length && <Link to="/accounts" className="underline text-sm">Create an account first</Link>}
          {settings.currency !== 'EUR' && <p role="alert" className="text-sm">This import is in EUR. Change Delta’s currency to EUR before importing; currency conversion is not supported.</p>}
          <p className="text-sm">For transfers between your accounts, import one side as a transfer and skip the matching entry from the other bank.</p>
        </div>
        {loading || !bankImportReady ? <p role="status">Loading your existing transactions…</p> : rows.map((row, i) => {
          const original = payload.transactions[i];
          const info = duplicate(i);
          const disabled = busy || info.exact;
          const type = original.amountCents > 0 ? 'income' : 'expense';
          return <fieldset key={row.source.key} disabled={disabled} className="rounded-2xl border border-black/10 dark:border-white/10 p-4 space-y-3 min-w-0">
            <legend className="px-1 text-sm">{original.date} · {(original.amountCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</legend>
            <label className="flex items-start gap-3 font-medium">
              <input type="checkbox" className="mt-1" checked={isSelected(i)} disabled={disabled || !account} onChange={e => patch(i, { selected: e.target.checked })} />
              <span className="break-words">{original.name}</span>
            </label>
            {info.exact && <p className="text-sm text-emerald-700 dark:text-emerald-400">{row.saved || 'Already imported'}</p>}
            {!!info.matches.length && !info.exact && <p className="text-sm text-amber-700 dark:text-amber-400">Possible duplicate: {info.matches.map(t => t.name).slice(0, 3).join(', ')}. Same date and amount; select only if this is another transaction.</p>}
            {info.repeated && !info.exact && <p className="text-sm text-amber-700 dark:text-amber-400">Identical payments occur in this draft. Select each legitimate payment explicitly.</p>}
            {row.error && <p role="alert" className="text-sm text-red-600">{row.error}</p>}
            {!info.exact && <>
              <label className="block text-xs">Name<Input value={row.name} maxLength={500} onChange={e => patch(i, { name: e.target.value })} /></label>
              <label className="block text-xs">Type
                <select className={selectClass} value={row.transfer ? 'transfer' : type} onChange={e => patch(i, { transfer: e.target.value === 'transfer' })}>
                  <option value={type}>{type === 'income' ? 'Income' : 'Expense'}</option><option value="transfer">Transfer between my accounts</option>
                </select>
              </label>
              {row.transfer ? <label className="block text-xs">{type === 'income' ? 'From account' : 'To account'}
                <select className={selectClass} value={row.otherAccountId} onChange={e => patch(i, { otherAccountId: e.target.value })}>
                  <option value="">Choose the other account</option>
                  {activeAccounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label> : <label className="block text-xs">Category · bank hint: {original.bankCategory || 'none'}
                <select className={selectClass} value={row.categoryId || defaultCategory(i)} onChange={e => patch(i, { categoryId: e.target.value })}>
                  <option value="">Choose a category</option>
                  {categories.filter(c => !c.type || c.type === 'both' || c.type === type).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>}
              {account?.isShared && !row.transfer && <label className="block text-xs">My share (%)<Input type="number" min={0} max={100} step="any" value={row.share ?? (account.defaultMyShareRatio ?? 0.5) * 100} onChange={e => patch(i, { share: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>}
              {!!tags.length && <details><summary className="text-xs cursor-pointer">Tags ({row.tagIds.length})</summary><div className="flex flex-wrap gap-3 py-2">
                {tags.map(tag => <label key={tag.id} className="text-xs flex items-center gap-1"><input type="checkbox" checked={row.tagIds.includes(tag.id)} onChange={e => patch(i, { tagIds: e.target.checked ? [...row.tagIds, tag.id] : row.tagIds.filter(id => id !== tag.id) })} />{tag.label}</label>)}
              </div></details>}
              <label className="block text-xs">Notes<Input value={row.description} maxLength={2000} onChange={e => patch(i, { description: e.target.value })} /></label>
            </>}
          </fieldset>;
        })}
        <div className="sticky bottom-24 p-3 rounded-2xl bg-background border border-black/10 dark:border-white/10 space-y-2 shadow-lg">
          <Button className="w-full" onClick={save} disabled={busy || loading || !bankImportReady || !selectedCount || settings.currency !== 'EUR'}>{busy ? 'Saving…' : `Validate ${selectedCount} transactions`}</Button>
          <Button className="w-full" variant="ghost" onClick={discard} disabled={busy}>Clear draft</Button>
        </div>
      </>}
    </div>
  </PageContainer>;
}
