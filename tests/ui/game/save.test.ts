// Save / resume (Review Focus 4): the autosave (localStorage `cce-save-v1`) holds the session and every answer; a
// reload replays them into exactly the same position — also mid-way through the opponent's turn, and for a random
// battle whose whole ScenarioDef is in the save.
import { afterEach, describe, expect, it } from 'vitest';
import { scenario } from '../../../src/engine/data';
import type { GameDriver } from '../../../src/engine/driver';
import { randomAnswer } from '../../../src/engine/random';
import type { ScenarioDef, Side } from '../../../src/engine/types';
import { GameController } from '../../../src/ui/game/controller';
import { RandomOpponent } from '../../../src/ui/game/opponent';
import {
  ENGINE_VERSION, SAVE_KEY, clearSave, historyOf, loadSave, makeSave, newDriver, newSessionConfig, restoreDriver, writeSave,
} from '../../../src/ui/game/session';
import { dropStorage, stubStorage } from '../../support/storage';

afterEach(dropStorage);

/** A seeded random source (so a failing case can be rerun). */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0x100000000;
  };
}

/** Play `n` random answers (both sides), or stop early when `until` says so. */
function play(d: GameDriver, n: number, rnd: () => number, until?: (d: GameDriver) => boolean): void {
  for (let i = 0; i < n && d.pending && d.state.phase !== 'over'; i++) {
    if (until?.(d)) return;
    expect(d.answer(randomAnswer(d.state, d.pending, rnd))).toBe(true);
  }
}

const snapshot = (d: GameDriver) => JSON.stringify({ state: d.state, pending: d.pending, answers: d.answers });

describe('the autosave', () => {
  it('reloads into exactly the same position (several scenarios and seeds)', () => {
    stubStorage();
    for (const [id, side, seed] of [['1', 'axis', 3], ['2', 'allied', 7], ['6', 'axis', 11], ['10', 'allied', 5]] as [string, Side, number][]) {
      const config = newSessionConfig(id, side, 'line', seed);
      const d = newDriver(config);
      play(d, 260, rng(seed));
      writeSave(makeSave(config, d));
      const saved = loadSave();
      expect(saved).not.toBeNull();
      expect(saved!.scenarioName).toBe(scenario(id).name);
      const back = restoreDriver(saved!);
      expect(snapshot(back)).toBe(snapshot(d));
      // and it plays on identically
      const r1 = rng(99);
      const r2 = rng(99);
      play(d, 40, r1);
      play(back, 40, r2);
      expect(snapshot(back)).toBe(snapshot(d));
    }
  });

  it('reloads mid-way through the opponent\'s turn, with the opponent\'s decision pending', () => {
    stubStorage();
    const human: Side = 'allied';
    const config = newSessionConfig('3', human, 'line', 21);
    const d = newDriver(config);
    const rnd = rng(21);
    play(d, 120, rnd);
    play(d, 400, rnd, (x) => x.state.phase === 'play' && x.state.active !== human && !!x.pending && x.pending.side !== human && x.state.turn.ordersGiven > 0);
    expect(d.pending!.side).not.toBe(human);
    writeSave(makeSave(config, d));
    const back = restoreDriver(loadSave()!);
    expect(back.pending).toEqual(d.pending);
    expect(snapshot(back)).toBe(snapshot(d));
  });

  it('keeps a random battle\'s whole scenario in the save', () => {
    stubStorage();
    const rsg: ScenarioDef = { ...scenario('4'), id: 'rsg', name: 'Random battle on map 4' };
    const config = newSessionConfig('rsg', 'axis', 'green', 8, rsg);
    const d = newDriver(config);
    play(d, 150, rng(8));
    writeSave(makeSave(config, d));
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(raw.scenario.id).toBe('rsg');
    expect(raw.version).toBe(1);
    expect(raw.engine).toBe(ENGINE_VERSION);
    const saved = loadSave()!;
    expect(saved.scenarioName).toBe('Random battle on map 4');
    expect(snapshot(restoreDriver(saved))).toBe(snapshot(d));
  });

  it('drops a save of another engine version, and refuses answers that no longer replay', () => {
    const m = stubStorage();
    const config = newSessionConfig('1', 'axis', 'line', 4);
    const d = newDriver(config);
    play(d, 60, rng(4));
    const save = makeSave(config, d);
    writeSave({ ...save, engine: ENGINE_VERSION + 1 });
    expect(loadSave()).toBeNull();
    expect(m.has(SAVE_KEY)).toBe(false);
    writeSave({ ...save, check: { ...save.check, rngCalls: save.check.rngCalls + 1 } });
    expect(() => restoreDriver(loadSave()!)).toThrow();
    clearSave();
    m.set(SAVE_KEY, '{not json');
    expect(loadSave()).toBeNull();
  });

  it('the history of a save has every event of the game: its VP events add up to the VP now', () => {
    stubStorage();
    const config = newSessionConfig('2', 'axis', 'line', 13);
    const d = newDriver(config);
    play(d, 300, rng(13));
    const h = historyOf(makeSave(config, d));
    const vp = h.reduce((t, e) => t + (e.kind === 'vp' ? e.delta : 0), 0);
    expect(vp).toBe(d.state.vp - scenario('2').vp);
    expect(h.filter((e) => e.kind === 'turnStart').length).toBe(d.state.phase === 'play' ? d.state.turn.number : h.filter((e) => e.kind === 'turnStart').length);
    expect(h.some((e) => e.kind === 'window')).toBe(false);
  });
});

describe('the battle controller', () => {
  it('autosaves after every answer, and a new controller resumes exactly there', async () => {
    stubStorage();
    const config = newSessionConfig('1', 'allied', 'line', 17);
    const c = new GameController(config, new RandomOpponent(rng(5)));
    c.view = { ...c.view, speed: 'instant' };
    c.autoPlay(40);
    c.start();
    for (let i = 0; i < 400 && !(c.view.pending && !c.view.animating && c.driver.answers.length > 40); i++) await new Promise((r) => setTimeout(r, 5));
    const saved = loadSave();
    expect(saved).not.toBeNull();
    expect(saved!.answers.length).toBe(c.driver.answers.length);
    const back = restoreDriver(saved!);
    expect(JSON.stringify(back.state)).toBe(JSON.stringify(c.driver.state));
    const c2 = new GameController(config, new RandomOpponent(), back, historyOf(saved!));
    expect(JSON.stringify(c2.view.display)).toBe(JSON.stringify(c.view.display));
    expect(c2.view.log.some((l) => l.text.includes('resumed'))).toBe(true);
    c.dispose();
    c2.dispose();
  });
});
