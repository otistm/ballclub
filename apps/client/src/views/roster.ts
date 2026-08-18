/** Roster view: payroll, role filters, player list. */
import { ROSTER_MAX, buildLineup, type LineupPlan, type Player } from '@ballclub/engine';
import { M } from '../ui/format.js';
import { store } from '../app/store.js';
import { UI } from '../app/uiState.js';
import { playerRow } from './helpers.js';

interface RoleMap {
  [id: string]: { role: string; o: number };
}

export function rosterGroups(): { lu: LineupPlan; ids: RoleMap } {
  const lu = buildLineup(store.me);
  const ids: RoleMap = {};
  lu.lineup.forEach((p, i) => (ids[p.id] = { role: 'BAT ' + (i + 1), o: i }));
  lu.sps.slice(0, 4).forEach((p, i) => (ids[p.id] = { role: 'SP ' + (i + 1), o: 20 + i }));
  lu.rps.slice(0, 5).forEach((p, i) => (ids[p.id] = { role: 'RP', o: 40 + i }));
  return { lu, ids };
}

export function viewRoster(): string {
  const L = store.league!;
  const me = store.me;
  const { lu, ids } = rosterGroups();
  const payroll = me.roster.reduce((s, p) => s + p.salary, 0);
  const weekly = payroll / L.weeks;
  let list: Player[] = me.roster.slice();

  if (UI.rosterFilter === 'lineup') list = lu.lineup.slice();
  else if (UI.rosterFilter === 'rotation') list = lu.sps.slice(0, 5).concat(lu.rps.slice(0, 6));
  else if (UI.rosterFilter === 'bench') list = me.roster.filter((p) => !ids[p.id]);
  else list.sort((a, b) => b.ovr - a.ovr);

  let s = `<div class="eyebrow">Payroll <b>${me.roster.length}/${ROSTER_MAX} men</b></div>
    <div class="panel">
      <div class="kv"><span class="k">Season payroll</span><b>${M(payroll)}</b></div>
      <div class="kv"><span class="k">Per week</span><b>${M(weekly)}</b></div>
      <div class="kv"><span class="k">Weekly revenue</span><b>${me.wk.rev ? M(me.wk.rev) : 'no gate yet'}</b></div>
      <div class="hairline"></div>
      <div class="kv"><span class="k">Cash on hand</span><b class="${me.cash < 0 ? 'neg' : ''}" style="font-size:15px">${M(me.cash)}</b></div>
    </div>
    <div class="chiprow">
      ${([['lineup', 'Lineup'], ['rotation', 'Arms'], ['bench', 'Bench'], ['all', 'Everyone']] as const).map(([k, n]) =>
        `<button class="chip${UI.rosterFilter === k ? ' on' : ''}" data-act="rfilter" data-k="${k}">${n}</button>`).join('')}
    </div>
    <div class="panel" style="padding-top:4px">`;

  if (!list.length) s += `<div class="empty"><h3>Nobody here</h3><p>Draft or sign somebody and they will show up.</p></div>`;
  list.forEach((p) => {
    const r = ids[p.id];
    s += playerRow(p, M(p.salary), UI.rosterFilter === 'all' || UI.rosterFilter === 'bench' ? null : r ? r.role : null);
  });
  s += `</div><div class="faint" style="text-align:center;font-size:11px;font-family:var(--mono);letter-spacing:.1em">TAP A PLAYER FOR THE FULL CARD · HOLD FOR A PEEK</div>`;
  return s;
}
