import { PIT_POS, POS_DEF, HIT_POS, type FieldPos } from './data/positions.js';
import { has } from './player.js';
import { clamp } from './rng.js';
import type { Player, Position, Strategy, Team, Throws } from './types.js';

export type { FieldPos };

export interface LineupPlan {
  lineup: Player[];
  sps: Player[];
  rps: Player[];
  defZ: number;
  /** Players standing at each HIT_POS when field is set */
  field?: Partial<Record<FieldPos, Player>>;
}

function byIds(roster: Player[], ids: string[] | null | undefined): Player[] {
  if (!ids || !ids.length) return [];
  const out: Player[] = [];
  const seen = new Set<string>();
  ids.forEach((id) => {
    if (seen.has(id)) return;
    const p = roster.find((x) => x.id === id);
    if (p && !p.injured) {
      seen.add(id);
      out.push(p);
    }
  });
  return out;
}

export function effectiveStrategy(team: Team): Strategy {
  const s = {
    patience: team.strategy?.patience ?? 0.5,
    aggression: team.strategy?.aggression ?? 0.5,
    bullpenHook: team.strategy?.bullpenHook ?? 0.5
  };
  const w = team.weekBoost;
  if (w) {
    if (w.patience != null) s.patience = clamp(s.patience + w.patience, 0.05, 0.95);
    if (w.aggression != null) s.aggression = clamp(s.aggression + w.aggression, 0.05, 0.95);
  }
  return s;
}

export function isHitter(p: Player): boolean {
  return (PIT_POS as readonly string[]).indexOf(p.pos) < 0;
}

/** Drop field / lineup / rotation ids that no longer sit on the roster. */
export function scrubTeamAssignments(team: Team): void {
  const on = new Set(team.roster.map((p) => p.id));
  if (team.fieldIds) {
    const next: Partial<Record<Position, string>> = {};
    HIT_POS.forEach((pos) => {
      const id = team.fieldIds![pos];
      if (id && on.has(id)) next[pos] = id;
    });
    team.fieldIds = Object.keys(next).length ? next : null;
  }
  if (team.lineupIds) {
    team.lineupIds = team.lineupIds.filter((id) => on.has(id));
    if (!team.lineupIds.length) team.lineupIds = null;
  }
  if (team.rotationIds) {
    team.rotationIds = team.rotationIds.filter((id) => on.has(id));
    if (!team.rotationIds.length) team.rotationIds = null;
  }
}

/**
 * Every HIT_POS filled with a unique healthy hitter, plus at least one healthy SP.
 */
export function fieldComplete(team: Team): boolean {
  if (!team.fieldIds) return false;
  const used = new Set<string>();
  for (const pos of HIT_POS) {
    const id = team.fieldIds[pos];
    if (!id) return false;
    const p = team.roster.find((x) => x.id === id);
    if (!p || p.injured || !isHitter(p)) return false;
    if (used.has(id)) return false;
    used.add(id);
  }
  return team.roster.some((p) => p.pos === 'SP' && !p.injured);
}

/** Humans need a set field before the calendar can turn. */
export function rosterReady(team: Team): boolean {
  if (!team.isHuman) return true;
  return fieldComplete(team);
}

export function fieldVacancies(team: Team): FieldPos[] {
  return HIT_POS.filter((pos) => {
    const id = team.fieldIds?.[pos];
    if (!id) return true;
    const p = team.roster.find((x) => x.id === id);
    return !p || p.injured || !isHitter(p);
  });
}

function slotScore(p: Player, slot: FieldPos): number {
  const fit = p.pos === slot ? 18 : p.pos === 'DH' && slot !== 'DH' ? -10 : slot === 'DH' ? 4 : 0;
  return p.r.fld * (POS_DEF[slot] || 1) + fit + p.ovr * 0.15;
}

/** Greedy natural-position fill — used by Auto and AI clubs. */
export function autoAssignField(team: Team): Partial<Record<FieldPos, string>> {
  const hitters = team.roster.filter((p) => isHitter(p) && !p.injured);
  const used = new Set<string>();
  const out: Partial<Record<FieldPos, string>> = {};
  const order = HIT_POS.slice().sort((a, b) => (POS_DEF[b] || 1) - (POS_DEF[a] || 1));
  for (const slot of order) {
    let best: Player | null = null;
    let bestScore = -1e9;
    for (const p of hitters) {
      if (used.has(p.id)) continue;
      const score = slotScore(p, slot);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) continue;
    used.add(best.id);
    out[slot] = best.id;
  }
  return out;
}

export function playersAtField(team: Team): Partial<Record<FieldPos, Player>> {
  const out: Partial<Record<FieldPos, Player>> = {};
  if (!team.fieldIds) return out;
  HIT_POS.forEach((pos) => {
    const id = team.fieldIds![pos];
    if (!id) return;
    const p = team.roster.find((x) => x.id === id && !x.injured && isHitter(x));
    if (p) out[pos] = p;
  });
  return out;
}

/**
 * Defense from assigned slots when complete; otherwise greedy from the nine batters.
 */
