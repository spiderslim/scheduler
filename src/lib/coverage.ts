import { Shift, DAY_START, DAY_SPAN } from '../types/index';
import { clampMealStart, intervalOverlap } from './utils';

export interface HourCoverage {
  hour: number;
  scheduled: number;
  target: number;
  delta: number;
}

/**
 * Worked hours a single shift contributes to the [h, h+1) slot, with the meal
 * break clamped inside the shift bounds and subtracted from the overlap.
 */
export function shiftWorkInHour(shift: Shift, h: number): number {
  const s0 = shift.start;
  const s1 = shift.start + shift.duration;
  let work = intervalOverlap(s0, s1, h, h + 1);

  if (shift.meal && work > 0) {
    const ms = clampMealStart(shift);
    const mealOverlap = intervalOverlap(ms, ms + shift.meal.duration, h, h + 1);
    work = Math.max(0, work - mealOverlap);
  }

  return work;
}

/**
 * Single source of truth for per-hour coverage across the operating day.
 * Consumers (KPI stats, scheduler heatmap, coverage chart) all derive from this.
 */
export function computeHourlyCoverage(shifts: Shift[], targets: number[]): HourCoverage[] {
  return Array.from({ length: DAY_SPAN }).map((_, i) => {
    const hour = DAY_START + i;
    let scheduled = 0;
    for (const shift of shifts) {
      scheduled += shiftWorkInHour(shift, hour);
    }
    const target = targets[i] || 0;
    return { hour, scheduled, target, delta: scheduled - target };
  });
}

export interface CoverageSummary {
  coverageScore: number;
  totalTargetUnits: number;
  satisfiedUnits: number;
}

/**
 * Aggregate adequacy score: how much of the target demand is satisfied,
 * capped per-hour so surplus in one slot can't mask a deficit in another.
 */
export function summarizeCoverage(coverage: HourCoverage[]): CoverageSummary {
  let totalTargetUnits = 0;
  let satisfiedUnits = 0;
  for (const c of coverage) {
    totalTargetUnits += c.target;
    satisfiedUnits += Math.min(c.scheduled, c.target);
  }
  const coverageScore =
    totalTargetUnits === 0 ? 100 : Math.round((satisfiedUnits / totalTargetUnits) * 100);
  return { coverageScore, totalTargetUnits, satisfiedUnits };
}
