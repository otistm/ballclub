/** Shared row/bar renderers used across views and sheets. */
import {
  TRAITS, isPitcher, scoutFogMul, shown, shownOvr, xpForLevel,
  type League, type Player, type Ratings, type Team
} from '@ballclub/engine';
import { esc } from '../ui/dom.js';
import { M } from '../ui/format.js';
import { store } from '../app/store.js';

export function meFog(): number {
  return store.league ? scoutFogMul(store.me) : 1;
}

export function findPlayer(L: League, meRoster: Player[], id: string): Player | null {
  return (
    meRoster.find((x) => x.id === id) ||
    L.draftPool.find((x) => x.id === id) ||
    L.freeAgents.find((x) => x.id === id) ||
    L.teams.reduce<Player | null>((f, t) => f || t.roster.find((x) => x.id === id) || null, null)
  );
}

export function playerRow(p: Player, extra?: string | null, role?: string | null): string {
  const so = shownOvr(p, meFog(), store.me);
  const isP = isPitcher(p);
  const cond = Math.round(p.cond);
  const cc = cond > 60 ? '' : cond > 30 ? 'low' : 'bad';
  const meta: string[] = [];
  meta.push(p.age + 'y');
  if (role) meta.push(role);
  if (p.injured) meta.push('OUT ' + p.injured + 'W');
  if (extra) meta.push(extra);
  p.traits.slice(0, 1).forEach((t) => {
    const T = TRAITS.find((x) => x.key === t);
    if (T) meta.push(T.name);
  });
  return `<div class="prow" data-act="player" data-id="${p.id}">
    <div class="ppos${isP ? ' p' : ''}">${p.pos}</div>
    <div class="pinfo">
      <div class="pname">${esc(p.name)}</div>
      <div class="pmeta">${meta.map((m) => '<span>' + esc(m) + '</span>').join('')}</div>
    </div>
    <div class="povr ${so.exact ? '' : 'fog'}">${so.exact ? so.v : so.lo + '-' + so.hi}<small>${so.exact ? 'ovr' : 'est'}</small></div>
    <i class="cond ${cc}" style="width:${cond}%"></i>
  </div>`;
}

export function ratingKeys(p: Player): [keyof Ratings, string][] {
  return isPitcher(p)
    ? [['stuff', 'STF'], ['ctl', 'CTL'], ['mov', 'MOV'], ['stam', 'STA'], ['fld', 'FLD'], ['arm', 'ARM']]
    : [['con', 'CON'], ['pow', 'POW'], ['eye', 'EYE'], ['spd', 'SPD'], ['fld', 'FLD'], ['arm', 'ARM']];
}

export function ratingBars(p: Player): string {
  return `<div class="bars">${ratingKeys(p).map(([k, lab]) => {
    const sh = shown(p, k, meFog(), store.me);
    return `<div class="bar"><div class="k">${lab}</div><div class="t">
      ${sh.exact
        ? `<i class="f" style="width:${sh.v}%"></i>`
        : `<i class="rng" style="left:${sh.lo}%;width:${Math.max(4, sh.hi - sh.lo)}%"></i>`}
    </div><div class="v ${sh.exact ? '' : 'fog'}">${sh.exact ? sh.v : '?'}</div></div>`;
  }).join('')}</div>`;
}

export const salaryLabel = (p: Player): string => M(p.salary);

export function xpBarHtml(team: Team, compact = false): string {
  const p = team.progress;
  if (!p) return '';
  const need = xpForLevel(p.level);
  const pct = Math.max(0, Math.min(100, Math.round((p.xp / need) * 100)));
  const tap = compact ? ' data-act="tab" data-k="league"' : '';
  return `<div class="xpwrap${compact ? ' compact' : ''}"${tap}>
    <div class="xplab"><span>GM ${p.level}</span><span>${p.xp} / ${need}${p.unspent ? ' · ' + p.unspent + ' to spend' : ''}</span></div>
    <div class="xptrack"><div class="xpfill" style="width:${pct}%"></div></div>
  </div>`;
}
