import { describe, it, expect } from 'vitest';
import { nextShiftId } from '../shiftIds';
import { Shift } from '../../types/index';

function shiftWithId(id: string): Shift {
  return { id, name: 'Test Person', role: 'Cashier', type: 'FT', start: 8, duration: 4 };
}

describe('nextShiftId', () => {
  it('starts at e1 for an empty roster', () => {
    expect(nextShiftId([])).toBe('e1');
  });

  it('increments past the highest existing numeric id', () => {
    const shifts = ['e1', 'e2', 'e3'].map(shiftWithId);
    expect(nextShiftId(shifts)).toBe('e4');
  });

  it('stays unique when a middle shift was deleted', () => {
    // e2 deleted: the next id must not collide with the remaining e1/e3.
    const shifts = ['e1', 'e3'].map(shiftWithId);
    const id = nextShiftId(shifts);

    expect(id).toBe('e4');
    expect(shifts.some((s) => s.id === id)).toBe(false);
  });

  it('handles legacy generated id formats without producing eNaN', () => {
    const shifts = ['e1', 'e_gen_1700000000_0'].map(shiftWithId);
    const id = nextShiftId(shifts);

    expect(id).toBe('e1700000001');
    expect(id).not.toContain('NaN');
  });

  it('treats ids with no digits as zero', () => {
    const shifts = ['abc', 'shift'].map(shiftWithId);
    expect(nextShiftId(shifts)).toBe('e1');
  });

  it('never produces a duplicate across add/duplicate/delete cycles', () => {
    let shifts = ['e1', 'e2', 'e3'].map(shiftWithId);

    for (let i = 0; i < 20; i++) {
      // Duplicate an existing shift under a fresh id.
      const dup = shiftWithId(nextShiftId(shifts));
      expect(shifts.some((s) => s.id === dup.id)).toBe(false);
      shifts = [...shifts, dup];

      // Delete a shift from the middle every other round.
      if (i % 2 === 0 && shifts.length > 1) {
        shifts = shifts.filter((_, idx) => idx !== Math.floor(shifts.length / 2));
      }

      const ids = shifts.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
