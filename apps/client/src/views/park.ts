/** Park view: stadium upgrades, pricing sliders, sponsors, lighting vibe. */
import { CLASSES, STADIUM, VIBES, stadiumVal } from '@ballclub/engine';
import { esc } from '../ui/dom.js';
import { M } from '../ui/format.js';
import { ic } from '../ui/icons.js';
import { store } from '../app/store.js';

export function projectRevenue(ticket: number, con: number): { att: number; rev: number } {
  const L = store.league!;
  const me = store.me;
  const cap = stadiumVal(me, 'seats', 'cap', 9000);
  const lightMul = stadiumVal(me, 'lights', 'att', 1);
  const conMul = stadiumVal(me, 'food', 'con', 1);
  const gp = me.w + me.l, wp = gp ? me.w / gp : 0.5, trust = me.fanTrust / 100;
  const priceFactor = Math.max(0.45, Math.min(1.2, 1.3 - ticket / 60));
  let att = cap * Math.max(0.12, Math.min(1, 0.4 + wp * 0.38 + (trust - 0.5) * 0.4 + (me.attBonus || 0))) * lightMul * priceFactor;
  att = Math.min(cap, Math.round(att));
  const homeGames = 1.5;
  const gate = att * ticket * homeGames;
  const conc = att * con * homeGames * conMul * Math.max(0.45, Math.min(1.3, 1.3 - con / 34));
  const merch = att * homeGames * 2.1 * (0.6 + trust);
  const spon = me.sponsors.reduce((s, x) => s + x.base / L.weeks, 0);
  const mods = CLASSES[me.cls].mods;
  return { att, rev: Math.round((gate + conc + merch) * (mods.revenue || 1) + spon) };
}

export function viewPark(): string {
  const me = store.me;
  const cap = stadiumVal(me, 'seats', 'cap', 9000);
  let s = `<div class="readout" style="margin-bottom:12px">
    <div class="ro-cell"><div class="k">Capacity</div><div class="v sm">${cap.toLocaleString()}</div><div class="s">seats</div></div>
    <div class="ro-cell"><div class="k">Last gate</div><div class="v sm">${(me.wk.att || 0).toLocaleString()}</div><div class="s">${cap ? Math.round(((me.wk.att || 0) / cap) * 100) : 0}% full</div></div>
    <div class="ro-cell"><div class="k">Cash</div><div class="v sm">${M(me.cash)}</div><div class="s">to spend</div></div>
  </div>`;

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
      <div class="kv"><span class="k">Projected crowd</span><b class="num" id="proj-att">${proj.att.toLocaleString()}</b></div>
      <div class="kv"><span class="k">Projected weekly take</span><b class="num amber" id="proj-rev">${M(proj.rev)}</b></div>
      <p class="faint" style="font-size:12.5px;margin-top:6px">Push the ticket too high and the seats empty out. There is a peak; find it.</p>
    </div>`;

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
