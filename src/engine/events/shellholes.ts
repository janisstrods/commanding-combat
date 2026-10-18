// Shellholes (§E73): a Random Hex; unless it is Water (Stream, Marsh), ablaze or holds a Fortification, Foxholes are
// placed there.
import type { EventHandler } from '../registry';
import { fortEvent } from './helpers';

export const shellholesEvent: EventHandler = function* (s, ctx, receiver) {
  yield* fortEvent(s, ctx, receiver, 'Shellholes', 'foxholes');
};
