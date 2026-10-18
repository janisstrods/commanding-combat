// Élan (§E54, R-40): the receiver's Surrender marker moves one space higher (one more casualty before he surrenders).
import type { EventHandler } from '../registry';
import { note } from './helpers';

export const elanEvent: EventHandler = function* (s, ctx, receiver) {
  const p = s.players[receiver];
  p.surrender++;
  note(ctx, receiver, `Élan: he now surrenders at ${p.surrender} casualties.`);
};
