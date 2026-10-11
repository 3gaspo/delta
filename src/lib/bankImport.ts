import type { Transaction } from '../types';

export interface BankRow {
  status?: 'normal' | 'pending';
  sourceId?: string;
  date: string;
  amountCents: number;
  name: string;
  description: string;
  bankCategory: string;
}
export interface BankPayload {
  version: 1 | 2;
  bank: 'cic' | 'boursobank';
  accountRef: string;
  currency: 'EUR';
  transactions: BankRow[];
  warnings: string[];
}
export interface BankImportSource {
  status?: 'normal' | 'pending';
  key: string;
  bank: BankPayload['bank'];
  accountRef: string;
  sourceId?: string;
  date: string;
  amountCents: number;
  description: string;
}
export function localBookingDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid booking date.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (year < 1900 || year > 2200 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error('Invalid booking date.');
  return date.getTime();
}
export function validateBankPayload(input: unknown): BankPayload {
  const p = input as BankPayload;
  if (!p || ![1, 2].includes(p.version) || !['cic', 'boursobank'].includes(p.bank) || p.currency !== 'EUR' || !/^[a-f0-9]{64}$/.test(p.accountRef || '') || !Array.isArray(p.transactions) || !p.transactions.length || p.transactions.length > 1000) throw new Error('Invalid bank import. Collect transactions again using the Delta userscript.');
  const cleanString = (s: unknown, max: number, required = false): string => {
    if (typeof s !== 'string' || s.length > max || (required && !s.trim())) throw new Error('Invalid transaction text.');
    return s.trim();
  };
  const seen = new Set<string>();
  const transactions = p.transactions.map(row => {
    if (!row || !Number.isSafeInteger(row.amountCents) || !row.amountCents || Math.abs(row.amountCents) > 100_000_000_000) throw new Error('Invalid transaction amount.');
    localBookingDate(row.date);
    if (row.status !== undefined && row.status !== 'normal' && row.status !== 'pending') throw new Error('Invalid transaction status.');
    const sourceId = row.sourceId === undefined ? undefined : cleanString(row.sourceId, 500, true);
    if (p.bank === 'boursobank' && !sourceId) throw new Error('Missing bank transaction ID.');
    if (sourceId && seen.has(sourceId)) throw new Error('Repeated bank transaction ID in this draft.');
    if (sourceId) seen.add(sourceId);
    return { sourceId, date: row.date, amountCents: row.amountCents, status: row.status || 'normal',
      name: cleanString(row.name, 500, true), description: cleanString(row.description, 2000, true), bankCategory: cleanString(row.bankCategory, 300) };
  });
  if (!Array.isArray(p.warnings) || p.warnings.length > 20) throw new Error('Invalid import warnings.');
  return { version: p.version, bank: p.bank, accountRef: p.accountRef, currency: 'EUR', transactions, warnings: p.warnings.map(w => cleanString(w, 1000)) };
}
export async function identifyBankRows(payload: BankPayload): Promise<BankImportSource[]> {
  const occurrences = new Map<string, number>();
  return Promise.all(payload.transactions.map(async row => {
    const signature = JSON.stringify([row.date, row.amountCents, row.description]);
    const occurrence = occurrences.get(signature) || 0;
    occurrences.set(signature, occurrence + 1);
    // CIC row IDs are positions, not bank IDs. Include occurrence to preserve identical payments.
    const identity = row.sourceId ? ['id', row.sourceId] : ['fallback', signature, occurrence];
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([payload.bank, payload.accountRef, ...identity])));
    const key = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    return { key, bank: payload.bank, accountRef: payload.accountRef, sourceId: row.sourceId, date: row.date, amountCents: row.amountCents, description: row.description, status: row.status || 'normal' };
  }));
}
export function possibleBankDuplicates(row: BankRow, accountId: string, transactions: Transaction[]): Transaction[] {
  const booking = new Date(localBookingDate(row.date));
  return transactions.filter(t => {
    const date = new Date(t.date);
    const sameDay = date.getFullYear() === booking.getFullYear() && date.getMonth() === booking.getMonth() && date.getDate() === booking.getDate();
    // A booked payment may arrive days after its authorization, with a new ID.
    const pendingMatch = (t.status === 'pending' || row.status === 'pending') && Math.abs(date.getTime() - booking.getTime()) <= 14 * 86400000;
    if (!sameDay && !pendingMatch) return false;
    if (t.isInitialBalance || t.isCorrection) return false;
    const signed = t.type === 'transfer' ? (t.accountId === accountId ? -t.amount : t.transferAccountId === accountId ? t.amount : NaN)
      : t.accountId === accountId ? (t.type === 'income' ? t.amount : -t.amount) : NaN;
    return Math.round(signed * 100) === row.amountCents;
  });
}
