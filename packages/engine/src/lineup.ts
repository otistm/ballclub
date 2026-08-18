import { PIT_POS, POS_DEF } from './data/positions.js';
import type { Player, Team } from './types.js';

export interface LineupPlan {
  lineup: Player[];
  sps: Player[];
  rps: Player[];
  defZ: number;
}

export function buildLineup(team: Team): LineupPlan {
  const hitters = team.roster.filter((p) => PIT_POS.indexOf(p.pos) < 0 && !p.injured);
  const fresh = (p: Player) => p.cond > 18;
  let sps = team.roster.filter((p) => p.pos === 'SP' && !p.injured);
  sps = (sps.filter(fresh).length ? sps.filter(fresh) : sps).sort((a, b) => b.ovr - a.ovr);
  let rps = team.roster.filter((p) => p.pos === 'RP' && !p.injured);
  rps = (rps.filter(fresh).length ? rps.filter(fresh) : rps).sort((a, b) => b.ovr - a.ovr);

  const st = team.strategy || { patience: 0.5, aggression: 0.5, bullpenHook: 0.5 };
  const score = (p: Player) =>
    p.r.con * 0.3 + p.r.pow * (0.25 + (1 - st.patience) * 0.2) + p.r.eye * (0.2 + st.patience * 0.25) + p.r.spd * 0.08;
  const order = hitters.slice().sort((a, b) => score(b) - score(a)).slice(0, 9);
  // classic-ish shape: speed/eye up top, power 3-4
  order.sort((a, b) => b.r.pow - a.r.pow);
  const lineup: (Player | undefined)[] = [];
  const byEye = order.slice().sort((a, b) => (b.r.eye + b.r.spd) - (a.r.eye + a.r.spd));
  lineup[0] = byEye[0];
  lineup[1] = byEye[1];
  const rest = order.filter((p) => p !== lineup[0] && p !== lineup[1]).sort((a, b) => b.ovr - a.ovr);
  lineup[2] = rest[0]; lineup[3] = rest[1]; lineup[4] = rest[2];
  lineup[5] = rest[3]; lineup[6] = rest[4]; lineup[7] = rest[5]; lineup[8] = rest[6];
  const clean = lineup.filter((p): p is Player => Boolean(p));
  while (clean.length < 9 && hitters.length) clean.push(hitters[clean.length % hitters.length]);
  const def = clean.reduce((s, p) => s + p.r.fld * (POS_DEF[p.pos] || 1), 0) / Math.max(1, clean.length);
  return { lineup: clean, sps, rps, defZ: (def - 50) / 18 };
}
