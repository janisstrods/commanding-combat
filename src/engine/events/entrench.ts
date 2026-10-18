// Entrench (§E55, Russian deck only): the receiver may place Foxholes in a hex he occupies that can take a Fortification
// (none there yet; not Water, Stream or Marsh).
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { canHoldFort, placeFort } from '../state';
import { mapUnits, note } from './helpers';

export const entrenchEvent: EventHandler = function* (s, ctx, receiver) {
  if (s.players[receiver].nation !== 'Russian') {
    note(ctx, receiver, 'Entrench: only for the Russians.');
    return;
  }
  const hexes = [...new Set(mapUnits(s, receiver).map((p) => p.hex))].filter((h) => canHoldFort(s, h)).sort((a, b) => a - b);
  if (!hexes.length) {
    note(ctx, receiver, 'Entrench: no hex of his can take Foxholes.');
    return;
  }
  const pick = yield* choose(s, ctx, receiver, 'entrenchHex', hexes.map((hex) => ({ hex })), 0, 1);
  if (pick.length) placeFort(s, ctx, hexes[pick[0]], 'foxholes');
};
