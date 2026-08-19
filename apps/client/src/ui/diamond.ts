/**
 * Dice Pennant–style chalk diamond for the live broadcast.
 * Pads light when occupied; runners animate between bases on PBP beats.
 */
import type { PbpEvent } from '@ballclub/engine';
import { reduceMotion } from './ux.js';

/** plate → 1B → 2B → 3B → home (score) */
const BASE_XY: [number, number][] = [
  [50, 92],
  [92, 50],
  [50, 8],
  [8, 50],
  [50, 92]
];

export interface RunnerMove {
  from: number;
  to: number;
}

let gen = 0;
let mounted = false;

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k of Object.keys(attrs)) e.setAttribute(k, String(attrs[k]));
  return e;
}

function root(): SVGSVGElement | null {
  return document.querySelector('#bc-diamond-svg');
}

/** Build the SVG once inside #bc-diamond. */
export function ensureDiamond(): void {
  const host = document.querySelector('#bc-diamond');
  if (!host || mounted) return;
  host.innerHTML = '';
  const svg = svgEl('svg', {
    id: 'bc-diamond-svg',
    viewBox: '0 0 100 100',
    'aria-hidden': 'true'
  }) as SVGSVGElement;
  svg.appendChild(svgEl('path', {
    class: 'chalkline',
    d: 'M50 92 L8 50 L50 8 L92 50 Z'
  }));
  svg.appendChild(svgEl('rect', {
    class: 'basepad', id: 'bc-pad1',
    x: 86, y: 44, width: 12, height: 12, transform: 'rotate(45 92 50)'
  }));
  svg.appendChild(svgEl('rect', {
    class: 'basepad', id: 'bc-pad2',
    x: 44, y: 2, width: 12, height: 12, transform: 'rotate(45 50 8)'
  }));
  svg.appendChild(svgEl('rect', {
    class: 'basepad', id: 'bc-pad3',
    x: 2, y: 44, width: 12, height: 12, transform: 'rotate(45 8 50)'
  }));
  svg.appendChild(svgEl('path', {
    class: 'basepad', id: 'bc-padH',
    d: 'M44 86 h12 v7 l-6 6 l-6 -6 Z'
  }));
  host.appendChild(svg);
  mounted = true;
}

export function resetDiamond(): void {
  gen++;
  const svg = root();
  if (!svg) return;
  svg.querySelectorAll('.runner, .outmark').forEach((n) => n.remove());
  setPads([false, false, false]);
}

export function setPads(bases: boolean[]): void {
  ensureDiamond();
  (['bc-pad1', 'bc-pad2', 'bc-pad3'] as const).forEach((id, i) => {
    document.getElementById(id)?.classList.toggle('occ', !!bases[i]);
  });
}

function advanceMoves(
  bases: boolean[],
  outcome: { kind: 'hit' | 'walk' | 'out'; bases: number }
): { bases: boolean[]; moves: RunnerMove[] } {
  const adv = outcome.bases;
  const nb = [false, false, false];
  const moves: RunnerMove[] = [];
  if (outcome.kind === 'walk') {
    const occ = bases.slice();
    if (occ[0] && occ[1] && occ[2]) {
      nb[0] = nb[1] = nb[2] = true;
      moves.push({ from: 3, to: 4 }, { from: 2, to: 3 }, { from: 1, to: 2 }, { from: 0, to: 1 });
    } else if (occ[0] && occ[1]) {
      nb[0] = nb[1] = nb[2] = true;
      moves.push({ from: 2, to: 3 }, { from: 1, to: 2 }, { from: 0, to: 1 });
    } else if (occ[0]) {
      nb[0] = nb[1] = true;
      nb[2] = !!occ[2];
      moves.push({ from: 1, to: 2 }, { from: 0, to: 1 });
    } else {
      nb[0] = true;
      nb[1] = !!occ[1];
      nb[2] = !!occ[2];
      moves.push({ from: 0, to: 1 });
    }
    return { bases: nb, moves };
  }
  if (outcome.kind !== 'hit') return { bases: bases.slice(), moves };
  const runners: number[] = [];
  for (let i = 0; i < 3; i++) if (bases[i]) runners.push(i + 1);
  runners.push(0);
  for (const pos of runners) {
    const to = pos + adv;
    moves.push({ from: pos, to: Math.min(to, 4) });
    if (to < 4) nb[to - 1] = true;
  }
  return { bases: nb, moves };
}

