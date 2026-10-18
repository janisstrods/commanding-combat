// Rubble (§E69): a Random Hex; unless it is Water (Stream, Marsh), ablaze or holds a Fortification, Wire is placed there.
import type { EventHandler } from '../registry';
import { fortEvent } from './helpers';

export const rubbleEvent: EventHandler = function* (s, ctx, receiver) {
  yield* fortEvent(s, ctx, receiver, 'Rubble', 'wire');
};
