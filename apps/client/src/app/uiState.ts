/** Transient, non-saved UI state (filters, selections, deck position). */
export type RosterFilter = 'lineup' | 'rotation' | 'bench' | 'all';
export type MarketTab = 'trade' | 'fa' | 'scout';

export const UI = {
  rosterFilter: 'lineup' as RosterFilter,
  market: 'trade' as MarketTab,
  trade: { rival: '' as string, mine: [] as string[], theirs: [] as string[] },
  draftIdx: 0,
  simming: false
};