function outcomeFromEvent(ev: PbpEvent): { kind: 'hit' | 'walk' | 'out'; bases: number } | null {
  if (ev.t === 'half' || ev.t === 'sub' || ev.t === 'sb' || ev.t === 'cs') return null;
  if (ev.k === 'HR') return { kind: 'hit', bases: 4 };
  if (ev.k === '3B') return { kind: 'hit', bases: 3 };
  if (ev.k === '2B') return { kind: 'hit', bases: 2 };
  if (ev.k === '1B') return { kind: 'hit', bases: 1 };
  if (ev.k === 'BB' || ev.k === 'HBP') return { kind: 'walk', bases: 1 };
  return null;
}

function stealMoves(prev: boolean[], next: boolean[]): RunnerMove[] {
  const moves: RunnerMove[] = [];
  // Prefer single-base advances matching occupancy delta
  for (let i = 2; i >= 0; i--) {
    if (next[i] && !prev[i]) {
      if (i > 0 && prev[i - 1] && !next[i - 1]) moves.push({ from: i, to: i + 1 });
      else if (i === 0) moves.push({ from: 0, to: 1 });
    }
  }
  // Steal of home / scored
  if (prev[2] && !next[2] && !next[1] && !next[0]) {
    // might have scored — if no other explanation
    if (!moves.length) moves.push({ from: 3, to: 4 });
  }
  return moves;
}

function isBatterOut(ev: PbpEvent): boolean {
  if (ev.t === 'cs') return true;
  if (ev.t !== 'pa' && ev.t !== 'out') return false;
  const k = ev.k || '';
  return k === 'K' || k === 'GO' || k === 'AO' || k === 'DP' || k === 'FO' || k === 'LO' || k === 'FC';
}

/** Infer runner paths from previous occupancy + event. */
export function inferMoves(prev: boolean[], next: boolean[], ev: PbpEvent): {
  moves: RunnerMove[];
  outAnim: boolean;
} {
  if (ev.t === 'half') return { moves: [], outAnim: false };
  if (ev.t === 'sb') return { moves: stealMoves(prev, next), outAnim: false };
  if (ev.t === 'cs') return { moves: [], outAnim: true };

  const o = outcomeFromEvent(ev);
  if (o && (o.kind === 'hit' || o.kind === 'walk')) {
    const r = advanceMoves(prev, o);
    return { moves: r.moves, outAnim: false };
  }
  if (ev.k === 'SF') {
    const moves: RunnerMove[] = [];
    for (let i = 2; i >= 0; i--) {
      if (prev[i] && !next[i]) {
        let landed = false;
        for (let j = i + 1; j < 3; j++) {
          if (next[j] && !prev[j]) {
            moves.push({ from: i + 1, to: j + 1 });
            landed = true;
            break;
          }
        }
        if (!landed) moves.push({ from: i + 1, to: 4 });
      }
    }
    return { moves, outAnim: false };
  }
  if (isBatterOut(ev)) return { moves: [], outAnim: true };
  return { moves: [], outAnim: false };
}

