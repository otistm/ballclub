/** Six-step onboarding: name, colour wheel, background, vibe, paperwork. */
import {
  CITIES, CLASSES, CLASS_LIST, GLYPHS, MASCOTS, ROSTER_MAX, VIBES,
  hueColor, makeInviteCode
} from '@ballclub/engine';
import anime from '../ui/motion.js';
import { $, esc } from '../ui/dom.js';
import { haptic } from '../ui/ux.js';
import { g, ic } from '../ui/icons.js';
import { M, hexToRgb } from '../ui/format.js';
import { vibeSwatch } from '../ui/gl.js';
import { backdrop, applyTeamColor } from './chrome.js';
import { store } from './store.js';
import { net } from './net.js';
import { enterGame } from './game.js';

interface ObDraft {
  city: string;
  mascot: string;
  name: string;
  color: string;
  glyph: string;
  cls: string;
  vibe: string;
  hue: number;
}

export const OB = {
  step: 0,
  total: 6,
  code: '' as string,
  draft: {
    city: '', mascot: '', name: '', color: '#3BA7D6', glyph: 'anvil', cls: 'ANALYST', vibe: 'NIGHT', hue: 197
  } as ObDraft,

  start(): void {
    const d = OB.draft;
    const r = Math.random;
    d.city = CITIES[Math.floor(r() * CITIES.length)];
    d.mascot = MASCOTS[Math.floor(r() * MASCOTS.length)];
    d.name = d.city + ' ' + d.mascot;
    d.hue = Math.floor(r() * 360);
    d.color = hueColor(d.hue);
    applyTeamColor(d.color);
    OB.render();
  },

  render(): void {
    const d = OB.draft;
    const steps: string[] = [];
    for (let i = 0; i < OB.total; i++) steps.push('<i class="' + (i === OB.step ? 'on' : i < OB.step ? 'done' : '') + '"></i>');
    let body = '', foot = '', top = '<div id="obsteps">' + steps.join('') + '</div>';

    if (OB.step === 0) {
      top = '';
      body = `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding-bottom:40px">
        <div class="hero-title" id="hero">BALL<br>CLUB</div>
        <div class="hero-sub">a shared-world franchise sim</div>
        <p class="dim" style="margin-top:22px;font-size:16px;line-height:1.5;max-width:19em">
          You are not the manager. You are the whole front office — the draft board, the payroll, the concession margins,
          the man who decides whether the tarp crew gets overtime.</p>
        <p class="faint" style="margin-top:14px;font-size:14px">Eight clubs. One league. Eighteen weeks a season.</p>
      </div>`;
      foot = '<button class="btn primary" data-ob="next">Take the job</button>';
    }

    if (OB.step === 1) {
      body = `<div class="eyebrow">Step one <b>the club</b></div>
        <h1>Name it</h1>
        <p class="dim" style="margin:10px 0 20px">The city stays on the jersey long after you are gone.</p>
        <div class="field"><div style="flex:1"><div class="lb">City</div>
          <input id="obcity" value="${esc(d.city)}" maxlength="18" autocomplete="off" spellcheck="false"></div>
          <button class="dice" data-ob="rollcity">${ic('dice')}</button></div>
        <div class="field"><div style="flex:1"><div class="lb">Mascot</div>
          <input id="obmascot" value="${esc(d.mascot)}" maxlength="18" autocomplete="off" spellcheck="false"></div>
          <button class="dice" data-ob="rollmascot">${ic('dice')}</button></div>
        <div class="panel" style="margin-top:16px;text-align:center">
          <div class="eyebrow" style="justify-content:center">On the marquee</div>
          <div style="font-family:var(--dsp);font-size:27px;color:var(--team);line-height:1.05" id="obpreview">${esc(d.city + ' ' + d.mascot).toUpperCase()}</div>
        </div>`;
      foot = '<button class="btn ghost" data-ob="back">Back</button><button class="btn primary" data-ob="next">Next</button>';
    }

    if (OB.step === 2) {
      body = `<div class="eyebrow">Step two <b>the colours</b></div>
        <h1>Pick a colour</h1>
        <p class="dim" style="margin:10px 0 4px">Drag the ring. Everything in the app takes this colour.</p>
        <div id="wheelwrap">
          <canvas id="wheel" width="500" height="500" style="width:250px;height:250px"></canvas>
          <div id="wheelcrest">${g(d.glyph)}</div>
        </div>
        <div class="eyebrow">The badge</div>
        <div class="glyphgrid">${GLYPHS.map((k) => `<button class="gcell${k === d.glyph ? ' on' : ''}" data-ob="glyph" data-k="${k}">${g(k)}</button>`).join('')}</div>`;
      foot = '<button class="btn ghost" data-ob="back">Back</button><button class="btn primary" data-ob="next">Next</button>';
    }

    if (OB.step === 3) {
      body = `<div class="eyebrow">Step three <b>your background</b></div>
        <h1>Where you<br>came from</h1>
        <p class="dim" style="margin:10px 0 18px">This sets your staff, your starting six, and how the club plays before you touch a thing.</p>
        ${CLASS_LIST.map((k) => {
          const c = CLASSES[k];
          return `<button class="classcard${k === d.cls ? ' on' : ''}" data-ob="cls" data-k="${k}" style="width:100%;text-align:left">
            <div class="cc-top">
              <div class="cc-ic">${g(c.glyph)}</div>
              <div style="flex:1">
                <div class="cc-tag">${esc(c.tag)}</div>
                <h3 style="margin-top:2px">${esc(c.name)}</h3>
              </div>
            </div>
            <p class="cc-bl">${esc(c.blurb)}</p>
            ${k === d.cls ? c.perks.map((p) => `<div class="perk"><i></i><span>${esc(p)}</span></div>`).join('') : ''}
          </button>`;
        }).join('')}`;
      foot = '<button class="btn ghost" data-ob="back">Back</button><button class="btn primary" data-ob="next">Next</button>';
    }

    if (OB.step === 4) {
      body = `<div class="eyebrow">Step four <b>the look</b></div>
        <h1>Set the mood</h1>
        <p class="dim" style="margin:10px 0 18px">Lighting for the whole app. Change it any time from the park.</p>
        <div class="vibegrid">${Object.keys(VIBES).map((k) => {
          const v = VIBES[k];
          return `<button class="vcell${k === d.vibe ? ' on' : ''}" data-ob="vibe" data-k="${k}">
            <canvas class="vsw" data-v="${k}" width="200" height="140"></canvas>
            <div class="lb">${esc(v.name)}</div></button>`;
        }).join('')}</div>`;
      foot = '<button class="btn ghost" data-ob="back">Back</button><button class="btn primary" data-ob="next">Next</button>';
    }

    if (OB.step === 5) {
      const c = CLASSES[d.cls];
      body = `<div class="eyebrow">Step five <b>sign here</b></div>
        <h1>The paperwork</h1>
        <div class="panel paper" style="margin-top:16px">
          <div class="eyebrow">Club charter</div>
          <div style="font-family:var(--dsp);font-size:29px;line-height:1;margin-bottom:12px">${esc(d.name).toUpperCase()}</div>
          <div class="hairline"></div>
          <div class="kv"><span class="k">General manager</span><b>${esc(c.name)}</b></div>
          <div class="kv"><span class="k">Opening cash</span><b>${M(c.cash)}</b></div>
          <div class="kv"><span class="k">Fan trust</span><b>${c.fanTrust}</b></div>
          <div class="kv"><span class="k">Roster limit</span><b>${ROSTER_MAX}</b></div>
          <div class="kv"><span class="k">Season</span><b>18 weeks · 54 games</b></div>
          <div class="hairline"></div>
          <div style="font-size:13.5px;color:#4b4838;line-height:1.45">
            The draft opens the moment you sign. Twelve rounds, snake order, seven rivals picking against you.
          </div>
        </div>
        <div id="codebar"><div style="flex:1"><div class="mq-lab">League code</div><div class="c" id="obcode">------</div></div>
          <div class="faint" style="font-size:12px;max-width:11em;text-align:right">Friends join this league later with this code</div></div>`;
      foot = '<button class="btn ghost" data-ob="back">Back</button><button class="btn bulb" data-ob="create">Open the draft</button>';
    }

    $('#onboard').innerHTML = `<div id="obtop">${top}</div><div id="obbody">${body}</div><div id="obfoot">${foot}</div>`;

    if (OB.step === 0) {
      anime({ targets: '#hero', opacity: [0, 1], translateY: [26, 0], duration: 900, easing: 'easeOutExpo' });
      anime({ targets: '.hero-sub, #obbody p', opacity: [0, 1], translateY: [14, 0], delay: anime.stagger(110, { start: 260 }), duration: 600 });
    } else {
      anime({ targets: '#obbody > *', opacity: [0, 1], translateY: [16, 0], delay: anime.stagger(45), duration: 420, easing: 'easeOutQuad' });
    }
    if (OB.step === 1) {
      const up = (): void => {
        d.city = ($('#obcity') as HTMLInputElement).value || 'Ashland';
        d.mascot = ($('#obmascot') as HTMLInputElement).value || 'Wolves';
        d.name = d.city + ' ' + d.mascot;
        $('#obpreview').textContent = d.name.toUpperCase();
      };
      $('#obcity').addEventListener('input', up);
      $('#obmascot').addEventListener('input', up);
    }
    if (OB.step === 2) OB.wheel();
    if (OB.step === 4) {
      document.querySelectorAll<HTMLCanvasElement>('.vsw').forEach((cv) => {
        vibeSwatch(cv, VIBES[cv.dataset.v!], hexToRgb(d.color));
      });
    }
    if (OB.step === 5) {
      OB.code = OB.code || makeInviteCode();
      $('#obcode').textContent = OB.code;
    }
  },

  wheel(): void {
    const cv = $('#wheel') as HTMLCanvasElement;
    const c = cv.getContext('2d')!;
    const R = 250, cx = 250, cy = 250, inner = 150;
    function paint(): void {
      c.clearRect(0, 0, 500, 500);
      for (let a = 0; a < 360; a++) {
        const s = ((a - 0.6) * Math.PI) / 180, e = ((a + 1.2) * Math.PI) / 180;
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, R - 6, s, e);
        c.closePath();
        c.fillStyle = hueColor(a);
        c.fill();
      }
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      c.arc(cx, cy, inner, 0, 6.2832);
      c.fill();
      c.globalCompositeOperation = 'source-over';
      const ang = ((OB.draft.hue - 90) * Math.PI) / 180;
      const kx = cx + Math.cos(ang) * (R - 34), ky = cy + Math.sin(ang) * (R - 34);
      c.beginPath();
      c.arc(kx, ky, 24, 0, 6.2832);
      c.fillStyle = '#E9EEE7';
      c.fill();
      c.lineWidth = 7;
      c.strokeStyle = OB.draft.color;
      c.stroke();
    }
    paint();
    function fromXY(x: number, y: number): void {
      const rect = cv.getBoundingClientRect();
      const px = ((x - rect.left) / rect.width) * 500 - cx;
      const py = ((y - rect.top) / rect.height) * 500 - cy;
      let a = (Math.atan2(py, px) * 180) / Math.PI + 90;
      if (a < 0) a += 360;
      OB.draft.hue = Math.round(a % 360);
      OB.draft.color = hueColor(OB.draft.hue);
      applyTeamColor(OB.draft.color);
      paint();
    }
    let lastBuzz = 0;
    const handler = (e: TouchEvent | MouseEvent): void => {
      const p = 'touches' in e ? e.touches[0] : e;
      fromXY(p.clientX, p.clientY);
      const now = performance.now();
      if (now - lastBuzz > 60) {
        haptic.light();
        lastBuzz = now;
      }
    };
    cv.addEventListener('touchstart', handler, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      handler(e);
    }, { passive: false });
    cv.addEventListener('mousedown', (e) => {
      handler(e);
      const mm = (ev: MouseEvent) => handler(ev);
      const mu = (): void => {
        window.removeEventListener('mousemove', mm);
        window.removeEventListener('mouseup', mu);
      };
      window.addEventListener('mousemove', mm);
      window.addEventListener('mouseup', mu);
    });
  },

  act(what: string, data: DOMStringMap): void {
    const d = OB.draft;
    const r = Math.random;
    if (what === 'next') {
      OB.step++;
      haptic.tap();
      OB.render();
    } else if (what === 'back') {
      OB.step--;
      haptic.tap();
      OB.render();
    } else if (what === 'rollcity') {
      d.city = CITIES[Math.floor(r() * CITIES.length)];
      ($('#obcity') as HTMLInputElement).value = d.city;
      d.name = d.city + ' ' + d.mascot;
      $('#obpreview').textContent = d.name.toUpperCase();
      haptic.select();
    } else if (what === 'rollmascot') {
      d.mascot = MASCOTS[Math.floor(r() * MASCOTS.length)];
      ($('#obmascot') as HTMLInputElement).value = d.mascot;
      d.name = d.city + ' ' + d.mascot;
      $('#obpreview').textContent = d.name.toUpperCase();
      haptic.select();
    } else if (what === 'glyph') {
      d.glyph = data.k!;
      haptic.tap();
      document.querySelectorAll<HTMLElement>('.gcell').forEach((el) => el.classList.toggle('on', el.dataset.k === d.glyph));
      $('#wheelcrest').innerHTML = g(d.glyph);
      anime({ targets: '#wheelcrest', scale: [0.82, 1], duration: 460, easing: 'easeOutElastic' });
    } else if (what === 'cls') {
      d.cls = data.k!;
      haptic.select();
      OB.render();
    } else if (what === 'vibe') {
      d.vibe = data.k!;
      haptic.tap();
      document.querySelectorAll<HTMLElement>('.vcell').forEach((el) => el.classList.toggle('on', el.dataset.k === d.vibe));
      if (backdrop.ok) backdrop.setVibe(VIBES[d.vibe], hexToRgb(d.color));
    } else if (what === 'create') {
      OB.create();
    }
  },

  create(): void {
    const d = OB.draft;
    haptic.ok();
    const code = OB.code || makeInviteCode();
    store.newLeague(Math.floor(Math.random() * 1e9), {
      name: d.name, city: d.city, mascot: d.mascot,
      cls: d.cls, color: d.color, glyph: d.glyph, vibe: d.vibe
    }, code);
    net.mode = 'solo';
    net.code = code;
    const me = store.me;
    applyTeamColor(me.color);
    if (backdrop.ok) backdrop.setVibe(VIBES[me.vibe], hexToRgb(me.color));
    /* run AI picks up to the human's first turn — logged so replays match */
    store.dispatch({ t: 'advanceDraft' });
    enterGame();
  }
};

/** Hook onboarding into the global click delegation from game.ts. */
export function initOnboarding(): void {
  document.addEventListener('bc:ob', (e) => {
    const det = (e as CustomEvent<{ what: string; data: DOMStringMap }>).detail;
    OB.act(det.what, det.data);
  });
}
