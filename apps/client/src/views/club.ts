/** Club view: readout, desk scenario deck, next series, board note, feed. */
import { CLASSES, draftStatus, nextScenario, rankTeams, ROSTER_MAX, type League, type Team } from '@ballclub/engine';
import { esc } from '../ui/dom.js';
import { M, pctS } from '../ui/format.js';
import { mark } from '../ui/icons.js';
import { store } from '../app/store.js';
import { xpBarHtml } from './helpers.js';

export interface NextOpp {
  home: boolean;
  opp: Team;
  games: number;
}

export function nextOpponent(): NextOpp | null {
  const L = store.league!;
  const me = store.me;
  if (L.week >= L.weeks) return null;
  const pr = L.schedule[L.week].find((p) => p.home === me.id || p.away === me.id);
  if (!pr) return null;
  const home = pr.home === me.id;
  return { home, opp: L.teams.find((t) => t.id === (home ? pr.away : pr.home))!, games: pr.games };
}

function mandateText(L: League, me: Team): string {
  const c = CLASSES[me.cls];
  const gp = me.w + me.l;
  if (L.phase === 'draft') return 'Fill the roster. Do not come back with a club full of first basemen.';
  if (gp === 0) return 'They hired you because you said something in the interview that stuck. Finish above .500 and nobody asks what it was.';
  const wp = me.w / gp;
  if (me.cash < 400000) return 'A note from accounting: the cash position is thin. Raise the gate, cut payroll, or sell someone.';
  if (wp >= 0.6) return 'They are printing playoff tickets. Do not let them down.';
  if (wp >= 0.5) return 'Steady. Keep it above .500 and the board stays quiet.';
  if (wp >= 0.4) return 'The board has noticed the record. They have not said anything. That is worse.';
  return 'Someone in the owners box asked what a ' + c.name.toLowerCase() + ' actually does all day.';
}

