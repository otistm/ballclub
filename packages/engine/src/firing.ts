/**
 * Ownership dismissal. A human club that cannot put nine healthy hitters
 * and a starter on the grass, and cannot buy the missing bodies, is done.
 * Bargaining buys one more season on a short payroll with the sale window shut.
 */
import { CLASSES } from './data/classes.js';
import { HIT_POS, ROSTER_MAX } from './data/positions.js';
import { autoDraftUntilHuman } from './draft.js';
import { autoAssignField, fieldComplete, isHitter } from './lineup.js';
import { aiOffseason, startOffseason } from './offseason.js';
import { genPlayer } from './player.js';
import { faBonusMul } from './progress.js';
import { clamp, mulberry32 } from './rng.js';
import { rollSponsorOffers } from './sponsors.js';
import type { League, Player, Position, Team } from './types.js';

export const PROBATION_CASH_MUL = 0.42;
export const SKEPTICAL_CASH_MUL = 0.72;
export const SKEPTICAL_TRUST_MUL = 0.55;

export function sellLocked(league: League, team: Team): boolean {
  return team.sellLockSeason === league.season;
}

export function faBonusFor(team: Team, p: Player): number {
  return Math.round(p.salary * 0.5 * faBonusMul(team));
}

function healthyHitters(team: Team): Player[] {
  return team.roster.filter((p) => isHitter(p) && !p.injured);
}

function healthySPs(team: Team): Player[] {
  return team.roster.filter((p) => p.pos === 'SP' && !p.injured);
}

/** Cheapest-first FA fill for the holes a club still has. */
export function canStaffField(league: League, team: Team): boolean {
  let needHit = Math.max(0, HIT_POS.length - healthyHitters(team).length);
  let needSp = healthySPs(team).length ? 0 : 1;
  if (!needHit && !needSp) return true;
  let room = ROSTER_MAX - team.roster.length;
  if (room < needHit + needSp) return false;
  let cash = team.cash;
  const pool = league.freeAgents.slice().sort((a, b) => faBonusFor(team, a) - faBonusFor(team, b));
  for (const p of pool) {
    if (!needHit && !needSp) break;
    if (room <= 0) break;
    if (p.injured) continue;
    const bonus = faBonusFor(team, p);
    if (cash < bonus) continue;
    if (needSp && p.pos === 'SP') {
      cash -= bonus;
      needSp = 0;
      room--;
      continue;
    }
    if (needHit && isHitter(p)) {
      cash -= bonus;
      needHit--;
      room--;
    }
  }
  return needHit === 0 && needSp === 0;
}

/**
 * Fired when it is still a playing season and the club cannot put a
 * field on the grass from the roster plus what it can still afford.
 */
export function orgFired(league: League, team: Team): boolean {
  if (!team.isHuman) return false;
  if (league.phase !== 'regular' && league.phase !== 'playoffs') return false;
  return !canStaffField(league, team);
}

export function applySkepticalHire(team: Team): void {
  team.cash = Math.round(team.cash * SKEPTICAL_CASH_MUL);
  team.startCash = team.cash;
  team.fanTrust = clamp(Math.round(team.fanTrust * SKEPTICAL_TRUST_MUL), 14, 32);
  team.boardMood = 'skeptical';
}

function fillEmergencyRoster(league: League, team: Team): void {
  const ids = {
    get next() { return league.pid; },
    set next(v: number) { league.pid = v; }
  };
  const rng = mulberry32(league.seed + league.season * 7919 + team.slot * 17 + 3);
  const want: Position[] = [];
  const haveHit = healthyHitters(team).length;
  if (haveHit < HIT_POS.length) {
    for (let i = haveHit; i < HIT_POS.length; i++) want.push(HIT_POS[i]);
  }
  if (!healthySPs(team).length) want.push('SP');
  if (team.roster.filter((p) => p.pos === 'RP' && !p.injured).length < 2) {
    want.push('RP', 'RP');
  }
  for (const pos of want) {
    if (team.roster.length >= ROSTER_MAX) break;
    const p = genPlayer(rng, ids, { pos, tier: -0.95, age: 27, scouted: 1, origin: 'class' });
    p.teamId = team.id;
    p.salary = Math.max(45000, Math.round((p.salary * 0.55) / 5000) * 5000);
    team.roster.push(p);
  }
  let guard = 0;
  while (
    (healthyHitters(team).length < HIT_POS.length || healthySPs(team).length < 1) &&
    team.roster.length < ROSTER_MAX &&
    guard++ < 12
  ) {
    const needSp = healthySPs(team).length < 1;
    const p = genPlayer(rng, ids, {
      pos: needSp ? 'SP' : HIT_POS[Math.min(healthyHitters(team).length, HIT_POS.length - 1)],
      tier: -1.05,
      age: 28,
      scouted: 1,
      origin: 'class'
    });
    p.teamId = team.id;
    p.salary = Math.max(45000, Math.round((p.salary * 0.5) / 5000) * 5000);
    team.roster.push(p);
  }
}

export interface SecondChanceResult {
  ok: boolean;
  err?: string;
}

export function grantSecondChance(league: League, team: Team): SecondChanceResult {
  if (!team.isHuman) return { ok: false, err: 'The board is not asking' };
  if (!orgFired(league, team)) return { ok: false, err: 'The board is not asking' };

  startOffseason(league);
  aiOffseason(league);
  autoDraftUntilHuman(league, 400, [team.id]);

  const spec = CLASSES[team.cls];
  team.cash = Math.round(spec.cash * PROBATION_CASH_MUL);
  team.startCash = team.cash;
  team.fanTrust = clamp(Math.round(Math.min(team.fanTrust, spec.fanTrust) * 0.7), 16, 40);
  team.sellLockSeason = league.season;
  team.boardMood = 'probation';
  team.pendingTrade = null;
  team.inboxTrade = null;
  fillEmergencyRoster(league, team);
  team.fieldIds = autoAssignField(team);
  team.lineupIds = null;
  team.rotationIds = null;
  team.deskPending = league.phase === 'regular';
  if (league.phase === 'regular') rollSponsorOffers(league, team);
  league.log.push({
    w: league.week,
    t: team.id,
    txt: team.abbr + ' bargained a second season. The sale window is shut.'
  });
  return { ok: true };
}
