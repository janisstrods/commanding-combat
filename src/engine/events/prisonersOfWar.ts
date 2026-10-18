// Prisoners of War (§E66, R-54): the receiver must eliminate one of his own broken units that is in or adjacent to a hex
// holding an enemy unit (an outright elimination: no Light Wounds).
import { eliminate } from '../casualties';
import { choose } from '../decisions';
import { neighbours } from '../hex';
import type { EventHandler } from '../registry';
import { hasUnitOf } from '../state';
import { other } from '../types';
import { mapUnits, note } from './helpers';

export const prisonersOfWarEvent: EventHandler = function* (s, ctx, receiver) {
  const enemy = other(receiver);
  const units = mapUnits(s, receiver, (p) => p.broken && [p.hex, ...neighbours(p.hex)].some((h) => hasUnitOf(s, h, enemy)));
  if (!units.length) {
    note(ctx, receiver, 'Prisoners of War: no broken unit of his is in or next to an enemy hex.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'pow', units.map((p) => ({ piece: p.id })), 1, 1);
  yield* eliminate(s, ctx, units[i].id, 'event');
};
