/** Market view: draft board, trades, free agents, scouting. */
import {
  CLASSES, ROSTER_MAX, TRAITS,
  aiEvalDraft, draftStatus, evalTrade, isPitcher, rosterGaps, rosterRoom, shownOvr, scoutTickMul, value,
  type Player, type Position
} from '@ballclub/engine';
import { esc } from '../ui/dom.js';
import { M, cssColor } from '../ui/format.js';
import { store } from '../app/store.js';
import { UI } from '../app/uiState.js';
import { meFog, playerRow, ratingBars } from './helpers.js';

export function boardOrder(): Player[] {
  const L = store.league!;
  return L.draftPool.slice().sort((a, b) => aiEvalDraft(store.me, b) - aiEvalDraft(store.me, a));
}

export function viewMarket(): string {
  const L = store.league!;
  if (L.phase === 'draft') return viewDraft();
  let s = marketWire() + `<div class="chiprow">
    ${([['trade', 'Trades'], ['fa', 'Free agents'], ['scout', 'Scouting']] as const).map(([k, n]) =>
      `<button class="chip${UI.market === k ? ' on' : ''}" data-act="market" data-k="${k}">${n}</button>`).join('')}
  </div>`;
  if (UI.market === 'trade') s += viewTrade();
  else if (UI.market === 'fa') s += viewFA();
  else s += viewScout();
  return s;
}

function marketWire(): string {
  const L = store.league!;
  const lines: string[] = [];
  const formatLog = (e: { txt?: string; t?: string }): string => {
    const raw = e.txt || '';
    if (!e.t) return raw;
    const team = L.teams.find((x) => x.id === e.t);
    if (!team) return raw;
    if (raw.indexOf(team.abbr) === 0 || raw.indexOf(team.abbr + ' ') >= 0 || raw.indexOf(team.abbr + ' ·') >= 0) {
      return raw;
    }
    return team.abbr + ' · ' + raw;
  };
  const last = L.results[L.results.length - 1];
  if (last?.series?.length) {
    const sweep = last.series.find((sr) => sr.hw === 0 || sr.aw === 0);
    if (sweep) {
      const winner = sweep.hw > sweep.aw
        ? L.teams.find((t) => t.id === sweep.homeId)
        : L.teams.find((t) => t.id === sweep.awayId);
      const loser = sweep.hw > sweep.aw
        ? L.teams.find((t) => t.id === sweep.awayId)
        : L.teams.find((t) => t.id === sweep.homeId);
      if (winner && loser) lines.push(winner.abbr + ' swept ' + loser.abbr + ' in week ' + last.week);
    }
  }
  L.log.filter((x) => x.trade).slice(-2).reverse().forEach((e) => {
    if (e.txt) lines.push(formatLog(e));
  });
  if (!lines.length) {
    const feed = L.log.filter((x) => !x.draft).slice(-2).reverse();
    feed.forEach((e) => { if (e.txt) lines.push(formatLog(e)); });
  }
  if (!lines.length) return '';
  return `<div class="panel market-wire">
    <div class="eyebrow">The wire <b>around the league</b></div>
    ${lines.slice(0, 2).map((t) => `<p class="wire-line">${esc(t)}</p>`).join('')}
  </div>`;
}

