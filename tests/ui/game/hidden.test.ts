// Hidden information on the battle screen (Review Focus 3, the human's side of it): the human never sees the
// opponent's hand, his drawn cards, any draw pile or the opponent's secret chits, nor the opponent's units in a hidden
// set-up; what the rules reveal (open chits, the game end) shows.
import { afterEach, describe, expect, it } from 'vitest';
import { CARDS } from '../../../src/engine/data';
import type { GameDriver } from '../../../src/engine/driver';
import { randomAnswer } from '../../../src/engine/random';
import type { GameEvent, GameState, Side } from '../../../src/engine/types';
import { UNKNOWN_CARD, UNKNOWN_CHIT, other } from '../../../src/engine/types';
import { GameController } from '../../../src/ui/game/controller';
import { publicEvent, viewOf } from '../../../src/ui/game/hidden';
import { logEntry } from '../../../src/ui/game/log';
import { RandomOpponent } from '../../../src/ui/game/opponent';
import { newDriver, newSessionConfig } from '../../../src/ui/game/session';
import { dropStorage, stubStorage } from '../../support/storage';

afterEach(dropStorage);

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

/** Every event of a random game, with the state right after it. */
function randomGame(id: string, seed: number, steps: number): { d: GameDriver; events: { e: GameEvent; s: GameState }[] } {
  const d = newDriver(newSessionConfig(id, 'axis', 'line', seed));
  const rnd = rng(seed);
  const events: { e: GameEvent; s: GameState }[] = [];
  const take = () => {
    for (const q of d.drainEvents()) events.push({ e: q.e, s: q.state! });
  };
  take();
  for (let i = 0; i < steps && d.pending && d.state.phase !== 'over'; i++) {
    d.answer(randomAnswer(d.state, d.pending, rnd));
    take();
  }
  return { d, events };
}

const orderNames = new Set(Object.values(CARDS).map((c) => c.order));

describe('publicEvent', () => {
  it("hides the opponent's drawn cards (their number stays) and shows the viewer's own", () => {
    const e: GameEvent = { kind: 'draw', side: 'allied', cards: ['A-01', 'A-02'] };
    expect(publicEvent(e, 'axis')).toEqual({ kind: 'draw', side: 'allied', cards: [UNKNOWN_CARD, UNKNOWN_CARD] });
    expect(publicEvent(e, 'allied')).toEqual(e);
  });

  it("hides the opponent's secret chits, not his open ones nor the viewer's", () => {
    expect(publicEvent({ kind: 'chit', chit: 'K', side: 'allied', open: false }, 'axis')).toEqual({ kind: 'chit', chit: UNKNOWN_CHIT, side: 'allied', open: false });
    expect(publicEvent({ kind: 'chit', chit: 'K', side: 'axis', open: false }, 'axis')).toEqual({ kind: 'chit', chit: 'K', side: 'axis', open: false });
    expect(publicEvent({ kind: 'chit', chit: 'K', side: 'allied', open: true }, 'axis')).toEqual({ kind: 'chit', chit: 'K', side: 'allied', open: true });
  });

  it("drops the opponent's placements in a hidden set-up (scenario 1), keeps the viewer's", () => {
    const { events } = randomGame('1', 5, 200);
    const places = events.filter(({ e, s }) => e.kind === 'place' && !!e.piece && s.phase === 'setup');
    const axis = places.filter(({ e, s }) => e.kind === 'place' && s.pieces[e.piece!].side === 'axis');
    const allied = places.filter(({ e, s }) => e.kind === 'place' && s.pieces[e.piece!].side === 'allied');
    expect(axis.length).toBeGreaterThan(0);
    expect(allied.length).toBeGreaterThan(0);
    for (const { e, s } of axis) expect(publicEvent(e, 'allied', s)).toBeNull();
    for (const { e, s } of allied) expect(publicEvent(e, 'allied', s)).toEqual(e);
  });
});

