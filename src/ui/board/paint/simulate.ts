// A stand-in TerrainMask made from a map's hex data, in the format Task 4's masks use (res 12 over [-1, 22] x [-1, 18]):
// area terrain with wobbly, art-like outlines, corridor cells along the roads, railways, streams and gullies, building and
// bridge cells. It exercises the board's mask painting before real masks exist (map gallery toggle, tests). Never used
// for play: LOS reads only the map's own mask.
import { MASK, type MapDef, type TerrainMask } from '../../../engine/types';
import { terrainField, nearestHex } from './field';
import { allLinearPieces, bridgeBlocks, buildingBlocks, type Block } from './features';
import { vnoise } from './noise';

const AREA: Record<string, number> = {
  Woods: MASK.woods,
  Brush: MASK.brush,
  Orchard: MASK.orchard,
  Field: MASK.field,
  Marsh: MASK.marsh,
  Water: MASK.water,
};

const CORRIDOR: Record<string, [number, number]> = {
  road: [MASK.road, 0.1],
  railway: [MASK.railway, 0.1],
  stream: [MASK.stream, 0.08],
  gully: [MASK.gully, 0.17],
};

export function simulateMask(map: MapDef, res = 12): TerrainMask {
  const x0 = -1;
  const y0 = -1;
  const width = 23 * res;
  const height = 19 * res;
  const cls = new Uint8Array(width * height);
  const level = new Uint8Array(width * height);
  const plain: MapDef = { ...map, mask: undefined };
  const synth = terrainField(plain);
  const pieces = allLinearPieces(plain, synth);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const x = x0 + (i + 0.5) / res;
      const y = y0 + (j + 0.5) / res;
      // terrain art rarely follows the hexsides: sample through a wobble
      const wx = x + (vnoise(x * 1.7, y * 1.7, 11) - 0.5) * 0.5;
      const wy = y + (vnoise(x * 1.7, y * 1.7, 23) - 0.5) * 0.5;
      const h = nearestHex(wx, wy);
      cls[j * width + i] = AREA[map.terrain[h]] ?? MASK.open;
      level[j * width + i] = map.elevation[nearestHex(x + (wx - x) * 0.5, y + (wy - y) * 0.5)];
    }
  }
  const stamp = (x: number, y: number, r: number, k: number) => {
    for (let j = Math.floor((y - r - y0) * res); j <= Math.ceil((y + r - y0) * res); j++) {
      for (let i = Math.floor((x - r - x0) * res); i <= Math.ceil((x + r - x0) * res); i++) {
        if (i < 0 || j < 0 || i >= width || j >= height) continue;
        const cx = x0 + (i + 0.5) / res;
        const cy = y0 + (j + 0.5) / res;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) cls[j * width + i] = k;
      }
    }
  };
  for (const p of pieces) {
    const c = CORRIDOR[p.kind];
    if (!c) continue;
    for (let k = 1; k < p.points.length; k++) {
      const a = p.points[k - 1];
      const b = p.points[k];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.03));
      for (let t = 0; t <= n; t++) stamp(a.x + ((b.x - a.x) * t) / n, a.y + ((b.y - a.y) * t) / n, c[1], c[0]);
    }
  }
  const fill = (b: Block, k: number) => {
    const ca = Math.cos(b.angle);
    const sa = Math.sin(b.angle);
    const r = Math.hypot(b.len, b.wid) / 2;
    for (let j = Math.floor((b.y - r - y0) * res); j <= Math.ceil((b.y + r - y0) * res); j++) {
      for (let i = Math.floor((b.x - r - x0) * res); i <= Math.ceil((b.x + r - x0) * res); i++) {
        if (i < 0 || j < 0 || i >= width || j >= height) continue;
        const dx = x0 + (i + 0.5) / res - b.x;
        const dy = y0 + (j + 0.5) / res - b.y;
        if (Math.abs(dx * ca + dy * sa) <= b.len / 2 && Math.abs(-dx * sa + dy * ca) <= b.wid / 2) cls[j * width + i] = k;
      }
    }
  };
  for (const b of buildingBlocks(plain, synth, pieces)) fill(b, MASK.building);
  for (const b of bridgeBlocks(plain, synth, pieces)) fill(b, MASK.bridge);
  return { res, x0, y0, width, height, cls, level };
}
