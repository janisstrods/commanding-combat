// Orders as subheadings in the battle log: Turn heading → Order (or pass) heading → its lines, reactions marked under
// the Order they interrupted; what follows an Order (end-of-Turn draws) sits under the Turn again.
import { describe, expect, it } from 'vitest';
import { randomAnswer } from '../../../src/engine/random';
import type { GameEvent, GameState, Side } from '../../../src/engine/types';
import { publicEvent } from '../../../src/ui/game/hidden';
import { logEntry, logRows, type LogEntry } from '../../../src/ui/game/log';
import { newDriver, newSessionConfig } from '../../../src/ui/game/session';

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

/** Every event of a random game, with the state right after it. */
function randomGame(id: string, seed: number, steps: number): { e: GameEvent; s: GameState }[] {
  const d = newDriver(newSessionConfig(id, 'axis', 'line', seed));
  const rnd = rng(seed);
  const out: { e: GameEvent; s: GameState }[] = [];
  const take = () => {
    for (const q of d.drainEvents()) out.push({ e: q.e, s: q.state! });
  };
  take();
  for (let i = 0; i < steps && d.pending && d.state.phase !== 'over'; i++) {
    d.answer(randomAnswer(d.state, d.pending, rnd));
    take();
  }
  return out;
}

const L = (kind: LogEntry['kind'], text: string, side?: Side, react?: boolean): LogEntry => ({ kind, text, side, react });

describe('the engine marks Orders and passes', () => {
  it('closes every Order and every pass before the next one, and before the next Turn', () => {
    for (const seed of [1, 2, 3]) {
      let open: Side | null = null;
      let orders = 0;
      for (const { e } of randomGame('2', seed, 400)) {
        if ((e.kind === 'cardPlayed' && e.as === 'order') || e.kind === 'pass') {
          expect(open).toBeNull();
          open = e.side;
          orders++;
        } else if (e.kind === 'orderDone') {
          expect(open).toBe(e.side);
          open = null;
        } else if (e.kind === 'turnStart') {
          expect(open).toBeNull();
        }
      }
      expect(orders).toBeGreaterThan(5);
    }
  });
});

describe('logRows', () => {
  it('nests the lines of an Order under its heading and marks the other side’s Actions as reactions', () => {
    const rows = logRows([
      L('turn', 'Fat Lipki: you command the Russians.'),
      L('vp', 'You draw secret objective E.'),
      L('turn', 'Turn 1: Russians (you)', 'allied'),
      L('order', 'Russians — Move', 'allied'),
      L('move', 'Rifle Squad moves to F5 (1 MP).'),
      L('info', 'Op Fire: Rifle Squad activated.', 'axis', true),
      L('fire', 'Germans fire at F5: 5 FP + roll 7 = 12.', 'axis'),
      L('card', 'Event: Sniper (the Germans).', 'axis'),
      L('card', 'You play Smoke Grenades as an Action.', 'allied', true),
      L('close', '', 'allied'),
      L('card', 'You draw Fire.', 'allied'),
      L('turn', 'Turn 2: Germans', 'axis'),
      L('order', 'Germans — Pass', 'axis'),
      L('card', 'Germans discard 2 cards: Fire, Move.', 'axis'),
      L('close', '', 'axis'),
    ]);
    expect(rows.map((r) => [r.depth, r.reaction ? 'R' : '', r.text])).toEqual([
      [0, '', 'Fat Lipki: you command the Russians.'],
      [0, '', 'You draw secret objective E.'],
      [0, '', 'Turn 1: Russians (you)'],
      [1, '', 'Russians — Move'],
      [2, '', 'Rifle Squad moves to F5 (1 MP).'],
      [2, 'R', 'Op Fire: Rifle Squad activated.'],
      [2, '', 'Germans fire at F5: 5 FP + roll 7 = 12.'],
      [2, '', 'Event: Sniper (the Germans).'],
      [2, '', 'You play Smoke Grenades as an Action.'],
      [1, '', 'You draw Fire.'],
      [0, '', 'Turn 2: Germans'],
      [1, '', 'Germans — Pass'],
      [2, '', 'Germans discard 2 cards: Fire, Move.'],
    ]);
  });

  it('copes with a log trimmed in the middle of an Order (no heading above)', () => {
    const rows = logRows([L('fire', 'Germans fire at F5.', 'axis'), L('close', '', 'axis'), L('card', 'Germans draw 2 cards.', 'axis')]);
    expect(rows.map((r) => r.depth)).toEqual([0, 0]);
  });

  it('groups a real game: every Order heading is followed by its lines, no structural line is shown', () => {
    for (const seed of [4, 5]) {
      const human: Side = 'axis';
      const lines: LogEntry[] = [];
      for (const { e, s } of randomGame('1', seed, 400)) {
        const pe = publicEvent(e, human, s);
        const l = pe && logEntry(pe, s, human);
        if (l) lines.push(l);
      }
      const rows = logRows(lines);
      expect(rows.some((r) => r.kind === 'close')).toBe(false);
      expect(rows.filter((r) => r.kind === 'order').length).toBeGreaterThan(5);
      let order: Side | null = null;
      for (const r of rows) {
        if (r.kind === 'turn') order = null;
        else if (r.kind === 'order') order = r.side!;
        if (r.reaction) expect(r.side).not.toBe(order);
        if (r.kind === 'order') expect(r.depth).toBe(1);
        if (r.kind === 'turn' && r.side) expect(r.depth).toBe(0);
      }
    }
  });
});
