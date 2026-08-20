/** Bottom-sheet content: player card, full draft board, series recap, playoffs, offseason. */
import {
  ROSTER_MAX, STAFF_INFO, TRAITS, TROPHIES, YARD,
  avg, draftCurrent, era, fmtIP, isPitcher, obp, shownOvr, slg, staffHireCost, value,
  type Bracket, type GameSummary, type MyPbp, type OffseasonReport, type PbpEvent,
  type SeasonLogHit, type SeasonLogPit, type SeriesResult, type StaffRole
} from '@ballclub/engine';
import { esc, openSheet, printReceipt } from '../ui/dom.js';
import { M, pctS, cssColor } from '../ui/format.js';
import { store } from '../app/store.js';
import { findPlayer, meFog, ratingBars } from './helpers.js';
import { boardOrder } from './market.js';

export function playerSheet(id: string): void {
  const L = store.league!;
  const me = store.me;
  const p = findPlayer(L, me.roster, id);
  if (!p) return;
  const mine = me.roster.some((x) => x.id === id);
  const so = shownOvr(p, meFog(), store.me);
  const isP = isPitcher(p);
  const owner = L.teams.find((t) => t.roster.some((x) => x.id === id));
  const traits = p.traits.map((t) => TRAITS.find((x) => x.key === t)).filter((t): t is NonNullable<typeof t> => Boolean(t));

  let s = `<div style="display:flex;align-items:flex-start;gap:12px">
    <div class="ppos${isP ? ' p' : ''}" style="width:44px;height:44px;font-size:12px">${p.pos}</div>
    <div style="flex:1;min-width:0">
      <h2 style="font-size:26px">${esc(p.name)}</h2>
      <div class="pmeta" style="margin-top:4px">
        <span>${p.age} years old</span><span>bats ${p.bats}</span>
        <span>${owner ? esc(owner.abbr) : 'free agent'}</span>
        ${p.origin === 'draft' ? '<span class="amber">drafted</span>' : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-family:var(--dsp);font-size:38px;line-height:.9;color:${so.exact ? 'var(--team)' : 'var(--manila)'}">${so.exact ? so.v : so.lo + '–' + so.hi}</div>
      <div class="mq-lab">${so.exact ? 'overall' : 'estimate'}</div>
    </div></div>`;

  s += `<div class="panel" style="margin-top:14px">${ratingBars(p)}`;
  if (so.exact && p.pot > p.ovr) {
    s += `<div class="hairline"></div><div class="kv"><span class="k">Ceiling</span><b class="amber">${p.pot}</b></div>`;
  }
  if (!so.exact) s += `<div class="hairline"></div><div class="faint" style="font-size:13px">Your scouts have not finished on this one. Send them in from the Market tab.</div>`;
  s += `</div>`;

  if (traits.length) {
    s += `<div class="eyebrow">Traits</div><div class="panel">`;
    traits.forEach((t) => {
      s += `<div style="margin-bottom:7px"><b>${esc(t.name)}</b><div class="faint" style="font-size:13px">${esc(t.desc)}</div></div>`;
    });
    s += `</div>`;
  }

  const st = p.st, pst = p.pst;
  const hasStats = isP ? pst.outs > 0 : st.pa > 0;
  if (hasStats) {
    s += `<div class="eyebrow">This season</div><div class="panel">`;
    if (isP) {
      s += `<div class="kv"><span class="k">W-L / SV</span><b>${pst.w}-${pst.l} / ${pst.sv}</b></div>
        <div class="kv"><span class="k">Innings</span><b>${fmtIP(p)}</b></div>
        <div class="kv"><span class="k">ERA</span><b>${era(p).toFixed(2)}</b></div>
        <div class="kv"><span class="k">K / BB</span><b>${pst.k} / ${pst.bb}</b></div>`;
    } else {
      s += `<div class="kv"><span class="k">Games</span><b>${st.g}</b></div>
        <div class="kv"><span class="k">AVG / OBP / SLG</span><b>${pctS(avg(p))} / ${pctS(obp(p))} / ${pctS(slg(p))}</b></div>
        <div class="kv"><span class="k">HR / RBI</span><b>${st.hr} / ${st.rbi}</b></div>
        <div class="kv"><span class="k">SB</span><b>${st.sb}</b></div>`;
    }
    s += `</div>`;
  }
  if (p.seasonLog && p.seasonLog.length) {
    s += `<div class="eyebrow">Career</div><div class="panel feed">`;
    p.seasonLog.slice().reverse().forEach((y) => {
      s += `<div class="fitem"><div class="w">Y${y.s}</div><div class="x">${isP
        ? (() => { const yp = y as SeasonLogPit; return `${yp.ip} IP · ${yp.era} ERA · ${yp.k} K · ${yp.w}-${yp.l}`; })()
        : (() => { const yh = y as SeasonLogHit; return `${yh.g} G · ${pctS(yh.avg)} · ${yh.hr} HR · ${yh.rbi} RBI`; })()}</div></div>`;
    });
    s += `</div>`;
  }

  s += `<div class="eyebrow">Contract</div><div class="panel">
    <div class="kv"><span class="k">Salary</span><b>${M(p.salary)}</b></div>
    <div class="kv"><span class="k">Years left</span><b>${Math.max(0, p.years)}</b></div>
    <div class="kv"><span class="k">Condition</span><b>${Math.round(p.cond)}%</b></div>
    <div class="kv"><span class="k">Morale</span><b>${Math.round(p.morale)}</b></div>
    <div class="kv"><span class="k">Trade value</span><b>${Math.round(value(p))}</b></div>
  </div>`;

  if (mine) {
    if (me.sellLockSeason === L.season) {
      s += `<p class="dim" style="margin-top:12px">Ownership froze sales this year. He stays until October.</p>`;
    } else {
      s += `<button class="btn danger" data-act="release" data-id="${p.id}">Release · dead money ${M(Math.round(p.salary * 0.35))}</button>`;
    }
  } else if (L.freeAgents.some((x) => x.id === id)) {
    s += `<button class="btn primary" data-act="signfa" data-id="${p.id}">Sign · bonus ${M(Math.round(p.salary * 0.5))} · 1 action</button>`;
  }
  openSheet(s);
  setTimeout(() => {
    document.querySelectorAll<HTMLElement>('#sheetbody .bar .f').forEach((el) => {
      const w = el.style.width;
      el.style.width = '0%';
      requestAnimationFrame(() => {
        el.style.width = w;
      });
    });
  }, 60);
}

