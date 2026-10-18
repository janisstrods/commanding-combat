// The game loop (§5): set-up, then Turns until the game ends. A Turn is Orders (one at a time, each finished before the
// next, §O14.2) or a pass (§O15); then the end of the Turn: overstacking for both players (§8.2, R-41), the active
// player's hand refill (§5.4). Melees are fought at the end of every Order and trigger (§O16.4).
//
// The game ends by a GameOver thrown anywhere below; `gameFlow` catches it, records the winner and finishes. Flows that
// run part of a game on their own (the AI's simulations) wrap themselves in `guard` for the same effect.
import { eliminate, simultaneously } from './casualties';
import { deployWithSplit } from './events/deploy';
import { refill } from './deck';
import { ask, choose, type Gen } from './decisions';
import { resolveMelee } from './melee';
import { teamsLeft } from './mix';
import { window } from './reactions';
import { ORDERS } from './registry';
import { checkFixedWeapons } from './scenarioRules';
import { setupFlow } from './setup';
import { figures, stackLimit } from './stats';
import { cardOf, endGame, isGameOver, isUnit, mixedHexes, newTurn, typeOf } from './state';
import { type CardId, type FlowCtx, type GameState, type HexId, type OrderName, type Piece, type Side, other } from './types';

/** The whole game from its current phase ('setup' or 'play') to its end. */
export function* gameFlow(s: GameState, ctx: FlowCtx): Gen {
  yield* guard(s, ctx, (function* () {
    if (s.phase === 'setup') yield* setupFlow(s, ctx);
    while (s.phase === 'play') {
      yield* turnFlow(s, ctx);
      nextTurn(s);
    }
  })());
}

/** Run `g`; if the game ends inside it, record the result (phase 'over') and return normally. */
export function* guard(s: GameState, ctx: FlowCtx, g: Gen): Gen {
  try {
    yield* g;
  } catch (e) {
    if (!isGameOver(e)) throw e;
    endGame(s, ctx, e);
  }
}

/** Hand the Turn to the other player. */
export function nextTurn(s: GameState): void {
  s.active = other(s.active);
  s.turn = newTurn(s.turn.number + 1);
}

/** The cards in `side`'s hand that can give an Order now, with the Order. */
export function orderOptions(s: GameState, side: Side): { card: CardId; order: OrderName }[] {
  const out: { card: CardId; order: OrderName }[] = [];
  const can: Partial<Record<OrderName, boolean>> = {};
  for (const c of s.players[side].hand) {
    const order = cardOf(c).order;
    if (can[order] === undefined) can[order] = ORDERS[order].canGive(s, side);
    if (can[order]) out.push({ card: c, order });
  }
  return out;
}

/**
 * The active player's Turn, from wherever it stands (it can resume between Orders): Orders until he ends or reaches
 * his Order Capability, or a pass; then the end of the Turn.
 */
export function* turnFlow(s: GameState, ctx: FlowCtx): Gen {
  const side = s.active;
  const t = s.turn;
  const pl = s.players[side];
  if (t.ordersGiven === 0 && t.passDiscards === null) ctx.emit({ kind: 'turnStart', side, number: t.number });
  while (t.passDiscards === null) {
    const orders = t.ordersGiven < pl.orders ? orderOptions(s, side) : [];
    const canPass = t.ordersGiven === 0;
    if (!canPass && !orders.length) {
      const why = t.ordersGiven >= pl.orders ? `All ${pl.orders} Orders given` : 'No other Order possible';
      ctx.emit({ kind: 'log', text: `${why}: the Turn ends.`, side });
      break;
    }
    const maxDiscard = canPass ? Math.min(pl.discard, pl.hand.length) : 0;
    if (canPass && !orders.length && maxDiscard === 0) {
      ctx.emit({ kind: 'log', text: 'No Order possible and no card to discard: the Turn passes.', side });
      yield* pass(s, ctx, side, []);
      break;
    }
    const a = yield* ask(s, ctx, { kind: 'turn', side, orders, canPass, maxDiscard });
    if (a.kind === 'pass') {
      yield* pass(s, ctx, side, a.discard);
      break;
    }
    if (a.kind === 'endTurn') break;
    if (a.kind === 'order') yield* giveOrder(s, ctx, side, a.card, a.order);
  }
  yield* endOfTurn(s, ctx);
}

