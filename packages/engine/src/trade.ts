import { mulberry32, pick, R, RI } from './rng.js';
import { CLASSES } from './data/classes.js';
import { needScore } from './draft.js';
import { award } from './league.js';
import { value } from './player.js';
import { scrubTeamAssignments } from './lineup.js';
import { dealsMul, noteOffice } from './progress.js';
import type { League, Player, Team } from './types.js';

export interface TradeEval {
  myVal: number;
  theirVal: number;
  delta: number;
  gain: number;
  accept: boolean;
  bar: number;
  verdict: string;
}

export function evalTrade(
  _league: League, myTeam: Team, theirTeam: Team, myOut: Player[], theirOut: Player[]
): TradeEval {
  const myVal = myOut.reduce((s, p) => s + value(p), 0);
  const theirVal = theirOut.reduce((s, p) => s + value(p), 0);
  const brokerMul = (CLASSES[myTeam.cls].mods.tradeValue || 1) * dealsMul(myTeam);
  // their perspective: they receive myOut, give theirOut
  let need = 0;
  myOut.forEach((p) => {
    need += (needScore(theirTeam, p) - 1) * 6;
  });
  theirOut.forEach((p) => {
    need -= (needScore(theirTeam, p) - 1) * 4;
  });
  const salaryRelief =
    (myOut.reduce((s, p) => s + p.salary, 0) - theirOut.reduce((s, p) => s + p.salary, 0)) / 1400000;
  const theirGain = myVal * brokerMul + need - salaryRelief - theirVal;
  const scale = Math.max(8, (myVal + theirVal) * 0.5);
  const bar = scale * 0.05;
  const accept = theirGain > bar;
  return {
    myVal: +myVal.toFixed(1),
    theirVal: +theirVal.toFixed(1),
    delta: +(theirVal - myVal).toFixed(1),
    gain: +theirGain.toFixed(1),
    accept,
    bar: +bar.toFixed(1),
    verdict:
      theirGain > scale * 0.5
        ? 'They will take this in a heartbeat'
        : theirGain > bar
          ? 'They accept'
          : theirGain > -scale * 0.3
            ? 'Close. Sweeten it a little.'
            : 'Not close.'
  };
}

export interface TradeResult {
  ok: boolean;
  ev: TradeEval;
}

export function execTrade(
  league: League, myTeam: Team, theirTeam: Team, myOut: Player[], theirOut: Player[], force = false
): TradeResult {
  const ev = evalTrade(league, myTeam, theirTeam, myOut, theirOut);
  if (!force && !ev.accept) return { ok: false, ev };
  myOut.forEach((p) => {
    myTeam.roster = myTeam.roster.filter((x) => x.id !== p.id);
    p.teamId = theirTeam.id;
    theirTeam.roster.push(p);
  });
  theirOut.forEach((p) => {
    theirTeam.roster = theirTeam.roster.filter((x) => x.id !== p.id);
    p.teamId = myTeam.id;
    p.scouted = 1;
    myTeam.roster.push(p);
  });
  scrubTeamAssignments(myTeam);
  scrubTeamAssignments(theirTeam);
  if (ev.delta >= Math.max(12, ev.myVal * 0.4)) award(myTeam, 'FLEECED', league);
  const give = myOut.map((p) => p.name).join(', ') || 'nobody';
  const get = theirOut.map((p) => p.name).join(', ') || 'nobody';
  league.log.push({
    w: league.week,
    trade: true,
    txt: myTeam.abbr + ' send ' + give + ' · ' + theirTeam.abbr + ' send ' + get
  });
  noteOffice(myTeam, 'trades', 22, 'Trade');
  if (theirTeam.isHuman) noteOffice(theirTeam, 'trades', 22, 'Trade');
  return { ok: true, ev };
}

export interface AiTradeOffer {
  teamId: string;
  wantId: string;
  giveId: string;
  ev: TradeEval;
}

export function aiTradeOffer(league: League, myTeam: Team): AiTradeOffer | null {
  const rng = mulberry32(league.seed + league.week * 313 + 7);
  const others = league.teams.filter((t) => t.id !== myTeam.id);
  const them = pick(rng, others);
  const mine = myTeam.roster.slice().sort((a, b) => value(b) - value(a));
  const theirs = them.roster.slice().sort((a, b) => value(b) - value(a));
  const want = mine[RI(rng, 0, Math.min(4, mine.length - 1))];
  if (!want) return null;
  const target = value(want) * R(rng, 0.85, 1.15);
  let best: Player | null = null;
  let bestD = 1e9;
  for (let i = 0; i < theirs.length; i++) {
    const d = Math.abs(value(theirs[i]) - target);
    if (d < bestD) {
      bestD = d;
      best = theirs[i];
    }
  }
  if (!best) return null;
  return { teamId: them.id, wantId: want.id, giveId: best.id, ev: evalTrade(league, myTeam, them, [want], [best]) };
}
