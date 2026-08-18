/**
 * Game controller: tab routing, view rendering, gesture wiring and the
 * data-act handler. All game mutations flow through store.dispatch so the
 * action log stays authoritative.
 */
import {
  ACHIEVEMENTS, SKILL_INFO, TROPHIES, VIBES, achievementById, consumeUnlocks, draftCurrent,
  nextScenario, rankTeams, shownOvr, type GameSummary, type MyPbp, type Position, type SkillKey, type StadiumKey
} from '@ballclub/engine';
import anime from '../ui/motion.js';
import { $, closeSheet, esc, toast } from '../ui/dom.js';
import { haptic, drag, longPress, reduceMotion } from '../ui/ux.js';
import { ic } from '../ui/icons.js';
import { M, hexToRgb } from '../ui/format.js';
import { vibeSwatch } from '../ui/gl.js';
import { store } from './store.js';
import { UI } from './uiState.js';
import { backdrop, marquee, applyVibe, refreshChrome } from './chrome.js';
import { viewClub } from '../views/club.js';
import { viewRoster } from '../views/roster.js';
import { viewMarket, boardOrder } from '../views/market.js';
import { viewPark, projectRevenue } from '../views/park.js';
import { viewLeague } from '../views/league.js';
import { playerSheet, fullBoard, seriesRecap, playoffSheet, offseasonSheet } from '../views/sheets.js';
import { meFog } from '../views/helpers.js';
import {
  startBroadcast, skipBroadcast, skipBroadcastGame,
  cycleBroadcastSpeed, toggleBroadcastHighlights
} from '../views/broadcast.js';

const TABS = [
  { k: 'club', label: 'Club' },
  { k: 'roster', label: 'Roster' },
  { k: 'market', label: 'Market' },
  { k: 'park', label: 'Park' },
  { k: 'league', label: 'League' }
] as const;

type ViewKey = (typeof TABS)[number]['k'];

function flushProgressToasts(): void {
  if (!store.league) return;
  const unlocks = consumeUnlocks(store.me);
  if (!unlocks.length) return;
  store.save();
  unlocks.forEach((u, i) => {
    setTimeout(() => {
      if (u.indexOf('LEVEL ') === 0) {
        toast('Level up', 'GM ' + u.slice(6) + ' · a point waiting in the office', 'good');
        return;
      }
      const spec = achievementById(u);
      toast('Unlocked', spec ? spec.name + ' · +' + spec.xp : u, 'good');
    }, 380 * i);
  });
}

export function buildTabs(): void {
  $('#tabs').innerHTML = TABS.map(
    (t) => `<button class="tab" data-tab="${t.k}">${ic(t.k)}<span>${t.label}</span><em class="badge" style="display:none"></em></button>`
  ).join('');
}

function badge(k: string, n: number): void {
  const el = document.querySelector<HTMLElement>(`.tab[data-tab="${k}"] .badge`);
  if (!el) return;
  if (n > 0) {
    el.style.display = 'grid';
    el.textContent = n > 9 ? '9+' : String(n);
  } else el.style.display = 'none';
}

export function go(v: string, dir?: 'left' | 'right'): void {
  const prev = store.view;
  store.view = v;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', (t as HTMLElement).dataset.tab === v));
  render();
  const el = document.querySelector('.view.active');
  if (el && prev !== v && !reduceMotion) {
    const from = dir === 'left' ? 26 : dir === 'right' ? -26 : 0;
    anime({ targets: el, opacity: [0, 1], translateX: [from, 0], duration: 300, easing: 'easeOutQuad' });
    anime({
      targets: el.querySelectorAll('.panel, .prow, .build, .troph, .res, .dcard, .skill'),
      opacity: [0, 1], translateY: [10, 0], delay: anime.stagger(16, { start: 40 }), duration: 300, easing: 'easeOutQuad'
    });
  }
  store.save();
}

export function render(): void {
  const L = store.league!;
  rankTeams(L);
  const views: Record<ViewKey, () => string> = {
    club: viewClub, roster: viewRoster, market: viewMarket, park: viewPark, league: viewLeague
  };
  const html = (views[store.view as ViewKey] || viewClub)();
  $('#views').innerHTML = `<section class="view active" id="v-${store.view}">${html}</section>`;
  refreshChrome();
  updateBadges();
  if (store.view === 'club') wirePull();
  if (store.view === 'club' && store.me.deskPending && L.phase === 'regular') wireScenarioDeck();
  if (store.view === 'market' && L.phase === 'draft') wireDraftDeck();
  if (store.view === 'park') wireSliders();
  wireLongPress();
}

