// Hero (§E58, §3.4): if his Hero is not in play (an eliminated Hero is back in the counter mix), the receiver must place
// him in a friendly hex (§G: one holding a unit of his, or an Objective he controls without enemy units); then he may
// Rally one broken unit in that hex. A unit only pending a break is not broken yet, so it cannot be rallied.
import { rally } from '../casualties';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { isImpassableHex } from '../state';
import { friendlyHexes, fromMix, inPlay, mapUnits, note, putUnit, specialLeader } from './helpers';

export const heroEvent: EventHandler = function* (s, ctx, receiver) {
  const type = specialLeader(s, receiver, 'hero');
  if (!type || inPlay(s, type)) {
    note(ctx, receiver, type ? 'Hero: his Hero is already in play.' : 'Hero: he has no Hero.');
    return;
  }
  const hexes = friendlyHexes(s, receiver).filter((h) => !isImpassableHex(s, h));
  if (!hexes.length) {
    note(ctx, receiver, 'Hero: he has no friendly hex.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'heroPlace', hexes.map((hex) => ({ hex })), 1, 1, { type });
  const hex = hexes[i];
  putUnit(s, ctx, fromMix(s, type, receiver)!, hex);
  const broken = mapUnits(s, undefined, (p) => p.hex === hex && p.broken);
  const pick = yield* choose(s, ctx, receiver, 'heroRally', broken.map((p) => ({ piece: p.id })), 0, 1, { hex });
  if (pick.length) rally(s, ctx, broken[pick[0]].id);
};
