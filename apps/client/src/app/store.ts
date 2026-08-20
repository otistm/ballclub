/**
 * Central game store. All mutations go through dispatch(), which routes
 * them into the engine's action reducer, appends to the ordered action
 * log, publishes to the network seam, and schedules a save. The save
 * carries both a snapshot (fast load) and the log (replay/sync source).
 *
 * Shared mode: apply locally for snappy UI, publish to the server, and
 * rebase when a peer's ordered entry lands ahead of a provisional echo.
 */
import {
  applyAction, createLeague, ensureProgress, replayLeague,
  type ApplyResult, type GameAction, type HumanConfig, type League, type LoggedAction, type Team
} from '@ballclub/engine';
import { Store as KV } from './persist.js';
import { net, type NetMode } from './net.js';

const SAVE_KEY = 'bc:save';
const SAVE_VERSION = 2;
const LOG_CAP = 2000;

export const WS_URL = ((): string => {
  if (typeof location === 'undefined') return 'ws://localhost:8787';
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const host = local ? 'localhost' : location.hostname;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${host}:8787`;
})();

interface SaveData {
  v: number;
  seed: number;
  human: HumanConfig | null;
  league: League;
  meId: string;
  view: string;
  code: string | null;
  mode: NetMode;
  seq: number;
  log: LoggedAction[];
}

type StoreListener = () => void;

class GameStore {
  league: League | null = null;
  meId = 't0';
  human: HumanConfig | null = null;
  view = 'club';
  code: string | null = null;
  seq = 0;
  log: LoggedAction[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private echoSkip: GameAction | null = null;
  private listeners: StoreListener[] = [];

  onChange(fn: StoreListener): void {
    this.listeners.push(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  get me(): Team {
    return this.league!.teams.find((t) => t.id === this.meId)!;
  }

  newLeague(seed: number, human: HumanConfig, code: string): void {
    this.league = createLeague(seed, human);
    this.league.code = code;
    this.human = human;
    this.meId = this.league.teams.find((t) => t.isHuman)!.id;
    this.code = code;
    this.seq = 0;
    this.log = [];
    this.echoSkip = null;
    this.save();
  }

  /** Rebuild from seed + log (join path). */
  loadFromReplay(seed: number, human: HumanConfig, log: LoggedAction[], code: string, meId?: string): void {
    this.league = replayLeague(seed, human, log);
    this.league.code = code;
    this.human = human;
    this.code = code;
    this.log = log.slice();
    this.seq = log.length ? log[log.length - 1].seq : 0;
    this.meId = meId || this.league.teams.find((t) => t.isHuman)?.id || 't0';
    this.echoSkip = null;
    const me = this.league.teams.find((t) => t.id === this.meId);
    if (me) ensureProgress(me);
    this.save();
  }

  dispatch(a: GameAction): ApplyResult {
    if (!this.league) return { ok: false, err: 'No league' };
    const r = applyAction(this.league, a);
    if (!r.ok) return r;

    if (net.mode === 'shared' && net.code) {
      this.echoSkip = a;
      net.publishAction(a);
      // provisional local log entry; seq fixed when the server echo lands
      const entry: LoggedAction = { seq: this.seq + 1, at: Date.now(), by: this.meId, a };
      this.log.push(entry);
      if (this.log.length > LOG_CAP) this.log.splice(0, this.log.length - LOG_CAP);
    } else {
      const entry: LoggedAction = { seq: ++this.seq, at: Date.now(), by: this.meId, a };
      this.log.push(entry);
      if (this.log.length > LOG_CAP) this.log.splice(0, this.log.length - LOG_CAP);
    }
    this.save();
    return r;
  }

  private rebuildConfirmed(): void {
    if (!this.human || this.league == null) return;
    const confirmed = this.log.filter((e) => e.seq <= this.seq);
    this.league = replayLeague(this.league.seed, this.human, confirmed);
    this.log = confirmed;
    const me = this.league.teams.find((t) => t.id === this.meId);
    if (me) ensureProgress(me);
  }

  /** Apply an ordered entry from the league server (peers, or host echo). */
  applyRemote(entry: LoggedAction): void {
    if (!this.league) return;

    const existing = this.log.find((e) => e.seq === entry.seq);
    if (existing && entry.seq <= this.seq) {
      if (this.echoSkip && sameAction(this.echoSkip, entry.a)) this.echoSkip = null;
      return;
    }

    if (this.echoSkip && sameAction(this.echoSkip, entry.a)) {
      this.echoSkip = null;
      const last = this.log[this.log.length - 1];
      if (last && sameAction(last.a, entry.a)) this.log[this.log.length - 1] = entry;
      else this.log.push(entry);
      this.seq = entry.seq;
      this.save();
      return;
    }

    // Peer (or unexpected) action — drop provisional, replay confirmed, apply remote, re-apply pending
    const pending = this.echoSkip;
    this.echoSkip = null;
    this.log = this.log.filter((e) => e.seq <= this.seq);
    this.rebuildConfirmed();

    const r = applyAction(this.league, entry.a);
    if (!r.ok) {
      this.rebuildConfirmed();
      this.save();
      this.notify();
      return;
    }
    this.log.push(entry);
    this.seq = entry.seq;

    if (pending) {
      const rr = applyAction(this.league, pending);
      if (rr.ok) {
        this.echoSkip = pending;
        this.log.push({ seq: this.seq + 1, at: Date.now(), by: this.meId, a: pending });
      }
    }

    if (this.log.length > LOG_CAP) this.log.splice(0, this.log.length - LOG_CAP);
    this.save();
    this.notify();
  }

  /** Apply a sync batch of entries with seq > current. */
  applySync(entries: LoggedAction[]): void {
    entries
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .forEach((e) => this.applyRemote(e));
  }

  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (!this.league) return;
      const data: SaveData = {
        v: SAVE_VERSION,
        seed: this.league.seed,
        human: this.human,
        league: this.league,
        meId: this.meId,
        view: this.view,
        code: this.code,
        mode: net.mode,
        seq: this.seq,
        log: this.log
      };
      try {
        KV.set(SAVE_KEY, JSON.stringify(data));
      } catch {
        /* storage full or unavailable; the in-memory copy still works */
      }
    }, 400);
  }

  load(): boolean {
    const raw = KV.get(SAVE_KEY);
    if (!raw) return false;
    try {
      const d = JSON.parse(raw) as SaveData;
      if (!d || d.v !== SAVE_VERSION) return false;
      // Prefer log replay when available — snapshot alone can be tampered / truncated
      if (d.log?.length && d.seed != null && d.human) {
        this.league = replayLeague(d.seed, d.human, d.log);
        this.log = d.log.slice();
        this.seq = d.log[d.log.length - 1]?.seq || 0;
      } else if (d.league) {
        this.league = d.league;
        this.log = d.log || [];
        this.seq = d.seq || 0;
      } else {
        return false;
      }
      this.human = d.human;
      this.meId = d.meId || this.league.teams.find((t) => t.isHuman)?.id || 't0';
      this.view = d.view || 'club';
      this.code = d.code || null;
      net.mode = d.mode || 'solo';
      net.code = d.code || null;
      const me = this.league.teams.find((t) => t.id === this.meId);
      if (me) ensureProgress(me);
      return true;
    } catch {
      return false;
    }
  }

  reset(): void {
    KV.del(SAVE_KEY);
    this.league = null;
    this.human = null;
    this.meId = 't0';
    this.view = 'club';
    this.code = null;
    this.seq = 0;
    this.log = [];
    this.echoSkip = null;
  }
}

function sameAction(a: GameAction, b: GameAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const store = new GameStore();
