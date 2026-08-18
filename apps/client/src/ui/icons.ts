/** Inline SVG icon paths: team badge glyphs (filled) and UI icons (stroked). */

export const GLYPH: Record<string, string> = {
  anvil: 'M3 8h13l-1.4 4H19v3H5v-3h3.4L7 8zm2 9h14v3H5z',
  wolf: 'M12 2.5l3.4 4.2 4.6.4-2.2 4.5 2 3.3-5.2 1.7L12 21.5l-2.6-4.9-5.2-1.7 2-3.3L4 7.1l4.6-.4z',
  lark: 'M2 13c4.5-6.8 11-9.5 20-9.4-2.2 5.6-6.6 9-11.2 10.2L9 21l-1.6-6.4z',
  comet: 'M17 3a4 4 0 110 8 4 4 0 010-8zM2 21l9.5-8.2-1.4-1.6z m1 -6 l6 -5 -1 -1.6z',
  gear: 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm9-.9l-2.1-.5-.6-1.5 1.1-1.8-2.2-2.2-1.8 1.1-1.5-.6L13.4 0h-3l-.5 2.1-1.5.6-1.8-1.1L4.4 3.8l1.1 1.8-.6 1.5L2.8 7.6v3l2.1.5.6 1.5-1.1 1.8 2.2 2.2 1.8-1.1 1.5.6.5 2.1h3l.5-2.1 1.5-.6 1.8 1.1 2.2-2.2-1.1-1.8.6-1.5 2.1-.5z',
  flame: 'M12 2c2.9 4.2 6.2 6.1 6.2 10.2A6.2 6.2 0 015.8 12c0-2.1 1-3.4 2.2-4.4 0 2 .9 3.1 1.9 3.1 0-4.1 1-6.4 2.1-8.7z',
  lion: 'M12 2a5 5 0 015 5c1.7.6 3 2 3 4s-1.3 3.6-3 4.2A5 5 0 0112 22a5 5 0 01-5-6.8C5.3 14.6 4 13 4 11s1.3-3.4 3-4a5 5 0 015-5zm-3 8.5a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zm6 0a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zM9.4 16h5.2l-2.6 2.6z',
  sprout: 'M11 22v-8.4C10.3 9.9 7.6 8 3.4 8c0 4.4 3 7 7.6 7.4V22zm2 0v-4.7c4-.5 6.6-3 6.6-7-3.9 0-6.6 1.8-6.6 5.6z',
  megaphone: 'M3 9.5v5l3 .9V19h2.6v-2.8L20 20V4L3 9.5z',
  sigma: 'M19 3H5v2l6.2 7L5 19v2h14v-4h-8.5l4.7-5-4.7-5H19z',
  handshake: 'M2 10l4-4 4 3 2-1 2 1 4-3 4 4-5 8-3-2-2 1-2-1-3 2z',
  crown: 'M2 7l4.5 3.5L12 3l5.5 7.5L22 7l-2 13H4z',
  anchor: 'M12 2a2.6 2.6 0 011.4 4.8V9h3v2h-3v7.7A7.6 7.6 0 0019.4 13H22a10 10 0 01-20 0h2.6a7.6 7.6 0 006 5.7V11h-3V9h3V6.8A2.6 2.6 0 0112 2z',
  bolt: 'M14 2L4 14h5.5L8 22 20 9h-6z',
  moth: 'M12 5c1 0 1.6 1 1.6 2.2 3-2.6 7.4-3.4 7.4.6 0 4.4-4 8-9 9.2-5-1.2-9-4.8-9-9.2 0-4 4.4-3.2 7.4-.6C10.4 6 11 5 12 5z',
  key: 'M8.5 2a6 6 0 015.7 7.9L22 17.7V22h-4.3l-1.2-1.2-1.5 1.5-2-2 1.5-1.5-1.6-1.6L8.9 14A6 6 0 118.5 2zm-1.3 4a2 2 0 100 4 2 2 0 000-4z',
  skull: 'M12 2a8 8 0 018 8v3.5L18 16v4h-3v-2h-1.5v2h-3v-2H9v2H6v-4l-2-2.5V10a8 8 0 018-8zM8.6 9.4a2 2 0 100 4 2 2 0 000-4zm6.8 0a2 2 0 100 4 2 2 0 000-4z',
  star: 'M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4l7.2-.8z',
  shield: 'M12 2l9 3.3v6.4C21 18 17 21.6 12 23 7 21.6 3 18 3 11.7V5.3z',
  axe: 'M4 3c5-1.4 9 .6 11 4l5-1.6 1 3.2-5 1.6c-.6 4-4 6.8-9 6.4l-1 5-2.6-.5 1-5C2 15 1.6 10 4 3z'
};

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

/** Filled badge glyph SVG. */
export const g = (k: string): string =>
  '<svg viewBox="0 0 24 24">' + (GLYPH[k] ? '<path d="' + GLYPH[k] + '"/>' : '') + '</svg>';

/** Stroked UI icon SVG. */
export const ic = (k: string): string => '<svg viewBox="0 0 24 24">' + (ICON[k] || '') + '</svg>';
