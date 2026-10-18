// Entrench (§E55, Russian deck only): the receiver may place Foxholes in a hex he occupies that can take a Fortification
// (none there yet; not Water, Stream or Marsh), if the counter mix has Foxholes left (R-56).
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { FORT_NAMES, fortsLeft } from '../mix';
import { canHoldFort, placeFort } from '../state';
import { mapUnits, note } from './helpers';

export const entrenchEvent: EventHandler = function* (s, ctx, receiver) {
  if (s.players[receiver].nation !== 'Russian') {
    note(ctx, receiver, 'Entrench: only for the Russians.');
    return;
  }
  if (fortsLeft(s, 'foxholes') < 1) {
    note(ctx, receiver, `Entrench: the counter mix has no ${FORT_NAMES.foxholes} left.`);
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
