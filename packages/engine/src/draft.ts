import { gauss, mulberry32 } from './rng.js';
import { CLASSES } from './data/classes.js';
import { PIT_POS, ROSTER_MAX } from './data/positions.js';
import { shownOvr } from './player.js';
import { noteOffice } from './progress.js';
import { autoAssignField, fieldComplete } from './lineup.js';
import type { DraftSlot, League, Player, Position, Team } from './types.js';

export const DRAFT_WANT: Partial<Record<Position, number>> = {
  SP: 5, RP: 5, C: 2, '1B': 1, '2B': 2, '3B': 1, SS: 2, LF: 1, CF: 2, RF: 1, DH: 1
};

export function draftCurrent(league: League): DraftSlot | null {
  return league.draftOrder[league.draftIdx] || null;
}

export interface DraftStatus {
  cur: DraftSlot | null;
  overall: number;
  total: number;
  mine: boolean;
  untilYou: number;
  yoursLeft: number;
}

export function draftStatus(league: League, teamId: string): DraftStatus {
  const cur = draftCurrent(league);
  let untilYou = 0;
  for (let i = league.draftIdx; i < league.draftOrder.length; i++) {
    if (league.draftOrder[i].teamId === teamId) break;
    untilYou++;
  }
  const yoursLeft = league.draftOrder.slice(league.draftIdx).filter((s) => s.teamId === teamId).length;
  return {
    cur,
    overall: league.draftIdx + 1,
    total: league.draftOrder.length,
    mine: !!(cur && cur.teamId === teamId),
    untilYou,
    yoursLeft
  };
}

export function rosterGaps(team: Team): { pos: Position; have: number; want: number }[] {
  const counts: Partial<Record<Position, number>> = {};
  team.roster.forEach((x) => (counts[x.pos] = (counts[x.pos] || 0) + 1));
  return (Object.keys(DRAFT_WANT) as Position[])
    .map((pos) => ({ pos, have: counts[pos] || 0, want: DRAFT_WANT[pos]! }))
    .filter((g) => g.have < g.want)
    .sort((a, b) => (b.want - b.have) - (a.want - a.have));
}

export function needScore(team: Team, p: Player): number {
  const counts: Partial<Record<Position, number>> = {};
  team.roster.forEach((x) => (counts[x.pos] = (counts[x.pos] || 0) + 1));
  const have = counts[p.pos] || 0;
  const need = (DRAFT_WANT[p.pos] || 1) - have;
  return need > 0 ? 1 + need * 0.06 : 0.72;
}

export function aiEvalDraft(team: Team, p: Player): number {
  const c = CLASSES[team.cls];
  const seen = shownOvr(p).v;
  let s = seen + (p.pot - p.ovr) * (c.mods.prospectGrowth > 1.2 ? 0.55 : 0.25);
  const b = c.bias;
  const keys = PIT_POS.includes(p.pos as 'SP' | 'RP')
    ? (['stuff', 'ctl', 'mov', 'stam'] as const)
    : (['con', 'pow', 'eye', 'spd', 'fld'] as const);
  keys.forEach((k) => {
    s += ((p.r[k] - 50) / 18) * (b[k] || 0) * 0.22;
  });
  s *= needScore(team, p);
  s -= p.salary / 900000;
  return s;
}

export function aiDraftPick(league: League, team: Team): Player | null {
  const pool = league.draftPool;
  if (!pool.length) return null;
  const rng = mulberry32(league.seed + league.draftIdx * 37);
  const scored = pool
    .map((p) => ({ p, s: aiEvalDraft(team, p) + gauss(rng, 0, 3.2) }))
    .sort((a, b) => b.s - a.s);
  return scored[0].p;
}

export interface PickResult {
  ok: boolean;
  err?: string;
  player?: Player;
}

export function makePick(league: League, teamId: string, playerId: string): PickResult {
  const cur = draftCurrent(league);
  if (!cur || cur.teamId !== teamId) return { ok: false, err: 'Not your pick' };
  const i = league.draftPool.findIndex((p) => p.id === playerId);
  if (i < 0) return { ok: false, err: 'Player is gone' };
  const p = league.draftPool.splice(i, 1)[0];
  const team = league.teams.find((t) => t.id === teamId)!;
  if (team.roster.length >= ROSTER_MAX) {
    league.draftPool.splice(i, 0, p);
    return { ok: false, err: 'Roster is full at ' + ROSTER_MAX };
  }
  p.teamId = teamId;
  p.origin = 'draft';
  p.scouted = 1;
  team.roster.push(p);
  league.draftIdx++;
  league.log.push({
    draft: true, round: cur.round, teamId, playerId: p.id,
    txt: team.abbr + ' select ' + p.name + ' (' + p.pos + ')'
  });
  if (team.isHuman) noteOffice(team, 'drafts', 18, 'Draft pick');
  if (league.draftIdx >= league.draftOrder.length) {
    league.phase = 'regular';
    league.freeAgents = league.freeAgents.concat(league.draftPool);
    league.draftPool = [];
    // Seed every club's diamond; humans can rearrange before first pitch
    league.teams.forEach((t) => {
      if (!fieldComplete(t)) t.fieldIds = autoAssignField(t);
    });
  }
  return { ok: true, player: p };
}

export interface AutoPick {
  teamId: string;
  player: Player;
  round: number;
}

export function autoDraftUntilHuman(
  league: League, maxPicks?: number, idleIds?: Iterable<string>
): AutoPick[] {
  const idle = idleIds ? new Set(idleIds) : new Set<string>();
  const picks: AutoPick[] = [];
  let guard = 0;
  while (league.phase === 'draft' && guard++ < (maxPicks || 200)) {
    const cur = draftCurrent(league);
    if (!cur) break;
    const team = league.teams.find((t) => t.id === cur.teamId)!;
    if (team.isHuman && !idle.has(team.id)) break;
    if (team.roster.length >= ROSTER_MAX) {
      league.draftIdx++;
      continue;
    }
    const p = aiDraftPick(league, team);
    if (!p) break;
    const r = makePick(league, team.id, p.id);
    if (!r.ok) {
      league.draftIdx++;
      continue;
    }
    picks.push({ teamId: team.id, player: r.player!, round: cur.round });
  }
  return picks;
}
