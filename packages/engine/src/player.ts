import { clamp, gauss, hashStr, mulberry32, pick, R, RI, shuffle, type Rng } from './rng.js';
import { FIRST, LAST } from './data/names.js';
import { HIT_POS, PIT_POS, POS_DEF } from './data/positions.js';
import { TRAITS } from './data/traits.js';
import type { HitStats, PitStats, Player, PlayerOrigin, Position, Ratings, ShownRating } from './types.js';

/** Monotonic id source, stored on the league so ids survive reloads. */
export interface IdSource {
  next: number;
}

export interface GenPlayerOpts {
  pos?: Position;
  age?: number;
  tier?: number;
  bias?: Partial<Ratings>;
  scouted?: number;
  origin?: PlayerOrigin;
}

export function blankHitStats(): HitStats {
  return { g: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, k: 0, r: 0, rbi: 0, sb: 0, cs: 0 };
}

export function blankPitStats(): PitStats {
  return { g: 0, gs: 0, outs: 0, h: 0, hr: 0, er: 0, bb: 0, k: 0, w: 0, l: 0, sv: 0, bf: 0 };
}

export function has(p: Player, t: string): boolean {
  return p.traits.indexOf(t) >= 0;
}

export function isPitcher(p: Player): boolean {
  return PIT_POS.indexOf(p.pos) >= 0;
}

export function ovr(p: Player): number {
  if (p.pos === 'SP') return Math.round(p.r.stuff * 0.34 + p.r.ctl * 0.28 + p.r.mov * 0.24 + p.r.stam * 0.14);
  if (p.pos === 'RP') return Math.round(p.r.stuff * 0.42 + p.r.ctl * 0.26 + p.r.mov * 0.26 + p.r.stam * 0.06);
  const d = POS_DEF[p.pos] || 1;
  return Math.round(p.r.con * 0.24 + p.r.pow * 0.24 + p.r.eye * 0.2 + p.r.spd * 0.1 + p.r.fld * 0.16 * d + p.r.arm * 0.06);
}

export function salaryFor(p: Player): number {
  const o = p.ovr;
  let s = Math.pow(Math.max(0, o - 30) / 12, 2.3) * 22000 + 45000;
  if (p.age < 24) s *= 0.55;
  else if (p.age < 27) s *= 0.85;
  else if (p.age > 34) s *= 0.82;
  return Math.round(s / 5000) * 5000;
}

/** Trade points: present skill + remaining growth - contract drag. */
export function value(p: Player): number {
  const yrs = clamp(34 - p.age, 1, 14);
  const growth = (p.pot - p.ovr) * clamp((28 - p.age) / 8, 0, 1);
  const raw = Math.pow(Math.max(0, p.ovr - 38) / 12, 1.85) * 9 + growth * 0.9 + yrs * 0.45;
  const cost = p.salary / 100000;
  return Math.max(0.5, raw - cost * 0.55);
}

