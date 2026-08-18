/** Market ceremony overlays: scout file stamp and trade fax. */
import anime from './motion.js';
import { $, esc } from './dom.js';
import { haptic, reduceMotion } from './ux.js';

let busy = false;

function root(): HTMLElement {
  return $('#market-fx');
}

function closeFx(): void {
  const el = root();
  el.classList.remove('on');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '';
  busy = false;
}

export function showScoutStamp(opts: {
  name: string;
  estimate: string;
  ovr: number;
  note?: string;
  onDone?: () => void;
}): void {
  if (busy) {
    opts.onDone?.();
    return;
  }
  busy = true;
  const el = root();
  el.innerHTML = `<div class="mfx-card scout">
    <div class="mfx-tag">SCOUTING FILE</div>
    <div class="mfx-name">${esc(opts.name)}</div>
    <div class="mfx-fog" id="mfx-fog">${esc(opts.estimate)}</div>
    <div class="mfx-true" id="mfx-true" style="opacity:0">${opts.ovr}</div>
    <div class="mfx-stamp" id="mfx-stamp">FILE IN</div>
    ${opts.note ? `<div class="mfx-note">${esc(opts.note)}</div>` : ''}
  </div>`;
  el.classList.add('on');
  el.setAttribute('aria-hidden', 'false');
  haptic.select();

  const finish = (): void => {
    closeFx();
    opts.onDone?.();
  };

  if (reduceMotion) {
    const fog = $('#mfx-fog');
    const tru = $('#mfx-true');
    if (fog) fog.style.opacity = '0';
    if (tru) tru.style.opacity = '1';
    window.setTimeout(finish, 700);
    return;
  }

  anime({
    targets: '#mfx-fog',
    opacity: 0,
    duration: 420,
    delay: 280,
    easing: 'easeInQuad'
  });
  anime({
    targets: '#mfx-true',
    opacity: [0, 1],
    scale: [0.86, 1],
    duration: 480,
    delay: 420,
    easing: 'easeOutBack'
  });
  anime({
    targets: '#mfx-stamp',
    opacity: [0, 1],
    scale: [1.4, 1],
    rotate: [-18, -8],
    duration: 420,
    delay: 720,
    easing: 'easeOutQuad',
    complete: () => {
      haptic.ok();
      window.setTimeout(finish, 780);
    }
  });
}

export function showTradeFax(opts: {
  ok: boolean;
  them: string;
  line: string;
  onDone?: () => void;
}): void {
  if (busy) {
    opts.onDone?.();
    return;
  }
  busy = true;
  const el = root();
  const stamp = opts.ok ? 'DEAL' : 'NO DEAL';
  el.innerHTML = `<div class="mfx-card fax">
    <div class="mfx-tag">PRESS BOX FAX</div>
    <div class="mfx-faxhead">TO ${esc(opts.them)} · FROM YOUR DESK</div>
    <div class="mfx-line">${esc(opts.line)}</div>
    <div class="mfx-stamp ${opts.ok ? 'ok' : 'bad'}" id="mfx-stamp">${stamp}</div>
  </div>`;
  el.classList.add('on');
  el.setAttribute('aria-hidden', 'false');
  haptic.select();

  const finish = (): void => {
    closeFx();
    opts.onDone?.();
  };

  if (reduceMotion) {
    window.setTimeout(finish, 700);
    return;
  }

  anime({
    targets: '.mfx-card.fax',
    translateY: [-24, 0],
    opacity: [0, 1],
    duration: 360,
    easing: 'easeOutQuart'
  });
  anime({
    targets: '#mfx-stamp',
    opacity: [0, 1],
    scale: [1.5, 1],
    rotate: [opts.ok ? 12 : -14, opts.ok ? 6 : -8],
    duration: 420,
    delay: 380,
    easing: 'easeOutQuad',
    complete: () => {
      if (opts.ok) haptic.big();
      else haptic.warn();
      window.setTimeout(finish, 900);
    }
  });
}
