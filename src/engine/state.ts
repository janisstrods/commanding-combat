// The game state: the card and counter catalogue, piece queries, a new game from a scenario, cheap cloning, the redacted
// view the AI gets, and the GameOver signal that ends a game from deep inside the flow. Rules live in the modules above
// this one (stats, deck, casualties, objectives, fire, flow ...).
import { CARDS, COUNTERS, OBJECTIVE_CHITS, SMOKE_MIX, deckOf, loadMap } from './data';
import { NUM_HEXES } from './hex';
import { shuffle } from './rng';
import {
  type CardId,
  type ChitId,
  type CounterType,
  type EndReason,
  type FateCard,
  type FlowCtx,
  type FortKind,
  type GameState,
  type HexId,
  type MapDef,
  type Piece,
  type PieceId,
  type PlayerState,
  type ScenarioDef,
  type Side,
  type TurnState,
  type Where,
  SIDES,
  UNKNOWN_CARD,
  UNKNOWN_CHIT,
  other,
} from './types';

// ---------------------------------------------------------------------------------------------------------------------
// Game end

/**
 * Thrown anywhere in the flow when the game ends (surrender, annihilation, the last unit exiting, Sudden Death, chit V).
 * flow.ts `gameFlow` catches it, records the result and finishes the generator.
 */
export class GameOver extends Error {
  readonly isGameOver = true;
  constructor(
    readonly winner: Side,
    readonly reason: EndReason,
  ) {
    super(`Game over: ${winner} wins (${reason})`);
  }
}

export function isGameOver(e: unknown): e is GameOver {
  return !!e && typeof e === 'object' && (e as { isGameOver?: boolean }).isGameOver === true;
}

/** Record the end of the game in `s` and announce it. */
export function endGame(s: GameState, ctx: FlowCtx, e: GameOver): void {
  s.winner = e.winner;
  s.endReason = e.reason;
  s.phase = 'over';
  ctx.emit({ kind: 'gameOver', winner: e.winner, reason: e.reason });
}

// ---------------------------------------------------------------------------------------------------------------------
// Catalogue: Fate cards and counter types (data.ts), plus extra ones that tests and tools may register

const extraCards: Record<CardId, FateCard> = {};
const extraCounters: Record<string, CounterType> = {};

/** The Fate card `id` (throws on an unknown id, e.g. UNKNOWN_CARD). */
export function cardOf(id: CardId): FateCard {
  const c = CARDS[id] ?? extraCards[id];
  if (!c) throw new Error(`Unknown Fate card ${id}`);
  return c;
}

/** The counter type `id` ("German/Rifle Squad"). */
export function counterType(id: string): CounterType {
  const c = COUNTERS[id] ?? extraCounters[id];
  if (!c) throw new Error(`Unknown counter type ${id}`);
  return c;
}

/** The counter type of piece `p`. */
export function typeOf(p: Piece): CounterType {
  return COUNTERS[p.type] ?? counterType(p.type);
}

/** Add a card or counter type that is not in the game data (tests, tools). */
export function registerCard(c: FateCard): void {
  extraCards[c.id] = c;
}
export function registerCounterType(c: CounterType): void {
  extraCounters[c.id] = c;
}

/** All Objective chit ids A..X. */
export const ALL_CHITS: readonly ChitId[] = Object.keys(OBJECTIVE_CHITS).sort();

// ---------------------------------------------------------------------------------------------------------------------
// Piece queries

export function isUnit(p: Piece): boolean {
  const k = typeOf(p).kind;
  return k === 'squad' || k === 'team' || k === 'leader';
}
export function isLeader(p: Piece): boolean {
  return typeOf(p).kind === 'leader';
}
export function isWeapon(p: Piece): boolean {
  return typeOf(p).kind === 'weapon';
}

/** Units on the map in `hex` (both sides, or one). */
export function unitsIn(s: GameState, hex: HexId, side?: Side): Piece[] {
  const out: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.hex === hex && (!side || p.side === side) && isUnit(p)) out.push(p);
  }
  return out;
}

/** `side`'s units in `where` (default: on the map). */
export function unitsOf(s: GameState, side: Side, where: Where = 'map'): Piece[] {
  const out: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && p.where === where && isUnit(p)) out.push(p);
  }
  return out;
}

