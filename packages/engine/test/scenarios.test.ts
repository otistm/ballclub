import { describe, expect, it } from 'vitest';
import {
  applyAction, createLeague, nextScenario, pickScenarioPlayer, resolveScenario,
  type HumanConfig, type League
} from '../src/index.js';

const HUMAN: HumanConfig = {
  name: 'Ashland Wolves', city: 'Ashland', mascot: 'Wolves',
  cls: 'OLD_LION', color: '#C4553A', glyph: 'lion', vibe: 'NIGHT'
};

function draftedLeague(seed = 77): League {
  const league = createLeague(seed, HUMAN);
  applyAction(league, { t: 'advanceDraft' });
  let guard = 0;
  while (league.phase === 'draft' && guard++ < 300) {
    const cur = league.draftOrder[league.draftIdx];
    if (!cur) break;
    const team = league.teams.find((t) => t.id === cur.teamId)!;
    if (team.isHuman) {
      applyAction(league, { t: 'draftPick', teamId: team.id, playerId: league.draftPool[0].id });
    } else {
      applyAction(league, { t: 'advanceDraft' });
    }
  }
  return league;
}

describe('desk arcs and targeted effects', () => {
  it('picks an ace for player-targeted effects', () => {
    const league = draftedLeague();
    const me = league.teams.find((t) => t.isHuman)!;
    const ace = pickScenarioPlayer(me, 'ace', () => 0.2);
    expect(ace).toBeTruthy();
    expect(ace!.pos === 'SP' || ace!.ovr >= 50).toBe(true);
  });

  it('applies morale to one player from a forced card', () => {
    const league = draftedLeague();
    const me = league.teams.find((t) => t.isHuman)!;
    me.deskPending = true;
    league.scenarioDeck = ['sc_ace_innings', ...league.scenarioDeck];
    league.scenarioIdx = 0;
    const before = me.roster.filter((p) => p.pos === 'SP').sort((a, b) => b.ovr - a.ovr)[0];
    const moraleBefore = before.morale;
    const r = applyAction(league, { t: 'scenario', teamId: me.id, side: 'left' });
    expect(r.ok).toBe(true);
    expect(before.morale).not.toBe(moraleBefore);
  });

  it('schedules and fires a multi-series arc', () => {
    const league = draftedLeague();
    const me = league.teams.find((t) => t.isHuman)!;
    me.deskPending = true;
    league.scenarioDeck = ['sc_camp_1', ...league.scenarioDeck.filter((id) => id !== 'sc_camp_1')];
    league.scenarioIdx = 0;
    const start = applyAction(league, { t: 'scenario', teamId: me.id, side: 'right' });
    expect(start.ok).toBe(true);
    expect(me.deskArc?.id).toBe('camp');
    expect(me.deskArc?.cardIds[0]).toBe('sc_camp_sore');
    const due = me.deskArc!.nextWeek;

    let guard = 0;
    while (league.week < due && guard++ < 20) {
      if (me.deskPending) {
        const peek = nextScenario(league, me);
        if (peek?.id === 'sc_camp_sore') break;
        applyAction(league, { t: 'scenario', teamId: me.id, side: 'left' });
      }
      applyAction(league, { t: 'week' });
    }
    me.deskPending = true;
    const sc = nextScenario(league, me);
    expect(sc?.id).toBe('sc_camp_sore');
    const follow = resolveScenario(league, me, 'right');
    expect(follow?.sc.id).toBe('sc_camp_sore');
    expect(me.deskArc).toBeNull();
  });

  it('can hit the next opponent via rivalEff', () => {
    const league = draftedLeague();
    const me = league.teams.find((t) => t.isHuman)!;
    me.deskPending = true;
    league.scenarioDeck = ['sc_umps', ...league.scenarioDeck.filter((id) => id !== 'sc_umps')];
    league.scenarioIdx = 0;
    const pr = league.schedule[league.week].find((p) => p.home === me.id || p.away === me.id)!;
    const oppId = pr.home === me.id ? pr.away : pr.home;
    const opp = league.teams.find((t) => t.id === oppId)!;
    const trustBefore = opp.fanTrust;
    applyAction(league, { t: 'scenario', teamId: me.id, side: 'right' });
    expect(opp.fanTrust).toBe(trustBefore);
    expect(opp.weekBoost?.cond || 0).toBeLessThan(0);
  });
});
