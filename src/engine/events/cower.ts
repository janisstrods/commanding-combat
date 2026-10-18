// Cower (§E51): the receiver must Suppress each of his Squads on the map (broken or not; not Teams or Leaders) that is
// not Suppressed yet and is outside the Command radius of every friendly Leader (its current Command; 0 = own hex).
import { suppress } from '../casualties';
import { distance } from '../hex';
import type { EventHandler } from '../registry';
import { currentStats } from '../stats';
import { isLeader, typeOf } from '../state';
import { mapUnits } from './helpers';

export const cowerEvent: EventHandler = function* (s, ctx, receiver) {
  const leaders = mapUnits(s, receiver, (p) => isLeader(p));
  const squads = mapUnits(s, receiver, (p) => typeOf(p).kind === 'squad' && !p.suppressed);
  for (const sq of squads) {
    if (leaders.some((l) => distance(l.hex, sq.hex) <= currentStats(s, l.id).command)) continue;
    suppress(s, ctx, sq.id);
  }
};
