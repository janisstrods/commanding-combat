// The counter mix (§E42, FAQ "Counter Mix Limits", ruling R-56): how many counters of each type and Fortification
// markers of each kind exist, and how many of them a game has left. One table drives every limit: src/data/mix.json,
// built by scripts/build-data.ts (mix) from design/data/counter-mix.json and the game data. Its users: RSG purchases
// (rsg/tables.ts), Deploy and the free Deploy against overstacking (§E52, §8.2), Light Wounds (§A36), Infiltration,
// Reinforcements and Hidden Unit items (§E59, §E68, §A35.4), Heroes, Privates and named Leaders, and every
// Fortification placed in play (Actions here, Events in events/, state.ts `placeFort`).
//
// A counter is in play wherever it is except the mix: on the map, carried, in staging, on the Time Track, on the
// Casualty Track, in the Weapons box, in the Artillery Box (pieces on the Track Display are in play, FAQ). It goes back
// to the mix only when a rule says so: a Squad replaced by Teams, an eliminated Radio or Hero, an exited Hero, a
// Fortification taken off the map (Sappers, Demolitions, Artillery, Blaze).
import mixJson from '../data/mix.json';
import { teamFor } from './data';
import type { ActionName, FortKind, GameState, Side } from './types';

const COUNTS: Readonly<Record<string, number>> = mixJson.counters;
const FORTS = mixJson.fortifications as Readonly<Record<FortKind, number>>;

/** Fortification names for messages. */
export const FORT_NAMES: Readonly<Record<FortKind, string>> = {
  foxholes: 'Foxholes', trench: 'Trench', bunker: 'Bunker', pillbox: 'Pillbox', wire: 'Wire', mines: 'Mines',
};

/** How many counters of type `type` the mix holds in all (0 for a type it has none of). */
export function mixCount(type: string): number {
  return COUNTS[type] ?? 0;
}

/** How many Fortification markers of `kind` the mix holds in all. */
export function fortMixCount(kind: FortKind): number {
  return FORTS[kind] ?? 0;
}

/** How many counters of `type` are in play (either side, anywhere but the mix). */
export function inPlayCount(s: GameState, type: string): number {
  let n = 0;
  for (const id in s.pieces) if (s.pieces[id].type === type && s.pieces[id].where !== 'mix') n++;
  return n;
}

/** How many more counters of `type` can enter play. */
export function mixLeft(s: GameState, type: string): number {
  return Math.max(0, mixCount(type) - inPlayCount(s, type));
}

/** Can all of `types` enter play together (a type listed twice needs two counters)? */
export function mixHas(s: GameState, types: readonly string[]): boolean {
  const need: Record<string, number> = {};
  for (const t of types) need[t] = (need[t] ?? 0) + 1;
  return Object.entries(need).every(([t, n]) => mixLeft(s, t) >= n);
}

/** How many more Fortification markers of `kind` can be placed (the ones on the map are in play). */
export function fortsLeft(s: GameState, kind: FortKind): number {
  let n = 0;
  for (const k of s.fort) if (k === kind) n++;
  return Math.max(0, fortMixCount(kind) - n);
}

/** The Team counter type `side` takes for Deploy and Light Wounds: his OB troop quality (FAQ). */
export function teamOf(s: GameState, side: Side): string {
  const pl = s.players[side];
  return teamFor(pl.nation, pl.quality);
}

/** How many more Teams of his troop quality `side` can take from the mix. */
export function teamsLeft(s: GameState, side: Side): number {
  return mixLeft(s, teamOf(s, side));
}

/** The Fortification each Action places (design/data/counter-mix.json `fortPlacers`, pinned by tests/rules/mix.test.ts). */
const ACTION_FORT: Partial<Record<ActionName, FortKind>> = {
  'Dig In': 'foxholes', 'Hidden Entrenchments': 'foxholes', 'Hidden Mines': 'mines', 'Hidden Pillbox': 'pillbox', 'Hidden Wire': 'wire',
};

/**
 * Why `side` cannot play Action `name` because the mix lacks what it brings into play (R-56: an Action whose counter
 * is not available cannot be played), or null. Light Wounds needs one Team of his troop quality; the Fortification
 * Actions one marker of their kind. reactions.ts offers no such play and decisions.ts `answerError` refuses one.
 */
export function actionMixError(s: GameState, side: Side, name: ActionName): string | null {
  if (name === 'Light Wounds' && teamsLeft(s, side) < 1) return `The counter mix has no ${teamOf(s, side).split('/')[1]} left (R-56).`;
  const kind = ACTION_FORT[name];
  if (kind && fortsLeft(s, kind) < 1) return `The counter mix has no ${FORT_NAMES[kind]} left (R-56).`;
  return null;
}