/* ---------- draft ---------- */
export function viewDraft(): string {
  const L = store.league!;
  const me = store.me;
  const st = draftStatus(L, me.id);
  if (!st.cur) return `<div class="empty"><h3>Draft is over</h3><p>Head to the Club tab. The season is waiting.</p></div>`;
  const slot = st.cur;
  const onClock = L.teams.find((t) => t.id === slot.teamId)!;
  const board = boardOrder();
  const picks = L.log.filter((x) => x.draft).slice(-6).reverse();
  const gaps = rosterGaps(me).slice(0, 5);

  let s = `<div class="readout" style="margin-bottom:12px">
    <div class="ro-cell"><div class="k">${st.mine ? 'Your pick' : 'On the clock'}</div><div class="v">${st.overall}</div><div class="s">of ${st.total}</div></div>
    <div class="ro-cell"><div class="k">Round</div><div class="v">${slot.round}</div><div class="s">${st.yoursLeft} left for you</div></div>
    <div class="ro-cell"><div class="k">Roster</div><div class="v">${me.roster.length}</div><div class="s">of ${ROSTER_MAX}</div></div>
  </div>`;

  if (gaps.length) {
    s += `<div class="needrow">` +
      gaps.map((g) => `<span class="need${g.want - g.have >= 2 ? ' hot' : ''}">${g.pos} ${g.have}/${g.want}</span>`).join('') +
      `</div>`;
  }

  const digest = UI.draftDigest;
  if (digest && (digest.you || digest.then.length)) {
    s += `<div class="panel" style="margin-bottom:12px">
      <div class="eyebrow">What just happened</div>`;
    if (digest.you) s += `<p style="font-size:15px;margin-bottom:6px">You took <b>${esc(digest.you)}</b>.</p>`;
    if (digest.then.length) {
      const shown = digest.then.slice(0, 4);
      s += `<p class="faint" style="font-size:13px;line-height:1.45">${shown.map(esc).join(' · ')}${digest.then.length > 4 ? ' · +' + (digest.then.length - 4) + ' more' : ''}</p>`;
    } else if (st.mine) {
      s += `<p class="faint" style="font-size:13px">You're still on the clock.</p>`;
    }
    s += `</div>`;
  }

  if (!st.mine) {
    const wait = st.untilYou === 1 ? '1 pick until you' : st.untilYou + ' picks until you';
    s += `<div class="panel">
      <div class="eyebrow">Waiting</div>
      <h3 style="color:${cssColor(onClock.color)}">${esc(onClock.name)}</h3>
      <p class="dim" style="margin-top:6px">${esc(wait)}. They pick, then it comes back around.</p>
      <button class="btn primary" style="margin-top:12px" data-act="advdraft">Play the other clubs</button>
    </div>`;
  } else {
    UI.draftIdx = Math.min(UI.draftIdx, Math.max(0, board.length - 1));
    const stack = board.slice(UI.draftIdx, UI.draftIdx + 3);
    const top = board[UI.draftIdx];
    const rank = UI.draftIdx + 1;
    s += `<div class="eyebrow">Take a player <b>staff list ${rank} of ${board.length}</b></div>
      <div class="swipehint">← next name · take him →</div>
      <div class="deck" id="drdeck">`;
    stack.slice().reverse().forEach((p, ri) => {
      const i = stack.length - 1 - ri;
      const so = shownOvr(p, meFog(), store.me);
      const fog = so.exact ? 'FILE IN' : 'ESTIMATE';
      s += `<div class="dcard" data-di="${i}" data-id="${p.id}" style="transform:translateY(${i * 7}px) scale(${1 - i * 0.03});opacity:${i === 2 ? 0.55 : 1};z-index:${9 - i}">
        <div class="dcard-in draft">
          <div class="tag"><span>${p.pos}</span><span>${fog}</span></div>
          <h2 style="font-size:31px">${esc(p.name)}</h2>
          <div class="pmeta" style="font-size:11px;margin-bottom:12px">
            <span>${p.age} years old</span><span>bats ${p.bats}</span><span>${M(p.salary)}</span></div>
          <div style="display:flex;align-items:flex-end;gap:14px;margin-bottom:12px">
            <div><div class="draft-big${so.exact ? '' : ' fogged'}">${so.exact ? so.v : so.lo + '–' + so.hi}</div>
              <div class="mq-lab">${so.exact ? 'overall' : 'scout range'}</div></div>
            ${so.exact && p.pot > p.ovr ? `<div style="padding-bottom:14px"><div style="font-family:var(--dsp);font-size:26px;color:var(--bulb)">${p.pot}</div><div class="mq-lab">ceiling</div></div>` : ''}
          </div>
          <div style="flex:1">${ratingBars(p)}</div>
          ${p.traits.length ? `<div class="pmeta" style="margin-top:10px">${p.traits.map((t) => { const T = TRAITS.find((x) => x.key === t); return T ? '<span class="amber">' + esc(T.name) + '</span>' : ''; }).join('')}</div>` : ''}
          <div class="dchoice">
            ${i === 0 ? `<button data-act="drpass"><div class="ar">← left</div><div class="lb">Next name</div></button>
            <button data-act="drtake" data-id="${p.id}"><div class="ar">right →</div><div class="lb">Take him</div></button>` : `<div><div class="ar">← left</div><div class="lb">Next name</div></div>
            <div><div class="ar">right →</div><div class="lb">Take him</div></div>`}
          </div>
          <div class="stamp l">NEXT</div>
          <div class="stamp r">TAKE</div>
        </div></div>`;
    });
    s += `</div>
      <div class="btn-row">`;
    if (top && (me.scoutFiles?.[top.id] || 0) < 1 && top.scouted < 1) {
      s += `<button class="btn ghost sm" data-act="scoutone" data-id="${top.id}" ${me.ap < 1 ? 'disabled' : ''}>Scout this file · 1 action</button>`;
    }
    s += `<button class="btn ghost sm" data-act="fullboard">All remaining names</button>
      </div>`;
  }

  if (picks.length) {
    s += `<div class="eyebrow">Picked already</div><div class="panel feed">`;
    picks.forEach((p) => {
      s += `<div class="fitem"><div class="w">R${p.round}</div><div class="x">${esc(p.txt)}</div></div>`;
    });
    s += `</div>`;
  }
  return s;
}

