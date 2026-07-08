import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'EUR') {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | number | Date) {
  return new Intl.DateTimeFormat('en-IE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function parseMoney(input: string): number {
  if (!input) return 0;
  // Replace comma with dot for parsing
  const cleanInput = input.replace(',', '.').replace(/[^0-9.-]/g, '');
  const val = parseFloat(cleanInput);
  return isNaN(val) ? 0 : val;
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
