import type { StadiumSpec } from '../types.js';

export const STADIUM: readonly StadiumSpec[] = [
  { key: 'seats', name: 'Grandstand', desc: 'More seats, more gate.', levels: [{ cost: 0, cap: 9000, note: 'Bleachers and a chain fence' }, { cost: 900000, cap: 14000, note: 'Covered lower bowl' }, { cost: 2400000, cap: 21000, note: 'Second deck' }, { cost: 6000000, cap: 32000, note: 'Full horseshoe' }] },
  { key: 'lights', name: 'Light towers', desc: 'Night games draw better.', levels: [{ cost: 0, att: 1.0, note: 'Day games only' }, { cost: 700000, att: 1.1, note: 'Six towers' }, { cost: 1900000, att: 1.18, note: 'Broadcast-grade' }, { cost: 4200000, att: 1.26, note: 'Halo rig' }] },
  { key: 'food', name: 'Concourse', desc: 'Drives concession spend.', levels: [{ cost: 0, con: 1.0, note: 'One hot dog cart' }, { cost: 550000, con: 1.35, note: 'Six stands' }, { cost: 1600000, con: 1.75, note: 'Food hall' }, { cost: 3800000, con: 2.2, note: 'Local chef program' }] },
  { key: 'board', name: 'Videoboard', desc: 'Fan trust and sponsor value.', levels: [{ cost: 0, spon: 1.0, trust: 0, note: 'Hand-turned numbers' }, { cost: 800000, spon: 1.2, trust: 3, note: 'LED ribbon' }, { cost: 2200000, spon: 1.5, trust: 6, note: 'Center-field wall' }, { cost: 5000000, spon: 1.9, trust: 10, note: 'Wraparound' }] },
  { key: 'clubhouse', name: 'Clubhouse', desc: 'Morale and recovery.', levels: [{ cost: 0, rec: 1.0, mor: 0, note: 'Folding chairs' }, { cost: 600000, rec: 1.2, mor: 3, note: 'Weight room' }, { cost: 1700000, rec: 1.45, mor: 6, note: 'Hydro and film rooms' }, { cost: 3900000, rec: 1.7, mor: 10, note: 'Player palace' }] },
  { key: 'academy', name: 'Academy', desc: 'Prospect development.', levels: [{ cost: 0, dev: 1.0, note: 'A cage behind the bullpen' }, { cost: 750000, dev: 1.25, note: 'Practice field' }, { cost: 2000000, dev: 1.55, note: 'Complex and dorms' }, { cost: 4500000, dev: 1.9, note: 'Year-round academy' }] }
];
