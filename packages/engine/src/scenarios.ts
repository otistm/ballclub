import { clamp, mulberry32, pick, RI, shuffle } from './rng.js';
import { CLASSES } from './data/classes.js';
import { SCENARIOS } from './data/scenarios.js';
import { isPitcher, ovr } from './player.js';
import { noteOffice, pressMul, pressShield } from './progress.js';
import { rankTeams } from './league.js';
import { aiTradeOffer } from './trade.js';
import type {
  League, Player, Position, Scenario, ScenarioPlayerPick, ScenarioRivalPick,
  ScenarioSide, Team
} from './types.js';

export function arcDue(team: Team, league: League): boolean {
  const arc = team.deskArc;
  return !!(arc && arc.cardIds.length && arc.step < arc.cardIds.length && arc.nextWeek <= league.week);
}

export function nextScenario(league: League, team: Team): Scenario | null {
  if (arcDue(team, league)) {
    const id = team.deskArc!.cardIds[team.deskArc!.step];
    return SCENARIOS.find((s) => s.id === id) || null;
  }
  if (league.scenarioIdx >= league.scenarioDeck.length) {
    league.scenarioDeck = shuffle(mulberry32(league.seed + league.week), SCENARIOS.map((s) => s.id));
    league.scenarioIdx = 0;
  }
  const id = league.scenarioDeck[league.scenarioIdx];
  return SCENARIOS.find((s) => s.id === id) || null;
}

export function pickScenarioPlayer(team: Team, how: ScenarioPlayerPick, rng: () => number): Player | null {
  const roster = team.roster.slice();
  if (!roster.length) return null;
  if (how === 'random') return pick(rng, roster);
  if (how === 'ace') {
    const sps = roster.filter((p) => p.pos === 'SP').sort((a, b) => b.ovr - a.ovr);
    return sps[0] || roster.slice().sort((a, b) => b.ovr - a.ovr)[0];
  }
  if (how === 'vet') return roster.slice().sort((a, b) => b.age - a.age || b.ovr - a.ovr)[0];
  if (how === 'worstMorale') return roster.slice().sort((a, b) => a.morale - b.morale)[0];
  const atPos = roster.filter((p) => p.pos === (how as Position)).sort((a, b) => b.ovr - a.ovr);
  return atPos[0] || null;
}

export function pickScenarioRival(league: League, team: Team, how: ScenarioRivalPick, rng: () => number): Team | null {
  const others = league.teams.filter((t) => t.id !== team.id);
  if (!others.length) return null;
  if (how === 'randomAi') {
    const ai = others.filter((t) => !t.isHuman);
    return pick(rng, ai.length ? ai : others);
  }
  if (how === 'leader') {
    const ranked = rankTeams(league);
    const top = ranked.find((t) => t.id !== team.id);
    return top || others[0];
  }
  const weekIdx = Math.min(league.week, league.schedule.length - 1);
  const pr = league.schedule[weekIdx]?.find((p) => p.home === team.id || p.away === team.id);
  if (!pr) return pick(rng, others);
  const oid = pr.home === team.id ? pr.away : pr.home;
  return league.teams.find((t) => t.id === oid) || pick(rng, others);
}

export interface ScenarioResolution {
  sc: Scenario;
  side: ScenarioSide;
  out: string;
  extra?: string | null;
}