export function fullBoard(): void {
  const L = store.league!;
  const me = store.me;
  const cur = draftCurrent(L);
  const onClock = L.phase === 'draft' && !!cur && cur.teamId === me.id;
  const board = boardOrder().slice(0, 40);
  let s = `<div class="eyebrow">Remaining names <b>${L.draftPool.length} left</b></div>
    <p class="faint" style="font-size:13px;margin-bottom:10px">${onClock
      ? 'Sorted by how your staff grades them. Tap a name to take him with this pick.'
      : 'Sorted by how your staff grades them. You pick when the clock comes back to you.'}</p>
    <div class="panel" style="padding-top:4px">`;
  board.forEach((p, i) => {
    const so = shownOvr(p, meFog(), store.me);
    s += `<div class="prow" data-act="${onClock ? 'draftpick' : 'player'}" data-id="${p.id}">
      <div class="ppos${isPitcher(p) ? ' p' : ''}">${p.pos}</div>
      <div class="pinfo"><div class="pname">${esc(p.name)}</div>
        <div class="pmeta"><span>staff ${i + 1}</span><span>${p.age}y</span><span>${M(p.salary)}</span></div></div>
      <div class="povr ${so.exact ? '' : 'fog'}">${so.exact ? so.v : so.lo + '-' + so.hi}<small>ovr</small></div></div>`;
  });
  s += `</div>`;
  openSheet(s);
}

function rcptRow(left: string, right = '', kind = ''): string {
  return `<div class="rcpt-row${kind ? ' ' + kind : ''}"><span>${esc(left)}</span><span>${esc(right)}</span></div>`;
}

