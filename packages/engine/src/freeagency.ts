import { clamp } from './rng.js';
import { ROSTER_MAX } from './data/positions.js';
import { faBonusMul, noteOffice } from './progress.js';
import type { League, Player, Team } from './types.js';

export interface SignResult {
  ok: boolean;
  err?: string;
  player?: Player;
  bonus?: number;
}

export function signFA(league: League, team: Team, playerId: string): SignResult {
  const i = league.freeAgents.findIndex((p) => p.id === playerId);
  if (i < 0) return { ok: false, err: 'Already signed elsewhere' };
  const p = league.freeAgents[i];
  if (team.roster.length >= ROSTER_MAX) {
    return { ok: false, err: 'Roster is full at ' + ROSTER_MAX + '. Release someone first.' };
  }
  const bonus = Math.round(p.salary * 0.5 * faBonusMul(team));
  if (team.cash < bonus) return { ok: false, err: 'Not enough cash for the signing bonus' };
  league.freeAgents.splice(i, 1);
  team.cash -= bonus;
  p.teamId = team.id;
  p.origin = 'fa';
  team.roster.push(p);
  league.log.push({ w: league.week, txt: team.abbr + ' sign ' + p.name });
  noteOffice(team, 'signs', 16, 'Free agent');
  return { ok: true, player: p, bonus };
}

export interface ReleaseResult {
  ok: boolean;
  err?: string;
  dead?: number;
}

export function release(league: League, team: Team, playerId: string): ReleaseResult {
  const i = team.roster.findIndex((p) => p.id === playerId);
  if (i < 0) return { ok: false };
  const p = team.roster[i];
  const dead = Math.round(p.salary * 0.35);
  team.cash = Math.max(-250000, team.cash - dead);
  team.roster.splice(i, 1);
  p.teamId = null;
  league.freeAgents.push(p);
  team.roster.forEach((x) => (x.morale = clamp(x.morale - 1.5, 5, 100)));
  return { ok: true, dead };
}
