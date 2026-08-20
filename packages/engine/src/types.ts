/** Shared engine types. The League object is plain JSON-serializable data. */

export type Position = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH' | 'SP' | 'RP';
export type Bats = 'L' | 'R' | 'S';
export type Throws = 'L' | 'R';
export type Phase = 'draft' | 'regular' | 'playoffs' | 'offseason';

export type RatingKey = 'con' | 'pow' | 'eye' | 'spd' | 'fld' | 'arm' | 'stuff' | 'ctl' | 'mov' | 'stam';
export type Ratings = Record<RatingKey, number>;

export interface HitStats {
  g: number; pa: number; ab: number; h: number; d: number; t: number; hr: number;
  bb: number; k: number; r: number; rbi: number; sb: number; cs: number;
}

export interface PitStats {
  g: number; gs: number; outs: number; h: number; hr: number; er: number;
  bb: number; k: number; w: number; l: number; sv: number; bf: number;
}

export interface SeasonLogHit {
  s: number; g: number; h: number; hr: number; rbi: number; avg: number; sb: number;
}
export interface SeasonLogPit {
  s: number; ip: number; k: number; era: number; w: number; l: number; sv: number;
}
export type SeasonLogEntry = SeasonLogHit | SeasonLogPit;

export type PlayerOrigin = 'pool' | 'class' | 'draft' | 'fa';

export interface Player {
  id: string;
  name: string;
  pos: Position;
  age: number;
  bats: Bats;
  /** Pitching hand; hitters default R for throws-to-first flavor */
  throws?: Throws;
  traits: string[];
  r: Ratings;
  ovr: number;
  pot: number;
  /** 0..1 scouting progress; 1 = fully known */
  scouted: number;
  salary: number;
  years: number;
  morale: number;
  cond: number;
  injured: number;
  st: HitStats;
  pst: PitStats;
  origin: PlayerOrigin;
  teamId?: string | null;
  trueOvr?: number;
  expiring?: boolean;
  seasonLog?: SeasonLogEntry[];
  /** development fractional accumulator */
  _acc?: number;
  /** in-game pitcher fatigue (transient, reset after each game) */
  gFat?: number;
  /** batters faced this game (transient) */
  bfGame?: number;
}

export interface StaffRatings {
  scout: number;
  coach: number;
  trainer: number;
  analyst: number;
}

export interface Strategy {
  patience: number;
  aggression: number;
  bullpenHook: number;
}

export interface ClassMods {
  scoutSpeed: number;
  draftVision: number;
  fanTrustGain: number;
  revenue: number;
  prospectGrowth: number;
  tradeValue: number;
  clubhouse?: number;
  sponsorValue?: number;
  extraRounds?: number;
  extraPick?: boolean;
  latePen?: number;
}

export interface GMClass {
  key: string;
  name: string;
  tag: string;
  glyph: string;
  blurb: string;
  staff: StaffRatings;
  bias: Partial<Ratings>;
  perks: string[];
  mods: ClassMods;
  cash: number;
  fanTrust: number;
  strategy: Strategy;
}

export interface Vibe {
  key: string;
  name: string;
  bg: [number, number, number];
  bulb: [number, number, number];
  grain: number;
  bloom: number;
  sweep: number;
}

export interface Trait {
  key: string;
  name: string;
  desc: string;
  eff: Record<string, number>;
}

export interface StadiumLevel {
  cost: number;
  note: string;
  cap?: number;
  att?: number;
  con?: number;
  spon?: number;
  trust?: number;
  rec?: number;
  mor?: number;
  dev?: number;
}

export type StadiumKey = 'seats' | 'lights' | 'food' | 'board' | 'clubhouse' | 'academy';

/** What the ballpark does while the club is on the road. */
export type YardUse = 'lock' | 'open' | 'rent';

export interface StadiumSpec {
  key: StadiumKey;
  name: string;
  desc: string;
  levels: StadiumLevel[];
}

export type SponsorKind = 'gate' | 'flat' | 'con' | 'win';

/** Static sponsor definition. `check` lives here (in code), never serialized. */
export interface SponsorSpec {
  name: string;
  kind: SponsorKind;
  base: number;
  req: string;
  penalty?: { trust: number };
}

/** A sponsor deal held by a team. References the spec by name. */
export interface SponsorDeal {
  name: string;
  kind: SponsorKind;
  req: string;
  /** season figure this deal pays (already multiplied at offer time) */
  base: number;
  weeks: number;
  signedWeek: number;
  paid: number;
  met?: boolean;
  penalty?: { trust: number };
}

export interface SponsorOffer {
  name: string;
  kind: SponsorKind;
  base: number;
  req: string;
  offer: number;
  weeks: number;
  penalty?: { trust: number };
}

