// The AI's movement search (src/ai/tactics.ts `reachable`) knows the Fortifications on the map: a Mines hex attacks
// the units entering and leaving it (§F103), Wire ends a move (§F106.2).
import { describe, expect, it } from 'vitest';
import { mineLoss, reachable } from '../../src/ai/tactics';
import { H, build } from '../support/build';

describe('the movement search', () => {
  it('goes round a Mines hex when a detour costs no more, and counts the attack when it cannot', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }], fort: { E4: 'mines' } });
    const r = reachable(s, ['p0'], () => 0);
    const to = r.get(H('E3'))!;
    expect(to.path).not.toContain(H('E4'));
    expect(to.risk).toBe(0);
    const into = r.get(H('E4'))!;
    expect(into.risk).toBeCloseTo(mineLoss(s, [s.pieces.p0]));
    expect(into.risk).toBeGreaterThan(0.3);
  });

  it('stops at Wire: no path goes on through a Wire hex', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }], fort: { E4: 'wire' } });
    const r = reachable(s, ['p0'], () => 0);
    expect(r.has(H('E4'))).toBe(true);
    for (const [, x] of r) expect(x.path.slice(0, -1)).not.toContain(H('E4'));
  });

  it('leaving Wire, the move ends one hex further', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }], fort: { E5: 'wire' } });
    const r = reachable(s, ['p0'], () => 0);
    for (const [, x] of r) expect(x.path.length).toBeLessThanOrEqual(1);
    expect(r.size).toBeGreaterThan(1);
  });
});
