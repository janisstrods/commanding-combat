// Scenario 2, Hedgerows & Hand Grenades (scenarios-reference §3): SSR 1 Forward Observer (late placement), SSR 2 Bocage.
import { describe, expect, it } from 'vitest';
import { areaHexes } from '../../../src/engine/data';
import { stepCost } from '../../../src/engine/orders/move';
import { cover } from '../../../src/engine/stats';
import type { Decision } from '../../../src/engine/types';
import { H, build } from '../../support/build';
import { mapUnits, ofType, setUp, special } from './kit';

type DeployD = Extract<Decision, { kind: 'deploy' }>;

describe('scenario 2 Hedgerows & Hand Grenades', () => {
  it('SSR 1 Forward Observer: Lt Blankenship is placed after the Axis set-up, anywhere without a German unit', () => {
    const { s, r } = setUp('2', 7);
    const deploys = r.decisions.filter((d): d is DeployD => d.kind === 'deploy');
    const lastAxis = deploys.map((d) => d.side).lastIndexOf('axis');
    const late = deploys[deploys.length - 1];
    const lt = ofType(s, 'American/Lt Blankenship')[0];
    expect(late.side).toBe('allied');
    expect(deploys.indexOf(late)).toBeGreaterThan(lastAxis);
    expect(late.pieces).toEqual([lt.id]);
    // the whole map is open to him (also outside the Allied 3-deep area), but no hex holding a German unit
    const alliedArea = new Set(areaHexes(s.scenario.sides.allied.setupArea, s.scenario.sides.allied.edge));
    expect(late.hexes.some((h) => !alliedArea.has(h))).toBe(true);
    for (const u of mapUnits(s, 'axis')) expect(late.hexes).not.toContain(u.hex);
    // and the earlier Allied deployment never offered him
    for (const d of deploys.slice(0, -1)) expect(d.pieces).not.toContain(lt.id);
    expect(lt.where).toBe('map');
  });

  it('SSR 2 Bocage: crossing a Hedge costs 2 more MP and the Hedge gives Cover 2 against fire across it', () => {
    const s = build({
      special: special('2'),
      map: { hexsides: [['E5', 'E4', 'Hedge']] },
      pieces: [
        { type: 'American/Line Squad', hex: 'E4' }, // p0
        { type: 'German/Rifle Squad', hex: 'E2' }, // p1
      ],
    });
    expect(stepCost(s, H('E5'), H('E4'))).toBe(3); // Open 1 + Bocage 2
    expect(stepCost(s, H('D5'), H('D4'))).toBe(1);
    expect(cover(s, 'p0', { firers: [H('E6')] })).toBe(2); // the shot crosses the Hedge into E4
    expect(cover(s, 'p0', { firers: [H('E2')] })).toBe(0);
    const plain = build({ map: { hexsides: [['E5', 'E4', 'Hedge']] }, pieces: [{ type: 'American/Line Squad', hex: 'E4' }] });
    expect(stepCost(plain, H('E5'), H('E4'))).toBe(2);
    expect(cover(plain, 'p0', { firers: [H('E6')] })).toBe(1);
  });
});
