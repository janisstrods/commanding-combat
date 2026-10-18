// Fire Attacks (§O20): which pieces can fire and at what, Fire Groups, FP (group, Hindrance, height), Targeting for
// Ordnance, the Fire Attack Roll (Jammed!, Airburst, one-use Weapons), the reaction windows before the attack and each
// Defense roll, and the Defense rolls with their results. Used by the Fire Order, Op Fire, Assault Fire (Task 9),
// Artillery (Task 8: `defendHex` with its own AttackInfo) and Mines (Task 7: `defend` with mode 'mine').
import { breakPiece, eliminate, suppress } from './casualties';
import { CARDS } from './data';
import { roll } from './deck';
import { choose, type Gen } from './decisions';
import { areAdjacent, distance } from './hex';
import { losCheck } from './los';
import { smokeRound, smokeShotError } from './orders/fire';
import { window } from './reactions';
import { cover, currentStats, weaponStats } from './stats';
import { hexOf, isLeader, isUnit, typeOf } from './state';
import { isWaterHex } from './terrain';
import {
  type ActionName, type Answer, type AttackInfo, type CounterType, type Decision, type FireSpec, type FlowCtx, type GameState,
  type HexId, type PieceId, type Side, other,
} from './types';

/** A piece able to fire now, with its current values. */
export interface Shooter {
  id: PieceId;
  hex: HexId;
  fp: number;
  range: number;
  minRange: number;
  ordnance: boolean;
  weapon: boolean;
  type: CounterType;
}

/**
 * Piece `id` as a shooter, or null if it cannot fire now: a unit on the map with FP ≥ 1 (broken units fire their
 * broken side); a Weapon that is unbroken, carried by an unbroken, unsuppressed unit on the map, not in a Stream, Marsh
 * or Wire hex (§11, §F106.3). `opFire`: Ordnance cannot Op Fire (§A33.3).
 */
export function shooter(s: GameState, id: PieceId, opFire = false): Shooter | null {
  const p = s.pieces[id];
  if (!p) return null;
  const t = typeOf(p);
  if (t.kind === 'weapon') {
    if (p.broken || p.where !== 'carried' || !p.carrier) return null;
    const c = s.pieces[p.carrier];
    if (!c || c.where !== 'map' || c.broken || c.suppressed) return null;
    if (isWaterHex(s.map, c.hex) || s.fort[c.hex] === 'wire') return null;
    if (opFire && t.ordnance) return null;
    const w = weaponStats(s, id);
    if (w.fp < 1) return null;
    return { id, hex: c.hex, fp: w.fp, range: w.range, minRange: w.minRange, ordnance: !!t.ordnance, weapon: true, type: t };
  }
  if (p.where !== 'map' || !isUnit(p)) return null;
  const st = currentStats(s, id);
  if (st.fp < 1 || st.range < 1) return null;
  return { id, hex: p.hex, fp: st.fp, range: st.range, minRange: 0, ordnance: false, weapon: false, type: t };
}

/** Is `target` within the shooter's Range (counting the target hex, not its own; at least its minimum range)? */
export function inRange(sh: Shooter, target: HexId): boolean {
  const d = distance(sh.hex, target);
  return d >= Math.max(1, sh.minRange) && d <= sh.range;
}

/** Does `hex` hold a unit of the side opposing `side`? */
function enemyIn(s: GameState, hex: HexId, side: Side): boolean {
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.hex === hex && p.side !== side && isUnit(p)) return true;
  }
  return false;
}

/** Hexes holding units of the side opposing `side`, ascending. */
export function enemyHexes(s: GameState, side: Side): HexId[] {
  const set = new Set<HexId>();
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.side !== side && isUnit(p)) set.add(p.hex);
  }
  return [...set].sort((a, b) => a - b);
}

/** The pieces that fire with activated `units`: each unit and the Weapon it carries. */
export function firingPieces(s: GameState, units: PieceId[]): PieceId[] {
  const out: PieceId[] = [];
  for (const id of units) {
    const p = s.pieces[id];
    if (!p || p.where !== 'map') continue;
    out.push(id);
    if (p.weapon) out.push(p.weapon);
  }
  return out;
}

