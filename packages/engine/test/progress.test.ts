import { describe, expect, it } from 'vitest';
import {
  applyAction, createLeague, ensureProgress, grantXp, scoreHumanSeries, spendSkill, xpForLevel,
  type HumanConfig, type League, type PbpEvent
} from '../src/index.js';

const HUMAN: HumanConfig = {
  name: 'Kestrel Comets', city: 'Kestrel', mascot: 'Comets',
  cls: 'BROKER', color: '#3BA7D6', glyph: 'comet', vibe: 'NIGHT'
};

function fresh(seed = 21): League {
  return createLeague(seed, HUMAN);
}

function human(league: League) {
  return league.teams.find((t) => t.isHuman)!;
}

describe('GM progression', () => {
  it('hydrates a progress block on a human club', () => {
    const me = human(fresh());
    expect(me.progress).toBeTruthy();
    expect(me.progress!.level).toBe(1);
    expect(me.progress!.unspent).toBe(0);
  });

  it('levels up and banks a skill point when XP crosses the curve', () => {
    const me = human(fresh());
    const need = xpForLevel(1);
    grantXp(me, need, 'Test');
    expect(me.progress!.level).toBe(2);
    expect(me.progress!.unspent).toBe(1);
    expect(me.progress!.xp).toBe(0);
  });

  it('spends a skill point into scouting and refuses a second spend', () => {
    const league = fresh();
    const me = human(league);
    grantXp(me, xpForLevel(1), 'Test');
    const r = applyAction(league, { t: 'spendSkill', teamId: me.id, skill: 'scout' });
    expect(r.ok).toBe(true);
    expect(me.progress!.skills.scout).toBe(1);
    expect(me.progress!.unspent).toBe(0);
    const r2 = applyAction(league, { t: 'spendSkill', teamId: me.id, skill: 'press' });
    expect(r2.ok).toBe(false);
  });

  it('awards series XP and one-shot achievements from the box', () => {
    const me = human(fresh());
    const pbp: PbpEvent[] = [
      { t: 'pa', inn: 3, half: 1, k: 'HR', big: true, txt: 'Rook — HOME RUN', b: 'Rook' },
      { t: 'pa', inn: 7, half: 0, k: 'K', txt: 'Visitor strikes out' },
      { t: 'pa', inn: 7, half: 0, k: 'K', txt: 'Visitor strikes out' },
      { t: 'pa', inn: 7, half: 0, k: 'K', txt: 'Visitor strikes out' },
      { t: 'pa', inn: 7, half: 0, k: 'K', txt: 'Visitor strikes out' },
      { t: 'pa', inn: 7, half: 0, k: 'K', txt: 'Visitor strikes out' },
      { t: 'pa', inn: 7, half: 0, k: 'K', txt: 'Visitor strikes out' },
      { t: 'pa', inn: 7, half: 0, k: 'K', txt: 'Visitor strikes out' },
      { t: 'pa', inn: 7, half: 0, k: 'K', txt: 'Visitor strikes out' }
    ];
    scoreHumanSeries(me, {
      won: 3, lost: 0, games: 3, isHome: true,
      results: [
        { homeId: me.id, awayId: 't1', homeRuns: 4, awayRuns: 0, winnerId: me.id, innings: 9, walkoff: false, wp: 'Ace', lp: 'Them', line: { home: [], away: [] } },
        { homeId: me.id, awayId: 't1', homeRuns: 5, awayRuns: 1, winnerId: me.id, innings: 9, walkoff: false, wp: 'Ace', lp: 'Them', line: { home: [], away: [] } },
        { homeId: me.id, awayId: 't1', homeRuns: 3, awayRuns: 2, winnerId: me.id, innings: 9, walkoff: true, wp: 'Ace', lp: 'Them', line: { home: [], away: [] } }
      ],
      pbps: [{ homeId: me.id, awayId: 't1', homeRuns: 4, awayRuns: 0, pbp }]
    });
    const p = ensureProgress(me);
    expect(p.stats.wins).toBe(3);
    expect(p.stats.hrs).toBe(1);
    expect(p.stats.sweeps).toBe(1);
    expect(p.stats.walkoffs).toBe(1);
    expect(p.stats.shutouts).toBe(1);
    expect(p.stats.kGames).toBe(1);
    expect(p.achievements).toContain('FIRST_WIN');
    expect(p.achievements).toContain('DINGER');
    expect(p.achievements).toContain('FIRST_SWEEP');
    expect(p.achievements).toContain('WALKOFF');
    expect(p.weekXp).toBeGreaterThan(80);
    const before = p.achievements.length;
    scoreHumanSeries(me, {
      won: 1, lost: 0, games: 1, isHome: true,
      results: [{ homeId: me.id, awayId: 't1', homeRuns: 2, awayRuns: 1, winnerId: me.id, innings: 9, walkoff: false, wp: 'Ace', lp: 'Them', line: { home: [], away: [] } }],
      pbps: []
    });
    expect(me.progress!.achievements.filter((id) => id === 'FIRST_WIN').length).toBe(1);
    expect(me.progress!.achievements.length).toBeGreaterThanOrEqual(before);
  });

  it('pays XP for a finished scout file', () => {
    const league = fresh(13);
    const me = human(league);
    const target = league.draftPool.find((p) => p.scouted < 1)!;
    const xp0 = me.progress!.xp;
    const r = applyAction(league, { t: 'scout', teamId: me.id, playerId: target.id });
    expect(r.ok).toBe(true);
    expect(me.progress!.stats.scouts).toBe(1);
    expect(me.progress!.achievements).toContain('SCOUT_ONE');
    expect(me.progress!.xp + (me.progress!.level - 1) * 0).toBeGreaterThanOrEqual(xp0);
    expect(me.progress!.weekXp).toBeGreaterThan(0);
  });

  it('ops rank 6 raises the weekly action cap', () => {
    const me = human(fresh());
    me.progress!.unspent = 6;
    for (let i = 0; i < 6; i++) {
      const r = spendSkill(me, 'ops');
      expect(r.ok).toBe(true);
    }
    expect(me.apMax).toBe(4);
  });
});
