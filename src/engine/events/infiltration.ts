// Infiltration (§E59): the receiver rolls on his Support Table (a roll inside an Event: it can be re-rolled with the
// Initiative, it never triggers), takes one item of that column free (no Radio; available in the scenario year; a named
// Leader only from the counter mix), then a Random Hex: the unit (with its Weapon) goes in or adjacent to it, stacking
// observed, not impassable (an enemy-occupied hex is allowed: the melee comes at the end of the Event).
// Ruling: with no item to take, no Random Hex is determined (it only says where the item goes).
import { randomHex, roll } from '../deck';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { type Holders, bringIn, eventMelees, note, noteHolder, optionFigures, placementsAround, supportOptions } from './helpers';

export const infiltrationEvent: EventHandler = function* (s, ctx, receiver) {
  const r = yield* roll(s, ctx, receiver, 'support');
  const opts = supportOptions(s, receiver, r.sum, false);
  if (!opts.length) {
    note(ctx, receiver, `Infiltration: column ${r.sum} of his Support Table has nothing for ${s.year}.`);
    return;
  }
  const items = opts.map((o) => ({ label: o.label }));
  const [i] = yield* choose(s, ctx, receiver, 'infiltration', items, 1, 1, { roll: r.sum, options: opts });
  const o = opts[i];
  const hex = yield* randomHex(s, ctx, receiver);
  const hexes = placementsAround(s, hex, receiver, optionFigures(o));
  if (!hexes.length) {
    note(ctx, receiver, `Infiltration: no room for the ${o.label} in or next to the Random Hex.`);
    return;
  }
  const [j] = yield* choose(s, ctx, receiver, 'infiltrationPlace', hexes.map((h) => ({ hex: h })), 1, 1, { hex, option: o });
  const holders: Holders = {};
  noteHolder(s, holders, hexes[j], receiver);
  bringIn(s, ctx, receiver, o, hexes[j]);
  yield* eventMelees(s, ctx, holders);
};
