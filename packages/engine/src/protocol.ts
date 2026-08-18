/**
 * Wire protocol between client and league server.
 * The server is the ordering authority for a shared league: it assigns
 * sequence numbers to actions and relays them to every member, so all
 * clients replay an identical log.
 */
import type { GameAction, LoggedAction } from './actions.js';
import type { HumanConfig } from './types.js';

export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | { t: 'create'; v: number; seed: number; human: HumanConfig; playerName: string }
  | { t: 'join'; v: number; code: string; playerName: string }
  | { t: 'action'; code: string; a: GameAction }
  | { t: 'sync'; code: string; from: number }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'created'; code: string; seed: number }
  | { t: 'joined'; code: string; seed: number; human: HumanConfig; log: LoggedAction[] }
  | { t: 'action'; code: string; entry: LoggedAction }
  | { t: 'sync'; code: string; log: LoggedAction[] }
  | { t: 'presence'; code: string; members: number }
  | { t: 'error'; msg: string }
  | { t: 'pong' };

const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY349';

export function makeInviteCode(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return s;
}

export function isValidInviteCode(code: string): boolean {
  return /^[ACDEFGHJKLMNPQRTUVWXY349]{6}$/.test(code);
}
