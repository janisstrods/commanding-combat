// Reinforcements (§E68, R-49): the receiver rolls on his Support Table (a roll inside an Event: it can be re-rolled
// with the Initiative, it never triggers) and takes one item of that column free (available in the scenario year; only
// what the counter mix still has, mix.ts / R-56; Radios allowed). A Radio goes to his Artillery Box, if it is empty
// (else it is not placed); a unit (with its Weapon) enters in a hex along his own edge, stacking observed, not
// impassable (an enemy-occupied hex is allowed, R-33: the melee comes at the end of the Event).
import { edgeHexes, roll } from '../deck';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { figures, stackLimit } from '../stats';
import { isImpassableHex, radioOf, takeFromMix } from '../state';
import { type Holders, bringIn, eventMelees, ids, note, noteHolder, optionFigures, supportOptions } from './helpers';

export const reinforcementsEvent: EventHandler = function* (s, ctx, receiver) {
  const r = yield* roll(s, ctx, receiver, 'support');
  const opts = supportOptions(s, receiver, r.sum, true);
  if (!opts.length) {
    note(ctx, receiver, `Reinforcements: column ${r.sum} of his Support Table has nothing for ${s.year}.`);
    return;
  }
  const items = opts.map((o) => ({ label: o.label }));
  const [i] = yield* choose(s, ctx, receiver, 'reinforcementItem', items, 1, 1, { roll: r.sum, options: opts });
  const o = opts[i];
  if (o.radio) {
    if (radioOf(s, receiver)) {
      note(ctx, receiver, 'Reinforcements: his Artillery Box already holds a Radio.');
      return;
    }
    const radio = takeFromMix(s, o.radio, receiver, 'artillery')!; // offered only while the mix has it
    ctx.emit({ kind: 'reinforce', pieces: [radio.id] });
    return;
  }
  const f = optionFigures(o);
  const hexes = edgeHexes(s.players[receiver].edge).filter((h) => !isImpassableHex(s, h) && figures(s, h, receiver) + f <= stackLimit(s, h));
  if (!hexes.length) {
    note(ctx, receiver, `Reinforcements: no room for the ${o.label} along his edge.`);
    return;
  }
  const [j] = yield* choose(s, ctx, receiver, 'reinforcementPlace', hexes.map((hex) => ({ hex })), 1, 1, { option: o });
  const holders: Holders = {};
  noteHolder(s, holders, hexes[j], receiver);
  ctx.emit({ kind: 'reinforce', pieces: ids(bringIn(s, ctx, receiver, o, hexes[j])) });
  yield* eventMelees(s, ctx, holders);
};
