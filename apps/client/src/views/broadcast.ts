/**
 * Live play-by-play theater. Runs after a series is simulated and before
 * the press-box receipt prints. The engine already produced the ordered
 * event log; this module just plays it back on a scoreboard.
 */
import type { GameSummary, MyPbp, PbpEvent, Team } from '@ballclub/engine';
import { $, esc } from '../ui/dom.js';
import { cssColor } from '../ui/format.js';
import { haptic, reduceMotion } from '../ui/ux.js';
import anime from '../ui/motion.js';
import { ensureDiamond, playDiamondBeat, resetDiamond, setOffenseColor, setPads } from '../ui/diamond.js';
import { backdrop, marquee } from '../app/chrome.js';
import { store } from '../app/store.js';

export interface BroadcastOpts {
  games: GameSummary[];
  pbps: MyPbp[];
  onDone: () => void;
}

interface Card {
  gm: GameSummary;
  pbp: PbpEvent[];
  home: Team;
  away: Team;
  n: number;
  of: number;
}

const SPEEDS = [1, 2, 4] as const;

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
/** Bumps on skip/finish so in-flight paintBoard.then callbacks bail out. */
let beatGen = 0;
let speedIdx = 0;
let highlights = false;
let gi = 0;
let ei = 0;
let cards: Card[] = [];
let onDone: (() => void) | null = null;
let lastScore = { away: 0, home: 0 };
let lastBases: boolean[] = [false, false, false];

function speed(): number {
  return SPEEDS[speedIdx];
}

function stopTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function finish(): void {
  if (!running) return;
  running = false;
  beatGen++;
  stopTimer();
  resetDiamond();
  const el = $('#broadcast');
  el.classList.remove('on');
  el.setAttribute('aria-hidden', 'true');
  const done = onDone;
  onDone = null;
  cards = [];
  done?.();
}

function delayFor(ev: PbpEvent | { t: 'intro' | 'final' }): number {
  const sp = speed();
  if (reduceMotion) return Math.max(80, 140 / sp);
  if (ev.t === 'intro') return 900 / sp;
  if (ev.t === 'final') return 1300 / sp;
  if (ev.t === 'half') return 620 / sp;
  if ('big' in ev && ev.big) return 1180 / sp;
  if ('k' in ev && (ev.k === 'HR' || ev.k === '3B')) return 980 / sp;
  if ('k' in ev && (ev.k === '1B' || ev.k === '2B' || ev.k === 'SF')) return 700 / sp;
  if (ev.t === 'sub') return 380 / sp;
  return 440 / sp;
}

function scoring(ev: PbpEvent, prev: { away: number; home: number }): boolean {
  if (ev.big) return true;
  if (ev.t === 'half') return true;
  return (ev.away ?? 0) > prev.away || (ev.home ?? 0) > prev.home;
}

function paintBoard(card: Card, ev?: PbpEvent): Promise<void> {
  const away = ev?.away ?? 0;
  const home = ev?.home ?? 0;
  const inn = ev?.inn ?? 1;
  const half = ev?.half ?? 0;
  const outs = ev?.outs ?? 0;
  const bases = ev?.bases ?? [false, false, false];
  const me = store.me.id;
  const prevBases = lastBases.slice();

  const prevAway = Number(($('#bc-away .sc') as HTMLElement | null)?.textContent || 0);
  const prevHome = Number(($('#bc-home .sc') as HTMLElement | null)?.textContent || 0);

  $('#bc-match').textContent = 'GAME ' + card.n + ' OF ' + card.of + '  ·  ' + (card.home.id === me ? 'HOME' : 'AWAY');

  const side = (t: Team, runs: number, which: 'away' | 'home'): string =>
    `<div class="nm${t.id === me ? ' me' : ''}" style="color:${cssColor(t.color)}">${esc(t.abbr)}</div>
     <div class="sc">${runs}</div>
     <div class="who">${which === 'away' ? 'AWAY' : 'HOME'}</div>`;

  $('#bc-away').innerHTML = side(card.away, away, 'away');
  $('#bc-home').innerHTML = side(card.home, home, 'home');
  $('#bc-inn').innerHTML = `<span class="arr">${half ? '▼' : '▲'}</span><span class="n">${inn}</span>`;

  const batting = Number(half) ? card.home : card.away;
  setOffenseColor(batting.color);

  document.querySelectorAll('#bc-outs i').forEach((el, i) => {
    const on = i < Math.min(3, outs);
    const was = el.classList.contains('on');
    el.classList.toggle('on', on);
    if (!reduceMotion && on && !was) {
      anime({ targets: el, scale: [0.5, 1.2, 1], duration: 240, easing: 'easeOutQuad' });
    }
  });

  if (!reduceMotion) {
    if (away > prevAway) {
      anime({ targets: '#bc-away .sc', scale: [1, 1.35, 1], duration: 380, easing: 'easeOutElastic' });
    }
    if (home > prevHome) {
      anime({ targets: '#bc-home .sc', scale: [1, 1.35, 1], duration: 380, easing: 'easeOutElastic' });
    }
  }

  const beat = ev
    ? playDiamondBeat(prevBases, bases, ev, speed())
    : Promise.resolve().then(() => {
      ensureDiamond();
      setPads(bases);
    });

  const myGen = beatGen;
  return beat.then(() => {
    if (myGen !== beatGen || !running) return;
    lastBases = bases.slice();
  });
}

