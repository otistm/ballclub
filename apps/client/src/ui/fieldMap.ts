/**
 * Chalk field diagram for the roster tab — nine defensive / DH slots.
 * Tap a pad to assign a player.
 */
import { HIT_POS, sanitizeColor, type FieldPos, type Player, type Team } from '@ballclub/engine';
import { esc } from './dom.js';

/** Approximate diamond coordinates for each slot (viewBox 0–100). */
const SLOT_XY: Record<FieldPos, { x: number; y: number; lab: string }> = {
  C: { x: 50, y: 72, lab: 'C' },
  '1B': { x: 78, y: 52, lab: '1B' },
  '2B': { x: 62, y: 38, lab: '2B' },
  '3B': { x: 22, y: 52, lab: '3B' },
  SS: { x: 38, y: 38, lab: 'SS' },
  LF: { x: 18, y: 22, lab: 'LF' },
  CF: { x: 50, y: 12, lab: 'CF' },
  RF: { x: 82, y: 22, lab: 'RF' },
  DH: { x: 50, y: 92, lab: 'DH' }
};

function lastName(p: Player): string {
  const parts = p.name.trim().split(/\s+/);
  return parts[parts.length - 1] || p.name;
}

export function fieldMapHtml(team: Team, color: string): string {
  const fill = sanitizeColor(color, '#3BA7D6');
  const field = team.fieldIds || {};
  const nodes = HIT_POS.map((pos) => {
    const xy = SLOT_XY[pos];
    const id = field[pos];
    const p = id ? team.roster.find((x) => x.id === id) : null;
    const filled = !!(p && !p.injured);
    const misfit = filled && p!.pos !== pos && pos !== 'DH';
    return `
      <g class="fslot${filled ? ' on' : ' empty'}${misfit ? ' offpos' : ''}" data-act="fieldslot" data-pos="${pos}">
        <circle class="fpad" cx="${xy.x}" cy="${xy.y}" r="7.2"
          style="${filled ? `fill:${fill};stroke:#E9EEE7` : ''}"/>
        <text class="flab" x="${xy.x}" y="${xy.y - 9.5}" text-anchor="middle">${xy.lab}</text>
        <text class="fname" x="${xy.x}" y="${xy.y + 1.2}" text-anchor="middle">${
          filled ? esc(lastName(p!).slice(0, 7).toUpperCase()) : '—'
        }</text>
      </g>`;
  }).join('');

  return `<div id="field-map" class="field-map" aria-label="Defensive field">
    <svg viewBox="0 0 100 100" class="field-map-svg" aria-hidden="true">
      <path class="ffield" d="M50 88 L12 50 L50 12 L88 50 Z"/>
      <path class="finfield" d="M50 72 L30 52 L50 32 L70 52 Z"/>
      ${nodes}
    </svg>
  </div>`;
}
