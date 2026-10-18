// Walking Wounded (§E76, R-38, R-40): the receiver must pick one eliminated unit (either side) on the Casualty Track;
// then a Random Hex: he places that unit, broken, in or adjacent to it (its owner's stacking observed, not impassable).
// The VP scored for its elimination stay; its Casualty Track space empties. Ruling: with no unit on the Casualty Track
// no Random Hex is determined; with no room around the Random Hex the unit stays eliminated.
import { randomHex } from '../deck';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { unitFigures } from '../stats';
import { SIDES } from '../types';
import { type Holders, eventMelees, note, noteHolder, placementsAround, putUnit } from './helpers';

export const walkingWoundedEvent: EventHandler = function* (s, ctx, receiver) {
  const pool = SIDES.flatMap((side) => s.players[side].casualties.map((id) => s.pieces[id]).filter((p) => p?.where === 'casualty'));
  if (!pool.length) {
    note(ctx, receiver, 'Walking Wounded: no unit on the Casualty Track.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'walkingWounded', pool.map((p) => ({ piece: p.id })), 1, 1);
  const u = pool[i];
  const hex = yield* randomHex(s, ctx, receiver);
  const hexes = placementsAround(s, hex, u.side, unitFigures(u));
  if (!hexes.length) {
    note(ctx, receiver, 'Walking Wounded: no room in or next to the Random Hex.');
    return;
  }
  const [j] = yield* choose(s, ctx, receiver, 'walkingWoundedPlace', hexes.map((h) => ({ hex: h })), 1, 1, { hex, piece: u.id });
  const list = s.players[u.side].casualties;
  list.splice(list.indexOf(u.id), 1);
  u.broken = true;
  const holders: Holders = {};
  noteHolder(s, holders, hexes[j], u.side);
  putUnit(s, ctx, u, hexes[j]);
  yield* eventMelees(s, ctx, holders);
};
