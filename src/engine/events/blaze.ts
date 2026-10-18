// Blaze (§E46, R-34): a Random Hex; unless it is Water (Stream, Marsh) or ablaze already, a Blaze starts there: its
// Smoke and Fortification are removed and its units must move to an adjacent hex (or are eliminated).
import { randomHex } from '../deck';
import type { EventHandler } from '../registry';
import { canBlaze, displace, note, startBlaze } from './helpers';

export const blazeEvent: EventHandler = function* (s, ctx, receiver) {
  const hex = yield* randomHex(s, ctx, receiver);
  if (!canBlaze(s, hex)) {
    note(ctx, receiver, 'Blaze: no Blaze can start in the Random Hex.');
    return;
  }
  startBlaze(s, ctx, hex);
  yield* displace(s, ctx, [hex]);
};