/** Does `hex` hold a unit of `side`? */
export function hasUnitOf(s: GameState, hex: HexId, side: Side): boolean {
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.hex === hex && p.side === side && isUnit(p)) return true;
  }
  return false;
}

/** The Weapon a unit carries, or null. */
export function weaponOf(s: GameState, unit: Piece): Piece | null {
  return unit.weapon ? s.pieces[unit.weapon] ?? null : null;
}

/** Where a piece is on the map: its hex, or its carrier's hex for a carried Weapon; -1 when off the map. */
export function hexOf(s: GameState, p: Piece): HexId {
  if (p.where === 'map') return p.hex;
  if (p.where === 'carried' && p.carrier) {
    const c = s.pieces[p.carrier];
    return c && c.where === 'map' ? c.hex : -1;
  }
  return -1;
}

/** The side's Radio in its Artillery Box, or null. */
export function radioOf(s: GameState, side: Side): Piece | null {
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && p.where === 'artillery') return p;
  }
  return null;
}

/** Hexes holding units of both sides (a melee is due, §O16.4), ascending. */
export function mixedHexes(s: GameState): HexId[] {
  const seen: Record<number, number> = {};
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where !== 'map' || !isUnit(p)) continue;
    seen[p.hex] = (seen[p.hex] ?? 0) | (p.side === 'axis' ? 1 : 2);
  }
  const out: HexId[] = [];
  for (const h in seen) if (seen[h] === 3) out.push(Number(h));
  return out.sort((a, b) => a - b);
}

/** Create a piece of counter type `type` for `side` in `where` (default: staging) and add it to the game. */
export function newPiece(s: GameState, type: string, side: Side, where: Where = 'staging'): Piece {
  counterType(type); // fail early on a bad id
  let n = Object.keys(s.pieces).length;
  while (s.pieces[`p${n}`]) n++;
  const p: Piece = {
    id: `p${n}`, type, side, where, hex: -1, space: -1, broken: false, suppressed: false, veteran: false, weapon: null, carrier: null,
  };
  s.pieces[p.id] = p;
  return p;
}

/** Put Weapon `w` in the hands of `unit` (which must have none). */
export function attachWeapon(s: GameState, w: Piece, unit: Piece): void {
  if (w.carrier && s.pieces[w.carrier]) s.pieces[w.carrier].weapon = null;
  unit.weapon = w.id;
  w.carrier = unit.id;
  w.where = 'carried';
  w.hex = -1;
  w.space = -1;
}

/** Put a unit (and its Weapon) on the map in `hex` without any rules effects (setup, tests). */
export function putOnMap(s: GameState, p: Piece, hex: HexId): void {
  p.where = 'map';
  p.hex = hex;
  p.space = -1;
}

// ---------------------------------------------------------------------------------------------------------------------
// Map facts the core needs (the terrain chart itself is terrain.ts)

const WATER = new Set(['Water', 'Stream', 'Marsh']);

/** Water Barrier, Stream and Marsh hexes (no Smoke, Blaze or Fortification; no Weapon fires from Stream / Marsh). */
export function isWater(map: MapDef, hex: HexId): boolean {
  return WATER.has(map.terrain[hex]);
}

/** A hex no unit may be in: Water Barrier or Blaze. */
export function isImpassableHex(s: GameState, hex: HexId): boolean {
  return s.map.terrain[hex] === 'Water' || s.blaze[hex];
}

// ---------------------------------------------------------------------------------------------------------------------
// Markers

/** Draw a random Smoke marker from the cup (null if it is empty). The cup is kept shuffled, so this takes the top one. */
export function drawSmoke(s: GameState): number | null {
  return s.smokeCup.length ? s.smokeCup.shift()! : null;
}

/** Return a Smoke marker to the cup (reshuffling it). */
export function returnSmoke(s: GameState, value: number): void {
  s.smokeCup.push(value);
  shuffle(s, s.smokeCup);
}

/**
 * Place Smoke of `value` in `hex` (§8.1): never in Water or Blaze; a second Smoke keeps the larger (ties keep the one
 * present, R-42); the marker not kept goes back to the cup. Returns whether `value` was placed.
 */
