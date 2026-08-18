/**
 * Network seam for shared leagues.
 *
 * Solo mode is fully offline: actions apply locally and the log is kept
 * for replay/save integrity. Shared mode (the co-op path) connects to the
 * league server, which assigns authoritative sequence numbers and relays
 * the ordered log to every member. The store is written so switching a
 * league from solo to shared later is a data migration, not a rewrite.
 */
import type { ClientMessage, GameAction, LoggedAction, ServerMessage } from '@ballclub/engine';

export type NetMode = 'solo' | 'shared';

export interface NetEvents {
  onAction?: (entry: LoggedAction) => void;
  onSync?: (log: LoggedAction[]) => void;
  onPresence?: (members: number) => void;
  onError?: (msg: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class NetClient {
  mode: NetMode = 'solo';
  code: string | null = null;
  private ws: WebSocket | null = null;
  private events: NetEvents = {};

  configure(events: NetEvents): void {
    this.events = events;
  }

  get connected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  connect(url: string): Promise<void> {
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
        this.events.onClose?.();
      };
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage;
        } catch {
          return;
        }
        if (msg.t === 'action') this.events.onAction?.(msg.entry);
        else if (msg.t === 'sync') this.events.onSync?.(msg.log);
        else if (msg.t === 'presence') this.events.onPresence?.(msg.members);
        else if (msg.t === 'error') this.events.onError?.(msg.msg);
      };
    });
  }

  send(msg: ClientMessage): void {
    if (this.connected) this.ws!.send(JSON.stringify(msg));
  }

  publishAction(a: GameAction): void {
    if (this.mode !== 'shared' || !this.code) return;
    this.send({ t: 'action', code: this.code, a });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export const net = new NetClient();
