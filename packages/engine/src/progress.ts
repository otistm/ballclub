import { ACHIEVEMENTS } from './data/achievements.js';
import { clamp } from './rng.js';
import type {
  GameSummary, MyPbp, PbpEvent, ProgressStats, SkillKey, Team, TeamProgress, WeekXpNote
} from './types.js';

export const SKILLS: readonly SkillKey[] = ['scout', 'press', 'deals', 'farm', 'ops'];

export const SKILL_INFO: Record<SkillKey, { name: string; tag: string; blurb: string }> = {
  scout: {
    name: 'The eye',
    tag: 'SCOUTING',
    blurb: 'Files close faster and the fog lifts. You see the kid nobody else does.'
  },
  press: {
    name: 'Press box',
    tag: 'PRESS',
    blurb: 'The desk goes your way. Trust holds. Sponsors pick up the phone.'
  },
  deals: {
    name: 'The closer',
    tag: 'DEALS',
    blurb: 'Trades land. Free agents cost less to bring through the door.'
  },
  farm: {
    name: 'The garden',
    tag: 'FARM',
    blurb: 'Kids grow. The academy actually means something.'
  },
  ops: {
    name: 'The house',
    tag: 'OPS',
    blurb: 'The gate pays. High ranks buy you another move each week.'
  }
};

const SKILL_MAX = 10;

export function blankStats(): ProgressStats {
  return {
    wins: 0, sweeps: 0, walkoffs: 0, hrs: 0, grands: 0, triples: 0, steals: 0,
    kGames: 0, shutouts: 0, blowouts: 0, scouts: 0, desks: 0, drafts: 0,
    trades: 0, signs: 0, builds: 0, sponsors: 0
  };
}

export function blankProgress(): TeamProgress {
  return {
    xp: 0,
    level: 1,
    unspent: 0,
    skills: { scout: 0, press: 0, deals: 0, farm: 0, ops: 0 },
    achievements: [],
    stats: blankStats(),
    weekXp: 0,
    weekNotes: [],
    lastUnlocks: []
  };
}

/** Hydrate older saves that never had a progress block. */
export function ensureProgress(team: Team): TeamProgress {
  if (!team.progress) team.progress = blankProgress();
  const p = team.progress;
  if (!p.skills) p.skills = { scout: 0, press: 0, deals: 0, farm: 0, ops: 0 };
  if (!p.stats) p.stats = blankStats();
  if (!p.achievements) p.achievements = [];
  if (!p.weekNotes) p.weekNotes = [];
  if (!p.lastUnlocks) p.lastUnlocks = [];
  if (p.level == null || p.level < 1) p.level = 1;
  if (p.xp == null) p.xp = 0;
  if (p.unspent == null) p.unspent = 0;
  if (p.weekXp == null) p.weekXp = 0;
  SKILLS.forEach((k) => {
    if (p.skills[k] == null) p.skills[k] = 0;
  });
  const st = blankStats();
  (Object.keys(st) as (keyof ProgressStats)[]).forEach((k) => {
    if (p.stats[k] == null) p.stats[k] = 0;
  });
  return p;
}

export function xpForLevel(level: number): number {
  return 80 + Math.max(1, level) * 45;
}

export function skillRank(team: Team | null | undefined, skill: SkillKey): number {
  if (!team || !team.progress) return 0;
  return clamp(team.progress.skills[skill] || 0, 0, SKILL_MAX);
}

export function scoutFogMul(team?: Team | null): number {
  return clamp(1 - skillRank(team, 'scout') * 0.07, 0.3, 1);
}

export function scoutTickMul(team: Team): number {
  return 1 + skillRank(team, 'scout') * 0.09;
}

/** Multiplier on favorable press / desk / trust outcomes. */
export function pressMul(team: Team): number {
  return 1 + skillRank(team, 'press') * 0.07;
}

/** Multiplier on unfavorable desk outcomes (lower is kinder). */
export function pressShield(team: Team): number {
  return clamp(1 - skillRank(team, 'press') * 0.055, 0.45, 1);
}

export function dealsMul(team: Team): number {
  return 1 + skillRank(team, 'deals') * 0.06;
}

export function faBonusMul(team: Team): number {
  return clamp(1 - skillRank(team, 'deals') * 0.035, 0.68, 1);
}

export function farmMul(team: Team): number {
  return 1 + skillRank(team, 'farm') * 0.07;
}

export function opsRevMul(team: Team): number {
  return 1 + skillRank(team, 'ops') * 0.04;
}

export function sponsorOfferMul(team: Team): number {
  return 1 + skillRank(team, 'press') * 0.04 + skillRank(team, 'ops') * 0.03;
}

export function opsApBonus(team: Team): number {
  const r = skillRank(team, 'ops');
  return r >= 10 ? 2 : r >= 6 ? 1 : 0;
}

export function applyOpsAp(team: Team): void {
  const next = 3 + opsApBonus(team);
  const gained = next - team.apMax;
  team.apMax = next;
  if (gained > 0) team.ap = Math.min(team.apMax, team.ap + gained);
  if (team.ap > team.apMax) team.ap = team.apMax;
}

function noteXp(p: TeamProgress, why: string, n: number): void {
  const existing = p.weekNotes.find((x) => x.why === why);
  if (existing) existing.n += n;
  else p.weekNotes.push({ why, n });
  if (p.weekNotes.length > 14) p.weekNotes.splice(0, p.weekNotes.length - 14);
}

