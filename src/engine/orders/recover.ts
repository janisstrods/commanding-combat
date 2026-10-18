// The Recover Order (§O22): it activates the player himself (not his units: they may still be activated for another
// Order this Turn), once per Turn and never together with a Rout on himself. First every Suppressed marker of his comes
// off; then each of his units that was broken when the Order was announced makes a Rally roll (units broken during the
// Order do not): roll < current Morale (Command, Cover ... included) → it rallies; = → Suppressed (still broken);
// > → nothing. The result is locked in before the roll's trigger is resolved (§1.9.1 rule 1).
import { pendingTargets, rally, suppress, watchReplacements } from '../casualties';
import { roll } from '../deck';
import { choose, type Gen } from '../decisions';
import type { OrderHandler } from '../registry';
import { cover, currentStats } from '../stats';
import { isLeader, typeOf, unitsOf } from '../state';
import type { ChoiceReason, FlowCtx, GameState, PieceId, Side } from '../types';

/** Has `target` been activated this Turn by a Recover or a Rout (§O22, §O23)? */
export function playerActivated(s: GameState, target: Side): boolean {
  return s.turn.playerActivations.some((x) => x.endsWith(`>${target}`));
}

/** Record that `by` activated `target` with a Recover or Rout. */
export function activatePlayer(s: GameState, ctx: FlowCtx, by: Side, target: Side, order: 'Recover' | 'Rout'): void {
  s.turn.playerActivations.push(`${by}>${target}`);
  const whom = by === target ? 'himself' : `the ${target} player`;
  ctx.emit({ kind: 'log', text: `${order}: the ${by} player activates ${whom}.`, side: by });
}

/** A unit's Morale for Rally and Rout rolls: current Morale + the Cover of its hex (§T78.3). */
export function rollMorale(s: GameState, id: PieceId): number {
  return currentStats(s, id).morale + cover(s, id);
}

const onMapBroken = (s: GameState, id: PieceId) => s.pieces[id]?.where === 'map' && s.pieces[id].broken;

/**
 * Roll for `ids` one at a time (`each`), in the order `chooser` picks while the order can change a result: while one of
 * them is a Leader whose Command (`command(leader)`) would count for another of them in its hex. Otherwise in the order
 * given (the unknown cards make any order alike; project ruling against needless prompts). Units that stop being broken
 * or leave the map before their turn are skipped.
 */
export function* eachInOrder(
  s: GameState, ctx: FlowCtx, chooser: Side, reason: ChoiceReason, ids: PieceId[], command: (leader: PieceId) => number,
  each: (id: PieceId) => Gen,
): Gen {
  let left = ids.slice();
  for (;;) {
    left = left.filter((id) => onMapBroken(s, id));
    if (!left.length) return;
    let next = left[0];
    const matters = left.some((l) => isLeader(s.pieces[l]) && command(l) > 0 && left.some((o) => o !== l && s.pieces[o].hex === s.pieces[l].hex));
    if (left.length > 1 && matters) {
      const [i] = yield* choose(s, ctx, chooser, reason, left.map((piece) => ({ piece })), 1, 1);
      next = left[i];
    }
    left = left.filter((id) => id !== next);
    yield* each(next);
  }
}

/**
 * A Rally roll for broken unit `id` by its owner (§O22). The result is fixed at the roll; if the Squad Deploys in the
 * roll's trigger it applies to both Teams (R-53).
 */
export function* rallyRoll(s: GameState, ctx: FlowCtx, id: PieceId): Gen {
  const p = s.pieces[id];
  const morale = rollMorale(s, id);
  const w = watchReplacements(ctx);
  const r = yield* roll(s, w.ctx, p.side, 'rally');
  const targets = pendingTargets(s, id, w.by);
  if (!targets.length) return;
  if (r.sum > morale) {
    ctx.emit({ kind: 'log', text: `${typeOf(p).name} fails to rally (${r.sum} against Morale ${morale}).`, side: p.side });
    return;
  }
  for (const t of targets) {
    if (r.sum < morale) rally(s, ctx, t);
    else suppress(s, ctx, t);
  }
}

export const recoverOrder: OrderHandler = {
  canGive: (s, side) => !playerActivated(s, side) && unitsOf(s, side).some((p) => p.broken || p.suppressed),
  *run(s, ctx, side) {
    if (!recoverOrder.canGive(s, side)) return;
    activatePlayer(s, ctx, side, side, 'Recover');
    const broken = unitsOf(s, side).filter((p) => p.broken).map((p) => p.id);
    const freed = unitsOf(s, side).filter((p) => p.suppressed);
    for (const p of freed) p.suppressed = false;
    if (freed.length) ctx.emit({ kind: 'log', text: `Suppressed markers removed from ${freed.length} unit(s).`, side });
    // a broken Leader rallied first lends its (unbroken) Command to the others in its hex
    const command = (l: PieceId) => typeOf(s.pieces[l]).front.command;
    yield* eachInOrder(s, ctx, side, 'rallyOrder', broken, command, (id) => rallyRoll(s, ctx, id));
  },
};
