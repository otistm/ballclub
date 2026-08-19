/** Client-side formatting and theming helpers. */
import { fmtMoney, sanitizeColor } from '@ballclub/engine';

export const M = fmtMoney;

/** Safe color for inline style attributes. */
export function cssColor(raw: string, fallback = '#888888'): string {
  return sanitizeColor(raw, fallback);
}

/** .xxx / 1.000 batting-average style formatting. */
export const pctS = (x: number): string =>
  (x < 1 ? '.' : '1.') + Math.round(Math.abs(x % 1) * 1000).toString().padStart(3, '0');

export function ord(n: number): string {
  return (
    n +
    ((['TH', 'ST', 'ND', 'RD'] as const)[
      Number(n % 100 - (n % 10) !== 10) * Number(n % 10 < 4) * (n % 10)
    ] || 'TH')
  );
}

export function hexToRgb(h: string): number[] {
  const m = h.replace('#', '');
  return [
    parseInt(m.substr(0, 2), 16) / 255,
    parseInt(m.substr(2, 2), 16) / 255,
    parseInt(m.substr(4, 2), 16) / 255
  ];
}

export function readable(hex: string): string {
  const r = hexToRgb(hex);
  const lum = 0.299 * r[0] + 0.587 * r[1] + 0.114 * r[2];
  return lum > 0.55 ? '#0A100E' : '#F2F6F0';
}
