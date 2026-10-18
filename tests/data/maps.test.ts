// Maps (src/data/maps/<id>.json via loadMap): every hex, objectives, hexsides and paths, terrain upgrades, crests,
// buildings and mask decoding.
import { describe, expect, it } from 'vitest';
import { MAP_IDS, decodeMask, loadMap } from '../../src/engine/data';
import { ALL_HEXES, NUM_HEXES, edgeHexsides, hexsideBetween, hexsideKey, neighbours, parseHex, sideTo } from '../../src/engine/hex';
import type { HexSide, TerrainType } from '../../src/engine/types';

type Raw = {
  id: string;
  hexes: Record<string, unknown>;
  hexsides: { between: [string, string] }[];
  paths: ({ between: [string, string] } | { hex: string; side: HexSide })[];
};
const RAW = Object.values(import.meta.glob<Raw>('../../src/data/maps/*.json', { eager: true, import: 'default' }));

/** Task 4's masks audit, per map (optional file). */
type Audit = Record<string, { typeUpgrades: Record<string, TerrainType>; levelFixes: Record<string, number>; crest: string[]; buildings: string[][] }>;
const AUDIT: Audit | undefined = Object.values(
  import.meta.glob<Audit>('../../design/data/masks-audit.json', { eager: true, import: 'default' }),
)[0];
const H = parseHex;

const TYPES: TerrainType[] = ['Open', 'Woods', 'Brush', 'Orchard', 'Field', 'Building', 'MajorBridge', 'MinorBridge', 'Gully', 'Water', 'Stream', 'Marsh'];

