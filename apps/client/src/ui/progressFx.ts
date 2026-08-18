/** Fullscreen GM level-up and office-point beats. */
import anime from './motion.js';
import { $ } from './dom.js';
import { haptic, reduceMotion } from './ux.js';

type Done = () => void;

let queue: Array<(next: Done) => void> = [];
let running = false;

function root(): HTMLElement {
  return $('#progress-fx');
}

function pump(): void {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  running = true;
  job(() => {
    running = false;
    pump();
  });
}

function closeFx(): void {
  const el = root();
  el.classList.remove('on', 'point');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '';
  el.onclick = null;
}

/** Level rise + banked office point (same unlock). */
export function playLevelSequence(level: number, onOffice?: () => void): void {
  queue.push((next) => {
    const el = root();
    el.innerHTML = `<div class="pfx-wash"></div>
      <div class="pfx-inner">
        <div class="pfx-lab">GENERAL MANAGER</div>
        <div class="pfx-level" id="pfx-level">GM ${level}</div>
        <div class="pfx-sub">You leveled up</div>
      </div>`;
    el.classList.add('on');
    el.setAttribute('aria-hidden', 'false');
    haptic.big();

    const goPoint = (): void => {
      el.classList.add('point');
      el.innerHTML = `<div class="pfx-wash"></div>
        <div class="pfx-inner">
          <div class="pfx-lab">THE OFFICE</div>
          <div class="pfx-point" id="pfx-point">+1</div>
          <div class="pfx-sub">A point waiting to place</div>
          <button class="btn primary pfx-cta" id="pfx-cta">Open the office</button>
          <button class="chip pfx-skip" id="pfx-skip">Later</button>
        </div>`;
      haptic.ok();
      const finish = (open: boolean): void => {
        closeFx();
        if (open) onOffice?.();
        next();
      };
      $('#pfx-cta')?.addEventListener('click', (e) => {
        e.stopPropagation();
        finish(true);
      });
      $('#pfx-skip')?.addEventListener('click', (e) => {
        e.stopPropagation();
        finish(false);
      });
      el.onclick = () => finish(false);
      if (reduceMotion) return;
      anime({
        targets: '#pfx-point',
        scale: [0.6, 1],
        opacity: [0, 1],
        duration: 520,
        easing: 'easeOutBack'
      });
    };

    if (reduceMotion) {
      window.setTimeout(goPoint, 600);
      return;
    }

    anime({
      targets: '#pfx-level',
      scale: [0.7, 1.08, 1],
      opacity: [0, 1],
      duration: 900,
      easing: 'easeOutExpo'
    });
    anime({
      targets: '.pfx-wash',
      opacity: [0, 1],
      duration: 400,
      easing: 'easeOutQuad'
    });
    window.setTimeout(goPoint, 1400);
  });
  pump();
}

export function enqueueAchievementToast(show: () => void): void {
  queue.push((next) => {
    show();
    window.setTimeout(next, 420);
  });
  pump();
}