function updateBadges(): void {
  const L = store.league!;
  const me = store.me;
  const cur = draftCurrent(L);
  badge('market', L.phase === 'draft' && cur && cur.teamId === me.id ? 1 : 0);
  badge('club', me.deskPending && L.phase === 'regular' ? 1 : 0);
  badge('park', me.sponsorOffers.length);
  badge('league', me.progress?.unspent || 0);
}

/* ---------- pull to play ---------- */
function wirePull(): void {
  const sc = $('#v-club'), pull = $('#pull');
  if (!sc || !pull) return;
  const lab = $('#pulllab'), ring = pull.querySelector('.ring') as HTMLElement;
  const THRESH = 78;
  let y0: number | null = null, dist = 0, armed = false;
  const canPull = (): boolean => store.league!.phase === 'regular' && !store.me.deskPending && sc.scrollTop <= 0;

  sc.addEventListener('touchstart', (e) => {
    y0 = canPull() ? e.touches[0].clientY : null;
    dist = 0;
    armed = false;
  }, { passive: true });
  sc.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    const d = e.touches[0].clientY - y0;
    if (d <= 0) {
      if (dist) {
        dist = 0;
        pull.style.height = '0px';
      }
      return;
    }
    if (e.cancelable) e.preventDefault();
    dist = Math.min(120, d * 0.55);
    pull.style.height = dist + 'px';
    const p = Math.min(1, dist / THRESH);
    ring.style.transform = 'rotate(' + p * 320 + 'deg)';
    ring.style.borderTopColor = p >= 1 ? 'var(--turf)' : 'var(--bulb)';
    const nowArmed = p >= 1;
    if (nowArmed !== armed) {
      armed = nowArmed;
      if (armed) haptic.select();
    }
    lab.textContent = armed ? 'release to play' : 'pull to play';
  }, { passive: false });
  sc.addEventListener('touchend', () => {
    if (y0 === null) return;
    const fire = armed;
    y0 = null;
    armed = false;
    anime({ targets: pull, height: 0, duration: 320, easing: 'easeOutQuart' });
    if (fire) playSeries();
  }, { passive: true });
}

/* ---------- scenario deck ---------- */
function wireScenarioDeck(): void {
  const card = $('#sccard');
  if (!card) return;
  const sL = $('#stampL'), sR = $('#stampR');
  let fired = false;
  drag(card, {
    axis: 'x',
    onMove(dx) {
      anime.set(card, { translateX: dx, rotate: dx / 22 });
      const p = Math.min(1, Math.abs(dx) / 96);
      anime.set(sR, { opacity: dx > 0 ? p : 0, scale: 0.9 + p * 0.15 });
      anime.set(sL, { opacity: dx < 0 ? p : 0, scale: 0.9 + p * 0.15 });
    },
    onEnd(dx, _dy, vx) {
      if (fired) return;
      if (Math.abs(dx) > 104 || Math.abs(vx) > 0.55) {
        fired = true;
        const side = dx > 0 ? 'right' : 'left';
        haptic.ok();
        anime({
          targets: card, translateX: dx > 0 ? 460 : -460, rotate: dx > 0 ? 22 : -22, opacity: 0,
          duration: 340, easing: 'easeInQuad', complete: () => resolveScenarioUI(side)
        });
      } else {
        anime({ targets: card, translateX: 0, rotate: 0, duration: 520, easing: 'easeOutElastic' });
        anime({ targets: [sL, sR], opacity: 0, duration: 180 });
      }
    }
  });
}

