import { Shift, Mutation, ShiftInput } from '../types/index';
import { nextShiftId } from './shiftIds';

function buildShift(input: ShiftInput, id: string): Shift {
  const shift: Shift = {
    id,
    name: input.name || 'Auto Associate',
    role: input.role || 'Associate',
    type: input.type === 'FT' ? 'FT' : 'PT',
    start: typeof input.start === 'number' ? input.start : 9,
    duration: typeof input.duration === 'number' ? input.duration : 8,
  };
  if (input.meal && typeof input.meal.start === 'number' && typeof input.meal.duration === 'number') {
    shift.meal = { start: input.meal.start, duration: input.meal.duration };
  }
  return shift;
}

function sanitizeUpdates(input: ShiftInput): Partial<Shift> {
  const updates: Partial<Shift> = {};
  if (typeof input.name === 'string') updates.name = input.name;
  if (typeof input.role === 'string') updates.role = input.role;
  if (input.type === 'FT' || input.type === 'PT') updates.type = input.type;
  if (typeof input.start === 'number') updates.start = input.start;
  if (typeof input.duration === 'number') updates.duration = input.duration;
  if (input.meal && typeof input.meal.start === 'number' && typeof input.meal.duration === 'number') {
    updates.meal = { start: input.meal.start, duration: input.meal.duration };
  }
  return updates;
}

export interface MutationResult {
  shifts: Shift[];
  targets?: number[];
}

/**
 * Pure mutation engine shared by the chat copilot, optimizer follow-ups, and
 * audit Auto-Fix. Normalizes the `remove_shift` alias to `delete_shift` and
 * supports `adjust_shift` partial updates so audit corrections actually apply.
 */
export function applyMutations(shifts: Shift[], mutations: Mutation[]): MutationResult {
  let next = [...shifts];
  let targets: number[] | undefined;

  for (const mutation of mutations) {
    if (!mutation || !mutation.type) continue;
    const type = mutation.type === 'remove_shift' ? 'delete_shift' : mutation.type;

    if (type === 'add_shift' && mutation.shift) {
      next.push(buildShift(mutation.shift, nextShiftId(next)));
    } else if (type === 'delete_shift' && mutation.shiftId) {
      next = next.filter(s => s.id !== mutation.shiftId);
    } else if (type === 'adjust_shift' && mutation.shiftId && mutation.shift) {
      const updates = sanitizeUpdates(mutation.shift);
      next = next.map(s => (s.id === mutation.shiftId ? { ...s, ...updates } : s));
    } else if (type === 'clear_all') {
      next = [];
    } else if (type === 'set_targets' && Array.isArray(mutation.targets)) {
      targets = mutation.targets;
    }
  }

  return { shifts: next, targets };
}
