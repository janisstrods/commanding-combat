// Malfunction (§E63): a Random Hex; the unbroken Weapon (either side) nearest to it breaks. Ties: the receiver picks.
// Radios are not Weapons; only Weapons on the map (carried by a unit there) count.
import { breakPiece } from '../casualties';
import { randomHex } from '../deck';
import { choose } from '../decisions';
import { distance } from '../hex';
import type { EventHandler } from '../registry';
import { hexOf, isWeapon } from '../state';
import type { Piece } from '../types';
import { nearest, note } from './helpers';

export const malfunctionEvent: EventHandler = function* (s, ctx, receiver) {
  const hex = yield* randomHex(s, ctx, receiver);
  const weapons: Piece[] = [];
  for (const id in s.pieces) {
    const w = s.pieces[id];
    if (isWeapon(w) && w.where === 'carried' && !w.broken && hexOf(s, w) >= 0) weapons.push(w);
  }
  const close = nearest(weapons, (w) => distance(hex, hexOf(s, w)));
  if (!close.length) {
    note(ctx, receiver, 'Malfunction: no unbroken Weapon on the map.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'malfunctionTie', close.map((w) => ({ piece: w.id })), 1, 1, { hex });
  yield* breakPiece(s, ctx, close[i].id, 'event');
};
