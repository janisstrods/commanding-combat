// Dust (§E53): a Random Hex; unless it is Water (Stream, Marsh) or ablaze, a random Smoke marker from the cup is placed
// there (a Smoke already there keeps the larger Hindrance, R-42).
import { randomHex } from '../deck';
import type { EventHandler } from '../registry';
import { drawSmoke, isWater, placeSmoke } from '../state';
import { note } from './helpers';

export const dustEvent: EventHandler = function* (s, ctx, receiver) {
  const hex = yield* randomHex(s, ctx, receiver);
  if (isWater(s.map, hex) || s.blaze[hex]) {
    note(ctx, receiver, 'Dust: no Smoke can be placed in the Random Hex.');
    return;
  }
  const v = drawSmoke(s);
  if (v === null) note(ctx, receiver, 'Dust: no Smoke marker is left in the cup.');
  else placeSmoke(s, ctx, hex, v);
};
