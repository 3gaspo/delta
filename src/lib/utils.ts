import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { formatCurrency, formatDate } from './uiFormats';

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
