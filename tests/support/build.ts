// The rules-test kit: build a GameState in 'play' from a short description (real counters and real Fate cards from
// src/data, a synthetic map), pick Fate cards by their dice / trigger / names, and drive a flow generator with scripted
// answers. Rules tests never depend on scenario files.
import { answerError, type Gen } from '../../src/engine/decisions';
import { CARDS, deckOf } from '../../src/engine/data';
import { NUM_HEXES, hexsideBetween, parseHex } from '../../src/engine/hex';
import { attachWeapon, counterType, newPiece, newTurn } from '../../src/engine/state';
import { ALL_CHITS } from '../../src/engine/state';
import { SMOKE_MIX } from '../../src/engine/data';
import type {
  ActionName, Answer, CardId, Decision, Edge, EventName, FlowCtx, FortKind, GameEvent, GameState, HexId, HexsideFeature,
  MapDef, Nation, OrderName, PathKind, Posture, Quality, ScenarioDef, Side, SideSetup, SpecialRules, TerrainType, Trigger,
} from '../../src/engine/types';

export type Hex = string | number;
export const H = (h: Hex): HexId => (typeof h === 'number' ? h : parseHex(h));

// ---------------------------------------------------------------------------------------------------------------------
// Maps

export interface MapSpec {
  /** Terrain by hex label; everything else is Open. */
  terrain?: Record<string, TerrainType>;
  elevation?: Record<string, number>;
  crest?: string[];
  /** Hexside features between two adjacent hexes. */
  hexsides?: [string, string, HexsideFeature][];
  /** Path hexes per kind. */
  pathHexes?: Partial<Record<PathKind, string[]>>;
  /** Path crossings between two adjacent hexes. */
  paths?: [string, string, PathKind][];
  /** Objective 1..5 hexes (default A1, B1, C1, D1, E1 — out of the way). */
  objectives?: string[];
  /** Building ids per hex label. */
  building?: Record<string, number>;
}

