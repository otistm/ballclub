/**
 * Idle GM: when a human is away from a shared league, their class runs the club.
 *
 * Decisions are seeded from league state (seed + week + team + phase), never
 * wall-clock, so an advanceIdle action replays bit-for-bit.
 * The caller decides WHO is idle and puts those team ids on the action.
 * The person sitting at the device should never be in that list.
 */
import { CLASSES } from './data/classes.js';
import { STADIUM } from './data/stadium.js';
import {
  autoDraftUntilHuman, rosterGaps, type AutoPick, type PickResult
} from './draft.js';
import { isPitcher, value } from './player.js';
import { autoAssignField, fieldComplete, rosterReady } from './lineup.js';
import { SKILLS, spendSkill } from './progress.js';
import { hashStr, mulberry32 } from './rng.js';
import { nextScenario, resolveScenario, type ScenarioResolution } from './scenarios.js';
import { runPlayoffs } from './playoffs.js';
import { aiOffseason, resign, startOffseason } from './offseason.js';
import { rollSponsorOffers, signSponsor } from './sponsors.js';
import { upgrade } from './stadium.js';
import { aiTradeOffer, execTrade } from './trade.js';
import { signFA } from './freeagency.js';
import { playWeek } from './week.js';
import type {
  Bracket, League, OffseasonReport, Scenario, ScenarioEffect, SkillKey, StadiumKey, Team, WeekOutcome
} from './types.js';

export interface ClassTaste {
  cash: number;
  trust: number;
  morale: number;
  cond: number;
  fld: number;
  dev: number;
  att: number;
  scoutBoost: number;
  injRisk: number;
  rainRisk: number;
}

/** How each background scores a desk card. Positive = chase it. injRisk is a penalty weight. */
export const CLASS_TASTE: Record<string, ClassTaste> = {
  ANALYST: { cash: 0.5, trust: 0.25, morale: 0.15, cond: 0.35, fld: 0.45, dev: 0.4, att: 0.15, scoutBoost: 2.4, injRisk: 1.6, rainRisk: 0.7 },
  OLD_LION: { cash: 0.25, trust: 0.9, morale: 1.7, cond: 0.55, fld: 0.2, dev: -0.35, att: 0.2, scoutBoost: 0.2, injRisk: 0.7, rainRisk: 0.4 },
  SHOWMAN: { cash: 0.35, trust: 1.5, morale: 0.55, cond: 0.1, fld: 0, dev: 0.05, att: 2.2, scoutBoost: 0.15, injRisk: 0.35, rainRisk: 0.25 },
  FARMER: { cash: 1.25, trust: 0.45, morale: 0.3, cond: 0.4, fld: 0.5, dev: 2.1, att: 0.25, scoutBoost: 1.3, injRisk: 0.9, rainRisk: 0.5 },
  CLOSER: { cash: 0.45, trust: 0.3, morale: 0.45, cond: 1.5, fld: 0.25, dev: 0.2, att: 0.1, scoutBoost: 0.25, injRisk: 2.4, rainRisk: 0.55 },
  BROKER: { cash: 1.7, trust: 0.15, morale: 0.1, cond: 0.15, fld: 0, dev: 0.1, att: 0.25, scoutBoost: 0.35, injRisk: 0.45, rainRisk: 0.3 }
};

const SKILL_PREF: Record<string, SkillKey> = {
  ANALYST: 'scout', OLD_LION: 'press', SHOWMAN: 'press',
  FARMER: 'farm', CLOSER: 'ops', BROKER: 'deals'
};

const PARK_PREF: Record<string, StadiumKey[]> = {
  ANALYST: ['academy', 'board', 'clubhouse'],
  OLD_LION: ['clubhouse', 'academy', 'seats'],
  SHOWMAN: ['board', 'seats', 'food', 'lights'],
  FARMER: ['academy', 'clubhouse', 'seats'],
  CLOSER: ['clubhouse', 'seats', 'academy'],
  BROKER: ['seats', 'board', 'food']
};

