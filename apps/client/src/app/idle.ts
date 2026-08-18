/**
 * Shared-league idle GM.
 *
 * The engine does not decide who is away. The person sitting at this
 * device is never listed. Solo play never dispatches advanceIdle, so a
 * local GM is never autoplayed.
 *
 * Presence (lastSeen) is not on the sim: who is idle is computed here and
 * written onto the action so replay stays deterministic.
 */
import type { ApplyResult, League, PresenceBeat } from '@ballclub/engine';
import { net } from './net.js';
import { store } from './store.js';

/** Default: fifteen minutes away from a shared league. */
export const IDLE_AFTER_MS = 15 * 60 * 1000;

/** Latest presence beats from the server (shared mode only). */
export let presenceBeats: PresenceBeat[] = [];

export function setPresenceBeats(beats: PresenceBeat[]): void {
  presenceBeats = beats || [];
}

/** Humans other than the local player who have been silent long enough. */
export function idleTeamIds(
  league: League, meId: string, presence: PresenceBeat[], now: number, afterMs = IDLE_AFTER_MS
): string[] {
  if (net.mode !== 'shared') return [];
  const away = new Set(
    presence.filter((p) => now - p.lastSeen >= afterMs).map((p) => p.teamId)
  );
  return league.teams
    .filter((t) => t.isHuman && t.id !== meId && away.has(t.id))
    .map((t) => t.id);
}

/** Run one idle tick for away clubs. No-op in solo, and never includes me. */
export function tickSharedIdle(presence: PresenceBeat[] = presenceBeats, now = Date.now()): ApplyResult | null {
  if (net.mode !== 'shared' || !store.league) return null;
  const ids = idleTeamIds(store.league, store.meId, presence, now);
  if (!ids.length) return null;
  if (ids.indexOf(store.meId) >= 0) return null;
  return store.dispatch({ t: 'advanceIdle', idleTeamIds: ids });
}

/** Humans (other than me) who still have a desk card open — the co-op clock. */
export function deskWaiters(league: League, meId: string): { id: string; name: string; abbr: string }[] {
  return league.teams
    .filter((t) => t.isHuman && t.id !== meId && t.deskPending)
    .map((t) => ({ id: t.id, name: t.name, abbr: t.abbr }));
}
