// Decisions: the flow is a generator (`Gen`) that yields a Decision and receives an Answer. `ask` yields one until a
// legal answer comes back; `answerError` is the one validator of every answer (the AI's "is it legal" too), so every
// check of an answer lives here or in a function it calls.
import { activationError } from './activation';
import { fireAnswerError } from './fire';
import { moveAnswerError } from './orders/move';
import { ACTIONS, DECISION_CHECKS } from './registry';
import { figures, stackLimit, unitFigures } from './stats';
import { isUnit, isWeapon } from './state';
import type { Answer, ChoiceItem, ChoiceReason, Decision, FlowCtx, GameState, Side } from './types';

export type Gen<T = void> = Generator<Decision, T, Answer>;

/** Yield decision `d` until a legal answer comes back (`answerError`); each refusal is reported to `ctx.invalid`. */
export function* ask(s: GameState, ctx: FlowCtx, d: Decision): Gen<Answer> {
  for (;;) {
    const a = yield d;
    const err = answerError(s, d, a);
    if (!err) return a;
    ctx.invalid(err);
  }
}

/**
 * A `choose` decision, asked only when there is a real choice: with no items, or when the bounds force the answer
 * (all items, or none), it returns at once. Returns the chosen indices (in the order chosen).
 */
export function* choose(
  s: GameState, ctx: FlowCtx, side: Side, reason: ChoiceReason, items: ChoiceItem[], min: number, max: number, context?: unknown,
): Gen<number[]> {
  const hi = Math.min(max, items.length);
  const lo = Math.min(min, hi);
  if (hi === 0) return [];
  if (lo === items.length) return items.map((_, i) => i);
  const d: Decision = { kind: 'choose', side, reason, items, min: lo, max: hi };
  if (context !== undefined) d.context = context;
  const a = yield* ask(s, ctx, d);
  return (a as Extract<Answer, { kind: 'choose' }>).items;
}

const distinct = (xs: unknown[]) => new Set(xs).size === xs.length;
const isIndex = (i: unknown, n: number) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < n;

/**
 * Why answer `a` to decision `d` is refused in state `s` (the message the UI shows), or null when it is legal. It reads
 * only the decision and the state, so an answer can be checked before it is given.
 */
export function answerError(s: GameState, d: Decision, a: Answer | null | undefined): string | null {
  if (!a) return 'No answer.';
  switch (d.kind) {
    case 'turn': {
      const hand = s.players[d.side].hand;
      if (a.kind === 'order') {
        return d.orders.some((o) => o.card === a.card && o.order === a.order) ? null : 'That card cannot give that Order now.';
      }
      if (a.kind === 'pass') {
        if (!d.canPass) return 'You have given an Order: you can only give another or end the Turn.';
        if (!Array.isArray(a.discard) || !distinct(a.discard)) return 'Choose the cards to discard.';
        if (a.discard.length > d.maxDiscard) return `Discard at most ${d.maxDiscard} cards.`;
        return a.discard.every((c) => hand.includes(c)) ? null : 'Discard cards from your hand.';
      }
      if (a.kind === 'endTurn') return d.canPass ? 'Give an Order or pass.' : null;
      return 'Give an Order, pass or end the Turn.';
    }
    case 'activate':
      if (a.kind === 'activatePlayer') return d.players?.includes(a.player) ? null : 'That player cannot be activated.';
      if (a.kind !== 'activate') return 'Choose the units to activate.';
      return activationError(s, d, a.units);
    case 'fire':
      return fireAnswerError(s, d, a);
    case 'move':
      return moveAnswerError(s, d, a);
    case 'react': {
      if (a.kind === 'done') return null;
      if (a.kind !== 'play' || !isIndex(a.option, d.options.length)) return 'Play one of the Actions offered, or pass.';
      const opt = d.options[a.option];
      const h = ACTIONS[opt.action];
      if (h?.check) return h.check(s, d.side, opt, a, d.info);
      return targetsError(opt.targets, a.targets);
    }
    case 'reroll':
      return a.kind === 'reroll' && typeof a.yes === 'boolean' ? null : 'Re-roll or not?';
    case 'choose': {
      if (a.kind !== 'choose' || !Array.isArray(a.items)) return 'Choose.';
      if (!a.items.every((i) => isIndex(i, d.items.length)) || !distinct(a.items)) return 'Choose among the items offered.';
      if (a.items.length < d.min || a.items.length > d.max) {
        return d.min === d.max ? `Choose ${d.min}.` : `Choose between ${d.min} and ${d.max}.`;
      }
      return null;
    }
    case 'deploy':
      if (a.kind === 'done') return null;
      if (a.kind !== 'deploy') return 'Place a piece.';
      return deployError(s, d, a);
    default: {
      const check = DECISION_CHECKS[d.kind];
      return check ? check(s, d, a) : `No answer is accepted for '${d.kind}' yet.`;
    }
  }
}

/** The default check of an Action's targets: the answer picks exactly one from each list the option gives. */
export function targetsError(
  want: { pieces?: unknown[]; hexes?: unknown[] } | undefined, got: { pieces?: unknown[]; hexes?: unknown[] } | undefined,
): string | null {
  if (!want) return null;
  for (const k of ['pieces', 'hexes'] as const) {
    const list = want[k];
    if (!list) continue;
    const g = got?.[k];
    if (!g || g.length !== 1 || !list.includes(g[0])) return k === 'pieces' ? 'Choose one of the units offered.' : 'Choose one of the hexes offered.';
  }
  return null;
}

function deployError(s: GameState, d: Extract<Decision, { kind: 'deploy' }>, a: Extract<Answer, { kind: 'deploy' }>): string | null {
  if (!d.pieces.includes(a.piece)) return 'Place one of the pieces offered.';
  if (!d.hexes.includes(a.hex)) return 'Place it in one of the hexes offered.';
  const p = s.pieces[a.piece];
  if (isWeapon(p)) {
    const c = a.carrier ? s.pieces[a.carrier] : null;
    if (a.carrier) {
      if (!c || c.where !== 'map' || c.hex !== a.hex || c.side !== p.side || !isUnit(c) || c.weapon) {
        return 'A Weapon goes to a friendly unit in that hex that has none.';
      }
      return null;
    }
    for (const id in s.pieces) {
      const u = s.pieces[id];
      if (u.where === 'map' && u.hex === a.hex && u.side === p.side && isUnit(u) && !u.weapon) return null;
    }
    return 'A Weapon goes to a friendly unit in that hex that has none.';
  }
  if (!isUnit(p)) return 'That piece cannot be placed on the map.';
  return figures(s, a.hex, p.side) + unitFigures(p) <= stackLimit(s, a.hex) ? null : 'That would overstack the hex.';
}
