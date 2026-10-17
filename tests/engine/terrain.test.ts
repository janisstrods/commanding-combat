// The Terrain Effects Chart (rules-reference §T-TEC, §T78, §T88.1, §T93, §F105) as data and the movement-cost helper.
import { describe, expect, it } from 'vitest';
import {
  HEXSIDE,
  TERRAIN,
  enterBlock,
  hasPath,
  hasRoad,
  hexsideFeature,
  hexsideInfo,
  hindranceOf,
  isImpassable,
  isObstacle,
  isTrenchMove,
  isWaterHex,
  moveCost,
  pathBetween,
  terrainCover,
} from '../../src/engine/terrain';
import { loadMap } from '../../src/engine/data';
import { NUM_HEXES } from '../../src/engine/hex';
import type { FortKind, TerrainType } from '../../src/engine/types';
import { H, openMap, setHexside, setLevel, setPath, setTerrain } from '../support/maps';

describe('the terrain chart (§T-TEC)', () => {
  it('has the chart values for every terrain type', () => {
    const row = (t: TerrainType) => {
      const { move, cover, hindrance, obstacle, water, blindHex } = TERRAIN[t];
      return [move, cover, hindrance, obstacle, water, blindHex];
    };
    expect(row('Building')).toEqual([2, 3, 0, true, false, true]);
    expect(row('Woods')).toEqual([2, 2, 0, true, false, true]);
    expect(row('Brush')).toEqual([2, 1, 3, false, false, false]);
    expect(row('Orchard')).toEqual([1, 1, 2, false, false, false]);
    expect(row('Field')).toEqual([1, 0, 1, false, false, false]);
    expect(row('MajorBridge')).toEqual([null, 2, 1, false, false, false]);
    expect(row('MinorBridge')).toEqual([3, 2, 1, false, false, false]);
    expect(row('Gully')).toEqual([2, 1, 0, false, false, false]);
    expect(row('Water')).toEqual([null, null, 0, false, true, false]);
    expect(row('Stream')).toEqual([3, -1, 0, false, true, false]);
    expect(row('Marsh')).toEqual([3, 0, 1, false, true, false]);
    expect(row('Open')).toEqual([1, 0, 0, false, false, false]);
  });

  it('names every terrain type for the UI', () => {
    expect(TERRAIN.Water.name).toBe('Water Barrier');
    expect(TERRAIN.Open.name).toBe('Open Ground');
    expect(TERRAIN.MajorBridge.name).toBe('Major Bridge');
    expect(Object.values(TERRAIN).every((t) => t.name.length > 0)).toBe(true);
  });

  it('has the chart values for every hexside feature', () => {
    expect(HEXSIDE.Fence).toEqual({ name: 'Fence', cost: 1, cover: 0, hindrance: 1, obstacle: false });
    expect(HEXSIDE.Hedge).toEqual({ name: 'Hedge', cost: 1, cover: 1, hindrance: 0, obstacle: true });
    expect(HEXSIDE.Wall).toEqual({ name: 'Wall', cost: 1, cover: 2, hindrance: 0, obstacle: true });
    expect(HEXSIDE.Cliff).toEqual({ name: 'Cliff', cost: null, cover: 0, hindrance: 0, obstacle: false });
  });

  it('applies the scenario 2 Bocage override to Hedges only', () => {
    const bocage = { hedge: { cost: 2, cover: 2 } };
    expect(hexsideInfo('Hedge', bocage)).toMatchObject({ cost: 2, cover: 2, obstacle: true });
    expect(hexsideInfo('Hedge')).toBe(HEXSIDE.Hedge);
    expect(hexsideInfo('Wall', bocage)).toBe(HEXSIDE.Wall);
  });
});

