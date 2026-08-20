import { gauss, hashStr, mulberry32, pick, RI, shuffle, type Rng } from './rng.js';
import { sanitizeColor } from './format.js';
import { CITIES, GLYPHS, MASCOTS } from './data/names.js';
import { CLASSES, CLASS_LIST } from './data/classes.js';
import { GAMES_PER_WEEK, SEASON_WEEKS } from './data/positions.js';
import { SCENARIOS } from './data/scenarios.js';
import { TROPHIES } from './data/trophies.js';
import { genPlayer, type IdSource } from './player.js';
import { blankProgress, checkAchievements } from './progress.js';
import type { DraftSlot, HumanConfig, League, Position, SchedulePair, Team } from './types.js';

/** Id source backed by the league so generated ids survive save/reload. */
export function idsOf(league: League): IdSource {
  return {
    get next() { return league.pid; },
    set next(v: number) { league.pid = v; }
  };
}

/** Deterministic one-off roll keyed by an arbitrary string + league seed. */
export function leagueRoll(league: League, key: string | number): number {
  return mulberry32(hashStr(String(key) + league.seed))();
}

export function hueColor(h: number): string {
  return hslToHex(h, 68, 52);
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return '#' + to(f(0)) + to(f(8)) + to(f(4));
}

export function newTeam(
  _rng: Rng, city: string, mascot: string, cls: string, color: string,
  glyph: string, isHuman: boolean, vibe: string
): Team {
  const c = CLASSES[cls];
  return {
    id: '', slot: 0, city, mascot, name: city + ' ' + mascot,
    abbr: (city.replace(/[^A-Za-z]/g, '').slice(0, 2) + mascot.slice(0, 1)).toUpperCase(),
    cls, color: sanitizeColor(color), glyph, vibe: vibe || 'NIGHT', isHuman: !!isHuman, ownerId: isHuman ? 'local' : null,
    roster: [], cash: c.cash, startCash: c.cash, fanTrust: c.fanTrust,
    staff: { ...c.staff },
    stadium: { seats: 0, lights: 0, food: 0, board: 0, clubhouse: 0, academy: 0 },
    ticket: 18, conPrice: 12, yardUse: 'open',
    sponsors: [], sponsorOffers: [], trophies: [], picks: [],
    w: 0, l: 0, rf: 0, ra: 0, streak: 0, rank: 1,
    wk: { att: 0, rev: 0, cost: 0, net: 0 },
    history: [], strategy: { ...c.strategy },
    ap: 3, apMax: 3, seasonHigh: {}, devPool: 0, scoutFocus: null,
    progress: isHuman ? blankProgress() : undefined
  };
}

export function buildDraftOrder(league: League, rng: Rng): void {
  const order: DraftSlot[] = [];
  const base = shuffle(rng, league.teams.map((t) => t.id));
  for (let r = 0; r < league.draftRounds; r++) {
    const round = r % 2 === 0 ? base.slice() : base.slice().reverse();
    round.forEach((id) => order.push({ round: r + 1, teamId: id }));
  }
  league.teams.forEach((t) => {
    if (CLASSES[t.cls].mods.extraPick) {
      const i = order.findIndex((o) => o.round === 1);
      order.splice(Math.max(0, i + 3), 0, { round: 1, teamId: t.id, extra: true });
    }
  });
  league.draftOrder = order;
  league.draftIdx = 0;
}

export function buildSchedule(league: League, _rng: Rng): SchedulePair[][] {
  const ids = league.teams.map((t) => t.id);
  const weeks: SchedulePair[][] = [];
  for (let w = 0; w < league.weeks; w++) {
    const pool = shuffle(mulberry32(league.seed + w * 977), ids.slice());
    const pairs: SchedulePair[] = [];
    for (let i = 0; i < pool.length; i += 2) {
      const homeFirst = (w + i) % 2 === 0;
      pairs.push({
        home: homeFirst ? pool[i] : pool[i + 1],
        away: homeFirst ? pool[i + 1] : pool[i],
        games: league.gpw
      });
    }
    weeks.push(pairs);
  }
  return weeks;
}

