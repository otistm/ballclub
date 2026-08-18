/**
 * The action layer. Every mutation to a league goes through applyAction,
 * which is deterministic: the same league state + the same action always
 * produces the same result. A league is therefore fully reproducible from
 * (seed, human config, ordered action log) — the foundation for shared
 * leagues, server authority, and replay.
 */
import type {
  HumanConfig, League, Position, SkillKey, StadiumKey, WeekOutcome, Bracket, OffseasonReport
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
import { noteOffice, spendSkill } from './progress.js';
import { ROSTER_MAX } from './data/positions.js';

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
  | { t: 'spendSkill'; teamId: string; skill: SkillKey }
  | { t: 'playoffs' }
  | { t: 'offseason' }
  | { t: 'resign'; teamId: string; playerId: string; offer: number }
  | { t: 'letgo'; teamId: string; playerId: string };

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
      const r = resolveScenario(league, team, action.side);
      team.deskPending = false;
      return { ok: true, scenario: r };
    }

    case 'week': {
      if (league.phase !== 'regular') return { ok: false, err: 'Not in season' };
      if (league.teams.some((t) => t.isHuman && t.deskPending)) {
        return { ok: false, err: 'There is a matter on the desk' };
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
      if (me.ap < 1) return { ok: false, err: 'Out of actions' };
      me.ap -= 1;
      const r = execTrade(league, me, them, myOut, theirOut);
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
      return { ok: r.ok, released: r };
    }

    case 'scout': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const pool = league.draftPool.length ? league.draftPool : league.freeAgents;
      const p = pool.find((x) => x.id === action.playerId);
      if (!p) return { ok: false, err: 'No such player' };
      if (p.scouted >= 1) return { ok: false, err: 'That file is finished' };
      if (team.ap < 1) return { ok: false, err: 'Out of actions' };
      team.ap -= 1;
      p.scouted = 1;
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
      team.ticket = Math.round(action.ticket);
      team.conPrice = Math.round(action.conPrice);
      return { ok: true };
    }

    case 'spendSkill': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const r = spendSkill(team, action.skill);
      return { ok: r.ok, err: r.err };
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
      const r = resign(league, team, action.playerId, action.offer);
      return { ok: r.ok, err: r.err, resigned: r };
    }

    case 'letgo': {
      const team = league.teams.find((t) => t.id === action.teamId);
      if (!team) return { ok: false, err: 'No such club' };
      const r = resign(league, team, action.playerId, 0);
      return { ok: true, resigned: r };
    }
  }
}

/** Rebuild a league bit-for-bit from its seed and ordered action log. */
export function replayLeague(seed: number, human: HumanConfig | null, log: LoggedAction[]): League {
  const league = createLeague(seed, human);
  for (const entry of log) applyAction(league, entry.a);
  return league;
}
