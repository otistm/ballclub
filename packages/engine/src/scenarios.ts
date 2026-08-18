import { clamp, mulberry32, pick, RI, shuffle } from './rng.js';
import { CLASSES } from './data/classes.js';
import { SCENARIOS } from './data/scenarios.js';
import { ovr } from './player.js';
import { noteOffice, pressMul, pressShield } from './progress.js';
import type { League, Scenario, ScenarioSide, Team } from './types.js';

export function nextScenario(league: League, _team: Team): Scenario | null {
  if (league.scenarioIdx >= league.scenarioDeck.length) {
    league.scenarioDeck = shuffle(mulberry32(league.seed + league.week), SCENARIOS.map((s) => s.id));
    league.scenarioIdx = 0;
  }
  const id = league.scenarioDeck[league.scenarioIdx];
  return SCENARIOS.find((s) => s.id === id) || null;
}

export interface ScenarioResolution {
  sc: Scenario;
  side: ScenarioSide;
  out: string;
  extra?: string | null;
}

export function resolveScenario(league: League, team: Team, choice: 'left' | 'right'): ScenarioResolution | null {
  const sc = nextScenario(league, team);
  if (!sc) return null;
  league.scenarioIdx++;
  const side = choice === 'left' ? sc.left : sc.right;
  const eff = { ...side.eff };
  const club = CLASSES[team.cls].mods.clubhouse || 1;
  const good = pressMul(team);
  const bad = pressShield(team);
  let extra: string | null = null;

  if (eff.cash) team.cash += Math.round(eff.cash * (eff.cash > 0 ? good : bad));
  if (eff.trust) team.fanTrust = clamp(team.fanTrust + eff.trust * (eff.trust > 0 ? club * good : bad), 1, 100);
  if (eff.morale) team.roster.forEach((p) => (p.morale = clamp(p.morale + eff.morale! * (eff.morale! > 0 ? club * good : bad), 5, 100)));
  if (eff.cond) team.roster.forEach((p) => (p.cond = clamp(p.cond + eff.cond! * (eff.cond! > 0 ? good : bad), 0, 100)));
  if (eff.fld) team.roster.forEach((p) => {
    p.r.fld = clamp(p.r.fld + eff.fld!, 5, 99);
    p.ovr = ovr(p);
  });
  if (eff.scoutBoost) league.draftPool.slice(0, 12).forEach((p) => (p.scouted = clamp(p.scouted + 0.4 * good, 0, 1)));
  if (eff.dev) team.devBonus = (team.devBonus || 0) + eff.dev * good;
  if (eff.att) team.attBonus = (team.attBonus || 0) + eff.att * good;
  if (eff.strat) team.strategy.patience = clamp(team.strategy.patience + eff.strat, 0.1, 0.95);
  if (eff.injRisk) {
    const rng = mulberry32(league.seed + league.week * 91);
    if (rng() < eff.injRisk * bad) {
      const victim = pick(rng, team.roster);
      victim.injured = RI(rng, 1, 3);
      extra = victim.name + ' will miss ' + victim.injured + ' week(s).';
    }
  }
  noteOffice(team, 'desks', 14, 'The desk');
  return { sc, side, out: side.out, extra };
}
