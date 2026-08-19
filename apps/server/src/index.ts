/**
 * BALLCLUB league server (co-op foundation).
 *
 * Ordering authority for shared leagues. Validates each action by running
 * the same engine clients use, rejects illegal moves, and persists rooms
 * to disk so a restart does not wipe invite codes.
 */
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeInviteCode, isValidInviteCode, applyAction, replayLeague, actionTeamId, createLeague,
  PROTOCOL_VERSION,
  type ClientMessage, type ServerMessage, type LoggedAction, type HumanConfig, type PresenceBeat,
  type League, type GameAction
} from '@ballclub/engine';

interface SocketMeta {
  teamId: string | null;
  lastSeen: number;
}

interface Room {
  code: string;
  seed: number;
  human: HumanConfig;
  log: LoggedAction[];
  seq: number;
  members: Set<WebSocket>;
  meta: Map<WebSocket, SocketMeta>;
  league: League | null;
}

interface PersistedRoom {
  code: string;
  seed: number;
  human: HumanConfig;
  log: LoggedAction[];
  seq: number;
}

const rooms = new Map<string, Room>();
const PORT = Number(process.env.PORT || 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BALLCLUB_DATA || path.join(__dirname, '..', 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadRooms(): void {
  try {
    ensureDataDir();
    if (!fs.existsSync(ROOMS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8')) as PersistedRoom[];
    if (!Array.isArray(raw)) return;
    raw.forEach((p) => {
      if (!p || !p.code || !isValidInviteCode(p.code)) return;
      rooms.set(p.code, {
        code: p.code,
        seed: p.seed,
        human: p.human,
        log: Array.isArray(p.log) ? p.log : [],
        seq: p.seq || 0,
        members: new Set(),
        meta: new Map(),
        league: null
      });
    });
    console.log('Loaded ' + rooms.size + ' league room(s) from disk');
  } catch (e) {
    console.warn('Could not load rooms:', e);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveRooms();
  }, 400);
}

function saveRooms(): void {
  try {
    ensureDataDir();
    const payload: PersistedRoom[] = [];
    rooms.forEach((r) => {
      payload.push({
        code: r.code,
        seed: r.seed,
        human: r.human,
        log: r.log,
        seq: r.seq
      });
    });
    const tmp = ROOMS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload));
    fs.renameSync(tmp, ROOMS_FILE);
  } catch (e) {
    console.warn('Could not save rooms:', e);
  }
}

loadRooms();

const wss = new WebSocketServer({ port: PORT });

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function beatsOf(room: Room): PresenceBeat[] {
  const out: PresenceBeat[] = [];
  room.meta.forEach((m) => {
    if (m.teamId) out.push({ teamId: m.teamId, lastSeen: m.lastSeen });
  });
  return out;
}

function presenceMsg(room: Room): ServerMessage {
  return { t: 'presence', code: room.code, members: room.members.size, beats: beatsOf(room) };
}

function broadcast(room: Room, msg: ServerMessage): void {
  const raw = JSON.stringify(msg);
  room.members.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw);
  });
}

function touch(room: Room, ws: WebSocket, teamId?: string): void {
  let m = room.meta.get(ws);
  if (!m) {
    m = { teamId: null, lastSeen: Date.now() };
    room.meta.set(ws, m);
  }
  m.lastSeen = Date.now();
  if (teamId) m.teamId = teamId;
}

function ensureLeague(room: Room): League {
  if (!room.league) {
    room.league = room.log.length
      ? replayLeague(room.seed, room.human, room.log)
      : createLeague(room.seed, room.human);
  }
  return room.league;
}

function connectedTeamIds(room: Room): Set<string> {
  const ids = new Set<string>();
  room.meta.forEach((m, sock) => {
    if (m.teamId && room.members.has(sock)) ids.add(m.teamId);
  });
  return ids;
}

function protocolOk(v: unknown): boolean {
  return typeof v === 'number' && v === PROTOCOL_VERSION;
}

/**
 * Club-scoped actions need ownership. Calendar actions need an identified human.
 * advanceIdle may only list humans who are not currently connected.
 */
function mayPublish(room: Room, ws: WebSocket, a: GameAction): string | null {
  const meta = room.meta.get(ws);
  const league = ensureLeague(room);

  if (a.t === 'claimTeam') {
    const seat = league.teams.find((t) => t.id === a.teamId);
    if (!seat) return 'No such club';
    if (seat.isHuman) return 'That club is taken';
    return null;
  }

  if (a.t === 'advanceIdle') {
    if (!meta?.teamId) return 'Identify your club first';
    const live = connectedTeamIds(room);
    for (const id of a.idleTeamIds) {
      const seat = league.teams.find((t) => t.id === id);
      if (!seat || !seat.isHuman) return 'Bad idle list';
      if (live.has(id)) return 'That club is still in the room';
    }
    return null;
  }

  const tid = actionTeamId(a);
  if (!tid) {
    // week / draft / playoffs / offseason — any identified human in the room
    if (!meta?.teamId) return 'Identify your club first';
    const seat = league.teams.find((t) => t.id === meta.teamId);
    if (!seat?.isHuman) return 'Not your club';
    return null;
  }

  if (meta?.teamId && meta.teamId !== tid) return 'Not your club';
  if (!meta?.teamId) {
    // Allow first onboard publishes only for the host human seat matching the action
    const seat = league.teams.find((t) => t.id === tid);
    if (!seat?.isHuman) return 'Identify your club first';
  }
  return null;
}

