// Interrogation (§E61, Golden Rule §1.0): the opponent shows his whole hand — the 'choose' decision lists his cards to
// the receiver — and the receiver may send one of them to the opponent's discard pile.
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { other } from '../types';
import { note } from './helpers';

export const interrogationEvent: EventHandler = function* (s, ctx, receiver) {
  const opp = other(receiver);
  const hand = s.players[opp].hand.slice();
  if (!hand.length) {
    note(ctx, receiver, 'Interrogation: the opponent holds no cards.');
    return;
  }
  const pick = yield* choose(s, ctx, receiver, 'interrogation', hand.map((card) => ({ card })), 0, 1, { from: opp });
  if (!pick.length) return;
  const c = hand[pick[0]];
  const p = s.players[opp];
  p.hand.splice(p.hand.indexOf(c), 1);
  p.discards.push(c);
  ctx.emit({ kind: 'discard', side: opp, cards: [c] });
};
