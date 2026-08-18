import { clamp } from './rng.js';
import { STADIUM } from './data/stadium.js';
import { fmtMoney } from './format.js';
import { award } from './league.js';
import { noteOffice } from './progress.js';
import type { League, StadiumKey, Team } from './types.js';

export interface UpgradeResult {
  ok: boolean;
  err?: string;
  level?: number;
  cost?: number;
  note?: string;
}

export function upgrade(league: League, team: Team, key: StadiumKey): UpgradeResult {
  const spec = STADIUM.find((s) => s.key === key)!;
  const lv = team.stadium[key] || 0;
  if (lv >= spec.levels.length - 1) return { ok: false, err: 'Already maxed' };
  const cost = spec.levels[lv + 1].cost;
  if (team.cash < cost) return { ok: false, err: 'Short ' + fmtMoney(cost - team.cash) };
  team.cash -= cost;
  team.stadium[key] = lv + 1;
  const tr = spec.levels[lv + 1].trust;
  if (tr) team.fanTrust = clamp(team.fanTrust + tr, 1, 100);
  if (team.stadium[key] >= spec.levels.length - 1) award(team, 'CATHEDRAL', league);
  noteOffice(team, 'builds', 14, 'The park');
  return { ok: true, level: lv + 1, cost, note: spec.levels[lv + 1].note };
}
