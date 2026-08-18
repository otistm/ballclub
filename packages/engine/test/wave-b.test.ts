import { describe, expect, it } from 'vitest';
import {
  applyAction, createLeague, paOutcome, startOffseason,
  type HumanConfig, type League
} from '../src/index.js';
import { mulberry32 } from '../src/rng.js';

const HUMAN: HumanConfig = {
  name: 'Ashland Wolves', city: 'Ashland', mascot: 'Wolves',
  cls: 'FARMER', color: '#3BA7D6', glyph: 'ball', vibe: 'NIGHT'
};

function drafted(seed = 42, cls: string = 'FARMER'): League {
  const league = createLeague(seed, { ...HUMAN, cls });
  applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0'] });
  return league;
}

describe('Wave B', () => {
  it('Farmer year-1 draft runs two rounds deeper', () => {
    const farmer = createLeague(7, { ...HUMAN, cls: 'FARMER' });
    const showman = createLeague(7, { ...HUMAN, cls: 'SHOWMAN' });
    expect(farmer.draftRounds).toBe(showman.draftRounds + 2);
  });

  it('Farmer offseason draft adds extra rounds', () => {
    const league = drafted(9, 'FARMER');
    league.phase = 'offseason';
    league.week = league.weeks;
    league.teams.forEach((t) => {
      t.w = 20;
      t.l = 34;
    });
    startOffseason(league);
    expect(league.draftRounds).toBe(8); // 6 + Farmer's 2
  });

  it('human-to-human trade parks an inbox offer', () => {
    const league = drafted(12);
    const me = league.teams[0];
    const them = league.teams[1];
    them.isHuman = true;
    them.ownerId = 'friend';
    me.ap = 3;
    const give = me.roster[0];
    const get = them.roster[0];
    const r = applyAction(league, {
      t: 'trade', teamId: me.id, rivalId: them.id, give: [give.id], get: [get.id]
    });
    expect(r.ok).toBe(true);
    expect(them.inboxTrade).toBeTruthy();
    expect(them.inboxTrade!.fromId).toBe(me.id);
    expect(me.roster.some((p) => p.id === give.id)).toBe(true);
  });

  it('respondTrade accepts and swaps roster', () => {
    const league = drafted(13);
    const me = league.teams[0];
    const them = league.teams[1];
    them.isHuman = true;
    them.ownerId = 'friend';
    me.ap = 3;
    const give = me.roster[0];
    const get = them.roster[0];
    applyAction(league, {
      t: 'trade', teamId: me.id, rivalId: them.id, give: [give.id], get: [get.id]
    });
    const r = applyAction(league, { t: 'respondTrade', teamId: them.id, accept: true });
    expect(r.ok).toBe(true);
    expect(them.inboxTrade).toBeFalsy();
    expect(them.roster.some((p) => p.id === give.id)).toBe(true);
    expect(me.roster.some((p) => p.id === get.id)).toBe(true);
  });

  it('respondTrade reject clears the fax', () => {
    const league = drafted(14);
    const me = league.teams[0];
    const them = league.teams[1];
    them.isHuman = true;
    me.ap = 3;
    applyAction(league, {
      t: 'trade', teamId: me.id, rivalId: them.id,
      give: [me.roster[0].id], get: [them.roster[0].id]
    });
    expect(applyAction(league, { t: 'respondTrade', teamId: them.id, accept: false }).ok).toBe(true);
    expect(them.inboxTrade).toBeFalsy();
  });

  it('Grinder lowers K rate vs same batter without the trait', () => {
    const league = drafted(18);
    const bat = league.teams[0].roster.find((p) => p.pos !== 'SP' && p.pos !== 'RP')!;
    const pit = league.teams[0].roster.find((p) => p.pos === 'SP')!;
    const plain = { ...bat, traits: [] as string[], st: { ...bat.st }, pst: { ...bat.pst }, r: { ...bat.r } };
    const grind = { ...bat, traits: ['GRINDER'], st: { ...bat.st }, pst: { ...bat.pst }, r: { ...bat.r } };
    const arm = { ...pit, st: { ...pit.st }, pst: { ...pit.pst }, r: { ...pit.r, stuff: 72 } };
    const ctx = { inning: 3, latePen: 0, runners: false };
    const r1 = mulberry32(99);
    const r2 = mulberry32(99);
    let kPlain = 0, kGrind = 0;
    for (let i = 0; i < 500; i++) {
      if (paOutcome(plain, arm, 0, r1, ctx).k === 'K') kPlain++;
      if (paOutcome(grind, arm, 0, r2, ctx).k === 'K') kGrind++;
    }
    expect(kGrind).toBeLessThan(kPlain);
  });

  it('week action blocks while another human desk is open', () => {
    const league = drafted(21);
    league.teams[0].deskPending = false;
    league.teams[1].isHuman = true;
    league.teams[1].deskPending = true;
    league.phase = 'regular';
    const r = applyAction(league, { t: 'week' });
    expect(r.ok).toBe(false);
  });
});