describe('hex queries', () => {
  it('reads Cover with the Road −1 (§T93)', () => {
    const map = openMap();
    setTerrain(map, 'C3', 'Building');
    setTerrain(map, 'C5', 'Woods');
    setTerrain(map, 'C7', 'Stream');
    setPath(map, ['A2', 'B2', 'C3', 'D3'], 'Road');
    setPath(map, ['F2', 'F3'], 'Trail');
    expect(terrainCover(map, H('C3'))).toBe(2); // Building + Road
    expect(terrainCover(map, H('B2'))).toBe(-1); // Open + Road
    expect(terrainCover(map, H('C5'))).toBe(2);
    expect(terrainCover(map, H('C7'))).toBe(-1);
    expect(terrainCover(map, H('F2'))).toBe(0); // a Trail changes nothing
    setTerrain(map, 'G5', 'Water');
    expect(terrainCover(map, H('G5'))).toBe(0); // n/a: no unit is ever there
  });

  it('knows roads, paths and what crosses a hexside', () => {
    const map = openMap();
    setPath(map, ['A2', 'B2'], 'Road');
    setPath(map, ['C3', 'C4'], 'Railway');
    setHexside(map, 'E5', 'E6', 'Wall');
    expect(hasRoad(map, H('A2'))).toBe(true);
    expect(hasRoad(map, H('C3'))).toBe(false);
    expect(hasPath(map, H('C3'), 'Railway')).toBe(true);
    expect(pathBetween(map, H('A2'), H('B2'))).toBe('Road');
    expect(pathBetween(map, H('B2'), H('A2'))).toBe('Road');
    expect(pathBetween(map, H('A2'), H('A3'))).toBeNull();
    expect(hexsideFeature(map, H('E6'), H('E5'))).toBe('Wall');
    expect(hexsideFeature(map, H('E6'), H('E7'))).toBeNull();
    expect(hexsideFeature(map, H('E6'), H('E9'))).toBeNull();
  });

  it('gives the whole-hex LOS Hindrance, with a Railway as 1', () => {
    const map = openMap();
    const t: [string, TerrainType, number][] = [
      ['A1', 'Brush', 3],
      ['A2', 'Orchard', 2],
      ['A3', 'Field', 1],
      ['A4', 'Marsh', 1],
      ['A5', 'MajorBridge', 1],
      ['A6', 'MinorBridge', 1],
      ['A7', 'Woods', 0],
      ['A8', 'Gully', 0],
      ['A9', 'Stream', 0],
    ];
    for (const [lab, terrain] of t) setTerrain(map, lab, terrain);
    for (const [lab, , hind] of t) expect(hindranceOf(map, H(lab)), lab).toBe(hind);
    setPath(map, ['C1', 'C2'], 'Railway');
    setTerrain(map, 'C2', 'Brush');
    expect(hindranceOf(map, H('C1'))).toBe(1);
    expect(hindranceOf(map, H('C2'))).toBe(3);
  });

  it('classifies obstacles, impassable and water hexes', () => {
    const map = openMap();
    setTerrain(map, 'A1', 'Woods');
    setTerrain(map, 'A2', 'Building');
    setTerrain(map, 'A3', 'Water');
    setTerrain(map, 'A4', 'Stream');
    setTerrain(map, 'A5', 'Marsh');
    setTerrain(map, 'A6', 'MajorBridge');
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => isObstacle(map, H(`A${n}`)))).toEqual([true, true, false, false, false, false, false]);
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => isImpassable(map, H(`A${n}`)))).toEqual([false, false, true, false, false, false, false]);
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => isWaterHex(map, H(`A${n}`)))).toEqual([false, false, true, true, true, false, false]);
  });
});