/**
 * Can any of `units` (or their Weapons) fire at an enemy unit in LOS and Range (§O20.1)? The requirement of a Fire
 * Order or an Op Fire activation (`opFire`: no Ordnance). FP after Hindrance does not matter (R-51).
 */
export function canShootSomething(s: GameState, units: PieceId[], opFire = false): boolean {
  if (!units.length) return false;
  const side = s.pieces[units[0]].side;
  const targets = enemyHexes(s, side);
  if (!targets.length) return false;
  for (const id of firingPieces(s, units)) {
    const sh = shooter(s, id, opFire);
    if (!sh) continue;
    for (const t of targets) if (inRange(sh, t) && losCheck(s, sh.hex, t).clear) return true;
  }
  return false;
}

/** FP of an attack before Action bonuses, with its parts (§O20.4). */
export interface AttackFp {
  fp: number;
  hindrance: number;
  height: number;
}

/**
 * The FP of `pieces` firing at `targets` (one hex, or two for Spray Fire): the best piece's FP + 1 per other piece,
 * minus the largest Hindrance on any of their lines (not for Ordnance: its Targeting roll took it), −1 if a target is
 * higher than any firing piece, +1 if one is lower than any (R-13, R-19). Assumes a legal spec.
 */
export function attackFp(s: GameState, pieces: PieceId[], targets: HexId[]): AttackFp {
  const shooters = pieces.map((id) => shooter(s, id)).filter((x): x is Shooter => !!x);
  if (!shooters.length) return { fp: 0, hindrance: 0, height: 0 };
  let best = 0;
  for (const sh of shooters) best = Math.max(best, sh.fp);
  const ordnance = shooters.length === 1 && shooters[0].ordnance;
  let hindrance = 0;
  if (!ordnance) for (const sh of shooters) for (const t of targets) hindrance = Math.max(hindrance, losCheck(s, sh.hex, t).hindrance);
  const el = s.map.elevation;
  const hi = Math.max(...targets.map((t) => el[t]));
  const lo = Math.min(...targets.map((t) => el[t]));
  let height = 0;
  if (shooters.some((sh) => hi > el[sh.hex])) height -= 1;
  if (shooters.some((sh) => lo < el[sh.hex])) height += 1;
  return { fp: best + shooters.length - 1 - hindrance + height, hindrance, height };
}

/** The FP of a Fire Attack as specified, before Actions (+ `bonus`). */
export function firePower(s: GameState, spec: FireSpec, bonus = 0): number {
  return attackFp(s, spec.pieces, [spec.target]).fp + bonus;
}

/** Actions that add FP just before a Fire Attack Roll (they may lift a shot to FP ≥ 1, §10.3). */
const FP_ACTIONS: ReadonlySet<ActionName> = new Set(['Bore Sighting', 'Crossfire', 'Hand Grenades', 'Marksmanship', 'Sustained Fire']);

function holdsFpAction(s: GameState, side: Side): boolean {
  for (const c of s.players[side].hand) {
    const card = CARDS[c];
    if (card && FP_ACTIONS.has(card.action)) return true;
  }
  return false;
}

/** Do the hexes form a chain in which each is adjacent to at least one other (§O20.3.1)? */
function chained(hexes: HexId[]): boolean {
  const list = [...new Set(hexes)];
  if (list.length <= 1) return true;
  const seen = new Set([list[0]]);
  const stack = [list[0]];
  while (stack.length) {
    const h = stack.pop()!;
    for (const x of list) if (!seen.has(x) && areAdjacent(h, x)) {
      seen.add(x);
      stack.push(x);
    }
  }
  return seen.size === list.length;
}

/**
 * Why `spec` is not a legal Fire Attack for `side` from `pool` (`target`: the only target allowed, e.g. Op Fire on the
 * hex just entered), or null. Smoke rounds (`spec.smoke`) are checked by orders/fire.ts `smokeShotError`.
 */
