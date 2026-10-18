// Crossfire (§A30): just before a Fire Attack Roll at a hex holding a unit activated to Move (moved, moving or yet to
// move, R-28; with Spray Fire either hex, R-19): +2 FP.
import { fpAction } from './common';

export const crossfireAction = fpAction('Crossfire', (s, attack) =>
  s.turn.moving.some((id) => {
    const p = s.pieces[id];
    return p?.where === 'map' && p.side !== attack.side && attack.targets.includes(p.hex);
  }),
);
