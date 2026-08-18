import type { GMClass } from '../types.js';

export const CLASSES: Record<string, GMClass> = {
  ANALYST: {
    key: 'ANALYST', name: 'The Analyst', tag: 'Numbers first',
    glyph: 'compass',
    blurb: 'You hired a war room before you hired a hitting coach. Your staff sees through the noise — but the clubhouse thinks you talk like a spreadsheet.',
    staff: { scout: 74, coach: 52, trainer: 54, analyst: 84 },
    bias: { eye: 7, con: 2, pow: -1, spd: -3, fld: 2, ctl: 5, stuff: -1, mov: 3, stam: 0 },
    perks: ['Scouting reports resolve twice as fast', 'Draft board shows true grades one round early', 'Fan trust grows slowly'],
    mods: { scoutSpeed: 2.0, draftVision: 1, fanTrustGain: 0.7, revenue: 1.0, prospectGrowth: 1.0, tradeValue: 1.0 },
    cash: 4200000, fanTrust: 42,
    strategy: { patience: 0.85, aggression: 0.25, bullpenHook: 0.5 }
  },
  OLD_LION: {
    key: 'OLD_LION', name: 'The Old Lion', tag: 'Thirty years in the dugout',
    glyph: 'bear',
    blurb: 'You have managed longer than most of your players have been alive. Veterans run through walls for you. The front office thinks you are a fossil.',
    staff: { scout: 58, coach: 80, trainer: 66, analyst: 30 },
    bias: { eye: 3, con: 6, pow: 0, spd: 2, fld: 5, ctl: 5, stuff: 0, mov: 1, stam: 6 },
    perks: ['Veterans never lose morale', 'Clubhouse scenarios resolve in your favor more often', 'Prospects develop slowly'],
    mods: { scoutSpeed: 1.0, draftVision: 0, fanTrustGain: 1.1, revenue: 1.0, prospectGrowth: 0.75, tradeValue: 1.0, clubhouse: 1.35 },
    cash: 3800000, fanTrust: 58,
    strategy: { patience: 0.55, aggression: 0.5, bullpenHook: 0.25 }
  },
  SHOWMAN: {
    key: 'SHOWMAN', name: 'The Showman', tag: 'Put people in seats',
    glyph: 'star',
    blurb: 'Fireworks every Friday, a bat-dog, a scoreboard that costs more than your bullpen. Baseball is the excuse; the show is the product.',
    staff: { scout: 44, coach: 58, trainer: 52, analyst: 46 },
    bias: { eye: -3, con: -2, pow: 9, spd: 0, fld: -2, ctl: -3, stuff: 6, mov: -1, stam: -2 },
    perks: ['+35% gate and concession revenue', 'Sponsors pay a premium', 'Your roster swings for the fences — and misses'],
    mods: { scoutSpeed: 0.8, draftVision: 0, fanTrustGain: 1.4, revenue: 1.35, prospectGrowth: 1.0, tradeValue: 1.0, sponsorValue: 1.3 },
    cash: 5600000, fanTrust: 66,
    strategy: { patience: 0.2, aggression: 0.8, bullpenHook: 0.45 }
  },
  FARMER: {
    key: 'FARMER', name: 'The Farmer', tag: 'Grow your own',
    glyph: 'ball',
    blurb: 'You do not buy ballplayers. You raise them. Give it three seasons and the whole league will be picking from your orchard.',
    staff: { scout: 76, coach: 62, trainer: 74, analyst: 40 },
    bias: { eye: 2, con: 2, pow: -3, spd: 6, fld: 7, ctl: 2, stuff: 2, mov: 2, stam: 2 },
    perks: ['Prospects develop 60% faster', 'Draft pool runs two rounds deeper', 'You start poor'],
    mods: { scoutSpeed: 1.4, draftVision: 0, fanTrustGain: 0.9, revenue: 0.9, prospectGrowth: 1.6, tradeValue: 1.0, extraRounds: 2 },
    cash: 2900000, fanTrust: 48,
    strategy: { patience: 0.6, aggression: 0.4, bullpenHook: 0.4 }
  },
  CLOSER: {
    key: 'CLOSER', name: 'The Closer', tag: 'Nobody scores late',
    glyph: 'bolt',
    blurb: 'You pitched the ninth for eleven years and you never once looked at the dugout. Your teams are built backwards from the last out.',
    staff: { scout: 50, coach: 64, trainer: 56, analyst: 52 },
    bias: { eye: 0, con: 0, pow: 1, spd: 3, fld: 3, ctl: 3, stuff: 8, mov: 5, stam: -5 },
    perks: ['Relievers get a +6 boost from the 7th inning on', 'One-run games swing your way', 'Starters tire early'],
    mods: { scoutSpeed: 1.0, draftVision: 0, fanTrustGain: 1.0, revenue: 1.0, prospectGrowth: 1.0, tradeValue: 1.0, latePen: 6 },
    cash: 4000000, fanTrust: 52,
    strategy: { patience: 0.5, aggression: 0.5, bullpenHook: 0.85 }
  },
  BROKER: {
    key: 'BROKER', name: 'The Broker', tag: 'Everyone is available',
    glyph: 'skull',
    blurb: 'You have never been sentimental about a ballplayer in your life. Every man on the roster is a number waiting for a better number.',
    staff: { scout: 66, coach: 46, trainer: 46, analyst: 62 },
    bias: { eye: 1, con: 1, pow: 1, spd: 1, fld: 0, ctl: 1, stuff: 1, mov: 0, stam: 0 },
    perks: ['Rival GMs accept 25% worse deals', 'Every roster spot is always in play', 'No development staff to speak of'],
    mods: { scoutSpeed: 1.1, draftVision: 0, fanTrustGain: 0.85, revenue: 1.05, prospectGrowth: 1.0, tradeValue: 1.25 },
    cash: 4800000, fanTrust: 45,
    strategy: { patience: 0.5, aggression: 0.5, bullpenHook: 0.5 }
  }
};

export const CLASS_LIST: string[] = Object.keys(CLASSES);
