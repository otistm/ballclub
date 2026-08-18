import type { SponsorSpec, Team } from '../types.js';

export const SPONSOR_POOL: readonly SponsorSpec[] = [
  { name: 'Ashland Mutual', kind: 'gate', base: 240000, req: 'Draw 12,000 a night' },
  { name: 'Rowe & Sons Hardware', kind: 'flat', base: 120000, req: 'None. They just like you.' },
  { name: 'Bitter Creek Soda', kind: 'con', base: 300000, req: 'Concourse level 2+' },
  { name: 'Verdon Air', kind: 'win', base: 420000, req: 'Winning record' },
  { name: 'Copperfield Bank', kind: 'win', base: 700000, req: 'Top three in the league' },
  { name: 'Kestrel Tire', kind: 'flat', base: 200000, req: 'None' },
  { name: 'Marrow Bay Ferries', kind: 'gate', base: 360000, req: 'Draw 18,000 a night' },
  { name: 'Tinsley Cigarettes', kind: 'flat', base: 900000, req: 'Fan trust drops 8 for signing', penalty: { trust: -8 } },
  { name: 'Glass Lake Brewing', kind: 'con', base: 480000, req: 'Concourse level 3' },
  { name: 'Hollis Steel', kind: 'flat', base: 340000, req: 'Grandstand level 2+' }
];

/**
 * Requirement checks live in code (never serialized), keyed by sponsor name.
 * `att` is the attendance figure for the week being evaluated.
 */
const CHECKS: Record<string, (t: Team, att: number) => boolean> = {
  'Ashland Mutual': (_t, att) => att >= 12000,
  'Rowe & Sons Hardware': () => true,
  'Bitter Creek Soda': (t) => (t.stadium.food || 0) >= 1,
  'Verdon Air': (t) => t.w >= t.l,
  'Copperfield Bank': (t) => t.rank <= 3,
  'Kestrel Tire': () => true,
  'Marrow Bay Ferries': (_t, att) => att >= 18000,
  'Tinsley Cigarettes': () => true,
  'Glass Lake Brewing': (t) => (t.stadium.food || 0) >= 2,
  'Hollis Steel': (t) => (t.stadium.seats || 0) >= 1
};

export function sponsorCheck(name: string, team: Team, att: number): boolean {
  const fn = CHECKS[name];
  return fn ? fn(team, att) : true;
}
