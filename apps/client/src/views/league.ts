/** League view: office, standings, leaders, trophies, history, co-op panel. */
import {
  ACHIEVEMENTS, SKILLS, SKILL_INFO, STAFF_LABELS, STAFF_ROLES, TROPHIES, avg, era, isPitcher, rankTeams, staffHireCost,
  type Player, type Team
} from '@ballclub/engine';
import { esc } from '../ui/dom.js';
import { M, ord, pctS } from '../ui/format.js';
import { ic } from '../ui/icons.js';
import { store } from '../app/store.js';
import { net } from '../app/net.js';
import { xpBarHtml } from './helpers.js';

interface LeaderRow {
  n: string;
  t: string;
  v: string | number;
  me: boolean;
}

export function viewLeague(): string {
  const L = store.league!;
  const me = store.me;
  const ranked = rankTeams(L);
  const prog = me.progress;
  let s = '';

  s += `<div class="eyebrow">The office <b>GM ${prog?.level || 1}</b></div>
    <div class="panel office">
      ${xpBarHtml(me)}
      <p class="faint" style="font-size:13px;line-height:1.45;margin-bottom:8px">
        Players earning the club nights put points on your ledger. Spend them to get sharper at the work
        — scouting files, the press, deals, the farm, the house.
        ${prog && prog.unspent ? ' You have <b class="amber">' + prog.unspent + '</b> to place.' : ''}
      </p>`;
  SKILLS.forEach((k) => {
    const rank = prog?.skills[k] || 0;
    const info = SKILL_INFO[k];
    const can = !!(prog && prog.unspent > 0 && rank < 10);
    s += `<div class="skill">
      <div class="skill-top">
        <div class="skill-copy">
          <div class="skill-name">${esc(info.name)}</div>
          <div class="skill-blurb">${esc(info.blurb)}</div>
        </div>
        <button class="skill-plus${can ? '' : ' off'}" data-act="spendskill" data-k="${k}" ${can ? '' : 'disabled'}>+</button>
      </div>
      <div class="skill-dots" aria-label="${info.tag} ${rank} of 10">
        ${Array.from({ length: 10 }, (_, i) => `<i class="sdot${i < rank ? ' on' : ''}"></i>`).join('')}
      </div>
    </div>`;
  });
  s += `</div>`;

  /* front office staff — hire bumps beyond class start */
  const payroll = me.roster.reduce((n, p) => n + p.salary, 0);
  s += `<div class="eyebrow">The staff <b>${M(payroll)} payroll</b></div>
    <div class="panel">
      <p class="faint" style="font-size:13px;line-height:1.45;margin-bottom:8px">
        Class sets the opening office. Cash buys better help — scout, coach, trainer, analyst.
        ${me.wk?.luxury ? ' Luxury tax is biting this week (' + M(me.wk.luxury) + ').' : ' Soft tax kicks in over $2.4M annual payroll.'}
      </p>`;
  STAFF_ROLES.forEach((role) => {
    const lv = me.staff[role] || 0;
    const cost = staffHireCost(me, role);
    const can = me.cash >= cost && lv < 94;
    s += `<div class="kv">
      <span class="k" data-act="staff" data-k="${role}" style="cursor:pointer;border-bottom:1px solid rgba(255,255,255,.18)">
        ${esc(STAFF_LABELS[role])} <span class="faint">${lv}</span>
      </span>
      <button class="chip${can ? '' : ' off'}" data-act="hirestaff" data-k="${role}" ${can ? '' : 'disabled'}>Hire · ${M(cost)}</button>
    </div>`;
  });
  s += `</div>`;

  /* friends' tape — other human series still on the wire */
  if (net.mode === 'shared' && (L.myPbp || []).length) {
    const seen = new Set<string>();
    const tapes: { homeId: string; awayId: string; label: string }[] = [];
    (L.myPbp || []).forEach((m) => {
      const key = m.homeId + ':' + m.awayId;
      if (seen.has(key)) return;
      seen.add(key);
      const involvesMe = m.homeId === me.id || m.awayId === me.id;
      if (involvesMe) return;
      const h = L.teams.find((t) => t.id === m.homeId);
      const a = L.teams.find((t) => t.id === m.awayId);
      if (!h || !a) return;
      if (!h.isHuman && !a.isHuman) return;
      tapes.push({ homeId: m.homeId, awayId: m.awayId, label: h.abbr + ' vs ' + a.abbr });
    });
    if (tapes.length) {
      s += `<div class="eyebrow">Friends' tape <b>this week</b></div><div class="panel">`;
      tapes.forEach((t) => {
        s += `<div class="kv"><span class="k">${esc(t.label)}</span>
          <button class="chip" data-act="watchtape" data-home="${t.homeId}" data-away="${t.awayId}">Watch</button></div>`;
      });
      s += `</div>`;
    }
  }

  s += `<div class="eyebrow">Achievements <b>${prog?.achievements.length || 0} of ${ACHIEVEMENTS.length}</b></div>
    <div class="tgrid achgrid" style="margin-bottom:14px">`;
  ACHIEVEMENTS.forEach((a) => {
    const owned = !!(prog && prog.achievements.indexOf(a.id) >= 0);
    s += `<div class="troph ${owned ? 'won' : ''}" data-act="achieve" data-k="${a.id}">
      ${ic(a.icon)}<div class="nm">${esc(a.name)}</div>
      ${owned ? `<span class="cnt">+${a.xp}</span>` : ''}
    </div>`;
  });
  s += `</div>`;

  s += `<div class="eyebrow">Standings <b>top four make it</b></div><div class="panel">
    <table class="stand"><thead><tr><th></th><th>Club</th><th>W</th><th>L</th><th>PCT</th><th>DIFF</th></tr></thead><tbody>`;
  ranked.forEach((t, i) => {
    const gp = t.w + t.l;
    s += `<tr class="tap ${t.id === me.id ? 'me' : ''} ${i === 3 ? 'cut' : ''}" data-act="standingteam" data-id="${t.id}">
      <td style="text-align:left"><i class="sq" style="background:${t.color}"></i></td>
      <td>${esc(t.abbr)} <span class="faint" style="font-size:11px">${esc(t.mascot)}</span></td>
      <td>${t.w}</td><td>${t.l}</td><td>${gp ? pctS(t.w / gp) : '.000'}</td>
      <td class="${t.rf - t.ra >= 0 ? 'pos' : 'neg'}">${t.rf - t.ra > 0 ? '+' : ''}${t.rf - t.ra}</td></tr>`;
  });
  s += `</tbody></table>
    <p class="faint" style="font-size:11px;margin-top:8px;font-family:var(--mono);letter-spacing:.08em">TAP A CLUB FOR THE TAPE</p>
  </div>`;

  /* leaders */
  const all: { p: Player; t: Team }[] = [];
  L.teams.forEach((t) => t.roster.forEach((p) => all.push({ p, t })));
  const bat = all.filter((x) => !isPitcher(x.p) && x.p.st.ab >= Math.max(20, L.week * 6));
  const pit = all.filter((x) => isPitcher(x.p) && x.p.pst.outs >= Math.max(15, L.week * 6));
  const board = (title: string, rows: LeaderRow[]): string => {
    if (!rows.length) return '';
    return `<div class="eyebrow">${title}</div><div class="panel"><div class="leaders">` +
      rows.map((r) => `<div class="nm ${r.me ? 'tm' : ''}">${esc(r.n)} <span class="faint">${esc(r.t)}</span></div><div class="num">${r.v}</div>`).join('') +
      `</div></div>`;
  };
  const mk = (
    arr: { p: Player; t: Team }[],
    f: (p: Player) => number,
    fmt: (p: Player) => string | number,
    n?: number
  ): LeaderRow[] =>
    arr.slice().sort((a, b) => f(b.p) - f(a.p)).slice(0, n || 4)
      .map((x) => ({ n: x.p.name, t: x.t.abbr, v: fmt(x.p), me: x.t.id === me.id }));
  if (bat.length) {
    s += board('Home runs', mk(bat, (p) => p.st.hr, (p) => p.st.hr));
    s += board('Batting average', mk(bat, (p) => avg(p), (p) => pctS(avg(p))));
  }
  if (pit.length) {
    s += board('Earned run average', pit.slice().sort((a, b) => era(a.p) - era(b.p)).slice(0, 4)
      .map((x) => ({ n: x.p.name, t: x.t.abbr, v: era(x.p).toFixed(2), me: x.t.id === me.id })));
    s += board('Strikeouts', mk(pit, (p) => p.pst.k, (p) => p.pst.k));
  }

  /* trophy case */
  s += `<div class="eyebrow">Trophy case <b>${me.trophies.length} earned</b></div><div class="tgrid" style="margin-bottom:14px">`;
  TROPHIES.forEach((t) => {
    const owned = me.trophies.filter((x) => x.key === t.key);
    s += `<div class="troph ${owned.length ? 'won' : ''}" data-act="trophy" data-k="${t.key}">
      ${owned.length ? '<i class="shine"></i>' : ''}
      ${owned.length > 1 ? `<span class="cnt">${owned.length}</span>` : ''}
      ${ic('trophy')}<div class="nm">${esc(t.name)}</div></div>`;
  });
  s += `</div>`;

  /* history */
  if (me.history.length) {
    s += `<div class="eyebrow">Franchise record</div><div class="panel feed">`;
    me.history.slice().reverse().forEach((h) => {
      s += `<div class="fitem"><div class="w">Y${h.season}</div><div class="x">${h.w}-${h.l} · finished ${ord(h.rank)}${h.champ ? ' · <span class="amber">CHAMPIONS</span>' : ''}</div></div>`;
    });
    s += `</div>`;
  }

  /* co-op */
  const openSeats = L.teams.filter((t) => !t.isHuman).length;
  const humans = L.teams.filter((t) => t.isHuman);
  s += `<div class="eyebrow">The league <b>${net.mode === 'shared' ? 'shared' : 'solo'}</b></div>
    <div class="panel">
      <div id="codebar" style="margin-bottom:12px">
        <div style="flex:1"><div class="mq-lab">Invite code</div><div class="c">${esc(L.code || '------')}</div></div>
        <button class="chip" data-act="copycode">Copy</button>
      </div>
      <p class="faint" style="font-size:13px;line-height:1.45">
        ${net.mode === 'shared'
    ? 'Friends join with this code. Away clubs keep moving through the idle GM. The calendar waits until every human clears the desk.'
    : 'This world runs on a fixed seed and an ordered log. Host a shared league from the start screen to hand seats to friends.'}</p>
      <div class="kv" style="margin-top:8px"><span class="k">Seed</span><b class="num">${L.seed}</b></div>
      <div class="kv"><span class="k">Moves logged</span><b class="num">${store.seq}</b></div>
      <div class="kv"><span class="k">Human clubs</span><b class="num">${humans.length}</b></div>
      <div class="kv"><span class="k">Open seats</span><b class="num">${openSeats}</b></div>
    </div>
    <button class="btn ghost sm" data-act="newgame" style="margin-top:4px">Abandon this club and start over</button>`;
  return s;
}