/** This week's pairing for a club, or null if the season is over. */
export function weekPair(league: League, teamId: string, week = league.week): SchedulePair | null {
  if (week < 0 || week >= league.weeks) return null;
  return league.schedule[week]?.find((p) => p.home === teamId || p.away === teamId) || null;
}

export function rankTeams(league: League): Team[] {
  const sorted = league.teams.slice().sort((a, b) => {
    const pa = a.w + a.l ? a.w / (a.w + a.l) : 0;
    const pb = b.w + b.l ? b.w / (b.w + b.l) : 0;
    return pb - pa || (b.rf - b.ra) - (a.rf - a.ra);
  });
  sorted.forEach((t, i) => (t.rank = i + 1));
  return sorted;
}

export function award(team: Team, key: string, league: League): void {
  if (team.trophies.some((x) => x.key === key && x.season === league.season)) return;
  const spec = TROPHIES.find((t) => t.key === key);
  if (!spec) return;
  team.trophies.push({ key, season: league.season, week: league.week + 1 });
  league.log.push({ w: league.week + 1, t: team.id, trophy: key, txt: 'Trophy earned: ' + spec.name });
  if (team.isHuman) checkAchievements(team);
}

export function makeLeague(seed: number, human?: HumanConfig | null): League {
  const rng = mulberry32(seed);
  const league: League = {
    seed, week: 0, season: 1, phase: 'draft',
    weeks: SEASON_WEEKS, gpw: GAMES_PER_WEEK,
    teams: [], draftPool: [], draftOrder: [], draftIdx: 0, draftRounds: 12,
    freeAgents: [], schedule: [], log: [], results: [],
    scenarioDeck: shuffle(rng, SCENARIOS.map((s) => s.id)), scenarioIdx: 0,
    pid: 1
  };
  const ids = idsOf(league);

  const names = shuffle(rng, CITIES.slice());
  const mascots = shuffle(rng, MASCOTS.slice());
  const classes = shuffle(rng, CLASS_LIST.slice());

  for (let i = 0; i < 8; i++) {
    let t: Team;
    if (i === 0 && human) {
      t = newTeam(rng, human.city, human.mascot, human.cls, human.color, human.glyph, true, human.vibe);
      t.name = human.name;
    } else {
      const cls = classes[i % classes.length];
      t = newTeam(rng, names[i + 3], mascots[i + 3], cls, hueColor(RI(rng, 0, 359)), pick(rng, GLYPHS), false, 'NIGHT');
    }
    t.id = 't' + i;
    t.slot = i;
    league.teams.push(t);
  }

  // starting staff-players from class
  league.teams.forEach((t) => {
    const c = CLASSES[t.cls];
    const spec: Position[] = ['SP', 'SP', 'RP', 'C', 'SS', 'CF'];
    for (let i = 0; i < 6; i++) {
      const p = genPlayer(rng, ids, { pos: spec[i], tier: gauss(rng, 0.35, 0.6), bias: c.bias, scouted: 1, origin: 'class' });
      p.teamId = t.id;
      t.roster.push(p);
    }
  });

  // draft pool — Farmer (and any extraRounds class) runs two rounds deeper
  const extra = Math.max(0, ...league.teams.map((t) => (t.isHuman ? CLASSES[t.cls].mods.extraRounds || 0 : 0)));
  league.draftRounds = 12 + extra;
  const poolSize = 8 * league.draftRounds + 24;
  for (let i = 0; i < poolSize; i++) {
    const tier = gauss(rng, -0.15, 0.95);
    const p = genPlayer(rng, ids, { tier, age: Math.round(Math.min(34, Math.max(19, gauss(rng, 24.5, 3.6)))), scouted: 0 });
    p.trueOvr = p.ovr;
    league.draftPool.push(p);
  }
  // free agents
  for (let i = 0; i < 26; i++) {
    const p = genPlayer(rng, ids, {
      tier: gauss(rng, -0.5, 0.9),
      age: Math.round(Math.min(39, Math.max(24, gauss(rng, 30, 4)))),
      scouted: 0.15 + rng() * 0.55
    });
    league.freeAgents.push(p);
  }

  buildDraftOrder(league, rng);
  league.schedule = buildSchedule(league, rng);
  return league;
}
