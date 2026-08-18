import { hashStr } from './rng.js';
import { award, rankTeams } from './league.js';
import { scorePlayoffSeries } from './progress.js';
import { simGame } from './sim.js';
import { era } from './format.js';
import type { Bracket, League, SeriesResult, Team } from './types.js';

export function runPlayoffs(league: League): Bracket {
  const seeds = rankTeams(league).slice(0, 4);
  const bracket: Bracket = { semis: [], final: null, champId: null };

  function series(a: Team, b: Team, len: number, tag: string): SeriesResult & { winner: Team } {
    let aw = 0;
    let bw = 0;
    let g = 0;
    while (aw < Math.ceil(len / 2) && bw < Math.ceil(len / 2)) {
      const home = g % 2 === 0 ? a : b;
      const away = home === a ? b : a;
      const res = simGame(home, away, league.seed + 5000 + g * 31 + hashStr(tag));
      if (!res.ok) break;
      const win = res.homeRuns > res.awayRuns ? home : away;
      if (win === a) aw++;
      else bw++;
      g++;
      if (g > 9) break;
    }
    const winner = aw > bw ? a : b;
    if (a.isHuman) scorePlayoffSeries(a, aw, bw);
    if (b.isHuman) scorePlayoffSeries(b, bw, aw);
    return { aId: a.id, bId: b.id, aw, bw, winnerId: winner.id, winner };
  }

  const s1 = series(seeds[0], seeds[3], 3, 's1');
  const s2 = series(seeds[1], seeds[2], 3, 's2');
  bracket.semis = [
    { aId: s1.aId, bId: s1.bId, aw: s1.aw, bw: s1.bw, winnerId: s1.winnerId },
    { aId: s2.aId, bId: s2.bId, aw: s2.aw, bw: s2.bw, winnerId: s2.winnerId }
  ];
  const f = series(s1.winner, s2.winner, 5, 'final');
  bracket.final = { aId: f.aId, bId: f.bId, aw: f.aw, bw: f.bw, winnerId: f.winnerId };
  bracket.champId = f.winnerId;

  award(seeds[0], 'PENNANT', league);
  award(f.winner, 'TITLE', league);
  if (seeds[3] && f.winner.id === seeds[3].id) award(seeds[3], 'WILDCARD', league);
  league.teams.forEach((t) => {
    if (t.cash > t.startCash) award(t, 'BLACKINK', league);
    t.roster.forEach((p) => {
      if (p.st.hr >= 20) award(t, 'SLUGGER', league);
      const ip = p.pst.outs / 3;
      if (p.pos === 'SP' && ip >= 40 && era(p) < 2.75) award(t, 'ACE', league);
    });
    if (Object.keys(t.stadium).some((k) => t.stadium[k as keyof typeof t.stadium] >= 3)) award(t, 'CATHEDRAL', league);
  });
  league.phase = 'offseason';
  league.bracket = bracket;
  return bracket;
}
