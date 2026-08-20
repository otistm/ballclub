/**
 * The action layer. Every mutation to a league goes through applyAction,
 * which is deterministic: the same league state + the same action always
 * produces the same result. A league is therefore fully reproducible from
 * (seed, human config, ordered action log) — the foundation for shared
 * leagues, server authority, and replay.
 */
import type {
  HumanConfig, League, Position, SkillKey, StadiumKey, WeekOutcome, Bracket, OffseasonReport, YardUse
} from './types.js';
import { makeLeague } from './league.js';
import { playWeek } from './week.js';
import { runPlayoffs } from './playoffs.js';
import { aiOffseason, resign, startOffseason, type ResignResult } from './offseason.js';
import { autoDraftUntilHuman, makePick, type AutoPick, type PickResult } from './draft.js';
import { execTrade, type TradeResult } from './trade.js';
import { release, signFA, type ReleaseResult, type SignResult } from './freeagency.js';
import { resolveScenario, type ScenarioResolution } from './scenarios.js';
import { rollSponsorOffers, signSponsor, type SignSponsorResult } from './sponsors.js';
import { upgrade, type UpgradeResult } from './stadium.js';
import { blankProgress, noteOffice, spendSkill } from './progress.js';
import { runAdvanceIdle, type IdleReport } from './idle.js';
import { hireStaff, type HireStaffResult, type StaffRole } from './staff.js';
import { CLASSES } from './data/classes.js';
import { HIT_POS, ROSTER_MAX } from './data/positions.js';
import { clamp } from './rng.js';
import { sanitizeColor } from './format.js';
import {
  autoAssignField, fieldComplete, isHitter, rosterReady, scrubTeamAssignments
} from './lineup.js';

export type GameAction =
  | { t: 'scenario'; teamId: string; side: 'left' | 'right' }
  | { t: 'week' }
  | { t: 'draftPick'; teamId: string; playerId: string }
  | { t: 'advanceDraft' }
  | { t: 'trade'; teamId: string; rivalId: string; give: string[]; get: string[] }
  | { t: 'signFA'; teamId: string; playerId: string }
  | { t: 'release'; teamId: string; playerId: string }
  | { t: 'scout'; teamId: string; playerId: string }
  | { t: 'scoutFocus'; teamId: string; pos: Position | null }
  | { t: 'upgrade'; teamId: string; key: StadiumKey }
  | { t: 'signSponsor'; teamId: string; name: string }
  | { t: 'setVibe'; teamId: string; vibe: string }
  | { t: 'setPrices'; teamId: string; ticket: number; conPrice: number }
  | { t: 'setYard'; teamId: string; use: YardUse }
  | { t: 'spendSkill'; teamId: string; skill: SkillKey }
  | { t: 'hireStaff'; teamId: string; role: StaffRole }
  | { t: 'setLineup'; teamId: string; ids: string[] }
  | { t: 'setRotation'; teamId: string; ids: string[] }
  | { t: 'setField'; teamId: string; pos: Position; playerId: string | null }
  | { t: 'setFieldAuto'; teamId: string }
  | { t: 'setHook'; teamId: string; bullpenHook: number }
  | { t: 'setStrategy'; teamId: string; patience: number; aggression: number; bullpenHook: number }
  | { t: 'clearPendingTrade'; teamId: string }
  | { t: 'respondTrade'; teamId: string; accept: boolean }
  | { t: 'claimTeam'; teamId: string; human: HumanConfig; ownerId: string }
  | { t: 'playoffs' }
  | { t: 'offseason' }
  | { t: 'resign'; teamId: string; playerId: string; offer: number; years?: number }
  | { t: 'letgo'; teamId: string; playerId: string }
  | { t: 'advanceIdle'; idleTeamIds: string[] };

/** Envelope stored in the action log / sent over the wire. */
export interface LoggedAction {
  seq: number;
  at: number;
  by: string | null;
  a: GameAction;
}

export interface ApplyResult {
  ok: boolean;
  err?: string;
  scenario?: ScenarioResolution | null;
  week?: WeekOutcome;
  pick?: PickResult;
  autoPicks?: AutoPick[];
  trade?: TradeResult;
  sign?: SignResult;
  released?: ReleaseResult;
  upgraded?: UpgradeResult;
  sponsor?: SignSponsorResult;
  bracket?: Bracket;
  report?: OffseasonReport;
  resigned?: ResignResult;
  idle?: IdleReport;
  hired?: HireStaffResult;
}

