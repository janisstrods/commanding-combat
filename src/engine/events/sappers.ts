// Sappers (§E70): the receiver may remove one Mines or one Wire marker from the map.
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { removeFort } from '../state';
import type { HexId } from '../types';
import { note } from './helpers';

export const sappersEvent: EventHandler = function* (s, ctx, receiver) {
  const hexes: HexId[] = [];
  for (let h = 0; h < s.fort.length; h++) if (s.fort[h] === 'mines' || s.fort[h] === 'wire') hexes.push(h);
  if (!hexes.length) {
    note(ctx, receiver, 'Sappers: there are no Mines or Wire on the map.');
    return;
  }
  const pick = yield* choose(s, ctx, receiver, 'sappers', hexes.map((hex) => ({ hex })), 0, 1);
  if (pick.length) removeFort(s, ctx, hexes[pick[0]]);
};