function paintCall(ev: PbpEvent): void {
  const call = $('#bc-call');
  const lab = call.querySelector('.lab') as HTMLElement;
  const txt = call.querySelector('.txt') as HTMLElement;
  const kind =
    ev.t === 'half' ? ev.txt :
    ev.t === 'sub' ? 'PITCHING CHANGE' :
    ev.t === 'sb' ? 'STOLEN BASE' :
    ev.t === 'cs' ? 'CAUGHT STEALING' :
    ev.k === 'HR' ? 'HOME RUN' :
    ev.k === 'SF' ? 'SAC FLY' :
    ev.k || ev.t;
  lab.textContent = kind;
  txt.textContent = ev.t === 'half' ? (ev.half ? 'Bottom' : 'Top') + ' of the ' + ev.inn : ev.txt;
  call.classList.toggle('big', !!ev.big || ev.k === 'HR');
  call.classList.toggle('half', ev.t === 'half');
  if (!reduceMotion) {
    anime({ targets: txt, opacity: [0, 1], translateY: [10, 0], duration: 260, easing: 'easeOutQuad' });
  }
}

function pushFeed(ev: PbpEvent, card: Card): void {
  if (ev.t === 'half') return;
  // At-bat / runner lines are the offense; pitching changes are the defense.
  const off = Number(ev.half) ? card.home : card.away;
  const def = Number(ev.half) ? card.away : card.home;
  const color = ev.t === 'sub' ? def.color : off.color;
  const feed = $('#bc-feed');
  const row = document.createElement('div');
  row.className = 'bc-row' + (ev.big ? ' big' : '');
  row.innerHTML =
    `<span class="inn">${ev.half ? '▼' : '▲'}${ev.inn}</span>` +
    `<span class="x" style="color:${cssColor(color)}">${esc(ev.txt)}</span>`;
  feed.prepend(row);
  while (feed.children.length > 7) feed.lastElementChild?.remove();
}

function react(ev: PbpEvent, prev: { away: number; home: number }): void {
  const scored = (ev.away ?? 0) > prev.away || (ev.home ?? 0) > prev.home;
  if (ev.big || ev.k === 'HR') {
    haptic.big();
    if (backdrop.ok) backdrop.flare(1.05, 0);
    if (ev.k === 'HR') marquee.flash('HOME RUN', 1600);
    else if (ev.txt.indexOf('WALK-OFF') >= 0) marquee.flash('WALK-OFF', 1800);
  } else if (scored) {
    haptic.ok();
    if (backdrop.ok) backdrop.flare(0.45, 0);
  } else if (ev.k === 'K' || ev.t === 'cs') {
    haptic.light();
  } else if (ev.k === '1B' || ev.k === '2B' || ev.k === '3B' || ev.t === 'sb') {
    haptic.tap();
  }
}

function showIntro(card: Card): void {
  $('#bc-call').classList.remove('big');
  $('#bc-call').classList.add('half');
  ($('#bc-call .lab') as HTMLElement).textContent = 'GAME ' + card.n + ' OF ' + card.of;
  ($('#bc-call .txt') as HTMLElement).textContent = card.away.abbr + ' AT ' + card.home.abbr;
  $('#bc-feed').innerHTML = '';
  lastBases = [false, false, false];
  resetDiamond();
  void paintBoard(card);
  lastScore = { away: 0, home: 0 };
}