function resolveScenarioUI(side: 'left' | 'right'): void {
  const me = store.me;
  const before = { cash: me.cash, trust: me.fanTrust };
  const r = store.dispatch({ t: 'scenario', teamId: me.id, side });
  if (!r.ok || !r.scenario) {
    render();
    return;
  }
  const dc = Math.round(me.cash - before.cash), dt = Math.round(me.fanTrust - before.trust);
  const bits: string[] = [];
  if (dc) bits.push((dc > 0 ? '+' : '') + M(dc));
  if (dt) bits.push((dt > 0 ? '+' : '') + dt + ' trust');
  toast(r.scenario.side.label, r.scenario.out, dc >= 0 && dt >= 0 ? 'good' : 'bulb');
  if (bits.length) setTimeout(() => toast('Ledger', bits.join('  ·  '), dc < 0 ? 'bad' : 'good'), 420);
  if (r.scenario.extra) setTimeout(() => toast('Trainer', r.scenario!.extra!, 'bad'), 840);
  if (backdrop.ok) backdrop.flare(0.5, 1);
  flushProgressToasts();
  render();
}

/* ---------- play a series ---------- */
function playSeries(): void {
  const L = store.league!;
  const me = store.me;
  if (UI.simming || L.phase !== 'regular') return;
  if (me.deskPending) {
    toast('Not yet', 'There is a matter on your desk.', 'bulb');
    return;
  }
  UI.simming = true;
  haptic.ok();
  const out = store.dispatch({ t: 'week' });
  UI.simming = false;
  if (!out.ok || !out.week) {
    render();
    return;
  }
  flushProgressToasts();

  const mine: GameSummary[] = out.week.games.filter((gm) => gm.homeId === me.id || gm.awayId === me.id);
  const pbps: MyPbp[] = (L.myPbp || []).slice();
  let wins = 0;
  mine.forEach((gm) => {
    if (gm.winnerId === me.id) wins++;
  });

  const finish = (): void => {
    if (wins === mine.length && mine.length) {
      marquee.flash('SWEEP', 3200);
      if (backdrop.ok) backdrop.flare(1.2, 0);
    } else if (wins === 0) marquee.flash('SWEPT', 2600);
    if ((store.league!.phase as string) === 'playoffs') marquee.flash('POSTSEASON', 3400);
    seriesRecap(mine, pbps, wins);
  };

  startBroadcast({ games: mine, pbps, onDone: finish });
  render();
}

/* ---------- draft flow ---------- */
function doDraft(id: string): void {
  const L = store.league!;
  const r = store.dispatch({ t: 'draftPick', teamId: store.me.id, playerId: id });
  if (!r.ok || !r.pick || !r.pick.player) {
    toast('No', r.err || 'That pick did not go through', 'bad');
    render();
    return;
  }
  UI.draftIdx = 0;
  toast('Selected', r.pick.player.name + ' · ' + r.pick.player.pos, 'good');
  flushProgressToasts();
  if (backdrop.ok) backdrop.flare(0.8, 0);
  marquee.flash(r.pick.player.name, 2400);
  if (L.phase !== 'draft') {
    marquee.flash('SEASON OPENS', 3200);
    toast('Draft complete', 'Eighteen weeks. Go win something.', 'bulb');
    go('club');
    return;
  }
  render();
}

function wireDraftDeck(): void {
  const top = document.querySelector<HTMLElement>('#drdeck .dcard[data-di="0"]');
  if (!top) return;
  const sL = top.querySelector('.stamp.l') as HTMLElement, sR = top.querySelector('.stamp.r') as HTMLElement;
  let fired = false;
  drag(top, {
    onMove(dx, dy, axis) {
      if (axis === 'y' && dy < 0) {
        anime.set(top, { translateY: dy, scale: 1 + Math.min(0.06, -dy / 900) });
        anime.set(sR, { opacity: Math.min(1, -dy / 90) });
        return;
      }
      anime.set(top, { translateX: dx, rotate: dx / 24 });
      const p = Math.min(1, Math.abs(dx) / 100);
      anime.set(sR, { opacity: dx > 0 ? p : 0 });
      anime.set(sL, { opacity: dx < 0 ? p : 0 });
    },
    onEnd(dx, dy, _vx, axis) {
      if (fired) return;
      const draftIt = dx > 100 || (axis === 'y' && dy < -90);
      const pass = dx < -100;
      if (draftIt) {
        fired = true;
        haptic.big();
        anime({
          targets: top, translateY: axis === 'y' ? -560 : 0, translateX: axis === 'y' ? 0 : 480,
          rotate: axis === 'y' ? 0 : 20, opacity: 0, duration: 320, easing: 'easeInQuad',
          complete: () => doDraft(top.dataset.id!)
        });
      } else if (pass) {
        fired = true;
        haptic.tap();
        anime({
          targets: top, translateX: -480, rotate: -20, opacity: 0, duration: 300, easing: 'easeInQuad',
          complete: () => {
            UI.draftIdx++;
            render();
          }
        });
      } else {
        anime({ targets: top, translateX: 0, translateY: 0, rotate: 0, scale: 1, duration: 520, easing: 'easeOutElastic' });
        anime({ targets: [sL, sR], opacity: 0, duration: 160 });
      }
    }
  });
}

