import { clamp, hashStr, mulberry32, RI } from './rng.js';
import { CLASSES } from './data/classes.js';
import { developRoster } from './development.js';
import { runEconomy, stadiumVal } from './economy.js';
import { award, leagueRoll, rankTeams } from './league.js';
import { has } from './player.js';
import { applyOpsAp, resetWeekXp, scoreHumanSeries, scoutTickMul } from './progress.js';
import { simGame } from './sim.js';
import type { League, MyPbp, Team, WeekOutcome } from './types.js';

export function playWeek(league: League): WeekOutcome | { done: true } {
  if (league.week >= league.weeks) return { done: true };
  const pairs = league.schedule[league.week];
  const out: WeekOutcome = { week: league.week + 1, games: [], series: [] };
  league.myPbp = [];
  const teamById = (id: string): Team => league.teams.find((t) => t.id === id)!;
  league.teams.forEach((t) => {
    resetWeekXp(t);
    // desk weekBoost cond hits the clubhouse before first pitch
    if (t.weekBoost && t.weekBoost.cond) {
      t.roster.forEach((p) => {
        p.cond = clamp(p.cond + (t.weekBoost!.cond || 0), 0, 100);
      });
    }
  });

  pairs.forEach((pr, pi) => {
    const home = teamById(pr.home);
    const away = teamById(pr.away);
    let hw = 0;
    let aw = 0;
    let gamesPlayed = 0;
    for (let g = 0; g < pr.games; g++) {
      const seed = league.seed + league.week * 7919 + pi * 131 + g * 17;
      // desk rain risk can wash out a home game
      if (home.rainRisk && home.rainRisk > 0) {
        const wash = mulberry32(seed + 3)() < home.rainRisk;
        home.rainRisk = Math.max(0, home.rainRisk - 0.12);
        if (wash) {
          league.log.push({
            w: league.week + 1, t: home.id,
            txt: 'Rain washes out ' + home.abbr + ' vs ' + away.abbr + ' (game ' + (g + 1) + ')'
          });
          continue;
        }
      }
      const res = simGame(home, away, seed);
      if (!res.ok) continue;
      gamesPlayed++;
      if (res.homeRuns > res.awayRuns) {
        hw++;
        home.w++;
        away.l++;
        home.streak = Math.max(1, home.streak + 1);
        away.streak = Math.min(-1, away.streak - 1);
      } else {
        aw++;
        away.w++;
        home.l++;
        away.streak = Math.max(1, away.streak + 1);
        home.streak = Math.min(-1, home.streak - 1);
      }
      home.rf += res.homeRuns;
      home.ra += res.awayRuns;
      away.rf += res.awayRuns;
      away.ra += res.homeRuns;
      out.games.push({
        homeId: res.homeId, awayId: res.awayId, homeRuns: res.homeRuns, awayRuns: res.awayRuns,
        winnerId: res.winnerId, innings: res.innings, walkoff: res.walkoff, wp: res.wp, lp: res.lp, line: res.line
      });
      if (home.isHuman || away.isHuman) {
        const mp: MyPbp = { homeId: res.homeId, awayId: res.awayId, homeRuns: res.homeRuns, awayRuns: res.awayRuns, pbp: res.pbp };
        league.myPbp!.push(mp);
      }
    }
    out.series.push({ homeId: home.id, awayId: away.id, hw, aw });
    // sweeps (only if a full series was played)
    if (gamesPlayed === pr.games && hw === pr.games) award(home, 'SWEEP', league);
    if (gamesPlayed === pr.games && aw === pr.games) award(away, 'SWEEP', league);
    if (home.isHuman || away.isHuman) {
      if (gamesPlayed > 0) {
        const results = out.games.slice(-gamesPlayed);
        const pbps = (league.myPbp || []).filter((m) => m.homeId === home.id && m.awayId === away.id);
        if (home.isHuman) scoreHumanSeries(home, { won: hw, lost: aw, games: gamesPlayed, isHome: true, results, pbps });
        if (away.isHuman) scoreHumanSeries(away, { won: aw, lost: hw, games: gamesPlayed, isHome: false, results, pbps });
      }
    }
  });

  // recovery + economy
  league.teams.forEach((t) => {
    const homeGames = pairs.filter((p) => p.home === t.id).reduce((s, p) => s + p.games, 0);
    const rec = stadiumVal(t, 'clubhouse', 'rec', 1.0);
    t.roster.forEach((p) => {
      const rubber = has(p, 'RUBBER') ? 1.45 : 1;
      p.cond = clamp(p.cond + 30 * rec * rubber, 0, 100);
      if (p.injured > 0) p.injured--;
      // injury chance
      const risk = (0.012 * (has(p, 'GLASS') ? 2.2 : 1) * (1 + (100 - p.cond) / 90)) / rec;
      if (p.injured <= 0 && leagueRoll(league, p.id + league.week) < risk) {
        p.injured = RI(mulberry32(hashStr(p.id + league.week)), 1, 4);
        league.log.push({ w: league.week + 1, t: t.id, txt: t.abbr + ' · ' + p.name + ' is out ' + p.injured + ' week' + (p.injured > 1 ? 's' : '') });
      }
      // morale drift
      const wp = t.w + t.l ? t.w / (t.w + t.l) : 0.5;
      const hotheads = t.roster.filter((x) => has(x, 'HOTHEAD')).length;
      let d = (wp - 0.5) * 1.6 + stadiumVal(t, 'clubhouse', 'mor', 0) * 0.12 + (62 - p.morale) * 0.07;
      if (CLASSES[t.cls].key === 'OLD_LION' && p.age >= 31) d = Math.max(d, 0.4);
      if (hotheads && !has(p, 'HOTHEAD')) d -= hotheads * 0.85;
      if (CLASSES[t.cls].key === 'OLD_LION' && p.age >= 31 && d < 0) d = 0;
      p.morale = clamp(p.morale + d, 20, 100);
    });
    const w = runEconomy(league, t, homeGames || 0);
    if (w.sellout) award(t, 'SELLOUT', league);
    // scouting progress
    const sp = (t.staff.scout / 100) * (CLASSES[t.cls].mods.scoutSpeed || 1) * scoutTickMul(t);
    const src = league.draftPool.length ? league.draftPool : league.freeAgents;
    const targets = t.scoutFocus ? src.filter((p) => p.pos === t.scoutFocus) : src;
    targets.slice(0, 26).forEach((p) => {
      p.scouted = clamp(p.scouted + 0.05 * sp, 0, 1);
    });
    // development
    developRoster(league, t);
    applyOpsAp(t);
    t.ap = t.apMax;
    t.weekBoost = null;
  });

  rankTeams(league);
  league.teams.forEach((t) => {
    if (t.fanTrust >= 90) award(t, 'TRUSTED', league);
  });
  league.results.push(out);
  league.week++;
  if (league.week >= league.weeks) league.phase = 'playoffs';
  return out;
}
