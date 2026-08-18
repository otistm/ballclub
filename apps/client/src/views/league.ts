/** League view: office, standings, leaders, trophies, history, co-op panel. */
import {
  ACHIEVEMENTS, SKILLS, SKILL_INFO, TROPHIES, avg, era, isPitcher, rankTeams,
  type Player, type Team
} from '@ballclub/engine';
import { esc } from '../ui/dom.js';
import { ord, pctS } from '../ui/format.js';
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
    s += `<tr class="${t.id === me.id ? 'me' : ''} ${i === 3 ? 'cut' : ''}">
      <td style="text-align:left"><i class="sq" style="background:${t.color}"></i></td>
      <td>${esc(t.abbr)} <span class="faint" style="font-size:11px">${esc(t.mascot)}</span></td>
      <td>${t.w}</td><td>${t.l}</td><td>${gp ? pctS(t.w / gp) : '.000'}</td>
      <td class="${t.rf - t.ra >= 0 ? 'pos' : 'neg'}">${t.rf - t.ra > 0 ? '+' : ''}${t.rf - t.ra}</td></tr>`;
  });
  s += `</tbody></table></div>`;

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
  s += `<div class="eyebrow">The league <b>${net.mode === 'shared' ? 'shared' : 'solo'}</b></div>
    <div class="panel">
      <div id="codebar" style="margin-bottom:12px">
        <div style="flex:1"><div class="mq-lab">Invite code</div><div class="c">${esc(L.code || '------')}</div></div>
        <button class="chip" data-act="copycode">Copy</button>
      </div>
      <p class="faint" style="font-size:13px;line-height:1.45">
        This world runs on a fixed seed and an ordered log of every move you make, so any device holding the same
        two things can rebuild it exactly. That is the groundwork for handing the other seven clubs to friends.
        Right now those seven are run by the house.</p>
      <div class="kv" style="margin-top:8px"><span class="k">Seed</span><b class="num">${L.seed}</b></div>
      <div class="kv"><span class="k">Moves logged</span><b class="num">${store.seq}</b></div>
      <div class="kv"><span class="k">Open seats</span><b class="num">7</b></div>
    </div>
    <button class="btn ghost sm" data-act="newgame" style="margin-top:4px">Abandon this club and start over</button>`;
  return s;
}
