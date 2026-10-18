// Commissar (§E50, Russian deck only): the Russian player must pick one of his broken units and roll for it (a roll
// inside an Event: it can be re-rolled with the Initiative, it never triggers): above its current Morale (with the Cover
// of its hex, which counts for every purpose, §T78.3; taken at the roll) it is eliminated, otherwise it rallies.
import { eliminate, rally } from '../casualties';
import { roll } from '../deck';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { emitRallying, rollMorale } from '../orders/recover';
import { mapUnits, note } from './helpers';

export const commissarEvent: EventHandler = function* (s, ctx, receiver) {
  if (s.players[receiver].nation !== 'Russian') {
    note(ctx, receiver, 'Commissar: only for the Russians.');
    return;
  }
  const units = mapUnits(s, receiver, (p) => p.broken);
  if (!units.length) {
    note(ctx, receiver, 'Commissar: no broken unit of his on the map.');
    return;
  }
  const [i] = yield* choose(s, ctx, receiver, 'commissar', units.map((p) => ({ piece: p.id })), 1, 1);
  const id = units[i].id;
  const morale = rollMorale(s, id);
  emitRallying(s, ctx, receiver, id, 'commissar');
  const r = yield* roll(s, ctx, receiver, 'eventRoll');
  const p = s.pieces[id];
  if (p.where !== 'map' || !p.broken) return; // a Time advance on the last card may have ended in a melee
  if (r.sum > morale) yield* eliminate(s, ctx, id, 'event');
  else rally(s, ctx, id);
};