export function genPlayer(rng: Rng, ids: IdSource, opts: GenPlayerOpts = {}): Player {
  const isP = opts.pos ? PIT_POS.indexOf(opts.pos) >= 0 : rng() < 0.42;
  const pos: Position = opts.pos || (isP ? (rng() < 0.55 ? 'SP' : 'RP') : pick(rng, HIT_POS));
  const age = opts.age != null ? opts.age : Math.round(clamp(gauss(rng, 26.5, 4.2), 19, 39));
  const tier = opts.tier != null ? opts.tier : gauss(rng, 0, 1);
  const base = 50 + tier * 9;
  const bias = opts.bias || {};
  const mk = (k: keyof Ratings, spread?: number) =>
    Math.round(clamp(gauss(rng, base + (bias[k] || 0), spread || 11), 12, 96));

  const p: Player = {
    id: 'p' + ids.next++,
    name: pick(rng, FIRST) + ' ' + pick(rng, LAST),
    pos,
    age,
    bats: rng() < 0.28 ? 'L' : rng() < 0.05 ? 'S' : 'R',
    throws: rng() < 0.28 ? 'L' : 'R',
    traits: [],
    r: {} as Ratings,
    ovr: 0,
    pot: 0,
    scouted: opts.scouted != null ? opts.scouted : 0,
    salary: 0,
    years: RI(rng, 1, 4),
    morale: Math.round(R(rng, 45, 75)),
    cond: 100,
    injured: 0,
    st: blankHitStats(),
    pst: blankPitStats(),
    origin: opts.origin || 'pool'
  };

  if (pos === 'SP' || pos === 'RP') {
    p.r = {
      stuff: mk('stuff'), ctl: mk('ctl'), mov: mk('mov'), stam: mk('stam', 12),
      fld: mk('fld', 14), arm: mk('arm', 14),
      con: 22, pow: 20, eye: 25,
      spd: Math.round(clamp(gauss(rng, 40, 12), 10, 80))
    };
    if (pos === 'RP') {
      p.r.stam = Math.round(clamp(p.r.stam * 0.55, 12, 60));
      p.r.stuff = Math.round(clamp(p.r.stuff + 5, 12, 96));
    }
  } else {
    p.r = {
      con: mk('con'), pow: mk('pow'), eye: mk('eye'), spd: mk('spd'), fld: mk('fld'), arm: mk('arm'),
      stuff: 20, ctl: 22, mov: 20, stam: 60
    };
    if (pos === 'C') { p.r.spd = Math.round(p.r.spd * 0.7); p.r.arm = Math.round(clamp(p.r.arm + 8, 12, 96)); }
    if (pos === 'DH') { p.r.fld = Math.round(p.r.fld * 0.65); p.r.pow = Math.round(clamp(p.r.pow + 5, 12, 96)); }
    if (pos === 'SS' || pos === 'CF') { p.r.fld = Math.round(clamp(p.r.fld + 6, 12, 96)); p.r.spd = Math.round(clamp(p.r.spd + 5, 12, 96)); }
    if (pos === '1B') { p.r.pow = Math.round(clamp(p.r.pow + 4, 12, 96)); p.r.spd = Math.round(p.r.spd * 0.85); }
  }

  const nTraits = rng() < 0.42 ? (rng() < 0.18 ? 2 : 1) : 0;
  const bag = shuffle(rng, TRAITS.slice());
  for (let i = 0; i < nTraits; i++) {
    const t = bag[i];
    if ((t.key === 'RUBBER' || t.key === 'WILD') && !isP) continue;
    if ((t.key === 'WHEELS' || t.key === 'GRINDER') && isP) continue;
    p.traits.push(t.key);
    const e = t.eff;
    for (const k in e) {
      const rk = k as keyof Ratings;
      if (p.r[rk] != null) p.r[rk] = Math.round(clamp(p.r[rk] + e[k], 12, 99));
    }
  }

  p.ovr = ovr(p);
  const youth = clamp((27 - p.age) / 8, 0, 1);
  p.pot = Math.round(clamp(p.ovr + youth * R(rng, 4, 22) + (has(p, 'LATE') ? 6 : 0), p.ovr, 99));
  p.salary = salaryFor(p);
  return p;
}

/* ---------- scouting fog ---------- */

export function shown(p: Player, key: keyof Ratings, fogMul = 1): ShownRating {
  if (p.scouted >= 1) return { v: p.r[key], lo: p.r[key], hi: p.r[key], exact: true };
  const fog = ((1 - p.scouted) * 18 + 2) * fogMul;
  const rng = mulberry32(hashStr(p.id + key));
  const off = (rng() - 0.5) * fog * 0.6;
  const c = clamp(p.r[key] + off, 5, 99);
  return {
    v: Math.round(c),
    lo: Math.round(clamp(c - fog / 2, 1, 99)),
    hi: Math.round(clamp(c + fog / 2, 1, 99)),
    exact: false
  };
}

export function shownOvr(p: Player, fogMul = 1): ShownRating {
  if (p.scouted >= 1) return { v: p.ovr, lo: p.ovr, hi: p.ovr, exact: true };
  const fog = ((1 - p.scouted) * 14 + 2) * fogMul;
  const rng = mulberry32(hashStr(p.id + 'ovr'));
  const c = clamp(p.ovr + (rng() - 0.5) * fog * 0.7, 5, 99);
  return {
    v: Math.round(c),
    lo: Math.round(clamp(c - fog / 2, 1, 99)),
    hi: Math.round(clamp(c + fog / 2, 1, 99)),
    exact: false
  };
}