/* ---------- park wiring ---------- */
function wireSliders(): void {
  const me = store.me;
  document.querySelectorAll<HTMLCanvasElement>('.vsw').forEach((cv) =>
    vibeSwatch(cv, VIBES[cv.dataset.v!], hexToRgb(me.color))
  );
  document.querySelectorAll<HTMLElement>('.slider').forEach((sl) => {
    const track = sl.querySelector('.strack') as HTMLElement;
    const knob = sl.querySelector('.knob') as HTMLElement;
    const fill = sl.querySelector('.fill') as HTMLElement;
    const min = +sl.dataset.min!, max = +sl.dataset.max!, key = sl.dataset.sl!;
    let val = +sl.dataset.val!;
    const paint = (): void => {
      const p = (val - min) / (max - min);
      knob.style.left = p * 100 + '%';
      fill.style.width = p * 100 + '%';
      const lbl = document.querySelector('#slv-' + key);
      if (lbl) lbl.textContent = '$' + val;
    };
    paint();
    let lastV = val;
    const commit = (): void => {
      store.dispatch({ t: 'setPrices', teamId: me.id, ticket: me.ticket, conPrice: me.conPrice });
    };
    const setFromX = (cx: number): void => {
      const r = track.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (cx - r.left) / r.width));
      val = Math.round(min + p * (max - min));
      if (val !== lastV) {
        lastV = val;
        haptic.light();
      }
      paint();
      /* live preview mutates directly; the final value is committed as an action on release */
      if (key === 'ticket') me.ticket = val;
      else me.conPrice = val;
      const pr = projectRevenue(me.ticket, me.conPrice);
      const a = document.querySelector('#proj-att'), rv = document.querySelector('#proj-rev');
      if (a) a.textContent = pr.att.toLocaleString();
      if (rv) rv.textContent = M(pr.rev);
    };
    const h = (e: TouchEvent | MouseEvent): void => {
      const p = 'touches' in e ? e.touches[0] : e;
      setFromX(p.clientX);
    };
    track.addEventListener('touchstart', h, { passive: true });
    track.addEventListener('touchmove', (e) => {
      if (e.cancelable) e.preventDefault();
      h(e);
    }, { passive: false });
    track.addEventListener('touchend', commit, { passive: true });
    track.addEventListener('mousedown', (e) => {
      h(e);
      const mm = (ev: MouseEvent) => h(ev);
      const mu = (): void => {
        commit();
        window.removeEventListener('mousemove', mm);
        window.removeEventListener('mouseup', mu);
      };
      window.addEventListener('mousemove', mm);
      window.addEventListener('mouseup', mu);
    });
  });
}

function wireLongPress(): void {
  const L = store.league!;
  const me = store.me;
  document.querySelectorAll<HTMLElement>('.prow').forEach((row) => {
    longPress(row, 380, () => {
      const id = row.dataset.id;
      if (!id) return;
      const p = me.roster.find((x) => x.id === id) || L.draftPool.find((x) => x.id === id) || L.freeAgents.find((x) => x.id === id);
      if (!p) return;
      const so = shownOvr(p, meFog());
      toast(
        p.pos + ' · ' + p.age + 'y',
        `${so.exact ? so.v + ' ovr' : so.lo + '-' + so.hi + ' est'} · ${M(p.salary)} · cond ${Math.round(p.cond)}%`,
        'bulb'
      );
    });
  });
}