export function seriesRecap(
  games: GameSummary[],
  pbps: MyPbp[],
  wins: number,
  opts?: { week?: number; archive?: boolean }
): void {
  const L = store.league!;
  const me = store.me;
  const w = me.wk;
  const week = opts?.week ?? L.week;
  const archive = !!opts?.archive;
  const losses = games.length - wins;
  const headline = wins > losses ? 'SERIES WON' : wins === losses ? 'SERIES SPLIT' : 'SERIES LOST';
  const stamp = wins > losses ? 'FILE' : wins === losses ? 'HOLD' : 'SEE BOARD';
  const homeStand = games.length ? games[0].homeId === me.id : w.home !== false;
  const opp = games.length
    ? L.teams.find((t) => t.id === (homeStand ? games[0].awayId : games[0].homeId)) || null
    : null;

  let s = `<div class="rcpt-sprocket" aria-hidden="true"></div>
    <div class="rcpt-ink">
      <div class="rcpt-perf"></div>
      <div class="rcpt-brand">BALLCLUB</div>
      <div class="rcpt-meta">PRESS BOX COPY</div>
      ${rcptRow('CLUB', me.abbr)}
      ${rcptRow('YEAR ' + L.season, 'WEEK ' + week + ' OF ' + L.weeks)}
      ${rcptRow(homeStand ? 'HOMESTAND' : 'ROAD SERIES', opp ? ((homeStand ? 'VS ' : '@ ') + opp.abbr) : '')}
      <div class="rcpt-rule"></div>
      <div class="rcpt-head">${esc(headline)}</div>
      ${rcptRow('GAMES', wins + '-' + losses)}
      <div class="rcpt-rule"></div>
      <div class="rcpt-sec">BOX</div>`;

  games.forEach((gm, i) => {
    const home = gm.homeId === me.id;
    const my = home ? gm.homeRuns : gm.awayRuns;
    const th = home ? gm.awayRuns : gm.homeRuns;
    const opp = L.teams.find((t) => t.id === (home ? gm.awayId : gm.homeId))!;
    const flag = gm.walkoff ? ' WO' : gm.innings > 9 ? ' ' + gm.innings + 'INN' : '';
    const mark = my > th ? 'W' : 'L';
    s += rcptRow(
      'G' + (i + 1) + ' ' + (home ? 'VS' : '@') + ' ' + opp.abbr,
      my + '-' + th + '  ' + mark + flag,
      my > th ? 'win' : 'loss'
    );
    if (gm.wp) s += rcptRow('  WP ' + gm.wp, '');
  });

  const big: PbpEvent[] = [];
  pbps.forEach((p) => (p.pbp || []).forEach((e) => { if (e.big) big.push(e); }));
  if (big.length) {
    s += `<div class="rcpt-rule"></div><div class="rcpt-sec">HIGHLIGHTS</div>`;
    big.slice(-6).forEach((e) => {
      s += rcptRow('INN ' + e.inn, '');
      s += `<div class="rcpt-note">${esc(e.txt)}</div>`;
    });
  }

  if (!archive) {
    const use = w.yardUse || 'open';
    s += `<div class="rcpt-rule"></div>
      <div class="rcpt-sec">THE GATE</div>`;
    if (homeStand) {
      s += `
      ${rcptRow('ATTENDANCE', (w.att || 0).toLocaleString() + (w.sellout ? ' *' : ''))}
      ${rcptRow('TICKETS', M(w.gate || 0))}
      ${rcptRow('CONCESSIONS', M(w.conc || 0))}
      ${rcptRow('MERCH', M(w.merch || 0))}`;
    } else {
      s += `
      ${rcptRow('TICKETS', 'HOST')}
      ${rcptRow('CONCESSIONS', 'HOST')}
      ${rcptRow('MERCH', 'HOST')}
      <div class="rcpt-note">Road series. The host keeps tickets, concessions, and merch.</div>
      <div class="rcpt-rule"></div>
      <div class="rcpt-sec">THE YARD</div>
      ${rcptRow(YARD[use].receipt, (w.yard || 0) > 0 ? M(w.yard || 0) : '—')}
      ${w.yardAtt ? rcptRow('EVENT CROWD', w.yardAtt.toLocaleString()) : ''}`;
    }
    s += `
      ${rcptRow('SPONSORS', M(w.sponsor || 0))}
      <div class="rcpt-dots"></div>
      ${rcptRow('PAYROLL', '-' + M(w.payroll || 0))}
      ${rcptRow('STAFF/UPKEEP', '-' + M((w.cost || 0) - (w.payroll || 0)))}
      <div class="rcpt-rule dbl"></div>
      ${rcptRow('NET', (w.net >= 0 ? '+' : '') + M(w.net || 0), w.net >= 0 ? 'pos' : 'neg')}
      ${w.sellout ? `<div class="rcpt-note">* SELLOUT</div>` : ''}`;

    const notes = me.progress?.weekNotes || [];
    const weekXp = me.progress?.weekXp || 0;
    if (weekXp || notes.length) {
      s += `<div class="rcpt-rule"></div>
        <div class="rcpt-sec">THE LEDGER</div>
        ${notes.map((n) => rcptRow(n.why.toUpperCase(), '+' + n.n)).join('')}
        <div class="rcpt-dots"></div>
        ${rcptRow('WEEK XP', '+' + weekXp, 'pos')}
        ${rcptRow('GM', String(me.progress?.level || 1))}`;
    }
  }

  s += `
    <div class="rcpt-rule"></div>
    <div class="rcpt-meta">${esc(stamp)}  ·  KEEP THIS COPY</div>
    <div class="rcpt-tear-line"></div>
    <button class="rcpt-tear" data-act="closesheet">TEAR ALONG PERFORATION</button>
    </div>
    <div class="rcpt-sprocket" aria-hidden="true"></div>`;

  printReceipt(s);
}

