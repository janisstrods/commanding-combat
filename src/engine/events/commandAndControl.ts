// Command & Control (§E49): the receiver gains 1 VP for each Objective he controls.
import { addVp } from '../casualties';
import type { EventHandler } from '../registry';
import { note } from './helpers';

export const commandAndControlEvent: EventHandler = function* (s, ctx, receiver) {
  const n = s.control.filter((c) => c === receiver).length;
  if (!n) note(ctx, receiver, 'Command & Control: he controls no Objective.');
  addVp(s, ctx, receiver, n, 'Command & Control');
};
