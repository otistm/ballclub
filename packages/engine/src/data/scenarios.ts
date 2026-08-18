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
  },
  {
    id: 'sc_greenlight', tag: 'DUGOUT', title: 'The green light',
    body: 'Your third-base coach wants the runners going on contact all series. The catcher looks nervous.',
    left: { label: 'Hold the bag', eff: { weekAggression: -0.18, weekPatience: 0.08 }, out: 'They stay put. You steal fewer bases and fewer outs.' },
    right: { label: 'Green light', eff: { weekAggression: 0.22, weekCond: -5 }, out: 'Everyone is moving. Legs will be heavy by Sunday.' }
  },
  {
    id: 'sc_take', tag: 'DUGOUT', title: 'Take until you get a strike',
    body: 'The hitting coach wants a patient week. Free swingers hate the memo.',
    left: { label: 'Swing free', eff: { weekPatience: -0.15, weekAggression: 0.1 }, out: 'Early counts. Loud contact. Some ugly Ks.' },
    right: { label: 'Work the count', eff: { weekPatience: 0.2, weekCond: -3 }, out: 'Longer ABs. The bullpen warms earlier than you like.' }
  },

  /* ---------- one-shot classic ---------- */
  {
    id: 'sc_media', tag: 'PRESS', title: 'Media day goes long',
    body: 'The beat writers want twenty more minutes with your clubhouse. Your players want lunch.',
    left: { label: 'Cut it short', eff: { trust: -5, morale: +4 }, out: 'The room eats. The papers run a thin note.' },
    right: { label: 'Open the doors', eff: { trust: +8, morale: -3 }, out: 'Quotes for days. Somebody says too much.' }
  },
  {
    id: 'sc_food', tag: 'CLUBHOUSE', title: 'The caterer quit',
    body: 'Spread is cold cuts and a sad bowl of oranges. Tomorrow is a day game after a night game.',
    left: { label: 'Live with it', eff: { cash: 25000, morale: -6 }, out: 'They eat. They complain. You save a few dollars.' },
    right: { label: 'Call the steakhouse', eff: { cash: -90000, morale: +9 }, out: 'Ribeyes hit the table. The room softens.' }
  },
  {
    id: 'sc_bullpen', tag: 'CLUBHOUSE', title: 'Bullpen quarrel',
    body: 'Your closer and your setup man argued in the tunnel loud enough for the visitors to hear.',
    left: { label: 'Let them cool', eff: { morale: -4 }, out: 'Nobody talks for two days. The eighth still gets covered.' },
    right: { label: 'Call a meeting', eff: { cash: -15000, morale: +5, cond: -3 }, out: 'Air gets cleared. Arms get a little heavier.' }
  },
  {
    id: 'sc_parking', tag: 'FANS', title: 'Parking lot scrap',
    body: 'Two season-ticket holders swung at each other over a spot. Security wants a raise and a new camera.',
    left: { label: 'Fine both', eff: { cash: 10000, trust: -6 }, out: 'The money comes in. The message board lights up.' },
    right: { label: 'Upgrade security', eff: { cash: -120000, trust: +5 }, out: 'Cameras go up. The lot behaves for a while.' }
  },
  {
    id: 'sc_bobble', tag: 'CONCESSIONS', title: 'Bobblehead night',
    body: 'Thirty thousand little plastic heads of your shortstop. The warehouse is already full.',
    left: { label: 'Cancel the run', eff: { cash: 40000, trust: -5 }, out: 'Collectors howl. The ledger sighs with relief.' },
    right: { label: 'Ship them', eff: { cash: -220000, trust: +10, att: 0.08 }, out: 'Gates jam. The shortstop signs until his hand cramps.' }
  },
  {
    id: 'sc_prank', tag: 'ROAD', title: 'Visiting clubhouse prank',
    body: 'Somebody filled the visitors\' shower with green dye. Their skipper wants an apology on letterhead.',
    left: { label: 'Deny everything', eff: { morale: +6, trust: -4 }, out: 'Your room laughs. Their board files a note.' },
    right: { label: 'Apologize in writing', eff: { cash: -25000, trust: +3, morale: -2 }, out: 'You look like an adult. The kids look disappointed.' }
  },
  {
    id: 'sc_radio', tag: 'MONEY', title: 'Radio rights bump',
    body: 'The flagship station wants exclusivity and a bigger cut. They will walk if you squeeze.',
    left: { label: 'Squeeze them', eff: { cash: 180000, trust: -3 }, out: 'You get the number. The broadcast sounds a little thinner.' },
    right: { label: 'Take the deal', eff: { cash: 90000, trust: +4 }, out: 'Steady money. Friendly voices on the dial.' }
  },
  {
    id: 'sc_parade', tag: 'FANS', title: 'City parade invite',
    body: 'The mayor wants your club on a float for Founders Week. It is a Tuesday. You have a doubleheader Wednesday.',
    left: { label: 'Decline politely', eff: { trust: -4, cond: +4 }, out: 'Legs stay fresh. City hall remembers.' },
    right: { label: 'Ride the float', eff: { trust: +9, cond: -6 }, out: 'Kids wave. Wednesday feels like Thursday.' }
  },
  {
    id: 'sc_bpkids', tag: 'FANS', title: 'Kids on the field',
    body: 'A charity wants fifty kids to take BP before Saturday. Insurance has opinions.',
    left: { label: 'Keep the field clear', eff: { cash: 0, trust: -3 }, out: 'Clean infield. Cold letters in the mail.' },
    right: { label: 'Open the gates', eff: { cash: -35000, trust: +10, morale: +3 }, out: 'Fifty helmets, fifty grins, one clean single off the tarp.' }
  },
  {
    id: 'sc_suite', tag: 'MONEY', title: 'Luxury suite spat',
    body: 'A suite holder wants a refund after a rain delay. He buys a lot of beer and knows a board member.',
    left: { label: 'No refunds', eff: { cash: 45000, trust: -7 }, out: 'Policy wins. The suite sits empty next week.' },
    right: { label: 'Make it right', eff: { cash: -80000, trust: +6 }, out: 'He comes back with friends. The board member nods.' }
  },

  /* ---------- player-targeted ---------- */
  {
    id: 'sc_ace_innings', tag: 'CLUBHOUSE', title: 'The ace wants the ball',
    body: 'Your best starter says he is fine for 110 pitches. The trainer has a different number circled.',
    left: { label: 'Hold the pitch count', eff: { playerPick: 'ace', playerMorale: -8, playerCond: +8 }, out: 'He sulks. The elbow stays quiet.' },
    right: { label: 'Give him the ball', eff: { playerPick: 'ace', playerMorale: +10, playerCond: -12, playerInjWeeks: 0 }, out: 'He goes deep. You hold your breath in the seventh.' }
  },
  {
    id: 'sc_vet_sit', tag: 'CLUBHOUSE', title: 'The vet wants a sit',
    body: 'Your oldest bat asks out of the next series. He says the legs are loud. The lineup card looks thin without him.',
    left: { label: 'Write him in', eff: { playerPick: 'vet', playerMorale: -10, playerCond: -6 }, out: 'He plays. He does not thank you.' },
    right: { label: 'Give him the series', eff: { playerPick: 'vet', playerMorale: +8, playerCond: +10, weekCond: -2 }, out: 'He tips his cap. Somebody else hits third.' }
  },
  {
    id: 'sc_cold_bat', tag: 'DUGOUT', title: 'A cold bat asks off',
    body: 'Your worst-morale regular wants a day. The numbers say he is due. The eyes say he is cooked.',
    left: { label: 'Play through it', eff: { playerPick: 'worstMorale', playerMorale: -6, weekPatience: -0.05 }, out: 'He stays in. The at-bats stay empty.' },
    right: { label: 'Scratch him', eff: { playerPick: 'worstMorale', playerMorale: +7, playerCond: +5 }, out: 'He breathes. The bench bat gets a look.' }
  },
  {
    id: 'sc_closer_turf', tag: 'CLUBHOUSE', title: 'Closer vs setup',
    body: 'Your closer heard the setup man wants the ninth on the road. The room is picking sides.',
    left: { label: 'Back the closer', eff: { playerPick: 'RP', playerMorale: +8 }, out: 'The ninth stays his. The setup man goes quiet.' },
    right: { label: 'Open the door', eff: { playerPick: 'RP', playerMorale: -7, weekAggression: 0.05 }, out: 'Roles blur. Someone will earn the ball.' }
  },
  {
    id: 'sc_prospect', tag: 'FARM', title: 'Prospect call-up heat',
    body: 'The papers want your best young bat up now. He is not on the roster yet, but the veterans feel the draft coming.',
    left: { label: 'Keep the room', eff: { playerPick: 'vet', playerMorale: +5, dev: -0.08 }, out: 'Veterans nod. The farm stays patient.' },
    right: { label: 'Promise a look', eff: { playerPick: 'vet', playerMorale: -6, dev: +0.2 }, out: 'The kids lean forward. Somebody clears a locker in his head.' }
  },

  /* ---------- multi-series arcs ---------- */
  {
    id: 'sc_bond_1', tag: 'PARK', title: 'Stadium bond vote',
    body: 'City council floats a bond for new lights. They want the club to put skin in the game before the vote.',
    left: {
      label: 'Defer the check',
      eff: { trust: +2, arc: { id: 'bond', steps: ['sc_bond_defer'], delayWeeks: 2 } },
      out: 'You smile for cameras. The invoice waits in a drawer.'
    },
    right: {
      label: 'Put money in',
      eff: { cash: -350000, att: 0.05, arc: { id: 'bond', steps: ['sc_bond_pay'], delayWeeks: 2 } },
      out: 'The check clears. The lights get a hearing date.'
    }
  },
  {
    id: 'sc_bond_pay', tag: 'PARK', title: 'Bond vote — the lights',
    body: 'The bond passed. Crews want access during a homestand. Your groundskeeper wants blood.',
    left: { label: 'Work around them', eff: { att: 0.06, cond: -4, trust: +4 }, out: 'Scaffolding in the outfield. Crowds still come.' },
    right: { label: 'Close a section', eff: { att: -0.02, cash: -40000, trust: +2 }, out: 'Safer install. A few angry ticket holders.' }
  },
  {
    id: 'sc_bond_defer', tag: 'PARK', title: 'Bond vote — the hangover',
    body: 'The bond failed by six votes. Talk radio says the club never meant it. Council wants a public apology.',
    left: { label: 'Stay quiet', eff: { trust: -10 }, out: 'The silence gets written up. Attendance dips a hair.' },
    right: { label: 'Own it on the air', eff: { cash: -60000, trust: -3 }, out: 'You take the hit in public. It could have been worse.' }
  },
  {
    id: 'sc_poach_1', tag: 'FRONT OFFICE', title: 'Poaching rumor',
    body: 'A beat writer says your next opponent has been soft-touching one of your free-agent-to-be bats.',
    left: {
      label: 'Ignore it',
      eff: { morale: -3, arc: { id: 'poach', steps: ['sc_poach_ignore'], delayWeeks: 2 } },
      out: 'You change the subject. The room still heard it.'
    },
    right: {
      label: 'Confront them',
      eff: {
        rivalPick: 'nextOpp',
        rivalEff: { trust: -6 },
        arc: { id: 'poach', steps: ['sc_poach_fight'], delayWeeks: 1 }
      },
      out: 'You call their GM. The line goes cold.'
    }
  },
  {
    id: 'sc_poach_ignore', tag: 'CLUBHOUSE', title: 'The rumor settles in',
    body: 'Two weeks later the same writer has a source. Your bat is quiet. The room is not.',
    left: { label: 'Lock the doors', eff: { morale: -8, trust: -4 }, out: 'No quotes. Plenty of side-eye.' },
    right: { label: 'Raise him early', eff: { cash: -200000, playerPick: 'worstMorale', playerMorale: +10 }, out: 'You spend. The rumor loses oxygen.' }
  },
  {
    id: 'sc_poach_fight', tag: 'FRONT OFFICE', title: 'After the confrontation',
    body: 'Their club leaked your call. League office wants both GMs to cool it before the series.',
    left: { label: 'Shake hands', eff: { trust: +3, rivalPick: 'nextOpp', rivalEff: { trust: +2 } }, out: 'Photo op. Nobody believes it. The series stays clean.' },
    right: { label: 'Keep the edge', eff: { morale: +5, rivalPick: 'nextOpp', rivalEff: { weekCond: -6 } }, out: 'You do not blink. Their clubhouse feels it.' }
  },
  {
    id: 'sc_camp_1', tag: 'FARM', title: 'Training camp overhaul',
    body: 'Your farm director wants a high-intensity camp week. Costly. Loud. Maybe brilliant.',
    left: { label: 'Keep the old plan', eff: { cash: 20000, dev: -0.05 }, out: 'Same drills. Same ceiling.' },
    right: {
      label: 'Fund the camp',
      eff: { cash: -280000, dev: +0.35, arc: { id: 'camp', steps: ['sc_camp_sore'], delayWeeks: 2 } },
      out: 'New coaches, new sweat. The bills start now.'
    }
  },
  {
    id: 'sc_camp_sore', tag: 'CLUBHOUSE', title: 'Camp soreness',
    body: 'The overhaul worked on paper. Half the roster is walking like they lost a bar fight.',
    left: { label: 'Push through', eff: { cond: -8, morale: -4, dev: +0.1 }, out: 'They play stiff. The gains stick a little harder.' },
    right: { label: 'Ease the load', eff: { cond: +6, weekCond: +4, dev: -0.05 }, out: 'Ice and early buses. Development slows a tick.' }
  },

  /* ---------- league / rival ---------- */
  {
    id: 'sc_umps', tag: 'LEAGUE', title: 'Umpire rumor',
    body: 'A friend of a friend says the crew for your next series can be "helped along." He wants a number.',
    left: { label: 'Hang up', eff: { trust: +6 }, out: 'You keep your hands clean. Sleep comes easier.' },
    right: {
      label: 'Pay the man',
      eff: {
        cash: -150000,
        trust: -8,
        rivalPick: 'nextOpp',
        rivalEff: { weekCond: -8, rainRisk: 0.05 }
      },
      out: 'You hate yourself a little. Their timing looks off all weekend.'
    }
  },
  {
    id: 'sc_share_scout', tag: 'SCOUTING', title: 'Share the files',
    body: 'A rival GM wants your notes on a free-agent arm. He will pay. Your scouts will notice.',
    left: { label: 'Keep the files', eff: { morale: +3 }, out: 'Your room trusts you. The money walks.' },
    right: {
      label: 'Sell the notes',
      eff: {
        cash: 220000,
        rivalPick: 'randomAi',
        rivalEff: { att: 0.03, trust: +2 }
      },
      out: 'Wire hits. Somebody in your war room goes quiet.'
    }
  }
];