describe('moveCost (§O21.1, §T-TEC, §T88.1)', () => {
  it('charges the terrain cost of the hex entered', () => {
    const map = openMap();
    const costs: [TerrainType, number | null][] = [
      ['Open', 1],
      ['Woods', 2],
      ['Brush', 2],
      ['Orchard', 1],
      ['Field', 1],
      ['Building', 2],
      ['Gully', 2],
      ['Stream', 3],
      ['Marsh', 3],
      ['Water', null],
    ];
    for (const [t, c] of costs) {
      setTerrain(map, 'D5', t);
      expect(moveCost(map, H('C5'), H('D5')), t).toBe(c);
    }
  });

  it('refuses non-adjacent hexes', () => {
    expect(moveCost(openMap(), H('C5'), H('C7'))).toBeNull();
    expect(moveCost(openMap(), H('C5'), H('C5'))).toBeNull();
    expect(enterBlock(openMap(), H('C5'), H('C7'))).toBe('notAdjacent');
  });

  it('makes Open Ground cost 1.5 in the snow (scenario 5), but nothing else', () => {
    const map = openMap();
    setTerrain(map, 'C6', 'Field');
    expect(moveCost(map, H('C5'), H('D5'), { openCost: 1.5 })).toBe(1.5);
    expect(moveCost(map, H('C5'), H('C6'), { openCost: 1.5 })).toBe(1);
  });

  it('costs 1 along a Road, Trail or Railway: crossing its hexside into a hex with it (§T92, §T93, §T96)', () => {
    for (const kind of ['Road', 'Trail', 'Railway'] as const) {
      const map = openMap();
      setTerrain(map, ['D5', 'D6'], 'Woods');
      setPath(map, ['C5', 'D5', 'E5'], kind);
      expect(moveCost(map, H('C5'), H('D5')), kind).toBe(1);
      // into the path hex across a hexside without the path: the Woods cost
      expect(moveCost(map, H('D4'), H('D5')), kind).toBe(2);
      // leaving the path into a hex without it
      expect(moveCost(map, H('D5'), H('D6')), kind).toBe(2);
      // the snow's Open Ground cost does not apply along a road
      setTerrain(map, 'E5', 'Open');
      expect(moveCost(map, H('D5'), H('E5'), { openCost: 1.5 }), kind).toBe(1);
    }
  });

  it('adds +1 to cross a Fence, Wall or Hedge (Bocage: the scenario cost) and refuses a Cliff', () => {
    const map = openMap();
    setHexside(map, 'C5', 'D5', 'Fence');
    setHexside(map, 'C5', 'C6', 'Wall');
    setHexside(map, 'C5', 'B5', 'Hedge');
    setHexside(map, 'C5', 'C4', 'Cliff');
    setTerrain(map, 'C6', 'Woods');
    expect(moveCost(map, H('C5'), H('D5'))).toBe(2);
    expect(moveCost(map, H('C5'), H('C6'))).toBe(3);
    expect(moveCost(map, H('C5'), H('B5'))).toBe(2);
    expect(moveCost(map, H('C5'), H('B5'), { hedge: { cost: 2, cover: 2 } })).toBe(3);
    expect(moveCost(map, H('C5'), H('C4'))).toBeNull();
    expect(moveCost(map, H('C4'), H('C5'))).toBeNull();
    expect(enterBlock(map, H('C5'), H('C4'))).toBe('cliff');
  });

  it('adds +1 once to enter a higher hex, whatever the climb; downhill is free (T88.1 example)', () => {
    const map = openMap();
    setTerrain(map, ['C5', 'C6'], 'Woods');
    setLevel(map, 'C5', 1);
    setLevel(map, 'C6', 2);
    expect(moveCost(map, H('C5'), H('C6'))).toBe(3);
    expect(moveCost(map, H('C6'), H('C5'))).toBe(2);
    setLevel(map, 'D5', 3);
    expect(moveCost(map, H('C5'), H('D5'))).toBe(2);
  });

  it('enters and leaves a Major Bridge only along its road or railway (§T80.1)', () => {
    const map = openMap();
    setTerrain(map, ['E5', 'E6'], 'MajorBridge');
    setTerrain(map, ['D5', 'F5', 'D6', 'F6'], 'Stream');
    setPath(map, ['E4', 'E5', 'E6', 'E7'], 'Road');
    expect(moveCost(map, H('E4'), H('E5'))).toBe(1);
    expect(moveCost(map, H('E5'), H('E6'))).toBe(1);
    expect(moveCost(map, H('E6'), H('E7'))).toBe(1);
    expect(moveCost(map, H('D5'), H('E5'))).toBeNull();
    expect(moveCost(map, H('E5'), H('F5'))).toBeNull();
    expect(enterBlock(map, H('D5'), H('E5'))).toBe('bridge');
    expect(enterBlock(map, H('E5'), H('F5'))).toBe('bridge');
    // a Trail does not carry a unit onto a Major Bridge
    setPath(map, ['D5', 'E5'], 'Trail');
    expect(moveCost(map, H('D5'), H('E5'))).toBeNull();
  });

  it('costs 1 onto a Minor Bridge across its road hexside, else the Stream it spans (§T80.2)', () => {
    const map = openMap();
    setTerrain(map, 'E5', 'MinorBridge');
    setPath(map, ['E4', 'E5', 'E6'], 'Road');
    expect(moveCost(map, H('E4'), H('E5'))).toBe(1);
    expect(moveCost(map, H('D5'), H('E5'))).toBe(3);
    expect(moveCost(map, H('E5'), H('D5'))).toBe(1); // leaving it is free of restrictions
  });

  it('refuses Water Barrier and Blaze hexes', () => {
    const map = openMap();
    setTerrain(map, 'D5', 'Water');
    expect(enterBlock(map, H('C5'), H('D5'))).toBe('water');
    const blaze = Array<boolean>(NUM_HEXES).fill(false);
    blaze[H('C6')] = true;
    expect(moveCost(map, H('C5'), H('C6'), {}, { blaze })).toBeNull();
    expect(enterBlock(map, H('C5'), H('C6'), { blaze })).toBe('blaze');
    expect(moveCost(map, H('C5'), H('C4'), {}, { blaze })).toBe(1);
  });

  it('costs exactly 1 between Trench-connected hexes, whatever the terrain, hexside or climb, but never over a Cliff (§F105)', () => {
    const map = openMap();
    setTerrain(map, 'C6', 'Woods');
    setLevel(map, 'C6', 1);
    setHexside(map, 'C5', 'C6', 'Wall');
    const fort = Array<FortKind | null>(NUM_HEXES).fill(null);
    fort[H('C5')] = 'trench';
    fort[H('C6')] = 'trench';
    expect(moveCost(map, H('C5'), H('C6'))).toBe(4);
    expect(moveCost(map, H('C5'), H('C6'), {}, { fort })).toBe(1);
    fort[H('C6')] = 'bunker';
    expect(moveCost(map, H('C5'), H('C6'), {}, { fort })).toBe(1);
    fort[H('C5')] = 'pillbox';
    expect(moveCost(map, H('C5'), H('C6'), {}, { fort })).toBe(4); // no Trench involved
    fort[H('C5')] = 'trench';
    setHexside(map, 'C5', 'C6', 'Cliff');
    expect(moveCost(map, H('C5'), H('C6'), {}, { fort })).toBeNull();
  });

  it('tells which fortification pairs make a trench move (no Op Fire in the hex entered)', () => {
    expect(isTrenchMove('trench', 'trench')).toBe(true);
    expect(isTrenchMove('trench', 'bunker')).toBe(true);
    expect(isTrenchMove('pillbox', 'trench')).toBe(true);
    expect(isTrenchMove('bunker', 'pillbox')).toBe(false);
    expect(isTrenchMove('trench', 'foxholes')).toBe(false);
    expect(isTrenchMove('trench', null)).toBe(false);
  });
});

describe('moveCost on the real maps', () => {
  it('Map 10: the Major Bridge F6 over the lake is crossed only along its road', () => {
    const map = loadMap('10');
    expect(map.terrain[H('F6')]).toBe('MajorBridge');
    expect(moveCost(map, H('E6'), H('F6'))).toBe(1);
    expect(moveCost(map, H('F6'), H('G7'))).toBe(1);
    expect(moveCost(map, H('F6'), H('F5'))).toBeNull();
  });

  it('Map 5: the Minor Bridge G6 costs 1 along its road, the Stream cost otherwise', () => {
    const map = loadMap('5');
    expect(map.terrain[H('G6')]).toBe('MinorBridge');
    expect(moveCost(map, H('F5'), H('G6'))).toBe(1);
    expect(moveCost(map, H('G5'), H('G6'))).toBe(3);
  });

  it('Map 1: along the O-column road every hex costs 1, into the woods beside it 2', () => {
    const map = loadMap('1');
    for (let n = 1; n < 9; n++) expect(moveCost(map, H(`O${n}`), H(`O${n + 1}`))).toBe(1);
    expect(moveCost(map, H('M6'), H('M7'))).toBe(2);
  });
});