/* ---------- playoffs / offseason ---------- */
function runPlayoffsUI(): void {
  const L = store.league!;
  const me = store.me;
  const r = store.dispatch({ t: 'playoffs' });
  if (!r.ok || !r.bracket) {
    toast('Not yet', r.err || 'The bracket is not ready.', 'bad');
    return;
  }
  const champ = L.teams.find((t) => t.id === r.bracket!.champId)!;
  const won = champ.id === me.id;
  if (won) {
    marquee.flash('CHAMPIONS', 5000);
    if (backdrop.ok) backdrop.flare(1.4, 0);
    haptic.big();
  } else marquee.flash(champ.abbr + ' TAKE IT', 3600);
  playoffSheet(r.bracket);
  flushProgressToasts();
  render();
}

function openOffseason(): void {
  closeSheet();
  const L = store.league!;
  if (L.phase === 'offseason') {
    store.dispatch({ t: 'offseason' });
  }
  offseasonSheet(L.offseasonReport || null);
}

/* ---------- one-shot market ops ---------- */
function proposeTrade(): void {
  const L = store.league!;
  const me = store.me;
  const them = L.teams.find((t) => t.id === UI.trade.rival);
  if (!them) return;
  if (!UI.trade.mine.length && !UI.trade.theirs.length) return;
  const incoming = them.roster
    .filter((p) => UI.trade.theirs.indexOf(p.id) >= 0)
    .map((p) => p.name)
    .join(', ');
  const r = store.dispatch({
    t: 'trade', teamId: me.id, rivalId: them.id, give: UI.trade.mine.slice(), get: UI.trade.theirs.slice()
  });
  if (r.ok) {
    haptic.big();
    toast('Trade agreed', them.abbr + ' send ' + (incoming || 'nobody'), 'good');
    flushProgressToasts();
    if (backdrop.ok) backdrop.flare(0.7, 0);
    UI.trade.mine = [];
    UI.trade.theirs = [];
  } else {
    haptic.warn();
    toast('Turned down', r.err || 'No deal', 'bad');
  }
  render();
}

function doSignFA(id: string): void {
  const L = store.league!;
  const p = L.freeAgents.find((x) => x.id === id);
  if (!p) return;
  const r = store.dispatch({ t: 'signFA', teamId: store.me.id, playerId: id });
  if (r.ok && r.sign) {
    haptic.ok();
    toast('Signed', p.name + ' · bonus ' + M(r.sign.bonus || 0), 'good');
    flushProgressToasts();
    closeSheet();
  } else {
    haptic.warn();
    toast('No deal', r.err || 'Could not sign', 'bad');
  }
  render();
}

function doRelease(id: string): void {
  const me = store.me;
  const p = me.roster.find((x) => x.id === id);
  if (!p) return;
  const r = store.dispatch({ t: 'release', teamId: me.id, playerId: id });
  haptic.warn();
  toast('Released', p.name + ' · dead money ' + M((r.released && r.released.dead) || 0), 'bad');
  closeSheet();
  render();
}

function doScout(id: string): void {
  const L = store.league!;
  const pool = L.draftPool.length ? L.draftPool : L.freeAgents;
  const p = pool.find((x) => x.id === id);
  if (!p) return;
  if (p.scouted >= 1) {
    toast('Already known', 'That file is finished.', '');
    return;
  }
  const before = shownOvr(p, meFog());
  const r = store.dispatch({ t: 'scout', teamId: store.me.id, playerId: id });
  if (!r.ok) {
    haptic.warn();
    toast('Out of actions', r.err || 'You get them back when the next series is played.', 'bad');
    return;
  }
  haptic.ok();
  const delta = p.ovr - before.v;
  toast(
    'Report in',
    p.name + ' grades out at ' + p.ovr +
      (Math.abs(delta) >= 5 ? (delta > 0 ? ' — better than they thought' : ' — worse than they thought') : ''),
    Math.abs(delta) >= 5 ? 'bulb' : 'good'
  );
  flushProgressToasts();
  render();
}

function doUpgrade(key: string): void {
  const r = store.dispatch({ t: 'upgrade', teamId: store.me.id, key: key as StadiumKey });
  if (r.ok && r.upgraded) {
    haptic.big();
    toast('Built', (r.upgraded.note || '') + ' · ' + M(r.upgraded.cost || 0), 'good');
    flushProgressToasts();
    if (backdrop.ok) backdrop.flare(0.9, 0);
  } else {
    haptic.warn();
    toast('Cannot build', r.err || 'Not now', 'bad');
  }
  render();
}