export function viewClub(): string {
  const L = store.league!;
  const me = store.me;
  const pending = !!me.deskPending;
  const rank = me.rank, gp = me.w + me.l;
  let s = '';

  /* pull-to-play affordance lives at the very top of the scroller */
  if (L.phase === 'regular') {
    s += `<div id="pull"><div id="pullin"><div class="ring"></div><div class="lab" id="pulllab">pull to play</div></div></div>`;
  }

  if (L.phase === 'draft') {
    const st = draftStatus(L, me.id);
    const onClock = st.cur ? L.teams.find((t) => t.id === st.cur!.teamId) : null;
    s += `<div class="readout" style="margin-bottom:12px">
      <div class="ro-cell"><div class="k">${st.mine ? 'Your pick' : 'Waiting'}</div><div class="v">${st.cur ? st.overall : '—'}</div><div class="s">${st.cur ? 'of ' + st.total : 'done'}</div></div>
      <div class="ro-cell"><div class="k">Round</div><div class="v">${st.cur ? st.cur.round : L.draftRounds}</div><div class="s">${st.yoursLeft} left for you</div></div>
      <div class="ro-cell"><div class="k">Roster</div><div class="v">${me.roster.length}</div><div class="s">of ${ROSTER_MAX}</div></div>
    </div>
    ${xpBarHtml(me, true)}
    <div class="panel">
      <div class="eyebrow">The draft</div>
      <p class="dim">${st.mine
        ? 'You are up. Names are in the Market tab — take one, or flip to the next.'
        : (onClock ? esc(onClock.name) + ' is picking. Open Market when you want to run their turns.' : 'The draft is finished.')}</p>
      <button class="btn primary" style="margin-top:11px" data-act="tab" data-k="market">${st.mine ? 'Take your pick' : 'Open the draft'}</button>
    </div>`;
  } else {
    s += `<div class="readout" style="margin-bottom:12px">
    <div class="ro-cell"><div class="k">Record</div><div class="v">${me.w}-${me.l}</div><div class="s">${gp ? pctS(me.w / gp) : '.000'}</div></div>
    <div class="ro-cell"><div class="k">Place</div><div class="v">${rank}</div><div class="s">of 8</div></div>
    <div class="ro-cell"><div class="k">Cash</div><div class="v sm" id="cashv">${M(me.cash)}</div><div class="s ${me.wk.net >= 0 ? 'pos' : 'neg'}">${me.wk.net ? (me.wk.net > 0 ? '+' : '') + M(me.wk.net) + '/wk' : 'week 1'}</div></div>
    <div class="ro-cell"><div class="k">Trust</div><div class="v">${Math.round(me.fanTrust)}</div><div class="s">${me.wk.att ? me.wk.att.toLocaleString() + ' seats' : 'no gate yet'}</div></div>
  </div>
  ${xpBarHtml(me, true)}`;
  }

  /* front-office matter (swipe deck) */
  if (L.phase === 'regular' && pending) {
    const sc = nextScenario(L, me);
    if (sc) {
      s += `<div class="eyebrow">On your desk <b>decide</b></div>
      <div class="swipehint">← swipe the card →</div>
      <div class="deck" id="scdeck">
        <div class="dcard" id="sccard">
          <div class="dcard-in">
            <div class="tag"><span>${esc(sc.tag)}</span><span>WEEK ${L.week + 1}</span></div>
            <h2>${esc(sc.title)}</h2>
            <div class="body">${esc(sc.body)}</div>
            <div class="dchoice">
              <button data-act="scchoice" data-k="left"><div class="ar">← left</div><div class="lb">${esc(sc.left.label)}</div></button>
              <button data-act="scchoice" data-k="right"><div class="ar">right →</div><div class="lb">${esc(sc.right.label)}</div></button>
            </div>
            <div class="stamp l" id="stampL">${esc(sc.left.label)}</div>
            <div class="stamp r" id="stampR">${esc(sc.right.label)}</div>
          </div>
        </div>
      </div>`;
    }
  }

  /* next series / phase control */
  if (L.phase === 'playoffs') {
    const seeds = rankTeams(L).slice(0, 4);
    s += `<div class="panel"><div class="eyebrow">Postseason <b>four clubs left</b></div>
      ${seeds.map((t, i) => `<div class="kv"><span class="k">${i + 1} seed</span><b class="${t.id === me.id ? 'tm' : ''}">${esc(t.name)}  ${t.w}-${t.l}</b></div>`).join('')}
      <button class="btn bulb" style="margin-top:12px" data-act="playoffs">${seeds.some((t) => t.id === me.id) ? 'Play the postseason' : 'Watch it happen'}</button></div>`;
  } else if (L.phase === 'offseason') {
    s += `<div class="panel"><div class="eyebrow">Offseason <b>year ${L.season} in the books</b></div>
      <p class="dim">Contracts are up. Old men are retiring. A new draft class is coming.</p>
      <button class="btn bulb" style="margin-top:12px" data-act="offseason">Open the offseason</button></div>`;
  } else if (L.phase === 'regular') {
    const n = nextOpponent();
    if (n) {
      s += `<div class="panel">
        <div class="eyebrow">Week ${L.week + 1} of ${L.weeks} <b>${n.games}-game series</b></div>
        <div style="display:flex;align-items:center;gap:12px">
          ${mark(n.opp.glyph, n.opp.color)}
          <div style="flex:1">
            <div class="mq-lab">${n.home ? 'At home against' : 'On the road at'}</div>
            <h3 style="margin-top:2px">${esc(n.opp.name)}</h3>
            <div class="pmeta"><span>${n.opp.w}-${n.opp.l}</span><span>${esc(CLASSES[n.opp.cls].name)}</span></div>
          </div>
        </div>
        <button class="btn primary" style="margin-top:12px" data-act="series" ${pending ? 'disabled' : ''}>
          ${pending ? 'Settle your desk first' : 'Play the series'}</button>
        <div class="faint" style="text-align:center;font-size:11px;margin-top:8px;font-family:var(--mono);letter-spacing:.1em">OR PULL DOWN FROM THE TOP</div>
      </div>`;
    }
  }

  /* ownership note — skip during the draft so "the board" is not two things */
  if (L.phase !== 'draft') {
    s += `<div class="panel paper">
    <div class="eyebrow">From ownership</div>
    <div style="font-size:15px;line-height:1.45;color:#31352C">${esc(mandateText(L, me))}</div>
  </div>`;
  }

  /* last series */
  const last = L.results[L.results.length - 1];
  if (last) {
    const mine = last.games.filter((gm) => gm.homeId === me.id || gm.awayId === me.id);
    if (mine.length) {
      s += `<div class="eyebrow">Last series <b>week ${last.week}</b></div><div class="panel">`;
      mine.forEach((gm) => {
        const home = gm.homeId === me.id;
        const my = home ? gm.homeRuns : gm.awayRuns, th = home ? gm.awayRuns : gm.homeRuns;
        const opp = L.teams.find((t) => t.id === (home ? gm.awayId : gm.homeId))!;
        s += `<div class="res ${my > th ? 'win' : 'loss'}">
          <div class="sc">${my}</div><div class="vs">${home ? 'vs' : '@'}</div><div class="sc">${th}</div>
          <div class="nm">${esc(opp.name)}</div>
          <div class="vs">${gm.innings > 9 ? gm.innings + ' INN' : ''}${gm.walkoff ? ' WALK-OFF' : ''}</div></div>`;
      });
      s += `</div>`;
    }
  }

  /* franchise feed */
  const feed = L.phase === 'draft'
    ? L.log.filter((x) => x.draft).slice(-8).reverse()
    : L.log.slice(-9).reverse().filter((x) => !x.draft);
  if (feed.length) {
    s += `<div class="eyebrow">${L.phase === 'draft' ? 'Picked already' : 'Around the club'}</div><div class="panel feed">`;
    feed.forEach((f) => {
      s += `<div class="fitem"><div class="w">${L.phase === 'draft' ? 'R' + (f.round || '-') : 'W' + (f.w || '-')}</div><div class="x">${esc(f.txt)}</div></div>`;
    });
    s += `</div>`;
  }
  return s;
}
