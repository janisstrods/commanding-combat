// The Advance Order (§O16): activation as for any Order (§O14.1); then each activated unit, one at a time in the order
// the player picks, may enter one adjacent hex and stops there, or exit off the enemy edge (§7.2.1). MP and terrain
// costs do not matter; enemy hexes may be entered (a melee follows at the end of the Order); a unit without a Weapon may
// cross a Cliff; Water Barrier and Blaze are impassable; a Major Bridge is entered and left only along its road or
// railway. No Op Fire (§A33): Mines attack the unit leaving and entering (forts.ts), and after each entry the window
// 'afterAdvanceEntry' opens (Hidden Mines / Wire, §A35.2, §A35.5). At least one unit must advance (§O14.4).
import { activationCandidates, markActivated } from '../activation';
import { exitUnits } from '../casualties';
import { ask, type Gen } from '../decisions';
import { resolveMelees } from '../flow';
import { onEnterHex, onLeaveHex } from '../forts';
import { neighbours } from '../hex';
import { withHolders } from '../melee';
import { updateControl } from '../objectives';
import type { Rand } from '../random';
import { window } from '../reactions';
import type { OrderHandler } from '../registry';
import { hasUnitOf, isUnit } from '../state';
import { enterBlock, pathBetween } from '../terrain';
import { type Answer, type Decision, type FlowCtx, type GameState, type HexId, type PieceId, type Side, other } from '../types';
import { exitHexes } from './move';

type AdvanceD = Extract<Decision, { kind: 'advance' }>;

const onMap = (s: GameState, id: PieceId) => s.pieces[id]?.where === 'map' && isUnit(s.pieces[id]);

/** Why unit `id` cannot Advance from its hex into `to`, or null when it can. */
export function advanceBlock(s: GameState, id: PieceId, to: HexId): string | null {
  const p = s.pieces[id];
  const from = p.hex;
  if (!Number.isInteger(to)) return 'Advance into an adjacent hex.';
  const b = enterBlock(s.map, from, to, s);
  if (!b) return null;
  switch (b) {
    case 'notAdjacent':
      return 'Advance into an adjacent hex.';
    case 'water':
    case 'blaze':
      return 'That hex is impassable.';
    case 'bridge':
      return 'A Major Bridge is entered and left only along its road or railway.';
    case 'cliff': {
      if (p.weapon) return 'A unit carrying a Weapon cannot Advance across a Cliff.';
      // enterBlock reports the Cliff before a Major Bridge side: check that one too
      const path = pathBetween(s.map, from, to);
      const bridge = s.map.terrain[to] === 'MajorBridge' || s.map.terrain[from] === 'MajorBridge';
      return bridge && path !== 'Road' && path !== 'Railway' ? 'A Major Bridge is entered and left only along its road or railway.' : null;
    }
    default:
      return 'That hex cannot be entered.';
  }
}

/** Can unit `id` Advance somewhere now (an adjacent hex, or off the enemy edge)? */
export function canAdvance(s: GameState, id: PieceId): boolean {
  if (!onMap(s, id)) return false;
  const p = s.pieces[id];
  if (exitHexes(s, p.side).includes(p.hex)) return true;
  return neighbours(p.hex).some((to) => !advanceBlock(s, id, to));
}

export const advanceOrder: OrderHandler = {
  canGive: (s, side) => activationCandidates(s, side, 'Advance').length > 0,
  activationError: (s, _side, units) => (units.some((id) => canAdvance(s, id)) ? null : 'None of them can Advance into a hex.'),
  *run(s, ctx, side, card) {
    const units = activationCandidates(s, side, 'Advance');
    if (!units.length) return;
    const a = yield* ask(s, ctx, { kind: 'activate', side, order: 'Advance', card: card.id, units });
    const ids = (a as Extract<Answer, { kind: 'activate' }>).units;
    markActivated(s, ctx, side, ids, 'Advance');
    const holders: Record<number, Side> = {};
    let left = ids.slice();
    let advanced = false;
    for (;;) {
      left = left.filter((id) => canAdvance(s, id));
      if (!left.length) break;
      const d: AdvanceD = { kind: 'advance', side, units: left.slice() };
      if (!advanced) d.mustAdvance = true;
      const ans = yield* ask(s, ctx, d);
      if (ans.kind === 'advanceTo') {
        advanced = true;
        left = left.filter((id) => id !== ans.unit);
        yield* advanceUnit(s, ctx, side, ans.unit, ans.to, holders);
      } else if (ans.kind === 'exit') {
        advanced = true;
        left = left.filter((id) => !ans.units.includes(id));
        yield* exitUnits(s, ctx, ans.units);
      } else break;
    }
    // the melees of this Order, told who held each hex the Advance mixed (Bunker / Pillbox ties)
    yield* resolveMelees(s, withHolders(ctx, holders));
  },
};

