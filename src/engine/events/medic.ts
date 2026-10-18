// Medic! (§E64): the receiver must Rally one broken unit of either side.
import { rally } from '../casualties';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { mapUnits, note } from './helpers';

export const medicEvent: EventHandler = function* (s, ctx, receiver) {
  const units = mapUnits(s, undefined, (p) => p.broken);
  if (!units.length) {
    note(ctx, receiver, 'Medic: no broken unit on the map.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'medic', units.map((p) => ({ piece: p.id })), 1, 1);
  rally(s, ctx, units[i].id);
};
