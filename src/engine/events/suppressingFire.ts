// Suppressing Fire (§E75): the receiver may Suppress one enemy unit without a Suppressed marker that is within the
// current Range and LOS of one of his unbroken machine guns carried by an unbroken, unsuppressed friendly unit.
import { suppress } from '../casualties';
import { choose } from '../decisions';
import { distance } from '../hex';
import { losCheck } from '../los';
import type { EventHandler } from '../registry';
import { weaponStats } from '../stats';
import { hexOf, typeOf } from '../state';
import { type HexId, other } from '../types';
import { mapUnits, note } from './helpers';

export const suppressingFireEvent: EventHandler = function* (s, ctx, receiver) {
  const guns: { hex: HexId; range: number }[] = [];
  for (const id in s.pieces) {
    const w = s.pieces[id];
    if (w.side !== receiver || w.where !== 'carried' || w.broken || typeOf(w).weaponClass !== 'mg' || !w.carrier) continue;
    const c = s.pieces[w.carrier];
    if (!c || c.where !== 'map' || c.broken || c.suppressed) continue;
    guns.push({ hex: hexOf(s, w), range: weaponStats(s, id).range });
  }
  const seen = new Map<HexId, boolean>();
  const covered = (hex: HexId) => {
    let v = seen.get(hex);
    if (v === undefined) {
      v = guns.some((g) => {
        const d = distance(g.hex, hex);
        return d >= 1 && d <= g.range && losCheck(s, g.hex, hex).clear;
      });
      seen.set(hex, v);
    }
    return v;
  };
  const targets = guns.length ? mapUnits(s, other(receiver), (p) => !p.suppressed && covered(p.hex)) : [];
  if (!targets.length) {
    note(ctx, receiver, 'Suppressing Fire: no enemy unit is in Range and LOS of a working machine gun of his.');
    return;
  }
  const pick = yield* choose(s, ctx, receiver, 'suppressingFire', targets.map((p) => ({ piece: p.id })), 0, 1);
  if (pick.length) suppress(s, ctx, targets[pick[0]].id);
};
