/** DOM helpers, toasts, the bottom sheet, and the press-box printer. */
import anime from './motion.js';
import { drag, haptic, reduceMotion } from './ux.js';

export const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector(s) as T;

export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/* ---------- toasts ---------- */
export function toast(title: string, msg: string, kind?: string): void {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = '<div class="t">' + esc(title) + '</div><div class="m">' + esc(msg) + '</div>';
  $('#toasts').appendChild(el);
  anime({ targets: el, opacity: [0, 1], translateY: [-14, 0], duration: 340, easing: 'easeOutBack' });
  setTimeout(() => {
    anime({ targets: el, opacity: 0, translateY: -10, duration: 260, complete: () => el.remove() });
  }, 2600);
}

/* ---------- bottom sheet ---------- */
let sheetOpen = false;
let receiptOpen = false;
let printAnim: ReturnType<typeof anime> | null = null;
let chatter: ReturnType<typeof setInterval> | null = null;

function hideScrimIfIdle(): void {
  if (!sheetOpen && !receiptOpen) $('#scrim').classList.remove('on');
}

export function openSheet(html: string): void {
  closeReceipt();
  $('#sheetbody').innerHTML = html;
  $('#scrim').classList.add('on');
  sheetOpen = true;
  anime({ targets: '#sheet', translateY: ['102%', '0%'], duration: reduceMotion ? 1 : 420, easing: 'easeOutQuart' });
  if (!reduceMotion) {
    anime({
      targets: '#sheetbody > *',
      opacity: [0, 1],
      translateY: [12, 0],
      delay: anime.stagger(28, { start: 90 }),
      duration: 340,
      easing: 'easeOutQuad'
    });
  }
}

export function closeSheet(): void {
  if (receiptOpen) closeReceipt();
  if (!sheetOpen) return;
  sheetOpen = false;
  hideScrimIfIdle();
  anime({ targets: '#sheet', translateY: '102%', duration: 300, easing: 'easeInOutQuad' });
}

export function initSheet(): void {
  anime.set('#sheet', { translateY: '102%' });
  $('#scrim').addEventListener('click', closeSheet);
  drag($('#grab'), {
    axis: 'y',
    onMove(_dx, dy) {
      if (dy > 0) anime.set('#sheet', { translateY: dy });
    },
    onEnd(_dx, dy) {
      if (dy > 110) closeSheet();
      else anime({ targets: '#sheet', translateY: 0, duration: 300, easing: 'easeOutQuart' });
    }
  });
}

/* ---------- press-box printer / series receipt ---------- */
function stopPrint(): void {
  if (printAnim) {
    printAnim.pause();
    printAnim = null;
  }
  if (chatter) {
    clearInterval(chatter);
    chatter = null;
  }
}

export function printReceipt(html: string): void {
  const printer = $('#printer');
  const paper = $('#receipt-paper');
  const head = $('#print-head');
  const well = $('#receipt-well');
  stopPrint();
  paper.innerHTML = html;
  paper.classList.remove('printed');
  printer.classList.add('on', 'printing');
  printer.setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('on');
  receiptOpen = true;
  well.scrollTop = 0;
  head.style.opacity = '1';
  head.style.top = '0px';

  const finish = (): void => {
    paper.style.maxHeight = 'none';
    paper.style.overflow = 'visible';
    paper.classList.add('printed');
    printer.classList.remove('printing');
    head.style.opacity = '0';
    printAnim = null;
    if (chatter) {
      clearInterval(chatter);
      chatter = null;
    }
  };

  if (reduceMotion) {
    paper.style.maxHeight = 'none';
    finish();
    return;
  }

  paper.style.overflow = 'hidden';
  paper.style.maxHeight = '0px';
  const h = Math.max(paper.scrollHeight, 1);
  const ms = Math.min(3400, Math.max(1600, Math.round(h * 2.1)));
  haptic.light();
  chatter = setInterval(() => haptic.light(), 140);
  printAnim = anime({
    targets: paper,
    maxHeight: ['0px', h + 'px'],
    duration: ms,
    easing: 'linear',
    update() {
      const y = paper.offsetHeight;
      head.style.top = Math.max(0, y - 3) + 'px';
      if (y > well.clientHeight - 24) well.scrollTop = y - well.clientHeight + 24;
    },
    complete: finish
  });
}

export function closeReceipt(): void {
  if (!receiptOpen) return;
  receiptOpen = false;
  stopPrint();
  const printer = $('#printer');
  const paper = $('#receipt-paper');
  printer.classList.remove('on', 'printing');
  printer.setAttribute('aria-hidden', 'true');
  paper.classList.remove('printed');
  paper.style.maxHeight = '';
  paper.style.overflow = '';
  $('#print-head').style.opacity = '0';
  hideScrimIfIdle();
}
