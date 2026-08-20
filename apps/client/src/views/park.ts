/** Park view: stadium upgrades, pricing sliders, sponsors, lighting vibe. */
import { CLASSES, STADIUM, VIBES, YARD, YARD_LIST, stadiumVal, yardTake, yardUseOf } from '@ballclub/engine';
import { esc } from '../ui/dom.js';
import { M } from '../ui/format.js';
import { ic } from '../ui/icons.js';
import { store } from '../app/store.js';
import { nextOpponent } from './club.js';

export function projectRevenue(ticket: number, con: number): { att: number; rev: number; home: boolean } {
  const L = store.league!;
  const me = store.me;
  const nxt = nextOpponent();
  const home = !nxt || nxt.home;
  const spon = me.sponsors.reduce((s, x) => s + x.base / L.weeks, 0);
  const mods = CLASSES[me.cls].mods;
  if (!home) {
    const event = yardTake(me);
    return { att: event.att, rev: Math.round(event.take * (mods.revenue || 1) + spon), home: false };
  }
  const cap = stadiumVal(me, 'seats', 'cap', 9000);
  const lightMul = stadiumVal(me, 'lights', 'att', 1);
  const conMul = stadiumVal(me, 'food', 'con', 1);
  const gp = me.w + me.l, wp = gp ? me.w / gp : 0.5, trust = me.fanTrust / 100;
  const priceFactor = Math.max(0.45, Math.min(1.2, 1.3 - ticket / 60));
  let att = cap * Math.max(0.12, Math.min(1, 0.4 + wp * 0.38 + (trust - 0.5) * 0.4 + (me.attBonus || 0))) * lightMul * priceFactor;
  att = Math.min(cap, Math.round(att));
  const homeGames = nxt ? nxt.games : 1.5;
  const gate = att * ticket * homeGames;
  const conc = att * con * homeGames * conMul * Math.max(0.45, Math.min(1.3, 1.3 - con / 34));
  const merch = att * homeGames * 2.1 * (0.6 + trust);
  return { att, rev: Math.round((gate + conc + merch) * (mods.revenue || 1) + spon), home: true };
}