function doSponsor(name: string): void {
  const r = store.dispatch({ t: 'signSponsor', teamId: store.me.id, name });
  if (r.ok && r.sponsor && r.sponsor.sponsor) {
    haptic.ok();
    toast('Signed', r.sponsor.sponsor.name + ' · ' + M(r.sponsor.sponsor.offer) + ' a season', 'good');
    flushProgressToasts();
  }
  render();
}

/* ---------- data-act handler ---------- */
export function handle(act: string, d: DOMStringMap): void {
  const L = store.league!;
  const me = store.me;
  switch (act) {
    case 'tab': go(d.k!); break;
    case 'closesheet': closeSheet(); break;
    case 'bcskip': skipBroadcast(); break;
    case 'bcskipg': skipBroadcastGame(); break;
    case 'bcspeed': cycleBroadcastSpeed(); break;
    case 'bchl': toggleBroadcastHighlights(); break;
    case 'rfilter':
      UI.rosterFilter = d.k as typeof UI.rosterFilter;
      haptic.tap();
      render();
      break;
    case 'market':
      UI.market = d.k as typeof UI.market;
      haptic.tap();
      render();
      break;
    case 'player': playerSheet(d.id!); haptic.tap(); break;
    case 'series': playSeries(); break;
    case 'fullboard': fullBoard(); break;
    case 'scchoice': {
      const card = document.querySelector('#sccard');
      const right = d.k === 'right';
      haptic.ok();
      if (card) {
        anime({
          targets: card, translateX: right ? 460 : -460, rotate: right ? 20 : -20, opacity: 0,
          duration: 300, easing: 'easeInQuad', complete: () => resolveScenarioUI(d.k as 'left' | 'right')
        });
      } else resolveScenarioUI(d.k as 'left' | 'right');
      break;
    }
    case 'drpass': UI.draftIdx++; haptic.tap(); render(); break;
    case 'drtake': haptic.big(); doDraft(d.id!); break;
    case 'advdraft': {
      store.dispatch({ t: 'advanceDraft' });
      haptic.tap();
      if (L.phase !== 'draft') {
        toast('Draft complete', 'Eighteen weeks ahead of you.', 'bulb');
        go('club');
      } else render();
      break;
    }
    case 'draftpick': closeSheet(); doDraft(d.id!); break;
    case 'rival':
      UI.trade.rival = d.k!;
      UI.trade.mine = [];
      UI.trade.theirs = [];
      haptic.tap();
      render();
      break;
    case 'tpick': {
      const arr = d.side === 'mine' ? UI.trade.mine : UI.trade.theirs;
      const i = arr.indexOf(d.id!);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(d.id!);
      haptic.tap();
      render();
      break;
    }
    case 'tclear': UI.trade.mine = []; UI.trade.theirs = []; render(); break;
    case 'propose': proposeTrade(); break;
    case 'signfa': doSignFA(d.id!); break;
    case 'release': doRelease(d.id!); break;
    case 'scoutone': doScout(d.id!); break;
    case 'spendskill': {
      const skill = d.k as SkillKey;
      const info = SKILL_INFO[skill];
      if (!info) break;
      const r = store.dispatch({ t: 'spendSkill', teamId: me.id, skill });
      if (r.ok) {
        haptic.ok();
        const rank = me.progress?.skills[skill] || 0;
        toast(info.name, 'Rank ' + rank + ' · ' + info.blurb, 'good');
        flushProgressToasts();
      } else {
        haptic.warn();
        toast('Not now', r.err || 'No points to spend', 'bad');
      }
      render();
      break;
    }
    case 'achieve': {
      const spec = achievementById(d.k || '') || ACHIEVEMENTS.find((x) => x.id === d.k);
      if (!spec) break;
      const owned = !!(me.progress && me.progress.achievements.indexOf(spec.id) >= 0);
      toast(spec.name, (owned ? 'Earned. ' : '') + spec.desc + (owned ? '' : ' · +' + spec.xp + ' when you get there'), owned ? 'good' : '');
      break;
    }
    case 'focus':
      store.dispatch({ t: 'scoutFocus', teamId: me.id, pos: (d.k || null) as Position | null });
      haptic.tap();
      render();
      break;
    case 'upgrade': doUpgrade(d.k!); break;
    case 'sponsor': doSponsor(d.k!); break;
    case 'vibe': {
      store.dispatch({ t: 'setVibe', teamId: me.id, vibe: d.k! });
      haptic.select();
      applyVibe();
      render();
      break;
    }
    case 'playoffs': runPlayoffsUI(); break;
    case 'offseason': openOffseason(); break;
    case 'opendraft': {
      closeSheet();
      store.dispatch({ t: 'advanceDraft' });
      UI.draftIdx = 0;
      go('market');
      marquee.flash('DRAFT DAY', 2800);
      break;
    }
    case 'resign': {
      const p = me.roster.find((x) => x.id === d.id);
      if (!p) break;
      const ask = Math.round((p.salary * 1.15) / 5000) * 5000;
      const r = store.dispatch({ t: 'resign', teamId: me.id, playerId: d.id!, offer: ask });
      toast(r.ok ? 'Re-signed' : 'Gone', r.ok ? p.name + ' at ' + M(ask) : p.name + ' hits the market', r.ok ? 'good' : 'bad');
      haptic.ok();
      openOffseason();
      break;
    }
    case 'letgo': {
      const p = me.roster.find((x) => x.id === d.id);
      if (!p) break;
      store.dispatch({ t: 'letgo', teamId: me.id, playerId: d.id! });
      toast('Let go', p.name + ' is a free agent', 'bulb');
      haptic.tap();
      openOffseason();
      break;
    }
    case 'trophy': {
      const t = TROPHIES.find((x) => x.key === d.k);
      if (!t) break;
      const owned = me.trophies.filter((x) => x.key === d.k);
      toast(t.name, owned.length ? t.desc + ' — won in ' + owned.map((o) => 'year ' + o.season).join(', ') : t.desc, owned.length ? 'good' : '');
      break;
    }
    case 'copycode': {
      if (navigator.clipboard) navigator.clipboard.writeText(L.code || '').catch(() => { /* no-op */ });
      toast('Copied', 'League code ' + (L.code || ''), 'good');
      haptic.tap();
      break;
    }
    case 'newgame': {
      store.reset();
      location.reload();
      break;
    }
  }
}

