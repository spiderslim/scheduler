import { describe, it, expect } from 'vitest';
import { computeHourlyCoverage, shiftWorkInHour, summarizeCoverage } from '../coverage';
import { DAY_START, DAY_SPAN, Shift } from '../../types/index';

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'e1',
    name: 'Test Person',
    role: 'Cashier',
    type: 'FT',
    start: 8,
    duration: 4,
    ...overrides,
  };
}

describe('computeHourlyCoverage', () => {
  it('returns zero coverage for every hour with an empty roster', () => {
    const targets = Array.from({ length: DAY_SPAN }, () => 2);
    const coverage = computeHourlyCoverage([], targets);

    expect(coverage).toHaveLength(DAY_SPAN);
    expect(coverage[0].hour).toBe(DAY_START);
    expect(coverage[DAY_SPAN - 1].hour).toBe(DAY_START + DAY_SPAN - 1);
    for (const c of coverage) {
      expect(c.scheduled).toBe(0);
      expect(c.target).toBe(2);
      expect(c.delta).toBe(-2);
    }
  });

  it('treats missing targets as zero', () => {
    const coverage = computeHourlyCoverage([], []);
    for (const c of coverage) {
      expect(c.target).toBe(0);
      expect(c.delta).toBe(0);
    }
  });

  it('covers exactly the hours a single shift spans', () => {
    const shift = makeShift({ start: 8, duration: 4 }); // 8am-12pm, no meal
    const coverage = computeHourlyCoverage([shift], []);

    for (const c of coverage) {
      const expected = c.hour >= 8 && c.hour < 12 ? 1 : 0;
      expect(c.scheduled).toBe(expected);
    }
  });

  it('handles fractional shift boundaries', () => {
    const shift = makeShift({ start: 8.5, duration: 2 }); // 8:30-10:30
    const coverage = computeHourlyCoverage([shift], []);
    const byHour = new Map(coverage.map((c) => [c.hour, c.scheduled]));

    expect(byHour.get(8)).toBe(0.5);
    expect(byHour.get(9)).toBe(1);
    expect(byHour.get(10)).toBe(0.5);
    expect(byHour.get(11)).toBe(0);
  });
});

describe('meal deduction', () => {
  it('subtracts the meal break from the covered hour', () => {
    const shift = makeShift({ start: 8, duration: 8, meal: { start: 12, duration: 1 } });
    const coverage = computeHourlyCoverage([shift], []);
    const byHour = new Map(coverage.map((c) => [c.hour, c.scheduled]));

    expect(byHour.get(11)).toBe(1);
    expect(byHour.get(12)).toBe(0); // fully on break
    expect(byHour.get(13)).toBe(1);
  });

  it('splits a meal that straddles an hour boundary', () => {
    const shift = makeShift({ start: 8, duration: 8, meal: { start: 12.5, duration: 1 } });

    expect(shiftWorkInHour(shift, 12)).toBe(0.5);
    expect(shiftWorkInHour(shift, 13)).toBe(0.5);
    expect(shiftWorkInHour(shift, 14)).toBe(1);
  });

  it('ignores the meal for hours the shift does not cover', () => {
    const shift = makeShift({ start: 8, duration: 4, meal: { start: 10, duration: 1 } });
    expect(shiftWorkInHour(shift, 14)).toBe(0);
  });
});

describe('out-of-bounds meal clamping', () => {
  it('clamps a meal starting after the shift end back inside the shift', () => {
    // Shift 8am-12pm, meal nominally at 8pm: clamped to start at 11am.
    const shift = makeShift({ start: 8, duration: 4, meal: { start: 20, duration: 1 } });

    expect(shiftWorkInHour(shift, 10)).toBe(1);
    expect(shiftWorkInHour(shift, 11)).toBe(0);
  });

  it('clamps a meal starting before the shift start up to the shift start', () => {
    // Shift 8am-12pm, meal nominally at 5am: clamped to start at 8am.
    const shift = makeShift({ start: 8, duration: 4, meal: { start: 5, duration: 1 } });

    expect(shiftWorkInHour(shift, 8)).toBe(0);
    expect(shiftWorkInHour(shift, 9)).toBe(1);
  });

  it('clamps a meal that would only partially overhang the shift end', () => {
    // Shift 8am-12pm, meal at 11:30 for 1h: clamped to 11:00-12:00.
    const shift = makeShift({ start: 8, duration: 4, meal: { start: 11.5, duration: 1 } });

    expect(shiftWorkInHour(shift, 11)).toBe(0);
    expect(shiftWorkInHour(shift, 10)).toBe(1);
  });
});

describe('summarizeCoverage', () => {
  it('reports 100 when there are no targets at all', () => {
    const summary = summarizeCoverage([]);
    expect(summary).toEqual({ coverageScore: 100, totalTargetUnits: 0, satisfiedUnits: 0 });
  });

  it('does not let overstaffing in one hour mask understaffing in another', () => {
    const coverage = [
      { hour: 8, scheduled: 5, target: 2, delta: 3 }, // heavily overstaffed
      { hour: 9, scheduled: 0, target: 2, delta: -2 }, // completely uncovered
    ];
    const summary = summarizeCoverage(coverage);

    // Surplus is capped per hour: only 2 of 4 target units are satisfied.
    expect(summary.totalTargetUnits).toBe(4);
    expect(summary.satisfiedUnits).toBe(2);
    expect(summary.coverageScore).toBe(50);
  });

  it('reports 100 when every hour meets its target exactly', () => {
    const coverage = [
      { hour: 8, scheduled: 2, target: 2, delta: 0 },
      { hour: 9, scheduled: 3, target: 3, delta: 0 },
    ];
    expect(summarizeCoverage(coverage).coverageScore).toBe(100);
  });

  it('counts partial coverage of an hour proportionally', () => {
    const coverage = [{ hour: 8, scheduled: 1.5, target: 2, delta: -0.5 }];
    const summary = summarizeCoverage(coverage);

    expect(summary.satisfiedUnits).toBe(1.5);
    expect(summary.coverageScore).toBe(75);
  });
});