export function placeSmoke(s: GameState, ctx: FlowCtx, hex: HexId, value: number): boolean {
  if (isWater(s.map, hex) || s.blaze[hex] || value <= s.smoke[hex]) {
    returnSmoke(s, value);
    return false;
  }
  if (s.smoke[hex]) returnSmoke(s, s.smoke[hex]);
  s.smoke[hex] = value;
  ctx.emit({ kind: 'place', hex, marker: 'smoke', value });
  return true;
}

export function removeSmoke(s: GameState, ctx: FlowCtx, hex: HexId): void {
  if (!s.smoke[hex]) return;
  returnSmoke(s, s.smoke[hex]);
  s.smoke[hex] = 0;
  ctx.emit({ kind: 'remove', hex, marker: 'smoke' });
}

/** May a Fortification be placed in `hex` (one per hex, never in Water or Blaze, §F100)? */
export function canHoldFort(s: GameState, hex: HexId): boolean {
  return s.fort[hex] === null && !isWater(s.map, hex) && !s.blaze[hex];
}

/** Place a Fortification if the hex may hold it; returns whether it was placed. */
export function placeFort(s: GameState, ctx: FlowCtx, hex: HexId, kind: FortKind): boolean {
  if (!canHoldFort(s, hex)) return false;
  s.fort[hex] = kind;
  ctx.emit({ kind: 'place', hex, marker: kind });
  return true;
}

export function removeFort(s: GameState, ctx: FlowCtx, hex: HexId): void {
  const k = s.fort[hex];
  if (!k) return;
  s.fort[hex] = null;
  ctx.emit({ kind: 'remove', hex, marker: k });
}

// ---------------------------------------------------------------------------------------------------------------------
// A new game

export function newTurn(number: number): TurnState {
  return { number, ordersGiven: 0, activated: [], playerActivations: [], moving: [], opFire: [], passDiscards: null, fired: [], move: null };
}

/**
 * A new game of scenario `scn` in phase 'setup': forces in staging (Radios in the Artillery Box, reinforcements on the
 * Time Track), Fate decks shuffled (hands are dealt after deployment, setup.ts), cups shuffled. `map` is the scenario's
 * map (default: data.ts loadMap of the scenario's map).
 */
export function newGame(scn: ScenarioDef, seed: number, map: MapDef = loadMap(scn.map)): GameState {
  const player = (side: Side): PlayerState => {
    const p = scn.sides[side];
    return {
      side, nation: p.nation, posture: p.posture, quality: p.quality, orders: p.orders, handSize: p.handSize, discard: p.discard,
      surrender: p.surrender, edge: p.edge, hand: [], deck: deckOf(p.nation), discards: [], casualties: [], secretChits: [],
      minefield: p.minefield ?? 6,
    };
  };
  const excluded = new Set(scn.special.excludeChits ?? []);
  const s: GameState = {
    scenario: scn,
    map,
    rng: seed >>> 0,
    rngCalls: 0,
    players: { axis: player('axis'), allied: player('allied') },
    pieces: {},
    fort: Array<FortKind | null>(NUM_HEXES).fill(null),
    smoke: Array<number>(NUM_HEXES).fill(0),
    blaze: Array<boolean>(NUM_HEXES).fill(false),
    spottingRound: -1,
    control: scn.control.slice(),
    openChits: [],
    chitCup: ALL_CHITS.filter((c) => !excluded.has(c)),
    smokeCup: [...SMOKE_MIX],
    vp: scn.vp,
    time: scn.time,
    suddenDeath: scn.suddenDeath,
    year: scn.year,
    initiative: scn.initiative,
    active: scn.firstTurn,
    turn: newTurn(1),
    lastRoll: null,
    winner: null,
    endReason: null,
    phase: 'setup',
  };
  for (const side of SIDES) {
    shuffle(s, s.players[side].deck);
    const def = scn.sides[side];
    for (const [type, n] of Object.entries(def.forces)) {
      for (let i = 0; i < n; i++) newPiece(s, type, side, counterType(type).kind === 'radio' ? 'artillery' : 'staging');
    }
    for (const [space, list] of Object.entries(def.reinforcements)) {
      const here: Piece[] = [];
      for (const [type, n] of Object.entries(list)) {
        for (let i = 0; i < n; i++) {
          const p = newPiece(s, type, side, 'time');
          p.space = Number(space);
          here.push(p);
        }
      }
      autoArm(s, here);
    }
  }
  for (const { hex, fort } of scn.prePlaced) s.fort[hex] = fort;
  shuffle(s, s.chitCup);
  shuffle(s, s.smokeCup);
  return s;
}

