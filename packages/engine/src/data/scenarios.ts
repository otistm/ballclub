import type { Scenario } from '../types.js';

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'sc_hotdog', tag: 'CONCESSIONS', title: 'The dollar dog problem',
    body: 'Concessions wants dollar hot dogs every Tuesday. Your accountant made a noise you have never heard a person make.',
    left: { label: 'Kill it', eff: { cash: 0, trust: -4 }, out: 'Tuesday attendance sags. The ledger stays clean.' },
    right: { label: 'Dollar dogs', eff: { cash: -140000, trust: +7, att: 0.06 }, out: 'Nine thousand hot dogs. Two thousand new regulars.' }
  },
  {
    id: 'sc_vet', tag: 'CLUBHOUSE', title: 'The veteran wants a word',
    body: 'Your oldest position player says the kids are getting his innings and he did not sign up to be a coach.',
    left: { label: 'He plays', eff: { morale: +6, dev: -0.15 }, out: 'The room settles. The prospects sit.' },
    right: { label: 'Kids play', eff: { morale: -8, dev: +0.25 }, out: 'He clears out his locker in silence. The kids get reps.' }
  },
  {
    id: 'sc_bus', tag: 'ROAD', title: 'The bus breaks down',
    body: 'Two hours outside Salt Fork, on the shoulder, in the rain. First pitch is in five hours.',
    left: { label: 'Charter a coach', eff: { cash: -60000, morale: +3 }, out: 'They arrive dry and mildly amused.' },
    right: { label: 'Push the bus', eff: { morale: +9, cond: -8 }, out: 'They push it four hundred yards. They will tell this story for years.' }
  },
  {
    id: 'sc_scout', tag: 'SCOUTING', title: 'A tip from a stranger',
    body: 'A man at the fence says there is a left-hander in Duncan Flats throwing 97 with a rec-league glove. He wants two hundred dollars for the address.',
    left: { label: 'Walk away', eff: {}, out: 'You never learn whether he was lying.' },
    right: { label: 'Pay him', eff: { cash: -200000, scoutBoost: 1 }, out: 'The address is real. The left-hander is 19. Your scouts leave at dawn.' }
  },
  {
    id: 'sc_sponsor', tag: 'MONEY', title: 'Naming rights',
    body: 'Tinsley Cigarettes would like the ballpark to carry their name. The check is obscene. The letters would be forty feet tall.',
    left: { label: 'Decline', eff: { trust: +5 }, out: 'The park keeps its name. The board keeps its opinion.' },
    right: { label: 'Take the check', eff: { cash: +1100000, trust: -12 }, out: 'The letters go up on a Thursday. Nobody looks at them twice by August.' }
  },
  {
    id: 'sc_ace', tag: 'CLUBHOUSE', title: 'Your ace skipped the bus',
    body: 'He says his elbow is tight. The trainer says the elbow is fine. Both of them believe it.',
    left: { label: 'Rest him', eff: { cond: +10, morale: +4, trust: -3 }, out: 'He starts Sunday and looks like himself.' },
    right: { label: 'He pitches', eff: { cond: -14, morale: -6, injRisk: 0.18 }, out: 'Six innings, two runs, and a long look at you from the mound.' }
  },
  {
    id: 'sc_kid', tag: 'FANS', title: 'A kid caught a foul ball',
    body: 'Security took it back because it landed in a restricted aisle. Someone filmed it.',
    left: { label: 'Company line', eff: { trust: -9 }, out: 'The clip does numbers. None of them good.' },
    right: { label: 'Sign a bat, give him a season pass', eff: { cash: -20000, trust: +11 }, out: 'The follow-up clip does better numbers.' }
  },
  {
    id: 'sc_rain', tag: 'MONEY', title: 'Rain in the forecast',
    body: 'Sixty percent chance Saturday. The tarp crew wants overtime to be ready either way.',
    left: { label: 'Skip the overtime', eff: { cash: +30000, rainRisk: 0.35 }, out: 'You watch the radar all week like a man waiting on a verdict.' },
    right: { label: 'Pay the crew', eff: { cash: -45000 }, out: 'The tarp is on the field in ninety seconds. The game gets in.' }
  },
  {
    id: 'sc_analytics', tag: 'FRONT OFFICE', title: 'The war room disagrees with the dugout',
    body: 'Your analyst has a chart that says your best hitter should never bunt. Your bench coach has thirty years and a look on his face.',
    left: { label: 'Side with the dugout', eff: { morale: +7, strat: -0.1 }, out: 'The room loves you. The chart goes in a drawer.' },
    right: { label: 'Side with the chart', eff: { morale: -5, strat: +0.12 }, out: 'Run expectancy improves. Somebody slams a door.' }
  },
  {
    id: 'sc_promo', tag: 'CONCESSIONS', title: 'Bat night',
    body: 'Ten thousand souvenir bats, free at the gate. Your head of security has questions.',
    left: { label: 'Foam bats', eff: { cash: -70000, trust: +4, att: 0.04 }, out: 'Safe, silly, and the kids swing them all night.' },
    right: { label: 'Real bats', eff: { cash: -180000, trust: +9, att: 0.09, riot: 0.1 }, out: 'Biggest crowd of the year. Nobody gets hurt. Probably.' }
  },
  {
    id: 'sc_trade', tag: 'FRONT OFFICE', title: 'A rival calls at midnight',
    body: 'He wants your third-best pitcher and he is offering a bat you like. He needs an answer before the sun comes up.',
    left: { label: 'Hang up', eff: { morale: +2 }, out: 'The room hears you turned it down. That counts for something.' },
    right: { label: 'Listen', eff: { tradeOffer: 1 }, out: 'He faxes a name. You put on coffee.' }
  },
  {
    id: 'sc_grounds', tag: 'PARK', title: 'The infield is a beach',
    body: 'Groundskeeper says the clay mix is wrong and has been wrong since April. Three players have rolled ankles.',
    left: { label: 'Live with it', eff: { injRisk: 0.12, cash: 0 }, out: 'Two more ankles by August.' },
    right: { label: 'Redo the infield', eff: { cash: -260000, cond: +12, fld: 2 }, out: 'True hops for the first time all year.' }
  }
];
