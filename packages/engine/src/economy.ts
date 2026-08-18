import { clamp } from './rng.js';
import { CLASSES } from './data/classes.js';
import { STADIUM } from './data/stadium.js';
import { sponsorCheck } from './data/sponsors.js';
import { has } from './player.js';
import { opsRevMul, pressMul } from './progress.js';
import type { League, StadiumKey, StadiumLevel, Team, WeekFinance } from './types.js';

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

  let att =
    cap *
    clamp(0.4 + wp * 0.38 + (trust - 0.5) * 0.4 + streakBump + fameBump + (team.attBonus || 0), 0.12, 1.0) *
    lightMul *
    priceFactor;
  att = Math.min(cap, Math.round(att));
  const sellout = att >= cap * 0.985;

  const gate = att * team.ticket * gamesHome;
  const conc = att * team.conPrice * gamesHome * conMul * clamp(1.3 - team.conPrice / 34, 0.45, 1.3);
  const merch = att * gamesHome * 2.1 * (0.6 + trust);
  let sponsor = 0;
  team.sponsors.forEach((s) => {
    const ok = sponsorCheck(s.name, team, att);
    // sponsor.base is a full-season figure; it pays out weekly
    const pay = (s.base / league.weeks) * sponMul * (mods.sponsorValue || 1) * (ok ? 1 : 0.35);
    sponsor += pay;
    s.paid = (s.paid || 0) + pay;
    s.met = ok;
  });

  const revenue = (gate + conc + merch) * (mods.revenue || 1) * opsRevMul(team) + sponsor;
  const payroll = team.roster.reduce((s, p) => s + p.salary, 0) / league.weeks;
  const staffCost = Object.values(team.staff).reduce((a, b) => a + b, 0) * 220;
  const upkeep =
    26000 + (Object.keys(team.stadium) as StadiumKey[]).reduce((s, k) => s + team.stadium[k] * 14000, 0);
  const cost = payroll + staffCost + upkeep;
  const net = Math.round(revenue - cost);
  team.cash += net;
  team.wk = {
    att,
    rev: Math.round(revenue),
    cost: Math.round(cost),
    net,
    gate: Math.round(gate),
    conc: Math.round(conc),
    merch: Math.round(merch),
    sponsor: Math.round(sponsor),
    payroll: Math.round(payroll),
    sellout
  };

  // trust drift
  const perf = (wp - 0.5) * 12 + (sellout ? 1 : 0);
  team.fanTrust = clamp(
    team.fanTrust + perf * 0.28 * (mods.fanTrustGain || 1) * pressMul(team) - (team.ticket > 34 ? 0.8 * (2 - pressMul(team)) : 0),
    1,
    100
  );
  return team.wk;
}
