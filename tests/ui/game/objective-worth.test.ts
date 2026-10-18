// What each Objective is worth as the human knows it (Objectives panel, hex tips): the open chits plus his own secret
// chits, and "+?" only where a secret chit the enemy may hold could still add to it — from the human's view alone.
import { describe, expect, it } from 'vitest';
import { scenario } from '../../../src/engine/data';
import { newGame, redact } from '../../../src/engine/state';
import type { ChitId, GameState, Side } from '../../../src/engine/types';
import { objectiveWorth, worthText } from '../../../src/ui/game/objectiveWorth';

const HUMAN: Side = 'allied';

/** Scenario 2 (five Objectives) with the chits set as given; nothing else matters here. */
function game(chits: { open?: ChitId[]; mine?: ChitId[]; theirs?: ChitId[]; cup?: ChitId[] }): GameState {
  const s = newGame(scenario('2'), 1);
  s.openChits = chits.open ?? [];
  s.players[HUMAN].secretChits = chits.mine ?? [];
  s.players.axis.secretChits = chits.theirs ?? [];
  s.chitCup = chits.cup ?? [];
  return s;
}

const worth = (s: GameState, n: number) => objectiveWorth(redact(s, HUMAN), HUMAN, n);

describe('objectiveWorth', () => {
  it('counts the open chits as the engine does', () => {
    const w = worth(game({ open: ['B', 'F'] }), 2);
    expect(w).toMatchObject({ open: 3, secret: [], total: 3, more: false });
  });

  it("adds the human's own secret chits, single-Objective and all-Objective ones", () => {
    const s = game({ open: ['B'], mine: ['F', 'T'] });
    expect(worth(s, 2)).toMatchObject({ open: 1, total: 5, secret: [{ chit: 'F', vp: 2 }, { chit: 'T', vp: 2 }] });
    expect(worth(s, 4)).toMatchObject({ open: 0, total: 2, secret: [{ chit: 'T', vp: 2 }] });
  });

  it('marks "+?" only where a secret-sided chit the enemy may hold adds to that Objective', () => {
    // the enemy holds one unknown chit; together with the cup it is Q (Objective 5 +5) or R (no secret side)
    const s = game({ theirs: ['Q'], cup: ['R'] });
    expect([1, 2, 3, 4, 5].map((n) => worth(s, n).more)).toEqual([false, false, false, false, true]);
    // an all-Objective chit in the pool can raise every Objective
    const t = game({ theirs: ['A'], cup: ['S'] });
    expect([1, 2, 3, 4, 5].map((n) => worth(t, n).more)).toEqual([true, true, true, true, true]);
  });

  it('never marks "+?" while the enemy holds no secret chit', () => {
    const s = game({ mine: ['K'], cup: ['S', 'T', 'U', 'Q'] });
    expect([1, 2, 3, 4, 5].some((n) => worth(s, n).more)).toBe(false);
  });

  it("is the same whatever the enemy's secret chits are", () => {
    // K in the enemy's hand and P in the cup, or the other way round: the human cannot tell, and neither may the panel
    const a = game({ mine: ['B'], theirs: ['K'], cup: ['P', 'S'] });
    const b = game({ mine: ['B'], theirs: ['P'], cup: ['K', 'S'] });
    for (const n of [1, 2, 3, 4, 5]) {
      expect(worth(a, n)).toEqual(worth(b, n));
      expect(worthText(redact(a, HUMAN), HUMAN, n)).toBe(worthText(redact(b, HUMAN), HUMAN, n));
    }
  });

  it('spells out the breakdown', () => {
    const s = game({ open: ['C'], mine: ['K'], theirs: ['G'] });
    expect(worthText(redact(s, HUMAN), HUMAN, 3)).toBe(
      'Objective 3: 4 VP — open chits 1 (C +1); your secret chit K +3 (scores once revealed); an enemy secret chit could add more',
    );
    expect(worthText(redact(game({}), HUMAN), HUMAN, 1)).toBe('Objective 1: 0 VP — no chit values it yet');
  });
});