export function playoffSheet(br: Bracket): void {
  const L = store.league!;
  const me = store.me;
  const champ = L.teams.find((t) => t.id === br.champId)!;
  const won = champ.id === me.id;
  const line = (sr: SeriesResult): string => {
    const a = L.teams.find((t) => t.id === sr.aId)!, b = L.teams.find((t) => t.id === sr.bId)!;
    const winner = L.teams.find((t) => t.id === sr.winnerId)!;
    return `<div class="res ${sr.winnerId === me.id ? 'win' : ''}">
      <div class="sc">${sr.aw}</div><div class="vs">v</div><div class="sc">${sr.bw}</div>
      <div class="nm">${esc(a.abbr)} — ${esc(b.abbr)}</div>
      <div class="vs">${esc(winner.abbr)}</div></div>`;
  };
  let s = `<div class="eyebrow">Postseason <b>year ${L.season}</b></div>
    <h2 style="margin-bottom:12px">${won ? 'You won it all' : esc(champ.name) + ' win it'}</h2>
    <div class="panel"><div class="eyebrow">Semi-finals</div>${br.semis.map(line).join('')}
      <div class="eyebrow" style="margin-top:12px">Final</div>${br.final ? line(br.final) : ''}</div>`;
  const earned = me.trophies.filter((t) => t.season === L.season);
  if (earned.length) {
    s += `<div class="eyebrow">Earned this year</div><div class="panel">`;
    earned.forEach((t) => {
      const spec = TROPHIES.find((x) => x.key === t.key)!;
      s += `<div class="kv"><span class="k">${esc(spec.name)}</span><b class="amber">${esc(spec.desc)}</b></div>`;
    });
    s += `</div>`;
  }
  s += `<button class="btn bulb" data-act="offseason">Into the offseason</button>`;
  openSheet(s);
}

