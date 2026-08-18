/** Front-office staff hire / fire bumps. Ratings are otherwise frozen at class start. */
import { clamp } from './rng.js';
import type { League, StaffRatings, Team } from './types.js';

export type StaffRole = keyof StaffRatings;

export const STAFF_ROLES: StaffRole[] = ['scout', 'coach', 'trainer', 'analyst'];

export const STAFF_LABELS: Record<StaffRole, string> = {
  scout: 'Head scout',
  coach: 'Hitting coach',
  trainer: 'Trainer',
  analyst: 'Analyst'
};

export const STAFF_INFO: Record<StaffRole, { name: string; does: string; why: string }> = {
  scout: {
    name: 'Head scout',
    does: 'Runs the board. Every week his department chips away at fog on the draft pool and free agents. Focus a position and they work that list first.',
    why: 'A better scout finishes files faster. You see true grades sooner, stop guessing on overall, and spend actions on the right names instead of the loud ones.'
  },
  coach: {
    name: 'Hitting coach',
    does: 'Lives in the cage with the kids. Prospect overall climbs during the season through development ticks. The coach is the big dial on how fast that happens.',
    why: 'Raise him and young bats and arms grow harder each week. Cheap talent becomes expensive talent without you writing a check on the open market.'
  },
  trainer: {
    name: 'Trainer',
    does: 'Keeps arms attached and legs under people. He sits next to the coach on the development formula: recovery, workload, and how much a body can take the next bump.',
    why: 'A stronger trainer means the farm actually sticks. Prospects keep more of their gains and you waste fewer seasons nursing a 22-year-old back from the couch.'
  },
  analyst: {
    name: 'Analyst',
    does: 'The war room. Narrows the scouting fog on every unread file. The bands get tighter even before a full report lands.',
    why: 'Hire up and estimates stop lying to you. You draft and trade with a clearer picture of who is real and who is a mirage.'
  }
};

export interface HireStaffResult {
  ok: boolean;
  err?: string;
  role?: StaffRole;
  from?: number;
  to?: number;
  cost?: number;
}

/** Cost to bump a department one notch (~4 rating points). */
export function staffHireCost(team: Team, role: StaffRole): number {
  const cur = team.staff[role] || 40;
  return Math.round(((cur + 18) * 6500) / 5000) * 5000;
}

export function hireStaff(league: League, team: Team, role: StaffRole): HireStaffResult {
  void league;
  if (STAFF_ROLES.indexOf(role) < 0) return { ok: false, err: 'No such department' };
  const from = team.staff[role] || 40;
  if (from >= 94) return { ok: false, err: 'That office is already stacked' };
  const cost = staffHireCost(team, role);
  if (team.cash < cost) return { ok: false, err: 'Not enough cash' };
  const to = clamp(from + 4, 5, 96);
  team.cash -= cost;
  team.staff[role] = to;
  return { ok: true, role, from, to, cost };
}