/* ---------- global wiring ---------- */
export function wireGlobal(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const tab = target.closest<HTMLElement>('[data-tab]');
    if (tab) {
      const from = TABS.findIndex((t) => t.k === store.view);
      const to = TABS.findIndex((t) => t.k === tab.dataset.tab);
      haptic.tap();
      go(tab.dataset.tab!, to > from ? 'left' : 'right');
      return;
    }
    const ob = target.closest<HTMLElement>('[data-ob]');
    if (ob) {
      // handled by the onboarding module via its own listener contract
      document.dispatchEvent(new CustomEvent('bc:ob', { detail: { what: ob.dataset.ob, data: ob.dataset } }));
      return;
    }
    const a = target.closest<HTMLElement>('[data-act]');
    if (a) {
      handle(a.dataset.act!, a.dataset);
      return;
    }
  });

  /* swipe between tabs */
  let sx = 0, sy = 0, tracking = false;
  $('#views').addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.target as HTMLElement;
    if (t.closest('.deck') || t.closest('.strack') || t.closest('.chiprow')) {
      tracking = false;
      return;
    }
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  $('#views').addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 68 || Math.abs(dx) < Math.abs(dy) * 1.7) return;
    const i = TABS.findIndex((x) => x.k === store.view);
    const n = dx < 0 ? i + 1 : i - 1;
    if (n < 0 || n >= TABS.length) return;
    haptic.tap();
    go(TABS[n].k, dx < 0 ? 'left' : 'right');
  }, { passive: true });
}

/** Transition from onboarding into the live app. */
export function enterGame(): void {
  anime({
    targets: '#onboard', opacity: 0, duration: 420, easing: 'easeInQuad',
    complete: () => {
      $('#onboard').style.display = 'none';
    }
  });
  $('#app').style.display = 'flex';
  anime({ targets: '#app', opacity: [0, 1], duration: 500, delay: 180 });
  if (backdrop.ok) backdrop.flare(1.1, 1);
  go('market');
  refreshChrome();
  marquee.flash('DRAFT DAY', 3000);
}
