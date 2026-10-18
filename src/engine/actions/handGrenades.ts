// Hand Grenades (§A34): just before a Fire Attack Roll in which a firing piece is adjacent to the target (one hex of a
// Fire Group suffices; with Spray Fire either hex, R-19): +2 FP.
import { distance } from '../hex';
import { hexOf } from '../state';
import { fpAction } from './common';

export const handGrenadesAction = fpAction('Hand Grenades', (s, attack) =>
  attack.pieces.some((id) => {
    const h = hexOf(s, s.pieces[id]);
    return h >= 0 && attack.targets.some((t) => distance(h, t) === 1);
  }),
);
