import { clamp, mulberry32, type Rng } from './rng.js';
import { CLASSES } from './data/classes.js';
import { buildLineup, type LineupPlan } from './lineup.js';
import { has } from './player.js';
import type { GameResult, PbpEvent, Player, Team } from './types.js';

interface PaContext {
  inning: number;
  latePen: number;
  runners: boolean;
}

type PaKind = 'BB' | 'K' | 'HBP' | 'HR' | '1B' | '2B' | '3B' | 'GO' | 'AO';

export function paOutcome(bat: Player, pit: Player, defZ: number, rng: Rng, ctx: PaContext): { k: PaKind } {
  const eyeZ = (bat.r.eye - 50) / 18;
  const conZ = (bat.r.con - 50) / 18;
  const powZ = (bat.r.pow - 50) / 18;
  const spdZ = (bat.r.spd - 50) / 18;
  let stf = pit.r.stuff;
  const ctl = pit.r.ctl;
  let mov = pit.r.mov;
  if (ctx.latePen && pit.pos === 'RP' && ctx.inning >= 7) {
    stf += ctx.latePen;
    mov += ctx.latePen * 0.6;
  }
  const stfZ = (stf - 50) / 18;
  const ctlZ = (ctl - 50) / 18;
  const movZ = (mov - 50) / 18;
  const fat = pit.gFat || 0;
  const mor = clamp(((bat.morale == null ? 60 : bat.morale) - 60) / 400, -0.1, 0.1);
  const clutch = ctx.runners && has(bat, 'CLUTCH') ? 0.14 : 0;

  let pBB = 0.083 * Math.exp(0.34 * eyeZ - 0.36 * ctlZ + 0.7 * fat);
  let pK = 0.188 * Math.exp(0.33 * stfZ - 0.35 * conZ - 0.45 * fat);
  pBB = clamp(pBB, 0.01, 0.26);
  pK = clamp(pK, 0.03, 0.38);
  const pHBP = 0.0085;
  if (rng() < pBB) return { k: 'BB' };
  if (rng() < pK / (1 - pBB)) return { k: 'K' };
  if (rng() < pHBP) return { k: 'HBP' };

  let hr = 0.0405 * Math.exp(0.44 * powZ - 0.24 * movZ + 0.6 * fat + mor + clutch);
  hr = clamp(hr, 0.001, 0.14);
  if (rng() < hr) return { k: 'HR' };

  let babip = 0.315 + 0.025 * conZ + 0.013 * spdZ + 0.006 * powZ - 0.03 * defZ - 0.015 * movZ + 0.16 * fat + mor * 0.28 + clutch * 0.3;
  babip = clamp(babip, 0.19, 0.4);
  if (rng() < babip) {
    const dRate = clamp(0.205 + 0.038 * powZ + 0.015 * spdZ, 0.1, 0.36);
    const tRate = clamp(0.021 + 0.024 * spdZ, 0.002, 0.09);
    const r = rng();
    if (r < tRate) return { k: '3B' };
    if (r < tRate + dRate) return { k: '2B' };
    return { k: '1B' };
  }
  const ground = rng() < clamp(0.54 - 0.05 * powZ + 0.05 * movZ, 0.3, 0.75);
  return { k: ground ? 'GO' : 'AO' };
}

interface Side {
  t: Team;
  L: LineupPlan;
  idx: number;
  runs: number;
  isHome: boolean;
  pit: Player;
  bull: Player[];
  starter: Player;
  pitchers: Player[];
}

interface BaseSlot {
  p: Player;
  resp: Player;
}

