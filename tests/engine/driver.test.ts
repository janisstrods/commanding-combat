// GameDriver: answer recording, replay and undo.
import { describe, expect, it } from 'vitest';
import { GameDriver } from '../../src/engine/driver';
import { randomAnswer } from '../../src/engine/random';
import { newGame } from '../../src/engine/state';
import { makeMap, testScenario } from '../support/build';
import { mulberry32 } from '../support/rng';

function game(seed: number) {
  const scn = testScenario({ axis: { posture: 'attack' }, allied: { posture: 'defend' }, suddenDeath: 6 });
  scn.sides.axis.forces = { 'German/Rifle Squad': 3, 'German/Lt Von Karsties': 1, 'German/LMG': 1 };
  scn.sides.allied.forces = { 'American/Line Squad': 3, 'American/Sgt Smith': 1 };
  scn.openChits = ['random'];
  return newGame(scn, seed, makeMap({ terrain: { F5: 'Woods', G6: 'Woods', H5: 'Building' } }));
}

describe('GameDriver', () => {
  it('replays a recorded game into exactly the same state', () => {
    const d = new GameDriver(game(42));
    const rnd = mulberry32(9);
    for (let i = 0; i < 400 && d.pending; i++) expect(d.answer(randomAnswer(d.state, d.pending, rnd))).toBe(true);
    expect(d.answers.length).toBeGreaterThan(50);
    const again = GameDriver.replay(d.initial, d.answers);
    expect(JSON.stringify(again.state)).toBe(JSON.stringify(d.state));
    expect(again.pending).toEqual(d.pending);
  });

  it('refuses an illegal answer and keeps the decision', () => {
    const d = new GameDriver(game(1));
    const before = d.pending;
    expect(d.answer({ kind: 'endTurn' })).toBe(false);
    expect(d.lastError).toBeTruthy();
    expect(d.pending).toEqual(before);
    expect(d.answers).toHaveLength(0);
  });

  it('undoes a deployment step (nothing was revealed), not a step after cards were drawn', () => {
    const d = new GameDriver(game(3));
    const p = d.pending!;
    expect(p.kind).toBe('deploy');
    if (p.kind !== 'deploy') return;
    expect(d.canUndo()).toBe(false);
    d.answer({ kind: 'deploy', piece: p.pieces[0], hex: p.hexes[0] });
    expect(d.canUndo()).toBe(true);
    const back = d.undo();
    expect(back.state.pieces[p.pieces[0]].where).toBe('staging');
    expect(back.answers).toHaveLength(0);
    // finish deployment: the opening hands are dealt (cards revealed), so the last deployment cannot be undone
    d.answer({ kind: 'done' });
    while (d.pending && d.pending.kind === 'deploy') d.answer({ kind: 'done' });
    expect(d.pending?.kind).toBe('turn');
    expect(d.canUndo()).toBe(false);
  });
});
