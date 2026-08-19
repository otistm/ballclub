/** Six-step onboarding: name, background, color wheel, vibe, paperwork. */
import {
  CITIES, CLASSES, CLASS_LIST, GLYPHS, MASCOTS, ROSTER_MAX, VIBES,
  hueColor, makeInviteCode, sanitizeColor
} from '@ballclub/engine';
import anime from '../ui/motion.js';
import { $, esc } from '../ui/dom.js';
import { haptic } from '../ui/ux.js';
import { g, ic, mark } from '../ui/icons.js';
import { M, hexToRgb } from '../ui/format.js';
import { vibeSwatch } from '../ui/gl.js';
import { backdrop, applyTeamColor } from './chrome.js';
import { store, WS_URL } from './store.js';
import { net } from './net.js';
import { enterGame } from './game.js';
import { type HumanConfig } from '@ballclub/engine';

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
  signed: false,
  clearSig: null as null | (() => void),
  mode: 'solo' as 'solo' | 'host' | 'join',
  joinCode: '' as string,
  claimId: '' as string,
  draft: {
    city: '', mascot: '', name: '', color: '#3BA7D6', glyph: 'compass', cls: 'ANALYST', vibe: 'NIGHT', hue: 197
  } as ObDraft,

  start(): void {
    const d = OB.draft;
    const r = Math.random;
    d.city = CITIES[Math.floor(r() * CITIES.length)];
    d.mascot = MASCOTS[Math.floor(r() * MASCOTS.length)];
    d.name = d.city + ' ' + d.mascot;
    d.hue = Math.floor(r() * 360);
    d.color = hueColor(d.hue);
    d.glyph = CLASSES[d.cls].glyph;
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
      body = `<div class="hero-wrap">
        <div class="hero-card">
          <div class="hero-title" id="hero">BALL<br>CLUB</div>
          <div class="hero-sub">a shared-world franchise sim</div>
          <p class="hero-blurb">
            You are not the manager. You are the whole front office — the draft board, the payroll, the concession margins,
            the man who decides whether the tarp crew gets overtime.</p>
          <p class="hero-note">Eight clubs. One league. Eighteen weeks a season.</p>
        </div>
      </div>`;
      foot = `<button class="btn primary" data-ob="next">Play solo</button>
        <button class="btn ghost" data-ob="host" style="margin-top:8px">Host league</button>
        <button class="btn ghost" data-ob="joinprompt" style="margin-top:8px">Join league</button>`;
    }

    if (OB.step === -1) {
      top = '';
      body = `<div class="eyebrow">Join <b>shared league</b></div>
        <h1>Enter the code</h1>
        <p class="dim" style="margin:10px 0 18px">Six letters from the host's paperwork.</p>
        <div class="field"><div style="flex:1"><div class="lb">Invite code</div>
          <input id="objoin" value="${esc(OB.joinCode)}" maxlength="6" autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.2em;font-family:var(--mono)"></div></div>
        <p class="faint" id="objoinerr" style="margin-top:10px;min-height:1.2em"></p>`;
      foot = '<button class="btn ghost" data-ob="joinsplash">Back</button><button class="btn primary" data-ob="joingo">Find the league</button>';
    }

    if (OB.step === -2) {
      const seats = (store.league?.teams || []).filter((t) => !t.isHuman);
      body = `<div class="eyebrow">Open seats <b>${seats.length} left</b></div>
        <h1>Pick a club</h1>
        <p class="dim" style="margin:10px 0 14px">You inherit their roster and take the job. Your name goes on the door.</p>
        <div class="panel">` +
        seats.map((t) =>
          `<button class="classcard${OB.claimId === t.id ? ' on' : ''}" data-ob="claim" data-k="${t.id}" style="width:100%;text-align:left;margin-bottom:8px">
            <div class="cc-top"><div class="cc-ic" style="background:${sanitizeColor(t.color)}">${mark(t.glyph, t.color)}</div>
            <div style="flex:1"><div class="cc-tag">${esc(t.cls)}</div><h3 style="margin-top:2px">${esc(t.name)}</h3>
            <div class="faint" style="font-size:12px">${t.w}-${t.l} · ${esc(t.city)}</div></div></div></button>`
        ).join('') + `</div>`;
      foot = '<button class="btn ghost" data-ob="joinsplash">Back</button><button class="btn primary" data-ob="claimgo"' +
        (OB.claimId ? '' : ' disabled') + '>Take this job</button>';
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
      body = `<div class="eyebrow">Step two <b>your background</b></div>
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
            <div class="perks">${c.perks.map((p) => `<div class="perk"><i></i><span>${esc(p)}</span></div>`).join('')}</div>
          </button>`;
        }).join('')}`;
      foot = '<button class="btn ghost" data-ob="back">Back</button><button class="btn primary" data-ob="next">Next</button>';
    }

    if (OB.step === 3) {
      body = `<div class="eyebrow">Step three <b>the colors</b></div>
        <h1>Pick a color</h1>
        <div id="wheelwrap">
          <canvas id="wheel" width="500" height="500" style="width:250px;height:250px"></canvas>
          <div id="wheelcrest">${g(d.glyph)}</div>
        </div>
        <div class="eyebrow">The badge</div>
        <div class="glyphgrid">${GLYPHS.map((k) => `<button class="gcell${k === d.glyph ? ' on' : ''}" data-ob="glyph" data-k="${k}">${g(k)}</button>`).join('')}</div>`;
      foot = '<button class="btn ghost" data-ob="back">Back</button><button class="btn primary" data-ob="next">Next</button>';
    }

    if (OB.step === 4) {
      body = `<div class="eyebrow">Step four <b>the look</b></div>
        <h1>Set the mood</h1>
        <p class="dim" style="margin:10px 0 18px">Lighting for the whole app. Change it any time from the park.</p>
        <div class="vibegrid vibelist">${Object.keys(VIBES).map((k) => {
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
          <div class="charter-club">
            ${mark(d.glyph, d.color)}
            <div class="charter-name">${esc(d.name).toUpperCase()}</div>
          </div>
          <div class="hairline"></div>
          <div class="kv"><span class="k">General manager</span><b>${esc(c.name)}</b></div>
          <div class="kv"><span class="k">Opening cash</span><b>${M(c.cash)}</b></div>
          <div class="kv"><span class="k">Fan trust</span><b>${c.fanTrust}</b></div>
          <div class="kv"><span class="k">Roster limit</span><b>${ROSTER_MAX}</b></div>
          <div class="kv"><span class="k">Season</span><b>18 weeks · 54 games</b></div>
          <div class="hairline"></div>
          <div style="font-size:13.5px;color:#4b4838;line-height:1.45;margin-bottom:14px">
            The draft opens the moment you sign. Twelve rounds, snake order, seven rivals picking against you.
          </div>
          <div class="sigwrap">
            <div class="mq-lab" style="color:#6b6248">General manager</div>
            <div class="sigpad">
              <div class="sigbase" aria-hidden="true"><b>X</b><i></i></div>
              <canvas id="sig"></canvas>
            </div>
            <button type="button" class="sigclear" data-ob="sigclear">Clear</button>
          </div>
        </div>
        <div id="codebar"><div style="flex:1"><div class="mq-lab">League code</div><div class="c" id="obcode">------</div></div>
          <div class="faint" style="font-size:12px;max-width:11em;text-align:right">Friends join this league later with this code</div></div>`;
      foot = '<button class="btn ghost" data-ob="back">Back</button><button class="btn bulb" data-ob="create" disabled>Open the draft</button>';
    }

    $('#onboard').classList.toggle('splash', OB.step === 0);
    $('#onboard').classList.toggle('mood', OB.step === 4);
    $('#onboard').innerHTML = `<div id="obtop">${top}</div><div id="obbody">${body}</div><div id="obfoot">${foot}</div>`;

    if (OB.step === 0) {
      anime({ targets: '#hero', opacity: [0, 1], translateY: [26, 0], duration: 900, easing: 'easeOutExpo' });
      anime({ targets: '.hero-sub, .hero-blurb, .hero-note', opacity: [0, 1], translateY: [14, 0], delay: anime.stagger(110, { start: 260 }), duration: 600 });
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
    if (OB.step === 3) OB.wheel();
    if (OB.step === 4) {
      requestAnimationFrame(() => {
        document.querySelectorAll<HTMLCanvasElement>('.vsw').forEach((cv) => {
          vibeSwatch(cv, VIBES[cv.dataset.v!], hexToRgb(d.color));
        });
      });
    }
    if (OB.step === 5) {
      OB.code = OB.code || makeInviteCode();
      $('#obcode').textContent = OB.code;
      requestAnimationFrame(() => OB.sig());
    }
  },

  wheel(): void {
    const cv = $('#wheel') as HTMLCanvasElement;
    const c = cv.getContext('2d')!;
    const R = 250, cx = 250, cy = 250, inner = 150;
    /** Canvas 0° is 3 o'clock; put hue 0 (red) at 12 o'clock, clockwise. */
    const hueAng = (h: number): number => ((h - 90) * Math.PI) / 180;
    function paint(): void {
      c.clearRect(0, 0, 500, 500);
      for (let a = 0; a < 360; a++) {
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, R - 6, hueAng(a - 0.6), hueAng(a + 1.2));
        c.closePath();
        c.fillStyle = hueColor(a);
        c.fill();
      }
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      c.arc(cx, cy, inner, 0, 6.2832);
      c.fill();
      c.globalCompositeOperation = 'source-over';
      const ang = hueAng(OB.draft.hue);
      const kx = cx + Math.cos(ang) * (R - 34), ky = cy + Math.sin(ang) * (R - 34);
      c.beginPath();
      c.arc(kx, ky, 24, 0, 6.2832);
      c.fillStyle = OB.draft.color;
      c.fill();
      c.lineWidth = 7;
      c.strokeStyle = '#E9EEE7';
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

  sig(): void {
    const cv = $('#sig') as HTMLCanvasElement | null;
    const pad = cv && cv.parentElement;
    if (!cv || !pad) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, pad.clientWidth);
    const h = Math.max(1, pad.clientHeight);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);

    const inkColor = '#1A1814';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.4;

    let drawing = false;
    let lx = 0;
    let ly = 0;
    let ink = 0;
    OB.signed = false;
    const btn = document.querySelector<HTMLButtonElement>('[data-ob="create"]');
    if (btn) btn.disabled = true;

    const pt = (e: PointerEvent): { x: number; y: number } => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      drawing = true;
      const p = pt(e);
      lx = p.x;
      ly = p.y;
      ctx.lineWidth = 1.7 + (e.pressure || 0.5) * 1.6;
      ctx.beginPath();
      ctx.fillStyle = inkColor;
      ctx.arc(lx, ly, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      e.preventDefault();
      const p = pt(e);
      ctx.lineWidth = 1.7 + (e.pressure || 0.5) * 1.6;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ink += Math.hypot(p.x - lx, p.y - ly);
      lx = p.x;
      ly = p.y;
      if (ink > 28 && !OB.signed) {
        OB.signed = true;
        if (btn) btn.disabled = false;
      }
    });
    const stop = (): void => { drawing = false; };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);

    OB.clearSig = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ink = 0;
      OB.signed = false;
      if (btn) btn.disabled = true;
    };
  },

  act(what: string, data: DOMStringMap): void {
    const d = OB.draft;
    const r = Math.random;
    if (what === 'next') {
      if (OB.step === 0) OB.mode = 'solo';
      OB.step++;
      haptic.tap();
      OB.render();
    } else if (what === 'host') {
      OB.mode = 'host';
      OB.step = 1;
      haptic.tap();
      OB.render();
    } else if (what === 'joinprompt') {
      OB.mode = 'join';
      OB.step = -1;
      haptic.tap();
      OB.render();
    } else if (what === 'joinsplash') {
      OB.step = 0;
      OB.mode = 'solo';
      haptic.tap();
      OB.render();
    } else if (what === 'joingo') {
      const inp = $('#objoin') as HTMLInputElement | null;
      OB.joinCode = (inp?.value || OB.joinCode || '').trim().toUpperCase();
      OB.joinLeague();
    } else if (what === 'claim') {
      OB.claimId = data.k || '';
      haptic.select();
      OB.render();
    } else if (what === 'claimgo') {
      OB.finishClaim();
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
      d.glyph = CLASSES[d.cls].glyph;
      haptic.select();
      document.querySelectorAll<HTMLElement>('.classcard').forEach((el) => {
        el.classList.toggle('on', el.dataset.k === d.cls);
      });
    } else if (what === 'sigclear') {
      haptic.tap();
      if (OB.clearSig) OB.clearSig();
    } else if (what === 'vibe') {
      d.vibe = data.k!;
      haptic.tap();
      document.querySelectorAll<HTMLElement>('.vcell').forEach((el) => el.classList.toggle('on', el.dataset.k === d.vibe));
      if (backdrop.ok) backdrop.setVibe(VIBES[d.vibe], hexToRgb(d.color));
    } else if (what === 'create') {
      OB.create();
    }
  },

  humanFromDraft(): HumanConfig {
    const d = OB.draft;
    return {
      name: d.name, city: d.city, mascot: d.mascot,
      cls: d.cls, color: d.color, glyph: d.glyph, vibe: d.vibe
    };
  },

  async create(): Promise<void> {
    if (!OB.signed) {
      haptic.warn();
      return;
    }
    const human = OB.humanFromDraft();
    const seed = Math.floor(Math.random() * 1e9);
    haptic.ok();

    if (OB.mode === 'host') {
      try {
        await net.connect(WS_URL);
        const { code } = await net.createRoom(seed, human);
        store.newLeague(seed, human, code);
        net.mode = 'shared';
        net.code = code;
        store.code = code;
        store.dispatch({ t: 'advanceDraft' });
        applyTeamColor(store.me.color);
        if (backdrop.ok) backdrop.setVibe(VIBES[store.me.vibe], hexToRgb(store.me.color));
        net.identify(store.meId);
        enterGame();
        return;
      } catch (e) {
        console.warn(e);
        haptic.warn();
        // fall back to solo so the player is not stuck
      }
    }

    const code = OB.code || makeInviteCode();
    store.newLeague(seed, human, code);
    net.mode = 'solo';
    net.code = code;
    applyTeamColor(store.me.color);
    if (backdrop.ok) backdrop.setVibe(VIBES[store.me.vibe], hexToRgb(store.me.color));
    store.dispatch({ t: 'advanceDraft' });
    enterGame();
  },

  async joinLeague(): Promise<void> {
    const errEl = $('#objoinerr');
    if (errEl) errEl.textContent = '';
    if (!/^[ACDEFGHJKLMNPQRTUVWXY349]{6}$/.test(OB.joinCode)) {
      if (errEl) errEl.textContent = 'That is not a league code.';
      haptic.warn();
      return;
    }
    try {
      await net.connect(WS_URL);
      const joined = await net.joinRoom(OB.joinCode, 'guest');
      store.loadFromReplay(joined.seed, joined.human, joined.log, joined.code);
      net.mode = 'shared';
      net.code = joined.code;
      store.code = joined.code;
      OB.claimId = store.league!.teams.find((t) => !t.isHuman)?.id || '';
      OB.step = -2;
      haptic.ok();
      OB.render();
    } catch (e) {
      haptic.warn();
      if (errEl) errEl.textContent = e instanceof Error ? e.message : 'Could not join';
    }
  },

  finishClaim(): void {
    if (!OB.claimId || !store.league) return;
    const d = OB.draft;
    const seat = store.league.teams.find((t) => t.id === OB.claimId);
    if (seat) {
      d.city = seat.city;
      d.mascot = seat.mascot;
      d.name = d.name && d.name !== (d.city + ' ' + d.mascot) ? d.name : seat.name;
      if (!CLASSES[d.cls]) d.cls = seat.cls;
      d.color = d.color || seat.color;
      d.glyph = d.glyph || seat.glyph;
      d.vibe = d.vibe || seat.vibe || 'NIGHT';
      // claim uses joiner's chosen class/color from draft when they went through splash only —
      // refresh from seat for identity, keep class if they somehow set it
      d.cls = seat.cls;
      d.color = seat.color;
      d.glyph = seat.glyph;
      d.vibe = seat.vibe || 'NIGHT';
      d.name = seat.city + ' ' + seat.mascot;
      d.city = seat.city;
      d.mascot = seat.mascot;
    }
    const human = OB.humanFromDraft();
    const ownerId = 'p' + Math.floor(Math.random() * 1e6);
    const r = store.dispatch({
      t: 'claimTeam',
      teamId: OB.claimId,
      human,
      ownerId
    });
    if (!r.ok) {
      haptic.warn();
      return;
    }
    store.meId = OB.claimId;
    store.human = human;
    applyTeamColor(store.me.color);
    if (backdrop.ok) backdrop.setVibe(VIBES[store.me.vibe], hexToRgb(store.me.color));
    net.identify(store.meId);
    store.save();
    haptic.ok();
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
