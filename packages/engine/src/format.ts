import type { Player } from './types.js';

/** Safe #RGB / #RRGGBB for CSS — rejects attribute-breakout payloads. */
export function sanitizeColor(raw: string, fallback = '#888888'): string {
  const s = String(raw || '').trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s;
  return fallback;
}

export function fmtMoney(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1000000) return s + '$' + (a / 1000000).toFixed(a >= 10000000 ? 1 : 2) + 'M';
  if (a >= 1000) return s + '$' + Math.round(a / 1000) + 'K';
  return s + '$' + Math.round(a);
}

export function avg(p: Player): number {
  return p.st.ab ? p.st.h / p.st.ab : 0;
}

export function obp(p: Player): number {
  const d = p.st.ab + p.st.bb;
  return d ? (p.st.h + p.st.bb) / d : 0;
}

export function slg(p: Player): number {
  if (!p.st.ab) return 0;
  const s = p.st.h - p.st.d - p.st.t - p.st.hr;
  return (s + 2 * p.st.d + 3 * p.st.t + 4 * p.st.hr) / p.st.ab;
}

export function era(p: Player): number {
  const ip = p.pst.outs / 3;
  return ip ? (p.pst.er * 9) / ip : 0;
}

export function fmtIP(p: Player): string {
  const o = p.pst.outs;
  return Math.floor(o / 3) + '.' + (o % 3);
}

export function fmt3(x: number): string {
  return (x < 1 ? '.' : x.toFixed(0) + '.') + Math.round((x % 1) * 1000).toString().padStart(3, '0');
}
