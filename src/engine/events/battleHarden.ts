// Battle Harden (§E44, §13): the receiver must put a Veteran marker on one of his units on the map that has none.
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { mapUnits, note } from './helpers';

export const battleHardenEvent: EventHandler = function* (s, ctx, receiver) {
  const units = mapUnits(s, receiver, (p) => !p.veteran);
  if (!units.length) {
    note(ctx, receiver, 'Battle Harden: no unit of his can take a Veteran marker.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'battleHarden', units.map((p) => ({ piece: p.id })), 1, 1);
  units[i].veteran = true;
  ctx.emit({ kind: 'veteran', piece: units[i].id });
};
