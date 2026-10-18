// Shell Shock (§E72): a Random Hex; the unit (either side, broken or not) nearest to it breaks — a broken one is
// eliminated; a Squad's owner may answer with Light Wounds (R-54). Ties: the receiver picks.
import { breakPiece } from '../casualties';
import { randomHex } from '../deck';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { dist, mapUnits, nearest, note } from './helpers';

export const shellShockEvent: EventHandler = function* (s, ctx, receiver) {
  const hex = yield* randomHex(s, ctx, receiver);
  const close = nearest(mapUnits(s), dist(hex));
  if (!close.length) {
    note(ctx, receiver, 'Shell Shock: there are no units on the map.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'shellShockTie', close.map((p) => ({ piece: p.id })), 1, 1, { hex });
  yield* breakPiece(s, ctx, close[i].id, 'event');
};
