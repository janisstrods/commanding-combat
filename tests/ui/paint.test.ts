// The pure parts of the terrain painting: the terrain field, linear features and building blocks.
import { describe, expect, it } from 'vitest';
import { MAP_IDS, loadMap } from '../../src/engine/data';
import { ALL_HEXES, centre, hexAt, hexsideKey, parseHex, type HexSide } from '../../src/engine/hex';
import { MASK, type MapDef, type TerrainMask } from '../../src/engine/types';
import { BOUNDS } from '../../src/ui/board/geometry';
import { areaClasses, cellCentre, cellIndexAt, components, contourSegments, smoothLevels, terrainField, type TerrainField } from '../../src/ui/board/paint/field';
import { allLinearPieces, bridgeBlocks, buildingBlocks, linearPieces, orientedBox } from '../../src/ui/board/paint/features';
import { simulateMask } from '../../src/ui/board/paint/simulate';

const near = (a: { x: number; y: number }, b: { x: number; y: number }, eps = 1e-6) => Math.hypot(a.x - b.x, a.y - b.y) < eps;

describe('terrain field', () => {
  it('synthesizes one from the hexes of a map without a mask', () => {
    const map = loadMap('1');
    const f = terrainField({ ...map, mask: undefined });
    expect(f.fromMask).toBe(false);
    expect(f.x0).toBe(BOUNDS.x);
    expect(f.width * f.height).toBe(f.cls.length);
    for (const h of ALL_HEXES) {
      const c = centre(h);
      const k = f.cls[cellIndexAt(f, c.x + 0.01, c.y + 0.01)];
      const want = { Woods: MASK.woods, Field: MASK.field, Orchard: MASK.orchard, Water: MASK.water } as Record<string, number>;
      expect(k, `hex ${h}`).toBe(want[map.terrain[h]] ?? MASK.open);
    }
  });

  it('carries hex levels', () => {
    const map = loadMap('12');
    const f = terrainField({ ...map, mask: undefined });
    for (const h of ALL_HEXES) {
      const c = centre(h);
      expect(f.level[cellIndexAt(f, c.x, c.y)]).toBe(map.elevation[h]);
    }
  });

  it('uses the map mask when there is one', () => {
    const mask: TerrainMask = { res: 2, x0: 0, y0: 0, width: 3, height: 2, cls: [0, 1, 2, 10, 10, 1], level: [0, 0, 1, 1, 2, 2] };
    const f = terrainField({ ...loadMap('1'), mask });
    expect(f.fromMask).toBe(true);
    expect(Array.from(f.cls)).toEqual([0, 1, 2, 10, 10, 1]);
    // area classes: the building stands on open ground, road cells take the ground around them
    const area = areaClasses(f);
    expect(area[2]).toBe(MASK.open);
    expect([MASK.open, MASK.woods]).toContain(area[3]);
    expect(area[4]).not.toBe(MASK.road);
  });

  it('finds connected components and contour crossings', () => {
    const f: TerrainField = {
      res: 1,
      x0: 0,
      y0: 0,
      width: 4,
      height: 3,
      cls: Uint8Array.from([1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
      level: Uint8Array.from([0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0]),
      fromMask: true,
    };
    const { count } = components(4, 3, (i) => f.cls[i] === 1, false);
    expect(count).toBe(2);
    const values = Float32Array.from(f.level);
    const segs = contourSegments(f, values, 0.5);
    expect(segs.length).toBeGreaterThan(0);
    for (const [x1, y1, x2, y2] of segs) {
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        expect(x).toBeGreaterThanOrEqual(0.5);
        expect(y).toBeLessThanOrEqual(2.5);
      }
    }
    expect(smoothLevels(f).length).toBe(12);
  });
});

describe('linear features', () => {
  it('draws map 1 roads through every road crossing, joined end to end', () => {
    const map = loadMap('1');
    const f = terrainField({ ...map, mask: undefined });
    const roads = linearPieces(map, f, 'road');
    expect(roads.length).toBeGreaterThan(20);
    const ends = roads.flatMap((p) => [p.points[0], p.points[p.points.length - 1]]);
    // each piece end is either shared with another piece, or a map-edge exit or dead end
    for (const e of ends) {
      const shared = ends.filter((x) => near(x, e)).length;
      const atEdge = e.x <= BOUNDS.x + 1.05 || e.x >= BOUNDS.x + BOUNDS.w - 1.05 || e.y <= BOUNDS.y + 0.9 || e.y >= BOUNDS.y + BOUNDS.h - 1.8;
      expect(shared >= 2 || atEdge || roads.some((p) => p.deadEnd)).toBe(true);
    }
    // every piece stays within or on its hex
    for (const p of roads) {
      for (const q of p.points) {
        const h = hexAt(q.x, q.y);
        if (h === null) continue;
        expect(Math.hypot(q.x - centre(p.hex).x, q.y - centre(p.hex).y)).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it('keeps a road along a row of hexes straight (map 6, A6 to O6)', () => {
    const map = loadMap('6');
    const f = terrainField({ ...map, mask: undefined });
    // the east-west pieces in the row's hexes (other roads branch off some of them)
    const ys = linearPieces(map, f, 'road')
      .filter((p) => ['B5', 'C6', 'D5', 'E6', 'F5', 'H5', 'I6', 'J5', 'K6'].map(parseHex).includes(p.hex))
      .filter((p) => Math.abs(p.points[0].x - p.points[p.points.length - 1].x) > 1.2)
      .flatMap((p) => p.points.map((q) => q.y));
    expect(ys.length).toBeGreaterThan(10);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.2);
  });

  it('runs streams and gullies through the centre of their hexes, without loops', () => {
    const map = loadMap('8');
    const f = terrainField({ ...map, mask: undefined });
    const gully = linearPieces(map, f, 'gully');
    const hexes = ALL_HEXES.filter((h) => map.terrain[h] === 'Gully');
    for (const h of hexes) expect(gully.some((p) => p.points.some((q) => near(q, centre(h), 1e-6))), `hex ${h}`).toBe(true);
    // a tree: pieces (graph edges) = points - components
    const pts: { x: number; y: number }[] = [];
    for (const p of gully) for (const q of [p.points[0], p.points[p.points.length - 1]]) if (!pts.some((x) => near(x, q))) pts.push(q);
    expect(gully.length).toBeLessThanOrEqual(pts.length - 1);
  });

  it('orders every kind for painting', () => {
    const map = loadMap('5');
    const kinds = allLinearPieces(map, terrainField({ ...map, mask: undefined })).map((p) => p.kind);
    expect(kinds).toContain('stream');
    expect(kinds).toContain('road');
    expect(kinds.indexOf('stream')).toBeLessThan(kinds.indexOf('road'));
  });
});

describe('buildings', () => {
  it('puts one house in each building hex of a per-hex map, clear of its road', () => {
    const map: MapDef = { ...loadMap('6'), mask: undefined };
    const f = terrainField(map);
    const pieces = allLinearPieces(map, f);
    const blocks = buildingBlocks(map, f, pieces);
    const buildingHexes = ALL_HEXES.filter((h) => map.terrain[h] === 'Building');
    expect(blocks.length).toBeGreaterThanOrEqual(buildingHexes.length);
    for (const h of buildingHexes) {
      const own = blocks.filter((b) => hexAt(b.x, b.y) === h);
      expect(own.length, `hex ${h}`).toBeGreaterThanOrEqual(1);
    }
    const roadPts = pieces.filter((p) => p.kind === 'road').flatMap((p) => p.points);
    for (const b of blocks.filter((x) => x.len < 0.9)) {
      const d = Math.min(...roadPts.map((q) => Math.hypot(q.x - b.x, q.y - b.y)));
      expect(d, `block at ${b.x},${b.y}`).toBeGreaterThan(b.wid / 2);
    }
  });

  it('fits an oriented box around a rotated rectangle of cells', () => {
    const pts = [];
    const a = Math.PI / 6;
    for (let u = -2; u <= 2; u++) for (let v = -1; v <= 1; v++) pts.push({ x: u * Math.cos(a) - v * Math.sin(a), y: u * Math.sin(a) + v * Math.cos(a) });
    const box = orientedBox(pts, 0);
    expect(box.len).toBeCloseTo(4);
    expect(box.wid).toBeCloseTo(2);
    expect(Math.abs(Math.sin(box.angle - a))).toBeLessThan(1e-6);
  });

  it('paints from mask cells: a compact building is one block', () => {
    const res = 8;
    const width = 40;
    const height = 40;
    const cls = new Uint8Array(width * height);
    for (let j = 10; j < 14; j++) for (let i = 10; i < 17; i++) cls[j * width + i] = MASK.building;
    const f: TerrainField = { res, x0: 0, y0: 0, width, height, cls, level: new Uint8Array(width * height), fromMask: true };
    const blocks = buildingBlocks(loadMap('1'), f, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].len).toBeCloseTo(7 / res);
    expect(blocks[0].wid).toBeCloseTo(4 / res);
    expect(cellCentre(f, 13, 11).x).toBeCloseTo(blocks[0].x, 0);
  });
});

describe('every map', () => {
  const SIDES: HexSide[] = [1, 2, 3, 4, 5, 6];
  for (const id of MAP_IDS) {
    it(`map ${id}: a house in every building hex, a piece of road in every road hex, a bridge on every bridge`, () => {
      const map: MapDef = { ...loadMap(id), mask: undefined };
      const f = terrainField(map);
      const pieces = allLinearPieces(map, f);
      const blocks = buildingBlocks(map, f, pieces);
      for (const h of ALL_HEXES.filter((x) => map.terrain[x] === 'Building')) {
        expect(blocks.some((b) => hexAt(b.x, b.y) === h), `building ${h}`).toBe(true);
      }
      for (const kind of ['Road', 'Trail', 'Railway'] as const) {
        const lk = kind.toLowerCase();
        for (const h of ALL_HEXES) {
          const crossed = SIDES.some((s) => map.paths[hexsideKey(h, s)] === kind);
          if (!crossed) continue;
          expect(pieces.some((p) => p.kind === lk && p.hex === h), `${kind} ${h}`).toBe(true);
        }
      }
      const bridges = ALL_HEXES.filter((h) => map.terrain[h] === 'MajorBridge' || map.terrain[h] === 'MinorBridge');
      expect(bridgeBlocks(map, f, pieces).length).toBe(bridges.length);
    });
  }

  it('paints the same features from a mask as from the hexes (simulated mask of map 5)', () => {
    const plain: MapDef = { ...loadMap('5'), mask: undefined };
    const masked: MapDef = { ...plain, mask: simulateMask(plain) };
    const f = terrainField(masked);
    expect(f.fromMask).toBe(true);
    const pieces = allLinearPieces(masked, f);
    const plainPieces = allLinearPieces(plain, terrainField(plain));
    for (const kind of ['road', 'stream'] as const) {
      const a = pieces.filter((p) => p.kind === kind).flatMap((p) => p.points);
      const b = plainPieces.filter((p) => p.kind === kind).flatMap((p) => p.points);
      expect(a.length).toBeGreaterThan(0);
      // every curve point drawn from the mask lies near the hex-graph curve the mask was made from
      for (const q of a) expect(Math.min(...b.map((r) => Math.hypot(q.x - r.x, q.y - r.y))), kind).toBeLessThan(0.3);
    }
    const blocks = buildingBlocks(masked, f, pieces);
    for (const h of ALL_HEXES.filter((x) => plain.terrain[x] === 'Building')) {
      expect(blocks.some((b) => hexAt(b.x, b.y) === h), `building ${h}`).toBe(true);
    }
    expect(bridgeBlocks(masked, f, pieces).length).toBeGreaterThanOrEqual(1);
  });
});
