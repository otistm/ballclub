/**
 * Network seam for shared leagues.
 *
 * Solo mode is fully offline: actions apply locally and the log is kept
 * for replay/save integrity. Shared mode connects to the league server,
 * which assigns authoritative sequence numbers and relays the ordered log.
 */
import {
  PROTOCOL_VERSION,
  type ClientMessage, type GameAction, type HumanConfig, type LoggedAction,
  type PresenceBeat, type ServerMessage
} from '@ballclub/engine';

export type NetMode = 'solo' | 'shared';

export interface NetEvents {
  onAction?: (entry: LoggedAction) => void;
  onSync?: (log: LoggedAction[]) => void;
  onPresence?: (members: number, beats: PresenceBeat[]) => void;
  onError?: (msg: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class NetClient {
  mode: NetMode = 'solo';
  code: string | null = null;
  private ws: WebSocket | null = null;
  private events: NetEvents = {};
  private waiters: Array<(msg: ServerMessage) => void> = [];
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  private teamId: string | null = null;

  configure(events: NetEvents): void {
    this.events = { ...this.events, ...events };
  }

  get connected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  connect(url: string): Promise<void> {
    if (this.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        this.ws = ws;
        this.events.onOpen?.();
        resolve();
      };
      ws.onerror = () => reject(new Error('Could not reach the league server'));
      ws.onclose = () => {
        this.ws = null;
        this.stopHeartbeats();
        this.events.onClose?.();
      };
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage;
        } catch {
          return;
        }
        const pending = this.waiters.slice();
        this.waiters = [];
        pending.forEach((fn) => fn(msg));
        if (msg.t === 'action') this.events.onAction?.(msg.entry);
        else if (msg.t === 'sync') this.events.onSync?.(msg.log);
        else if (msg.t === 'presence') this.events.onPresence?.(msg.members, msg.beats || []);
        else if (msg.t === 'error') this.events.onError?.(msg.msg);
      };
    });
  }

  private waitFor(pred: (m: ServerMessage) => boolean, ms = 8000): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((fn) => fn !== onMsg);
        reject(new Error('Server timed out'));
      }, ms);
      const onMsg = (msg: ServerMessage): void => {
        if (msg.t === 'error') {
          clearTimeout(t);
          reject(new Error(msg.msg));
          return;
        }
        if (pred(msg)) {
          clearTimeout(t);
          resolve(msg);
        } else {
          this.waiters.push(onMsg);
        }
      };
      this.waiters.push(onMsg);
    });
  }

  send(msg: ClientMessage): void {
    if (this.connected) this.ws!.send(JSON.stringify(msg));
  }

  publishAction(a: GameAction): void {
    if (this.mode !== 'shared' || !this.code) return;
    this.send({ t: 'action', code: this.code, a });
  }

  /** Announce which club this socket owns and start periodic heartbeats. */
  identify(teamId: string): void {
    this.teamId = teamId;
    if (this.mode !== 'shared' || !this.code || !this.connected) return;
    this.send({ t: 'hello', code: this.code, teamId });
    this.startHeartbeats();
  }

  private startHeartbeats(): void {
    this.stopHeartbeats();
    this.beatTimer = setInterval(() => {
      if (!this.connected || !this.code || !this.teamId) return;
      this.send({ t: 'heartbeat', code: this.code, teamId: this.teamId });
    }, 25000);
  }

  private stopHeartbeats(): void {
    if (this.beatTimer) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
  }

  async createRoom(seed: number, human: HumanConfig): Promise<{ code: string; seed: number }> {
    this.send({ t: 'create', v: PROTOCOL_VERSION, seed, human, playerName: human.name });
    const msg = await this.waitFor((m) => m.t === 'created');
    if (msg.t !== 'created') throw new Error('Bad create reply');
    return { code: msg.code, seed: msg.seed };
  }

  async joinRoom(code: string, playerName: string): Promise<{
    code: string; seed: number; human: HumanConfig; log: LoggedAction[];
  }> {
    this.send({ t: 'join', v: PROTOCOL_VERSION, code, playerName });
    const msg = await this.waitFor((m) => m.t === 'joined');
    if (msg.t !== 'joined') throw new Error('Bad join reply');
    return { code: msg.code, seed: msg.seed, human: msg.human, log: msg.log };
  }

  disconnect(): void {
    this.stopHeartbeats();
    this.ws?.close();
    this.ws = null;
  }
}

export const net = new NetClient();