export function simGame(home: Team, away: Team, seed: number): GameResult | { ok: false } {
  const rng = mulberry32(seed);
  const H = buildLineup(home);
  const A = buildLineup(away);
  if (!H.lineup.length || !A.lineup.length || !H.sps.length || !A.sps.length) {
    return { ok: false };
  }
  const mkSide = (t: Team, L: LineupPlan, isHome: boolean): Side => {
    const rot = L.sps;
    const which = (t.rotIdx || 0) % rot.length;
    const pit = rot[which];
    pit.gFat = 0;
    pit.bfGame = 0;
    return { t, L, idx: 0, runs: 0, isHome, pit, bull: L.rps.slice(), starter: pit, pitchers: [pit] };
  };
  const sides: [Side, Side] = [mkSide(away, A, false), mkSide(home, H, true)];
  const latePen = CLASSES[home.cls].mods.latePen || 0;
  const latePenA = CLASSES[away.cls].mods.latePen || 0;

  const pbp: PbpEvent[] = [];
  const line: { home: (number | string)[]; away: (number | string)[] } = { home: [], away: [] };
  let inning = 1;
  let done = false;
  let walkoff = false;

  function halfInning(offIdx: 0 | 1, inn: number): number {
    const off = sides[offIdx];
    const def = sides[1 - offIdx];
    let outs = 0;
    let bases: (BaseSlot | null)[] = [null, null, null];
    let runs = 0;
    const lp = def.t === home ? latePen : latePenA;
    const hook = def.t.strategy ? def.t.strategy.bullpenHook : 0.5;
    const scoreFrom = (slot: BaseSlot | null) => {
      if (!slot) return;
      runs++;
      slot.p.st.r++;
      slot.resp.pst.er++;
    };
    const recordOut = (n: number) => {
      outs += n;
      def.pit.pst.outs += n;
    };
    const emit = (ev: Omit<PbpEvent, 'inn' | 'half'>): void => {
      pbp.push({
        ...ev,
        inn,
        half: offIdx,
        outs: Math.min(3, outs),
        away: sides[0].runs + (offIdx === 0 ? runs : 0),
        home: sides[1].runs + (offIdx === 1 ? runs : 0),
        bases: [!!bases[0], !!bases[1], !!bases[2]]
      });
    };

    emit({ t: 'half', txt: (offIdx ? 'BOT ' : 'TOP ') + inn });

    while (outs < 3) {
      // pitching change
      const limit = 18 + (def.pit.r.stam - 50) / 2.6 + (def.pit.pos === 'SP' ? 6 : 0);
      def.pit.gFat = clamp(((def.pit.bfGame || 0) - limit) / 26, 0, 0.85);
      const wantHook =
        def.pit.gFat > 0.3 - hook * 0.18 ||
        (def.pit.pos === 'SP' && inn >= 6 && hook > 0.7 && def.pit.gFat > 0.05);
      if (wantHook && def.bull.length) {
        const next = def.bull.shift()!;
        next.gFat = 0;
        next.bfGame = 0;
        def.pit = next;
        def.pitchers.push(next);
        emit({ t: 'sub', txt: next.name + ' comes in' });
      }

      const bat = off.L.lineup[off.idx % off.L.lineup.length];
      off.idx++;
      const ctx: PaContext = { inning: inn, latePen: lp, runners: !!(bases[0] || bases[1] || bases[2]) };
      const o = paOutcome(bat, def.pit, def.L.defZ, rng, ctx);
      def.pit.bfGame = (def.pit.bfGame || 0) + 1;
      bat.st.pa++;
      def.pit.pst.bf++;

      let rbi = 0;
      const slot: BaseSlot = { p: bat, resp: def.pit };

      if (o.k === 'BB' || o.k === 'HBP') {
        if (o.k === 'BB') { bat.st.bb++; def.pit.pst.bb++; }
        // forced advancement only
        if (bases[0]) {
          if (bases[1]) {
            if (bases[2]) { scoreFrom(bases[2]); rbi++; }
            bases[2] = bases[1];
          }
          bases[1] = bases[0];
        }
        bases[0] = slot;
        bat.st.rbi += rbi;
        emit({ t: 'pa', b: bat.name, k: o.k, txt: bat.name + (o.k === 'BB' ? ' walks' : ' hit by pitch') });
      } else if (o.k === 'K') {
        recordOut(1);
        bat.st.ab++;
        bat.st.k++;
        def.pit.pst.k++;
        emit({ t: 'pa', b: bat.name, k: 'K', txt: bat.name + ' strikes out' });
      } else if (o.k === 'HR') {
        bat.st.ab++; bat.st.h++; bat.st.hr++;
        def.pit.pst.h++; def.pit.pst.hr++;
        let cnt = 1;
        for (let i = 2; i >= 0; i--) {
          if (bases[i]) { scoreFrom(bases[i]); cnt++; bases[i] = null; }
        }
        scoreFrom(slot);
        bat.st.rbi += cnt;
        rbi = cnt;
        emit({
          t: 'pa', b: bat.name, k: 'HR', big: true,
          txt: bat.name + ' — ' + (cnt > 3 ? 'GRAND SLAM' : 'HOME RUN') + (cnt > 1 ? ' (' + cnt + ')' : '')
        });
      } else if (o.k === '1B' || o.k === '2B' || o.k === '3B') {
        bat.st.ab++; bat.st.h++; def.pit.pst.h++;
        const adv = o.k === '1B' ? 1 : o.k === '2B' ? 2 : 3;
        if (o.k === '2B') bat.st.d++;
        if (o.k === '3B') bat.st.t++;
        const nb: (BaseSlot | null)[] = [null, null, null];
        for (let i = 2; i >= 0; i--) {
          const rr = bases[i];
          if (!rr) continue;
          const sz = rr.p.r.spd - 50;
          let to: number;
          if (o.k === '3B') to = 3;
          else if (o.k === '2B') {
            // from 1st, scoring on a double is a real coin flip
            to = i === 0 ? (rng() < clamp(0.42 + sz / 240, 0.18, 0.72) ? 3 : 2) : 3;
          } else {
            // single: 2nd scores often, 1st reaches 3rd sometimes
            if (i === 2) to = 3;
            else if (i === 1) to = rng() < clamp(0.56 + sz / 220, 0.32, 0.86) ? 3 : 2;
            else to = rng() < clamp(0.28 + sz / 260, 0.1, 0.56) ? 2 : 1;
          }
          if (to >= 3) { scoreFrom(rr); rbi++; }
          else nb[to] = rr;
        }
        nb[adv - 1] = slot;
        bases = nb;
        bat.st.rbi += rbi;
        emit({
          t: 'pa', b: bat.name, k: o.k, big: o.k === '3B',
          txt: bat.name + (o.k === '1B' ? ' singles' : o.k === '2B' ? ' doubles' : ' TRIPLE') + (rbi ? ' (' + rbi + ' in)' : '')
        });
      } else if (o.k === 'GO') {
        bat.st.ab++;
        let dp = false;
        if (bases[0] && outs < 2 && rng() < clamp(0.28 + def.L.defZ * 0.05 - (bat.r.spd - 50) / 300, 0.08, 0.52)) {
          recordOut(2);
          bases[0] = null;
          dp = true;
        } else {
          recordOut(1);
          if (bases[2] && outs < 3 && rng() < 0.24) { scoreFrom(bases[2]); bat.st.rbi++; rbi++; bases[2] = null; }
          if (bases[0] && outs < 3 && !bases[1]) { bases[1] = bases[0]; bases[0] = null; }
        }
        emit({ t: 'pa', b: bat.name, k: 'GO', txt: bat.name + (dp ? ' grounds into a double play' : ' grounds out') });
      } else {
        recordOut(1);
        if (bases[2] && outs < 3 && rng() < clamp(0.52 + (bat.r.pow - 50) / 300, 0.2, 0.8)) {
          scoreFrom(bases[2]);
          bat.st.rbi++;
          rbi++;
          bases[2] = null;
          emit({ t: 'pa', b: bat.name, k: 'SF', txt: bat.name + ' sacrifice fly, run scores' });
        } else {
          bat.st.ab++;
          emit({ t: 'pa', b: bat.name, k: 'AO', txt: bat.name + ' flies out' });
        }
      }

      // steal attempt
      if (bases[0] && !bases[1] && outs < 3) {
        const rr = bases[0];
        const att = clamp(0.075 * Math.exp((rr.p.r.spd - 50) / 22), 0, 0.42);
        if (rng() < att) {
          const succ = clamp(0.66 + (rr.p.r.spd - 50) / 160 - (def.pit.r.mov - 50) / 400, 0.35, 0.92);
          if (rng() < succ) {
            bases[1] = rr;
            bases[0] = null;
            rr.p.st.sb++;
            emit({ t: 'sb', txt: rr.p.name + ' steals second' });
          } else {
            bases[0] = null;
            recordOut(1);
            rr.p.st.cs++;
            emit({ t: 'cs', txt: rr.p.name + ' caught stealing' });
          }
        }
      }

      if (outs >= 3) break;
      if (offIdx === 1 && inn >= 9 && sides[1].runs + runs > sides[0].runs) {
        walkoff = true;
        const last = pbp[pbp.length - 1];
        if (last) {
          last.big = true;
          if (last.txt.indexOf('WALK-OFF') < 0) last.txt += ' — WALK-OFF';
        }
        break;
      }
    }
    off.runs += runs;
    (offIdx === 0 ? line.away : line.home).push(runs);
    return runs;
  }

  while (!done) {
    halfInning(0, inning);
    if (inning >= 9 && sides[1].runs > sides[0].runs) {
      line.home.push('X');
      done = true;
      break;
    }
    halfInning(1, inning);
    if (walkoff) { done = true; break; }
    if (inning >= 9 && sides[0].runs !== sides[1].runs) done = true;
    else if (inning >= 14) {
      // break the tie
      if (sides[0].runs === sides[1].runs) sides[rng() < 0.5 ? 0 : 1].runs++;
      done = true;
    }
    inning++;
  }

  // decisions
  const hw = sides[1].runs > sides[0].runs;
  const winner = hw ? home : away;
  const loser = hw ? away : home;
  const wSide = hw ? sides[1] : sides[0];
  const lSide = hw ? sides[0] : sides[1];
  wSide.starter.pst.w++;
  lSide.starter.pst.l++;
  if (wSide.pitchers.length > 1) wSide.pitchers[wSide.pitchers.length - 1].pst.sv++;
  sides.forEach((s) => {
    s.starter.pst.gs++;
    s.pitchers.forEach((p) => {
      p.pst.g++;
      p.gFat = 0;
    });
    s.L.lineup.forEach((p) => p.st.g++);
  });
  home.rotIdx = (home.rotIdx || 0) + 1;
  away.rotIdx = (away.rotIdx || 0) + 1;

  // fatigue / condition
  sides.forEach((s) => {
    s.pitchers.forEach((p) => {
      p.cond = clamp(p.cond - (p.pos === 'SP' ? 26 : 12) * (has(p, 'IRON') ? 0.6 : 1), 0, 100);
    });
    s.L.lineup.forEach((p) => {
      p.cond = clamp(p.cond - 4, 0, 100);
    });
  });

  return {
    ok: true,
    homeRuns: sides[1].runs,
    awayRuns: sides[0].runs,
    homeId: home.id,
    awayId: away.id,
    winnerId: winner.id,
    loserId: loser.id,
    line,
    pbp,
    innings: inning,
    walkoff,
    wp: wSide.starter.name,
    lp: lSide.starter.name
  };
}
