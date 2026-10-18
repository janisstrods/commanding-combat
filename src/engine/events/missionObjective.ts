// Mission Objective (§E65): the receiver draws a random Objective chit as an extra secret one (a chit without a secret
// side goes open and scores at once, §7.3.3).
import type { EventHandler } from '../registry';
import { drawChit } from '../objectives';
import { note } from './helpers';

export const missionObjectiveEvent: EventHandler = function* (s, ctx, receiver) {
  if (drawChit(s, ctx, receiver, false) === null) note(ctx, receiver, 'Mission Objective: no chit is left in the cup.');
};
