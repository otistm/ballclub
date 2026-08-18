/** Boot: chrome, tabs, sheet, global wiring, then load a save or onboard. */
import './styles.css';
import { $, initSheet } from './ui/dom.js';
import { initChrome, applyTeamColor, applyVibe, marquee } from './app/chrome.js';
import { store } from './app/store.js';
import { buildTabs, go, wireGlobal } from './app/game.js';
import { OB, initOnboarding } from './app/onboard.js';

function boot(): void {
  initChrome();
  buildTabs();
  initSheet();
  wireGlobal();
  initOnboarding();

  if (store.load()) {
    applyTeamColor(store.me.color);
    applyVibe();
    $('#onboard').style.display = 'none';
    $('#app').style.display = 'flex';
    go(store.view);
    marquee.flash('WELCOME BACK', 2400);
  } else {
    $('#app').style.display = 'none';
    OB.start();
  }
}

if (document.readyState !== 'loading') boot();
else document.addEventListener('DOMContentLoaded', boot);