function animateRunners(moves: RunnerMove[], leg = 220): Promise<void> {
  const svg = root();
  if (!svg || reduceMotion || !moves.length) return Promise.resolve();
  const my = ++gen;
  return Promise.all(moves.map((mv, idx) => new Promise<void>((res) => {
    const legs: [[number, number], [number, number]][] = [];
    for (let p = mv.from; p < mv.to; p++) legs.push([BASE_XY[p], BASE_XY[p + 1]]);
    if (!legs.length) {
      res();
      return;
    }
    const c = svgEl('circle', {
      class: 'runner',
      r: 4.2,
      cx: BASE_XY[mv.from][0],
      cy: BASE_XY[mv.from][1]
    });
    svg.appendChild(c);
    const t0 = performance.now() + idx * 70;
    const dur = legs.length * leg;
    const frame = (t: number): void => {
      if (my !== gen) {
        c.remove();
        res();
        return;
      }
      const e = Math.min(1, Math.max(0, (t - t0) / dur));
      const total = e * legs.length;
      const li = Math.min(legs.length - 1, total | 0);
      const lt = total - li;
      const [a, b] = legs[li];
      c.setAttribute('cx', String(a[0] + (b[0] - a[0]) * lt));
      c.setAttribute('cy', String(a[1] + (b[1] - a[1]) * lt));
      if (e < 1) {
        requestAnimationFrame(frame);
        return;
      }
      if (mv.to === 4) {
        c.classList.add('score');
        window.setTimeout(() => {
          c.remove();
          res();
        }, 240);
      } else {
        window.setTimeout(() => {
          c.remove();
          res();
        }, 60);
      }
    };
    requestAnimationFrame(frame);
  }))).then(() => undefined);
}

function animateOut(): Promise<void> {
  const svg = root();
  if (!svg || reduceMotion) return Promise.resolve();
  const my = ++gen;
  return new Promise((res) => {
    const c = svgEl('circle', { class: 'runner dead', r: 4.2, cx: 50, cy: 92 });
    const mark = svgEl('text', {
      class: 'outmark',
      x: 50,
      y: 86,
      'text-anchor': 'middle',
      opacity: 0
    });
    mark.textContent = '✕';
    svg.appendChild(c);
    svg.appendChild(mark);
    const t0 = performance.now();
    const dir = Math.random() < 0.5 ? -1 : 1;
    const vx = dir * (48 + Math.random() * 22);
    const vy0 = -76;
    const grav = 290;
    const frame = (t: number): void => {
      if (my !== gen) {
        c.remove();
        mark.remove();
        res();
        return;
      }
      const s = (t - t0) / 1000;
      if (s < 0.22) {
        mark.setAttribute('opacity', String(Math.min(1, s / 0.08)));
        requestAnimationFrame(frame);
        return;
      }
      const u = s - 0.22;
      c.setAttribute('cx', String(50 + vx * u));
      c.setAttribute('cy', String(92 + vy0 * u + grav * u * u * 0.5));
      c.setAttribute('opacity', String(Math.max(0, 1 - u * 0.75)));
      mark.setAttribute('y', String(86 - u * 10));
      mark.setAttribute('opacity', String(Math.max(0, 1 - u * 1.4)));
      if (u < 0.9) {
        requestAnimationFrame(frame);
        return;
      }
      c.remove();
      mark.remove();
      res();
    };
    requestAnimationFrame(frame);
  });
}

/**
 * Update pads and play runner motion for one PBP beat.
 * Resolves when motion finishes (or immediately if reduced / snap).
 */
export function playDiamondBeat(
  prev: boolean[],
  next: boolean[],
  ev: PbpEvent | undefined,
  speedMul = 1
): Promise<void> {
  ensureDiamond();
  if (!ev || ev.t === 'half') {
    resetDiamond();
    setPads(next);
    return Promise.resolve();
  }
  const { moves, outAnim } = inferMoves(prev, next, ev);
  const leg = Math.max(90, Math.round(220 / speedMul));

  // Clear leaving pads while runners travel; light destinations after
  if (moves.length && !reduceMotion) {
    const mid = prev.slice() as boolean[];
    moves.forEach((m) => {
      if (m.from >= 1 && m.from <= 3) mid[m.from - 1] = false;
    });
    setPads(mid);
    return animateRunners(moves, leg).then(() => {
      setPads(next);
    });
  }
  if (outAnim && !reduceMotion) {
    return animateOut().then(() => {
      setPads(next);
    });
  }
  setPads(next);
  return Promise.resolve();
}
