// Scenario special rules of the set-up (scenarios-reference §3), read from `ScenarioDef.special` (never the scenario
// number). setup.ts calls them:
//
//   setupFlow, after the carried Weapons   setupStart         random broken Weapons (S5 Deep Freeze)
//   before each side deploys               scenarioDeploy     a unit in a named hex (S3 Command Post), units set up
//                                                             together with a Fortification (S11 Immobilised Sherman),
//                                                             the Random Hex set-up (S7)
//   placesFor                              setupPlaces        the German chain (S7)
//   latePieces and the late placements     lateSetupTypes,    the Hidden Gun in its own set-up area (S4)
//                                          lateInOwnArea
//   placeFortifications                    fortHexAllowed,    Wire near Buildings (S4 Rubble); the Bunker already set
//                                          fortsPlaced        up with the Sherman's crew (S11)
//   before the opening draw                openingCards       named cards in hand (S3, S7), the Mines option (S9)
import { reveal } from '../deck';
import { ask, choose, type Gen } from '../decisions';
import { label, neighbours, parseHex } from '../hex';
import { randInt, shuffle } from '../rng';
import { setupHexes } from '../setup';
import { figures, stackLimit, unitFigures } from '../stats';
import { canHoldFort, isUnit, isWeapon, placeFort, typeOf } from '../state';
import { type CardId, type FlowCtx, type FortKind, type GameState, type HexId, type Piece, type Side, SIDES } from '../types';

const log = (ctx: FlowCtx, text: string, side: Side) => ctx.emit({ kind: 'log', text, side });

const staged = (s: GameState, side: Side): Piece[] => Object.values(s.pieces).filter((p) => p.side === side && p.where === 'staging');

function put(s: GameState, ctx: FlowCtx, p: Piece, hex: HexId): void {
  p.where = 'map';
  p.hex = hex;
  ctx.emit({ kind: 'place', piece: p.id, hex });
}

/** Does `p` fit in `hex` (stacking, with the limit `limit` if lower)? */
const fits = (s: GameState, p: Piece, hex: HexId, limit = Infinity) =>
  figures(s, hex, p.side) + unitFigures(p) <= Math.min(stackLimit(s, hex), limit);

// ---------------------------------------------------------------------------------------------------------------------

/** At the start of the set-up (Weapons in staging or carried): `brokenWeapons` of each side, picked at random, break. */
export function setupStart(s: GameState, ctx: FlowCtx): void {
  for (const side of SIDES) {
    let n = s.scenario.special.brokenWeapons?.[side] ?? 0;
    const pool = Object.values(s.pieces).filter((p) => p.side === side && isWeapon(p) && !p.broken && (p.where === 'staging' || p.where === 'carried'));
    while (n-- > 0 && pool.length) {
      const [w] = pool.splice(randInt(s, pool.length), 1);
      w.broken = true;
      ctx.emit({ kind: 'break', piece: w.id });
      log(ctx, `Deep Freeze: the ${typeOf(w).name} starts broken.`, side);
    }
  }
}

/** What the rules place for `side` before its own deployment (see the head of this file). */
export function* scenarioDeploy(s: GameState, ctx: FlowCtx, side: Side): Gen {
  const sp = s.scenario.special;
  for (const [type, hex] of Object.entries(sp.setupHex?.[side] ?? {})) {
    const p = staged(s, side).find((x) => x.type === type);
    if (p) put(s, ctx, p, parseHex(hex));
  }
  if (sp.setupTogether?.[side]) yield* setUpTogether(s, ctx, side);
  if (sp.randomHexSetup?.includes(side)) yield* randomHexSetup(s, ctx, side);
}

/**
 * The units of `setupTogether` (with the Weapons `carried` gave them) and the Fortification: the owner picks one hex of
 * his set-up area with the named terrain and elevation that can take the Fortification and them (S11: the Bunker,
 * Sgt Buehler with the .50 cal, the Weapon Team with the Pack Howitzer, in a non-Hill Open Ground hex).
 */
function* setUpTogether(s: GameState, ctx: FlowCtx, side: Side): Gen {
  const t = s.scenario.special.setupTogether![side]!;
  const units: Piece[] = [];
  for (const type of t.units) {
    const p = staged(s, side).find((x) => x.type === type && !units.includes(x));
    if (p) units.push(p);
  }
  if (!units.length) return;
  const limit = s.scenario.special.fortStackingLimits?.[t.fort] ?? Infinity;
  const figs = units.reduce((n, p) => n + unitFigures(p), 0);
  const hexes = setupHexes(s, side).filter(
    (h) => s.map.terrain[h] === t.terrain && s.map.elevation[h] === t.elevation && canHoldFort(s, h)
      && figures(s, h, side) + figs <= Math.min(stackLimit(s, h), limit),
  );
  if (!hexes.length) {
    log(ctx, `No hex can take the ${t.fort} and its crew: they set up as usual.`, side);
    return;
  }
  const [i] = yield* choose(s, ctx, side, 'placement', hexes.map((hex) => ({ hex })), 1, 1, { fort: t.fort, units: units.map((p) => p.id) });
  placeFort(s, ctx, hexes[i], t.fort);
  for (const p of units) put(s, ctx, p, hexes[i]);
}

/**
 * The Random Hex set-up (S7): reveal a card from the side's own deck; one staged unit of the owner's choice sets up in
 * or next to its Random Hex (within his set-up area, stacking observed); until every unit is down. A hex with no room
 * for any unit is skipped (a new card is revealed; project ruling). Then the deck is reshuffled; the Weapons are handed
 * out by the side's usual deployment that follows (setup.ts), onto units already on the map.
 */
