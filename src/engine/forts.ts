// STUB owned by Task 7 — replace
// Fortification effects on movement (§F103 Mines, §F105 Trench, §F106 Wire), called by the Move Order's loop
// (orders/move.ts) and by Advance / Retreat (Task 7). The Trench 1-MP cost is terrain.ts `moveCost` (with the state).
// - `onLeaveHex(...)` before units leave `from` (Mines attack leavers; leaving Wire ends the move after the next hex).
// - `onEnterHex(...)` after units entered `to` and paid for it (Mines attack; Wire stops a Move; Trench-to-Trench
//   movement cannot be Op Fired: `noOpFire`).
// Units may be broken or eliminated by these; the caller re-reads the state afterwards.
import type { Gen } from './decisions';
import type { FlowCtx, GameState, HexId, PieceId } from './types';

export type HowMoved = 'move' | 'advance' | 'retreat';

/** Before `units` leave `from` for `to`. `stop`: they may enter `to` but must end their move there. */
export function* onLeaveHex(_s: GameState, _ctx: FlowCtx, _units: PieceId[], _from: HexId, _to: HexId, _how: HowMoved): Gen<{ stop: boolean }> {
  return { stop: false };
}

/** After `units` entered `to` from `from`. `stop`: their move ends here; `noOpFire`: no Op Fire at this entry. */
export function* onEnterHex(
  _s: GameState, _ctx: FlowCtx, _units: PieceId[], _from: HexId, _to: HexId, _how: HowMoved,
): Gen<{ stop: boolean; noOpFire: boolean }> {
  return { stop: false, noOpFire: false };
}
