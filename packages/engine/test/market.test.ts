import { describe, expect, it } from 'vitest';
import {
  applyAction, createLeague, evalTrade, value, ROSTER_MAX,
  type HumanConfig, type League
} from '../src/index.js';

const HUMAN: HumanConfig = {
  name: 'Kestrel Comets', city: 'Kestrel', mascot: 'Comets',
  cls: 'BROKER', color: '#3BA7D6', glyph: 'comet', vibe: 'NIGHT'
};

function fresh(seed = 42): League {
  return createLeague(seed, HUMAN);
}

describe('draft', () => {
  it('rejects picks out of turn', () => {
    const league = fresh();
    // t0 is human; force AI to be on the clock first if needed
    const cur = league.draftOrder[league.draftIdx];
    const wrongTeam = league.teams.find((t) => t.id !== cur.teamId)!;
    const r = applyAction(league, { t: 'draftPick', teamId: wrongTeam.id, playerId: league.draftPool[0].id });
    expect(r.ok).toBe(false);
  });

  it('completes a full draft and starts the season', () => {
    const league = fresh();
    applyAction(league, { t: 'advanceDraft' });
    let guard = 0;
    while (league.phase === 'draft' && guard++ < 300) {
      const cur = league.draftOrder[league.draftIdx];
      if (!cur) break;
      const team = league.teams.find((t) => t.id === cur.teamId)!;
      if (team.isHuman) {
        applyAction(league, { t: 'draftPick', teamId: team.id, playerId: league.draftPool[0].id });
      } else {
        applyAction(league, { t: 'advanceDraft' });
      }
    }
    expect(league.phase).toBe('regular');
    expect(league.draftPool.length).toBe(0);
    league.teams.forEach((t) => {
      expect(t.roster.length).toBeGreaterThanOrEqual(15);
      expect(t.roster.length).toBeLessThanOrEqual(ROSTER_MAX);
    });
  });
});

describe('trades', () => {
  it('accepts an obviously lopsided gift and rejects robbery', () => {
    const league = fresh(7);
    const me = league.teams[0];
    const them = league.teams[1];
    const myBest = me.roster.slice().sort((a, b) => value(b) - value(a))[0];
    const theirBest = them.roster.slice().sort((a, b) => value(b) - value(a))[0];

    const gift = evalTrade(league, me, them, [myBest], []);
    expect(gift.accept).toBe(true);

    const robbery = evalTrade(league, me, them, [], [theirBest]);
    expect(robbery.accept).toBe(false);
  });

  it('moves players and spends an action point on execution', () => {
    const league = fresh(7);
    const me = league.teams[0];
    const them = league.teams[1];
    const myBest = me.roster.slice().sort((a, b) => value(b) - value(a))[0];
    const apBefore = me.ap;
    const r = applyAction(league, { t: 'trade', teamId: me.id, rivalId: them.id, give: [myBest.id], get: [] });
    expect(r.ok).toBe(true);
    expect(me.ap).toBe(apBefore - 1);
    expect(me.roster.some((p) => p.id === myBest.id)).toBe(false);
    expect(them.roster.some((p) => p.id === myBest.id)).toBe(true);
  });
});

describe('free agency', () => {
  it('signs a free agent for a bonus and refunds AP on failure', () => {
    const league = fresh(11);
    const me = league.teams[0];
    const fa = league.freeAgents[0];
    const cashBefore = me.cash;
    const r = applyAction(league, { t: 'signFA', teamId: me.id, playerId: fa.id });
    expect(r.ok).toBe(true);
    expect(me.cash).toBe(cashBefore - Math.round(fa.salary * 0.5));
    expect(me.roster.some((p) => p.id === fa.id)).toBe(true);

    const apBefore = me.ap;
    const r2 = applyAction(league, { t: 'signFA', teamId: me.id, playerId: fa.id }); // already signed
    expect(r2.ok).toBe(false);
    expect(me.ap).toBe(apBefore); // refunded
  });
});

describe('scouting', () => {
  it('resolves a file for one action point', () => {
    const league = fresh(13);
    const me = league.teams[0];
    const target = league.draftPool.find((p) => p.scouted < 1)!;
    const r = applyAction(league, { t: 'scout', teamId: me.id, playerId: target.id });
    expect(r.ok).toBe(true);
    expect(me.scoutFiles?.[target.id]).toBe(1);
    const r2 = applyAction(league, { t: 'scout', teamId: me.id, playerId: target.id });
    expect(r2.ok).toBe(false); // already known, no AP spent
  });
});

describe('stadium & sponsors', () => {
  it('upgrades cost cash and cap at max level', () => {
    const league = fresh(17);
    const me = league.teams[0];
    me.cash = 100000000;
    for (let i = 0; i < 3; i++) {
      const r = applyAction(league, { t: 'upgrade', teamId: me.id, key: 'food' });
      expect(r.ok).toBe(true);
    }
    const r = applyAction(league, { t: 'upgrade', teamId: me.id, key: 'food' });
    expect(r.ok).toBe(false);
    expect(me.stadium.food).toBe(3);
  });

  it('signs a sponsor offer rolled at league creation', () => {
    const league = fresh(19);
    const me = league.teams[0];
    expect(me.sponsorOffers.length).toBeGreaterThan(0);
    const offer = me.sponsorOffers[0];
    const r = applyAction(league, { t: 'signSponsor', teamId: me.id, name: offer.name });
    expect(r.ok).toBe(true);
    expect(me.sponsors.some((s) => s.name === offer.name)).toBe(true);
  });
});
