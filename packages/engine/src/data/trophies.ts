import type { TrophySpec } from '../types.js';

export const TROPHIES: readonly TrophySpec[] = [
  { key: 'PENNANT', name: 'The Pennant', desc: 'Finish first in the league.', tier: 3 },
  { key: 'TITLE', name: 'League Title', desc: 'Win the championship series.', tier: 4 },
  { key: 'WILDCARD', name: 'Cinderella', desc: 'Reach the playoffs as a 4 seed.', tier: 2 },
  { key: 'BLACKINK', name: 'Black Ink', desc: 'Finish a season with more cash than you started.', tier: 2 },
  { key: 'SELLOUT', name: 'Standing Room Only', desc: 'Sell out a series.', tier: 1 },
  { key: 'SLUGGER', name: 'The Slugger', desc: 'A hitter on your roster hits 20 home runs.', tier: 2 },
  { key: 'ACE', name: 'The Ace', desc: 'A starter finishes under a 2.75 ERA.', tier: 2 },
  { key: 'HOMEGROWN', name: 'Homegrown', desc: 'Develop a drafted player to 80 overall.', tier: 3 },
  { key: 'FLEECED', name: 'Fleeced', desc: 'Win a trade by 15 points of value.', tier: 2 },
  { key: 'CATHEDRAL', name: 'Cathedral', desc: 'Max out any stadium structure.', tier: 3 },
  { key: 'TRUSTED', name: 'The City Believes', desc: 'Reach 90 fan trust.', tier: 2 },
  { key: 'SWEEP', name: 'Broom', desc: 'Sweep a three-game series.', tier: 1 }
];