/* ---------- trades ---------- */
export function viewTrade(): string {
  const L = store.league!;
  const me = store.me;
  const rivals = L.teams.filter((t) => t.id !== me.id);
  if (!UI.trade.rival) UI.trade.rival = rivals[0].id;
  const them = L.teams.find((t) => t.id === UI.trade.rival)!;
  const myOut = me.roster.filter((p) => UI.trade.mine.indexOf(p.id) >= 0);
  const theirOut = them.roster.filter((p) => UI.trade.theirs.indexOf(p.id) >= 0);
  const ev = myOut.length || theirOut.length ? evalTrade(L, me, them, myOut, theirOut) : null;

  let s = '';
  if (me.inboxTrade) {
    const ib = me.inboxTrade;
    const from = L.teams.find((t) => t.id === ib.fromId);
    const give = from?.roster.filter((p) => ib.give.indexOf(p.id) >= 0) || [];
    const get = me.roster.filter((p) => ib.get.indexOf(p.id) >= 0);
    s += `<div class="panel" style="margin-bottom:12px;border-color:rgba(255,180,60,.35)">
      <div class="eyebrow">Fax from <b>${from ? esc(from.abbr) : 'a rival'}</b></div>
      <p style="font-size:14px;line-height:1.4;margin-bottom:8px">
        They send ${give.length ? give.map((p) => '<b>' + esc(p.name) + '</b>').join(', ') : 'nobody'};
        you send ${get.length ? get.map((p) => '<b>' + esc(p.name) + '</b>').join(', ') : 'nobody'}.</p>
      <div class="btn-row">
        <button class="btn primary sm" data-act="inbox-yes">Accept</button>
        <button class="btn ghost sm" data-act="inbox-no">Pass</button>
      </div>
    </div>`;
  }
  if (me.pendingTrade) {
    const pt = me.pendingTrade;
    const riv = L.teams.find((t) => t.id === pt.rivalId);
    const give = me.roster.find((p) => p.id === pt.give[0]);
    const get = riv?.roster.find((p) => p.id === pt.get[0]);
    s += `<div class="panel" style="margin-bottom:12px;border-color:rgba(255,180,60,.35)">
      <div class="eyebrow">Midnight call <b>${riv ? esc(riv.abbr) : 'rival'}</b></div>
      <p style="font-size:14px;line-height:1.4;margin-bottom:10px">
        They want ${give ? '<b>' + esc(give.name) + '</b>' : 'a man'} for ${get ? '<b>' + esc(get.name) + '</b>' : 'someone'}.</p>
      <div class="btn-row">
        <button class="btn primary sm" data-act="desk-trade-yes">Take the deal</button>
        <button class="btn ghost sm" data-act="desk-trade-no">Hang up</button>
      </div>
    </div>`;
  }

  s += `<div class="chiprow">${rivals.map((t) =>
    `<button class="chip${t.id === UI.trade.rival ? ' on' : ''}" data-act="rival" data-k="${t.id}">${esc(t.abbr)}</button>`).join('')}</div>`;

  s += `<div class="panel" style="padding-bottom:6px">
    <div class="eyebrow">${esc(them.name)} <b>${them.w}-${them.l}</b></div>
    <p class="faint" style="font-size:13px;margin-bottom:8px">${esc(CLASSES[them.cls].tag)}. Tap players from both sides.</p>`;
  them.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 12).forEach((p) => {
    const on = UI.trade.theirs.indexOf(p.id) >= 0;
    s += `<div class="prow${on ? ' sel' : ''}" data-act="tpick" data-side="theirs" data-id="${p.id}">
      <div class="ppos${isPitcher(p) ? ' p' : ''}">${p.pos}</div>
      <div class="pinfo"><div class="pname">${esc(p.name)}</div>
        <div class="pmeta"><span>${p.age}y</span><span>${M(p.salary)}</span><span>${Math.round(value(p))} pts</span></div></div>
      <div class="povr">${p.ovr}<small>ovr</small></div></div>`;
  });
  s += `</div>`;

  s += `<div class="panel" style="padding-bottom:6px"><div class="eyebrow">You give up</div>`;
  me.roster.slice().sort((a, b) => b.ovr - a.ovr).forEach((p) => {
    const on = UI.trade.mine.indexOf(p.id) >= 0;
    s += `<div class="prow${on ? ' sel' : ''}" data-act="tpick" data-side="mine" data-id="${p.id}">
      <div class="ppos${isPitcher(p) ? ' p' : ''}">${p.pos}</div>
      <div class="pinfo"><div class="pname">${esc(p.name)}</div>
        <div class="pmeta"><span>${p.age}y</span><span>${M(p.salary)}</span><span>${Math.round(value(p))} pts</span></div></div>
      <div class="povr">${p.ovr}<small>ovr</small></div></div>`;
  });
  s += `</div>`;

  if (ev) {
    const bal = Math.max(-1, Math.min(1, ev.gain / Math.max(10, (ev.myVal + ev.theirVal) * 0.5)));
    s += `<div class="tradebar">
      <div style="flex:0 0 auto"><div class="mq-lab">You get</div><b class="num">${ev.theirVal}</b></div>
      <div class="vmeter"><div class="mid"></div>
        <div class="f ${bal < 0 ? 'bad' : ''}" style="${bal >= 0 ? 'left:50%;width:' + bal * 50 + '%' : 'left:' + (50 + bal * 50) + '%;width:' + -bal * 50 + '%'}"></div></div>
      <div style="flex:0 0 auto;text-align:right"><div class="mq-lab">You give</div><b class="num">${ev.myVal}</b></div>
    </div>
    <p class="${them.isHuman ? 'dim' : (ev.accept ? 'pos' : 'dim')}" style="text-align:center;margin-bottom:6px;font-size:14px">${
      them.isHuman ? 'They will see this on their fax machine.' : esc(ev.verdict)
    }</p>
    <p class="faint" style="text-align:center;font-size:12px;margin-bottom:10px;line-height:1.35">${
      them.isHuman
        ? 'Wire note: human desks answer when they open Market.'
        : esc(ev.accept
          ? 'Wire note: their board likes the value enough to move.'
          : 'Wire note: ' + (ev.verdict.indexOf('Close') >= 0 ? 'one more piece might tip them.' : 'they want a different shape of deal.'))
    }</p>
    <div class="btn-row">
      <button class="btn ghost" data-act="tclear">Clear</button>
      <button class="btn primary" data-act="propose">${them.isHuman ? 'Fax the deal · 1 action' : 'Propose · 1 action'}</button>
    </div>`;
  } else {
    s += `<div class="empty"><p>Pick at least one player from either side to see what they think.</p></div>`;
  }
  return s;
}