export function offseasonSheet(rep: OffseasonReport | null): void {
  const L = store.league!;
  const me = store.me;
  const report = rep || { retired: [], expiring: [], season: L.season };
  const mineRetired = report.retired.filter((r) => r.teamId === me.id);
  const mineExp = me.roster.filter((p) => p.expiring);

  let s = `<div class="eyebrow">Offseason <b>year ${L.season}</b></div><h2 style="margin-bottom:12px">Sort out the roster</h2>`;
  if (mineRetired.length) {
    s += `<div class="eyebrow">Retired</div><div class="panel feed">`;
    mineRetired.forEach((r) => {
      s += `<div class="fitem"><div class="w">${r.age}</div><div class="x">${esc(r.name)} hangs them up at ${r.ovr} overall</div></div>`;
    });
    s += `</div>`;
  }
  if (mineExp.length) {
    s += `<div class="eyebrow">Contracts up <b>${mineExp.length}</b></div><div class="panel" style="padding-top:4px">`;
    mineExp.forEach((p) => {
      const ask = Math.round((p.salary * 1.15) / 5000) * 5000;
      s += `<div class="prow" style="flex-wrap:wrap">
        <div class="ppos${isPitcher(p) ? ' p' : ''}">${p.pos}</div>
        <div class="pinfo"><div class="pname">${esc(p.name)}</div>
          <div class="pmeta"><span>${p.age}y</span><span>${p.ovr} ovr</span><span>asks ${M(ask)}</span></div></div>
        <div class="chiprow" style="width:100%;margin:6px 0 0;flex-wrap:wrap">
          <button class="chip" data-act="resign" data-id="${p.id}" data-years="2">2 yr</button>
          <button class="chip" data-act="resign" data-id="${p.id}" data-years="3">3 yr</button>
          <button class="chip" data-act="resign" data-id="${p.id}" data-years="4">4 yr</button>
          <button class="chip" data-act="letgo" data-id="${p.id}">Let go</button>
        </div></div>`;
    });
    s += `</div>`;
  } else {
    s += `<div class="panel"><p class="dim">Nothing outstanding. Everyone is under contract.</p></div>`;
  }
  s += `<div class="panel"><div class="kv"><span class="k">Roster</span><b>${me.roster.length} of ${ROSTER_MAX}</b></div>
    <div class="kv"><span class="k">Cash</span><b>${M(me.cash)}</b></div>
    <div class="kv"><span class="k">Draft</span><b>${L.draftRounds} rounds, snake order</b></div></div>
    <button class="btn bulb" data-act="opendraft">Open the draft</button>`;
  openSheet(s);
}

export function staffSheet(role: StaffRole): void {
  const info = STAFF_INFO[role];
  if (!info) return;
  const me = store.me;
  const lv = me.staff[role] || 0;
  const cost = staffHireCost(me, role);
  const can = me.cash >= cost && lv < 94;
  let s = `<div class="eyebrow">The office <b>${esc(info.name)}</b></div>
    <h2 style="margin-bottom:10px">${esc(info.name)}</h2>
    <div class="kv"><span class="k">Rating</span><b>${lv}</b></div>
    <div class="panel" style="margin-top:12px">
      <div class="eyebrow">What they do</div>
      <p style="font-size:15px;line-height:1.45;margin-top:6px">${esc(info.does)}</p>
    </div>
    <div class="panel">
      <div class="eyebrow">Why hire up</div>
      <p style="font-size:15px;line-height:1.45;margin-top:6px">${esc(info.why)}</p>
    </div>
    <button class="btn primary" style="margin-top:8px" data-act="hirestaff" data-k="${role}" ${can ? '' : 'disabled'}>
      ${lv >= 94 ? 'Office is stacked' : can ? 'Hire · ' + M(cost) : 'Need ' + M(cost)}
    </button>`;
  openSheet(s);
}

export type DugoutKey = 'pat' | 'agg' | 'hook';

const DUGOUT_INFO: Record<DugoutKey, { name: string; does: string; why: string }> = {
  pat: {
    name: 'Patience',
    does: 'Tells the auto lineup how much to weight eyes over power. Higher patience puts on-base guys higher; lower patience stacks the bombers.',
    why: 'Turn it up when you want walks and traffic. Turn it down when you want damage early and are willing to swing through more empty air.'
  },
  agg: {
    name: 'Green light',
    does: 'Greens steals and the extra base. Runners go more often, take third on singles, and try to score from first on doubles.',
    why: 'A high green light manufactures runs with legs. It also burns outs on the bases when the other club has a cannon behind the plate.'
  },
  hook: {
    name: 'Bullpen hook',
    does: 'Sets how fast you pull a starter who is laboring. High hook means the pen is up early; low hook lets the starter work through traffic.',
    why: 'Raise it to protect late leads with fresh arms. Drop it when your rotation is deep and you need to save the bullpen for tomorrow.'
  }
};

