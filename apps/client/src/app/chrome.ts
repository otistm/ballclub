/** App chrome: WebGL backdrop, scoreboard marquee, theme color, AP dots. */
import { VIBES, draftStatus, stadiumVal } from '@ballclub/engine';
import { Backdrop, createMarquee, type MarqueeApi } from '../ui/gl.js';
import { g } from '../ui/icons.js';
import { $ } from '../ui/dom.js';
import { M, ord, hexToRgb, readable } from '../ui/format.js';
import { store } from './store.js';

export let backdrop: Backdrop;
export let marquee: MarqueeApi;

export function initChrome(): void {
  backdrop = new Backdrop($('#gl') as HTMLCanvasElement);
  marquee = createMarquee($('#mq') as HTMLCanvasElement);
}

export function applyTeamColor(hex: string): void {
  const r = document.documentElement.style;
  r.setProperty('--team', hex);
  r.setProperty('--team-ink', readable(hex));
  const c = hexToRgb(hex);
  r.setProperty('--team-soft', `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},.16)`);
  if (backdrop && backdrop.ok) backdrop.setTeam(c);
  if (marquee) marquee.colors(null, hex);
}

export function applyVibe(): void {
  const me = store.me;
  if (!backdrop.ok) return;
  backdrop.setVibe(VIBES[me.vibe] || VIBES.NIGHT, hexToRgb(me.color));
  const cap = stadiumVal(me, 'seats', 'cap', 9000);
  const att = me.wk?.att || 0;
  backdrop.setPark({
    lights: me.stadium?.lights || 0,
    board: me.stadium?.board || 0,
    crowd: cap > 0 ? Math.min(1, att / cap) : 0.35
  });
}

function marqueePages(): string[] {
  const L = store.league;
  if (!L) return ['BALLCLUB'];
  const me = store.me;
  const p: string[] = [me.name];
  if (L.phase === 'draft') {
    const st = draftStatus(L, me.id);
    if (!st.cur) {
      p.push('DRAFT COMPLETE');
    } else if (st.mine) {
      p.push('YOUR PICK  ·  ' + st.overall + ' OF ' + st.total);
    } else {
      const club = L.teams.find((t) => t.id === st.cur!.teamId);
      p.push((club ? club.abbr : 'WAIT') + '  ON THE CLOCK');
    }
  } else if (L.phase === 'playoffs') {
    p.push('POSTSEASON');
  } else if (L.phase === 'offseason') {
    p.push('OFFSEASON · YEAR ' + L.season);
  } else {
    p.push('WEEK ' + (L.week + 1) + ' OF ' + L.weeks);
    p.push(me.w + '-' + me.l + '  ' + ord(me.rank));
  }
  p.push(M(me.cash));
  p.push('TRUST ' + Math.round(me.fanTrust));
  if (me.progress) p.push('GM ' + me.progress.level);
  return p;
}

export function refreshChrome(): void {
  if (!store.league) return;
  const L = store.league;
  const me = store.me;
  $('#crest').innerHTML = g(me.glyph);
  marquee.set(marqueePages());
  const dots: string[] = [];
  for (let i = 0; i < me.apMax; i++) dots.push('<i class="ap-dot' + (i < me.ap ? ' on' : '') + '"></i>');
  $('#apdots').innerHTML = dots.join('');
  $('#aplab').textContent = L.phase === 'draft' ? 'scout · ' + me.ap : me.ap + ' left';
}
