import type { Trait } from '../types.js';

export const TRAITS: readonly Trait[] = [
  { key: 'IRON', name: 'Iron man', desc: 'Never tires. Never sits.', eff: { stam: 6, fatigueRate: 0.6 } },
  { key: 'CLUTCH', name: 'Clutch', desc: 'Better with men on base.', eff: { clutch: 0.14 } },
  { key: 'GLASS', name: 'Glass', desc: 'One awkward slide from the shelf.', eff: { injury: 2.2 } },
  { key: 'MENTOR', name: 'Mentor', desc: 'Young teammates grow faster.', eff: { mentor: 0.2 } },
  { key: 'HOTHEAD', name: 'Hothead', desc: 'Great player. Terrible teammate.', eff: { clubhouse: -0.25, pow: 4 } },
  { key: 'GRINDER', name: 'Grinder', desc: 'Fouls off everything.', eff: { eye: 5, k: -0.15 } },
  { key: 'CANNON', name: 'Cannon', desc: 'Runners do not test him.', eff: { arm: 10 } },
  { key: 'WHEELS', name: 'Wheels', desc: 'Takes the extra base on principle.', eff: { spd: 8 } },
  { key: 'FANFAVE', name: 'Fan favorite', desc: 'Jerseys sell themselves.', eff: { revenue: 0.06 } },
  { key: 'LATE', name: 'Late bloomer', desc: 'Peaks at 31, not 26.', eff: { peakShift: 4 } },
  { key: 'RUBBER', name: 'Rubber arm', desc: 'Can go on two days rest.', eff: { stam: 10 } },
  { key: 'WILD', name: 'Effectively wild', desc: 'Nobody digs in. Nobody knows where it goes.', eff: { ctl: -8, stuff: 7 } }
];
