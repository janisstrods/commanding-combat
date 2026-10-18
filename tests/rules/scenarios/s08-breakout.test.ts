// Scenario 8, Breakout Dance (scenarios-reference §3): SSR 1 Night Action (Axis Discard Capability 1; Fire Attack Totals
// less the range), SSR 2 Breakout (only the Axis earns Exit VP; a Russian unit that leaves the map is eliminated).
import { describe, expect, it } from 'vitest';
import { exitUnits } from '../../../src/engine/casualties';
import { fireAttack } from '../../../src/engine/fire';
import type { Decision, GameEvent } from '../../../src/engine/types';
import { H, build, passive, rolls, run } from '../../support/build';
import { setUp, special } from './kit';

const G = 'German';
const R = 'Russian';
type FireEvent = Extract<GameEvent, { kind: 'fireAttack' }>;

describe('scenario 8 Breakout Dance', () => {
  it('SSR 1: the Axis may discard only 1 card when he passes', () => {
    const { s, r } = setUp('8', 1);
    const d = r.pending as Extract<Decision, { kind: 'turn' }>;
    expect(d).toMatchObject({ kind: 'turn', side: 'axis' });
    expect(s.players.axis.discard).toBe(1);
    expect(d.maxDiscard).toBe(1);
  });

  it('SSR 1 Night Action: every Fire Attack Total is reduced by the distance to the closest firing hex', () => {
    const fire = (pieces: string[], target: string) => {
      const s = build({
        special: special('8'),
        axis: { top: rolls(G, [8]) },
        allied: { nation: R, top: rolls(R, [11, 11]) },
        pieces: [
          { type: 'German/Rifle Squad', hex: 'E5' }, // p0
          { type: 'German/Rifle Squad', hex: 'E6' }, // p1
          { type: 'Russian/Rifle Squad', hex: 'E2' }, // p2: 3 hexes from E5, 4 from E6
          { type: 'Russian/Rifle Squad', hex: 'E4' }, // p3: adjacent to E5
        ],
      });
      const r = run(s, (ctx) => fireAttack(s, ctx, 'axis', { pieces, target: H(target) }, 'order'), passive);
      return r.events.find((e): e is FireEvent => e.kind === 'fireAttack')!;
    };
    expect(fire(['p0'], 'E2')).toMatchObject({ fp: 5, total: 5 + 8 - 3 });
    expect(fire(['p0', 'p1'], 'E2')).toMatchObject({ fp: 6, total: 6 + 8 - 3 }); // the closer firer counts
    expect(fire(['p0'], 'E4')).toMatchObject({ fp: 5, total: 5 + 8 - 1 });
  });

  it('SSR 2 Breakout: an exiting Russian unit is eliminated; the Germans earn Exit VP as usual', () => {
    const s = build({
      special: special('8'),
      allied: { nation: R },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'A5' }, // p0
        { type: 'German/Rifle Squad', hex: 'E5' }, // p1
        { type: 'Russian/Rifle Squad', hex: 'O5' }, // p2
        { type: 'Russian/Rifle Squad', hex: 'H5' }, // p3
      ],
    });
    run(s, (ctx) => exitUnits(s, ctx, ['p2']), passive);
    expect(s.pieces.p2.where).toBe('casualty');
    expect(s.vp).toBe(2); // elimination VP to the Axis
    run(s, (ctx) => exitUnits(s, ctx, ['p0']), passive);
    expect(s.pieces.p0.where).toBe('time');
    expect(s.vp).toBe(4); // Exit VP
  });
});