export interface IdleReport {
  desks: number;
  picks: number;
  office: number;
  week: boolean;
  playoffs: boolean;
  offseason: boolean;
  autoPicks: AutoPick[];
  lastScenario?: ScenarioResolution | null;
  lastPick?: PickResult;
  weekOut?: WeekOutcome;
  bracket?: Bracket;
  report?: OffseasonReport;
}

function tasteOf(cls: string): ClassTaste {
  return CLASS_TASTE[cls] || CLASS_TASTE.ANALYST;
}

function idleRng(league: League, team: Team, salt: string): () => number {
  return mulberry32(league.seed + hashStr(team.id + ':' + league.phase + ':' + league.week + ':' + league.draftIdx + ':' + salt));
}

/** Score a desk effect through a class's taste. Higher is better. */
export function scoreIdleEffect(cls: string, eff: ScenarioEffect, cash: number): number {
  const w = tasteOf(cls);
  let s = 0;
  s += ((eff.cash || 0) / 180000) * w.cash;
  if ((eff.cash || 0) < 0 && cash < Math.abs(eff.cash || 0) * 3) s -= w.cash * 0.8;
  s += (eff.trust || 0) * w.trust * 0.12;
  s += (eff.morale || 0) * w.morale * 0.1;
  s += (eff.cond || 0) * w.cond * 0.1;
  s += (eff.fld || 0) * w.fld * 0.08;
  s += (eff.dev || 0) * w.dev * 1.4;
  s += (eff.att || 0) * w.att * 8;
  s += (eff.scoutBoost || 0) * w.scoutBoost * 0.9;
  s -= (eff.injRisk || 0) * w.injRisk * 3.2;
  s += (eff.rainRisk || 0) * w.rainRisk * -1.4;
  s += (eff.weekPatience || 0) * (w.dev || 0.5) * 2;
  s += (eff.weekAggression || 0) * (w.att || 0.5) * 2;
  s += (eff.weekCond || 0) * w.cond * 0.1;
  s += (eff.playerMorale || 0) * w.morale * 0.08;
  s += (eff.playerCond || 0) * w.cond * 0.08;
  s -= (eff.playerInjWeeks || 0) * w.injRisk * 0.9;
  if (eff.rivalEff) {
    s -= (eff.rivalEff.trust || 0) * w.trust * 0.06;
    s -= (eff.rivalEff.cash || 0) / 200000 * w.cash * 0.3;
    s += (eff.rivalEff.rainRisk || 0) * 0.4;
    s += (eff.rivalEff.weekCond || 0) * -0.05;
  }
  if (eff.arc) s += 0.15;
  return s;
}

export function chooseIdleScenario(cls: string, sc: Scenario, cash: number, jitter = 0): 'left' | 'right' {
  const left = scoreIdleEffect(cls, sc.left.eff, cash);
  const right = scoreIdleEffect(cls, sc.right.eff, cash);
  if (Math.abs(left - right) < 0.05) return jitter > 0.5 ? 'right' : 'left';
  return right > left ? 'right' : 'left';
}

function idleDesk(league: League, team: Team): ScenarioResolution | null {
  if (!team.deskPending) return null;
  const sc = nextScenario(league, team);
  if (!sc) {
    team.deskPending = false;
    return null;
  }
  const rng = idleRng(league, team, 'desk');
  const side = chooseIdleScenario(team.cls, sc, team.cash, rng());
  const r = resolveScenario(league, team, side);
  team.deskPending = false;
  return r;
}

function idleDraft(league: League, idle: ReadonlySet<string>): { picks: number; autoPicks: AutoPick[]; last?: PickResult } {
  const autoPicks = autoDraftUntilHuman(league, 200, idle);
  const mine = autoPicks.filter((p) => idle.has(p.teamId));
  const last = mine.length
    ? { ok: true, player: mine[mine.length - 1].player } as PickResult
    : undefined;
  return { picks: mine.length, autoPicks, last };
}

function targetPrices(team: Team): { ticket: number; conPrice: number } {
  switch (team.cls) {
    case 'SHOWMAN': return { ticket: 24, conPrice: 16 };
    case 'FARMER': return { ticket: 14, conPrice: 9 };
    case 'OLD_LION': return { ticket: 17, conPrice: 11 };
    case 'BROKER': return { ticket: team.rank <= 4 ? 22 : 16, conPrice: 13 };
    case 'CLOSER': return { ticket: 19, conPrice: 12 };
    default: return { ticket: 20, conPrice: 12 };
  }
}

