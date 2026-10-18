// The Rout Order (§O23): the active player activates a player (himself or the opponent) who has a broken unit and has
// not been activated by a Recover or Rout this Turn (so at most one Rout per player per Turn, and none on himself after
// his Recover). He then rolls, from his own deck, for each of that player's units that were broken at the announcement:
// roll < current Morale (+ Cover) → nothing; = → Suppressed; > → the unit must Retreat that many hexes (the result is
// locked in before the roll's trigger, §1.9.1 rule 1: a unit its trigger rallies still retreats).
//
// Retreat (§O23.3): the owner moves the unit hex by hex, each hex entered nearer his own edge than the one left. Terrain
// costs, Wire and Op Fire do not apply; Mines attack it leaving and entering (ties Suppress, R-23). A unit in its edge
// row that must go on leaves the map and is eliminated (§7.2.2); one whose only ways on are into an enemy hex, an
// impassable hex, across a Cliff (or a Major Bridge's side) is eliminated (§O23.3.5). Overstacking is fixed at the end
// of the Turn.
import { eliminate, suppress } from '../casualties';
import { roll } from '../deck';
import { ask, choose, type Gen } from '../decisions';
import { onEnterHex, onLeaveHex } from '../forts';
import { colOf, label, neighbours, rowOf } from '../hex';
import { updateControl } from '../objectives';
import type { OrderHandler } from '../registry';
import { currentStats } from '../stats';
import { hasUnitOf, typeOf, unitsOf } from '../state';
import { enterBlock } from '../terrain';
import { type Answer, type Edge, type FlowCtx, type GameState, type HexId, type PieceId, type Side, other } from '../types';
import { activatePlayer, eachInOrder, playerActivated, rollMorale } from './recover';

/** Hexes between `hex` and the edge `edge` (0 along it). */
export function edgeDistance(hex: HexId, edge: Edge): number {
  switch (edge) {
    case 'top':
      return rowOf(hex) - 1;
    case 'bottom':
      return 10 - rowOf(hex);
    case 'left':
      return colOf(hex);
    default:
      return 14 - colOf(hex);
  }
}

/** The players `side` may activate for a Rout now: himself and the opponent, each with a broken unit, not yet activated. */
export function routTargets(s: GameState, side: Side): Side[] {
  return [side, other(side)].filter((t) => !playerActivated(s, t) && unitsOf(s, t).some((p) => p.broken));
}

/** The hexes unit `id` may Retreat into next: adjacent, nearer its own edge, no enemy unit, enterable (§O23.3). */
export function retreatSteps(s: GameState, id: PieceId): HexId[] {
  const p = s.pieces[id];
  const edge = s.players[p.side].edge;
  const d0 = edgeDistance(p.hex, edge);
  return neighbours(p.hex).filter((to) => edgeDistance(to, edge) < d0 && !hasUnitOf(s, to, other(p.side)) && !enterBlock(s.map, p.hex, to, s));
}

const still = (s: GameState, id: PieceId, hex: HexId) => s.pieces[id]?.where === 'map' && s.pieces[id].hex === hex;

/** Unit `id` retreats `hexes` hexes (see the head of this file); its owner picks each step. */
export function* retreat(s: GameState, ctx: FlowCtx, id: PieceId, hexes: number): Gen {
  const p = s.pieces[id];
  const name = typeOf(p).name;
  for (let left = hexes; left > 0; left--) {
    if (p.where !== 'map') return;
    const from = p.hex;
    if (edgeDistance(from, s.players[p.side].edge) === 0) {
      ctx.emit({ kind: 'log', text: `${name} retreats off its own edge and is eliminated.`, side: p.side });
      yield* eliminate(s, ctx, id, 'retreat');
      return;
    }
    const steps = retreatSteps(s, id);
    if (!steps.length) {
      ctx.emit({ kind: 'log', text: `${name} has no way to retreat from ${label(from)} and is eliminated.`, side: p.side });
      yield* eliminate(s, ctx, id, 'retreat');
      return;
    }
    const [i] = yield* choose(s, ctx, p.side, 'retreatStep', steps.map((hex) => ({ hex })), 1, 1, { unit: id, left });
    const to = steps[i];
    yield* onLeaveHex(s, ctx, [id], from, to, 'retreat');
    if (!still(s, id, from)) return;
    p.hex = to;
    ctx.emit({ kind: 'retreat', unit: id, from, to });
    updateControl(s, ctx, to);
    yield* onEnterHex(s, ctx, [id], from, to, 'retreat');
  }
}

/** The Rout roll by `roller` for broken unit `id` (§O23.2). */
export function* routRoll(s: GameState, ctx: FlowCtx, roller: Side, id: PieceId): Gen {
  const p = s.pieces[id];
  const morale = rollMorale(s, id);
  const r = yield* roll(s, ctx, roller, 'rout');
  if (p.where !== 'map') return;
  if (r.sum < morale) ctx.emit({ kind: 'log', text: `${typeOf(p).name} holds (${r.sum} against Morale ${morale}).`, side: p.side });
  else if (r.sum === morale) suppress(s, ctx, id);
  else yield* retreat(s, ctx, id, r.sum - morale);
}

export const routOrder: OrderHandler = {
  canGive: (s, side) => routTargets(s, side).length > 0,
  *run(s, ctx, side, card) {
    const players = routTargets(s, side);
    if (!players.length) return;
    let target = players[0];
    if (players.length > 1) {
      const a = yield* ask(s, ctx, { kind: 'activate', side, order: 'Rout', card: card.id, units: [], players });
      target = (a as Extract<Answer, { kind: 'activatePlayer' }>).player;
    }
    activatePlayer(s, ctx, side, target, 'Rout');
    const broken = unitsOf(s, target).filter((p) => p.broken).map((p) => p.id);
    // the roller picks the order while a Leader's Command could count for another routing unit in its hex
    const command = (l: PieceId) => currentStats(s, l).command;
    yield* eachInOrder(s, ctx, side, 'routOrder', broken, command, (id) => routRoll(s, ctx, side, id));
  },
};
