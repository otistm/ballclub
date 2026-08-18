import { describe, expect, it } from 'vitest';
import {
  applyAction, createLeague, replayLeague,
  type GameAction, type HumanConfig, type League, type LoggedAction
} from '../src/index.js';

const HUMAN: HumanConfig = {
  name: 'Ashland Wolves', city: 'Ashland', mascot: 'Wolves',
  cls: 'ANALYST', color: '#3BA7D6', glyph: 'anvil', vibe: 'NIGHT'
};

function snapshot(l: League): string {
  return JSON.stringify(l);
}

/** Drive a league through a scripted set of moves, returning the log. */
function playScript(league: League): LoggedAction[] {
  const log: LoggedAction[] = [];
  let seq = 0;
  const act = (a: GameAction) => {
    const r = applyAction(league, a);
    log.push({ seq: ++seq, at: 0, by: 'test', a });
    return r;
  };

  // draft: human always takes the first pool player on the clock
  act({ t: 'advanceDraft' });
  let guard = 0;
  while (league.phase === 'draft' && guard++ < 300) {
    const cur = league.draftOrder[league.draftIdx];
    if (!cur) break;
    const team = league.teams.find((t) => t.id === cur.teamId)!;
    if (team.isHuman) {
      act({ t: 'draftPick', teamId: team.id, playerId: league.draftPool[0].id });
    } else {
      act({ t: 'advanceDraft' });
    }
  }

  // four weeks of regular season with desk scenarios
  for (let w = 0; w < 4; w++) {
    act({ t: 'scenario', teamId: 't0', side: w % 2 === 0 ? 'left' : 'right' });
    act({ t: 'week' });
  }
  // a few front-office moves
  act({ t: 'setPrices', teamId: 't0', ticket: 22, conPrice: 14 });
  act({ t: 'upgrade', teamId: 't0', key: 'food' });
  return log;
}

describe('determinism', () => {
  it('creates identical leagues from the same seed', () => {
    const a = createLeague(12345, HUMAN);
    const b = createLeague(12345, HUMAN);
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it('creates different leagues from different seeds', () => {
    const a = createLeague(1, HUMAN);
    const b = createLeague(2, HUMAN);
    expect(snapshot(a)).not.toEqual(snapshot(b));
  });

  it('replays a league bit-for-bit from (seed, action log)', () => {
    const live = createLeague(777, HUMAN);
    const log = playScript(live);
    const replayed = replayLeague(777, HUMAN, log);
    expect(snapshot(replayed)).toEqual(snapshot(live));
  });

  it('replay survives JSON round-tripping of the log (wire format)', () => {
    const live = createLeague(31337, HUMAN);
    const log = playScript(live);
    const wireLog = JSON.parse(JSON.stringify(log)) as LoggedAction[];
    const replayed = replayLeague(31337, HUMAN, wireLog);
    expect(snapshot(replayed)).toEqual(snapshot(live));
  });
});
