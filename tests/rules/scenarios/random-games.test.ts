// Random legal play of whole games of every historical scenario with its special rules: no throw, every random answer
// accepted, each game ends, the decks and Weapons stay consistent, and a few of the rules hold throughout.
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../../src/engine/data';
import { GameDriver } from '../../../src/engine/driver';
import { randomAnswer } from '../../../src/engine/random';
import { newGame } from '../../../src/engine/state';
import { figures } from '../../../src/engine/stats';
import type { FortKind, GameState } from '../../../src/engine/types';
import { mulberry32 } from '../../support/rng';

const FORTS: readonly string[] = ['foxholes', 'trench', 'pillbox', 'bunker', 'wire', 'mines'] satisfies FortKind[];

function consistent(s: GameState): string | null {
  for (const side of ['axis', 'allied'] as const) {
    const p = s.players[side];
    const all = [...p.hand, ...p.deck, ...p.discards];
    if (all.length !== 72 || new Set(all).size !== 72) return `${side} has ${all.length} cards`;
  }
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'carried' && (!p.carrier || s.pieces[p.carrier].weapon !== id)) return `${id} is carried by nobody`;
    if (p.weapon && s.pieces[p.weapon].carrier !== id) return `${id}'s weapon has another carrier`;
  }
  return null;
}

describe('random games of the twelve scenarios', () => {
  for (const scn of SCENARIOS) {
    it(`scenario ${scn.id} ${scn.name}: 3 whole games`, () => {
      const rnd = mulberry32(1500 + Number(scn.id));
      for (let g = 0; g < 3; g++) {
        const d = new GameDriver(newGame(scn, 7919 * g + Number(scn.id)));
        let n = 0;
        let fortsAfterSetup = 0;
        let playing = false;
        let exits = { axis: 0, allied: 0 };
        while (d.pending && n < 40000) {
          const a = randomAnswer(d.state, d.pending, rnd);
          if (!d.answer(a)) throw new Error(`scenario ${scn.id} game ${g}: refused ${JSON.stringify(a)} to ${d.pending.kind}: ${d.lastError}`);
          n++;
          for (const { e } of d.drainEvents()) {
            if (e.kind === 'turnStart') playing = true;
            if (playing && e.kind === 'place' && e.marker && FORTS.includes(e.marker)) fortsAfterSetup++;
            if (e.kind === 'exit') exits = { ...exits, [d.state.pieces[e.units[0]].side]: exits[d.state.pieces[e.units[0]].side] + 1 };
          }
          if (scn.special.fortStackingLimits && d.pending?.kind === 'turn' && d.pending.canPass) {
            // the Sherman's Bunker hex: never more than 4 figures of a side once a Turn's overstacking is settled
            const h = d.state.fort.indexOf('bunker');
            if (h >= 0) for (const side of ['axis', 'allied'] as const) expect(figures(d.state, h, side)).toBeLessThanOrEqual(4);
          }
        }
        expect(d.state.phase, `scenario ${scn.id} game ${g} (${n} decisions)`).toBe('over');
        expect(consistent(d.state), `scenario ${scn.id} game ${g}`).toBeNull();
        if (scn.special.noNewFortifications) expect(fortsAfterSetup).toBe(0);
        for (const side of scn.special.noExit ?? []) expect(exits[side]).toBe(0);
        if (scn.special.fog) expect(d.state.fog ?? scn.special.fog).toBeGreaterThanOrEqual(0);
      }
    }, 120_000);
  }
});
