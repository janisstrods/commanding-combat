// Shared plumbing of the Event handlers (§E42): unit queries, "nearest to the Random Hex", the counter mix, placement
// "in or adjacent to a hex", Blaze (start it, displace the units, §E46 / R-34), and the Support Table items that
// Infiltration (§E59) and Reinforcements (§E68) bring in.
//
// General rules every handler follows (§E42): the receiver makes the choices unless the Event names someone else; what
// is impossible is skipped; "a unit" means a unit of either side unless the Event says friendly or enemy; anything an
// Event brings into play comes from the counter mix (pieces on the Track Display are in play); what the mix has none
// left of is not brought in (mix.ts, R-56).
import { simultaneously, eliminate } from '../casualties';
import { randomHex } from '../deck';
import { COUNTERS, RSG } from '../data';
import { choose, type Gen } from '../decisions';
import { resolveMelees } from '../flow';
import { distance, neighbours } from '../hex';
import { withHolders } from '../melee';
import { objectiveHexes, relocate } from '../objectives';
import { FORT_NAMES, fortsLeft, mixHas, mixLeft } from '../mix';
import { figures, stackLimit, FIGURES } from '../stats';
import {
  attachWeapon, counterType, hasUnitOf, isImpassableHex, isUnit, isWater, placeFort, removeFort, removeSmoke, takeFromMix,
} from '../state';
import { enterBlock } from '../terrain';
import { type FlowCtx, type FortKind, type GameState, type HexId, type Piece, type PieceId, type Side, other } from '../types';

/** A line in the log about the Event, e.g. why it did nothing. */
export function note(ctx: FlowCtx, side: Side, text: string): void {
  ctx.emit({ kind: 'log', text, side });
}

/** Units on the map (of `side`, or both), in id order, that pass `pred`. */
export function mapUnits(s: GameState, side?: Side, pred: (p: Piece) => boolean = () => true): Piece[] {
  const out: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && (!side || p.side === side) && isUnit(p) && pred(p)) out.push(p);
  }
  return out;
}

/** The items at the smallest `dist` (all of them on a tie), or [] for no items. */
export function nearest<T>(items: T[], dist: (t: T) => number): T[] {
  let best = Infinity;
  for (const t of items) best = Math.min(best, dist(t));
  return items.filter((t) => dist(t) === best);
}

/** Hexes holding units (either side), ascending. */
export function occupiedHexes(s: GameState): HexId[] {
  return [...new Set(mapUnits(s).map((p) => p.hex))].sort((a, b) => a - b);
}

/** Friendly hexes of `side` (§G): hexes with his units, and the Objectives he controls that hold no enemy unit. */
export function friendlyHexes(s: GameState, side: Side): HexId[] {
  const out = new Set(mapUnits(s, side).map((p) => p.hex));
  for (let n = 1; n <= s.map.objectives.length; n++) {
    if (s.control[n - 1] !== side) continue;
    for (const h of objectiveHexes(s, n)) if (!hasUnitOf(s, h, other(side))) out.add(h);
  }
  return [...out].sort((a, b) => a - b);
}

/** Figures of the units among counter types `types` (Squad 4, Team 2, Leader 1). */
export function typeFigures(types: string[]): number {
  let n = 0;
  for (const t of types) n += FIGURES[counterType(t).kind] ?? 0;
  return n;
}

