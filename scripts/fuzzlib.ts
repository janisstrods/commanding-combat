// The fuzzer's core (scripts/fuzz.ts is the command line; tests/engine/fuzz.test.ts the fast smoke run): one game of
// random legal answers on a historical scenario or a random RSG one, optionally with tiny Fate decks (so Time advances
// and reshuffles happen inside triggers, Events, refills and melees), checking after every answer that the answer was
// legal and accepted and that the state is consistent, and at the end that replaying the answers gives the same state.
import { SCENARIOS, scenario } from '../src/engine/data';
import { answerError } from '../src/engine/decisions';
import { GameDriver } from '../src/engine/driver';
import { fortMixCount, mixCount } from '../src/engine/mix';
import { objectiveHexes } from '../src/engine/objectives';
import { randomAnswer } from '../src/engine/random';
import { newRsgDraft, rsgAutoRun, rsgFinish } from '../src/engine/rsg';
import { figures, stackLimit } from '../src/engine/stats';
import { isUnit, newGame, typeOf } from '../src/engine/state';
import { type CardId, type Decision, type FortKind, type GameState, type ScenarioDef, SIDES } from '../src/engine/types';

/** mulberry32 (as tests/support/rng.ts): floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The scenario ids the fuzzer plays: the twelve, and 'rsg' for a random scenario of the RSG. */
export const FUZZ_SCENARIOS: readonly string[] = [...SCENARIOS.map((s) => s.id), 'rsg'];

export interface FuzzGame {
  scenario: string;
  seed: number;
  /** Fate decks cut to this many cards (0 = whole decks). */
  tiny: number;
  /** Stop after this many answers (a game that is not over by then counts as capped, not failed). */
  maxAnswers?: number;
  /** Check the invariants after every answer (default true) — the slow part. */
  everyAnswer?: boolean;
  /** Replay the recorded answers at the end and compare (default true). */
  replay?: boolean;
}

export interface FuzzResult extends FuzzGame {
  answers: number;
  phase: GameState['phase'];
  endReason: GameState['endReason'];
  winner: GameState['winner'];
  /** The failure, or null. */
  error: string | null;
  /** The decision being answered when it failed. */
  at: string | null;
  ms: number;
}

/** The scenario of a fuzz game ('rsg': an RSG run by its own heuristic for both sides from `seed`). */
export function fuzzScenario(id: string, seed: number): ScenarioDef {
  if (id !== 'rsg') return scenario(id);
  return rsgFinish(rsgAutoRun(newRsgDraft({ seed }), mulberry32(seed ^ 0x5bd1e995)));
}

/** The initial state of a fuzz game: a new game, with each Fate deck cut to `tiny` cards if asked. */
export function fuzzState(g: FuzzGame): GameState {
  const s = newGame(fuzzScenario(g.scenario, g.seed), g.seed);
  if (g.tiny > 0) for (const side of SIDES) s.players[side].deck = s.players[side].deck.slice(0, Math.max(g.tiny, s.players[side].handSize + 2));
  return s;
}

const cardsOf = (s: GameState, side: 'axis' | 'allied'): CardId[] => {
  const p = s.players[side];
  return [...p.hand, ...p.deck, ...p.discards].sort();
};

/** Who solely occupies Objective n (its hex, or its whole building), or null. */
function soleOccupant(s: GameState, n: number): 'axis' | 'allied' | null {
  let seen = 0;
  for (const h of objectiveHexes(s, n)) for (const side of SIDES) if (figures(s, h, side) > 0) seen |= side === 'axis' ? 1 : 2;
  return seen === 1 ? 'axis' : seen === 2 ? 'allied' : null;
}

/** What the invariants compare with: each side's cards at the start, and who solely held each Objective as play began. */
export interface Baseline {
  cards: Record<'axis' | 'allied', CardId[]>;
  /** Sole occupants at the start of play (set at the first check in phase 'play'). */
  startSole?: ('axis' | 'allied' | null)[];
}

