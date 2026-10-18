// Hidden information (plan Review Focus 3): the AI's input never contains the opponent's hand, any draw-pile order or
// the opponent's secret chits. The client redacts before posting to the worker or calling chooseAnswer; chooseAnswer's
// answer is a function of the view alone (states that differ only in hidden information give the same answers); and
// determinisation samples only from the view's unseen pools.
import { afterEach, describe, expect, it, vi } from 'vitest';

// every view chooseAnswer is called with (also through the client's dynamic import)
const seenViews = vi.hoisted(() => [] as unknown[]);
vi.mock('../../src/ai/index', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/ai/index')>();
  return {
    ...mod,
    chooseAnswer: (...args: Parameters<typeof mod.chooseAnswer>) => {
      seenViews.push(args[0]);
      return mod.chooseAnswer(...args);
    },
  };
});
import { AiOpponent } from '../../src/ai/client';
import { determinize, isViewFor } from '../../src/ai/determinize';
import { chooseAnswer, newMemory } from '../../src/ai/index';
import { Rng } from '../../src/ai/rand';
import { handle, type WorkerRequest, type WorkerResponse } from '../../src/ai/worker';
import { scenario } from '../../src/engine/data';
import { GameDriver } from '../../src/engine/driver';
import { randomAnswer } from '../../src/engine/random';
import { cloneState, newGame, redact } from '../../src/engine/state';
import { type GameState, type Side, UNKNOWN_CARD, UNKNOWN_CHIT, other } from '../../src/engine/types';
import { mulberry32 } from '../support/rng';

/** Play scenario 1 at random until `side` faces a 'turn' decision with Orders to give, after a few turns. */
function midGame(seed: number, side: Side): GameDriver {
  const rnd = mulberry32(seed);
  const d = new GameDriver(newGame(scenario('1'), seed));
  let turns = 0;
  for (let n = 0; n < 5000 && d.pending; n++) {
    const p = d.pending;
    if (p.kind === 'turn' && p.side === side && p.orders.length && ++turns >= 3) return d;
    if (!d.answer(randomAnswer(d.state, p, rnd))) throw new Error(d.lastError ?? 'refused');
  }
  throw new Error('no mid-game turn decision reached');
}

/** What only the opponent of `viewer` (or nobody) knows in `s`: his hand, both draw piles in order, his secret chits. */
function secrets(s: GameState, viewer: Side) {
  const opp = other(viewer);
  return { hand: s.players[opp].hand, decks: [s.players.axis.deck, s.players.allied.deck], chits: s.players[opp].secretChits, cup: s.chitCup };
}

/** Assert `v` carries none of the hidden information of `real` for `viewer`. */
function expectRedacted(v: GameState, real: GameState, viewer: Side) {
  expect(isViewFor(v, viewer)).toBe(true);
  const opp = other(viewer);
  expect(v.players[opp].hand.every((c) => c === UNKNOWN_CARD)).toBe(true);
  expect(v.players.axis.deck.every((c) => c === UNKNOWN_CARD)).toBe(true);
  expect(v.players.allied.deck.every((c) => c === UNKNOWN_CARD)).toBe(true);
  expect(v.players[opp].secretChits.every((c) => c === UNKNOWN_CHIT)).toBe(true);
  expect(v.chitCup.every((c) => c === UNKNOWN_CHIT)).toBe(true);
  expect(v.rng).toBe(0);
  // no hidden card id appears anywhere outside the sorted pools
  const text = JSON.stringify({ ...v, unseen: undefined });
  for (const c of real.players[opp].hand) if (!real.players[opp].discards.includes(c)) expect(text).not.toContain(`"${c}"`);
  for (const c of real.players[opp].secretChits) expect(text).not.toContain(`"${c}"`);
}

/**
 * A state that looks the same to `viewer` as `s` but hides different things: the opponent's hand swapped with cards of
 * his draw pile, both draw piles reordered, his secret chit swapped with one from the cup, a new RNG seed.
 */