describe('maps', () => {
  it('has all thirteen maps (1-12 and the winter 5w)', () => {
    expect([...MAP_IDS]).toEqual(['1', '2', '3', '4', '5', '5w', '6', '7', '8', '9', '10', '11', '12']);
  });

  for (const raw of RAW) {
    describe(`map ${raw.id}`, () => {
      const m = loadMap(raw.id);

      it('has a terrain type and a level 0..4 for each of the 150 hexes', () => {
        expect(Object.keys(raw.hexes)).toHaveLength(NUM_HEXES);
        expect(m.terrain).toHaveLength(NUM_HEXES);
        for (const h of ALL_HEXES) {
          expect(TYPES).toContain(m.terrain[h]);
          expect(m.elevation[h] >= 0 && m.elevation[h] <= 4).toBe(true);
        }
      });

      it('has objectives 1-5 on five different passable hexes', () => {
        expect(m.objectives).toHaveLength(5);
        expect(new Set(m.objectives).size).toBe(5);
        for (const h of m.objectives) expect(m.terrain[h]).not.toBe('Water');
      });

      it('puts hexside features only between adjacent hexes', () => {
        for (const s of raw.hexsides) expect(sideTo(H(s.between[0]), H(s.between[1])), s.between.join('-')).not.toBeNull();
        expect(Object.keys(m.hexsides)).toHaveLength(new Set(raw.hexsides.map((s) => hexsideBetween(H(s.between[0]), H(s.between[1])))).size);
      });

      it('connects paths between adjacent hexes or across the map edge', () => {
        for (const p of raw.paths) {
          if ('between' in p) expect(sideTo(H(p.between[0]), H(p.between[1])), p.between.join('-')).not.toBeNull();
          else expect(edgeHexsides(H(p.hex))).toContain(p.side);
        }
        expect(Object.keys(m.paths).length).toBeGreaterThan(0);
      });

      it.skipIf(!!AUDIT?.[raw.id]?.crest)('marks crest hexes exactly where a neighbour is lower (no audit list)', () => {
        for (const h of ALL_HEXES) {
          const lower = neighbours(h).some((n) => m.elevation[n] < m.elevation[h]);
          expect(m.crest[h], `hex ${h}`).toBe(lower);
        }
      });

      it('gives every Building hex a building id and no other hex one', () => {
        for (const h of ALL_HEXES) expect(m.building[h] >= 0).toBe(m.terrain[h] === 'Building');
      });

      it('enters bridge hexes along their paths, and a Major Bridge across exactly two', () => {
        for (const h of ALL_HEXES) {
          if (m.terrain[h] !== 'MajorBridge' && m.terrain[h] !== 'MinorBridge') continue;
          const sides = ([1, 2, 3, 4, 5, 6] as HexSide[]).filter((s) => m.paths[hexsideKey(h, s)]);
          if (m.terrain[h] === 'MajorBridge') expect(sides).toHaveLength(2);
          else expect(sides.length).toBeGreaterThanOrEqual(2);
        }
      });

      it('lists path hexes from the hexes\' own depictions', () => {
        const road = m.pathHexes.Road ?? [];
        const trail = m.pathHexes.Trail ?? [];
        const rail = m.pathHexes.Railway ?? [];
        expect(road.some(Boolean) || trail.some(Boolean) || rail.some(Boolean)).toBe(true);
      });

      it('is converted once and cached', () => {
        expect(loadMap(raw.id)).toBe(m);
      });
    });
  }

  it.skipIf(!AUDIT)('reflects every masks-audit entry (types, levels, crests, multi-hex buildings)', () => {
    for (const [id, a] of Object.entries(AUDIT!)) {
      const m = loadMap(id);
      for (const [hex, t] of Object.entries(a.typeUpgrades ?? {})) expect(m.terrain[H(hex)], `map ${id} ${hex}`).toBe(t);
      for (const [hex, lv] of Object.entries(a.levelFixes ?? {})) expect(m.elevation[H(hex)], `map ${id} ${hex}`).toBe(lv);
      if (a.crest) {
        const crest = new Set(a.crest.map(H));
        for (const h of ALL_HEXES) expect(m.crest[h], `map ${id} crest ${h}`).toBe(crest.has(h));
      }
      for (const g of a.buildings ?? []) {
        const ids = new Set(g.map((hex) => m.building[H(hex)]));
        expect(ids.size, `map ${id} building ${g.join(',')}`).toBe(1);
        expect([...ids][0]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('applies the terrain rulings (§T78.1 upgrades and bridges)', () => {
    expect(loadMap('1').terrain[H('D3')]).toBe('Woods');
    expect(loadMap('1').terrain[H('G6')]).toBe('Water');
    expect(loadMap('5').terrain[H('F4')]).toBe('Building');
    expect(loadMap('5').terrain[H('G6')]).toBe('MinorBridge');
    expect(loadMap('5w').terrain[H('G6')]).toBe('MinorBridge');
    expect(loadMap('6').terrain[H('N6')]).toBe('Building');
    expect(loadMap('9').terrain[H('K2')]).toBe('Building');
    expect(loadMap('9').elevation[H('K2')]).toBe(1);
    for (const h of ['D6', 'D7', 'D8', 'G1', 'K7', 'O7']) expect(loadMap('10').terrain[H(h)], h).toBe('Building');
    expect(loadMap('10').terrain[H('F6')]).toBe('MajorBridge');
    expect(loadMap('10').terrain[H('H8')]).toBe('Open'); // lake edge with a road through it: not Water
    expect(loadMap('12').terrain[H('F10')]).toBe('Building');
  });

  it('reads map 1 like the pilot: roads, fences and a flat map', () => {
    const m = loadMap('1');
    expect(m.objectives).toEqual(['E8', 'D3', 'H8', 'N5', 'F6'].map(H));
    expect(m.hexsides[hexsideBetween(H('F5'), H('F6'))!]).toBe('Fence');
    expect(m.paths[hexsideBetween(H('A2'), H('B2'))!]).toBe('Road');
    expect(m.paths[hexsideKey(H('A2'), 6)]).toBe('Road'); // map-edge exit
    expect(m.pathHexes.Road![H('A2')]).toBe(true);
    expect(m.elevation.every((e) => e === 0)).toBe(true);
    expect(m.crest.some(Boolean)).toBe(false);
  });

  it('keeps hills, cliffs and multi-hex buildings', () => {
    const m12 = loadMap('12');
    expect(m12.elevation[H('H4')]).toBe(3);
    expect(m12.hexsides[hexsideBetween(H('H4'), H('I4'))!]).toBe('Cliff');
    expect(m12.crest[H('H4')]).toBe(true);
    const m4 = loadMap('4');
    expect(m4.building[H('M3')]).toBe(m4.building[H('N3')]);
    expect(m4.building[H('M4')]).toBe(m4.building[H('N3')]);
    const m10 = loadMap('10');
    expect(m10.building[H('F1')]).toBe(m10.building[H('G1')]);
    expect(sideTo(H('F1'), H('G1'))).not.toBeNull();
  });

  it('decodes run-length masks', () => {
    const mask = decodeMask({ res: 8, x0: -1, y0: -1, width: 3, height: 2, cls: [1, 2, 0, 3, 9, 1], level: [0, 6] });
    expect(Array.from(mask.cls)).toEqual([1, 1, 0, 0, 0, 9]);
    expect(Array.from(mask.level)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(() => decodeMask({ res: 8, x0: 0, y0: 0, width: 2, height: 2, cls: [1, 3], level: [0, 4] })).toThrow();
  });
});
