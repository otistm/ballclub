/** Team badge art (full-color PNGs) and stroked UI icons. */
import { sanitizeColor } from '@ballclub/engine';

/** Canonical files in /badges. Old glyph names alias to the closest new mark. */
const GLYPH_FILE: Record<string, string> = {
  star: 'star', trophy: 'trophy', ball: 'ball', cap: 'cap', compass: 'compass',
  bomb: 'bomb', crown: 'crown', comet: 'comet', bolt: 'bolt', vortex: 'vortex',
  skull: 'skull', wolf: 'wolf', anchor: 'anchor', bear: 'bear', volcano: 'volcano',
  shark: 'shark', dragon: 'dragon', bull: 'bull', eagle: 'eagle', panther: 'panther',
  anvil: 'bomb', lark: 'eagle', gear: 'vortex', flame: 'volcano', lion: 'bear',
  sprout: 'ball', megaphone: 'star', sigma: 'compass', handshake: 'trophy',
  moth: 'dragon', key: 'cap', shield: 'star', axe: 'bomb'
};

export function glyphFile(k: string): string {
  return GLYPH_FILE[k] || 'star';
}

/** Full-color badge art. Sit this inside a team-color circle. */
export const g = (k: string): string =>
  '<img class="glyph-art" src="/badges/' + glyphFile(k) + '.png" alt="" draggable="false">';

/** Badge on a colored circle — use when the parent is not already the crest. */
export const mark = (k: string, color: string): string =>
  '<span class="mark" style="background:' + sanitizeColor(color) + '">' + g(k) + '</span>';

export const ICON: Record<string, string> = {
  club: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.6V20h14V9.6"/><path d="M9.5 20v-5h5v5"/>',
  roster: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M16 5.5a3 3 0 010 5.6M17.5 20c0-2.4-.8-4.3-2-5.5"/>',
  market: '<path d="M3 7l4-3 5 2.6L17 4l4 3-4 4.5"/><path d="M3 7l4.5 5"/><path d="M7.5 12l3 3 2-1.6 2 1.6 2-1.6 2.5 2"/><path d="M6 17l3 3 2.5-2"/>',
  park: '<path d="M2 16a10 7 0 0120 0"/><path d="M2 16v4h20v-4"/><path d="M6 8V5M6 5l3 1.4M18 8V5M18 5l-3 1.4"/><path d="M12 20v-6"/>',
  league: '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3"/><path d="M10 14h4l.7 3H9.3z"/><path d="M7 20h10"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3"/><path d="M10 14h4l.7 3H9.3z"/><path d="M7 20h10"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>',
  seats: '<path d="M3 19v-6a3 3 0 013-3h12a3 3 0 013 3v6"/><path d="M3 19h18M6 10V6h12v4"/><path d="M9 19v-4M15 19v-4"/>',
  lights: '<path d="M12 21v-6"/><path d="M6 9h12l-1 6H7z"/><path d="M8 9V6h8v3"/><path d="M4 3l2 2M20 3l-2 2M12 2v2"/>',
  food: '<path d="M4 20h16"/><path d="M4 16a8 8 0 0116 0z"/><path d="M8 10V4M11 10V4M8 7h3"/><path d="M16 10V4c1.6 0 2.6 1.2 2.6 3S17.6 10 16 10z"/>',
  board: '<rect x="2.5" y="4" width="19" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/><path d="M6 8h4M6 11h6M15 8h3M15 11h3"/>',
  clubhouse: '<path d="M3 20V9l9-5 9 5v11"/><path d="M8 20v-6h8v6"/><path d="M10.5 11h3"/>',
  academy: '<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M6 10v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5"/><path d="M21 7.5V13"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4"/><path d="M8 12h8M8 16h6"/>',
  desk: '<rect x="3" y="7" width="18" height="11" rx="1.5"/><path d="M8 7V5h8v2M7 18v3M17 18v3"/>',
  star: '<path d="M12 3l2.4 6.6H21l-5.2 4 2 6.4L12 16.5 6.2 20l2-6.4L3 9.6h6.6z"/>',
  bolt: '<path d="M13 2L4 14h7l-2 8 11-14h-7z"/>',
  handshake: '<path d="M3 12l4-4 3 3 2-1.5 2 1.5 3-3 4 4-4.5 6.5-2.5-2-2 1.2-2-1.2-2.5 2z"/>',
  flame: '<path d="M12 3c2.4 3.6 5.2 5.2 5.2 8.8A5.2 5.2 0 0112 21a5.2 5.2 0 01-5.2-9.2C8 10.8 8.8 9.6 9.8 8.6c0 1.8.8 2.8 1.6 2.8C11.4 8 12 6 12 3z"/>',
  crown: '<path d="M3 8l4 3 5-7 5 7 4-3-2 12H5z"/>',
  shield: '<path d="M12 3l8 3v6c0 5.2-3.4 8.4-8 9.8C7.4 20.4 4 17.2 4 12V6z"/>',
  sprout: '<path d="M12 21v-8c-.6-3.4-3-5-6.8-5 0 4 2.6 6.4 6.8 6.8V21z"/><path d="M12 21v-4.2c3.4-.4 5.6-2.6 5.6-6"/>',
  key: '<circle cx="8" cy="10" r="3.2"/><path d="M11 10h9v2.4h-2.2l-.8 2.8h-2.2l-.8-2.8H11"/>'
};

/** Stroked UI icon SVG. */
export const ic = (k: string): string => '<svg viewBox="0 0 24 24">' + (ICON[k] || '') + '</svg>';
