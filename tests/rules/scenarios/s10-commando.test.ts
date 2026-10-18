// Scenario 10, Commando School (scenarios-reference §3): SSR 1 Combat Engineers, SSR 2 Commandos (+1 to Allied Melee).
import { describe, expect, it } from 'vitest';
import { resolveMelees } from '../../../src/engine/flow';
import type { GameEvent } from '../../../src/engine/types';
import { build, passive, rolls, run } from '../../support/build';
import { ofType, setUp, special } from './kit';

const G = 'German';
const R = 'Russian';
type MeleeEvent = Extract<GameEvent, { kind: 'melee' }>;

describe('scenario 10 Commando School', () => {
  it('SSR 1 Combat Engineers: the two Pionier Squads set up carrying the Flamethrower and the Satchel Charge', () => {
    for (const seed of [1, 2, 3]) {
      const { s } = setUp('10', seed);
      const carried = ofType(s, 'German/Pionier Squad').map((p) => (p.weapon ? s.pieces[p.weapon].type : null)).sort();
      expect(carried).toEqual(['German/Flamethrower', 'German/Satchel Charge']);
    }
  });

  it('SSR 2 Commandos: every Allied Melee total gets +1', () => {
    const melee = (withRule: boolean) => {
      const s = build({
        special: withRule ? special('10') : {},
        allied: { nation: R, top: rolls(R, [6]) },
        axis: { top: rolls(G, [7]) },
        pieces: [
          { type: 'German/Rifle Squad', hex: 'E5' }, // 5 FP
          { type: 'Russian/Guards Rifle Squad', hex: 'E5' }, // 5 FP
          { type: 'German/Rifle Squad', hex: 'L9' },
          { type: 'Russian/Guards Rifle Squad', hex: 'L1' },
        ],
      });
      const r = run(s, (ctx) => resolveMelees(s, ctx), passive);
      return r.events.find((e): e is MeleeEvent => e.kind === 'melee')!;
    };
    expect(melee(false)).toMatchObject({ totals: { axis: 12, allied: 11 }, losers: ['allied'] });
    expect(melee(true)).toMatchObject({ totals: { axis: 12, allied: 12 }, losers: ['axis', 'allied'] });
  });
});
