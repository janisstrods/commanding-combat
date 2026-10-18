// Fortification effects on movement (§F103 Mines, §F105 Trench, §F106 Wire), called by the Move Order's loop
// (orders/move.ts), by Advance (orders/advance.ts) and by Retreat (orders/rout.ts). The other effects live elsewhere:
// the Trench 1-MP cost is terrain.ts `moveCost` (with the state); Wire's −1 FP / Range / Morale is stats.ts
// `currentStats`, its Fire Group and Weapon limits fire.ts; Fortification Cover stats.ts; the Bunker / Pillbox melee tie
// melee.ts.
// - `onLeaveHex(...)` before units leave `from` (Mines attack the leavers; leaving Wire ends a Move after the next hex).
// - `onEnterHex(...)` after units entered `to` and paid for it (Mines attack them; Wire stops a Move; Trench-to-Trench
//   movement cannot be Op Fired: `noOpFire`).
// Units may be broken or eliminated by these; the caller re-reads the state afterwards (a unit broken while leaving a
// Mines hex still arrives in the hex it was entering, §F103).
import { roll } from './deck';
import type { Gen } from './decisions';
import { defendHex } from './fire';
import { label } from './hex';
import { leaveFixedWeapons } from './scenarioRules';
import { isUnit } from './state';
import { isTrenchMove } from './terrain';
import { type AttackInfo, type FlowCtx, type GameState, type HexId, type PieceId, other } from './types';

export type HowMoved = 'move' | 'advance' | 'retreat';

/**
 * The FP of every Mines hex (§F103): 6, or the 7 / 8 a scenario gives a side's Minefields. A game has one Minefield
 * strength (all Minefields share it, RS), so this is the larger of the two players' values (project ruling).
 */
export function mineStrength(s: GameState): number {
  return Math.max(s.players.axis.minefield, s.players.allied.minefield);
}

/**
 * A Mine Attack (§F103) on `units` in `hex` (units of one side that enter or leave it together: one roll; units already
 * there are not attacked). The movers' opponent makes the Attack Roll (Jammed! has no effect: Mines are no Weapon), each
 * unit its Defense roll with Cover 0; a tie breaks units activated to Move and Suppresses Advancing or Retreating ones
 * (R-23: fire.ts `defend`). Also the attack of a Hidden Mines play (§A35.2).
 */
export function* mineAttack(s: GameState, ctx: FlowCtx, units: PieceId[], hex: HexId): Gen {
  const ids = units.filter((id) => {
    const p = s.pieces[id];
    return p?.where === 'map' && p.hex === hex && isUnit(p);
  });
  if (!ids.length) return;
  const side = other(s.pieces[ids[0]].side);
  const fp = mineStrength(s);
  const attack: AttackInfo = {
    side, mode: 'mine', pieces: [], targets: [hex], ordnance: false, mortarOrArtillery: false, ignoresCover: true,
    fp, bonus: 0, total: null, reduction: 0, played: [],
  };
  ctx.emit({ kind: 'log', text: `The Mines in ${label(hex)} attack (${fp} FP).`, side });
  const r = yield* roll(s, ctx, side, 'mine');
  attack.total = fp + r.sum;
  ctx.emit({ kind: 'fireAttack', side, pieces: [], target: hex, fp, total: attack.total });
  yield* defendHex(s, ctx, attack, hex, ids);
}

/** Before `units` leave `from` for `to`. `stop`: they may enter `to` but must end their move there. */
export function* onLeaveHex(s: GameState, ctx: FlowCtx, units: PieceId[], from: HexId, _to: HexId, how: HowMoved): Gen<{ stop: boolean }> {
  yield* leaveFixedWeapons(s, ctx, units);
  const fort = s.fort[from];
  if (fort === 'mines') yield* mineAttack(s, ctx, units, from);
  // §F106.2: a Moving unit loses its remaining MP right after leaving a Wire hex (Advance and Retreat ignore it)
  return { stop: how === 'move' && fort === 'wire' };
}

/** After `units` entered `to` from `from`. `stop`: their move ends here; `noOpFire`: no Op Fire at this entry. */
export function* onEnterHex(
  s: GameState, ctx: FlowCtx, units: PieceId[], from: HexId, to: HexId, how: HowMoved,
): Gen<{ stop: boolean; noOpFire: boolean }> {
  const fort = s.fort[to];
  if (fort === 'mines') yield* mineAttack(s, ctx, units, to);
  return {
    // §F106.2: a Moving unit loses its remaining MP right after entering a Wire hex
    stop: how === 'move' && s.fort[to] === 'wire',
    // §F105.2: Trench-connected movement cannot be Op Fired in the hex entered
    noOpFire: how === 'move' && isTrenchMove(s.fort[from] ?? null, s.fort[to] ?? null),
  };
}
