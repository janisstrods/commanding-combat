// Booby Trap (§E47): a Random Hex; unless it is Water (Stream, Marsh), ablaze or holds a Fortification, Mines are placed
// there. Units already in the hex are attacked only when they later leave it by Move, Advance or Retreat (§F103).
import type { EventHandler } from '../registry';
import { fortEvent } from './helpers';

export const boobyTrapEvent: EventHandler = function* (s, ctx, receiver) {
  yield* fortEvent(s, ctx, receiver, 'Booby Trap', 'mines');
};
