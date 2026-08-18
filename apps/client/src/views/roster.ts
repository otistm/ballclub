/** Roster view: payroll, role filters, batting order / rotation controls. */
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

  const hook = Math.round((me.strategy.bullpenHook || 0.5) * 100);
  const agg = Math.round((me.strategy.aggression || 0.5) * 100);
  const pat = Math.round((me.strategy.patience || 0.5) * 100);

  let s = `<div class="eyebrow">Payroll <b>${me.roster.length}/${ROSTER_MAX} men</b></div>
    <div class="panel">
      <div class="kv"><span class="k">Season payroll</span><b>${M(payroll)}</b></div>
      <div class="kv"><span class="k">Per week</span><b>${M(weekly)}</b></div>
      <div class="kv"><span class="k">Weekly revenue</span><b>${me.wk.rev ? M(me.wk.rev) : 'no gate yet'}</b></div>
      <div class="hairline"></div>
      <div class="kv"><span class="k">Cash on hand</span><b class="${me.cash < 0 ? 'neg' : ''}" style="font-size:15px">${M(me.cash)}</b></div>
    </div>
    <div class="eyebrow">The dugout <b>how you play</b></div>
    <div class="panel">
      <div class="kv">
        <span class="k" data-act="dugout" data-k="pat" style="cursor:pointer;border-bottom:1px solid rgba(255,255,255,.18)">Patience</span>
        <b class="num">${pat}</b>
      </div>
      <input type="range" min="5" max="95" value="${pat}" data-strat="pat" class="rslider"/>
      <div class="kv">
        <span class="k" data-act="dugout" data-k="agg" style="cursor:pointer;border-bottom:1px solid rgba(255,255,255,.18)">Green light</span>
        <b class="num">${agg}</b>
      </div>
      <input type="range" min="5" max="95" value="${agg}" data-strat="agg" class="rslider"/>
      <div class="kv">
        <span class="k" data-act="dugout" data-k="hook" style="cursor:pointer;border-bottom:1px solid rgba(255,255,255,.18)">Bullpen hook</span>
        <b class="num">${hook}</b>
      </div>
      <input type="range" min="5" max="95" value="${hook}" data-strat="hook" class="rslider"/>
      <p class="faint" style="font-size:12px;line-height:1.4;margin-top:6px">Tap a setting for the full note. Drag the slider to change it.</p>
    </div>
    <div class="chiprow">
      ${([['lineup', 'Lineup'], ['rotation', 'Arms'], ['bench', 'Bench'], ['all', 'Everyone']] as const).map(([k, n]) =>
        `<button class="chip${UI.rosterFilter === k ? ' on' : ''}" data-act="rfilter" data-k="${k}">${n}</button>`).join('')}
    </div>`;

  if (UI.rosterFilter === 'lineup') {
    s += `<div class="chiprow" style="margin-bottom:8px">
      <button class="chip" data-act="lu-lock">Lock this nine</button>
      <button class="chip" data-act="lu-auto">Auto order</button>
    </div>`;
  }
  if (UI.rosterFilter === 'rotation') {
    s += `<div class="chiprow" style="margin-bottom:8px">
      <button class="chip" data-act="rot-lock">Lock starters</button>
      <button class="chip" data-act="rot-auto">Auto arms</button>
    </div>`;
  }

  s += `<div class="panel" style="padding-top:4px">`;

  if (!list.length) s += `<div class="empty"><h3>Nobody here</h3><p>Draft or sign somebody and they will show up.</p></div>`;
  list.forEach((p, i) => {
    const r = ids[p.id];
    const editable = (UI.rosterFilter === 'lineup' && i < 9) || (UI.rosterFilter === 'rotation' && p.pos === 'SP');
    s += `<div class="prow-wrap">${playerRow(p, M(p.salary), UI.rosterFilter === 'all' || UI.rosterFilter === 'bench' ? null : r ? r.role : null)}`;
    if (editable) {
      s += `<div class="rowacts">
        <button class="chip sm" data-act="${UI.rosterFilter === 'lineup' ? 'lu-move' : 'rot-move'}" data-id="${p.id}" data-dir="up">▲</button>
        <button class="chip sm" data-act="${UI.rosterFilter === 'lineup' ? 'lu-move' : 'rot-move'}" data-id="${p.id}" data-dir="down">▼</button>
      </div>`;
    }
    s += `</div>`;
  });
  s += `</div><div class="faint" style="text-align:center;font-size:11px;font-family:var(--mono);letter-spacing:.1em">TAP A PLAYER FOR THE FULL CARD · HOLD FOR A PEEK</div>`;
  return s;
}
