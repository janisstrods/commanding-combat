// The Fire Order (§O20), Smoke rounds (§O20.2.1) and the Fire Action, Opportunity Fire (§A33).
import { activationCandidates, markActivated } from '../activation';
import { CARDS } from '../data';
import { roll } from '../deck';
import { ask, type Gen } from '../decisions';
import { canShootSomething, fireAttack, fireOptions, firingPieces, inRange, shooter } from '../fire';
import { ALL_HEXES, distance, label } from '../hex';
import { losCheck } from '../los';
import type { ActionHandler, OrderHandler } from '../registry';
import { typeOf } from '../state';
import type { ActionOption, Answer, FireSpec, FlowCtx, GameState, HexId, PieceId, Side } from '../types';
import { canHoldSmoke, placeRandomSmoke } from './artillery';

/**
 * Fire Attacks by the pieces of activated `units` until the player stops or none can fire (each piece once, §O20.3).
 * The first attack is required while one is possible (§O14.4); a cancelled one (FP below 1 after Actions) counts as the
 * try. Fired pieces are kept in `turn.fired`.
 */
export function* fireLoop(s: GameState, ctx: FlowCtx, side: Side, units: PieceId[], mode: 'order' | 'assault'): Gen {
  let tried = false;
  for (;;) {
    const pool = firingPieces(s, units).filter((id) => !s.turn.fired.includes(id));
    if (!fireOptions(s, pool, mode).size && !hasSmokeShot(s, pool, mode)) return;
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

// ---------------------------------------------------------------------------------------------------------------------
// Smoke rounds (§O20.2.1): a Weapon showing "Smoke" fires alone, with a Fire Order, at any hex in its Range and LOS
// (no enemy unit needed), declared with the target before rolling (FireSpec.smoke). Its Targeting roll (the product,
// less the largest Hindrance on the LOS, above the range) hits or misses; a hit places one random Smoke marker there and
// makes no Fire Attack. fire.ts hands smoke specs to `smokeShotError` and `smokeRound`.

/** Is `id` a Weapon that shows Smoke? */
function smokeWeapon(s: GameState, id: PieceId): boolean {
  const p = s.pieces[id];
  if (!p) return false;
  const t = typeOf(p);
  return t.kind === 'weapon' && !!t.smoke;
}

/** Why `spec` (a Smoke round) is not legal in `mode`, or null. The pool checks are fire.ts `fireSpecError`'s. */
export function smokeShotError(s: GameState, spec: FireSpec, mode: 'order' | 'opFire' | 'assault'): string | null {
  if (mode !== 'order') return 'Smoke rounds are fired only with a Fire Order.';
  if (spec.pieces.length !== 1) return 'A Smoke round is fired by one Weapon alone.';
  const id = spec.pieces[0];
  const name = typeOf(s.pieces[id]).name;
  if (!smokeWeapon(s, id)) return `${name} cannot fire Smoke.`;
  if (!Number.isInteger(spec.target) || spec.target < 0 || spec.target >= s.map.terrain.length) return 'Choose a target hex.';
  const sh = shooter(s, id);
  if (!sh) return `${name} cannot fire now.`;
  if (!inRange(sh, spec.target)) {
    return sh.minRange > 1 && distance(sh.hex, spec.target) < sh.minRange ? `The target is inside the ${name}'s minimum range.` : 'The target is out of range.';
  }
  const l = losCheck(s, sh.hex, spec.target);
  return l.clear ? null : `No line of sight: ${l.blockedBy ?? 'blocked'}.`;
}

/**
 * The Smoke rounds open to `pieces` in `mode`: per Weapon that shows Smoke, every hex in its Range and LOS that can
 * hold Smoke (other hexes in Range and LOS are legal too, but pointless). For the UI, the AI and random play.
 */
export function smokeOptions(s: GameState, pieces: PieceId[], mode: 'order' | 'opFire' | 'assault' = 'order'): FireSpec[] {
  const out: FireSpec[] = [];
  if (mode !== 'order') return out;
  for (const id of pieces) {
    if (!smokeWeapon(s, id)) continue;
    const sh = shooter(s, id);
    if (!sh) continue;
    for (const h of ALL_HEXES) if (canHoldSmoke(s, h) && inRange(sh, h) && losCheck(s, sh.hex, h).clear) out.push({ pieces: [id], target: h, smoke: true });
  }
  return out;
}

/** Can one of `pieces` fire a Smoke round now (as `smokeOptions`, stopping at the first)? */
export function hasSmokeShot(s: GameState, pieces: PieceId[], mode: 'order' | 'opFire' | 'assault' = 'order'): boolean {
  if (mode !== 'order') return false;
  for (const id of pieces) {
    if (!smokeWeapon(s, id)) continue;
    const sh = shooter(s, id);
    if (!sh) continue;
    for (const h of ALL_HEXES) if (canHoldSmoke(s, h) && inRange(sh, h) && losCheck(s, sh.hex, h).clear) return true;
  }
  return false;
}

/**
 * Fire a legal Smoke round: the Targeting roll (Event!, Sniper!, Time! trigger; Jammed! does not), then on a hit one
 * random Smoke marker in the target hex, if the Weapon is still in play after the trigger. Returns true (it fired).
 */
export function* smokeRound(s: GameState, ctx: FlowCtx, side: Side, spec: FireSpec): Gen<boolean> {
  const w = spec.pieces[0];
  const sh = shooter(s, w);
  if (!sh) return false;
  const range = distance(sh.hex, spec.target);
  const hind = losCheck(s, sh.hex, spec.target).hindrance;
  ctx.emit({ kind: 'log', text: `${sh.type.name}: a Smoke round at ${label(spec.target)}.`, side });
  const r = yield* roll(s, ctx, side, 'targeting');
  const hit = r.product - hind > range;
  ctx.emit({ kind: 'targeting', side, piece: w, target: spec.target, product: r.product, need: range + hind + 1, hit });
  if (hit && s.pieces[w].where === 'carried') placeRandomSmoke(s, ctx, spec.target);
  return true;
}