export function dugoutSheet(key: DugoutKey): void {
  const info = DUGOUT_INFO[key];
  if (!info) return;
  const me = store.me;
  const val =
    key === 'pat' ? me.strategy.patience :
    key === 'agg' ? me.strategy.aggression :
    me.strategy.bullpenHook;
  const pct = Math.round((val || 0.5) * 100);
  let s = `<div class="eyebrow">The dugout <b>${esc(info.name)}</b></div>
    <h2 style="margin-bottom:10px">${esc(info.name)}</h2>
    <div class="kv"><span class="k">Current</span><b>${pct}</b></div>
    <div class="panel" style="margin-top:12px">
      <div class="eyebrow">What it does</div>
      <p style="font-size:15px;line-height:1.45;margin-top:6px">${esc(info.does)}</p>
    </div>
    <div class="panel">
      <div class="eyebrow">Why it matters</div>
      <p style="font-size:15px;line-height:1.45;margin-top:6px">${esc(info.why)}</p>
    </div>
    <p class="faint" style="font-size:13px;margin-top:12px;line-height:1.4">Drag the slider on the Roster tab to change it. Desk cards can nudge this for one series.</p>`;
  openSheet(s);
}

/** Own club: past series list → receipt. */
export function mySeriesSheet(): void {
  const L = store.league!;
  const me = store.me;
  const rows: { week: number; homeId: string; awayId: string; hw: number; aw: number }[] = [];
  L.results.forEach((w) => {
    w.series.forEach((sr) => {
      if (sr.homeId === me.id || sr.awayId === me.id) {
        rows.push({ week: w.week, ...sr });
      }
    });
  });
  rows.reverse();

  let s = `<div class="eyebrow">Your tape <b>year ${L.season}</b></div>
    <h2 style="margin-bottom:6px">${esc(me.name)}</h2>
    <p class="faint" style="font-size:13px;line-height:1.4;margin-bottom:12px">Every series you have played. Tap one for the press-box receipt.</p>`;

  if (!rows.length) {
    s += `<div class="empty"><h3>No series yet</h3><p>Play a week from the Club tab and the tape starts here.</p></div>`;
    openSheet(s);
    return;
  }

  s += `<div class="panel" style="padding-top:2px">`;
  rows.forEach((sr) => {
    const home = sr.homeId === me.id;
    const opp = L.teams.find((t) => t.id === (home ? sr.awayId : sr.homeId))!;
    const mine = home ? sr.hw : sr.aw;
    const theirs = home ? sr.aw : sr.hw;
    const tag = mine > theirs ? 'win' : mine < theirs ? 'loss' : '';
    const label = mine > theirs ? 'WON' : mine < theirs ? 'LOST' : 'SPLIT';
    s += `<div class="res tap ${tag}" data-act="openseries" data-week="${sr.week}" data-home="${sr.homeId}" data-away="${sr.awayId}">
      <div class="sc">${mine}</div><div class="vs">${home ? 'vs' : '@'}</div><div class="sc">${theirs}</div>
      <div class="nm">${esc(opp.name)}</div>
      <div class="vs">W${sr.week} · ${label}</div>
    </div>`;
  });
  s += `</div>`;
  openSheet(s);
}

