// Activating units for an Order or for Op Fire (§O14.1, §3.3.1.1): one friendly unit not yet activated this Turn (a
// Hero any number of times); a Leader may take along any not-yet-activated friendly non-Leader units in its Command
// radius. Each Order adds its own requirement (Fire: an enemy in LOS and Range, Move: a hex to enter).
import { canShootSomething } from './fire';
import { distance } from './hex';
import { ORDERS } from './registry';
import { currentStats } from './stats';
import { isLeader, isUnit, typeOf } from './state';
import type { Decision, FlowCtx, GameState, OrderName, Piece, PieceId, Side } from './types';

/** May unit `p` still be activated this Turn (Heroes always)? */
export function activatable(s: GameState, p: Piece): boolean {
  return p.where === 'map' && isUnit(p) && (!!typeOf(p).hero || !s.turn.activated.includes(p.id));
}

/** The friendly non-Leader units a Leader may activate with it: within its current Command, not yet activated. */
export function commandRadius(s: GameState, leader: Piece): PieceId[] {
  const r = currentStats(s, leader.id).command;
  const out: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.id === leader.id || p.side !== leader.side || p.where !== 'map' || !isUnit(p) || isLeader(p)) continue;
    if (activatable(s, p) && distance(p.hex, leader.hex) <= r) out.push(p.id);
  }
  return out;
}

/** Why `units` is not a well-formed activation for `side` (first unit, then its Leader's radius), or null. */
export function activationShapeError(s: GameState, side: Side, units: PieceId[]): string | null {
  if (!Array.isArray(units) || !units.length) return 'Activate at least one unit.';
  if (new Set(units).size !== units.length) return 'Each unit once.';
  const first = s.pieces[units[0]];
  if (!first || first.side !== side || !activatable(s, first)) return 'Activate one of your units that has not been activated this Turn.';
  if (units.length === 1) return null;
  if (!isLeader(first)) return 'Only a Leader activates other units with it.';
  const radius = new Set(commandRadius(s, first));
  return units.slice(1).every((id) => radius.has(id)) ? null : "The others must be non-Leader units within the Leader's Command radius.";
}

/** The requirement of the Order (or Op Fire) on its activated units, or null when there is none. */
export function orderNeedError(s: GameState, side: Side, order: OrderName | 'Op Fire', units: PieceId[]): string | null {
  if (order === 'Op Fire') return canShootSomething(s, units, true) ? null : 'None of them has an enemy unit in LOS and Range.';
  return ORDERS[order].activationError?.(s, side, units) ?? null;
}

/** The check of an 'activate' answer. */
export function activationError(s: GameState, d: Extract<Decision, { kind: 'activate' }>, units: PieceId[]): string | null {
  if (!Array.isArray(units) || !d.units.includes(units[0])) return 'Activate one of the units offered first.';
  return activationShapeError(s, d.side, units) ?? orderNeedError(s, d.side, d.order, units);
}

/**
 * The units that may be activated first for `order`: those for which activating it with its whole radius (if a
 * Leader) meets the Order's requirement.
 */
export function activationCandidates(s: GameState, side: Side, order: OrderName | 'Op Fire'): PieceId[] {
  const out: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side !== side || !activatable(s, p)) continue;
    const group = isLeader(p) ? [p.id, ...commandRadius(s, p)] : [p.id];
    if (!orderNeedError(s, side, order, group)) out.push(p.id);
  }
  return out;
}

/** Record the activation (Heroes are never marked: they may be activated again) and announce it. */
export function markActivated(s: GameState, ctx: FlowCtx, side: Side, units: PieceId[], order: OrderName | 'Op Fire'): void {
  for (const id of units) if (!typeOf(s.pieces[id]).hero && !s.turn.activated.includes(id)) s.turn.activated.push(id);
  ctx.emit({ kind: 'activate', side, units: units.slice(), order });
}