/**
 * Why `s` is inconsistent, or null. `turnStart`: a Turn has just begun. Objective control: a side alone in an Objective
 * controls it — unless it has stood there since set-up (a scenario's listed control stands until a unit enters).
 */
export function invariantError(s: GameState, base: Baseline, turnStart: boolean, pending: Decision | null = null): string | null {
  const cards = base.cards;
  // while units are being displaced from new Blazes (one Blaze, or several by Breeze), some still stand in them
  const displacing = pending?.kind === 'choose' && pending.reason === 'blazeDisplace';
  for (const side of SIDES) {
    const now = cardsOf(s, side);
    if (now.length !== cards[side].length || now.some((c, i) => c !== cards[side][i])) {
      return `${side}'s cards changed: ${now.length} (${new Set(now).size} distinct) instead of ${cards[side].length}`;
    }
    if (!s.players[side].deck.length && s.phase !== 'over') return `${side}'s draw pile is empty`;
  }
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.id !== id) return `piece ${id} has id ${p.id}`;
    if (p.where === 'carried') {
      const c = p.carrier ? s.pieces[p.carrier] : null;
      if (!c || c.weapon !== id) return `${id} (${p.type}) is carried by ${p.carrier}, who does not carry it`;
      if (c.where === 'casualty' || c.where === 'weaponsBox') return `${id} is carried by ${c.id} in the ${c.where}`;
    } else if (p.carrier) return `${id} (${p.where}) still names carrier ${p.carrier}`;
    if (p.weapon) {
      const w = s.pieces[p.weapon];
      if (!w || w.carrier !== id || w.where !== 'carried') return `${id} carries ${p.weapon}, which is not carried by it`;
    }
    if (p.where === 'map') {
      if (!(p.hex >= 0 && p.hex < 150)) return `${id} is on the map at hex ${p.hex}`;
      if (s.blaze[p.hex] && !displacing) return `${id} (${p.type}) is in a Blaze hex ${p.hex}`;
      if (s.map.terrain[p.hex] === 'Water') return `${id} (${p.type}) is in a Water Barrier hex ${p.hex}`;
      if (!isUnit(p)) return `${id} (${typeOf(p).kind}) lies on the map`;
    } else if (p.hex !== -1 && p.where !== 'staging') return `${id} (${p.where}) has hex ${p.hex}`;
    if (p.where === 'casualty' && !s.players[p.side].casualties.includes(id)) return `${id} is a casualty off the track`;
  }
  for (const side of SIDES) for (const id of s.players[side].casualties) if (s.pieces[id]?.where !== 'casualty') return `${id} on the Casualty Track is ${s.pieces[id]?.where}`;
  for (let h = 0; h < 150; h++) {
    if (s.blaze[h] && (s.smoke[h] || s.fort[h])) return `hex ${h} holds a Blaze with a marker`;
    if (s.smoke[h] && s.map.terrain[h] === 'Water') return `Smoke in Water hex ${h}`;
  }
  // the counter mix (R-56): never more counters of a type in play, nor Fortifications of a kind on the map, than it holds
  const used: Record<string, number> = {};
  for (const id in s.pieces) if (s.pieces[id].where !== 'mix') used[s.pieces[id].type] = (used[s.pieces[id].type] ?? 0) + 1;
  for (const [t, n] of Object.entries(used)) if (n > mixCount(t)) return `${n} × ${t} in play; the counter mix holds ${mixCount(t)}`;
  const forts: Record<string, number> = {};
  for (const k of s.fort) if (k) forts[k] = (forts[k] ?? 0) + 1;
  for (const [k, n] of Object.entries(forts)) if (n > fortMixCount(k as FortKind)) return `${n} ${k} on the map; the counter mix holds ${fortMixCount(k as FortKind)}`;
  if (s.phase === 'play') {
    const objectives = Math.min(5, s.map.objectives.length);
    base.startSole ??= Array.from({ length: objectives }, (_, i) => soleOccupant(s, i + 1));
    for (let n = 1; n <= objectives; n++) {
      const sole = soleOccupant(s, n);
      if (!sole || s.control[n - 1] === sole) continue;
      if (sole === base.startSole[n - 1] && s.control[n - 1] === s.scenario.control[n - 1]) continue;
      return `Objective ${n} is held by ${sole} alone but controlled by ${s.control[n - 1]}`;
    }
  }
  if (turnStart && s.phase === 'play') {
    for (let h = 0; h < 150; h++) {
      for (const side of SIDES) if (figures(s, h, side) > stackLimit(s, h)) return `hex ${h} is overstacked for ${side} at the start of Turn ${s.turn.number}`;
    }
    for (const side of SIDES) {
      const p = s.players[side];
      if (p.hand.length > p.handSize) return `${side} holds ${p.hand.length} cards at the start of Turn ${s.turn.number} (hand size ${p.handSize})`;
    }
  }
  if (s.phase === 'over' && (!s.winner || !s.endReason)) return 'the game is over without a winner';
  return null;
}