export interface ScenarioEffect {
  cash?: number;
  trust?: number;
  morale?: number;
  cond?: number;
  fld?: number;
  dev?: number;
  att?: number;
  strat?: number;
  injRisk?: number;
  scoutBoost?: number;
  tradeOffer?: number;
  rainRisk?: number;
  riot?: number;
  k?: number;
  /** next-series-only strategy overlays (cleared after the week) */
  weekPatience?: number;
  weekAggression?: number;
  weekCond?: number;
  /** target one player for morale / cond / injury */
  playerPick?: ScenarioPlayerPick;
  playerMorale?: number;
  playerCond?: number;
  playerInjWeeks?: number;
  /** hit another club */
  rivalPick?: ScenarioRivalPick;
  rivalEff?: ScenarioRivalEff;
  /** start or replace a multi-series desk chain */
  arc?: ScenarioArc;
}

/** Who the desk card names when the effect is personal */
export type ScenarioPlayerPick = 'ace' | 'vet' | 'worstMorale' | 'random' | Position;

export type ScenarioRivalPick = 'nextOpp' | 'leader' | 'randomAi';

export interface ScenarioRivalEff {
  trust?: number;
  cash?: number;
  rainRisk?: number;
  weekCond?: number;
  att?: number;
}

/** Follow-up desk cards due after delayWeeks */
export interface ScenarioArc {
  id: string;
  steps: string[];
  delayWeeks?: number;
}

/** Active multi-series desk matter on a club */
export interface DeskArc {
  id: string;
  step: number;
  nextWeek: number;
  cardIds: string[];
}

/** Deferred dugout instructions from a desk card — live for one series */
export interface WeekBoost {
  patience?: number;
  aggression?: number;
  cond?: number;
}

export interface ScenarioSide {
  label: string;
  eff: ScenarioEffect;
  out: string;
}

export interface Scenario {
  id: string;
  tag: string;
  title: string;
  body: string;
  left: ScenarioSide;
  right: ScenarioSide;
}

export interface TrophySpec {
  key: string;
  name: string;
  desc: string;
  tier: number;
}

export interface TrophyWon {
  key: string;
  season: number;
  week: number;
}

export type SkillKey = 'scout' | 'press' | 'deals' | 'farm' | 'ops';

export interface ProgressStats {
  wins: number;
  sweeps: number;
  walkoffs: number;
  hrs: number;
  grands: number;
  triples: number;
  steals: number;
  kGames: number;
  shutouts: number;
  blowouts: number;
  scouts: number;
  desks: number;
  drafts: number;
  trades: number;
  signs: number;
  builds: number;
  sponsors: number;
}

export interface WeekXpNote {
  why: string;
  n: number;
}

export interface TeamProgress {
  xp: number;
  level: number;
  unspent: number;
  skills: Record<SkillKey, number>;
  achievements: string[];
  stats: ProgressStats;
  weekXp: number;
  weekNotes: WeekXpNote[];
  lastUnlocks: string[];
}

export interface AchievementSpec {
  id: string;
  name: string;
  desc: string;
  xp: number;
  icon: string;
  when: (team: Team) => boolean;
}

export interface WeekFinance {
  att: number;
  rev: number;
  cost: number;
  net: number;
  gate?: number;
  conc?: number;
  merch?: number;
  sponsor?: number;
  payroll?: number;
  sellout?: boolean;
  luxury?: number;
  /** true when this club hosted the series */
  home?: boolean;
  /** non-game park take while the club is away */
  yard?: number;
  yardUse?: YardUse;
  yardAtt?: number;
}

export interface TeamHistory {
  season: number;
  w: number;
  l: number;
  rank: number;
  cash: number;
  champ: boolean;
}

