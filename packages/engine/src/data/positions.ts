import type { Position } from '../types.js';

export const HIT_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const;
export type FieldPos = (typeof HIT_POS)[number];
export const PIT_POS = ['SP', 'RP'] as const;
export type PitPos = (typeof PIT_POS)[number];

export const POS_DEF: Partial<Record<Position, number>> = {
  C: 1.25, SS: 1.2, CF: 1.15, '2B': 1.1, '3B': 1.05, RF: 0.95, LF: 0.9, '1B': 0.85, DH: 0.4
};

export const ROSTER_MAX = 22;
export const ROSTER_MIN = 15;
export const SEASON_WEEKS = 18;
export const GAMES_PER_WEEK = 3;
