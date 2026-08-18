import { PIT_POS, POS_DEF, HIT_POS } from './data/positions.js';
import { has } from './player.js';
import { clamp } from './rng.js';
import type { Player, Position, Strategy, Team, Throws } from './types.js';

export interface LineupPlan {
  lineup: Player[];
  sps: Player[];
  rps: Player[];
  defZ: number;
}

function byIds(roster: Player[], ids: string[] | null | undefined): Player[] {
  if (!ids || !ids.length) return [];
  const out: Player[] = [];
  ids.forEach((id) => {
    const p = roster.find((x) => x.id === id);
    if (p && !p.injured) out.push(p);
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

/**
 * Defense from who is actually standing where — greedy assign the nine
 * batters onto C–DH by listed position fit, then weight by POS_DEF.
 */
export function fieldingZ(lineup: Player[]): number {
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

export function buildLineup(team: Team, vsThrows?: Throws): LineupPlan {
  const hitters = team.roster.filter((p) => PIT_POS.indexOf(p.pos) < 0 && !p.injured);
  // Rubber arm can go on thinner rest
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

  const st = effectiveStrategy(team);
  const manual = byIds(team.roster, team.lineupIds).filter((p) => PIT_POS.indexOf(p.pos) < 0);
  let clean: Player[];
  if (manual.length >= 9) {
    clean = manual.slice(0, 9);
  } else if (manual.length > 0) {
    const used = new Set(manual.map((p) => p.id));
    const fill = hitters
      .filter((p) => !used.has(p.id))
      .sort((a, b) => b.ovr + platoonFit(b, vsThrows) - (a.ovr + platoonFit(a, vsThrows)));
    clean = manual.concat(fill).slice(0, 9);
    while (clean.length < 9 && hitters.length) clean.push(hitters[clean.length % hitters.length]);
  } else {
    const score = (p: Player) =>
      p.r.con * 0.3 +
      p.r.pow * (0.25 + (1 - st.patience) * 0.2) +
      p.r.eye * (0.2 + st.patience * 0.25) +
      p.r.spd * 0.08 +
      platoonFit(p, vsThrows);
    const order = hitters.slice().sort((a, b) => score(b) - score(a)).slice(0, 9);
    order.sort((a, b) => b.r.pow - a.r.pow);
    const lineup: (Player | undefined)[] = [];
    const byEye = order.slice().sort((a, b) => (b.r.eye + b.r.spd) - (a.r.eye + a.r.spd));
    lineup[0] = byEye[0];
    lineup[1] = byEye[1];
    const rest = order.filter((p) => p !== lineup[0] && p !== lineup[1]).sort((a, b) => b.ovr - a.ovr);
    lineup[2] = rest[0]; lineup[3] = rest[1]; lineup[4] = rest[2];
    lineup[5] = rest[3]; lineup[6] = rest[4]; lineup[7] = rest[5]; lineup[8] = rest[6];
    clean = lineup.filter((p): p is Player => Boolean(p));
    while (clean.length < 9 && hitters.length) clean.push(hitters[clean.length % hitters.length]);
  }

  return { lineup: clean, sps, rps, defZ: fieldingZ(clean) };
}

export function pitcherThrows(p: Player | undefined): Throws {
  return p?.throws === 'L' ? 'L' : 'R';
}

/** @deprecated keep Position import used by callers that type-narrow */
export type { Position };