export function fireSpecError(
  s: GameState, side: Side, spec: FireSpec | undefined, pool: PieceId[], mode: 'order' | 'opFire' | 'assault', target?: HexId,
): string | null {
  if (!spec || !Array.isArray(spec.pieces) || !spec.pieces.length) return 'Choose the pieces that fire.';
  if (new Set(spec.pieces).size !== spec.pieces.length) return 'Each piece once.';
  if (!spec.pieces.every((id) => pool.includes(id))) return 'Only activated pieces that have not fired yet may fire.';
  if (target !== undefined && spec.target !== target) return 'Fire at the hex just entered.';
  if (spec.smoke) return smokeShotError(s, spec, mode);
  if (!Number.isInteger(spec.target) || spec.target < 0 || spec.target >= s.map.terrain.length) return 'Choose a target hex.';
  if (!enemyIn(s, spec.target, side)) return 'The target hex holds no enemy unit.';
  const shooters: Shooter[] = [];
  for (const id of spec.pieces) {
    const sh = shooter(s, id, mode === 'opFire');
    if (!sh) {
      const t = typeOf(s.pieces[id]);
      return mode === 'opFire' && t.ordnance ? 'Ordnance cannot Op Fire.' : `${t.name} cannot fire now.`;
    }
    shooters.push(sh);
  }
  if (shooters.length > 1) {
    if (shooters.some((x) => x.ordnance)) return 'Ordnance fires alone, never in a Fire Group.';
    const hexes = shooters.map((x) => x.hex);
    if (!chained(hexes)) return 'A Fire Group must fire from hexes that are adjacent to one another.';
    const wired = hexes.find((h) => s.fort[h] === 'wire');
    if (wired !== undefined && hexes.some((h) => h !== wired)) return 'Pieces in a Wire hex cannot group with pieces outside it.';
  }
  for (const sh of shooters) {
    if (!inRange(sh, spec.target)) {
      return sh.minRange > 1 && distance(sh.hex, spec.target) < sh.minRange ? `The target is inside the ${sh.type.name}'s minimum range.` : 'The target is out of range.';
    }
    const l = losCheck(s, sh.hex, spec.target);
    if (!l.clear) return `No line of sight: ${l.blockedBy ?? 'blocked'}.`;
  }
  if (firePower(s, spec) < 1 && !holdsFpAction(s, side)) return 'The attack would have less than 1 FP.';
  return null;
}

/** The check of a 'fire' answer. */
export function fireAnswerError(s: GameState, d: Extract<Decision, { kind: 'fire' }>, a: Answer): string | null {
  if (a.kind === 'done') return d.mustFire ? 'Make at least one Fire Attack.' : null;
  if (a.kind !== 'fire') return 'Choose a Fire Attack, or stop.';
  return fireSpecError(s, d.side, a.spec, d.pieces, d.mode, d.target);
}

/**
 * The legal Fire Attacks of `pieces` by target hex: every single piece that can fire there, and per target the largest
 * Fire Group of each chain of adjacent hexes (all of it that can reach). For the UI and random play; other groups are
 * legal too.
 */
export function fireOptions(s: GameState, pieces: PieceId[], mode: 'order' | 'opFire' | 'assault' = 'order', target?: HexId): Map<HexId, FireSpec[]> {
  const out = new Map<HexId, FireSpec[]>();
  if (!pieces.length) return out;
  const side = s.pieces[pieces[0]].side;
  const shooters = pieces.map((id) => shooter(s, id, mode === 'opFire')).filter((x): x is Shooter => !!x);
  const targets = target !== undefined ? [target] : enemyHexes(s, side);
  for (const t of targets) {
    if (!enemyIn(s, t, side)) continue;
    const able = shooters.filter((sh) => inRange(sh, t) && losCheck(s, sh.hex, t).clear);
    const specs: FireSpec[] = [];
    for (const sh of able) {
      const spec = { pieces: [sh.id], target: t };
      if (!fireSpecError(s, side, spec, pieces, mode, target)) specs.push(spec);
    }
    // groups: connected components of the non-Ordnance shooters' hexes (Wire hexes stay on their own)
    const grp = able.filter((sh) => !sh.ordnance);
    const left = new Set(grp);
    while (left.size) {
      const first = left.values().next().value as Shooter;
      left.delete(first);
      const comp = [first];
      const wire = (h: HexId) => s.fort[h] === 'wire';
      for (let i = 0; i < comp.length; i++) {
        for (const x of [...left]) {
          const a = comp[i].hex;
          const linked = wire(a) || wire(x.hex) ? a === x.hex : a === x.hex || areAdjacent(a, x.hex);
          if (linked) {
            left.delete(x);
            comp.push(x);
          }
        }
      }
      if (comp.length > 1) {
        const spec = { pieces: comp.map((x) => x.id), target: t };
        if (!fireSpecError(s, side, spec, pieces, mode, target)) specs.push(spec);
      }
    }
    if (specs.length) out.set(t, specs);
  }
  return out;
}

