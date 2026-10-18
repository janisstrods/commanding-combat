// Field Promotion (§E56, §3.4): if his Private is not in play (on the map, or eliminated on the Casualty Track: counter
// mix, §E42), the receiver may place him in a hex holding one of his broken units.
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { mixLeft } from '../mix';
import { takeFromMix } from '../state';
import { mapUnits, note, putUnit, specialLeader } from './helpers';

export const fieldPromotionEvent: EventHandler = function* (s, ctx, receiver) {
  const type = specialLeader(s, receiver, 'private');
  if (!type || mixLeft(s, type) < 1) {
    note(ctx, receiver, type ? 'Field Promotion: his Private is already in play.' : 'Field Promotion: he has no Private.');
    return;
  }
  const hexes = [...new Set(mapUnits(s, receiver, (p) => p.broken).map((p) => p.hex))].sort((a, b) => a - b);
  if (!hexes.length) {
    note(ctx, receiver, 'Field Promotion: no broken unit of his on the map.');
    return;
  }
  const pick = yield* choose(s, ctx, receiver, 'fieldPromotion', hexes.map((hex) => ({ hex })), 0, 1, { type });
  if (pick.length) putUnit(s, ctx, takeFromMix(s, type, receiver)!, hexes[pick[0]]);
};
