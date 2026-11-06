/** Allocate cents by weight, distributing rounding remainders deterministically. */
export function splitGroupTotal(total: number, weights: number[]): number[] {
  const cents = Math.round(total * 100);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(total) || cents <= 0 || !sum || weights.some(w => !Number.isFinite(w) || w <= 0)) return weights.map(() => 0);
  const raw = weights.map(w => cents * w / sum);
  const amounts = raw.map(Math.floor);
  const order = raw.map((n, i) => ({ i, remainder: n - amounts[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const remaining = cents - amounts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) amounts[order[i].i]++;
  return amounts.map(n => n / 100);
}
