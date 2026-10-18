// Melee (§O16.4): fought in a hex that holds units of both sides, at the end of the Order or trigger that mixed them
// (flow.ts `resolveMelees` calls `resolveMelee` once per such hex, in the order the active player picks; inside an
// Event the ctx is at a deeper trigger level, so its rolls never trigger, R-04).
//
// In order: the Ambush window (inactive player first, then the active one, §A25); if a side has no unit left the melee
// is over. Melee FP per side, fixed from then on (R-24): the current FP of its units (Weapons excluded) + 1 per unit
// showing boxed FP. The inactive player rolls, then the active one (staggered: each roll's re-roll and trigger are
// settled before the next); a trigger that leaves a side without units in the hex ends the melee with no result (R-05).
// The lower total loses all its participating units; a tie eliminates both sides, except that the side that last solely
// occupied a Bunker or Pillbox hex survives it (§F101, §F104). The eliminations are judged together (both sides may
// surrender at once). Then the No Quarter window (§A38).
import { eliminateAll } from './casualties';
import { roll } from './deck';
import type { Gen } from './decisions';
import { label } from './hex';
import { window } from './reactions';
import { meleeBonus } from './scenarioRules';
import { currentStats } from './stats';
import { isUnit, typeOf } from './state';
import { type FlowCtx, type GameState, type HexId, type PieceId, type Side, SIDES, other } from './types';

/** What melee.ts carries in the flow ctx (FlowCtx is spread into every deeper ctx, so these travel with it). */
export interface MeleeCtx extends FlowCtx {
  /** Hexes whose melee is being fought further up (a trigger during its rolls must not start it again). */
  meleeHexes?: HexId[];
  /** Per hex: the side that solely occupied it before the other side's units came in (Bunker / Pillbox ties). */
  meleeHolders?: Record<number, Side>;
}

/**
 * A ctx that tells the melees fought under it which side solely occupied each hex before the other side came in, for
 * the Bunker / Pillbox tie (§F101). The flows that mix hexes give it: Advance always; Events and reinforcements that
 * place units in an enemy-held Bunker / Pillbox hex should (without it a tie there eliminates both sides).
 */
export function withHolders(ctx: FlowCtx, holders: Record<number, Side>): FlowCtx {
  const m = ctx as MeleeCtx;
  const out: MeleeCtx = { ...ctx, meleeHolders: { ...(m.meleeHolders ?? {}), ...holders } };
  return out;
}

/**
 * The Melee FP of `ids` (§O16.4.1): each unit's current FP (Leader Command, Veteran, Suppressed, Wire, broken side; no
 * Weapons; a unit never counts below 0, project ruling) + 1 if its current side shows boxed FP.
 */
export function meleeFp(s: GameState, ids: PieceId[]): number {
  let n = 0;
  for (const id of ids) {
    const p = s.pieces[id];
    const t = typeOf(p);
    n += Math.max(0, currentStats(s, id).fp) + ((p.broken ? t.broken : t.front).boxed.fp ? 1 : 0);
  }
  return n;
}

/** `side`'s units in `hex`. */
function unitsHere(s: GameState, hex: HexId, side: Side): PieceId[] {
  const out: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.hex === hex && p.side === side && isUnit(p)) out.push(id);
  }
  return out;
}

/** Those of `ids` still in `hex`. */
const stillIn = (s: GameState, ids: PieceId[], hex: HexId) => ids.filter((id) => s.pieces[id]?.where === 'map' && s.pieces[id].hex === hex);

/** The melee in `hex`, if it holds units of both sides (see the head of this file). */
export function* resolveMelee(s: GameState, ctx: FlowCtx, hex: HexId): Gen {
  const m = ctx as MeleeCtx;
  if (m.meleeHexes?.includes(hex)) return;
  if (!unitsHere(s, hex, 'axis').length || !unitsHere(s, hex, 'allied').length) return;
  const c: MeleeCtx = { ...ctx, meleeHexes: [...(m.meleeHexes ?? []), hex] };
  const holder = m.meleeHolders?.[hex] ?? null;
  const where = label(hex);
  ctx.emit({ kind: 'log', text: `Melee in ${where}.` });
  yield* window(s, c, 'beforeMelee', { hex, units: [...unitsHere(s, hex, 'axis'), ...unitsHere(s, hex, 'allied')] });
  const parts: Record<Side, PieceId[]> = { axis: unitsHere(s, hex, 'axis'), allied: unitsHere(s, hex, 'allied') };
  if (!parts.axis.length || !parts.allied.length) {
    ctx.emit({ kind: 'log', text: `The melee in ${where} is over: one side has no units left.` });
    return;
  }
  const fp: Record<Side, number> = { axis: meleeFp(s, parts.axis), allied: meleeFp(s, parts.allied) };
  const totals: Record<Side, number> = { ...fp };
  // a participant replaced during the rolls (Light Wounds after a trigger's break, a Deploy Event) is still in the
  // melee as its replacement(s) (§E52, §A36)
  const rolling: MeleeCtx = {
    ...c,
    emit: (e) => {
      if (e.kind === 'replace') {
        for (const side of SIDES) {
          const i = parts[side].indexOf(e.piece);
          if (i >= 0) parts[side].splice(i, 1, ...e.by);
        }
      }
      c.emit(e);
    },
  };
  for (const side of [other(s.active), s.active]) {
    const r = yield* roll(s, rolling, side, 'melee');
    totals[side] = fp[side] + r.sum + meleeBonus(s, side);
    if (!stillIn(s, parts.axis, hex).length || !stillIn(s, parts.allied, hex).length) {
      ctx.emit({ kind: 'log', text: `The melee in ${where} is over: one side has no units left (R-05).` });
      return;
    }
  }
  let losers: Side[];
  if (totals.axis !== totals.allied) losers = [totals.axis < totals.allied ? 'axis' : 'allied'];
  else {
    const fort = s.fort[hex];
    losers = (fort === 'bunker' || fort === 'pillbox') && holder ? [other(holder)] : ['axis', 'allied'];
  }
  ctx.emit({ kind: 'melee', hex, totals, losers: losers.slice() });
  const dead = losers.flatMap((side) => stillIn(s, parts[side], hex));
  yield* eliminateAll(s, c, dead, 'melee');
  yield* window(s, c, 'afterMelee', { hex, units: [...parts.axis, ...parts.allied] });
}