/**
 * Resolve a Fire Attack (§O20.2-§O20.3) by `side` with a legal `spec`. Ordnance rolls to hit first. Then the firing
 * player's window before the Fire Attack Roll (Actions add FP or a second hex); FP below 1 cancels the attack (the
 * pieces have not fired: returns false). The roll: Jammed! breaks every firing Weapon, Sustained Fire on doubles breaks
 * an MG or Mortar, a one-use Weapon is spent; then every enemy unit that was in the target hex(es) at the roll makes
 * its Defense roll. Returns whether the pieces fired.
 */
export function* fireAttack(s: GameState, ctx: FlowCtx, side: Side, spec: FireSpec, mode: 'order' | 'opFire' | 'assault'): Gen<boolean> {
  if (spec.smoke) return yield* smokeRound(s, ctx, side, spec); // a Smoke round (§O20.2.1): no Fire Attack
  const shooters = spec.pieces.map((id) => shooter(s, id, mode === 'opFire')).filter((x): x is Shooter => !!x);
  if (!shooters.length) return false;
  const ordnance = shooters.length === 1 && shooters[0].ordnance;
  const firers = shooters.map((x) => x.hex);
  const attack: AttackInfo = {
    side, mode, pieces: spec.pieces.slice(), targets: [spec.target], ordnance,
    mortarOrArtillery: ordnance && shooters[0].type.weaponClass === 'mortar',
    ignoresCover: shooters.some((x) => !!x.type.ignoresCover),
    fp: 0, bonus: 0, total: null, reduction: 0, played: [],
  };
  if (ordnance) {
    const w = shooters[0];
    const range = distance(w.hex, spec.target);
    const hind = losCheck(s, w.hex, spec.target).hindrance;
    const r = yield* roll(s, ctx, side, 'targeting');
    const hit = r.product - hind > range;
    ctx.emit({ kind: 'targeting', side, piece: w.id, target: spec.target, product: r.product, need: range + hind + 1, hit });
    if (!hit) return true; // it fired and missed (a one-use Weapon is not spent)
    if (s.pieces[w.id].where !== 'carried') return true;
  }
  attack.fp = attackFp(s, attack.pieces, attack.targets).fp;
  yield* window(s, ctx, 'beforeFireAttackRoll', { hex: spec.target, attack });
  attack.fp = attackFp(s, attack.pieces, attack.targets).fp; // Spray Fire may have added a hex
  const fp = attack.fp + attack.bonus;
  if (fp < 1) {
    ctx.emit({ kind: 'log', text: 'The attack would have less than 1 FP: it is not made.', side });
    return false;
  }
  const defenders = attack.targets.map((h) => unitsAt(s, h, other(side)));
  const r = yield* roll(s, ctx, side, 'fireAttack');
  const airburst = attack.mortarOrArtillery && attack.targets.some((h) => s.map.terrain[h] === 'Woods') ? 2 : 0;
  attack.total = fp + r.sum + airburst;
  ctx.emit({
    kind: 'fireAttack', side, pieces: attack.pieces.slice(), target: spec.target, fp, total: attack.total,
    ...(attack.targets.length > 1 ? { hexes: attack.targets.slice() } : {}),
  });
  if (r.jammed) {
    for (const id of attack.pieces) if (typeOf(s.pieces[id]).kind === 'weapon') yield* breakPiece(s, ctx, id, 'jammed');
  }
  if (r.doubles) {
    for (const a of attack.played) {
      if (a !== 'Sustained Fire') continue;
      const guns = attack.pieces.filter((id) => {
        const p = s.pieces[id];
        const k = typeOf(p).weaponClass;
        return (k === 'mg' || k === 'mortar') && p.where === 'carried';
      });
      const [i] = yield* choose(s, ctx, side, 'sustainedBreak', guns.map((piece) => ({ piece })), 1, 1);
      if (i !== undefined) yield* breakPiece(s, ctx, guns[i], 'jammed');
    }
  }
  for (const id of attack.pieces) if (typeOf(s.pieces[id]).oneUse && s.pieces[id].where === 'carried') yield* eliminate(s, ctx, id, 'other');
  for (let i = 0; i < attack.targets.length; i++) yield* defendHex(s, ctx, attack, attack.targets[i], defenders[i], firers);
  return true;
}