export function resolveScenario(league: League, team: Team, choice: 'left' | 'right'): ScenarioResolution | null {
  const fromArc = arcDue(team, league);
  const sc = nextScenario(league, team);
  if (!sc) return null;
  if (!fromArc) league.scenarioIdx++;
  const side = choice === 'left' ? sc.left : sc.right;
  const eff = { ...side.eff };
  const club = CLASSES[team.cls].mods.clubhouse || 1;
  const good = pressMul(team);
  const bad = pressShield(team);
  let extra: string | null = null;
  const rng = mulberry32(league.seed + league.week * 91 + team.slot * 17 + hashId(sc.id));

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
    if (rng() < eff.injRisk * bad) {
      const victim = pick(rng, team.roster);
      victim.injured = RI(rng, 1, 3);
      extra = victim.name + ' will miss ' + victim.injured + ' week(s).';
    }
  }
  if (eff.rainRisk) {
    team.rainRisk = clamp((team.rainRisk || 0) + eff.rainRisk * bad, 0, 1);
  }
  if (eff.weekPatience || eff.weekAggression || eff.weekCond) {
    const prev = team.weekBoost || {};
    team.weekBoost = {
      patience: (prev.patience || 0) + (eff.weekPatience || 0),
      aggression: (prev.aggression || 0) + (eff.weekAggression || 0),
      cond: (prev.cond || 0) + (eff.weekCond || 0)
    };
  }
  if (eff.riot) {
    if (rng() < eff.riot * bad) {
      const hit = Math.round(8 + rng() * 10);
      team.fanTrust = clamp(team.fanTrust - hit, 1, 100);
      extra = (extra ? extra + ' ' : '') + 'The park got ugly. Trust drops ' + hit + '.';
    }
  }
  if (eff.tradeOffer) {
    const offer = aiTradeOffer(league, team);
    if (offer) {
      team.pendingTrade = {
        rivalId: offer.teamId,
        give: [offer.wantId],
        get: [offer.giveId]
      };
      const them = league.teams.find((t) => t.id === offer.teamId);
      extra = (extra ? extra + ' ' : '') +
        (them ? them.abbr : 'A rival') + ' is on the line. Check the market.';
    }
  }

  if (eff.playerPick && (eff.playerMorale || eff.playerCond || eff.playerInjWeeks)) {
    const target = pickScenarioPlayer(team, eff.playerPick, rng);
    if (target) {
      if (eff.playerMorale) {
        target.morale = clamp(
          target.morale + eff.playerMorale * (eff.playerMorale > 0 ? club * good : bad),
          5,
          100
        );
      }
      if (eff.playerCond) {
        target.cond = clamp(
          target.cond + eff.playerCond * (eff.playerCond > 0 ? good : bad),
          0,
          100
        );
      }
      if (eff.playerInjWeeks && eff.playerInjWeeks > 0) {
        target.injured = Math.max(target.injured || 0, Math.round(eff.playerInjWeeks));
      }
      const bits: string[] = [target.name];
      if (eff.playerInjWeeks && target.injured) bits.push('sidelined ' + target.injured + ' week(s)');
      else if (isPitcher(target)) bits.push(target.pos);
      extra = (extra ? extra + ' ' : '') + bits.join(' · ') + '.';
    }
  }

  if (eff.rivalPick && eff.rivalEff) {
    const rival = pickScenarioRival(league, team, eff.rivalPick, rng);
    if (rival) {
      const re = eff.rivalEff;
      if (re.cash) rival.cash += Math.round(re.cash);
      if (re.trust) rival.fanTrust = clamp(rival.fanTrust + re.trust, 1, 100);
      if (re.rainRisk) rival.rainRisk = clamp((rival.rainRisk || 0) + re.rainRisk, 0, 1);
      if (re.att) rival.attBonus = (rival.attBonus || 0) + re.att;
      if (re.weekCond) {
        const prev = rival.weekBoost || {};
        rival.weekBoost = {
          patience: prev.patience || 0,
          aggression: prev.aggression || 0,
          cond: (prev.cond || 0) + re.weekCond
        };
      }
      extra = (extra ? extra + ' ' : '') + rival.abbr + ' feels it.';
    }
  }

  if (eff.arc && eff.arc.steps.length) {
    team.deskArc = {
      id: eff.arc.id,
      step: 0,
      nextWeek: league.week + Math.max(1, eff.arc.delayWeeks ?? 1),
      cardIds: eff.arc.steps.slice()
    };
    extra = (extra ? extra + ' ' : '') + 'This one will come back around.';
  } else if (fromArc && team.deskArc) {
    team.deskArc.step++;
    if (team.deskArc.step >= team.deskArc.cardIds.length) team.deskArc = null;
    else team.deskArc.nextWeek = league.week + 1;
  }

  noteOffice(team, 'desks', 14, 'The desk');
  return { sc, side, out: side.out, extra };
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