function showFinal(card: Card): void {
  const me = store.me.id;
  const won = card.gm.winnerId === me;
  const my = card.gm.homeId === me ? card.gm.homeRuns : card.gm.awayRuns;
  const th = card.gm.homeId === me ? card.gm.awayRuns : card.gm.homeRuns;
  $('#bc-call').classList.toggle('big', won);
  $('#bc-call').classList.remove('half');
  ($('#bc-call .lab') as HTMLElement).textContent = won ? 'WIN' : 'LOSS';
  ($('#bc-call .txt') as HTMLElement).textContent =
    my + '–' + th + (card.gm.walkoff ? '  WALK-OFF' : card.gm.innings > 9 ? '  ' + card.gm.innings + ' INN' : '');
  lastBases = [false, false, false];
  void paintBoard(card, {
    t: 'half', inn: card.gm.innings, half: 1, txt: '',
    away: card.gm.awayRuns, home: card.gm.homeRuns, outs: 3, bases: [false, false, false]
  });
  if (won) {
    haptic.ok();
    if (backdrop.ok) backdrop.flare(0.7, 0);
  } else haptic.warn();
}

type Phase = 'intro' | 'plays' | 'final';
let phase: Phase = 'intro';

function step(): void {
  if (!running) return;
  const card = cards[gi];
  if (!card) {
    finish();
    return;
  }

  if (phase === 'intro') {
    showIntro(card);
    phase = 'plays';
    ei = 0;
    timer = setTimeout(step, delayFor({ t: 'intro' }));
    return;
  }

  if (phase === 'plays') {
    while (ei < card.pbp.length) {
      const ev = card.pbp[ei++];
      const keep = !highlights || scoring(ev, lastScore);
      const nextScore = { away: ev.away ?? lastScore.away, home: ev.home ?? lastScore.home };
      if (!keep) {
        lastScore = nextScore;
        if (ev.bases) lastBases = ev.bases.slice();
        continue;
      }
      paintCall(ev);
      pushFeed(ev, card);
      react(ev, lastScore);
      lastScore = nextScore;
      const wait = Math.max(delayFor(ev), reduceMotion ? 0 : 200);
      const myGen = beatGen;
      void paintBoard(card, ev).then(() => {
        if (!running || myGen !== beatGen) return;
        timer = setTimeout(step, wait);
      });
      return;
    }
    phase = 'final';
    showFinal(card);
    timer = setTimeout(step, delayFor({ t: 'final' }));
    return;
  }

  gi++;
  phase = 'intro';
  timer = setTimeout(step, 120);
}

function paintChrome(): void {
  $('#bc-speed').textContent = speed() + '×';
  $('#bc-hl').textContent = highlights ? 'SCORING' : 'ALL PLAYS';
}

export function startBroadcast(opts: BroadcastOpts): void {
  stopTimer();
  const L = store.league!;
  cards = opts.games.map((gm, i) => {
    const pbp = opts.pbps[i]?.pbp || [];
    return {
      gm,
      pbp,
      home: L.teams.find((t) => t.id === gm.homeId)!,
      away: L.teams.find((t) => t.id === gm.awayId)!,
      n: i + 1,
      of: opts.games.length
    };
  }).filter((c) => c.home && c.away);

  if (!cards.length || cards.every((c) => !c.pbp.length)) {
    opts.onDone();
    return;
  }

  onDone = opts.onDone;
  gi = 0;
  ei = 0;
  phase = 'intro';
  lastBases = [false, false, false];
  highlights = reduceMotion ? true : highlights;
  running = true;
  paintChrome();
  ensureDiamond();
  const el = $('#broadcast');
  el.classList.add('on');
  el.setAttribute('aria-hidden', 'false');
  step();
}

export function skipBroadcast(): void {
  if (!running) return;
  finish();
}

export function skipBroadcastGame(): void {
  if (!running) return;
  beatGen++;
  stopTimer();
  resetDiamond();
  const card = cards[gi];
  if (!card) {
    finish();
    return;
  }
  phase = 'final';
  ei = card.pbp.length;
  showFinal(card);
  timer = setTimeout(step, delayFor({ t: 'final' }));
}

export function cycleBroadcastSpeed(): void {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  paintChrome();
  haptic.tap();
}

export function toggleBroadcastHighlights(): void {
  highlights = !highlights;
  paintChrome();
  haptic.tap();
}

export function isBroadcasting(): boolean {
  return running;
}
