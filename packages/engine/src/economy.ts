import { clamp } from './rng.js';
import { CLASSES } from './data/classes.js';
import { STADIUM } from './data/stadium.js';
import { sponsorCheck } from './data/sponsors.js';
import { has } from './player.js';
import { opsRevMul, pressMul } from './progress.js';
import type { League, StadiumKey, StadiumLevel, Team, WeekFinance, YardUse } from './types.js';
import { YARD } from './data/yard.js';

export function yardUseOf(team: Team): YardUse {
  return team.yardUse === 'lock' || team.yardUse === 'rent' ? team.yardUse : 'open';
}

/** Crowd and cash from a road-week park booking. Zero when the gates are locked. */
export function yardTake(team: Team): { att: number; take: number } {
  const use = yardUseOf(team);
  if (use === 'lock') return { att: 0, take: 0 };
  const cap = stadiumVal(team, 'seats', 'cap', 9000);
  const lightMul = stadiumVal(team, 'lights', 'att', 1.0);
  const conMul = stadiumVal(team, 'food', 'con', 1.0);
  const boardMul = stadiumVal(team, 'board', 'spon', 1.0);
  const trust = team.fanTrust / 100;
  if (use === 'open') {
    const att = Math.max(0, Math.round(cap * (0.12 + trust * 0.1) * (0.82 + (boardMul - 1) * 0.45)));
    const take = att * 9 + att * 6.5 * conMul + att * 1.3 * (0.6 + trust);
    return { att, take };
  }
  const att = Math.max(
    0,
    Math.round(cap * (0.22 + (lightMul - 1) * 0.75 + (boardMul - 1) * 0.4) * (0.55 + trust * 0.32))
  );
  const take = att * 24 + att * team.conPrice * 0.72 * conMul + att * 2.2 * (0.6 + trust);
  return { att, take };
}

export function yardLabel(use: YardUse): string {
  return YARD[use].name;
}

export function stadiumVal(team: Team, key: StadiumKey, field: keyof StadiumLevel, dflt: number): number {
  const spec = STADIUM.find((s) => s.key === key)!;
  const lv = team.stadium[key] || 0;
  const v = spec.levels[lv][field];
  return v == null ? dflt : (v as number);
}

export function runEconomy(league: League, team: Team, gamesHome: number): WeekFinance {
  const cap = stadiumVal(team, 'seats', 'cap', 9000);
  const lightMul = stadiumVal(team, 'lights', 'att', 1.0);
  const conMul = stadiumVal(team, 'food', 'con', 1.0);
  const sponMul = stadiumVal(team, 'board', 'spon', 1.0);
  const mods = CLASSES[team.cls].mods;
  const wp = team.w + team.l ? team.w / (team.w + team.l) : 0.5;
  const trust = team.fanTrust / 100;
  const priceFactor = clamp(1.3 - team.ticket / 60, 0.45, 1.2);
  const streakBump = clamp(team.streak / 26, -0.1, 0.14);
  const fameBump = team.roster.reduce(
    (s, p) => s + (has(p, 'FANFAVE') ? 0.04 : 0) + Math.max(0, p.ovr - 80) * 0.003,
    0
  );
  const faveRev = 1 + team.roster.filter((p) => has(p, 'FANFAVE')).length * 0.06;

  let att =
    cap *
    clamp(0.4 + wp * 0.38 + (trust - 0.5) * 0.4 + streakBump + fameBump + (team.attBonus || 0), 0.12, 1.0) *
    lightMul *
    priceFactor;
  att = Math.min(cap, Math.round(att));
  const home = gamesHome > 0;
  const sellout = home && att >= cap * 0.985;
  const use = yardUseOf(team);
  const event = home ? { att: 0, take: 0 } : yardTake(team);

  const gate = home ? att * team.ticket * gamesHome : 0;
  const conc = home ? att * team.conPrice * gamesHome * conMul * clamp(1.3 - team.conPrice / 34, 0.45, 1.3) : 0;
  const merch = home ? att * gamesHome * 2.1 * (0.6 + trust) : 0;
  let sponsor = 0;
  team.sponsors.forEach((s) => {
    const ok = sponsorCheck(s.name, team, home ? att : Math.max(att, event.att));
    // sponsor.base is a full-season figure; it pays out weekly
    const pay = (s.base / league.weeks) * sponMul * (mods.sponsorValue || 1) * (ok ? 1 : 0.35);
    sponsor += pay;
    s.paid = (s.paid || 0) + pay;
    s.met = ok;
  });

  const revenue = (gate + conc + merch + event.take) * (mods.revenue || 1) * opsRevMul(team) * faveRev + sponsor;
  const annualPayroll = team.roster.reduce((s, p) => s + p.salary, 0);
  const payroll = annualPayroll / league.weeks;
  const staffCost = Object.values(team.staff).reduce((a, b) => a + b, 0) * 220;
  const upkeep =
    26000 + (Object.keys(team.stadium) as StadiumKey[]).reduce((s, k) => s + team.stadium[k] * 14000, 0);
  // soft luxury: indie-league tax over $2.4M annual payroll
  const LUXURY_LINE = 2400000;
  const luxury = annualPayroll > LUXURY_LINE
    ? Math.round(((annualPayroll - LUXURY_LINE) * 0.35) / league.weeks)
    : 0;
  const cost = payroll + staffCost + upkeep + luxury;
  const net = Math.round(revenue - cost);
  team.cash += net;
  team.wk = {
    att: home ? att : 0,
    rev: Math.round(revenue),
    cost: Math.round(cost),
    net,
    gate: Math.round(gate),
    conc: Math.round(conc),
    merch: Math.round(merch),
    sponsor: Math.round(sponsor),
    payroll: Math.round(payroll),
    sellout,
    luxury: luxury || undefined,
    home,
    yard: home ? 0 : Math.round(event.take * (mods.revenue || 1) * opsRevMul(team) * faveRev),
    yardUse: home ? undefined : use,
    yardAtt: home ? 0 : event.att
  };

  // trust drift
  const yardTrust = home ? 0 : use === 'open' ? 0.35 : use === 'rent' ? 0.18 : 0;
  const perf = (wp - 0.5) * 12 + (sellout ? 1 : 0) + yardTrust;
  team.fanTrust = clamp(
    team.fanTrust + perf * 0.28 * (mods.fanTrustGain || 1) * pressMul(team) - (team.ticket > 34 ? 0.8 * (2 - pressMul(team)) : 0),
    1,
    100
  );
  return team.wk;
}
