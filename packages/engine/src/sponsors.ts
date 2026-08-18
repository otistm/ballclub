import { clamp, hashStr, mulberry32, RI, shuffle } from './rng.js';
import { CLASSES } from './data/classes.js';
import { SPONSOR_POOL } from './data/sponsors.js';
import { noteOffice, sponsorOfferMul } from './progress.js';
import type { League, SponsorOffer, Team } from './types.js';

export function rollSponsorOffers(league: League, team: Team): SponsorOffer[] {
  const rng = mulberry32(league.seed + league.week * 77 + hashStr(team.id));
  const held = team.sponsors.map((s) => s.name);
  const avail = SPONSOR_POOL.filter((s) => held.indexOf(s.name) < 0);
  const offers: SponsorOffer[] = shuffle(rng, avail.slice())
    .slice(0, 3)
    .map((s) => {
      const mult = clamp(0.7 + team.fanTrust / 130 + (team.rank <= 3 ? 0.15 : 0), 0.6, 1.6) * sponsorOfferMul(team);
      return {
        name: s.name,
        kind: s.kind,
        base: s.base,
        req: s.req,
        penalty: s.penalty,
        offer: Math.round((s.base * mult * (CLASSES[team.cls].mods.sponsorValue || 1)) / 10000) * 10000,
        weeks: RI(rng, 6, 14)
      };
    });
  team.sponsorOffers = offers;
  return offers;
}

export interface SignSponsorResult {
  ok: boolean;
  sponsor?: SponsorOffer;
}

export function signSponsor(league: League, team: Team, name: string): SignSponsorResult {
  const o = team.sponsorOffers.find((s) => s.name === name);
  if (!o) return { ok: false };
  team.sponsors.push({
    name: o.name,
    kind: o.kind,
    req: o.req,
    base: o.offer,
    weeks: o.weeks,
    signedWeek: league.week,
    paid: 0,
    penalty: o.penalty
  });
  team.sponsorOffers = team.sponsorOffers.filter((s) => s.name !== name);
  if (o.penalty && o.penalty.trust) team.fanTrust = clamp(team.fanTrust + o.penalty.trust, 1, 100);
  noteOffice(team, 'sponsors', 16, 'Sponsor');
  return { ok: true, sponsor: o };
}