function bindIdentity(room: Room, ws: WebSocket, teamId: string): string | null {
  let m = room.meta.get(ws);
  if (!m) {
    m = { teamId: null, lastSeen: Date.now() };
    room.meta.set(ws, m);
  }
  if (m.teamId && m.teamId !== teamId) return 'Already identified as another club';
  if (m.teamId === teamId) {
    m.lastSeen = Date.now();
    return null;
  }
  const league = ensureLeague(room);
  const seat = league.teams.find((t) => t.id === teamId);
  if (!seat || !seat.isHuman) return 'That club is not yours';
  for (const [other, om] of room.meta) {
    if (other !== ws && om.teamId === teamId && room.members.has(other)) {
      return 'That club is already connected';
    }
  }
  m.teamId = teamId;
  m.lastSeen = Date.now();
  return null;
}

wss.on('connection', (ws) => {
  const joined = new Set<string>();

  ws.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data)) as ClientMessage;
    } catch {
      send(ws, { t: 'error', msg: 'Bad message' });
      return;
    }

    switch (msg.t) {
      case 'ping':
        send(ws, { t: 'pong' });
        break;

      case 'create': {
        if (!protocolOk(msg.v)) {
          send(ws, { t: 'error', msg: 'Outdated client — refresh and try again' });
          return;
        }
        let code = makeInviteCode();
        while (rooms.has(code)) code = makeInviteCode();
        const room: Room = {
          code, seed: msg.seed, human: msg.human, log: [], seq: 0,
          members: new Set([ws]), meta: new Map(), league: null
        };
        rooms.set(code, room);
        joined.add(code);
        touch(room, ws);
        send(ws, { t: 'created', code, seed: msg.seed });
        scheduleSave();
        break;
      }

      case 'join': {
        if (!protocolOk(msg.v)) {
          send(ws, { t: 'error', msg: 'Outdated client — refresh and try again' });
          return;
        }
        const code = msg.code.toUpperCase();
        if (!isValidInviteCode(code)) {
          send(ws, { t: 'error', msg: 'That is not a league code' });
          return;
        }
        const room = rooms.get(code);
        if (!room) {
          send(ws, { t: 'error', msg: 'No league with that code' });
          return;
        }
        room.members.add(ws);
        joined.add(code);
        touch(room, ws);
        send(ws, { t: 'joined', code, seed: room.seed, human: room.human, log: room.log });
        broadcast(room, presenceMsg(room));
        break;
      }

      case 'hello':
      case 'heartbeat': {
        const room = rooms.get(msg.code);
        if (!room || !room.members.has(ws)) {
          send(ws, { t: 'error', msg: 'Not in that league' });
          return;
        }
        const err = bindIdentity(room, ws, msg.teamId);
        if (err) {
          send(ws, { t: 'error', msg: err });
          return;
        }
        broadcast(room, presenceMsg(room));
        break;
      }

      case 'action': {
        const room = rooms.get(msg.code);
        if (!room || !room.members.has(ws)) {
          send(ws, { t: 'error', msg: 'Not in that league' });
          return;
        }
        touch(room, ws);
        const ownErr = mayPublish(room, ws, msg.a);
        if (ownErr) {
          send(ws, { t: 'error', msg: ownErr });
          return;
        }
        const league = ensureLeague(room);
        const result = applyAction(league, msg.a);
        if (!result.ok) {
          send(ws, { t: 'error', msg: result.err || 'Illegal move' });
          return;
        }
        if (msg.a.t === 'claimTeam') {
          const m = room.meta.get(ws) || { teamId: null, lastSeen: Date.now() };
          m.teamId = msg.a.teamId;
          m.lastSeen = Date.now();
          room.meta.set(ws, m);
        }
        const by = room.meta.get(ws)?.teamId || null;
        const entry: LoggedAction = { seq: ++room.seq, at: Date.now(), by, a: msg.a };
        room.log.push(entry);
        broadcast(room, { t: 'action', code: room.code, entry });
        scheduleSave();
        break;
      }

      case 'sync': {
        const room = rooms.get(msg.code);
        if (!room || !room.members.has(ws)) {
          send(ws, { t: 'error', msg: 'Not in that league' });
          return;
        }
        touch(room, ws);
        send(ws, { t: 'sync', code: room.code, log: room.log.filter((e) => e.seq > msg.from) });
        break;
      }
    }
  });

  ws.on('close', () => {
    joined.forEach((code) => {
      const room = rooms.get(code);
      if (!room) return;
      room.members.delete(ws);
      room.meta.delete(ws);
      broadcast(room, presenceMsg(room));
    });
  });
});

process.on('SIGINT', () => { saveRooms(); process.exit(0); });
process.on('SIGTERM', () => { saveRooms(); process.exit(0); });

console.log('BALLCLUB league server listening on ws://localhost:' + PORT);
console.log('Room data: ' + ROOMS_FILE);
