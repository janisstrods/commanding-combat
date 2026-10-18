// Strategic Objective (§E74): a random Objective chit is placed open; it scores at once for the current controllers.
import type { EventHandler } from '../registry';
import { drawChit } from '../objectives';
import { note } from './helpers';

export const strategicObjectiveEvent: EventHandler = function* (s, ctx, receiver) {
  if (drawChit(s, ctx, receiver, true) === null) note(ctx, receiver, 'Strategic Objective: no chit is left in the cup.');
};