/** Rival club: game-by-game list → box score. */
export function teamGamesSheet(teamId: string): void {
  const L = store.league!;
  const team = L.teams.find((t) => t.id === teamId);
  if (!team) return;

  const rows: { week: number; i: number; gm: GameSummary }[] = [];
  L.results.forEach((w) => {
    w.games.forEach((gm, i) => {
      if (gm.homeId === teamId || gm.awayId === teamId) rows.push({ week: w.week, i, gm });
    });
  });
  rows.reverse();

  let s = `<div class="eyebrow">Club tape <b>${esc(team.abbr)}</b></div>
    <h2 style="margin-bottom:6px">${esc(team.name)}</h2>
    <p class="faint" style="font-size:13px;line-height:1.4;margin-bottom:12px">Past games this season. Tap a score for the box.</p>`;

  if (!rows.length) {
    s += `<div class="empty"><h3>No games yet</h3><p>The schedule has not started for them.</p></div>`;
    openSheet(s);
    return;
  }

  s += `<div class="panel" style="padding-top:2px">`;
  rows.forEach((row) => {
    const { gm, week, i } = row;
    const home = gm.homeId === teamId;
    const my = home ? gm.homeRuns : gm.awayRuns;
    const th = home ? gm.awayRuns : gm.homeRuns;
    const opp = L.teams.find((t) => t.id === (home ? gm.awayId : gm.homeId))!;
    const won = gm.winnerId === teamId;
    s += `<div class="res tap ${won ? 'win' : 'loss'}" data-act="gamebox" data-week="${week}" data-i="${i}">
      <div class="sc">${my}</div><div class="vs">${home ? 'vs' : '@'}</div><div class="sc">${th}</div>
      <div class="nm">${esc(opp.abbr)} <span class="faint">${esc(opp.mascot)}</span></div>
      <div class="vs">W${week}${gm.walkoff ? ' · WO' : gm.innings > 9 ? ' · ' + gm.innings + 'INN' : ''}</div>
    </div>`;
  });
  s += `</div>`;
  openSheet(s);
}

/** Single-game line score. */
export function gameBoxSheet(week: number, gameIndex: number): void {
  const L = store.league!;
  const outcome = L.results.find((w) => w.week === week);
  const gm = outcome?.games[gameIndex];
  if (!gm) return;
  const home = L.teams.find((t) => t.id === gm.homeId)!;
  const away = L.teams.find((t) => t.id === gm.awayId)!;
  const innings = Math.max(gm.line?.home?.length || 0, gm.line?.away?.length || 0, gm.innings || 9);
  const cells = (arr: (number | string)[] | undefined): string => {
    const a = arr || [];
    let out = '';
    for (let i = 0; i < innings; i++) {
      const v = a[i];
      out += `<td>${v === undefined || v === null ? '' : esc(String(v))}</td>`;
    }
    return out;
  };
  const heads = Array.from({ length: innings }, (_, i) => `<th>${i + 1}</th>`).join('');
  const flag = gm.walkoff ? 'Walk-off' : gm.innings > 9 ? gm.innings + ' innings' : 'Final';

  let s = `<div class="eyebrow">Box score <b>week ${week}</b></div>
    <h2 style="margin-bottom:4px">${esc(away.abbr)} @ ${esc(home.abbr)}</h2>
    <p class="faint" style="font-size:13px;margin-bottom:12px">${esc(flag)}</p>
    <div class="panel">
      <div class="boxscore-final">
        <div class="bs-side">
          <div class="bs-abbr" style="color:${cssColor(away.color)}">${esc(away.abbr)}</div>
          <div class="bs-runs">${gm.awayRuns}</div>
        </div>
        <div class="bs-at">@</div>
        <div class="bs-side">
          <div class="bs-abbr" style="color:${cssColor(home.color)}">${esc(home.abbr)}</div>
          <div class="bs-runs">${gm.homeRuns}</div>
        </div>
      </div>
      <div class="boxscore-scroll">
        <table class="boxline">
          <thead><tr><th></th>${heads}<th>R</th></tr></thead>
          <tbody>
            <tr><td>${esc(away.abbr)}</td>${cells(gm.line?.away)}<td class="r">${gm.awayRuns}</td></tr>
            <tr><td>${esc(home.abbr)}</td>${cells(gm.line?.home)}<td class="r">${gm.homeRuns}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="hairline"></div>
      <div class="kv"><span class="k">Winner</span><b>${esc((L.teams.find((t) => t.id === gm.winnerId) || home).abbr)}</b></div>
      ${gm.wp ? `<div class="kv"><span class="k">Winning pitcher</span><b>${esc(gm.wp)}</b></div>` : ''}
      ${gm.lp ? `<div class="kv"><span class="k">Losing pitcher</span><b>${esc(gm.lp)}</b></div>` : ''}
    </div>`;
  openSheet(s);
}
