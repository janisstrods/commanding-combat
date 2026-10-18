// Helpers for the scenario special-rule tests: a real scenario's game set up by the engine (passive answers: the engine
// deploys, choices take their first items) and stopped at the first Turn, and small queries on the result.
import { scenario } from '../../../src/engine/data';
import { gameFlow } from '../../../src/engine/flow';
import { areAdjacent } from '../../../src/engine/hex';
import { isUnit, newGame } from '../../../src/engine/state';
import type { GameState, HexId, Piece, Side, SpecialRules } from '../../../src/engine/types';
import { passive, run, type Responder, type RunResult } from '../../support/build';

/** Scenario `id`'s special rules (the data the engine reads). */
export const special = (id: string): SpecialRules => scenario(id).special;

/**
 * A new game of scenario `id` played through its set-up with `respond` (default: passive), stopped at the first
 * decision `respond` leaves unanswered (the first Turn with passive answers).
 */
export function setUp(id: string, seed = 1, respond: Responder = passive): { s: GameState; r: RunResult<void> } {
  const s = newGame(scenario(id), seed);
  const r = run(s, (ctx) => gameFlow(s, ctx), respond);
  return { s, r };
}

/** `side`'s units on the map. */
export const mapUnits = (s: GameState, side: Side): Piece[] =>
  Object.values(s.pieces).filter((p) => p.side === side && p.where === 'map' && isUnit(p));

/** The pieces of counter type `type` (full id). */
export const ofType = (s: GameState, type: string): Piece[] => Object.values(s.pieces).filter((p) => p.type === type);

/** Do `hexes` form one connected group (each linked to the rest through adjacent hexes)? */
export function connected(hexes: HexId[]): boolean {
  const list = [...new Set(hexes)];
  if (list.length <= 1) return true;
  const seen = new Set([list[0]]);
  const todo = [list[0]];
  while (todo.length) {
    const h = todo.pop()!;
    for (const x of list) {
      if (!seen.has(x) && areAdjacent(h, x)) {
        seen.add(x);
        todo.push(x);
      }
    }
  }
  return seen.size === list.length;
}
