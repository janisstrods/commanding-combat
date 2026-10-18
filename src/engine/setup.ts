// The set-up before the first Turn (scenarios-reference §2, rules-reference Part H): Objective chits, deployment of
// each side in its set-up area (the side named first deploys first; stacking applies), its Fortifications, late
// placements, the opening hands, the scenario-1 Initiative choice. Deployment asks one piece at a time ('deploy');
// answering 'done' lets the engine place the rest of that side (spread out, seeded RNG: pre-game, R-39).
import { areaHexes } from './data';
import { drawCards } from './deck';
import { ask, choose, type Gen } from './decisions';
import { drawChit, openChit, updateControl } from './objectives';
import { randInt } from './rng';
import { fortHexAllowed, fortsPlaced, lateInOwnArea, lateSetupTypes, openingCards, scenarioDeploy, setupPlaces, setupStart } from './scenario/setup';
import { figures, stackLimit, unitFigures } from './stats';
import {
  attachWeapon, canHoldFort, hasUnitOf, isImpassableHex, isUnit, isWeapon, newTurn, placeFort, typeOf,
} from './state';
import { type FlowCtx, type FortKind, type GameState, type HexId, type Nation, type Piece, type Posture, type Side, SIDES, other } from './types';

/** Hand size by posture (§1.1). */
export const HAND_SIZE: Readonly<Record<Posture, number>> = { attack: 6, recon: 5, defend: 4 };
/** Discard Capability by nation (§5.3). */
export const DISCARD_CAPABILITY: Readonly<Record<Nation, number>> = { German: 6, American: 5, Russian: 3 };

/** The hexes where `side` may set up: its set-up area, without impassable hexes ('anyFree': without enemy units). */
export function setupHexes(s: GameState, side: Side): HexId[] {
  const def = s.scenario.sides[side];
  const area = areaHexes(def.setupArea, def.edge);
  return area.filter((h) => !isImpassableHex(s, h) && (def.setupArea.kind !== 'anyFree' || !hasUnitOf(s, h, other(side))));
}

/** The whole set-up; leaves the game in phase 'play' with the first Turn's player active. */
export function* setupFlow(s: GameState, ctx: FlowCtx): Gen {
  placeChits(s, ctx);
  attachCarried(s);
  setupStart(s, ctx);
  const first = s.scenario.setupFirst;
  const late = latePieces(s);
  const fortsLast = !!s.scenario.special.fortificationsLast;
  for (const side of [first, other(first)]) {
    yield* scenarioDeploy(s, ctx, side);
    yield* deploySide(s, ctx, side, setupHexes(s, side), late);
    if (!fortsLast) yield* placeFortifications(s, ctx, side);
  }
  for (const side of [first, other(first)]) {
    const mine = [...late].filter((id) => s.pieces[id].side === side);
    if (!mine.length) continue;
    const free = s.map.terrain.map((_, h) => h).filter((h) => !isImpassableHex(s, h) && !hasUnitOf(s, h, other(side)));
    const own = lateInOwnArea(s, side, mine);
    if (own.length) yield* deploySide(s, ctx, side, setupHexes(s, side), new Set(), own);
    yield* deploySide(s, ctx, side, free, new Set(), mine.filter((id) => !own.includes(id)));
  }
  // RS.12: Fortifications after both sides' units are down
  if (fortsLast) for (const side of [first, other(first)]) yield* placeFortifications(s, ctx, side);
  // RS.11.2 / RS.13: Objectives held by one side alone after set-up pass to it
  if (s.scenario.special.controlAfterSetup) updateControl(s, ctx);
  yield* openingCards(s, ctx);
  for (const side of SIDES) yield* drawCards(s, ctx, side, s.players[side].handSize - s.players[side].hand.length);
  if (s.scenario.special.initiativeChoice) {
    const holder = s.initiative;
    const [i] = yield* choose(s, ctx, holder, 'initiativeChoice', [{ label: 'keep' }, { label: 'give' }], 1, 1);
    if (i === 0) s.active = other(holder);
    else {
      s.initiative = other(holder);
      s.active = holder;
      ctx.emit({ kind: 'initiative', side: s.initiative });
    }
  } else s.active = s.scenario.firstTurn;
  s.turn = newTurn(1);
  s.phase = 'play';
}

/** Pieces that start together (RS.7, §11.2): each named unit in staging takes up its named Weapon before deployment. */
function attachCarried(s: GameState): void {
  const carried = s.scenario.special.carried;
  if (!carried) return;
  for (const side of SIDES) {
    for (const { unit, weapon } of carried[side] ?? []) {
      const staged = Object.values(s.pieces).filter((p) => p.side === side && p.where === 'staging');
      const u = staged.find((p) => p.type === unit && !p.weapon);
      const w = staged.find((p) => p.type === weapon && !p.carrier);
      if (u && w) attachWeapon(s, w, u);
    }
  }
}

