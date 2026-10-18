// Random legal play with all the Actions in the decks: German against Russian (No Quarter both ways), each side the
// Defender in turn (Bore Sighting, the Hidden Actions), MGs and Mortars (Sustained Fire), Fortifications (Demolitions).
// Every random answer to a 'react' decision (and to the 'move' decisions with Actions) is accepted; games finish.
import { describe, expect, it } from 'vitest';
import { GameDriver } from '../../../src/engine/driver';
import { randomAnswer } from '../../../src/engine/random';
import { newGame } from '../../../src/engine/state';
import type { ActionName, GameState } from '../../../src/engine/types';
import { makeMap, testScenario } from '../../support/build';
import { mulberry32 } from '../../support/rng';

const MAP = makeMap({
  terrain: { E4: 'Woods', E5: 'Woods', H5: 'Building', H6: 'Building', K6: 'Woods', C7: 'Brush', L4: 'Orchard', G8: 'Field', C2: 'Woods', J9: 'Building' },
  elevation: { J3: 1, J4: 1, K3: 1 },
  crest: ['J3', 'J4', 'K3'],
  hexsides: [['F6', 'F5', 'Wall'], ['B5', 'B6', 'Hedge']],
  pathHexes: { Road: ['A5', 'B5', 'C5', 'D5'] },
  paths: [['A5', 'B5', 'Road'], ['B5', 'C5', 'Road'], ['C5', 'D5', 'Road']],
  objectives: ['C3', 'E5', 'H5', 'K6', 'M8'],
});

function game(seed: number): GameState {
  const axisDefends = seed % 2 === 0;
  const scn = testScenario({
    axis: { nation: 'German', posture: axisDefends ? 'defend' : 'attack', orders: 3 },
    allied: { nation: 'Russian', posture: axisDefends ? 'attack' : 'defend', orders: 3 },
    suddenDeath: 6,
    initiative: seed % 3 ? 'axis' : 'allied',
    active: axisDefends ? 'allied' : 'axis',
    year: 1943,
  });
  scn.sides.axis.forces = {
    'German/Rifle Squad': 4, 'German/SS Squad': 1, 'German/Lt Von Karsties': 1, 'German/LMG': 1, 'German/HMG': 1, 'German/Light Mortar': 1,
  };
  scn.sides.allied.forces = { 'Russian/Rifle Squad': 4, 'Russian/SMG Squad': 2, 'Russian/Sgt Kovalev': 1, 'Russian/MMG': 1, 'Russian/LMG': 1 };
  scn.sides[axisDefends ? 'axis' : 'allied'].fortifications = { foxholes: 2, wire: 1 };
  scn.sides.axis.surrender = 6;
  scn.sides.allied.surrender = 7;
  scn.openChits = ['random'];
  return newGame(scn, seed * 104729 + 7, MAP);
}

describe('random play with Actions', () => {
  it('80 German-Russian games: every random answer accepted, every game finished, most Actions played', () => {
    const rnd = mulberry32(909);
    const played = new Set<ActionName>();
    let finished = 0;
    for (let seed = 0; seed < 80; seed++) {
      const d = new GameDriver(game(seed));
      let n = 0;
      while (d.pending && n < 8000) {
        const a = randomAnswer(d.state, d.pending, rnd);
        if (!d.answer(a)) throw new Error(`game ${seed}: refused ${JSON.stringify(a)} to ${d.pending.kind}: ${d.lastError}`);
        for (const { e } of d.drainEvents()) if (e.kind === 'cardPlayed' && e.as === 'action') played.add(e.name as ActionName);
        n++;
      }
      if (d.state.phase === 'over') finished++;
    }
    expect(finished).toBe(80);
    expect(played.size).toBeGreaterThanOrEqual(16); // 19 of the 20 playable ones with this seed
  });
});
