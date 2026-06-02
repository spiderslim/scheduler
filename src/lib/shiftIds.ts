import { Shift } from '../types/index';

/**
 * Generate the next unique shift id. Robust to any existing id format
 * (`e1`, `e_gen_1700000000_0`, etc.): it extracts the first run of digits and
 * never produces `eNaN`, which previously caused duplicate React keys after an
 * AI optimize pass.
 */
export function nextShiftId(shifts: Shift[]): string {
  let max = 0;
  for (const s of shifts) {
    const match = s.id.match(/\d+/);
    const num = match ? parseInt(match[0], 10) : 0;
    if (!Number.isNaN(num) && num > max) {
      max = num;
    }
  }
  return `e${max + 1}`;
}
