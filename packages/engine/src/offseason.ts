import { clamp, gauss, hashStr, mulberry32, RI, shuffle } from './rng.js';
import { ROSTER_MAX, ROSTER_MIN } from './data/positions.js';
import { SCENARIOS } from './data/scenarios.js';
import { aiEvalDraft } from './draft.js';
import { avg, era } from './format.js';
import { signFA } from './freeagency.js';
import { buildSchedule, idsOf } from './league.js';
import { blankHitStats, blankPitStats, genPlayer, isPitcher, salaryFor, value } from './player.js';
import type { DraftSlot, League, OffseasonReport, Player, Team } from './types.js';

export function rosterRoom(team: Team): number {
  return ROSTER_MAX - team.roster.length;
}

export function enforceRoster(league: League, team: Team, limit?: number): string[] {
  const cap = limit || ROSTER_MAX;
  const cut: string[] = [];
  while (team.roster.length > cap) {
    const worst = team.roster.slice().sort((a, b) => value(a) - value(b))[0];
    if (!worst) break;
    cut.push(worst.name);
    team.roster = team.roster.filter((x) => x.id !== worst.id);
    worst.teamId = null;
    league.freeAgents.push(worst);
  }
  return cut;
}

export function startOffseason(league: League): OffseasonReport {
  const rng = mulberry32(league.seed + league.season * 4409);
  const ids = idsOf(league);
  const report: OffseasonReport = { retired: [], expiring: [], season: league.season };

  league.teams.forEach((t) => {
    const keep: Player[] = [];
    t.roster.forEach((p) => {
      p.age++;
      p.years--;
      p.cond = 100;
      p.injured = 0;
      p.seasonLog = p.seasonLog || [];
      if (isPitcher(p)) {
        p.seasonLog.push({
          s: league.season, ip: +(p.pst.outs / 3).toFixed(1), k: p.pst.k,
          era: +era(p).toFixed(2), w: p.pst.w, l: p.pst.l, sv: p.pst.sv
        });
      } else {
        p.seasonLog.push({
          s: league.season, g: p.st.g, h: p.st.h, hr: p.st.hr,
          rbi: p.st.rbi, avg: +avg(p).toFixed(3), sb: p.st.sb
        });
      }
      if (p.seasonLog.length > 12) p.seasonLog.shift();
      // retirement
      const declining = p.age >= 35 && p.ovr < 58;
      if (p.age >= 40 || (declining && rng() < 0.55) || (p.age >= 37 && rng() < 0.3)) {
        report.retired.push({ teamId: t.id, name: p.name, age: p.age, ovr: p.ovr });
        return;
      }
      p.st = blankHitStats();
      p.pst = blankPitStats();
      p.salary = salaryFor(p);
      if (p.years <= 0) {
        report.expiring.push({
          teamId: t.id, id: p.id, name: p.name, ovr: p.ovr,
          ask: Math.round((p.salary * 1.15) / 5000) * 5000
        });
        p.expiring = true;
      }
      keep.push(p);
    });
    t.roster = keep;
    t.history.push({
      season: league.season, w: t.w, l: t.l, rank: t.rank, cash: t.cash,
      champ: !!(league.bracket && league.bracket.champId === t.id)
    });
    t.w = 0; t.l = 0; t.rf = 0; t.ra = 0; t.streak = 0; t.rotIdx = 0;
    t.sponsors = t.sponsors.filter((sp) => {
      sp.weeks -= league.weeks;
      return sp.weeks > 0;
    });
    t.attBonus = 0;
    t.devBonus = 0;
    t.fanTrust = clamp(t.fanTrust * 0.92 + 4, 5, 100);
    t.ap = t.apMax;
  });

  // free agents age out too
  league.freeAgents = league.freeAgents.filter((p) => {
    p.age++;
    p.years = RI(rng, 1, 3);
    p.st = blankHitStats();
    p.pst = blankPitStats();
    p.salary = salaryFor(p);
    return p.age < 38;
  });
  for (let i = 0; i < 14; i++) {
    league.freeAgents.push(
      genPlayer(rng, ids, {
        tier: gauss(rng, -0.4, 0.9),
        age: Math.round(clamp(gauss(rng, 29, 4), 23, 37)),
        scouted: 1
      })
    );
  }

  // new draft class, order = reverse standings
  league.season++;
  league.week = 0;
  league.results = [];
  league.log = [];
  league.bracket = null;
  league.draftRounds = 6;
  league.draftPool = [];
  for (let i = 0; i < 8 * league.draftRounds + 16; i++) {
    league.draftPool.push(
      genPlayer(rng, ids, {
        tier: gauss(rng, -0.35, 0.95),
        age: Math.round(clamp(gauss(rng, 22.5, 2.4), 18, 28)),
        scouted: 0
      })
    );
  }
  const worstFirst = league.teams
    .slice()
    .sort((a, b) => {
      const ha = a.history[a.history.length - 1];
      const hb = b.history[b.history.length - 1];
      return ha.w - ha.l - (hb.w - hb.l);
    })
    .map((t) => t.id);
  const order: DraftSlot[] = [];
  for (let r = 0; r < league.draftRounds; r++) {
    (r % 2 === 0 ? worstFirst : worstFirst.slice().reverse()).forEach((id) =>
      order.push({ round: r + 1, teamId: id })
    );
  }
  league.draftOrder = order;
  league.draftIdx = 0;
  league.schedule = buildSchedule(league, mulberry32(league.seed + league.season * 13));
  league.phase = 'draft';
  league.scenarioDeck = shuffle(rng, SCENARIOS.map((x) => x.id));
  league.scenarioIdx = 0;
  league.offseasonReport = report;
  return report;
}

export interface ResignResult {
  ok: boolean;
  err?: string;
  lost?: boolean;
  salary?: number;
}

export function resign(league: League, team: Team, playerId: string, offer: number): ResignResult {
  const p = team.roster.find((x) => x.id === playerId);
  if (!p || !p.expiring) return { ok: false, err: 'Not up for renewal' };
  const ask = Math.round((p.salary * 1.15) / 5000) * 5000;
  if (offer < ask * 0.9) {
    team.roster = team.roster.filter((x) => x.id !== playerId);
    p.expiring = false;
    p.teamId = null;
    league.freeAgents.push(p);
    return { ok: false, err: 'He turned it down and hit the market', lost: true };
  }
  p.salary = offer;
  p.years = RI(mulberry32(hashStr(p.id)), 2, 4);
  p.expiring = false;
  p.morale = clamp(p.morale + 6, 20, 100);
  return { ok: true, salary: offer };
}

export function aiOffseason(league: League): void {
  league.teams
    .filter((t) => !t.isHuman)
    .forEach((t) => {
      t.roster
        .filter((p) => p.expiring)
        .forEach((p) => {
          const ask = Math.round((p.salary * 1.15) / 5000) * 5000;
          if (t.cash > ask * 4 && p.ovr > 48) resign(league, t, p.id, ask);
          else resign(league, t, p.id, 0);
        });
      enforceRoster(league, t, ROSTER_MAX - 2);
      // fill holes from free agency
      let guard = 0;
      while (t.roster.length < ROSTER_MIN + 1 && league.freeAgents.length && guard++ < 12) {
        const best = league.freeAgents.slice().sort((a, b) => aiEvalDraft(t, b) - aiEvalDraft(t, a))[0];
        if (!best) break;
        const r = signFA(league, t, best.id);
        if (!r.ok) break;
      }
    });
}
