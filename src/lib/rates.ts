/**
 * Estimated hourly labor rates by role keyword. These are rough standard-rate
 * assumptions used for the "Estimated Labor Spending" KPI, not real payroll data.
 */
export const ROLE_RATES: ReadonlyArray<{ keywords: string[]; rate: number }> = [
  { keywords: ['supervisor', 'manager'], rate: 25 },
  { keywords: ['baker', 'chef'], rate: 18 },
  { keywords: ['barista', 'cashier'], rate: 15 },
];

export const DEFAULT_LABOR_RATE = 14;

export function getLaborRate(role: string): number {
  const r = role.toLowerCase();
  for (const { keywords, rate } of ROLE_RATES) {
    if (keywords.some(k => r.includes(k))) return rate;
  }
  return DEFAULT_LABOR_RATE;
}
