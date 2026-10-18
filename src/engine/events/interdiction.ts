// Interdiction (§E60, R-36): the receiver must Suppress one unsuppressed unit (either side, broken or not) in a hex
// whose own Cover is less than 1 (terrain with the Road −1, or its Fortification; no hexside Cover).
import { suppress } from '../casualties';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { hexCover } from '../stats';
import { mapUnits, note } from './helpers';

export const interdictionEvent: EventHandler = function* (s, ctx, receiver) {
  const units = mapUnits(s, undefined, (p) => !p.suppressed && hexCover(s, p.hex) < 1);
  if (!units.length) {
    note(ctx, receiver, 'Interdiction: no unsuppressed unit is in a hex with Cover below 1.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'interdiction', units.map((p) => ({ piece: p.id })), 1, 1);
  suppress(s, ctx, units[i].id);
};
