import { describe, expect, it } from 'vitest';
import {
  applyAction, buildLineup, createLeague, fieldingZ, paOutcome, staffHireCost,
  type HumanConfig, type League
} from '../src/index.js';
import { mulberry32 } from '../src/rng.js';

const HUMAN: HumanConfig = {
  name: 'Ashland Wolves', city: 'Ashland', mascot: 'Wolves',
  cls: 'ANALYST', color: '#3BA7D6', glyph: 'compass', vibe: 'NIGHT'
};

function drafted(seed = 42, cls: string = 'ANALYST'): League {
  const league = createLeague(seed, { ...HUMAN, cls });
  applyAction(league, { t: 'advanceIdle', idleTeamIds: ['t0'] });
  return league;
}

describe('Wave C', () => {
  it('locks in-contract salary and applies arb raise', () => {
    const league = drafted(3);
    const t = league.teams[0];
    const p = t.roster[0];
    p.years = 2;
    p.expiring = false;
    p.salary = 200000;
    p.ovr = 70;
    league.phase = 'offseason';
    league.week = league.weeks;
    applyAction(league, { t: 'offseason' });
    // years decremented once in startOffseason; still under contract
    const kept = t.roster.find((x) => x.id === p.id);
    expect(kept).toBeTruthy();
    expect(kept!.years).toBe(1);
    expect(kept!.expiring).toBeFalsy();
    expect(kept!.salary).toBeGreaterThanOrEqual(200000);
  });

  it('resign accepts a chosen term of years', () => {
    const league = drafted(4);
    const t = league.teams[0];
    const p = t.roster[0];
    p.expiring = true;
    p.years = 0;
    p.salary = 150000;
    const ask = Math.round((p.salary * 1.15) / 5000) * 5000;
    const r = applyAction(league, { t: 'resign', teamId: t.id, playerId: p.id, offer: ask, years: 4 });
    expect(r.ok).toBe(true);
    expect(p.years).toBe(4);
    expect(p.expiring).toBeFalsy();
  });

  it('hireStaff bumps a department for cash', () => {
    const league = drafted(5);
    const t = league.teams[0];
    t.cash = 5_000_000;
    const from = t.staff.scout;
    const cost = staffHireCost(t, 'scout');
    const r = applyAction(league, { t: 'hireStaff', teamId: t.id, role: 'scout' });
    expect(r.ok).toBe(true);
    expect(t.staff.scout).toBe(from + 4);
    expect(t.cash).toBe(5_000_000 - cost);
  });

  it('desk weekBoost parks next-series overlays', () => {
    const league = drafted(6);
    const t = league.teams[0];
    t.deskPending = true;
    league.scenarioDeck = ['sc_greenlight', ...league.scenarioDeck.filter((id) => id !== 'sc_greenlight')];
    league.scenarioIdx = 0;
    applyAction(league, { t: 'scenario', teamId: t.id, side: 'right' });
    expect(t.weekBoost).toBeTruthy();
    expect((t.weekBoost!.aggression || 0)).toBeGreaterThan(0);
  });

  it('fieldingZ prefers true position fit over batting-order labels', () => {
    const league = drafted(8);
    const t = league.teams[0];
    const L = buildLineup(t);
    expect(Number.isFinite(L.defZ)).toBe(true);
    expect(fieldingZ(L.lineup)).toBeCloseTo(L.defZ, 5);
  });

  it('handedness changes K rate same-side vs opposite', () => {
    const league = drafted(10);
    const bat = league.teams[0].roster.find((p) => p.pos !== 'SP' && p.pos !== 'RP')!;
    const pit = league.teams[0].roster.find((p) => p.pos === 'SP')!;
    bat.bats = 'L';
    const same = { ...pit, throws: 'L' as const, r: { ...pit.r, stuff: 70 }, st: { ...pit.st }, pst: { ...pit.pst } };
    const opp = { ...pit, throws: 'R' as const, r: { ...pit.r, stuff: 70 }, st: { ...pit.st }, pst: { ...pit.pst } };
    const lefty = { ...bat, traits: [] as string[], st: { ...bat.st }, pst: { ...bat.pst }, r: { ...bat.r } };
    const ctx = { inning: 3, latePen: 0, runners: false };
    const r1 = mulberry32(41);
    const r2 = mulberry32(41);
    let kSame = 0, kOpp = 0;
    for (let i = 0; i < 500; i++) {
      if (paOutcome(lefty, same, 0, r1, ctx).k === 'K') kSame++;
      if (paOutcome(lefty, opp, 0, r2, ctx).k === 'K') kOpp++;
    }
    expect(kSame).toBeGreaterThan(kOpp);
  });

  it('claimTeam refreshes staff from the new class', () => {
    const league = drafted(11, 'SHOWMAN');
    const seat = league.teams.find((t) => !t.isHuman)!;
    const before = seat.staff.scout;
    applyAction(league, {
      t: 'claimTeam',
      teamId: seat.id,
      ownerId: 'friend',
      human: { ...HUMAN, cls: 'ANALYST', name: 'Bay City', city: 'Bay City', mascot: 'Bay' }
    });
    expect(seat.cls).toBe('ANALYST');
    expect(seat.staff.scout).not.toBe(before);
    expect(seat.staff.analyst).toBeGreaterThan(70);
  });
});