function sameViewDifferentTruth(s: GameState, viewer: Side): GameState {
  const t = cloneState(s);
  const opp = t.players[other(viewer)];
  const n = opp.hand.length;
  const pool = [...opp.hand, ...opp.deck];
  opp.hand = pool.slice(pool.length - n);
  opp.deck = pool.slice(0, pool.length - n).reverse();
  t.players[viewer].deck.reverse();
  if (opp.secretChits.length && t.chitCup.length) {
    const i = t.chitCup.findIndex((c) => c !== opp.secretChits[0] && /[A-HJ-NP-QS-U]/.test(c));
    if (i >= 0) [opp.secretChits[0], t.chitCup[i]] = [t.chitCup[i], opp.secretChits[0]];
  }
  t.rng = (t.rng ^ 0x5bd1e995) >>> 0;
  return t;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the AI never sees hidden information', () => {
  it('two states that differ only in hidden information give the same redacted view', () => {
    const d = midGame(11, 'axis');
    const s = d.state;
    const t = sameViewDifferentTruth(s, 'axis');
    expect(secrets(t, 'axis')).not.toEqual(secrets(s, 'axis'));
    expect(redact(t, 'axis')).toEqual(redact(s, 'axis'));
  });

  it('chooseAnswer gives the same answers for both: its only input is the view', () => {
    for (const seed of [11, 12]) {
      const d = midGame(seed, 'axis');
      const s = d.state;
      const t = sameViewDifferentTruth(s, 'axis');
      const opts = { side: 'axis' as const, level: 'line' as const, seed: 99, deterministic: true };
      const ma = newMemory(99);
      const mb = newMemory(99);
      const a = chooseAnswer(redact(s, 'axis'), d.pending!, opts, ma);
      const b = chooseAnswer(redact(t, 'axis'), d.pending!, opts, mb);
      expect(b).toEqual(a);
      const strip = (m: typeof ma) => ({ ...m, last: m.last ? { ...m.last, ms: 0 } : null });
      expect(strip(mb)).toEqual(strip(ma));
      expect(ma.fallbacks).toBe(0);
    }
  });

  it('chooseAnswer given a full state by mistake redacts it first (same answer as from the view)', () => {
    const d = midGame(13, 'axis');
    const opts = { side: 'axis' as const, level: 'green' as const, seed: 5, deterministic: true };
    const a = chooseAnswer(d.state, d.pending!, opts, newMemory(5));
    const b = chooseAnswer(redact(d.state, 'axis'), d.pending!, opts, newMemory(5));
    expect(a).toEqual(b);
  });

  it('refuses a view redacted for the other side (it would show the opponent\'s hand)', () => {
    const d = midGame(13, 'axis');
    expect(() => chooseAnswer(redact(d.state, 'allied'), d.pending!, { side: 'axis', level: 'green' }, newMemory(1))).toThrow(/other side/);
  });

  it('the client, in-thread, hands chooseAnswer a redacted view even when given the full state', async () => {
    const d = midGame(14, 'axis');
    const ai = new AiOpponent({ side: 'axis', level: 'green', worker: false, seed: 3, timeBudgetMs: 50 });
    expect(ai.usingWorker).toBe(false);
    seenViews.length = 0;
    const r = await ai.decide(d.state, d.pending!);
    ai.dispose();
    expect(r.answer).toBeTruthy();
    expect(seenViews).toHaveLength(1);
    expectRedacted(seenViews[0] as GameState, d.state, 'axis');
  });

  it('the worker gets only the redacted view: every posted message is checked', async () => {
    const d = midGame(15, 'allied');
    const posted: WorkerRequest[] = [];
    class FakeWorker {
      onmessage: ((ev: { data: WorkerResponse }) => void) | null = null;
      onerror: unknown = null;
      onmessageerror: unknown = null;
      postMessage(m: WorkerRequest) {
        posted.push(structuredClone(m));
        setTimeout(() => handle(structuredClone(m), (r) => this.onmessage?.({ data: r })), 0);
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
    seenViews.length = 0;
    const ai = new AiOpponent({ side: 'allied', level: 'green', seed: 4, timeBudgetMs: 50 });
    expect(ai.usingWorker).toBe(true);
    const r = await ai.decide(d.state, d.pending!);
    ai.dispose();
    expect(r.answer).toBeTruthy();
    const decide = posted.filter((m): m is Extract<WorkerRequest, { type: 'decide' }> => m.type === 'decide');
    expect(decide).toHaveLength(1);
    expect(seenViews.at(-1)).toEqual(decide[0].view);
    expectRedacted(decide[0].view, d.state, 'allied');
    expect(Object.keys(decide[0]).sort()).toEqual(['decision', 'gameId', 'id', 'opts', 'type', 'view']);
  });
});

describe('determinisation', () => {
  it('depends only on the view and the seed, never on the hidden truth', () => {
    const d = midGame(21, 'axis');
    const s = d.state;
    const t = sameViewDifferentTruth(s, 'axis');
    const a = determinize(redact(s, 'axis'), 'axis', new Rng(7));
    const b = determinize(redact(t, 'axis'), 'axis', new Rng(7));
    expect(b).toEqual(a);
  });

  it('fills every unknown from the unseen pools, keeping the counts and the cards each side owns', () => {
    const d = midGame(22, 'allied');
    const s = d.state;
    const v = redact(s, 'allied');
    for (let k = 0; k < 20; k++) {
      const w = determinize(v, 'allied', new Rng(100 + k));
      expect(w.unseen).toBeUndefined();
      for (const side of ['axis', 'allied'] as const) {
        const p = w.players[side];
        expect(p.hand).toHaveLength(s.players[side].hand.length);
        expect(p.deck).toHaveLength(s.players[side].deck.length);
        expect(new Set([...p.hand, ...p.deck, ...p.discards]).size).toBe(72);
        expect([...p.hand, ...p.deck, ...p.discards].sort()).toEqual([...s.players[side].hand, ...s.players[side].deck, ...s.players[side].discards].sort());
      }
      expect(w.players.allied.hand).toEqual(s.players.allied.hand); // own hand as it is
      expect(w.players.axis.secretChits).toHaveLength(s.players.axis.secretChits.length);
      expect([...w.chitCup, ...w.players.axis.secretChits].sort()).toEqual([...s.chitCup, ...s.players.axis.secretChits].sort());
    }
  });

  it('the sampled opponent hands are spread over his whole unseen pool (not the real hand)', () => {
    const d = midGame(23, 'axis');
    const s = d.state;
    const v = redact(s, 'axis');
    const real = new Set(s.players.allied.hand);
    let hits = 0;
    let total = 0;
    const counts = new Map<string, number>();
    for (let k = 0; k < 200; k++) {
      const w = determinize(v, 'axis', new Rng(1000 + k));
      for (const c of w.players.allied.hand) {
        total++;
        if (real.has(c)) hits++;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    const pool = v.unseen!.cards.allied.length;
    // chance level: hand size / pool size of the cards drawn are from the real hand
    expect(hits / total).toBeLessThan((s.players.allied.hand.length / pool) * 2.5 + 0.02);
    expect(counts.size).toBeGreaterThan(pool * 0.8);
  });
});