describe('what the human sees in a whole random game', () => {
  for (const [id, seed] of [['2', 3], ['5', 9], ['8', 4]] as [string, number][]) {
    it(`scenario ${id}: the log never names the opponent's drawn cards or secret chits`, () => {
      const human: Side = 'axis';
      const { events } = randomGame(id, seed, 700);
      let draws = 0;
      for (const { e, s } of events) {
        const pe = publicEvent(e, human, s);
        if (!pe) continue;
        const view = viewOf(s, human);
        const line = logEntry(pe, view, human);
        if (e.kind === 'draw' && e.side !== human) {
          draws++;
          expect(line?.text).toMatch(/^\w+ draw \d+ cards?\.$/);
          for (const n of orderNames) expect(line?.text ?? '').not.toContain(n);
        }
        if (e.kind === 'chit' && !e.open && e.side !== human) {
          expect(line?.text).toMatch(/draw a secret objective/);
          expect(line?.text ?? '').not.toContain(e.chit);
        }
      }
      expect(draws).toBeGreaterThan(0);
    });
  }

  it("the displayed game never holds the opponent's hand, either draw pile or his secret chits (until the end)", () => {
    const human: Side = 'allied';
    const { events } = randomGame('6', 2, 600);
    for (const { s } of events) {
      const v = viewOf(s, human);
      if (s.phase === 'over') {
        expect(v.players.axis.hand).toEqual(s.players.axis.hand);
        continue;
      }
      expect(v.players[other(human)].hand.every((c) => c === UNKNOWN_CARD)).toBe(true);
      expect(v.players[other(human)].hand.length).toBe(s.players[other(human)].hand.length);
      expect(v.players.axis.deck.every((c) => c === UNKNOWN_CARD)).toBe(true);
      expect(v.players.allied.deck.every((c) => c === UNKNOWN_CARD)).toBe(true);
      expect(v.players[other(human)].secretChits.every((c) => c === UNKNOWN_CHIT)).toBe(true);
      expect(v.players[human].hand).toEqual(s.players[human].hand);
      expect(v.players[human].secretChits).toEqual(s.players[human].secretChits);
    }
  });

  it("the controller's display and log keep the opponent's cards hidden while it plays", async () => {
    stubStorage();
    const human: Side = 'axis';
    const c = new GameController(newSessionConfig('2', human, 'line', 31), new RandomOpponent(rng(31)));
    c.view = { ...c.view, speed: 'instant' };
    c.autoPlay(60);
    c.start();
    for (let i = 0; i < 400 && !(c.view.pending && !c.view.animating && c.driver.answers.length > 60); i++) await new Promise((r) => setTimeout(r, 5));
    const opp = other(human);
    const real = c.driver.state.players[opp].hand;
    expect(real.length).toBeGreaterThan(0);
    expect(c.view.display.players[opp].hand.every((x) => x === UNKNOWN_CARD)).toBe(true);
    for (const l of c.view.log) if (/^Americans draw/.test(l.text)) expect(l.text).toMatch(/^Americans draw (\d+ cards?|a secret objective)\.$/);
    c.dispose();
  });

  it("the opponent's reaction decisions never show it deciding: they look like any other reaction window", async () => {
    stubStorage();
    const human: Side = 'allied';
    const c = new GameController(newSessionConfig('5', human, 'line', 8), new RandomOpponent(rng(8)));
    c.view = { ...c.view, speed: 'instant' };
    let reacts = 0;
    let windows = 0;
    c.subscribe(() => {
      const p = c.driver.pending;
      if (p && p.side !== human && p.kind === 'react') {
        reacts++;
        expect(c.view.thinking).toBe(false);
      }
      if (c.view.waiting) windows++;
    });
    c.autoPlay(150);
    c.start();
    for (let i = 0; i < 600 && !(c.view.pending && !c.view.animating && c.driver.answers.length > 150); i++) await new Promise((r) => setTimeout(r, 5));
    expect(windows).toBeGreaterThan(0);
    expect(reacts).toBeGreaterThan(0);
    c.dispose();
  });
});

describe('the log speaks plainly', () => {
  it("tells the engine's Recover / Rout and end-of-Turn lines with nations and 'you'", async () => {
    const { engineText, logEntry } = await import('../../../src/ui/game/log');
    const { build } = await import('../../support/build');
    const s = build({ axis: { nation: 'German' }, allied: { nation: 'Russian' } });
    expect(engineText('Recover: the allied player activates himself.', 'allied', s, 'allied')).toBe('Recover: you rally your broken units.');
    expect(engineText('Rout: the axis player activates the allied player.', 'axis', s, 'allied')).toBe('Rout: the Germans rout your broken units.');
    expect(engineText('Rout: the allied player activates the axis player.', 'allied', s, 'allied')).toBe('Rout: you rout the Germans’ broken units.');
    expect(engineText('No other Order possible: the Turn ends.', 'allied', s, 'allied')).toBe('No other Order possible: your Turn ends.');
    expect(engineText('All 3 Orders given: the Turn ends.', 'axis', s, 'allied')).toBe('All 3 Orders given: the Germans’ Turn ends.');
    expect(engineText('No room to set up German/Rifle Squad.', 'axis', s, 'allied')).toBe('No room to set up Rifle Squad.');
    expect(logEntry({ kind: 'cardPlayed', side: 'allied', card: 'R-01', as: 'order', name: 'Fire' }, s, 'allied')?.text).toBe('You play Fire as an Order.');
    expect(logEntry({ kind: 'cardPlayed', side: 'axis', card: 'G-01', as: 'order', name: 'Fire' }, s, 'allied')?.text).toBe('Germans play Fire as an Order.');
    expect(logEntry({ kind: 'vp', delta: -2, total: -2, why: 'elimination' }, s, 'allied')?.text).toBe('+2 VP to you (elimination). VP: 2 to the Allies.');
  });
});