/** Objective chits (HS.3.6): named open chits, random open chits (scored for the starting control), secret chits. */
function placeChits(s: GameState, ctx: FlowCtx): void {
  const scn = s.scenario;
  const named = [...scn.openChits, ...scn.sides.axis.secretChits, ...scn.sides.allied.secretChits].filter((c) => c !== 'random');
  s.chitCup = s.chitCup.filter((c) => !named.includes(c));
  for (const c of scn.openChits) {
    if (c === 'random') {
      const d = s.chitCup.shift();
      if (d) openChit(s, ctx, d);
    } else {
      s.openChits.push(c); // already counted in the scenario's starting VP
      ctx.emit({ kind: 'chit', chit: c, side: null, open: true });
    }
  }
  for (const side of SIDES) {
    for (const c of scn.sides[side].secretChits) {
      if (c === 'random') drawChit(s, ctx, side, false);
      else s.players[side].secretChits.push(c);
    }
  }
}

/** The staged pieces placed after all other deployment (special rule `latePlacement`): one per listed type. */
function latePieces(s: GameState): Set<string> {
  const out = new Set<string>();
  const lp = s.scenario.special.latePlacement ?? {};
  for (const side of SIDES) {
    for (const type of [...(lp[side] ?? []), ...lateSetupTypes(s, side)]) {
      const p = Object.values(s.pieces).find((x) => x.side === side && x.where === 'staging' && x.type === type && !out.has(x.id));
      if (p) out.add(p.id);
    }
  }
  return out;
}

/** Hexes of `area` where staged piece `p` may go now. */
function placesFor(s: GameState, p: Piece, area: HexId[]): HexId[] {
  area = setupPlaces(s, p, area);
  if (isWeapon(p)) return area.filter((h) => unitsHere(s, h, p.side).some((u) => !u.weapon));
  const f = unitFigures(p);
  return area.filter((h) => figures(s, h, p.side) + f <= stackLimit(s, h));
}

function unitsHere(s: GameState, h: HexId, side: Side): Piece[] {
  const out: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.hex === h && p.side === side && isUnit(p)) out.push(p);
  }
  return out;
}

/** Deploy `side`'s staged pieces (except `skip`, or only `only`) in `area`, one decision per piece until 'done'. */
function* deploySide(s: GameState, ctx: FlowCtx, side: Side, area: HexId[], skip: Set<string>, only?: string[]): Gen {
  const staged = () =>
    Object.values(s.pieces).filter((p) => p.side === side && p.where === 'staging' && !skip.has(p.id) && (!only || only.includes(p.id)));
  let auto = false;
  for (;;) {
    const left = staged();
    if (!left.length) return;
    const options = left.map((p) => ({ p, hexes: placesFor(s, p, area) })).filter((o) => o.hexes.length);
    if (!options.length) {
      for (const p of left) ctx.emit({ kind: 'log', text: `No room to set up ${p.type}.`, side });
      return;
    }
    // units before Weapons when the engine places them, so every Weapon finds a carrier
    if (auto) {
      const o = options.find((x) => !isWeapon(x.p)) ?? options[0];
      place(s, ctx, o.p, autoHex(s, o.p, o.hexes));
      continue;
    }
    const hexes = [...new Set(options.flatMap((o) => o.hexes))].sort((a, b) => a - b);
    const a = yield* ask(s, ctx, { kind: 'deploy', side, pieces: options.map((o) => o.p.id), hexes });
    if (a.kind === 'done') {
      auto = true;
      continue;
    }
    if (a.kind !== 'deploy') continue;
    const p = s.pieces[a.piece];
    place(s, ctx, p, a.hex, a.carrier);
  }
}

/** The engine's choice of hex: the one with the fewest friendly figures (a Weapon: a unit without one), ties at random. */
function autoHex(s: GameState, p: Piece, hexes: HexId[]): HexId {
  const score = (h: HexId) => figures(s, h, p.side);
  const best = Math.min(...hexes.map(score));
  const ties = hexes.filter((h) => score(h) === best);
  return ties[randInt(s, ties.length)];
}

function place(s: GameState, ctx: FlowCtx, p: Piece, hex: HexId, carrier?: string): void {
  if (isWeapon(p)) {
    const rank: Record<string, number> = { squad: 0, team: 1, leader: 2 };
    const units = unitsHere(s, hex, p.side).filter((u) => !u.weapon).sort((a, b) => rank[typeOf(a).kind] - rank[typeOf(b).kind]);
    const u = (carrier && units.find((x) => x.id === carrier)) || units[0];
    attachWeapon(s, p, u);
    ctx.emit({ kind: 'place', piece: p.id, hex });
    return;
  }
  p.where = 'map';
  p.hex = hex;
  ctx.emit({ kind: 'place', piece: p.id, hex });
}

/** `side`'s set-up Fortifications, each in a hex of its set-up area that may hold one. */
function* placeFortifications(s: GameState, ctx: FlowCtx, side: Side): Gen {
  const forts = s.scenario.sides[side].fortifications;
  for (const [kind, n] of Object.entries(forts) as [FortKind, number][]) {
    for (let i = fortsPlaced(s, side, kind); i < n; i++) {
      const hexes = setupHexes(s, side).filter((h) => canHoldFort(s, h) && fortHexAllowed(s, side, kind, h));
      if (!hexes.length) break;
      const [j] = yield* choose(s, ctx, side, 'placement', hexes.map((hex) => ({ hex })), 1, 1, { fort: kind });
      placeFort(s, ctx, hexes[j], kind);
    }
  }
}
