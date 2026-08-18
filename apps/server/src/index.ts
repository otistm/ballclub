/**
 * BALLCLUB league server (co-op foundation).
 *
 * The server is deliberately thin: it is the *ordering authority* for
 * shared leagues. It never simulates anything — it assigns sequence
 * numbers to incoming actions and relays the ordered log to every member.
 * Because the engine is deterministic, every client that replays the same
 * (seed, log) arrives at the identical league state. Server-side
 * validation can be added later by running the same engine here.
 */
import { WebSocketServer, WebSocket } from 'ws';
import {
  makeInviteCode, isValidInviteCode,
  type ClientMessage, type ServerMessage, type LoggedAction, type HumanConfig
} from '@ballclub/engine';

interface Room {
  code: string;
  seed: number;
  human: HumanConfig;
  log: LoggedAction[];
  seq: number;
  members: Set<WebSocket>;
}

const rooms = new Map<string, Room>();
const PORT = Number(process.env.PORT || 8787);

const wss = new WebSocketServer({ port: PORT });

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: ServerMessage): void {
  const raw = JSON.stringify(msg);
  room.members.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw);
  });
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
        let code = makeInviteCode();
        while (rooms.has(code)) code = makeInviteCode();
        const room: Room = { code, seed: msg.seed, human: msg.human, log: [], seq: 0, members: new Set([ws]) };
        rooms.set(code, room);
        joined.add(code);
        send(ws, { t: 'created', code, seed: msg.seed });
        break;
      }

      case 'join': {
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
        send(ws, { t: 'joined', code, seed: room.seed, human: room.human, log: room.log });
        broadcast(room, { t: 'presence', code, members: room.members.size });
        break;
      }

      case 'action': {
        const room = rooms.get(msg.code);
        if (!room || !room.members.has(ws)) {
          send(ws, { t: 'error', msg: 'Not in that league' });
          return;
        }
        const entry: LoggedAction = { seq: ++room.seq, at: Date.now(), by: null, a: msg.a };
        room.log.push(entry);
        broadcast(room, { t: 'action', code: room.code, entry });
        break;
      }

      case 'sync': {
        const room = rooms.get(msg.code);
        if (!room) {
          send(ws, { t: 'error', msg: 'No league with that code' });
          return;
        }
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
      broadcast(room, { t: 'presence', code, members: room.members.size });
      // keep empty rooms alive for reconnects; a TTL sweep can prune later
    });
  });
});

console.log('BALLCLUB league server listening on ws://localhost:' + PORT);
