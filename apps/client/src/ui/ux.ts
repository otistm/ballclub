/** Haptics, gestures and number rolls. */
import anime from './motion.js';

export const reduceMotion =
  typeof window !== 'undefined' && !!window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function buzz(pattern: number | number[]): void {
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* not supported */
  }
}

export const haptic = {
  tap: () => buzz(8),
  light: () => buzz(4),
  select: () => buzz([0, 6, 24, 6]),
  ok: () => buzz([0, 12, 40, 22]),
  warn: () => buzz([0, 26, 60, 26]),
  big: () => buzz([0, 18, 40, 18, 40, 60])
};

export type DragAxis = 'x' | 'y' | null;

export interface DragOpts {
  axis?: 'x' | 'y';
  preventDefault?: boolean;
  onStart?: () => void;
  onMove?: (dx: number, dy: number, axis: DragAxis) => void;
  onEnd?: (dx: number, dy: number, vx: number, axis: DragAxis, elapsed: number) => void;
  onCancel?: () => void;
}

/** Kill the click browsers synthesize after a touch swipe. */
export function swallowClick(ms = 520): void {
  const block = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    document.removeEventListener('click', block, true);
  };
  document.addEventListener('click', block, true);
  window.setTimeout(() => document.removeEventListener('click', block, true), ms);
}

/** Drag gesture on an element: onStart/onMove/onEnd with dx,dy,vx. */
export function drag(el: HTMLElement, o: DragOpts): { destroy(): void } {
  let id: number | null = null;
  let x0 = 0, y0 = 0, t0 = 0, lx = 0, lt = 0, vx = 0;
  let active = false;
  let locked: DragAxis = null;
  let lastTouch = 0;

  const pt = (e: TouchEvent | MouseEvent) => ('touches' in e ? e.touches[0] : e);

  function down(e: TouchEvent | MouseEvent): void {
    if (id !== null) return;
    const p = pt(e);
    id = 'touches' in e ? e.touches[0].identifier : 1;
    x0 = lx = p.clientX;
    y0 = p.clientY;
    t0 = lt = performance.now();
    vx = 0;
    active = true;
    locked = null;
    if (o.onStart) o.onStart();
  }

  function move(e: TouchEvent | MouseEvent): void {
    if (!active) return;
    const p = pt(e);
    const dx = p.clientX - x0;
    const dy = p.clientY - y0;
    if (locked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (o.axis && o.axis !== locked) {
        active = false;
        id = null;
        if (o.onCancel) o.onCancel();
        return;
      }
    }
    const now = performance.now();
    const dt = Math.max(1, now - lt);
    vx = (p.clientX - lx) / dt;
    lx = p.clientX;
    lt = now;
    if (locked && o.preventDefault !== false && e.cancelable) e.preventDefault();
    if (o.onMove) o.onMove(dx, dy, locked);
  }

  function up(e: TouchEvent | MouseEvent): void {
    if (!active) {
      id = null;
      return;
    }
    const p = 'changedTouches' in e ? e.changedTouches[0] : e;
    const dx = p.clientX - x0;
    const dy = p.clientY - y0;
    active = false;
    id = null;
    if (o.onEnd) o.onEnd(dx, dy, vx, locked, performance.now() - t0);
  }

  el.addEventListener('touchstart', (e) => {
    lastTouch = performance.now();
    down(e);
  }, { passive: true });
  el.addEventListener('touchmove', move, { passive: false });
  el.addEventListener('touchend', up, { passive: true });
  el.addEventListener('touchcancel', up, { passive: true });
  el.addEventListener('mousedown', (e) => {
    if (performance.now() - lastTouch < 650) return;
    down(e);
    const mm = (ev: MouseEvent) => move(ev);
    const mu = (ev: MouseEvent) => {
      up(ev);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  });
  return { destroy() { /* listeners die with the element */ } };
}

/** Long press with haptic. */
export function longPress(el: HTMLElement, ms: number, fn: (e: Event) => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let moved = false;
  let sx = 0, sy = 0;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  el.addEventListener('touchstart', (e) => {
    moved = false;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    timer = setTimeout(() => {
      if (!moved) {
        haptic.select();
        fn(e);
      }
    }, ms);
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (Math.abs(e.touches[0].clientX - sx) > 9 || Math.abs(e.touches[0].clientY - sy) > 9) {
      moved = true;
      clear();
    }
  }, { passive: true });
  el.addEventListener('touchend', clear, { passive: true });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    fn(e);
  });
}

/** Animated number counter. */
export function roll(el: HTMLElement, from: number, to: number, fmt?: (v: number) => string, dur?: number): void {
  if (reduceMotion) {
    el.textContent = fmt ? fmt(to) : String(Math.round(to));
    return;
  }
  const o = { v: from };
  anime({
    targets: o,
    v: to,
    duration: dur || 620,
    easing: 'easeOutQuart',
    update: () => {
      el.textContent = fmt ? fmt(o.v) : String(Math.round(o.v));
    }
  });
}
