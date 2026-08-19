/** Transient, non-saved UI state (filters, selections, deck position). */
export type RosterFilter = 'field' | 'lineup' | 'rotation' | 'bench' | 'all';
export type MarketTab = 'trade' | 'fa' | 'scout';

export const UI = {
  rosterFilter: 'field' as RosterFilter,
  market: 'trade' as MarketTab,
  trade: { rival: '' as string, mine: [] as string[], theirs: [] as string[] },
  draftIdx: 0,
  draftNeedOpen: false,
  simming: false,
  draftDigest: null as null | { you: string | null; then: string[] }
};