function idleOffice(league: League, team: Team): number {
  let n = 0;
  const c = CLASSES[team.cls];
  const rng = idleRng(league, team, 'fo');

  const pref = SKILL_PREF[team.cls] || 'ops';
  if (team.progress && team.progress.unspent > 0) {
    const skill = (SKILLS.indexOf(pref) >= 0 ? pref : 'ops') as SkillKey;
    const r = spendSkill(team, skill);
    if (r.ok) n++;
  }

  if (!team.scoutFocus) {
    if (team.cls === 'CLOSER') team.scoutFocus = 'RP';
    else if (team.cls === 'ANALYST') team.scoutFocus = 'SP';
    else if (team.cls === 'FARMER') team.scoutFocus = rng() > 0.5 ? 'SS' : 'CF';
    else {
      const gap = rosterGaps(team)[0];
      if (gap) team.scoutFocus = gap.pos;
    }
    if (team.scoutFocus) n++;
  }

  if (team.sponsorOffers.length) {
    const best = team.sponsorOffers.slice().sort((a, b) => b.offer - a.offer)[0];
    const trustHit = best.penalty && best.penalty.trust ? best.penalty.trust : 0;
    const take =
      team.cls === 'SHOWMAN' || team.cls === 'BROKER'
        ? true
        : team.cls === 'FARMER' || team.cls === 'OLD_LION'
          ? trustHit >= 0 && team.cash < 3500000
          : trustHit >= -6;
    if (take && signSponsor(league, team, best.name).ok) n++;
  }

  const reserve = team.cls === 'FARMER' ? 900000 : team.cls === 'SHOWMAN' ? 250000 : 500000;
  const keys = PARK_PREF[team.cls] || PARK_PREF.ANALYST;
  for (const key of keys) {
    if (team.cash < reserve) break;
    const spec = STADIUM.find((s) => s.key === key);
    if (!spec) continue;
    const lv = team.stadium[key] || 0;
    if (lv >= spec.levels.length - 1) continue;
    const cost = spec.levels[lv + 1].cost;
    if (cost && team.cash - cost >= reserve * 0.4) {
      if (upgrade(league, team, key).ok) {
        n++;
        break;
      }
    }
  }

  const want = targetPrices(team);
  if (Math.abs(team.ticket - want.ticket) >= 2 || Math.abs(team.conPrice - want.conPrice) >= 2) {
    team.ticket = want.ticket;
    team.conPrice = want.conPrice;
    n++;
  }

  if (team.ap >= 1 && (team.cls === 'ANALYST' || team.cls === 'FARMER' || c.mods.scoutSpeed >= 1.3)) {
    const pool = league.draftPool.length ? league.draftPool : league.freeAgents;
    if (!team.scoutFiles) team.scoutFiles = {};
    const target = pool
      .filter((p) => (team.scoutFiles![p.id] || 0) < 1 && p.scouted < 1)
      .sort((a, b) => (team.scoutFocus && a.pos === team.scoutFocus ? 0 : 1) - (team.scoutFocus && b.pos === team.scoutFocus ? 0 : 1) || b.pot - a.pot)[0];
    if (target) {
      team.ap -= 1;
      team.scoutFiles[target.id] = 1;
      target.scouted = Math.max(target.scouted, 0.4);
      n++;
    }
  }

  if (team.ap >= 1 && team.cls === 'BROKER') {
    const offer = aiTradeOffer(league, team);
    if (offer && offer.ev.accept && offer.ev.gain > 0) {
      const mine = team.roster.find((p) => p.id === offer.wantId);
      const them = league.teams.find((t) => t.id === offer.teamId);
      const theirs = them && them.roster.find((p) => p.id === offer.giveId);
      if (mine && them && theirs) {
        team.ap -= 1;
        const r = execTrade(league, team, them, [mine], [theirs]);
        if (!r.ok) team.ap += 1;
        else n++;
      }
    }
  }

  if (team.ap >= 1 && team.cls !== 'FARMER') {
    const gaps = rosterGaps(team);
    const wantPos = team.cls === 'CLOSER' ? 'RP' : (gaps[0] && gaps[0].pos);
    if (wantPos && league.freeAgents.length) {
      const cand = league.freeAgents
        .filter((p) => p.pos === wantPos || (team.cls === 'CLOSER' && isPitcher(p)))
        .sort((a, b) => value(b) - value(a))[0];
      if (cand && team.cash > cand.salary * 2) {
        team.ap -= 1;
        const r = signFA(league, team, cand.id);
        if (!r.ok) team.ap += 1;
        else n++;
      }
    }
  }

  return n;
}

