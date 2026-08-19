import { describe, expect, it } from 'vitest';
import {
  applyAction, chooseIdleScenario, createLeague, developRoster, scoutFogMul, shownOvr,
  SCENARIOS, type HumanConfig, type League
} from '../src/index.js';

const HUMAN: HumanConfig = {
  name: 'Ashland Wolves', city: 'Ashland', mascot: 'Wolves',
  cls: 'ANALYST', color: '#3BA7D6', glyph: 'anvil', vibe: 'NIGHT'
};

function drafted(seed = 42, cls: string = 'ANALYST'): League {
  const league = createLeague(seed, { ...HUMAN, cls });
  applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0'] });
  return league;
}

describe('Wave A unlocks', () => {
  it('applies devBonus in developRoster', () => {
    const league = drafted(11);
    const t = league.teams[0];
    const kid = t.roster.find((p) => p.age < 25 && p.pot > p.ovr + 4);
    if (!kid) return;
    const before = kid.ovr;
    t.devBonus = 2.5;
    for (let w = 0; w < 8; w++) {
      league.week = w;
      developRoster(league, t);
    }
    expect(kid.ovr + (kid._acc || 0)).toBeGreaterThan(before);
  });

  it('sets rainRisk from the rain desk card', () => {
    const league = drafted(22);
    const t = league.teams[0];
    t.deskPending = true;
    // force rain card onto the deck
    league.scenarioDeck = ['sc_rain', ...league.scenarioDeck.filter((id) => id !== 'sc_rain')];
    league.scenarioIdx = 0;
    applyAction(league, { t: 'scenario', teamId: t.id, side: 'left' });
    expect((t.rainRisk || 0)).toBeGreaterThan(0);
  });

  it('midnight call parks a pending trade', () => {
    const league = drafted(33);
    const t = league.teams[0];
    league.scenarioDeck = ['sc_trade', ...league.scenarioDeck.filter((id) => id !== 'sc_trade')];
    league.scenarioIdx = 0;
    t.deskPending = true;
    const r = applyAction(league, { t: 'scenario', teamId: t.id, side: 'right' });
    expect(r.ok).toBe(true);
    expect(t.pendingTrade).toBeTruthy();
    expect(t.pendingTrade!.give.length).toBe(1);
    expect(t.pendingTrade!.get.length).toBe(1);
  });

  it('Analyst fog is tighter than Showman', () => {
    const a = createLeague(1, { ...HUMAN, cls: 'ANALYST' });
    const s = createLeague(1, { ...HUMAN, cls: 'SHOWMAN' });
    expect(scoutFogMul(a.teams[0])).toBeLessThan(scoutFogMul(s.teams[0]));
  });

  it('locks a lineup and clears it', () => {
    const league = drafted(44);
    const t = league.teams[0];
    expect(applyAction(league, { t: 'setFieldAuto', teamId: t.id }).ok).toBe(true);
    const ids = (['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const).map((pos) => t.fieldIds![pos]!);
    expect(applyAction(league, { t: 'setLineup', teamId: t.id, ids }).ok).toBe(true);
    expect(t.lineupIds?.length).toBe(9);
    expect(applyAction(league, { t: 'setLineup', teamId: t.id, ids: [] }).ok).toBe(true);
    expect(t.lineupIds).toBeNull();
  });

  it('setStrategy writes aggression and hook', () => {
    const league = drafted(55);
    const t = league.teams[0];
    applyAction(league, {
      t: 'setStrategy', teamId: t.id, patience: 0.2, aggression: 0.9, bullpenHook: 0.8
    });
    expect(t.strategy.aggression).toBeCloseTo(0.9, 5);
    expect(t.strategy.bullpenHook).toBeCloseTo(0.8, 5);
  });

  it('claimTeam flips an AI seat to human', () => {
    const league = drafted(66);
    const seat = league.teams.find((t) => !t.isHuman)!;
    const r = applyAction(league, {
      t: 'claimTeam',
      teamId: seat.id,
      ownerId: 'friend1',
      human: {
        name: 'Salt Fork Hawks', city: 'Salt Fork', mascot: 'Hawks',
        cls: 'FARMER', color: '#4E8A63', glyph: 'ball', vibe: 'DAY'
      }
    });
    expect(r.ok).toBe(true);
    expect(seat.isHuman).toBe(true);
    expect(seat.ownerId).toBe('friend1');
    expect(seat.cls).toBe('FARMER');
  });

  it('Farmer still skips dollar dogs', () => {
    const sc = SCENARIOS.find((s) => s.id === 'sc_hotdog')!;
    expect(chooseIdleScenario('FARMER', sc, 2_900_000)).toBe('left');
  });

  it('shownOvr respects fog mul', () => {
    const league = createLeague(77, HUMAN);
    const p = league.draftPool.find((x) => x.scouted < 1)!;
    const tight = shownOvr(p, 0.4);
    const wide = shownOvr(p, 1);
    expect(tight.hi - tight.lo).toBeLessThanOrEqual(wide.hi - wide.lo);
  });
});