const describe = (d: Decision) => `${d.kind}${d.kind === 'choose' ? `:${d.reason}` : d.kind === 'react' ? `:${d.window}` : ''} (${d.side})`;

/** Play one fuzz game. Never throws: a failure is reported in the result. */
export function fuzzGame(g: FuzzGame): FuzzResult {
  const t0 = Date.now();
  const max = g.maxAnswers ?? 20000;
  const out: FuzzResult = { ...g, answers: 0, phase: 'setup', endReason: null, winner: null, error: null, at: null, ms: 0 };
  let d: GameDriver | null = null;
  try {
    const initial = fuzzState(g);
    const base: Baseline = { cards: { axis: cardsOf(initial, 'axis'), allied: cardsOf(initial, 'allied') } };
    d = new GameDriver(initial);
    const rnd = mulberry32((g.seed * 2654435761) ^ (g.tiny + 17));
    let lastTurn = -1;
    while (d.pending && out.answers < max) {
      const dec = d.pending;
      out.at = describe(dec);
      const a = randomAnswer(d.state, dec, rnd);
      const err = answerError(d.state, dec, a);
      if (err) throw new Error(`randomAnswer gave a refused answer ${JSON.stringify(a)}: ${err}`);
      if (!d.answer(a)) throw new Error(`the driver refused ${JSON.stringify(a)}: ${d.lastError}`);
      out.answers++;
      const s = d.state;
      const p = d.pending;
      const turnStart = s.turn.number !== lastTurn && p?.kind === 'turn' && s.turn.ordersGiven === 0 && s.turn.passDiscards === null;
      if (turnStart) lastTurn = s.turn.number;
      if (g.everyAnswer !== false || turnStart || !p) {
        const bad = invariantError(s, base, turnStart, p);
        if (bad) throw new Error(`invariant: ${bad}`);
      }
    }
    out.at = null;
    if (g.replay !== false) {
      const again = GameDriver.replay(d.initial, d.answers);
      if (JSON.stringify(again.state) !== JSON.stringify(d.state)) throw new Error('replay: the replayed state differs');
      if (JSON.stringify(again.pending) !== JSON.stringify(d.pending)) throw new Error('replay: the pending decision differs');
    }
  } catch (e) {
    const err = e as Error;
    out.error = `${err.message}${err.stack ? `\n    ${err.stack.split('\n').slice(1, 6).map((l) => l.trim()).join('\n    ')}` : ''}`;
  }
  if (d) {
    out.phase = d.state.phase;
    out.endReason = d.state.endReason;
    out.winner = d.state.winner;
  }
  out.ms = Date.now() - t0;
  return out;
}

/** The command that replays a failed game. */
export function reproduce(r: FuzzGame): string {
  return `npx vite-node scripts/fuzz.ts -- --games 1 --scenario ${r.scenario} --seed ${r.seed}${r.tiny ? ` --tiny-decks ${r.tiny}` : ''}`;
}
