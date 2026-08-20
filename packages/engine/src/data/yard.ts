import type { YardUse } from '../types.js';

export interface YardSpec {
  key: YardUse;
  name: string;
  tag: string;
  blurb: string;
  receipt: string;
  note: string;
}

export const YARD: Record<YardUse, YardSpec> = {
  lock: {
    key: 'lock',
    name: 'Lock the gates',
    tag: 'DARK',
    blurb: 'The grass grows. Nobody walks the warning track. The host keeps the gate; you keep nothing from the yard.',
    receipt: 'GATES LOCKED',
    note: 'No take while the club is away.'
  },
  open: {
    key: 'open',
    name: 'Open the yard',
    tag: 'TOURS',
    blurb: 'Tours, kids on the grass, a cart in the concourse. Modest money. The seats, the food, and the board still earn.',
    receipt: 'YARD OPEN',
    note: 'Tours and a concourse cart.'
  },
  rent: {
    key: 'rent',
    name: 'Rent the lights',
    tag: 'EVENTS',
    blurb: 'Concerts, festivals, a circus if the check clears. The towers and the board do the work. The neighbors notice.',
    receipt: 'LIGHTS RENTED',
    note: 'Events while the club is on the road.'
  }
};

export const YARD_LIST: YardUse[] = ['lock', 'open', 'rent'];
