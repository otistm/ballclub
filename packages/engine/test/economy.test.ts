import { describe, expect, it } from 'vitest';
import {
  applyAction, createLeague, runEconomy, yardTake, weekPair,
  type HumanConfig, type League
} from '../src/index.js';

const HUMAN: HumanConfig = {
  name: 'Ashland Wolves', city: 'Ashland', mascot: 'Wolves',
  cls: 'ANALYST', color: '#3BA7D6', glyph: 'anvil', vibe: 'NIGHT'
};

function drafted(seed = 7): League {
  const league = createLeague(seed, HUMAN);
  applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0'] });
  return league;
}

describe('home vs road gate', () => {
  it('a homestand pays tickets and concessions; a road week does not', () => {
    const league = drafted();
    const me = league.teams[0];
    const home = runEconomy(league, { ...me, sponsors: me.sponsors.map((s) => ({ ...s })) }, 3);
    const road = runEconomy(league, { ...me, sponsors: me.sponsors.map((s) => ({ ...s })) }, 0);
    expect(home.home).toBe(true);
    expect(home.gate).toBeGreaterThan(0);
    expect(home.conc).toBeGreaterThan(0);
    expect(home.att).toBeGreaterThan(0);
    expect(road.home).toBe(false);
    expect(road.gate).toBe(0);
    expect(road.conc).toBe(0);
    expect(road.merch).toBe(0);
    expect(road.att).toBe(0);
  });

  it('open yard booking pays on the road and lock pays nothing', () => {
    const league = drafted();
    const me = league.teams[0];
    me.yardUse = 'open';
    const open = runEconomy(league, me, 0);
    expect(open.yard).toBeGreaterThan(0);
    expect(open.yardUse).toBe('open');
    expect((open.yardAtt || 0)).toBeGreaterThan(0);

    me.yardUse = 'lock';
    const locked = runEconomy(league, me, 0);
    expect(locked.yard).toBe(0);
    expect(locked.yardUse).toBe('lock');
    expect(yardTake({ ...me, yardUse: 'lock' }).take).toBe(0);
  });

  it('setYard writes the booking and rent out-earns lock', () => {
    const league = drafted();
    const me = league.teams[0];
    const r = applyAction(league, { t: 'setYard', teamId: me.id, use: 'rent' });
    expect(r.ok).toBe(true);
    expect(me.yardUse).toBe('rent');
    const rent = yardTake(me);
    const locked = yardTake({ ...me, yardUse: 'lock' });
    expect(rent.take).toBeGreaterThan(locked.take);
  });

  it('weekPair reports home vs away for the human club', () => {
    const league = drafted();
    const me = league.teams[0];
    const pr = weekPair(league, me.id);
    expect(pr).toBeTruthy();
    expect(pr!.home === me.id || pr!.away === me.id).toBe(true);
  });
});
