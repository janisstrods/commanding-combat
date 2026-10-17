// STUB owned by Task 7 — replace
// Melee (§O16.4): fought in `hex`, which holds units of both sides, at the end of the Order or trigger that mixed them
// (flow.ts `resolveMelees` calls this once per such hex; inside an Event the ctx is at a deeper trigger level, so its
// rolls never trigger, R-04). Wrap the eliminations in casualties.ts `simultaneously` (both sides may lose at once).
import type { Gen } from './decisions';
import type { FlowCtx, GameState, HexId } from './types';

export function* resolveMelee(_s: GameState, ctx: FlowCtx, hex: HexId): Gen {
  ctx.emit({ kind: 'log', text: `Melee in hex ${hex}: not yet implemented` });
}
