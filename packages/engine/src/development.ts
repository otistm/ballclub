import { clamp, hashStr, mulberry32, pick, R } from './rng.js';
import { CLASSES } from './data/classes.js';
import { PIT_POS } from './data/positions.js';
import { stadiumVal } from './economy.js';
import { award } from './league.js';
import { has, ovr } from './player.js';
import { farmMul } from './progress.js';
import type { League, RatingKey, Team } from './types.js';

export function developRoster(league: League, t: Team): void {
  const dev =
    stadiumVal(t, 'academy', 'dev', 1.0) *
    (CLASSES[t.cls].mods.prospectGrowth || 1) *
    (0.7 + t.staff.coach / 200) *
    (0.75 + t.staff.trainer / 280) *
    farmMul(t);
  const mentor = t.roster.some((p) => has(p, 'MENTOR')) ? 1.15 : 1;
  t.roster.forEach((p) => {
    const rng = mulberry32(hashStr(p.id + 'dev' + league.week));
    const peak = 27 + (has(p, 'LATE') ? 4 : 0);
    const gap = p.pot - p.ovr;
    let delta = 0;
    if (p.age < peak && gap > 0) delta = gap * 0.045 * dev * mentor * R(rng, 0.4, 1.6);
    else if (p.age > peak + 3) delta = -R(rng, 0.05, 0.45) * (1 + (p.age - peak - 3) * 0.15);
    if (Math.abs(delta) < 0.01) return;
    const keys: RatingKey[] = PIT_POS.indexOf(p.pos) >= 0
      ? ['stuff', 'ctl', 'mov', 'stam']
      : ['con', 'pow', 'eye', 'spd', 'fld', 'arm'];
    p._acc = (p._acc || 0) + delta;
    while (p._acc >= 1) {
      const k = pick(rng, keys);
      p.r[k] = clamp(Math.round(p.r[k] + 1), 5, 99);
      p._acc -= 1;
    }
    while (p._acc <= -1) {
      const k = pick(rng, keys);
      p.r[k] = clamp(Math.round(p.r[k] - 1), 5, 99);
      p._acc += 1;
    }
    const before = p.ovr;
    p.ovr = ovr(p);
    if (p.origin === 'draft' && p.ovr >= 80 && before < 80) award(t, 'HOMEGROWN', league);
  });
}
