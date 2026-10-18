// KIA (§E62, R-54): the receiver must eliminate one broken unit of either side (an outright elimination: no Light
// Wounds).
import { eliminate } from '../casualties';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { mapUnits, note } from './helpers';

export const kiaEvent: EventHandler = function* (s, ctx, receiver) {
  const units = mapUnits(s, undefined, (p) => p.broken);
  if (!units.length) {
    note(ctx, receiver, 'KIA: no broken unit on the map.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'kia', units.map((p) => ({ piece: p.id })), 1, 1);
  yield* eliminate(s, ctx, units[i].id, 'event');
};
