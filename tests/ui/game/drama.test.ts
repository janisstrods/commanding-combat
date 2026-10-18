// The randomiser moment on the battle screen (drama.ts through the controller, fake timers): a Sniper! the human rolls
// opens its banner, runs the randomiser onto the card's hex, waits on the screen for his target with the hex still
// marked, shows the hit and closes; a click (hurry) ends a reading pause early; Instant speed shows none of it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameDriver } from '../../../src/engine/driver';
import type { Side } from '../../../src/engine/types';
import { GameController, type Speed } from '../../../src/ui/game/controller';
import { RandomOpponent } from '../../../src/ui/game/opponent';
import { introMs, momentText } from '../../../src/ui/game/randomiser';
import { newSessionConfig } from '../../../src/ui/game/session';
import { H, build, card, cardsWhere } from '../../support/build';
import { dropStorage, stubStorage } from '../../support/storage';

afterEach(() => {
  vi.useRealTimers();
  dropStorage();
});

/** The human (Allies) holds a Recover Order and a broken Squad; his next roll shows Sniper!, then Random Hex E6. */
function setup(speed: Speed) {
  stubStorage();
  const human: Side = 'allied';
  const sn = card('American', { trigger: 'Sniper' });
  const s = build({
    active: 'allied',
    initiative: 'allied',
    allied: { nation: 'American', hand: cardsWhere('American', { order: 'Recover' }).slice(0, 1), top: [sn, card('American', { hex: 'E6' }, [sn])] },
    axis: { nation: 'German', hand: [] },
    pieces: [
      { type: 'American/Line Squad', hex: 'B2', broken: true },
      { type: 'German/Rifle Squad', hex: 'E7' },
    ],
    seed: 3,
  });
  const driver = new GameDriver(s, { snapshots: true, windows: true });
  const c = new GameController({ ...newSessionConfig('test', human, 'line', 3, s.scenario) }, new RandomOpponent(() => 0.5), driver);
  c.view = { ...c.view, speed, reroll: 'never' };
  return c;
}

/** Advance the fake clock in small steps until `done` (or give up). */
async function until(done: () => boolean, maxMs = 30000): Promise<number> {
  let t = 0;
  while (!done() && t < maxMs) {
    await vi.advanceTimersByTimeAsync(10);
    t += 10;
  }
  return t;
}

describe('the Sniper! moment on the battle screen', () => {
  it('banner, randomiser, the hex kept marked while the human picks, the hit, the close', async () => {
    vi.useFakeTimers();
    const c = setup('normal');
    c.start();
    await until(() => c.view.pending?.kind === 'turn');
    const recover = c.view.pending!.kind === 'turn' ? c.driver.state.players.allied.hand[0] : '';
    c.answer({ kind: 'order', card: recover, order: 'Recover' });

    await until(() => !!c.view.banner);
    expect(c.view.banner).toMatchObject({ kind: 'sniper', side: 'allied', title: 'Sniper!', hold: true, hex: null });
    // the reading pause, then the randomiser
    const { title, text } = momentText({ kind: 'sniper', side: 'allied', event: null, card: null, target: null });
    const waited = await until(() => !!c.view.hexPick);
    expect(waited).toBeGreaterThanOrEqual(introMs(title, text, 'normal') - 20);
    const pick = c.view.hexPick!;
    expect(pick).toMatchObject({ target: H('E6'), landed: false, reason: 'sniper' });
    expect(c.view.banner!.hexCard).not.toBeNull();
    await until(() => !!c.view.hexPick?.landed);
    expect(c.view.hexPick!.area).toContain(H('E7'));
    expect(c.view.banner).toMatchObject({ hex: H('E6'), note: '1 unit in reach: one may be broken.' });

    // his choice: the banner and the marked hex stay up meanwhile
    await until(() => c.view.pending?.kind === 'choose');
    expect(c.view.pending).toMatchObject({ kind: 'choose', reason: 'sniperTarget' });
    expect(c.view.banner).not.toBeNull();
    expect(c.view.hexPick?.landed).toBe(true);
    c.answer({ kind: 'choose', items: [0] });

    await until(() => c.view.impacts.length > 0);
    expect(c.view.impacts[0]).toMatchObject({ hex: H('E7'), from: H('E6'), look: 'crosshair' });
    await until(() => !!c.view.banner?.done);
    expect(c.view.banner!.lines.some((l) => /breaks/.test(l))).toBe(true);
    await until(() => !c.view.banner);
    expect(c.view.hexPick).toBeNull();
    expect(c.driver.state.pieces.p1.broken).toBe(true);
    c.dispose();
  });

  it('a click ends the reading pause at once (and only that pause)', async () => {
    vi.useFakeTimers();
    const c = setup('normal');
    c.start();
    await until(() => c.view.pending?.kind === 'turn');
    c.answer({ kind: 'order', card: c.driver.state.players.allied.hand[0], order: 'Recover' });
    await until(() => !!c.view.banner);
    c.hurry();
    const waited = await until(() => !!c.view.hexPick);
    expect(waited).toBeLessThan(200);
    // the randomiser still runs: hurrying one pause skips nothing else
    expect(c.view.hexPick!.hops.length).toBeGreaterThan(0);
    c.dispose();
  });

  it('Instant speed: no banner and no randomiser, straight to the choice', async () => {
    vi.useFakeTimers();
    const c = setup('instant');
    let seen = false;
    c.subscribe(() => {
      if (c.view.banner || c.view.hexPick) seen = true;
    });
    c.start();
    await until(() => c.view.pending?.kind === 'turn');
    c.answer({ kind: 'order', card: c.driver.state.players.allied.hand[0], order: 'Recover' });
    await until(() => c.view.pending?.kind === 'choose');
    expect(c.view.pending).toMatchObject({ reason: 'sniperTarget' });
    c.answer({ kind: 'choose', items: [0] });
    await until(() => c.view.pending?.kind === 'turn' || !!c.view.over, 2000);
    expect(seen).toBe(false);
    c.dispose();
  });
});
