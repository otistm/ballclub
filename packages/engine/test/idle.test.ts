import { describe, expect, it } from 'vitest';
import {
  applyAction, autoDraftUntilHuman, chooseIdleScenario, createLeague, draftCurrent,
  replayLeague, SCENARIOS,
  type GameAction, type HumanConfig, type League, type LoggedAction
} from '../src/index.js';

const HUMAN: HumanConfig = {
  name: 'Ashland Wolves', city: 'Ashland', mascot: 'Wolves',
  cls: 'ANALYST', color: '#3BA7D6', glyph: 'anvil', vibe: 'NIGHT'
};

function sc(id: string) {
  return SCENARIOS.find((s) => s.id === id)!;
}

function snapshot(l: League): string {
  return JSON.stringify(l);
}

function markHuman(league: League, id: string): void {
  const t = league.teams.find((x) => x.id === id)!;
  t.isHuman = true;
  t.deskPending = league.phase === 'regular';
}

function draftedByIdle(seed = 99, cls: HumanConfig['cls'] = 'ANALYST'): League {
  const human = { ...HUMAN, cls };
  const league = createLeague(seed, human);
  applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0'] });
  expect(league.phase).toBe('regular');
  return league;
}

describe('idle class taste', () => {
  it('Analyst pays the scout tip', () => {
    expect(chooseIdleScenario('ANALYST', sc('sc_scout'), 4_200_000)).toBe('right');
  });

  it('Showman runs the dollar dogs', () => {
    expect(chooseIdleScenario('SHOWMAN', sc('sc_hotdog'), 5_600_000)).toBe('right');
  });

  it('Farmer skips the expensive dogs', () => {
    expect(chooseIdleScenario('FARMER', sc('sc_hotdog'), 2_900_000)).toBe('left');
    expect(chooseIdleScenario('FARMER', sc('sc_hotdog'), 400_000)).toBe('left');
  });

  it('Closer rests the ace instead of pitching through it', () => {
    expect(chooseIdleScenario('CLOSER', sc('sc_ace'), 4_000_000)).toBe('left');
  });

  it('Old Lion keeps the veteran in the lineup', () => {
    expect(chooseIdleScenario('OLD_LION', sc('sc_vet'), 3_800_000)).toBe('left');
  });
});

describe('advanceIdle', () => {
  it('refuses an empty idle list', () => {
    const league = createLeague(1, HUMAN);
    const r = applyAction(league, { t: 'advanceIdle', idleTeamIds: [] });
    expect(r.ok).toBe(false);
  });

  it('auto-drafts an idle human and leaves the desk for next tick', () => {
    const league = createLeague(42, HUMAN);
    expect(league.phase).toBe('draft');
    const r = applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0'] });
    expect(r.ok).toBe(true);
    expect(r.idle?.picks).toBeGreaterThan(0);
    expect(league.phase).toBe('regular');
    expect(league.week).toBe(0);
    expect(league.teams[0].deskPending).toBe(true);
    expect(r.idle?.week).toBe(false);
    expect(r.idle?.desks).toBe(0);
  });

  it('clears the desk then plays a week when every human is idle', () => {
    const league = draftedByIdle(77);
    expect(league.teams[0].deskPending).toBe(true);
    const r = applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0'] });
    expect(r.ok).toBe(true);
    expect(r.idle?.desks).toBe(1);
    expect(r.idle?.week).toBe(true);
    expect(league.week).toBe(1);
    expect(league.teams[0].deskPending).toBe(true);
  });

  it('does not play the week while another human is still at the desk', () => {
    const league = draftedByIdle(88);
    markHuman(league, 't1');
    const week = league.week;
    const r = applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0'] });
    expect(r.idle?.week).toBe(false);
    expect(league.week).toBe(week);
    expect(league.teams.find((t) => t.id === 't1')!.deskPending).toBe(true);
  });

  it('plays the week once every human is listed idle', () => {
    const league = draftedByIdle(91);
    markHuman(league, 't1');
    const r = applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0', 't1'] });
    expect(r.idle?.desks).toBe(2);
    expect(r.idle?.week).toBe(true);
    expect(league.week).toBe(1);
  });

  it('stops the live draft at a human who is not idle', () => {
    const league = createLeague(12, HUMAN);
    const picks = autoDraftUntilHuman(league);
    const cur = draftCurrent(league);
    expect(cur).toBeTruthy();
    expect(league.teams.find((t) => t.id === cur!.teamId)!.isHuman).toBe(true);
    expect(picks.every((p) => !league.teams.find((t) => t.id === p.teamId)!.isHuman)).toBe(true);
  });
});

describe('advanceIdle determinism', () => {
  it('same seed and idle list replay bit-for-bit', () => {
    const act: GameAction = { t: 'advanceIdle', idleTeamIds: ['t0'] };
    const a = createLeague(31337, HUMAN);
    const b = createLeague(31337, HUMAN);
    applyAction(a, act);
    applyAction(a, act);
    applyAction(b, act);
    applyAction(b, act);
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it('replays from the action log', () => {
    const live = createLeague(555, HUMAN);
    const log: LoggedAction[] = [];
    let seq = 0;
    const act = (a: GameAction) => {
      applyAction(live, a);
      log.push({ seq: ++seq, at: 0, by: 'test', a });
    };
    act({ t: 'advanceIdle', idleTeamIds: ['t0'] });
    act({ t: 'advanceIdle', idleTeamIds: ['t0'] });
    act({ t: 'advanceIdle', idleTeamIds: ['t0'] });
    const replayed = replayLeague(555, HUMAN, log);
    expect(snapshot(replayed)).toEqual(snapshot(live));
  });
});