/** One unit's Advance into `to` (see the head of this file). `holders` records who held each enemy hex entered. */
function* advanceUnit(s: GameState, ctx: FlowCtx, side: Side, id: PieceId, to: HexId, holders: Record<number, Side>): Gen {
  const p = s.pieces[id];
  const from = p.hex;
  yield* onLeaveHex(s, ctx, [id], from, to, 'advance');
  if (!onMap(s, id) || p.hex !== from) return;
  if (s.blaze[to]) return; // a trigger while leaving (a Mine Attack's Event) set `to` ablaze: the unit stays
  if (holders[to] === undefined && hasUnitOf(s, to, other(side)) && !hasUnitOf(s, to, side)) holders[to] = other(side);
  p.hex = to;
  ctx.emit({ kind: 'move', units: [id], from, to, mp: 0 });
  updateControl(s, ctx, to, side);
  updateControl(s, ctx, from); // leaving a building Objective can leave the enemy alone in it
  yield* onEnterHex(s, ctx, [id], from, to, 'advance');
  if (onMap(s, id) && p.hex === to) yield* window(s, ctx, 'afterAdvanceEntry', { hex: to, units: [id], mover: side });
}

/** The check of an answer to an 'advance' decision (registry.ts DECISION_CHECKS). */
export function advanceAnswerError(s: GameState, d: Decision, a: Answer): string | null {
  if (d.kind !== 'advance') return 'Not an Advance decision.';
  switch (a.kind) {
    case 'done':
      return d.mustAdvance ? 'An Advance Order must advance at least one unit.' : null;
    case 'advanceTo':
      if (!d.units.includes(a.unit)) return 'Advance one of the activated units that has not advanced yet.';
      return advanceBlock(s, a.unit, a.to);
    case 'exit': {
      const ids = a.units;
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return 'Choose the units that exit.';
      if (!ids.every((id) => d.units.includes(id))) return 'Only activated units that have not advanced yet may exit.';
      const hex = s.pieces[ids[0]].hex;
      if (!ids.every((id) => s.pieces[id].hex === hex)) return 'Units exit together only from the same hex.';
      return exitHexes(s, d.side).includes(hex) ? null : 'Units exit only off the enemy edge, from a hex along it.';
    }
    default:
      return 'Advance a unit into an adjacent hex, exit off the enemy edge, or stop.';
  }
}

/** The legal answers to an 'advance' decision (random play, the AI): every unit into every hex it may enter, exits, 'done'. */
export function advanceAnswers(s: GameState, d: AdvanceD): Answer[] {
  const out: Answer[] = [];
  for (const unit of d.units) {
    for (const to of neighbours(s.pieces[unit].hex)) if (!advanceBlock(s, unit, to)) out.push({ kind: 'advanceTo', unit, to });
    const x: Answer = { kind: 'exit', units: [unit] };
    if (!advanceAnswerError(s, d, x)) out.push(x);
  }
  if (!d.mustAdvance) out.push({ kind: 'done' });
  return out;
}

/** A random legal answer to an 'advance' decision (random.ts RANDOM_ANSWERS): mostly advance someone, often into a melee. */
export function randomAdvanceAnswer(s: GameState, d: Decision, rnd: Rand): Answer {
  const all = advanceAnswers(s, d as AdvanceD);
  const go = all.filter((a) => a.kind !== 'done');
  const melee = go.filter((a) => a.kind === 'advanceTo' && hasUnitOf(s, a.to, other(d.side)));
  const pool = melee.length && rnd() < 0.5 ? melee : go.length && rnd() < 0.85 ? go : all;
  return pool[Math.floor(rnd() * pool.length)];
}
