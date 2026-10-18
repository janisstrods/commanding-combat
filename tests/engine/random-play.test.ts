// Smoke test: random legal play of many whole games on a synthetic scenario never throws or hangs, every answer
// randomAnswer gives is accepted, and the state stays consistent.
import { describe, expect, it } from 'vitest';
import { GameDriver } from '../../src/engine/driver';
import { randomAnswer } from '../../src/engine/random';
import { newGame } from '../../src/engine/state';
import type { GameState } from '../../src/engine/types';
import { makeMap, testScenario } from '../support/build';
import { mulberry32 } from '../support/rng';

const MAP = makeMap({
  terrain: { E4: 'Woods', E5: 'Woods', H5: 'Building', H6: 'Building', K6: 'Woods', C7: 'Brush', L4: 'Orchard', G8: 'Field' },
  elevation: { J3: 1, J4: 1, K3: 1 },
  crest: ['J3', 'J4', 'K3'],
  hexsides: [['F6', 'F5', 'Wall'], ['B5', 'B6', 'Hedge']],
  pathHexes: { Road: ['A5', 'B5', 'C5', 'D5'] },
  paths: [['A5', 'B5', 'Road'], ['B5', 'C5', 'Road'], ['C5', 'D5', 'Road']],
  objectives: ['C3', 'E5', 'H5', 'K6', 'M8'],
});

function game(seed: number): GameState {
  const scn = testScenario({
    axis: { posture: seed % 3 === 0 ? 'recon' : 'attack', orders: 3 },
    allied: { posture: seed % 3 === 0 ? 'recon' : 'defend', orders: 2 },
    suddenDeath: 4 + (seed % 4),
    time: seed % 2,
    initiative: seed % 2 ? 'axis' : 'allied',
    active: seed % 2 ? 'allied' : 'axis',
  });
  scn.sides.axis.forces = { 'German/Rifle Squad': 4, 'German/Lt Von Karsties': 1, 'German/Cpl Winkler': 1, 'German/LMG': 1, 'German/Light Mortar': 1, 'German/Line Team': 1 };
  scn.sides.allied.forces = { 'American/Line Squad': 4, 'American/Sgt Smith': 1, 'American/MMG': 1, 'American/Line Team': 1 };
  scn.sides.axis.surrender = 5;
  scn.sides.allied.surrender = 5;
  scn.sides.allied.reinforcements = { 2: { 'American/Line Squad': 1 } };
  scn.openChits = ['random'];
  scn.sides.axis.secretChits = ['random'];
  scn.sides.allied.secretChits = ['random'];
  return newGame(scn, seed * 7919 + 1, MAP);
}

function consistent(s: GameState): string | null {
  for (const side of ['axis', 'allied'] as const) {
    const p = s.players[side];
    const all = [...p.hand, ...p.deck, ...p.discards];
    if (all.length !== 72 || new Set(all).size !== 72) return `${side} has ${all.length} cards (${new Set(all).size} distinct)`;
    if (!p.deck.length && s.phase !== 'over') return `${side}'s draw pile is empty`;
  }
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'carried' && (!p.carrier || s.pieces[p.carrier].weapon !== id)) return `${id} is carried by nobody`;
    if (p.weapon && s.pieces[p.weapon].carrier !== id) return `${id}'s weapon has another carrier`;
    if (p.where === 'map' && (p.hex < 0 || p.hex >= 150)) return `${id} is off the map`;
  }
  return null;
}

describe('random play', () => {
  it('plays 200 whole games without an error, every random answer accepted', () => {
    const rnd = mulberry32(2026);
    let finished = 0;
    let decisions = 0;
    const reasons: Record<string, number> = {};
    const seen: Record<string, number> = {}; // Orders given and Task 7 results, for coverage
    for (let seed = 0; seed < 200; seed++) {
      const d = new GameDriver(game(seed));
      let n = 0;
      while (d.pending && n < 6000) {
        const a = randomAnswer(d.state, d.pending, rnd);
        if (!d.answer(a)) throw new Error(`game ${seed}: refused ${JSON.stringify(a)} to ${d.pending.kind}: ${d.lastError}`);
        n++;
      }
      for (const { e } of d.drainEvents()) {
        const k = e.kind === 'cardPlayed' && e.as === 'order' ? e.name : e.kind;
        if (['Advance', 'Recover', 'Rout', 'melee', 'retreat', 'rally'].includes(k)) seen[k] = (seen[k] ?? 0) + 1;
      }
      decisions += n;
      const bad = consistent(d.state);
      if (bad) throw new Error(`game ${seed}: ${bad}`);
      if (d.state.phase === 'over') {
        finished++;
        reasons[d.state.endReason!] = (reasons[d.state.endReason!] ?? 0) + 1;
      }
    }
    expect(finished).toBe(200);
    expect(decisions).toBeGreaterThan(200 * 20);
    expect(Object.keys(reasons).length).toBeGreaterThan(1);
    for (const k of ['Advance', 'Recover', 'Rout', 'melee', 'retreat', 'rally']) expect(seen[k] ?? 0, k).toBeGreaterThan(0);
  });
});
