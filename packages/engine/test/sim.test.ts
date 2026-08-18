import { describe, expect, it } from 'vitest';
import {
  applyAction, createLeague, simGame, type HumanConfig, type League
} from '../src/index.js';

const HUMAN: HumanConfig = {
  name: 'Ashland Wolves', city: 'Ashland', mascot: 'Wolves',
  cls: 'OLD_LION', color: '#C4553A', glyph: 'lion', vibe: 'NIGHT'
};

function draftedLeague(seed = 99): League {
  const league = createLeague(seed, HUMAN);
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
  return league;
}

function playFullSeason(league: League): void {
  let guard = 0;
  while (league.phase === 'regular' && guard++ < 40) {
    applyAction(league, { t: 'scenario', teamId: 't0', side: 'left' });
    applyAction(league, { t: 'week' });
  }
}

describe('game sim', () => {
  it('produces a valid box score', () => {
    const league = draftedLeague();
    const res = simGame(league.teams[0], league.teams[1], 4242);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.homeRuns).not.toBe(res.awayRuns); // no ties in baseball
    expect(res.innings).toBeGreaterThanOrEqual(9);
    expect(res.pbp.length).toBeGreaterThan(30);
    expect(res.pbp.some((e) => e.t === 'half')).toBe(true);
    expect(res.pbp[0].away).toBe(0);
    expect(res.pbp[0].home).toBe(0);
    const last = res.pbp[res.pbp.length - 1];
    expect(last.away).toBeLessThanOrEqual(res.awayRuns);
    expect(last.home).toBeLessThanOrEqual(res.homeRuns);
    expect(res.homeRuns).toBeGreaterThanOrEqual(0);
    expect(res.awayRuns).toBeGreaterThanOrEqual(0);
  });

  it('plays a full season with a sane run environment', () => {
    const league = draftedLeague(2024);
    playFullSeason(league);
    expect(league.phase).toBe('playoffs');

    const games = league.weeks * league.gpw;
    let totalRuns = 0;
    let totalGames = 0;
    league.teams.forEach((t) => {
      // rain desk cards can wash out home games; schedule still advances
      expect(t.w + t.l).toBeLessThanOrEqual(games);
      expect(t.w + t.l).toBeGreaterThan(games * 0.65);
      totalRuns += t.rf;
      totalGames += t.w + t.l;
    });
    const runsPerTeamGame = totalRuns / totalGames;
    expect(runsPerTeamGame).toBeGreaterThan(2);
    expect(runsPerTeamGame).toBeLessThan(9);

    // wins across the league must balance losses
    const wins = league.teams.reduce((s, t) => s + t.w, 0);
    const losses = league.teams.reduce((s, t) => s + t.l, 0);
    expect(wins).toBe(losses);

    // nobody's cash went NaN
    league.teams.forEach((t) => {
      expect(Number.isFinite(t.cash)).toBe(true);
      expect(Number.isFinite(t.fanTrust)).toBe(true);
    });
  });

  it('runs playoffs and crowns a champion from the top four', () => {
    const league = draftedLeague(555);
    playFullSeason(league);
    const r = applyAction(league, { t: 'playoffs' });
    expect(r.ok).toBe(true);
    expect(league.phase).toBe('offseason');
    const champ = league.teams.find((t) => t.id === league.bracket!.champId);
    expect(champ).toBeDefined();
    expect(champ!.rank).toBeLessThanOrEqual(4);
  });

  it('rolls into a new season with unique player ids', () => {
    const league = draftedLeague(808);
    playFullSeason(league);
    applyAction(league, { t: 'playoffs' });
    const r = applyAction(league, { t: 'offseason' });
    expect(r.ok).toBe(true);
    expect(league.phase).toBe('draft');
    expect(league.season).toBe(2);

    const ids = new Set<string>();
    const all = [
      ...league.teams.flatMap((t) => t.roster),
      ...league.freeAgents,
      ...league.draftPool
    ];
    all.forEach((p) => {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
    });
  });
});
