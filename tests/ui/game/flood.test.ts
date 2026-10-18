// Prompt flood (Review Focus 5), the battle screen's side: the human is shown a decision only when he has a choice.
// A whole computer turn in which he can answer nothing asks him nothing; when he holds cards, every reaction he is
// shown has something to play (the re-roll setting: reroll.test.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { GameDriver } from '../../../src/engine/driver';
import type { Decision, Side } from '../../../src/engine/types';
import { GameController } from '../../../src/ui/game/controller';
import { RandomOpponent } from '../../../src/ui/game/opponent';
import { newSessionConfig } from '../../../src/ui/game/session';
import { build, cardsWhere } from '../../support/build';
import { dropStorage, stubStorage } from '../../support/storage';

afterEach(dropStorage);

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    return x / 0x100000000;
  };
}

const idle = async (c: GameController, done: () => boolean) => {
  for (let i = 0; i < 2000 && !done(); i++) await new Promise((r) => setTimeout(r, 2));
};

describe('prompt flood', () => {
  it("a whole computer turn in which the human can answer nothing asks him nothing", async () => {
    stubStorage();
    const human: Side = 'allied';
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = build({
        active: 'axis',
        initiative: 'axis',
        axis: { nation: 'German', orders: 3, hand: [...cardsWhere('German', { order: 'Fire' }).slice(0, 3), ...cardsWhere('German', { order: 'Move' }).slice(0, 3)] },
        allied: { nation: 'Russian', hand: [] },
        pieces: [
          { type: 'German/Rifle Squad', hex: 'C3', weapon: 'German/LMG' },
          { type: 'German/Rifle Squad', hex: 'D3' },
          { type: 'German/Sgt Biermann', hex: 'C3' },
          { type: 'Russian/Rifle Squad', hex: 'C7' },
          { type: 'Russian/Rifle Squad', hex: 'E8' },
        ],
        seed,
      });
      const driver = new GameDriver(s, { snapshots: true, windows: true });
      const config = { ...newSessionConfig('test', human, 'line', seed, s.scenario) };
      const c = new GameController(config, new RandomOpponent(rng(seed)), driver);
      c.view = { ...c.view, speed: 'instant' };
      const shown: Decision[] = [];
      c.subscribe(() => {
        const p = c.view.pending;
        if (p && shown[shown.length - 1] !== p) shown.push(p);
      });
      c.start();
      await idle(c, () => !!c.view.pending || !!c.view.over);
      // the first thing the human is asked is his own Turn
      if (!c.view.over) {
        expect(shown[0]?.kind).toBe('turn');
        expect(shown).toHaveLength(1);
        expect(c.driver.state.active).toBe(human);
      }
      // the computer did play its Turn meanwhile
      expect(c.view.log.some((l) => /^Germans (play|pass)/.test(l.text))).toBe(true);
      c.dispose();
    }
  });

  it('every reaction shown to the human has something to play', async () => {
    stubStorage();
    const human: Side = 'axis';
    const c = new GameController(newSessionConfig('2', human, 'line', 41), new RandomOpponent(rng(41)));
    c.view = { ...c.view, speed: 'instant', reroll: 'matters' };
    const shown: Decision[] = [];
    c.subscribe(() => {
      const p = c.view.pending;
      if (p && shown[shown.length - 1] !== p) {
        shown.push(p);
        // answer at once, at random, as a player clicking would
        queueMicrotask(() => c.autoAnswer());
      }
    });
    c.start();
    await idle(c, () => shown.length > 250 || !!c.view.over);
    for (const d of shown) {
      if (d.kind === 'react') expect(d.options.length).toBeGreaterThan(0);
      if (d.kind === 'choose') expect(d.items.length).toBeGreaterThan(d.min === d.items.length ? -1 : 0);
    }
    expect(shown.some((d) => d.kind === 'turn')).toBe(true);
    c.dispose();
  });
});
