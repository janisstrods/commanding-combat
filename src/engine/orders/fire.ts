// The Fire Order (§O20) and the Fire Action, Opportunity Fire (§A33).
import { activationCandidates, markActivated } from '../activation';
import { CARDS } from '../data';
import { ask, type Gen } from '../decisions';
import { canShootSomething, fireAttack, fireOptions, firingPieces } from '../fire';
import type { ActionHandler, OrderHandler } from '../registry';
import type { ActionOption, Answer, FlowCtx, GameState, HexId, PieceId, Side } from '../types';

/**
 * Fire Attacks by the pieces of activated `units` until the player stops or none can fire (each piece once, §O20.3).
 * The first attack is required while one is possible (§O14.4); a cancelled one (FP below 1 after Actions) counts as the
 * try. Fired pieces are kept in `turn.fired`.
 */
export function* fireLoop(s: GameState, ctx: FlowCtx, side: Side, units: PieceId[], mode: 'order' | 'assault'): Gen {
  let tried = false;
  for (;;) {
    const pool = firingPieces(s, units).filter((id) => !s.turn.fired.includes(id));
    if (!fireOptions(s, pool, mode).size) return;
    const a = yield* ask(s, ctx, { kind: 'fire', side, mode, pieces: pool, ...(tried ? {} : { mustFire: true }) });
    if (a.kind !== 'fire') return;
    tried = true;
    if (yield* fireAttack(s, ctx, side, a.spec, mode)) s.turn.fired.push(...a.spec.pieces);
  }
}

export const fireOrder: OrderHandler = {
  canGive: (s, side) => activationCandidates(s, side, 'Fire').length > 0,
  activationError: (s, _side, units) => (canShootSomething(s, units) ? null : 'None of them has an enemy unit in LOS and Range.'),
  *run(s, ctx, side, card) {
    const units = activationCandidates(s, side, 'Fire');
    if (!units.length) return;
    const a = yield* ask(s, ctx, { kind: 'activate', side, order: 'Fire', card: card.id, units });
    const ids = (a as Extract<Answer, { kind: 'activate' }>).units;
    markActivated(s, ctx, side, ids, 'Fire');
    yield* fireLoop(s, ctx, side, ids, 'order');
  },
};

/** The pieces the inactive player has activated for Op Fire this Move Order (Ordnance excluded by fire.ts). */
function opFirePool(s: GameState): PieceId[] {
  return firingPieces(s, s.turn.opFire);
}

function opFireAttackPossible(s: GameState, hex: HexId): boolean {
  return fireOptions(s, opFirePool(s), 'opFire', hex).size > 0;
}

/**
 * Op Fire (§A33), window 'afterHexEntry' during the opponent's Move Order: (a) a Fire card activates a unit (a Leader
 * with its radius) that has an enemy in LOS and Range; (b) the one Fire Attack of this MP expenditure on the hex just
 * entered, by units activated for Op Fire so far this Move Order — offered as the option with `card: ''` (no card).
 */
export const opFireAction: ActionHandler = {
  windows: ['afterHexEntry'],
  options(s, side, _w, info) {
    if (side === s.active || info.mover !== s.active || !s.turn.move || info.hex === undefined) return [];
    const out: ActionOption[] = [];
    if (!info.opFireDone && s.turn.opFire.length && opFireAttackPossible(s, info.hex)) out.push({ card: '', action: 'Fire' });
    const cards = s.players[side].hand.filter((c) => CARDS[c]?.fireIsAction);
    if (cards.length && activationCandidates(s, side, 'Op Fire').length) for (const c of cards) out.push({ card: c, action: 'Fire' });
    return out;
  },
  *run(s, ctx, side, opt, _a, info) {
    if (opt.card) {
      const units = activationCandidates(s, side, 'Op Fire');
      if (!units.length) return;
      const a = yield* ask(s, ctx, { kind: 'activate', side, order: 'Op Fire', card: opt.card, units });
      const ids = (a as Extract<Answer, { kind: 'activate' }>).units;
      markActivated(s, ctx, side, ids, 'Op Fire');
      for (const id of ids) if (!s.turn.opFire.includes(id)) s.turn.opFire.push(id);
      return;
    }
    if (info.hex === undefined || info.opFireDone) return;
    const a = yield* ask(s, ctx, { kind: 'fire', side, mode: 'opFire', pieces: opFirePool(s), target: info.hex });
    if (a.kind !== 'fire') return;
    if (yield* fireAttack(s, ctx, side, a.spec, 'opFire')) info.opFireDone = true;
  },
};
