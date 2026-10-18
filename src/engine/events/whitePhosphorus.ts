// White Phosphorus (§E77, American deck only): the receiver may draw a random Smoke and put it next to any unbroken
// Squad of his, in a hex that is not Water, Stream or Marsh and has no Blaze. If he does, each player with units in that
// hex (the inactive player first) must break one of his own units there — even if the Smoke already there was larger
// and stays (R-42: the marker was placed, then stacking kept the larger). Both may lose at once.
import { breakPiece, simultaneously } from '../casualties';
import { choose } from '../decisions';
import { neighbours } from '../hex';
import type { EventHandler } from '../registry';
import { drawSmoke, isWater, placeSmoke, typeOf } from '../state';
import { other } from '../types';
import { mapUnits, note } from './helpers';

export const whitePhosphorusEvent: EventHandler = function* (s, ctx, receiver) {
  if (s.players[receiver].nation !== 'American') {
    note(ctx, receiver, 'White Phosphorus: only for the Americans.');
    return;
  }
  const squads = mapUnits(s, receiver, (p) => typeOf(p).kind === 'squad' && !p.broken);
  const hexes = [...new Set(squads.flatMap((p) => neighbours(p.hex)))].filter((h) => !isWater(s.map, h) && !s.blaze[h]).sort((a, b) => a - b);
  if (!hexes.length || !s.smokeCup.length) {
    note(ctx, receiver, hexes.length ? 'White Phosphorus: no Smoke marker is left in the cup.' : 'White Phosphorus: no hex next to an unbroken Squad of his can take Smoke.');
    return;
  }
  const pick = yield* choose(s, ctx, receiver, 'whitePhosphorus', hexes.map((hex) => ({ hex })), 0, 1);
  if (!pick.length) return;
  const hex = hexes[pick[0]];
  placeSmoke(s, ctx, hex, drawSmoke(s)!);
  yield* simultaneously(s, ctx, function* (c) {
    for (const side of [other(s.active), s.active]) {
      const units = mapUnits(s, side, (p) => p.hex === hex);
      if (!units.length) continue;
      const [i] = yield* choose(s, c, side, 'whitePhosphorusLoss', units.map((p) => ({ piece: p.id })), 1, 1, { hex });
      yield* breakPiece(s, c, units[i].id, 'event');
    }
  });
};
