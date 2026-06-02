export const DAY_START = 5;
export const DAY_END = 22;
export const DAY_SPAN = DAY_END - DAY_START;

export interface Meal {
  start: number;
  duration: number;
}

export interface Shift {
  id: string;
  name: string;
  role: string;
  type: 'FT' | 'PT';
  start: number;
  duration: number;
  meal?: Meal;
}

export interface Template {
  id: string;
  name: string;
  shifts: Shift[];
  targets: number[];
}

/**
 * Loosely-typed shift fields coming from the Gemini API. The model may omit
 * fields or send partials, so everything is optional and gets sanitized when a
 * mutation is applied.
 */
export interface ShiftInput {
  name?: string;
  role?: string;
  type?: 'FT' | 'PT';
  start?: number;
  duration?: number;
  meal?: Meal;
}

/**
 * The action vocabulary shared between the Gemini endpoints and the client
 * mutation engine. `remove_shift` is an alias the auditor emits for
 * `delete_shift`; both are normalized in applyMutations.
 */
export type MutationType =
  | 'add_shift'
  | 'delete_shift'
  | 'remove_shift'
  | 'adjust_shift'
  | 'clear_all'
  | 'set_targets';

export interface Mutation {
  type: MutationType;
  shift?: ShiftInput;
  shiftId?: string;
  targets?: number[];
}

export type SuggestedAction = Mutation;

export interface AuditFinding {
  type: 'gap' | 'meal_violation' | 'fatigue' | 'overstaffing' | 'other';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  hour?: number;
  suggestedAction?: SuggestedAction;
}

export const INITIAL_SHIFTS: Shift[] = [
  {
    "id": "e1",
    "name": "Sarah Chen",
    "role": "Supervisor",
    "type": "FT",
    "start": 5,
    "duration": 9,
    "meal": {
      "start": 9,
      "duration": 1
    }
  },
  {
    "id": "e2",
    "name": "Marcus Aurelius",
    "role": "Cashier",
    "type": "FT",
    "start": 6,
    "duration": 9,
    "meal": {
      "start": 10,
      "duration": 1
    }
  },
  {
    "id": "e3",
    "name": "John Doe",
    "role": "Barista",
    "type": "FT",
    "start": 8,
    "duration": 9,
    "meal": {
      "start": 12,
      "duration": 1
    }
  },
  {
    "id": "e4",
    "name": "Emily Wright",
    "role": "Baker",
    "type": "PT",
    "start": 9,
    "duration": 4
  },
  {
    "id": "e5",
    "name": "Chloe Thompson",
    "role": "Stocker",
    "type": "FT",
    "start": 10,
    "duration": 9,
    "meal": {
      "start": 14,
      "duration": 1
    }
  },
  {
    "id": "e6",
    "name": "Alex Rivera",
    "role": "Digital Shopper",
    "type": "FT",
    "start": 12,
    "duration": 9,
    "meal": {
      "start": 16,
      "duration": 1
    }
  },
  {
    "id": "e7",
    "name": "David Kim",
    "role": "Baker",
    "type": "PT",
    "start": 16,
    "duration": 6
  },
  {
    "id": "e8",
    "name": "Jessica Taylor",
    "role": "Cashier",
    "type": "PT",
    "start": 17,
    "duration": 4
  }
];

export const DEFAULT_TARGETS = [1, 2, 2, 3, 3, 4, 4, 5, 5, 3, 2, 3, 4, 4, 3, 2, 1];