/** Pass (§O15): discard the chosen cards; the opponent may answer a pass that threw away cards (Demolitions ...). */
function* pass(s: GameState, ctx: FlowCtx, side: Side, cards: CardId[]): Gen {
  const p = s.players[side];
  for (const c of cards) {
    p.hand.splice(p.hand.indexOf(c), 1);
    p.discards.push(c);
  }
  if (cards.length) ctx.emit({ kind: 'discard', side, cards: cards.slice() });
  s.turn.passDiscards = cards.length;
  yield* window(s, ctx, 'opponentPassed', { discards: cards.length });
}

/** Give an Order (§O14.1): the card goes to the discard pile, the Order is carried out, then any melee it caused. */
export function* giveOrder(s: GameState, ctx: FlowCtx, side: Side, card: CardId, order: OrderName): Gen {
  const p = s.players[side];
  p.hand.splice(p.hand.indexOf(card), 1);
  p.discards.push(card);
  s.turn.ordersGiven++;
  ctx.emit({ kind: 'cardPlayed', side, card, as: 'order', name: order });
  yield* ORDERS[order].run(s, ctx, side, cardOf(card));
  yield* checkFixedWeapons(s, ctx);
  const t = s.turn;
  t.fired = [];
  t.move = null;
  t.moving = [];
  t.opFire = [];
  yield* resolveMelees(s, ctx);
}

/**
 * Fight every melee due (§O16.4): each hex holding units of both sides, once, in the order the active player picks.
 * Inside an Event pass the Event's (deeper) ctx: the melee is fought inside it, with no triggers (R-04).
 */
export function* resolveMelees(s: GameState, ctx: FlowCtx): Gen {
  const fought = new Set<HexId>();
  for (;;) {
    const hexes = mixedHexes(s).filter((h) => !fought.has(h));
    if (!hexes.length) return;
    let hex = hexes[0];
    if (hexes.length > 1) {
      const [i] = yield* choose(s, ctx, s.active, 'meleeOrder', hexes.map((h) => ({ hex: h })), 1, 1);
      hex = hexes[i];
    }
    fought.add(hex);
    yield* resolveMelee(s, ctx, hex);
  }
}

/** The end of the Turn (§J.3): overstacking for both players, then the active player's refill. */
export function* endOfTurn(s: GameState, ctx: FlowCtx): Gen {
  yield* checkFixedWeapons(s, ctx);
  yield* overstack(s, ctx);
  yield* refill(s, ctx, s.active);
}

/**
 * Overstacking (§8.2, R-48): in every hex where a player has more figures than the limit he may first Deploy one Squad
 * there for free (if the counter mix has two Teams for it, R-56), then eliminates units of his choice until the hex is
 * legal. The inactive player first. These are real eliminations (VP, Casualty Track, Surrender), judged together (both
 * may surrender at once).
 */
function* overstack(s: GameState, ctx: FlowCtx): Gen {
  yield* simultaneously(s, ctx, function* (c) {
    for (const side of [other(s.active), s.active]) {
      const hexes = new Set<HexId>();
      for (const id in s.pieces) {
        const p = s.pieces[id];
        if (p.side === side && p.where === 'map' && isUnit(p)) hexes.add(p.hex);
      }
      for (const hex of [...hexes].sort((a, b) => a - b)) {
        if (figures(s, hex, side) <= stackLimit(s, hex)) continue;
        const squads = here(s, hex, side).filter((p) => typeOf(p).kind === 'squad');
        if (squads.length && teamsLeft(s, side) >= 2) {
          const pick = yield* choose(s, c, side, 'overstackDeploy', squads.map((p) => ({ piece: p.id })), 0, 1, { hex });
          if (pick.length) yield* deployWithSplit(s, c, side, squads[pick[0]].id);
        }
        while (figures(s, hex, side) > stackLimit(s, hex)) {
          const units = here(s, hex, side);
          const [i] = yield* choose(s, c, side, 'overstackEliminate', units.map((p) => ({ piece: p.id })), 1, 1, { hex });
          yield* eliminate(s, c, units[i].id, 'overstack');
        }
      }
    }
  });
}

function here(s: GameState, hex: HexId, side: Side): Piece[] {
  const out: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && p.where === 'map' && p.hex === hex && isUnit(p)) out.push(p);
  }
  return out;
}