export function viewPark(): string {
  const me = store.me;
  const cap = stadiumVal(me, 'seats', 'cap', 9000);
  const nxt = nextOpponent();
  const lastAway = me.wk.home === false;
  const lastAtt = lastAway ? (me.wk.yardAtt || 0) : (me.wk.att || 0);
  const lastLab = lastAway ? (me.wk.yardUse === 'lock' ? 'Locked' : 'Yard crowd') : 'Last gate';
  const lastSub = lastAway
    ? (me.wk.yardUse === 'lock' ? 'on the road' : (me.wk.yard ? M(me.wk.yard) + ' from the yard' : 'on the road'))
    : (cap ? Math.round((lastAtt / cap) * 100) + '% full' : 'seats');
  let s = `<div class="readout" style="margin-bottom:12px">
    <div class="ro-cell"><div class="k">Capacity</div><div class="v sm">${cap.toLocaleString()}</div><div class="s">seats</div></div>
    <div class="ro-cell"><div class="k">${lastLab}</div><div class="v sm">${lastAtt.toLocaleString()}</div><div class="s">${esc(lastSub)}</div></div>
    <div class="ro-cell"><div class="k">Cash</div><div class="v sm">${M(me.cash)}</div><div class="s">to spend</div></div>
  </div>`;

  if (nxt) {
    s += `<div class="panel" style="margin-bottom:12px">
      <div class="stand-tag ${nxt.home ? 'home' : 'road'}">${nxt.home ? 'Homestand' : 'Road series'}</div>
      <p class="road-note">${nxt.home
        ? 'This week the gate is yours — tickets, dogs, merch. ' + esc(nxt.opp.name) + ' comes to town.'
        : 'This week you play at ' + esc(nxt.opp.name) + '. The host keeps the gate. Book the yard below so the park is not a dark lot.'}</p>
    </div>`;
  }

  s += `<div class="eyebrow">The ballpark</div><div class="panel" style="padding-top:2px">`;
  STADIUM.forEach((spec) => {
    const lv = me.stadium[spec.key] || 0;
    const maxed = lv >= spec.levels.length - 1;
    const next = maxed ? null : spec.levels[lv + 1];
    const afford = next && me.cash >= next.cost;
    s += `<div class="build">
      <div class="bicon">${ic(spec.key)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <h3 style="font-size:15px">${esc(spec.name)}</h3>
          <span class="mq-lab">${maxed ? 'MAXED' : 'LV ' + lv}</span>
        </div>
        <div class="faint" style="font-size:12.5px;margin-top:2px">${esc(spec.levels[lv].note)}</div>
        <div class="pips">${spec.levels.map((_, i) => `<i class="pip ${i <= lv ? (maxed ? 'max' : 'on') : ''}"></i>`).join('')}</div>
        ${next ? `<button class="btn sm ${afford ? 'primary' : 'ghost'}" style="margin-top:9px" data-act="upgrade" data-k="${spec.key}" ${afford ? '' : 'disabled'}>
          ${esc(next.note)} · ${M(next.cost)}</button>` : ''}
      </div></div>`;
  });
  s += `</div>`;

  /* pricing */
  const proj = projectRevenue(me.ticket, me.conPrice);
  s += `<div class="eyebrow">Pricing <b>drag it</b></div>
    <div class="panel">
      <div class="slider" data-sl="ticket" data-min="6" data-max="55" data-val="${me.ticket}">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span class="mq-lab">Ticket</span><b class="num" id="slv-ticket" style="font-size:18px">$${me.ticket}</b></div>
        <div class="strack"><div class="rail"></div><div class="fill"></div><div class="knob"></div></div>
      </div>
      <div class="slider" data-sl="con" data-min="4" data-max="30" data-val="${me.conPrice}">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span class="mq-lab">Concessions per head</span><b class="num" id="slv-con" style="font-size:18px">$${me.conPrice}</b></div>
        <div class="strack"><div class="rail"></div><div class="fill"></div><div class="knob"></div></div>
      </div>
      <div class="hairline"></div>
      <div class="kv"><span class="k">${proj.home ? 'Projected crowd' : 'Projected yard crowd'}</span><b class="num" id="proj-att">${proj.att.toLocaleString()}</b></div>
      <div class="kv"><span class="k">Projected weekly take</span><b class="num amber" id="proj-rev">${M(proj.rev)}</b></div>
      <p class="faint" style="font-size:12.5px;margin-top:6px">${proj.home
        ? 'Push the ticket too high and the seats empty out. There is a peak; find it. Ticket and concessions only cash a homestand.'
        : 'Ticket and concessions do not cash this week — you are on the road. The take above is the yard booking plus sponsors.'}</p>
    </div>`;

  /* yard booking — earns while the club is away */
  const booked = yardUseOf(me);
  const revMul = CLASSES[me.cls].mods.revenue || 1;
  s += `<div class="eyebrow">The yard <b>on the road</b></div>
    <div class="panel">
      <p class="road-note">When the club leaves town the host keeps the gate. Book the park so the lights are not just sitting there.</p>
      <div class="yardgrid">`;
  YARD_LIST.forEach((k) => {
    const y = YARD[k];
    const prev = yardTake({ ...me, yardUse: k });
    const take = k === 'lock' ? 'No take' : 'About ' + M(Math.round(prev.take * revMul));
    s += `<button type="button" class="ycell${booked === k ? ' on' : ''}" data-act="yard" data-k="${k}">
      <div class="yt">${esc(y.name)}</div>
      <div class="yd">${esc(y.blurb)}</div>
      <div class="ym">${esc(take)}</div>
    </button>`;
  });
  s += `</div></div>`;

  /* sponsors */
  s += `<div class="eyebrow">Sponsors <b>${me.sponsors.length} signed</b></div><div class="panel">`;
  if (me.sponsors.length) {
    me.sponsors.forEach((sp) => {
      s += `<div style="padding:7px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <b>${esc(sp.name)}</b><span class="num ${sp.met === false ? 'neg' : 'pos'}">${M(sp.base)}/season</span></div>
        <div class="faint" style="font-size:12.5px">${esc(sp.req)} ${sp.met === false ? '· <span class="neg">not being met, paying 35%</span>' : ''}</div>
      </div>`;
    });
  } else s += `<p class="faint" style="font-size:13.5px">Nobody has put their name on the outfield wall yet.</p>`;
  s += `</div>`;

  if (me.sponsorOffers.length) {
    s += `<div class="eyebrow">On the table</div><div class="panel">`;
    me.sponsorOffers.forEach((o) => {
      s += `<div style="padding:9px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <b>${esc(o.name)}</b><span class="num amber">${M(o.offer)}/season</span></div>
        <div class="faint" style="font-size:12.5px;margin:2px 0 8px">${esc(o.req)}${o.penalty && o.penalty.trust ? ' · <span class="neg">costs ' + Math.abs(o.penalty.trust) + ' trust</span>' : ''}</div>
        <button class="btn sm ghost" data-act="sponsor" data-k="${esc(o.name)}">Sign it</button>
      </div>`;
    });
    s += `</div>`;
  }

  /* vibe */
  s += `<div class="eyebrow">Lighting</div>
    <div class="vibegrid" style="margin-bottom:14px">${Object.keys(VIBES).map((k) => {
      const v = VIBES[k];
      return `<button class="vcell${k === me.vibe ? ' on' : ''}" data-act="vibe" data-k="${k}">
        <canvas class="vsw" data-v="${k}" width="200" height="140"></canvas><div class="lb">${esc(v.name)}</div></button>`;
    }).join('')}</div>`;
  return s;
}