/** One-time setup after makeLeague: sponsor offers + desk state for human clubs. */
export function initLeague(league: League): League {
  league.teams.forEach((t) => {
    if (t.isHuman) {
      rollSponsorOffers(league, t);
      t.deskPending = true;
    }
  });
  return league;
}

export function createLeague(seed: number, human?: HumanConfig | null): League {
  return initLeague(makeLeague(seed, human));
}

export function applyAction(league: League, action: GameAction): ApplyResult {
  switch (action.t) {
    case 'scenario': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      if (!team.deskPending) return { ok: false, err: 'No matter on the desk' };
      const r = resolveScenario(league, team, action.side);
      team.deskPending = false;
      return { ok: true, scenario: r };
    }

    case 'week': {
      if (league.phase !== 'regular') return { ok: false, err: 'Not in season' };
      if (league.teams.some((t) => t.isHuman && t.deskPending)) {
        return { ok: false, err: 'There is a matter on the desk' };
      }
      const unready = league.teams.find((t) => t.isHuman && !rosterReady(t));
      if (unready) {
        return { ok: false, err: unready.abbr + ' still need a full field' };
      }
      const out = playWeek(league);
      if ('done' in out && out.done) return { ok: false, err: 'Season is over' };
      league.teams.forEach((t) => {
        if (!t.isHuman) return;
        t.deskPending = true;
        if (league.week % 4 === 0) rollSponsorOffers(league, t);
      });
      return { ok: true, week: out as WeekOutcome };
    }

    case 'draftPick': {
      const r = makePick(league, action.teamId, action.playerId);
      if (!r.ok) return { ok: false, err: r.err, pick: r };
      const autoPicks = autoDraftUntilHuman(league);
      return { ok: true, pick: r, autoPicks };
    }

    case 'advanceDraft': {
      if (league.phase !== 'draft') return { ok: false, err: 'Draft is over' };
      const autoPicks = autoDraftUntilHuman(league);
      return { ok: true, autoPicks };
    }

    case 'trade': {
      const me = league.teams.find((t) => t.id === action.teamId);
      const them = league.teams.find((t) => t.id === action.rivalId);
      if (!me || !them) return { ok: false, err: 'No such club' };
      const myOut = me.roster.filter((p) => action.give.indexOf(p.id) >= 0);
      const theirOut = them.roster.filter((p) => action.get.indexOf(p.id) >= 0);
      if (!myOut.length && !theirOut.length) return { ok: false, err: 'Empty deal' };
      if (me.roster.length - myOut.length + theirOut.length > ROSTER_MAX) {
        return { ok: false, err: 'That deal puts you over ' + ROSTER_MAX };
      }
      // human-to-human: park the offer on their desk instead of auto-accepting
      if (them.isHuman) {
        if (me.ap < 1) return { ok: false, err: 'Out of actions' };
        me.ap -= 1;
        them.inboxTrade = {
          fromId: me.id,
          give: myOut.map((p) => p.id),
          get: theirOut.map((p) => p.id)
        };
        league.log.push({
          w: league.week, trade: true,
          txt: me.abbr + ' faxed a deal to ' + them.abbr
        });
        return { ok: true };
      }
      if (me.ap < 1) return { ok: false, err: 'Out of actions' };
      me.ap -= 1;
      const r = execTrade(league, me, them, myOut, theirOut);
      if (!r.ok) me.ap += 1;
      if (r.ok && me.pendingTrade && me.pendingTrade.rivalId === action.rivalId) {
        me.pendingTrade = null;
      }
      return { ok: r.ok, err: r.ok ? undefined : r.ev.verdict, trade: r };
    }

    case 'signFA': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      if (team.ap < 1) return { ok: false, err: 'Out of actions' };
      team.ap -= 1;
      const r = signFA(league, team, action.playerId);
      if (!r.ok) team.ap += 1; // refund on failure, mirroring the original game
      return { ok: r.ok, err: r.err, sign: r };
    }

    case 'release': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const r = release(league, team, action.playerId);
      if (r.ok) scrubTeamAssignments(team);
      return { ok: r.ok, released: r };
    }

    case 'scout': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const pool = league.draftPool.length ? league.draftPool : league.freeAgents;
      const p = pool.find((x) => x.id === action.playerId);
      if (!p) return { ok: false, err: 'No such player' };
      if (!team.scoutFiles) team.scoutFiles = {};
      if ((team.scoutFiles[p.id] || 0) >= 1 || p.scouted >= 1) {
        return { ok: false, err: 'That file is finished' };
      }
      if (team.ap < 1) return { ok: false, err: 'Out of actions' };
      team.ap -= 1;
      team.scoutFiles[p.id] = 1;
      p.scouted = Math.max(p.scouted, 0.4);
      noteOffice(team, 'scouts', 12, 'Scouting');
      return { ok: true };
    }

    case 'scoutFocus': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      team.scoutFocus = action.pos;
      return { ok: true };
    }

    case 'upgrade': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const r = upgrade(league, team, action.key);
      return { ok: r.ok, err: r.err, upgraded: r };
    }

    case 'signSponsor': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const r = signSponsor(league, team, action.name);
      return { ok: r.ok, sponsor: r };
    }

    case 'setVibe': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      team.vibe = action.vibe;
      return { ok: true };
    }

    case 'setPrices': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      team.ticket = clamp(Math.round(action.ticket), 1, 75);
      team.conPrice = clamp(Math.round(action.conPrice), 1, 40);
      return { ok: true };
    }

    case 'setYard': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      if (action.use !== 'lock' && action.use !== 'open' && action.use !== 'rent') {
        return { ok: false, err: 'Bad yard booking' };
      }
      team.yardUse = action.use;
      return { ok: true };
    }

    case 'spendSkill': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const r = spendSkill(team, action.skill);
      return { ok: r.ok, err: r.err };
    }

    case 'hireStaff': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const r = hireStaff(league, team, action.role);
      if (r.ok) {
        league.log.push({
          w: league.week + 1, t: team.id,
          txt: team.abbr + ' upgraded the ' + action.role + ' office'
        });
        noteOffice(team, 'builds', 8, 'Staff');
      }
      return { ok: r.ok, err: r.err, hired: r };
    }

    case 'playoffs': {
      if (league.phase !== 'playoffs') return { ok: false, err: 'Not playoff time' };
      const bracket = runPlayoffs(league);
      return { ok: true, bracket };
    }

    case 'offseason': {
      if (league.phase !== 'offseason') return { ok: false, err: 'Not the offseason' };
      const report = startOffseason(league);
      aiOffseason(league);
      return { ok: true, report };
    }

    case 'resign': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const r = resign(league, team, action.playerId, action.offer, action.years);
      return { ok: r.ok, err: r.err, resigned: r };
    }

    case 'letgo': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const r = resign(league, team, action.playerId, 0);
      return { ok: !!r.ok || !!r.lost, err: r.err, resigned: r };
    }

    case 'setLineup': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      if (!action.ids.length) {
        team.lineupIds = null;
        return { ok: true };
      }
      if (!fieldComplete(team)) {
        return { ok: false, err: 'Set the field before locking a batting order' };
      }
      const fieldSet = new Set(HIT_POS.map((pos) => team.fieldIds![pos]!));
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const id of action.ids) {
        if (seen.has(id) || !fieldSet.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
      if (ids.length < 9) return { ok: false, err: 'Batting order must use your nine fielders' };
      team.lineupIds = ids.slice(0, 9);
      return { ok: true };
    }

    case 'setRotation': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const ids = action.ids.filter((id) => {
        const p = team.roster.find((x) => x.id === id);
        return p && p.pos === 'SP';
      });
      team.rotationIds = ids.length ? ids : null;
      return { ok: true };
    }

    case 'setField': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      if (!(HIT_POS as readonly string[]).includes(action.pos)) return { ok: false, err: 'Bad position' };
      const slot = action.pos as (typeof HIT_POS)[number];
      if (!team.fieldIds) team.fieldIds = {};
      if (action.playerId == null) {
        delete team.fieldIds[slot];
        team.lineupIds = null;
        return { ok: true };
      }
      const p = team.roster.find((x) => x.id === action.playerId);
      if (!p) return { ok: false, err: 'No such player' };
      if (!isHitter(p)) return { ok: false, err: 'Pitchers stay in the arms list' };
      if (p.injured) return { ok: false, err: 'He is on the shelf' };
      // One player, one spot
      HIT_POS.forEach((pos) => {
        if (team.fieldIds![pos] === action.playerId) delete team.fieldIds![pos];
      });
      team.fieldIds[slot] = action.playerId;
      team.lineupIds = null;
      return { ok: true };
    }

    case 'setFieldAuto': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      team.fieldIds = autoAssignField(team);
      team.lineupIds = null;
      if (!fieldComplete(team)) {
        return { ok: false, err: 'Need nine healthy hitters to fill the field' };
      }
      return { ok: true };
    }

    case 'setHook': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      team.strategy.bullpenHook = clamp(action.bullpenHook, 0.05, 0.95);
      return { ok: true };
    }

    case 'setStrategy': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      team.strategy.patience = clamp(action.patience, 0.05, 0.95);
      team.strategy.aggression = clamp(action.aggression, 0.05, 0.95);
      team.strategy.bullpenHook = clamp(action.bullpenHook, 0.05, 0.95);
      return { ok: true };
    }

    case 'clearPendingTrade': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      team.pendingTrade = null;
      return { ok: true };
    }

    case 'respondTrade': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const inbox = team.inboxTrade;
      if (!inbox) return { ok: false, err: 'No deal on the fax' };
      const from = league.teams.find((t) => t.id === inbox.fromId);
      if (!from) {
        team.inboxTrade = null;
        return { ok: false, err: 'That club is gone' };
      }
      if (!action.accept) {
        team.inboxTrade = null;
        league.log.push({
          w: league.week, trade: true,
          txt: team.abbr + ' passed on ' + from.abbr
        });
        return { ok: true };
      }
      // inbox.give = players leaving the offerer (from); inbox.get = players leaving the receiver (team)
      const theirOut = from.roster.filter((p) => inbox.give.indexOf(p.id) >= 0);
      const myOut = team.roster.filter((p) => inbox.get.indexOf(p.id) >= 0);
      if (theirOut.length !== inbox.give.length || myOut.length !== inbox.get.length) {
        team.inboxTrade = null;
        return { ok: false, err: 'The pieces have moved' };
      }
      if (from.roster.length - theirOut.length + myOut.length > ROSTER_MAX) {
        return { ok: false, err: 'That deal puts them over ' + ROSTER_MAX };
      }
      if (team.roster.length - myOut.length + theirOut.length > ROSTER_MAX) {
        return { ok: false, err: 'That deal puts you over ' + ROSTER_MAX };
      }
      team.inboxTrade = null;
      const r = execTrade(league, from, team, theirOut, myOut, true);
      return { ok: r.ok, err: r.ok ? undefined : r.ev.verdict, trade: r };
    }

    case 'claimTeam': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      if (team.isHuman) return { ok: false, err: 'That club is taken' };
      const h = action.human;
      team.isHuman = true;
      team.ownerId = action.ownerId;
      team.name = h.name;
      team.city = h.city;
      team.mascot = h.mascot;
      team.cls = h.cls;
      team.color = sanitizeColor(h.color);
      team.glyph = h.glyph;
      team.vibe = h.vibe;
      team.staff = { ...CLASSES[h.cls].staff };
      team.strategy = { ...CLASSES[h.cls].strategy };
      team.abbr = (h.city.replace(/[^A-Za-z]/g, '').slice(0, 2) + h.mascot.slice(0, 1)).toUpperCase();
      if (!team.progress) team.progress = blankProgress();
      if (league.phase === 'regular') team.deskPending = true;
      if (!fieldComplete(team)) team.fieldIds = autoAssignField(team);
      rollSponsorOffers(league, team);
      league.log.push({
        w: league.week + 1, t: team.id,
        txt: h.name + ' take the job in ' + h.city
      });
      return { ok: true };
    }

    case 'advanceIdle': {
      if (!action.idleTeamIds.length) return { ok: false, err: 'Nobody is idle' };
      const humans = league.teams.filter((t) => t.isHuman).map((t) => t.id);
      const ids = action.idleTeamIds.filter((id, i, arr) => humans.indexOf(id) >= 0 && arr.indexOf(id) === i);
      if (!ids.length) return { ok: false, err: 'Nobody is idle' };
      const idle = runAdvanceIdle(league, ids);
      return { ok: true, idle };
    }
  }
}

/** Which club an action mutates, if any — used by the server for ownership checks. */
export function actionTeamId(a: GameAction): string | null {
  switch (a.t) {
    case 'week':
    case 'advanceDraft':
    case 'playoffs':
    case 'offseason':
    case 'advanceIdle':
      return null;
    case 'claimTeam':
      return a.teamId;
    default:
      return 'teamId' in a ? (a as { teamId: string }).teamId : null;
  }
}

/** Rebuild a league bit-for-bit from its seed and ordered action log. */
export function replayLeague(seed: number, human: HumanConfig | null, log: LoggedAction[]): League {
  const league = createLeague(seed, human);
  for (const entry of log) applyAction(league, entry.a);
  return league;
}