export function makeMap(spec: MapSpec = {}): MapDef {
  const terrain = Array<TerrainType>(NUM_HEXES).fill('Open');
  for (const [h, t] of Object.entries(spec.terrain ?? {})) terrain[H(h)] = t;
  const elevation = Array<number>(NUM_HEXES).fill(0);
  for (const [h, e] of Object.entries(spec.elevation ?? {})) elevation[H(h)] = e;
  const crest = Array<boolean>(NUM_HEXES).fill(false);
  for (const h of spec.crest ?? []) crest[H(h)] = true;
  const hexsides: Record<number, HexsideFeature> = {};
  for (const [a, b, f] of spec.hexsides ?? []) {
    const k = hexsideBetween(H(a), H(b));
    if (k === null) throw new Error(`${a} and ${b} are not adjacent`);
    hexsides[k] = f;
  }
  const paths: Record<number, PathKind> = {};
  for (const [a, b, f] of spec.paths ?? []) {
    const k = hexsideBetween(H(a), H(b));
    if (k === null) throw new Error(`${a} and ${b} are not adjacent`);
    paths[k] = f;
  }
  const pathHexes: Partial<Record<PathKind, boolean[]>> = {};
  for (const [kind, list] of Object.entries(spec.pathHexes ?? {}) as [PathKind, string[]][]) {
    const arr = Array<boolean>(NUM_HEXES).fill(false);
    for (const h of list) arr[H(h)] = true;
    pathHexes[kind] = arr;
  }
  const building = Array<number>(NUM_HEXES).fill(-1);
  for (const [h, b] of Object.entries(spec.building ?? {})) building[H(h)] = b;
  return {
    id: 'test', terrain, elevation, crest, hexsides, paths, pathHexes,
    objectives: (spec.objectives ?? ['A1', 'B1', 'C1', 'D1', 'E1']).map(H), building,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Fate cards

export interface CardQuery {
  white?: number;
  red?: number;
  sum?: number;
  /** null = no trigger; undefined = any. */
  trigger?: Trigger | null;
  order?: OrderName;
  action?: ActionName;
  event?: EventName;
  fireIsAction?: boolean;
  /** Random Hex label. */
  hex?: string;
}

/** Every card of `nation`'s deck matching `q`, in card-number order. */
export function cardsWhere(nation: Nation, q: CardQuery): CardId[] {
  return deckOf(nation).filter((id) => {
    const c = CARDS[id];
    if (q.white !== undefined && c.white !== q.white) return false;
    if (q.red !== undefined && c.red !== q.red) return false;
    if (q.sum !== undefined && c.white + c.red !== q.sum) return false;
    if (q.trigger !== undefined && c.trigger !== q.trigger) return false;
    if (q.order && c.order !== q.order) return false;
    if (q.action && c.action !== q.action) return false;
    if (q.event && c.event !== q.event) return false;
    if (q.fireIsAction !== undefined && c.fireIsAction !== q.fireIsAction) return false;
    if (q.hex && c.hex !== H(q.hex)) return false;
    return true;
  });
}

/** The first card of `nation` matching `q` that is not in `not` (throws if none). */
export function card(nation: Nation, q: CardQuery, not: CardId[] = []): CardId {
  const id = cardsWhere(nation, q).find((c) => !not.includes(c));
  if (!id) throw new Error(`No ${nation} card matches ${JSON.stringify(q)} (excluding ${not.join(',')})`);
  return id;
}

/**
 * Cards for a sequence of rolls: each entry is a sum (2..12), [white, red], or a query; without a trigger unless the
 * query asks for one. Distinct cards.
 */
export function rolls(nation: Nation, list: (number | [number, number] | CardQuery)[], not: CardId[] = []): CardId[] {
  const out: CardId[] = [];
  for (const x of list) {
    const q: CardQuery = typeof x === 'number' ? { sum: x, trigger: null } : Array.isArray(x) ? { white: x[0], red: x[1], trigger: null } : x;
    out.push(card(nation, q, [...not, ...out]));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// States

export interface PieceSpec {
  /** Counter type id, e.g. "German/Rifle Squad". */
  type: string;
  hex?: Hex;
  /** Default: the side of the counter's nation (German → axis). */
  side?: Side;
  broken?: boolean;
  suppressed?: boolean;
  veteran?: boolean;
  /** A Weapon carried by this unit (type id), optionally broken. */
  weapon?: string | { type: string; broken?: boolean };
  /** Not on the map: e.g. { where: 'time', space: 3 }. */
  where?: 'time' | 'staging' | 'artillery' | 'casualty';
  space?: number;
}

export interface SideSpec {
  nation?: Nation;
  posture?: Posture;
  quality?: Quality;
  orders?: number;
  handSize?: number;
  discard?: number;
  surrender?: number;
  edge?: Edge;
  /** Cards in hand. */
  hand?: CardId[];
  /** Cards on top of the draw pile (top first); the rest of the deck follows, cards without a trigger first. */
  top?: CardId[];
  /** The whole draw pile (top first); overrides `top`. */
  deck?: CardId[];
  discards?: CardId[];
  secretChits?: string[];
  minefield?: number;
}

export interface BuildSpec {
  map?: MapSpec | MapDef;
  axis?: SideSpec;
  allied?: SideSpec;
  pieces?: PieceSpec[];
  active?: Side;
  initiative?: Side;
  time?: number;
  suddenDeath?: number;
  vp?: number;
  year?: number;
  control?: (Side | null)[];
  openChits?: string[];
  fort?: Record<string, FortKind>;
  smoke?: Record<string, number>;
  special?: SpecialRules;
  seed?: number;
}

const NATION_SIDE: Record<Nation, Side> = { German: 'axis', American: 'allied', Russian: 'allied' };
const HAND: Record<Posture, number> = { attack: 6, recon: 5, defend: 4 };
const DISCARD: Record<Nation, number> = { German: 6, American: 5, Russian: 3 };

/** A ScenarioDef for tests (no forces; `build` places pieces itself). */
export function testScenario(spec: BuildSpec = {}): ScenarioDef {
  const sideSetup = (side: Side): SideSetup => {
    const x = spec[side] ?? {};
    const nation = x.nation ?? (side === 'axis' ? 'German' : 'American');
    const posture = x.posture ?? 'recon';
    return {
      nation, posture, quality: x.quality ?? 'line', orders: x.orders ?? 3, handSize: x.handSize ?? HAND[posture],
      discard: x.discard ?? DISCARD[nation], surrender: x.surrender ?? 6, edge: x.edge ?? (side === 'axis' ? 'bottom' : 'top'),
      forces: {}, fortifications: {}, reinforcements: {}, setupArea: { kind: 'depth', depth: 3 }, secretChits: [],
      minefield: x.minefield,
    };
  };
  return {
    id: 'test', name: 'Test', map: 'test', year: spec.year ?? 1944,
    sides: { axis: sideSetup('axis'), allied: sideSetup('allied') },
    initiative: spec.initiative ?? 'axis', firstTurn: spec.active ?? 'axis', setupFirst: 'allied',
    time: spec.time ?? 0, suddenDeath: spec.suddenDeath ?? 10, vp: spec.vp ?? 0,
    control: spec.control ?? [null, null, null, null, null], openChits: [], prePlaced: [], special: spec.special ?? {},
  };
}

/** A GameState in 'play' as described. Pieces get ids p0, p1, ... in the order given (a Weapon right after its unit). */
export function build(spec: BuildSpec = {}): GameState {
  const scenario = testScenario(spec);
  const map = spec.map && 'terrain' in spec.map && Array.isArray(spec.map.terrain) ? (spec.map as MapDef) : makeMap(spec.map as MapSpec | undefined);
  const player = (side: Side) => {
    const def = scenario.sides[side];
    const x = spec[side] ?? {};
    const hand = x.hand ?? [];
    const discards = x.discards ?? [];
    let deck: CardId[];
    if (x.deck) deck = x.deck.slice();
    else {
      const top = x.top ?? [];
      const used = new Set([...hand, ...top, ...discards]);
      const rest = deckOf(def.nation).filter((c) => !used.has(c));
      const quiet = rest.filter((c) => !CARDS[c].trigger);
      const loud = rest.filter((c) => CARDS[c].trigger);
      deck = [...top, ...quiet, ...loud];
    }
    return {
      side, nation: def.nation, posture: def.posture, quality: def.quality, orders: def.orders, handSize: def.handSize,
      discard: def.discard, surrender: def.surrender, edge: def.edge, hand: hand.slice(), deck, discards: discards.slice(),
      casualties: [], secretChits: (x.secretChits ?? []).slice(), minefield: def.minefield ?? 6,
    };
  };
  const fort = Array<FortKind | null>(NUM_HEXES).fill(null);
  for (const [h, k] of Object.entries(spec.fort ?? {})) fort[H(h)] = k;
  const smoke = Array<number>(NUM_HEXES).fill(0);
  for (const [h, v] of Object.entries(spec.smoke ?? {})) smoke[H(h)] = v;
  const openChits = spec.openChits ?? [];
  const secret = new Set([...(spec.axis?.secretChits ?? []), ...(spec.allied?.secretChits ?? []), ...openChits]);
  const s: GameState = {
    scenario, map, rng: spec.seed ?? 12345, rngCalls: 0,
    players: { axis: player('axis'), allied: player('allied') },
    pieces: {}, fort, smoke, blaze: Array<boolean>(NUM_HEXES).fill(false), spottingRound: -1,
    control: scenario.control.slice(), openChits: openChits.slice(), chitCup: ALL_CHITS.filter((c) => !secret.has(c)),
    smokeCup: [...SMOKE_MIX], vp: scenario.vp, time: scenario.time, suddenDeath: scenario.suddenDeath, year: scenario.year,
    initiative: scenario.initiative, active: scenario.firstTurn, turn: newTurn(1), lastRoll: null, winner: null,
    endReason: null, phase: 'play',
  };
  for (const ps of spec.pieces ?? []) {
    const t = counterType(ps.type);
    const side = ps.side ?? NATION_SIDE[t.nation];
    const p = newPiece(s, ps.type, side, ps.where ?? (ps.hex !== undefined ? 'map' : 'staging'));
    if (ps.hex !== undefined) p.hex = H(ps.hex);
    if (ps.space !== undefined) p.space = ps.space;
    p.broken = !!ps.broken;
    p.suppressed = !!ps.suppressed;
    p.veteran = !!ps.veteran;
    if (p.where === 'casualty') s.players[side].casualties.push(p.id);
    if (ps.weapon) {
      const w = typeof ps.weapon === 'string' ? { type: ps.weapon } : ps.weapon;
      const wp = newPiece(s, w.type, side, 'carried');
      wp.broken = !!w.broken;
      attachWeapon(s, wp, p);
    }
  }
  return s;
}

/** The pieces of `s` of counter type `type` (name or full id), in id order. */
export function piecesOf(s: GameState, type: string) {
  return Object.values(s.pieces).filter((p) => p.type === type || p.type.endsWith(`/${type}`));
}

// ---------------------------------------------------------------------------------------------------------------------
// Driving a flow

export type Responder = (d: Decision, s: GameState) => Answer | undefined;

export interface RunResult<T> {
  events: GameEvent[];
  /** Every decision asked, in order. */
  decisions: Decision[];
  /** The decision the run stopped at (the responder gave no answer), or null when the generator finished. */
  pending: Decision | null;
  result: T | undefined;
  /** Refusals reported by the flow (should stay empty: every answer is checked first). */
  invalid: string[];
}

export function makeCtx(events: GameEvent[], invalid: string[] = []): FlowCtx {
  return { emit: (e) => events.push(e), invalid: (m) => invalid.push(m) };
}

/**
 * Run `make(ctx)` on `s`, answering each decision with `respond`. Every answer is checked with answerError first (a
 * refused one throws, so a test cannot pass by accident). Stops when the responder returns undefined.
 */
export function run<T>(s: GameState, make: (ctx: FlowCtx) => Gen<T>, respond: Responder, maxSteps = 5000): RunResult<T> {
  const events: GameEvent[] = [];
  const invalid: string[] = [];
  const ctx = makeCtx(events, invalid);
  const gen = make(ctx);
  const decisions: Decision[] = [];
  let r = gen.next();
  for (let i = 0; !r.done; i++) {
    if (i > maxSteps) throw new Error('run: too many decisions');
    const d = r.value;
    decisions.push(d);
    const a = respond(d, s);
    if (!a) return { events, decisions, pending: d, result: undefined, invalid };
    const err = answerError(s, d, a);
    if (err) throw new Error(`Refused answer ${JSON.stringify(a)} to ${d.kind}: ${err}`);
    r = gen.next(a);
  }
  return { events, decisions, pending: null, result: r.value, invalid };
}

/** Answers that never act: no re-roll, pass every reaction, the fewest choices, end every Order step. */
export const passive: Responder = (d) => {
  switch (d.kind) {
    case 'reroll':
      return { kind: 'reroll', yes: false };
    case 'react':
      return { kind: 'done' };
    case 'choose':
      return { kind: 'choose', items: Array.from({ length: d.min }, (_, i) => i) };
    case 'deploy':
      return { kind: 'done' };
    default:
      return undefined;
  }
};

const FITS: Record<Decision['kind'], Answer['kind'][]> = {
  turn: ['order', 'pass', 'endTurn'],
  activate: ['activate', 'activatePlayer'],
  fire: ['fire', 'done'],
  move: ['moveStep', 'exit', 'transfer', 'done', 'play'],
  advance: ['advanceTo', 'done'],
  react: ['play'],
  reroll: ['reroll'],
  choose: ['choose'],
  deploy: ['deploy', 'done'],
};

/**
 * A responder that gives `answers` in order to the decisions they fit; re-roll and reaction decisions that the next
 * answer does not fit are answered passively (no re-roll, pass). Any other mismatch, or running out, stops the run.
 */
export function script(answers: Answer[], fallback: Responder = passive): Responder {
  const queue = answers.slice();
  return (d, s) => {
    const next = queue[0];
    if (next && FITS[d.kind]?.includes(next.kind)) return queue.shift();
    if (d.kind === 'reroll' || d.kind === 'react') return fallback(d, s);
    if (!next) return fallback(d, s);
    return undefined;
  };
}

/** Re-roll and reaction decisions answered passively; anything else is left for the test to answer. */
export const autoPass: Responder = (d) => {
  if (d.kind === 'reroll') return { kind: 'reroll', yes: false };
  if (d.kind === 'react') return { kind: 'done' };
  return undefined;
};

export interface Stepper {
  s: GameState;
  events: GameEvent[];
  /** Every decision asked so far (including the auto-answered ones). */
  decisions: Decision[];
  /** The decision waiting for the test, or null when the flow finished. */
  readonly pending: Decision | null;
  /** Answer the pending decision (checked with answerError first; a refusal throws), then run on to the next one. */
  answer(a: Answer): Stepper;
}

/** Start `make(ctx)` on `s` and run it until a decision `auto` does not answer (default: `autoPass`). */
export function start(s: GameState, make: (ctx: FlowCtx) => Gen<unknown>, auto: Responder = autoPass): Stepper {
  const events: GameEvent[] = [];
  const decisions: Decision[] = [];
  const gen = make(makeCtx(events));
  let r = gen.next();
  const give = (a: Answer) => {
    const d = r.value as Decision;
    const err = answerError(s, d, a);
    if (err) throw new Error(`Refused answer ${JSON.stringify(a)} to ${d.kind}: ${err}`);
    r = gen.next(a);
  };
  const advance = () => {
    while (!r.done) {
      const d = r.value;
      decisions.push(d);
      const a = auto(d, s);
      if (!a) return;
      give(a);
    }
  };
  const self: Stepper = {
    s, events, decisions,
    get pending() {
      return r.done ? null : r.value;
    },
    answer(a) {
      if (r.done) throw new Error('The flow has finished.');
      give(a);
      advance();
      return self;
    },
  };
  advance();
  return self;
}