/** Give the Weapons among `pieces` to units among them without one (Squads first, then Teams, then Leaders). */
export function autoArm(s: GameState, pieces: Piece[]): void {
  const rank = { squad: 0, team: 1, leader: 2 } as Record<string, number>;
  const units = pieces.filter((p) => isUnit(p)).sort((a, b) => rank[typeOf(a).kind] - rank[typeOf(b).kind]);
  for (const w of pieces.filter((p) => isWeapon(p) && !p.carrier)) {
    const u = units.find((x) => !x.weapon);
    if (!u) break;
    attachWeapon(s, w, u);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Cloning and redaction

function clonePlayer(p: PlayerState): PlayerState {
  return {
    ...p, hand: p.hand.slice(), deck: p.deck.slice(), discards: p.discards.slice(), casualties: p.casualties.slice(),
    secretChits: p.secretChits.slice(),
  };
}

/** A copy of `s` that shares only what never changes (scenario, map). Cheap: the AI calls it thousands of times. */
export function cloneState(s: GameState): GameState {
  const pieces: Record<PieceId, Piece> = {};
  for (const id in s.pieces) pieces[id] = { ...s.pieces[id] };
  const t = s.turn;
  const m = t.move;
  const out: GameState = {
    ...s,
    players: { axis: clonePlayer(s.players.axis), allied: clonePlayer(s.players.allied) },
    pieces,
    fort: s.fort.slice(),
    smoke: s.smoke.slice(),
    blaze: s.blaze.slice(),
    control: s.control.slice(),
    openChits: s.openChits.slice(),
    chitCup: s.chitCup.slice(),
    smokeCup: s.smokeCup.slice(),
    turn: {
      ...t, activated: t.activated.slice(), playerActivations: t.playerActivations.slice(), moving: t.moving.slice(),
      opFire: t.opFire.slice(), fired: t.fired.slice(),
      move: m ? { spent: { ...m.spent }, road: m.road.slice(), done: m.done.slice(), group: m.group ? m.group.slice() : null, entered: m.entered } : null,
    },
    lastRoll: s.lastRoll ? { ...s.lastRoll } : null,
  };
  if (s.unseen) out.unseen = { cards: { axis: s.unseen.cards.axis.slice(), allied: s.unseen.cards.allied.slice() }, chits: s.unseen.chits.slice() };
  return out;
}

/**
 * The game as `viewer` may see it (the AI only ever gets this): the opponent's hand, both draw piles, the chit cup and
 * the opponent's secret chits become unknowns (counts kept), their contents listed in `unseen` as sorted pools; the
 * smoke cup is sorted; the RNG state is blanked (it would predict reshuffles). In a simultaneous hidden set-up the
 * opponent's deployed pieces are shown as still in staging.
 */
export function redact(s: GameState, viewer: Side): GameState {
  const r = cloneState(s);
  const opp = other(viewer);
  const mine = r.players[viewer];
  const theirs = r.players[opp];
  const sorted = <T>(a: T[]) => a.slice().sort();
  r.unseen = {
    cards: {
      [viewer]: sorted(mine.deck),
      [opp]: sorted([...theirs.deck, ...theirs.hand]),
    } as Record<Side, CardId[]>,
    chits: sorted([...r.chitCup, ...theirs.secretChits]),
  };
  mine.deck = mine.deck.map(() => UNKNOWN_CARD);
  theirs.deck = theirs.deck.map(() => UNKNOWN_CARD);
  theirs.hand = theirs.hand.map(() => UNKNOWN_CARD);
  theirs.secretChits = theirs.secretChits.map(() => UNKNOWN_CHIT);
  r.chitCup = r.chitCup.map(() => UNKNOWN_CHIT);
  r.smokeCup.sort((a, b) => a - b);
  r.rng = 0;
  if (r.phase === 'setup' && r.scenario.special.simultaneousSetup) {
    for (const id in r.pieces) {
      const p = r.pieces[id];
      if (p.side !== opp) continue;
      if (p.where === 'map') {
        p.where = 'staging';
        p.hex = -1;
      }
    }
  }
  return r;
}