function unitsAt(s: GameState, hex: HexId, side: Side): PieceId[] {
  const out: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.hex === hex && p.side === side && isUnit(p)) out.push(id);
  }
  return out;
}

const still = (s: GameState, id: PieceId, hex: HexId) => s.pieces[id]?.where === 'map' && s.pieces[id].hex === hex;

/**
 * The Defense rolls against `attack` (its `total` set) of units `ids` in `hex` (those there at the Attack Roll), in the
 * order the defender picks while a Leader whose Command counts is among them (else as listed). Units that have left
 * the hex meanwhile do not roll. `firers`: the firing pieces' hexes (Wall / Hedge Cover).
 */
export function* defendHex(s: GameState, ctx: FlowCtx, attack: AttackInfo, hex: HexId, ids: PieceId[], firers: HexId[] = []): Gen {
  let left = ids.filter((id) => still(s, id, hex));
  while (left.length) {
    let next = left[0];
    if (left.length > 1 && left.some((id) => isLeader(s.pieces[id]) && currentStats(s, id).command > 0)) {
      const owner = s.pieces[left[0]].side;
      const [i] = yield* choose(s, ctx, owner, 'defenseOrder', left.map((piece) => ({ piece })), 1, 1, { hex });
      next = left[i];
    }
    yield* defend(s, ctx, next, attack, firers);
    left = left.filter((id) => id !== next && still(s, id, hex));
  }
}

/**
 * One Defense roll (§O20.3.4): the defender's window just before it (Concealment, Hidden Entrenchments / Pillbox),
 * then the roll; after its trigger, current Morale + Cover + roll against the attack total less any Concealment:
 * lower → the unit breaks; equal → Suppressed, or breaks if it is activated to Move; higher → no effect.
 */
export function* defend(s: GameState, ctx: FlowCtx, id: PieceId, attack: AttackInfo, firers: HexId[] = []): Gen {
  const p = s.pieces[id];
  if (!p || p.where !== 'map') return;
  const hex = p.hex;
  yield* window(s, ctx, 'beforeDefenseRoll', { hex, units: [id], attack });
  if (!still(s, id, hex)) return;
  const r = yield* roll(s, ctx, p.side, 'defense');
  if (!still(s, id, hex)) return;
  const morale = currentStats(s, id).morale + cover(s, id, { firers, mortarOrArtillery: attack.mortarOrArtillery, ignoresCover: attack.ignoresCover });
  const total = morale + r.sum;
  const against = (attack.total ?? 0) - attack.reduction;
  const result = total < against ? 'break' : total === against ? (s.turn.moving.includes(id) ? 'break' : 'suppress') : 'none';
  ctx.emit({ kind: 'defense', unit: id, morale, total, attack: against, result });
  if (result === 'break') yield* breakPiece(s, ctx, id, attack.mode === 'opFire' ? 'opFire' : attack.mode === 'artillery' ? 'artillery' : attack.mode === 'mine' ? 'mine' : 'fire');
  else if (result === 'suppress') suppress(s, ctx, id);
}

/** Where the firing pieces of `pieces` are (for Wall / Hedge Cover). */
export function firerHexes(s: GameState, pieces: PieceId[]): HexId[] {
  return pieces.map((id) => hexOf(s, s.pieces[id])).filter((h) => h >= 0);
}