/* ---------- free agents ---------- */
export function viewFA(): string {
  const L = store.league!;
  const me = store.me;
  const list = L.freeAgents.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 30);
  let s = `<div class="panel">
    <div class="eyebrow">Open market <b>${L.freeAgents.length} available</b></div>
    <div class="kv"><span class="k">Roster room</span><b>${rosterRoom(me)} of ${ROSTER_MAX}</b></div>
    <div class="kv"><span class="k">Cash</span><b>${M(me.cash)}</b></div>
    <p class="faint" style="font-size:13px;margin-top:6px">Signing costs a bonus of half the first-year salary, plus one action.</p>
  </div><div class="panel" style="padding-top:4px">`;
  if (!list.length) s += `<div class="empty"><h3>Nobody left</h3><p>The market is picked clean.</p></div>`;
  list.forEach((p) => {
    s += playerRow(p, M(p.salary));
  });
  s += `</div>`;
  return s;
}

/* ---------- scouting ---------- */
export function viewScout(): string {
  const L = store.league!;
  const me = store.me;
  const pool = L.draftPool.length ? L.draftPool : L.freeAgents;
  const unscouted = pool.filter((p) => (me.scoutFiles?.[p.id] || 0) < 1 && p.scouted < 1).sort((a, b) => b.scouted - a.scouted).slice(0, 24);
  const closing = pool.filter((p) => p.scouted >= 0.55 && p.scouted < 1 && (me.scoutFiles?.[p.id] || 0) < 1).length;
  const positions: Position[] = ['SP', 'RP', 'C', 'SS', 'CF', '1B', '2B', '3B', 'LF', 'RF', 'DH'];
  let s = `<div class="panel">
    <div class="eyebrow">Scouting department</div>
    <div class="kv"><span class="k">Head scout</span><b>${me.staff.scout}</b></div>
    <div class="kv"><span class="k">The eye</span><b>rank ${me.progress?.skills.scout || 0}</b></div>
    <div class="kv"><span class="k">Reports per week</span><b>${((me.staff.scout / 100) * (CLASSES[me.cls].mods.scoutSpeed || 1) * scoutTickMul(me) * 5).toFixed(1)}%</b></div>
    <div class="kv"><span class="k">Files closing this week</span><b>${closing}</b></div>
    <p class="faint" style="font-size:13px;margin-top:6px">Focus your scouts on one position and they work that group first. One action fully resolves a single player. Rank The eye from the League tab to lift the fog and close files faster.</p>
    <div class="chiprow" style="margin-top:10px;margin-bottom:0">
      <button class="chip${!me.scoutFocus ? ' on' : ''}" data-act="focus" data-k="">Everyone</button>
      ${positions.map((p) => `<button class="chip${me.scoutFocus === p ? ' on' : ''}" data-act="focus" data-k="${p}">${p}</button>`).join('')}
    </div>
  </div>`;
  s += `<div class="eyebrow">Open files <b>${unscouted.length}</b></div><div class="panel" style="padding-top:4px">`;
  if (!unscouted.length) s += `<div class="empty"><h3>All clear</h3><p>Every name on the list has a finished report.</p></div>`;
  unscouted.forEach((p) => {
    const so = shownOvr(p, meFog(), store.me);
    s += `<div class="prow" data-act="player" data-id="${p.id}">
      <div class="ppos${isPitcher(p) ? ' p' : ''}">${p.pos}</div>
      <div class="pinfo"><div class="pname">${esc(p.name)}</div>
        <div class="pmeta"><span>${p.age}y</span><span>${Math.round(p.scouted * 100)}% known</span></div></div>
      <div class="povr fog">${so.lo}-${so.hi}<small>est</small></div>
      <button class="chip" data-act="scoutone" data-id="${p.id}" style="margin-left:6px">Scout</button>
      <i class="cond" style="width:${p.scouted * 100}%"></i></div>`;
  });
  s += `</div>`;
  return s;
}
