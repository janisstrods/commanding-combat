// Scenario 3, Bonfire of the NKVD (scenarios-reference §3): SSR 1 Command Post, SSR 2 Hidden Fortifications (Wire after
// the Axis set-up), SSR 3 chits V, W, X left out, SSR 4 Sappers (card G-65 in the opening hand).
import { describe, expect, it } from 'vitest';
import { areaHexes } from '../../../src/engine/data';
import { parseHex } from '../../../src/engine/hex';
import type { Decision } from '../../../src/engine/types';
import { ofType, setUp } from './kit';

describe('scenario 3 Bonfire of the NKVD', () => {
  it('SSR 1 Command Post: Cpt Egorov sets up in N5', () => {
    for (const seed of [1, 2, 3]) {
      const { s, r } = setUp('3', seed);
      const egorov = ofType(s, 'Russian/Cpt Egorov')[0];
      expect(egorov).toMatchObject({ where: 'map', hex: parseHex('N5') });
      // he is never offered to the player: the rule places him
      for (const d of r.decisions) if (d.kind === 'deploy') expect(d.pieces).not.toContain(egorov.id);
    }
  });

  it('SSR 2 Hidden Fortifications: the Allies place their 12 Wire after the Axis has set up, in their own area', () => {
    const { s, r } = setUp('3', 4);
    const kinds = r.decisions.map((d: Decision) => (d.kind === 'choose' ? `choose:${d.reason}` : `${d.kind}:${d.side}`));
    const lastAxisDeploy = kinds.lastIndexOf('deploy:axis');
    const firstWire = kinds.indexOf('choose:placement');
    expect(lastAxisDeploy).toBeGreaterThan(-1);
    expect(firstWire).toBeGreaterThan(lastAxisDeploy);
    const area = new Set(areaHexes(s.scenario.sides.allied.setupArea, s.scenario.sides.allied.edge));
    const wire = s.fort.map((f, h) => (f === 'wire' ? h : -1)).filter((h) => h >= 0);
    expect(wire).toHaveLength(12);
    for (const h of wire) expect(area.has(h)).toBe(true);
  });

  it('SSR 3: chits V, W and X are out of the cup', () => {
    const { s } = setUp('3', 5);
    for (const c of ['V', 'W', 'X']) {
      expect(s.chitCup).not.toContain(c);
      expect(s.openChits).not.toContain(c);
    }
    expect(s.openChits.sort()).toEqual(['Q', 'R', 'S']);
  });

  it('SSR 4 Sappers: the Axis opening hand holds card G-65 and still has 6 cards', () => {
    for (const seed of [6, 7]) {
      const { s } = setUp('3', seed);
      const axis = s.players.axis;
      expect(axis.hand).toContain('G-65');
      expect(axis.hand).toHaveLength(6);
      expect(axis.deck).not.toContain('G-65');
      expect(new Set([...axis.hand, ...axis.deck, ...axis.discards]).size).toBe(72);
    }
  });
});