/** The hexes in or adjacent to `hex` where `side` may place `figs` figures: stacking observed, not impassable. */
export function placementsAround(s: GameState, hex: HexId, side: Side, figs: number): HexId[] {
  return [hex, ...neighbours(hex)]
    .filter((h) => !isImpassableHex(s, h) && figures(s, h, side) + figs <= stackLimit(s, h))
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------------------------------------------------
// Melees an Event causes (R-04)

/** Per hex: the side that solely occupied it before an Event brought the other side's units in (melee.ts holders). */
export type Holders = Record<number, Side>;

/** Record `hex` in `holders` if only the enemy of `side` is there now, before `side`'s unit comes in. */
export function noteHolder(s: GameState, holders: Holders, hex: HexId, side: Side): void {
  if (holders[hex] === undefined && hasUnitOf(s, hex, other(side)) && !hasUnitOf(s, hex, side)) holders[hex] = other(side);
}

/**
 * Fight the melees the Event caused, at its end and inside it (R-04: no triggers), telling melee.ts who held each hex
 * (the Bunker / Pillbox tie, §F101). The Event! trigger fights any other melee due right after (deck.ts).
 */
export function* eventMelees(s: GameState, ctx: FlowCtx, holders: Holders): Gen {
  if (Object.keys(holders).length) yield* resolveMelees(s, withHolders(ctx, holders));
}

// ---------------------------------------------------------------------------------------------------------------------
// The counter mix (mix.ts)

/** The counter type of `side`'s Hero (`hero`) or Private (`private`) in his nation's counter mix, or null. */
export function specialLeader(s: GameState, side: Side, which: 'hero' | 'private'): string | null {
  const nation = s.players[side].nation;
  for (const id in COUNTERS) {
    const t = COUNTERS[id];
    if (t.nation === nation && t.kind === 'leader' && t[which]) return id;
  }
  return null;
}

/** Put unit `p` (from the mix or the Casualty Track) on the map in `hex`, announcing it and updating control. */
export function putUnit(s: GameState, ctx: FlowCtx, p: Piece, hex: HexId): void {
  relocate(s, ctx, p.id, hex);
  ctx.emit({ kind: 'place', piece: p.id, hex });
}

/**
 * Booby Trap (Mines), Rubble (Wire), Shellholes (Foxholes): a Random Hex; unless it is Water (Stream, Marsh), ablaze or
 * holds a Fortification, the marker is placed there. Units already in the hex are not affected now.
 */
export function* fortEvent(s: GameState, ctx: FlowCtx, receiver: Side, name: string, kind: FortKind): Gen {
  // R-56: with no marker left in the counter mix the Event does nothing (no Random Hex: it only says where it goes)
  if (fortsLeft(s, kind) < 1) {
    note(ctx, receiver, `${name}: the counter mix has no ${FORT_NAMES[kind]} left.`);
    return;
  }
  const hex = yield* randomHex(s, ctx, receiver);
  if (!placeFort(s, ctx, hex, kind)) note(ctx, receiver, `${name}: nothing can be placed in the Random Hex.`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Blaze (§E46, §E48, §8.1)

/** May a Blaze start in `hex` (not Water, Stream or Marsh, no Blaze yet)? */
export function canBlaze(s: GameState, hex: HexId): boolean {
  return !isWater(s.map, hex) && !s.blaze[hex];
}

/** Put a Blaze in `hex`: the Smoke and the Fortification there are removed (§8.1). Its units must leave (`displace`). */
export function startBlaze(s: GameState, ctx: FlowCtx, hex: HexId): void {
  removeSmoke(s, ctx, hex);
  removeFort(s, ctx, hex);
  s.blaze[hex] = true;
  ctx.emit({ kind: 'place', hex, marker: 'blaze' });
}

/** Where a unit displaced from `from` may go (R-34): an adjacent hex it could enter (no Water Barrier, Blaze, Cliff ...). */
export function displacementHexes(s: GameState, from: HexId): HexId[] {
  return neighbours(from)
    .filter((h) => enterBlock(s.map, from, h, s) === null)
    .sort((a, b) => a - b);
}

/**
 * The units in the Blaze hexes `hexes` leave them (§E46): each owner, the inactive player first, moves each of his
 * units (with its Weapon) to an adjacent hex that is not impassable, even an enemy-occupied or overstacked one (R-34:
 * the melee comes at the end of the Event, overstacking at the end of the Turn). A unit with nowhere to go is
 * eliminated; the eliminations are judged together (both players may surrender at once). Then the melees.
 */
export function* displace(s: GameState, ctx: FlowCtx, hexes: HexId[]): Gen {
  const holders: Holders = {};
  yield* simultaneously(s, ctx, function* (c) {
    for (const side of [other(s.active), s.active]) {
      for (const hex of hexes) {
        for (const u of mapUnits(s, side, (p) => p.hex === hex)) {
          const to = displacementHexes(s, hex);
          if (!to.length) {
            yield* eliminate(s, c, u.id, 'event');
            continue;
          }
          const [i] = yield* choose(s, c, side, 'blazeDisplace', to.map((h) => ({ hex: h })), 1, 1, { piece: u.id, hex });
          noteHolder(s, holders, to[i], side);
          relocate(s, c, u.id, to[i]);
          c.emit({ kind: 'move', units: [u.id], from: hex, to: to[i], mp: 0 });
        }
      }
    }
  });
  yield* eventMelees(s, ctx, holders);
}

// ---------------------------------------------------------------------------------------------------------------------
// Support Table items (§E59 Infiltration, §E68 Reinforcements)

/** One thing a Support Table column offers: a unit (with its Weapon), a Leader, or a Radio. */
export interface SupportOption {
  /** The RSG item id (for a Leader of an "A or B" row, one option per Leader). */
  item: string;
  label: string;
  /** Counter type ids, units first; the Weapon (if any) last. */
  types: string[];
  /** The unit that carries the item's Weapon. */
  carrier?: string;
  weapon?: string;
  radio?: string;
}

/**
 * The items of `side`'s Support Table column `roll` available in the scenario year: Radios only if `radios`; only
 * items whose every counter the mix still has (mix.ts, R-56: named Leaders not in play; each Leader of an "A or B" row
 * is a separate option).
 */
export function supportOptions(s: GameState, side: Side, roll: number, radios: boolean): SupportOption[] {
  const table = RSG.support[s.players[side].nation];
  const out: SupportOption[] = [];
  const seen = new Set<string>();
  for (const e of table?.columns[roll] ?? []) {
    const item = table.items[e.item];
    if (!item || seen.has(e.item) || s.year < e.years[0] || s.year > e.years[1]) continue;
    seen.add(e.item);
    if (item.kind === 'radio') {
      if (!radios) continue;
      const radio = Object.keys(item.pieces)[0];
      if (radio && mixLeft(s, radio) > 0) out.push({ item: item.id, label: item.label, types: [radio], radio });
      continue;
    }
    if (item.kind === 'leaderEither') {
      for (const l of item.oneOf ?? []) {
        if (mixLeft(s, l) > 0) out.push({ item: item.id, label: counterType(l).name, types: [l] });
      }
      continue;
    }
    const types: string[] = [];
    for (const [t, n] of Object.entries(item.pieces)) for (let i = 0; i < n; i++) types.push(t);
    if (!mixHas(s, types)) continue;
    const units = types.filter((t) => counterType(t).kind !== 'weapon');
    const weapons = types.filter((t) => counterType(t).kind === 'weapon');
    const o: SupportOption = { item: item.id, label: item.label, types: [...units, ...weapons] };
    if (weapons.length) {
      o.weapon = weapons[0];
      o.carrier = item.carrier && units.includes(item.carrier) ? item.carrier : units[0];
    }
    out.push(o);
  }
  return out;
}

/** The figures an option's units add to a hex. */
export function optionFigures(o: SupportOption): number {
  return typeFigures(o.types.filter((t) => counterType(t).kind !== 'weapon'));
}

/**
 * Bring in an option's unit(s) in `hex`, the Weapon carried by its carrier, all taken from the counter mix (the
 * option was offered because the mix has them, `supportOptions`). Returns the new pieces (units first).
 */
export function bringIn(s: GameState, ctx: FlowCtx, side: Side, o: SupportOption, hex: HexId): Piece[] {
  const made: Piece[] = [];
  let carrier: Piece | null = null;
  for (const t of o.types) {
    if (counterType(t).kind === 'weapon') continue;
    const p = takeFromMix(s, t, side);
    if (!p) continue;
    putUnit(s, ctx, p, hex);
    made.push(p);
    if (!carrier && t === o.carrier) carrier = p;
  }
  const w = o.weapon && carrier ? takeFromMix(s, o.weapon, side, 'carried') : null;
  if (w && carrier) {
    attachWeapon(s, w, carrier);
    made.push(w);
    ctx.emit({ kind: 'place', piece: w.id, hex });
  }
  return made;
}

/** The ids of `ps`. */
export const ids = (ps: Piece[]): PieceId[] => ps.map((p) => p.id);

/** Distance from `hex` to a piece on the map. */
export const dist = (hex: HexId) => (p: Piece) => distance(hex, p.hex);