function idleResign(league: League, team: Team): number {
  let n = 0;
  team.roster.filter((p) => p.expiring).forEach((p) => {
    const ask = Math.round((p.salary * 1.15) / 5000) * 5000;
    const keep =
      team.cls === 'OLD_LION' ? p.age >= 30 && p.ovr >= 46 :
      team.cls === 'FARMER' ? p.age <= 27 && p.pot >= p.ovr :
      team.cls === 'BROKER' ? p.ovr >= 62 :
      p.ovr >= 52;
    if (keep && team.cash > ask * (team.cls === 'FARMER' ? 6 : 3.5)) {
      if (resign(league, team, p.id, ask).ok) n++;
    } else {
      resign(league, team, p.id, 0);
      n++;
    }
  });
  return n;
}

function stepWeek(league: League): WeekOutcome | null {
  if (league.phase !== 'regular') return null;
  if (league.teams.some((t) => t.isHuman && t.deskPending)) return null;
  if (league.teams.some((t) => t.isHuman && !rosterReady(t))) return null;
  const out = playWeek(league);
  if ('done' in out && out.done) return null;
  league.teams.forEach((t) => {
    if (!t.isHuman) return;
    t.deskPending = true;
    if (league.week % 4 === 0) rollSponsorOffers(league, t);
  });
  return out as WeekOutcome;
}

function humans(league: League): Team[] {
  return league.teams.filter((t) => t.isHuman);
}

function allIdle(league: League, idle: ReadonlySet<string>): boolean {
  const h = humans(league);
  return h.length > 0 && h.every((t) => idle.has(t.id));
}

/** One tick: run idle clubs, then advance the calendar only if every human is idle. */
export function runAdvanceIdle(league: League, idleTeamIds: readonly string[]): IdleReport {
  const idle = new Set(idleTeamIds);
  const report: IdleReport = {
    desks: 0, picks: 0, office: 0,
    week: false, playoffs: false, offseason: false,
    autoPicks: []
  };
  if (!idle.size) return report;

  if (league.phase === 'regular') {
    humans(league).forEach((t) => {
      if (!idle.has(t.id)) return;
      const sc = idleDesk(league, t);
      if (sc) {
        report.desks++;
        report.lastScenario = sc;
      }
    });
  }

  const drafted = idleDraft(league, idle);
  report.picks = drafted.picks;
  report.autoPicks = drafted.autoPicks;
  report.lastPick = drafted.last;

  humans(league).forEach((t) => {
    if (!idle.has(t.id)) return;
    if (league.phase === 'offseason') report.office += idleResign(league, t);
    else if (league.phase === 'regular' || league.phase === 'draft') report.office += idleOffice(league, t);
  });

  if (!allIdle(league, idle)) return report;

  // Idle clubs auto-patch the diamond (injuries / empty seats) before the week turns
  humans(league).forEach((t) => {
    if (!idle.has(t.id)) return;
    if (!fieldComplete(t)) t.fieldIds = autoAssignField(t);
  });

  if (league.phase === 'regular') {
    const week = stepWeek(league);
    if (week) {
      report.week = true;
      report.weekOut = week;
    }
  } else if (league.phase === 'playoffs') {
    report.bracket = runPlayoffs(league);
    report.playoffs = true;
  } else if (league.phase === 'offseason') {
    report.report = startOffseason(league);
    aiOffseason(league);
    report.offseason = true;
  }

  return report;
}
