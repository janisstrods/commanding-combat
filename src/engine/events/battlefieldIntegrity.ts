// Battlefield Integrity (§E45): the receiver gains 1 VP for each enemy unit on the Casualty Track.
import { addVp } from '../casualties';
import type { EventHandler } from '../registry';
import { other } from '../types';
import { note } from './helpers';

export const battlefieldIntegrityEvent: EventHandler = function* (s, ctx, receiver) {
  const n = s.players[other(receiver)].casualties.length;
  if (!n) note(ctx, receiver, 'Battlefield Integrity: no enemy units on the Casualty Track.');
  addVp(s, ctx, receiver, n, 'Battlefield Integrity');
};
