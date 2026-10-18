// Air Support (§E43, R-47): a Random Hex; the receiver may break every unit in it, of both sides — or, if it is empty,
// every unit in the nearest hex holding units (ties: his pick). All or nothing.
import { breakPiece, simultaneously } from '../casualties';
import { randomHex } from '../deck';
import { choose } from '../decisions';
import { distance } from '../hex';
import type { EventHandler } from '../registry';
import { ids, mapUnits, nearest, note, occupiedHexes } from './helpers';

export const airSupportEvent: EventHandler = function* (s, ctx, receiver) {
  const hex = yield* randomHex(s, ctx, receiver);
  const occupied = occupiedHexes(s);
  if (!occupied.length) {
    note(ctx, receiver, 'Air Support: there are no units on the map.');
    return;
  }
  const hexes = occupied.includes(hex) ? [hex] : nearest(occupied, (h) => distance(hex, h));
  const pick = yield* choose(s, ctx, receiver, 'airSupport', hexes.map((h) => ({ hex: h })), 0, 1, { hex });
  if (!pick.length) return;
  const target = hexes[pick[0]];
  const units = ids(mapUnits(s, undefined, (p) => p.hex === target));
  yield* simultaneously(s, ctx, function* (c) {
    for (const id of units) yield* breakPiece(s, c, id, 'event');
  });
};