function addXpOnly(team: Team, n: number, why: string): void {
  if (!team.isHuman || n <= 0) return;
  const p = ensureProgress(team);
  const add = Math.round(n);
  p.xp += add;
  p.weekXp += add;
  noteXp(p, why, add);
  let guard = 0;
  while (p.xp >= xpForLevel(p.level) && guard++ < 24) {
    p.xp -= xpForLevel(p.level);
    p.level += 1;
    p.unspent += 1;
    p.lastUnlocks.push('LEVEL ' + p.level);
  }
}

export function grantXp(team: Team, n: number, why: string): void {
  addXpOnly(team, n, why);
  checkAchievements(team);
}

export function checkAchievements(team: Team): void {
  if (!team.isHuman) return;
  ensureProgress(team);
  let gained = true;
  let guard = 0;
  while (gained && guard++ < 16) {
    gained = false;
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const spec = ACHIEVEMENTS[i];
      const p = team.progress!;
      if (p.achievements.indexOf(spec.id) >= 0) continue;
      if (!spec.when(team)) continue;
      p.achievements.push(spec.id);
      p.lastUnlocks.push(spec.id);
      if (spec.xp) addXpOnly(team, spec.xp, spec.name);
      gained = true;
    }
  }
}

export function resetWeekXp(team: Team): void {
  if (!team.isHuman) return;
  const p = ensureProgress(team);
  p.weekXp = 0;
  p.weekNotes = [];
}

export function consumeUnlocks(team: Team): string[] {
  const p = ensureProgress(team);
  const u = p.lastUnlocks.slice();
  p.lastUnlocks = [];
  return u;
}

export function spendSkill(team: Team, skill: SkillKey): { ok: boolean; err?: string } {
  if (SKILLS.indexOf(skill) < 0) return { ok: false, err: 'No such desk' };
  const p = ensureProgress(team);
  if (p.unspent < 1) return { ok: false, err: 'No points to spend' };
  if ((p.skills[skill] || 0) >= SKILL_MAX) return { ok: false, err: 'That desk is maxed' };
  p.unspent -= 1;
  p.skills[skill] = (p.skills[skill] || 0) + 1;
  applyOpsAp(team);
  checkAchievements(team);
  return { ok: true };
}

export function bumpStat(team: Team, key: keyof ProgressStats, n = 1): void {
  if (!team.isHuman || n <= 0) return;
  ensureProgress(team).stats[key] += n;
}

function ourHalf(isHome: boolean, half: number): boolean {
  return isHome ? half === 1 : half === 0;
}

function tallyPbp(team: Team, isHome: boolean, ev: PbpEvent[], ourRuns: number, theirRuns: number): void {
  const p = ensureProgress(team);
  let k = 0;
  ev.forEach((e) => {
    const ours = ourHalf(isHome, e.half);
    if (e.k === 'HR' && ours) {
      p.stats.hrs += 1;
      grantXp(team, 8, 'Home runs');
      if ((e.txt || '').indexOf('GRAND SLAM') >= 0) {
        p.stats.grands += 1;
        grantXp(team, 18, 'Grand slam');
      }
    }
    if (e.k === '3B' && ours) {
      p.stats.triples += 1;
      grantXp(team, 10, 'Triples');
    }
    if (e.t === 'sb' && ours) {
      p.stats.steals += 1;
      grantXp(team, 4, 'Steals');
    }
    if (e.k === 'K' && !ours) k += 1;
  });
  if (k >= 8) {
    p.stats.kGames += 1;
    grantXp(team, 15, 'Punchouts');
  }
  if (theirRuns === 0) {
    p.stats.shutouts += 1;
    grantXp(team, 22, 'Shutout');
  }
  if (ourRuns >= 10) {
    p.stats.blowouts += 1;
    grantXp(team, 16, 'Crooked number');
  }
}

export function scoreHumanSeries(
  team: Team,
  opts: {
    won: number;
    lost: number;
    games: number;
    isHome: boolean;
    results: GameSummary[];
    pbps: MyPbp[];
  }
): void {
  if (!team.isHuman) return;
  ensureProgress(team);
  if (opts.won) {
    bumpStat(team, 'wins', opts.won);
    grantXp(team, opts.won * 18, 'Wins');
  }
  if (opts.lost) grantXp(team, opts.lost * 4, 'Showed up');
  if (opts.won === opts.games && opts.games >= 2) {
    bumpStat(team, 'sweeps', 1);
    grantXp(team, 25, 'Sweep');
  }
  opts.results.forEach((gm) => {
    if (gm.walkoff && gm.winnerId === team.id) {
      bumpStat(team, 'walkoffs', 1);
      grantXp(team, 20, 'Walk-off');
    }
  });
  opts.pbps.forEach((mp) => {
    const our = opts.isHome ? mp.homeRuns : mp.awayRuns;
    const their = opts.isHome ? mp.awayRuns : mp.homeRuns;
    tallyPbp(team, opts.isHome, mp.pbp || [], our, their);
  });
  checkAchievements(team);
}

export function scorePlayoffSeries(team: Team, won: number, lost: number): void {
  if (!team.isHuman) return;
  if (won) {
    bumpStat(team, 'wins', won);
    grantXp(team, won * 22, 'October');
  }
  if (won > lost) grantXp(team, 40, 'Series won');
  if (lost === 0 && won >= 2) {
    bumpStat(team, 'sweeps', 1);
    grantXp(team, 30, 'October sweep');
  }
  checkAchievements(team);
}

export function noteOffice(
  team: Team,
  kind: 'scouts' | 'desks' | 'drafts' | 'trades' | 'signs' | 'builds' | 'sponsors',
  xp: number,
  why: string
): void {
  if (!team.isHuman) return;
  bumpStat(team, kind, 1);
  grantXp(team, xp, why);
}

export function weekNotesOf(team: Team): WeekXpNote[] {
  return team.progress?.weekNotes ? team.progress.weekNotes.slice() : [];
}
