// Hand-built MapDefs for the terrain and line-of-sight tests (Task 2): all Open at level 0, then the terrain under test,
// optionally with a terrain mask painted cell by cell. No tests here.
import { NUM_HEXES, centre, hexAt, hexsideBetween, parseHex } from '../../src/engine/hex';
import {
  MASK,
  type HexId,
  type HexsideFeature,
  type MapDef,
  type MaskClass,
  type PathKind,
  type TerrainMask,
  type TerrainType,
} from '../../src/engine/types';

export const H = parseHex;

const many = (labels: string | string[]): HexId[] => (Array.isArray(labels) ? labels : [labels]).map(parseHex);

/** An all-Open, level-0 map with no hexside features, paths, objectives, buildings or mask. */
export function openMap(id = 'test'): MapDef {
  return {
    id,
    terrain: Array<TerrainType>(NUM_HEXES).fill('Open'),
    elevation: Array<number>(NUM_HEXES).fill(0),
    crest: Array<boolean>(NUM_HEXES).fill(false),
    hexsides: {},
    paths: {},
    pathHexes: {},
    objectives: [],
    building: Array<number>(NUM_HEXES).fill(-1),
  };
}

export function setTerrain(map: MapDef, labels: string | string[], t: TerrainType): MapDef {
  for (const h of many(labels)) map.terrain[h] = t;
  return map;
}

/** Sets the level of hexes; `crest` marks them as Crest hexes (two levels, the centre dot on the higher one). */
export function setLevel(map: MapDef, labels: string | string[], level: number, crest = false): MapDef {
  for (const h of many(labels)) {
    map.elevation[h] = level;
    map.crest[h] = crest;
  }
  return map;
}

export function setHexside(map: MapDef, a: string, b: string, f: HexsideFeature): MapDef {
  const key = hexsideBetween(parseHex(a), parseHex(b));
  if (key === null) throw new Error(`${a} and ${b} are not adjacent`);
  map.hexsides[key] = f;
  return map;
}

/** Marks a path running through `labels` in order: each hex gets the depiction, each hexside between two is crossed. */
export function setPath(map: MapDef, labels: string[], kind: PathKind): MapDef {
  const hexes = labels.map(parseHex);
  const flags = (map.pathHexes[kind] ??= Array<boolean>(NUM_HEXES).fill(false));
  hexes.forEach((h, i) => {
    flags[h] = true;
    if (i > 0) {
      const key = hexsideBetween(hexes[i - 1], h);
      if (key === null) throw new Error(`${labels[i - 1]} and ${labels[i]} are not adjacent`);
      map.paths[key] = kind;
    }
  });
  return map;
}

const CLASS_OF: Record<TerrainType, MaskClass> = {
  Open: MASK.open,
  Woods: MASK.woods,
  Building: MASK.building,
  Brush: MASK.brush,
  Orchard: MASK.orchard,
  Field: MASK.field,
  Marsh: MASK.marsh,
  Stream: MASK.stream,
  Water: MASK.water,
  Gully: MASK.gully,
  MajorBridge: MASK.bridge,
  MinorBridge: MASK.bridge,
};

export type CellPaint = (x: number, y: number, hex: HexId | null) => { cls?: MaskClass; level?: number } | undefined;

/**
 * Attaches a mask to `map`: every cell starts as its hex's terrain class at its hex's level (a whole-hex fill), then
 * `paint` may override class and/or level per cell centre (x, y in hex-radius units, A1's centre at the origin).
 */
export function addMask(map: MapDef, paint?: CellPaint, res = 8): MapDef {
  // offset by half a cell, so that hex centres (x = 1.5 k) sit on cell centres, not on cell edges
  const x0 = -1.5 - 0.5 / res;
  const y0 = -1.5 - 0.5 / res;
  const width = Math.ceil(24 * res);
  const height = Math.ceil(19.5 * res);
  const cls = new Uint8Array(width * height);
  const level = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const x = x0 + (i + 0.5) / res;
      const y = y0 + (j + 0.5) / res;
      const hex = hexAt(x, y);
      let c: number = hex === null ? MASK.open : CLASS_OF[map.terrain[hex]];
      let l = hex === null ? 0 : map.elevation[hex];
      const p = paint?.(x, y, hex);
      if (p?.cls !== undefined) c = p.cls;
      if (p?.level !== undefined) l = p.level;
      cls[j * width + i] = c;
      level[j * width + i] = l;
    }
  }
  const mask: TerrainMask = { res, x0, y0, width, height, cls, level };
  map.mask = mask;
  return map;
}

/** Distance from point (x, y) to the centre of the hex `label`. */
export function distToCentre(x: number, y: number, label: string): number {
  const c = centre(parseHex(label));
  return Math.hypot(x - c.x, y - c.y);
}