export interface Team {
  id: string;
  slot: number;
  city: string;
  mascot: string;
  name: string;
  abbr: string;
  cls: string;
  color: string;
  glyph: string;
  vibe: string;
  isHuman: boolean;
  ownerId: string | null;
  roster: Player[];
  cash: number;
  startCash: number;
  fanTrust: number;
  staff: StaffRatings;
  stadium: Record<StadiumKey, number>;
  ticket: number;
  conPrice: number;
  /** How the yard is used on the road. Defaults to open tours. */
  yardUse?: YardUse;
  sponsors: SponsorDeal[];
  sponsorOffers: SponsorOffer[];
  trophies: TrophyWon[];
  picks: unknown[];
  w: number;
  l: number;
  rf: number;
  ra: number;
  streak: number;
  rank: number;
  wk: WeekFinance;
  history: TeamHistory[];
  strategy: Strategy;
  ap: number;
  apMax: number;
  seasonHigh: Record<string, number>;
  devPool: number;
  scoutFocus: Position | null;
  /** Per-club finished scouting files (player id → 1). Keeps fog private between GMs. */
  scoutFiles?: Record<string, number>;
  rotIdx?: number;
  attBonus?: number;
  devBonus?: number;
  /** true while this club has an unresolved desk scenario blocking the week */
  deskPending?: boolean;
  /** leftover rain risk from a desk card; rolled on the next home series */
  rainRisk?: number;
  /** desk card overlays for the upcoming series only */
  weekBoost?: WeekBoost | null;
  /** multi-series desk chain waiting to fire */
  deskArc?: DeskArc | null;
  /** midnight call from the desk — accept via trade action */
  pendingTrade?: { rivalId: string; give: string[]; get: string[] } | null;
  /** offer from another human GM waiting on this desk */
  inboxTrade?: { fromId: string; give: string[]; get: string[] } | null;
  /** optional batting order override (player ids); null/empty = auto from field */
  lineupIds?: string[] | null;
  /** optional SP order override; null/empty = auto */
  rotationIds?: string[] | null;
  /**
   * Defensive / DH assignments — one unique player id per HIT_POS.
   * Games are blocked for humans until every slot is filled.
   */
  fieldIds?: Partial<Record<Position, string>> | null;
  /** GM progression; optional so older saves hydrate via ensureProgress() */
  progress?: TeamProgress;
  /** Season number while ownership has frozen sales / releases / trades out. */
  sellLockSeason?: number;
  /** Board posture after a messy exit or a bargained year. */
  boardMood?: 'skeptical' | 'probation';
}

export interface DraftSlot {
  round: number;
  teamId: string;
  extra?: boolean;
}

export interface SchedulePair {
  home: string;
  away: string;
  games: number;
}

export interface LogEntry {
  w?: number;
  t?: string;
  txt: string;
  trophy?: string;
  draft?: boolean;
  round?: number;
  teamId?: string;
  playerId?: string;
  trade?: boolean;
}

export interface PbpEvent {
  t: string;
  inn: number;
  half: number;
  b?: string;
  k?: string;
  big?: boolean;
  txt: string;
  /** outs after this event (0–3) */
  outs?: number;
  away?: number;
  home?: number;
  /** first, second, third occupied */
  bases?: [boolean, boolean, boolean];
}

export interface GameResult {
  ok: true;
  homeRuns: number;
  awayRuns: number;
  homeId: string;
  awayId: string;
  winnerId: string;
  loserId: string;
  line: { home: (number | string)[]; away: (number | string)[] };
  pbp: PbpEvent[];
  innings: number;
  walkoff: boolean;
  wp: string;
  lp: string;
}

export interface GameSummary {
  homeId: string;
  awayId: string;
  homeRuns: number;
  awayRuns: number;
  winnerId: string;
  innings: number;
  walkoff: boolean;
  wp: string;
  lp: string;
  line: { home: (number | string)[]; away: (number | string)[] };
}

export interface WeekOutcome {
  week: number;
  games: GameSummary[];
  series: { homeId: string; awayId: string; hw: number; aw: number }[];
  done?: boolean;
}

export interface MyPbp {
  homeId: string;
  awayId: string;
  homeRuns: number;
  awayRuns: number;
  pbp: PbpEvent[];
}

export interface SeriesResult {
  aId: string;
  bId: string;
  aw: number;
  bw: number;
  winnerId: string;
}

export interface Bracket {
  semis: SeriesResult[];
  final: SeriesResult | null;
  champId: string | null;
}

export interface OffseasonReport {
  retired: { teamId: string; name: string; age: number; ovr: number }[];
  expiring: { teamId: string; id: string; name: string; ovr: number; ask: number }[];
  season: number;
}

export interface League {
  seed: number;
  week: number;
  season: number;
  phase: Phase;
  weeks: number;
  gpw: number;
  teams: Team[];
  draftPool: Player[];
  draftOrder: DraftSlot[];
  draftIdx: number;
  draftRounds: number;
  freeAgents: Player[];
  schedule: SchedulePair[][];
  log: LogEntry[];
  results: WeekOutcome[];
  scenarioDeck: string[];
  scenarioIdx: number;
  /** next player id (serialized so ids never collide after reload) */
  pid: number;
  code?: string | null;
  bracket?: Bracket | null;
  offseasonReport?: OffseasonReport | null;
  /** play-by-play for human games from the most recent week (transient-ish, serializable) */
  myPbp?: MyPbp[];
}

export interface HumanConfig {
  name: string;
  city: string;
  mascot: string;
  cls: string;
  color: string;
  glyph: string;
  vibe: string;
  /** Last job ended loud. The next room already has a file. */
  skeptical?: boolean;
}

export interface ShownRating {
  v: number;
  lo: number;
  hi: number;
  exact: boolean;
}