export function fieldingZ(lineup: Player[], field?: Partial<Record<FieldPos, Player>>): number {
  if (field && HIT_POS.every((pos) => field[pos])) {
    let sum = 0;
    let n = 0;
    HIT_POS.forEach((slot) => {
      const p = field[slot]!;
      const pen = p.pos === slot || slot === 'DH' ? 1 : 0.82;
      sum += p.r.fld * (POS_DEF[slot] || 1) * pen;
      n++;
    });
    return ((sum / Math.max(1, n)) - 50) / 18;
  }
  const pool = lineup.slice();
  const used = new Set<string>();
  let sum = 0;
  let n = 0;
  const order = HIT_POS.slice().sort((a, b) => (POS_DEF[b] || 1) - (POS_DEF[a] || 1));
  for (const slot of order) {
    let best: Player | null = null;
    let bestScore = -1e9;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const fit = p.pos === slot ? 14 : p.pos === 'DH' && slot !== 'DH' ? -8 : 0;
      const score = p.r.fld * (POS_DEF[slot] || 1) + fit;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) continue;
    used.add(best.id);
    const pen = best.pos === slot || slot === 'DH' ? 1 : 0.82;
    sum += best.r.fld * (POS_DEF[slot] || 1) * pen;
    n++;
  }
  return ((sum / Math.max(1, n)) - 50) / 18;
}

function platoonFit(p: Player, vs: Throws | undefined): number {
  if (!vs) return 0;
  if (p.bats === 'S') return 2;
  if (p.bats === 'L' && vs === 'R') return 5;
  if (p.bats === 'R' && vs === 'L') return 5;
  if (p.bats === 'L' && vs === 'L') return -6;
  if (p.bats === 'R' && vs === 'R') return -4;
  return 0;
}

function orderBatters(nine: Player[], team: Team, vsThrows?: Throws): Player[] {
  const st = effectiveStrategy(team);
  const manual = byIds(team.roster, team.lineupIds).filter((p) => isHitter(p));
  const nineIds = new Set(nine.map((p) => p.id));
  const locked = manual.filter((p) => nineIds.has(p.id));
  if (locked.length === 9) return locked;

  const score = (p: Player) =>
    p.r.con * 0.3 +
    p.r.pow * (0.25 + (1 - st.patience) * 0.2) +
    p.r.eye * (0.2 + st.patience * 0.25) +
    p.r.spd * 0.08 +
    platoonFit(p, vsThrows);
  const order = nine.slice().sort((a, b) => score(b) - score(a));
  order.sort((a, b) => b.r.pow - a.r.pow);
  const lineup: (Player | undefined)[] = [];
  const byEye = order.slice().sort((a, b) => b.r.eye + b.r.spd - (a.r.eye + a.r.spd));
  lineup[0] = byEye[0];
  lineup[1] = byEye[1];
  const rest = order.filter((p) => p !== lineup[0] && p !== lineup[1]).sort((a, b) => b.ovr - a.ovr);
  lineup[2] = rest[0];
  lineup[3] = rest[1];
  lineup[4] = rest[2];
  lineup[5] = rest[3];
  lineup[6] = rest[4];
  lineup[7] = rest[5];
  lineup[8] = rest[6];
  const clean = lineup.filter((p): p is Player => Boolean(p));
  while (clean.length < 9 && nine.length) clean.push(nine[clean.length % nine.length]);
  return clean;
}

export function buildLineup(team: Team, vsThrows?: Throws): LineupPlan {
  const hitters = team.roster.filter((p) => isHitter(p) && !p.injured);
  const fresh = (p: Player) => p.cond > (has(p, 'RUBBER') ? 8 : 18);
  let sps = team.roster.filter((p) => p.pos === 'SP' && !p.injured);
  const rot = byIds(team.roster, team.rotationIds).filter((p) => p.pos === 'SP');
  if (rot.length) {
    const rest = sps.filter((p) => rot.indexOf(p) < 0).sort((a, b) => b.ovr - a.ovr);
    sps = rot.concat(rest);
  } else {
    sps = (sps.filter(fresh).length ? sps.filter(fresh) : sps).sort((a, b) => b.ovr - a.ovr);
  }
  let rps = team.roster.filter((p) => p.pos === 'RP' && !p.injured);
  rps = (rps.filter(fresh).length ? rps.filter(fresh) : rps).sort((a, b) => b.ovr - a.ovr);

  // AI (and incomplete humans mid-edit): auto-fill a working field for the sim
  let fieldMap = playersAtField(team);
  if (!fieldComplete(team)) {
    if (!team.isHuman) {
      const auto = autoAssignField(team);
      team.fieldIds = auto;
      fieldMap = playersAtField(team);
    }
  }

  let nine: Player[];
  if (fieldComplete(team)) {
    nine = HIT_POS.map((pos) => fieldMap[pos]!).filter(Boolean);
  } else {
    // Incomplete human field — best nine by OVR so sim still has a card if forced
    nine = hitters.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 9);
    while (nine.length < 9 && hitters.length) nine.push(hitters[nine.length % hitters.length]);
  }

  const clean = orderBatters(nine, team, vsThrows);
  return {
    lineup: clean,
    sps,
    rps,
    defZ: fieldingZ(clean, fieldComplete(team) ? fieldMap : undefined),
    field: fieldMap
  };
}

export function pitcherThrows(p: Player | undefined): Throws {
  return p?.throws === 'L' ? 'L' : 'R';
}

/** @deprecated keep Position import used by callers that type-narrow */
export type { Position };
