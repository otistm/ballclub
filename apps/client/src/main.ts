/** Boot: chrome, tabs, sheet, global wiring, then load a save or onboard. */
import './styles.css';
import { $, initSheet, toast } from './ui/dom.js';
import { initChrome, applyTeamColor, applyVibe, marquee } from './app/chrome.js';
import { store, WS_URL } from './app/store.js';
import { buildTabs, go, render, wireGlobal } from './app/game.js';
import { OB, initOnboarding } from './app/onboard.js';
import { net } from './app/net.js';
import { presenceBeats, setPresenceBeats, tickSharedIdle } from './app/idle.js';

const IDLE_TICK_MS = 60_000;

function wireNet(): void {
  net.configure({
    onAction: (entry) => {
      store.applyRemote(entry);
      if (store.league) render();
    },
    onError: (msg) => toast('League wire', msg, 'bad'),
    onPresence: (n, beats) => {
      setPresenceBeats(beats);
      if (net.mode === 'shared' && n > 1) marquee.flash(n + ' IN THE ROOM', 1800);
    },
    onOpen: () => {
      if (net.mode === 'shared' && store.league) net.identify(store.meId);
    }
  });
  store.onChange(() => {
    if (store.league) render();
  });
}

function startIdleLoop(): void {
  setInterval(() => {
    if (net.mode !== 'shared' || !store.league) return;
    const r = tickSharedIdle(presenceBeats);
    if (!r || !r.ok || !r.idle) return;
    const bits: string[] = [];
    if (r.idle.desks) bits.push(r.idle.desks + ' desk' + (r.idle.desks > 1 ? 's' : ''));
    if (r.idle.picks) bits.push(r.idle.picks + ' pick' + (r.idle.picks > 1 ? 's' : ''));
    if (r.idle.office) bits.push(r.idle.office + ' FO move' + (r.idle.office > 1 ? 's' : ''));
    if (r.idle.week) bits.push('week advanced');
    if (bits.length) toast('Idle GM', bits.join(' · '), 'bulb');
    render();
  }, IDLE_TICK_MS);
}

async function resumeShared(): Promise<void> {
  if (net.mode !== 'shared' || !net.code) return;
  try {
    await net.connect(WS_URL);
    net.send({ t: 'sync', code: net.code, from: store.seq });
    net.identify(store.meId);
  } catch {
    /* solo snapshot still plays offline */
  }
}

function boot(): void {
  initChrome();
  buildTabs();
  initSheet();
  wireGlobal();
  initOnboarding();
  wireNet();
  startIdleLoop();

  if (store.load()) {
    applyTeamColor(store.me.color);
    applyVibe();
    $('#onboard').style.display = 'none';
    $('#app').style.display = 'flex';
    go(store.view);
    marquee.flash('WELCOME BACK', 2400);
    void resumeShared();
  } else {
    $('#app').style.display = 'none';
    OB.start();
  }
}

if (document.readyState !== 'loading') boot();
else document.addEventListener('DOMContentLoaded', boot);