function* randomHexSetup(s: GameState, ctx: FlowCtx, side: Side): Gen {
  const area = new Set(setupHexes(s, side));
  const pl = s.players[side];
  let auto = false;
  let misses = 0;
  for (;;) {
    const units = staged(s, side).filter((p) => isUnit(p));
    if (!units.length || pl.deck.length <= 1 || misses > 20) break;
    const card = yield* reveal(s, ctx, side, 'randomHex');
    const around = [card.hex, ...neighbours(card.hex)].filter((h) => area.has(h)).sort((a, b) => a - b);
    const options = units.filter((p) => around.some((h) => fits(s, p, h)));
    if (!options.length) {
      misses++;
      log(ctx, `No room around ${label(card.hex)}: another Random Hex.`, side);
      continue;
    }
    const hexes = around.filter((h) => options.some((p) => fits(s, p, h)));
    let piece: Piece | null = null;
    let hex = -1;
    if (!auto) {
      const a = yield* ask(s, ctx, { kind: 'deploy', side, pieces: options.map((p) => p.id), hexes });
      if (a.kind === 'deploy') {
        piece = s.pieces[a.piece];
        hex = a.hex;
      } else auto = true;
    }
    if (!piece) {
      // the engine's pick: the first unit, in the least crowded hex (ties at random, pre-game RNG)
      piece = options[0];
      const ok = hexes.filter((h) => fits(s, piece!, h));
      const least = Math.min(...ok.map((h) => figures(s, h, side)));
      const ties = ok.filter((h) => figures(s, h, side) === least);
      hex = ties[randInt(s, ties.length)];
    }
    put(s, ctx, piece, hex);
  }
  pl.deck = shuffle(s, [...pl.deck, ...pl.discards]);
  pl.discards = [];
  ctx.emit({ kind: 'reshuffle', side });
}

/** The chain rule (S7): once the side has units down, a unit sets up only in a hex it holds or next to one. */
export function setupPlaces(s: GameState, p: Piece, area: HexId[]): HexId[] {
  if (!s.scenario.special.chainSetup?.includes(p.side) || !isUnit(p)) return area;
  const held = new Set<HexId>();
  for (const id in s.pieces) {
    const q = s.pieces[id];
    if (q.side === p.side && q.where === 'map' && isUnit(q)) held.add(q.hex);
  }
  if (!held.size) return area;
  return area.filter((h) => held.has(h) || neighbours(h).some((n) => held.has(n)));
}

/** Counter types `side` places after all other deployment, in its own set-up area (S4 Hidden Gun). */
export function lateSetupTypes(s: GameState, side: Side): string[] {
  return s.scenario.special.lateSetup?.[side] ?? [];
}

/** Those of the late pieces `ids` that go in their side's own set-up area (the others: anywhere without an enemy). */
export function lateInOwnArea(s: GameState, side: Side, ids: string[]): string[] {
  const types = lateSetupTypes(s, side);
  return ids.filter((id) => types.includes(s.pieces[id].type));
}

/** May `side`'s set-up Fortification `kind` go in `hex` (S4 Rubble: in or next to a hex of the named terrain)? */
export function fortHexAllowed(s: GameState, side: Side, kind: FortKind, hex: HexId): boolean {
  const near = s.scenario.special.fortNear?.[side]?.[kind];
  return !near || [hex, ...neighbours(hex)].some((h) => s.map.terrain[h] === near);
}

/** How many of `side`'s set-up Fortifications `kind` are down already (S11: the Bunker set up with its crew). */
export function fortsPlaced(s: GameState, side: Side, kind: FortKind): number {
  const t = s.scenario.special.setupTogether?.[side];
  if (!t || t.fort !== kind) return 0;
  const crew = Object.values(s.pieces).find((p) => p.side === side && p.type === t.units[0] && p.where === 'map');
  return crew && s.fort[crew.hex] === kind ? 1 : 0;
}

/** Take `card` out of `side`'s deck into his hand (it counts toward the opening hand). */
function takeIntoHand(s: GameState, ctx: FlowCtx, side: Side, card: CardId): void {
  const p = s.players[side];
  const i = p.deck.indexOf(card);
  if (i < 0) return;
  p.deck.splice(i, 1);
  p.hand.push(card);
  ctx.emit({ kind: 'draw', side, cards: [card] });
}

/** Before the opening draw: the named starting cards (S3 G-65, S7 R-31), then the Mines option (S9 SSR 7). */
export function* openingCards(s: GameState, ctx: FlowCtx): Gen {
  const sp = s.scenario.special;
  for (const side of SIDES) for (const c of sp.startingCards?.[side] ?? []) takeIntoHand(s, ctx, side, c);
  for (const side of SIDES) {
    const opt = sp.minesForCard?.[side];
    if (!opt) continue;
    const pl = s.players[side];
    const items = [{ label: `Keep ${pl.minefield} FP Mines` }, { label: `${opt.minefield} FP Mines and card ${opt.card} in hand` }];
    const [i] = yield* choose(s, ctx, side, 'scenarioOption', items, 1, 1, { minefield: opt.minefield, card: opt.card });
    if (i !== 1) continue;
    pl.minefield = opt.minefield;
    takeIntoHand(s, ctx, side, opt.card);
    log(ctx, `Mines now ${opt.minefield} FP; card ${opt.card} starts in hand.`, side);
  }
}
