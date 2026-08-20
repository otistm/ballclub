import { describe, expect, it } from 'vitest';
import {
  applyAction, autoAssignField, canStaffField, CLASSES, createLeague, fieldComplete,
  orgFired, sellLocked, type HumanConfig, type League
} from '../src/index.js';

const HUMAN: HumanConfig = {
  name: 'Ashland Wolves', city: 'Ashland', mascot: 'Wolves',
  cls: 'ANALYST', color: '#3BA7D6', glyph: 'anvil', vibe: 'NIGHT'
};

function drafted(seed = 9): League {
  const league = createLeague(seed, HUMAN);
  applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0'] });
  return league;
}

describe('ownership dismissal', () => {
  it('does not fire a club that can still buy the missing bodies', () => {
    const league = drafted();
    const me = league.teams[0];
    me.roster = [];
    me.cash = 8_000_000;
    expect(canStaffField(league, me)).toBe(true);
    expect(orgFired(league, me)).toBe(false);
  });

  it('fires a club that sold the roster and cannot afford replacements', () => {
    const league = drafted();
    const me = league.teams[0];
    me.roster = [];
    me.cash = 0;
    expect(orgFired(league, me)).toBe(true);
  });

  it('bargain starts a new season, shortens the cash, and freezes sales', () => {
    const league = drafted();
    const me = league.teams[0];
    me.roster = [];
    me.cash = 0;
    const r = applyAction(league, { t: 'secondChance', teamId: me.id });
    expect(r.ok).toBe(true);
    expect(league.season).toBeGreaterThan(1);
    expect(me.cash).toBe(Math.round(CLASSES.ANALYST.cash * 0.42));
    expect(sellLocked(league, me)).toBe(true);
    me.fieldIds = autoAssignField(me);
    expect(fieldComplete(me)).toBe(true);
    const id = me.roster[0].id;
    const cut = applyAction(league, { t: 'release', teamId: me.id, playerId: id });
    expect(cut.ok).toBe(false);
    expect(me.roster.some((p) => p.id === id)).toBe(true);
  });

  it('an angry exit makes the next room start thinner', () => {
    const cold = createLeague(4, { ...HUMAN, skeptical: true });
    const warm = createLeague(4, HUMAN);
    expect(cold.teams[0].cash).toBeLessThan(warm.teams[0].cash);
    expect(cold.teams[0].fanTrust).toBeLessThan(warm.teams[0].fanTrust);
    expect(cold.teams[0].boardMood).toBe('skeptical');
  });
});
