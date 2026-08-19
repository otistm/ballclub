/** Roster view: field diagram, position assignment, arms, dugout knobs. */
import {
  HIT_POS, ROSTER_MAX, buildLineup, fieldComplete, fieldVacancies, playersAtField,
  type FieldPos, type LineupPlan, type Player
} from '@ballclub/engine';
import { esc } from '../ui/dom.js';
import { M } from '../ui/format.js';
import { fieldMapHtml } from '../ui/fieldMap.js';
import { store } from '../app/store.js';
import { UI } from '../app/uiState.js';
import { playerRow } from './helpers.js';

interface RoleMap {
  [id: string]: { role: string; o: number };
}

export function rosterGroups(): { lu: LineupPlan; ids: RoleMap } {
  const lu = buildLineup(store.me);
  const ids: RoleMap = {};
  const field = playersAtField(store.me);
  const fieldPosOf = (id: string): string | null => {
    for (const pos of HIT_POS) if (field[pos]?.id === id) return pos;
    return null;
  };
  lu.lineup.forEach((p, i) => {
    const at = fieldPosOf(p.id);
    ids[p.id] = { role: at ? i + 1 + ' · ' + at : 'BAT ' + (i + 1), o: i };
  });
  HIT_POS.forEach((pos, i) => {
    const p = field[pos];
    if (p && !ids[p.id]) ids[p.id] = { role: pos, o: i };
  });
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
  const vac = fieldVacancies(me);
  const ready = fieldComplete(me);
  const openSp = me.roster.filter((p) => p.pos === 'SP' && !p.injured).length;

  let list: Player[] = me.roster.slice();
  if (UI.rosterFilter === 'field') {
    list = [];
  } else if (UI.rosterFilter === 'lineup') {
    list = ready ? lu.lineup.slice(0, 9) : [];
  } else if (UI.rosterFilter === 'rotation') {
    list = lu.sps.slice(0, 5).concat(lu.rps.slice(0, 6));
  } else if (UI.rosterFilter === 'bench') {
    const onField = new Set(HIT_POS.map((pos) => me.fieldIds?.[pos]).filter(Boolean) as string[]);
    const onArms = new Set(lu.sps.slice(0, 5).concat(lu.rps.slice(0, 6)).map((p) => p.id));
    list = me.roster.filter((p) => !onField.has(p.id) && !onArms.has(p.id));
  } else {
    list.sort((a, b) => b.ovr - a.ovr);
  }

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
    </div>`;

  s += `<div class="eyebrow">The field <b>${ready ? 'set' : vac.length + ' open'}</b></div>
    <div class="panel field-panel">
      ${!ready
    ? `<p class="field-warn">${vac.length
      ? 'Fill every position before you play. Open: ' + vac.join(', ') + (openSp < 1 ? ' · need an SP' : '')
      : 'Need a healthy starting pitcher before you play.'}</p>`
    : `<p class="faint" style="font-size:12px;line-height:1.4;margin-bottom:8px">Nine unique names on the diamond. Tap a pad to change it.</p>`}
      ${fieldMapHtml(me, me.color)}
      <div class="chiprow" style="margin-top:10px;margin-bottom:0">
        <button class="chip" data-act="field-auto">Auto fill</button>
        <button class="chip" data-act="field-clear">Clear field</button>
      </div>
    </div>`;

  s += `<div class="eyebrow">The dugout <b>how you play</b></div>
    <div class="panel" id="roster-strat">
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
      ${([['field', 'Field'], ['lineup', 'Order'], ['rotation', 'Arms'], ['bench', 'Bench'], ['all', 'Everyone']] as const).map(([k, n]) =>
        `<button class="chip${UI.rosterFilter === k ? ' on' : ''}" data-act="rfilter" data-k="${k}">${n}</button>`).join('')}
    </div>`;

  if (UI.rosterFilter === 'lineup') {
    s += `<div class="chiprow" style="margin-bottom:8px">
      <button class="chip" data-act="lu-lock"${ready ? '' : ' disabled'}>Lock order</button>
      <button class="chip" data-act="lu-auto"${ready ? '' : ' disabled'}>Auto order</button>
    </div>`;
  } else if (UI.rosterFilter === 'rotation') {
    s += `<div class="chiprow" style="margin-bottom:8px">
      <button class="chip" data-act="rot-lock">Lock starters</button>
      <button class="chip" data-act="rot-auto">Auto arms</button>
    </div>`;
  }

  const sortMode =
    UI.rosterFilter === 'rotation' ? 'rotation'
      : UI.rosterFilter === 'lineup' && ready ? 'lineup'
        : '';
  s += `<div class="panel roster-sort" id="roster-sort" data-mode="${sortMode}" style="padding-top:4px">`;

  if (UI.rosterFilter === 'field') {
    HIT_POS.forEach((pos) => {
      const id = me.fieldIds?.[pos];
      const p = id ? me.roster.find((x) => x.id === id) : null;
      if (p) {
        s += `<div class="prow-wrap" data-act="fieldslot" data-pos="${pos}">${playerRow(p, M(p.salary), pos)}</div>`;
      } else {
        s += `<div class="prow field-empty-row" data-act="fieldslot" data-pos="${pos}">
          <div class="ppos">${pos}</div>
          <div class="pinfo"><div class="pname">Open</div><div class="pmeta"><span>Tap to fill</span></div></div>
        </div>`;
      }
    });
  } else if (UI.rosterFilter === 'lineup' && !ready) {
    s += `<div class="empty"><h3>Field first</h3><p>Fill every spot on the diamond, then set your batting order here.</p></div>`;
  } else if (UI.rosterFilter === 'lineup') {
    list.forEach((p, i) => {
      const at = HIT_POS.find((pos) => me.fieldIds?.[pos] === p.id) || p.pos;
      const row = playerRow(p, M(p.salary), at).replace(
        /<div class="ppos[^"]*">[^<]*<\/div>/,
        `<div class="ppos">${i + 1}</div>`
      );
      s += `<div class="prow-wrap sortable" data-sortable="1" data-id="${p.id}">${row}</div>`;
    });
  } else if (!list.length) {
    s += `<div class="empty"><h3>Nobody here</h3><p>Draft or sign somebody and they will show up.</p></div>`;
  } else {
    list.forEach((p) => {
      const r = ids[p.id];
      const sortable = UI.rosterFilter === 'rotation' && p.pos === 'SP';
      s += `<div class="prow-wrap${sortable ? ' sortable' : ''}"${sortable ? ` data-sortable="1" data-id="${p.id}"` : ''}>`;
      s += playerRow(p, M(p.salary), UI.rosterFilter === 'all' || UI.rosterFilter === 'bench' ? null : r ? r.role : null);
      s += `</div>`;
    });
  }

  const tip =
    UI.rosterFilter === 'rotation'
      ? 'DRAG A STARTER TO REORDER · TAP FOR THE FULL CARD'
      : UI.rosterFilter === 'lineup'
        ? ready
          ? 'DRAG TO REORDER · TAP FOR THE FULL CARD'
          : 'FILL THE FIELD BEFORE SETTING THE ORDER'
        : UI.rosterFilter === 'field'
          ? 'TAP A PAD OR ROW TO SET THE POSITION'
          : 'TAP A PLAYER FOR THE FULL CARD · HOLD FOR A PEEK';
  s += `</div><div class="faint" style="text-align:center;font-size:11px;font-family:var(--mono);letter-spacing:.1em">${tip}</div>`;
  return s;
}

export function fieldSlotPickerHtml(pos: FieldPos): string {
  const me = store.me;
  const taken = new Set(
    HIT_POS.map((p) => me.fieldIds?.[p]).filter((id): id is string => !!id && me.fieldIds?.[pos] !== id)
  );
  const hitters = me.roster
    .filter((p) => p.pos !== 'SP' && p.pos !== 'RP' && !p.injured)
    .slice()
    .sort((a, b) => {
      const af = a.pos === pos ? 1 : 0;
      const bf = b.pos === pos ? 1 : 0;
      return bf - af || b.ovr - a.ovr;
    });

  let s = `<div class="eyebrow">Play ${pos} <b>${hitters.length} healthy</b></div>`;
  if (me.fieldIds?.[pos]) {
    s += `<button class="btn ghost sm" data-act="field-clear-slot" data-pos="${pos}" style="margin-bottom:10px">Clear this spot</button>`;
  }
  s += `<div class="panel" style="padding-top:4px">`;
  if (!hitters.length) {
    s += `<div class="empty"><h3>No hitters</h3><p>Draft or sign position players first.</p></div>`;
  }
  hitters.forEach((p) => {
    const busy = taken.has(p.id);
    const tag = p.pos === pos ? 'NATURAL' : busy ? 'MOVES HERE' : M(p.salary);
    s += `<div class="prow" data-act="field-pick" data-pos="${pos}" data-id="${p.id}">
      <div class="ppos">${esc(p.pos)}</div>
      <div class="pinfo">
        <div class="pname">${esc(p.name)}</div>
        <div class="pmeta"><span>${p.ovr} ovr</span><span>${esc(tag)}</span></div>
      </div>
    </div>`;
  });
  s += `</div>`;
  return s;
}
