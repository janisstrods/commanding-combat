// Fog of War (§E57): each player takes one card at random from the other's hand; both cards go to their owners' discard
// piles (not a pass discard: nothing answers it). The blind pick is modelled as a shuffle of the hand's cards with the
// seeded RNG (so a replay is exact) and taking the first.
import type { EventHandler } from '../registry';
import { shuffle } from '../rng';
import { type CardId, SIDES, type Side } from '../types';

export const fogOfWarEvent: EventHandler = function* (s, ctx) {
  const picks: [Side, CardId][] = [];
  for (const side of SIDES) {
    const hand = s.players[side].hand;
    if (hand.length) picks.push([side, shuffle(s, hand.slice())[0]]);
  }
  for (const [side, c] of picks) {
    const p = s.players[side];
    p.hand.splice(p.hand.indexOf(c), 1);
    p.discards.push(c);
    ctx.emit({ kind: 'discard', side, cards: [c] });
  }
};
