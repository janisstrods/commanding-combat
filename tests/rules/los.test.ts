// Line of sight (rules-reference §10.1–§10.4, rulebook 10, T86, T88.3–T88.5, the LOS examples A–J; R-21).
// Maps are built by hand: all Open at level 0, then the terrain under test. Hex geometry used below (lineHexes):
//   C5→C8: C6 C7          C5→G5: [D4|D5] E5 [F4|F5] (along hexsides)     M9→N7: [M8|N8]
//   J7→M9: K8 L8          J7→N9: K8 L8 M9                                M9→M4: M8 M7 M6 M5
//   A5→E7: B5 C6 D6       B5→D6: C6                                      C1→C5: C2 C3 C4
import { describe, expect, it } from 'vitest';
import { hexsideCoverAgainst, losCheck, losView, type LosView } from '../../src/engine/los';
import { ALL_HEXES, NUM_HEXES, centre, hexAt, hexsideKey, label, lineHexes, neighbour, type HexSide } from '../../src/engine/hex';
import { loadMap } from '../../src/engine/data';
import { MASK, type GameState, type HexsideFeature, type MapDef, type TerrainType } from '../../src/engine/types';
import {
  H,
  addMask,
  distToCentre,
  openMap,
  setHexside,
  setLevel,
  setPath,
  setTerrain,
} from '../support/maps';
import { mulberry32 } from '../support/rng';

interface Markers {
  smoke?: Record<string, number>;
  blaze?: string[];
}

function view(map: MapDef, m: Markers = {}): LosView {
  const smoke = Array<number>(NUM_HEXES).fill(0);
  const blaze = Array<boolean>(NUM_HEXES).fill(false);
  for (const [lab, v] of Object.entries(m.smoke ?? {})) smoke[H(lab)] = v;
  for (const lab of m.blaze ?? []) blaze[H(lab)] = true;
  return { map, smoke, blaze };
}

const los = (map: MapDef, a: string, b: string, m?: Markers) => losCheck(view(map, m), H(a), H(b));

/**
 * The LOS a→b never runs along a hexside and crosses each intervening hex over at least 0.3 hex radii: a raster of cells
 * 1/8 of a radius wide can hold the hex's own terrain along it (a mere corner clip may sit in a neighbour's cells).
 */
function wellInside(a: number, b: number): boolean {
  const steps = lineHexes(a, b);
  if (steps.some((s) => s.alongHexside)) return false;
  const p = centre(a);
  const q = centre(b);
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  const n = Math.ceil(len * 200);
  const inHex = new Map<number, number>();
  for (let i = 0; i <= n; i++) {
    const h = hexAt(p.x + ((q.x - p.x) * i) / n, p.y + ((q.y - p.y) * i) / n);
    if (h !== null) inHex.set(h, (inHex.get(h) ?? 0) + len / n);
  }
  return steps.every((s) => (inHex.get(s.hexes[0]) ?? 0) >= 0.3);
}
const clear = (hindrance = 0) => ({ clear: true, hindrance, blockedBy: null });
const blocked = (blockedBy: string) => ({ clear: false, hindrance: 0, blockedBy });

describe('§10.1 basic LOS', () => {
  it('is clear over open ground', () => {
    expect(los(openMap(), 'C5', 'C8')).toEqual(clear());
    expect(los(openMap(), 'A1', 'O10')).toEqual(clear());
  });

  it('is clear to its own hex and to an adjacent hex, whatever the terrain', () => {
    const map = setTerrain(openMap(), ['C5', 'C6'], 'Woods');
    expect(los(map, 'C5', 'C5')).toEqual(clear());
    expect(los(map, 'C5', 'C6')).toEqual(clear());
  });

  it('ignores obstacles and hindrances in the sighting and target hexes', () => {
    const map = setTerrain(openMap(), ['C5', 'C8'], 'Woods');
    setTerrain(map, 'C4', 'Building');
    expect(los(map, 'C5', 'C8')).toEqual(clear());
    expect(los(map, 'C4', 'C8')).toEqual(blocked('Woods at C5'));
  });

  it('is reciprocal', () => {
    const map = setTerrain(openMap(), 'C6', 'Woods');
    expect(los(map, 'C8', 'C5')).toEqual(los(map, 'C5', 'C8'));
  });
});

describe('§10.2 obstacles', () => {
  it('a Woods or Building hex between blocks (example A)', () => {
    expect(los(setTerrain(openMap(), 'C6', 'Woods'), 'C5', 'C8')).toEqual(blocked('Woods at C6'));
    expect(los(setTerrain(openMap(), 'C7', 'Building'), 'C5', 'C8')).toEqual(blocked('Building at C7'));
  });

  it('Water, Stream, Gully and Open are clear', () => {
    for (const t of ['Water', 'Stream', 'Gully', 'Open'] as TerrainType[]) {
      expect(los(setTerrain(openMap(), ['C6', 'C7'], t), 'C5', 'C8'), t).toEqual(clear());
    }
  });

  it('a Wall or Hedge hexside between blocks; one that is a side of either end hex does not', () => {
    for (const f of ['Wall', 'Hedge'] as HexsideFeature[]) {
      expect(los(setHexside(openMap(), 'C6', 'C7', f), 'C5', 'C8')).toEqual(blocked(`${f} C6|C7`));
      expect(los(setHexside(openMap(), 'C7', 'C8', f), 'C5', 'C8')).toEqual(clear());
      expect(los(setHexside(openMap(), 'C5', 'C6', f), 'C5', 'C8')).toEqual(clear());
    }
  });

  it('a Cliff hexside does not affect LOS', () => {
    expect(los(setHexside(openMap(), 'C6', 'C7', 'Cliff'), 'C5', 'C8')).toEqual(clear());
  });

  it('a Wall along the hexspine between them blocks (§10.1 gray box, example H)', () => {
    expect(los(setHexside(openMap(), 'M8', 'N8', 'Wall'), 'M9', 'N7')).toEqual(blocked('Wall M8|N8'));
    expect(los(setHexside(openMap(), 'D4', 'D5', 'Wall'), 'C5', 'G5')).toEqual(blocked('Wall D4|D5'));
    expect(los(setHexside(openMap(), 'F4', 'F5', 'Hedge'), 'C5', 'G5')).toEqual(blocked('Hedge F4|F5'));
  });

  it('a Wall on a side of an end hex that the spine LOS starts from is ignored', () => {
    const map = setHexside(openMap(), 'C5', 'D5', 'Wall');
    setHexside(map, 'C5', 'D4', 'Wall');
    setHexside(map, 'G5', 'F5', 'Wall');
    expect(los(map, 'C5', 'G5')).toEqual(clear());
  });

  it('passing through a hex corner crosses Walls only when they lie on both sides of the LOS', () => {
    // C5→G5 runs along D4|D5, through E5's west corner, across E5 and out of its east corner
    expect(los(setHexside(openMap(), 'D4', 'E5', 'Wall'), 'C5', 'G5')).toEqual(clear());
    const map = setHexside(openMap(), 'D4', 'E5', 'Wall');
    setHexside(map, 'D5', 'E5', 'Wall');
    expect(los(map, 'C5', 'G5')).toEqual(blocked('Wall D4|E5'));
    const fence = setHexside(openMap(), 'E5', 'F4', 'Wall');
    setHexside(fence, 'E5', 'F5', 'Fence');
    expect(los(fence, 'C5', 'G5')).toEqual(clear(1));
  });

  it('a LOS along a hexside between two hexes is blocked only if both block (no-mask fallback)', () => {
    expect(los(setTerrain(openMap(), 'D4', 'Woods'), 'C5', 'G5')).toEqual(clear());
    expect(los(setTerrain(openMap(), ['D4', 'D5'], 'Woods'), 'C5', 'G5')).toEqual(blocked('Woods along D4|D5'));
    const mixed = setTerrain(openMap(), 'F4', 'Woods');
    setTerrain(mixed, 'F5', 'Building');
    expect(los(mixed, 'C5', 'G5')).toEqual(blocked('Woods/Building along F4|F5'));
  });
});

describe('§10.3 hindrances', () => {
  it('Brush 3, Orchard 2, Field 1, Marsh 1, Bridges 1', () => {
    const cases: [TerrainType, number][] = [
      ['Brush', 3],
      ['Orchard', 2],
      ['Field', 1],
      ['Marsh', 1],
      ['MajorBridge', 1],
      ['MinorBridge', 1],
    ];
    for (const [t, h] of cases) expect(los(setTerrain(openMap(), 'C6', t), 'C5', 'C8'), t).toEqual(clear(h));
  });

  it('only the single largest hindrance applies (§10.3.3 example)', () => {
    const map = setTerrain(openMap(), ['C6', 'C7'], 'Brush');
    expect(los(map, 'C5', 'C8')).toEqual(clear(3));
    expect(los(map, 'C5', 'C8', { smoke: { C7: 4 } })).toEqual(clear(4));
    expect(los(map, 'C5', 'C8', { smoke: { C6: 4, C7: 4 } })).toEqual(clear(4));
    expect(los(map, 'C5', 'C8', { smoke: { C5: 5 } })).toEqual(clear(5));
    setTerrain(map, 'C7', 'Orchard');
    expect(los(map, 'C5', 'C8')).toEqual(clear(3));
  });

  it('Smoke hinders into and out of its own hex, also between adjacent hexes (§10.3.4)', () => {
    expect(los(openMap(), 'C5', 'C8', { smoke: { C8: 3 } })).toEqual(clear(3));
    expect(los(openMap(), 'C5', 'C8', { smoke: { C5: 2 } })).toEqual(clear(2));
    expect(los(openMap(), 'C5', 'C6', { smoke: { C6: 6 } })).toEqual(clear(6));
    expect(los(openMap(), 'C5', 'C5', { smoke: { C5: 2 } })).toEqual(clear(2));
  });

  it('Smoke and orchard: the smoke 7 into the target hex, not 9 (examples H and J)', () => {
    const map = setTerrain(openMap(), 'N8', 'Orchard');
    expect(los(map, 'N9', 'N7', { smoke: { N7: 7 } })).toEqual(clear(7));
    expect(los(map, 'M9', 'N7', { smoke: { N7: 7 } })).toEqual(clear(7));
  });

  it('Smoke fills its hex up to its hexsides: a LOS along its side is hindered', () => {
    expect(los(openMap(), 'C5', 'G5', { smoke: { D4: 3 } })).toEqual(clear(3));
    expect(los(openMap(), 'C5', 'G5', { smoke: { D5: 2, F4: 4 } })).toEqual(clear(4));
  });

  it('a LOS along a hexside takes the smaller terrain hindrance of the two hexes (no-mask fallback)', () => {
    const map = setTerrain(openMap(), 'D4', 'Brush');
    expect(los(map, 'C5', 'G5')).toEqual(clear(0));
    setTerrain(map, 'D5', 'Field');
    expect(los(map, 'C5', 'G5')).toEqual(clear(1));
  });

  it('a Fence on a side of the target hex is ignored; one in between hinders 1, also along a spine', () => {
    expect(los(setHexside(openMap(), 'C7', 'C8', 'Fence'), 'C5', 'C8')).toEqual(clear());
    expect(los(setHexside(openMap(), 'C6', 'C7', 'Fence'), 'C5', 'C8')).toEqual(clear(1));
    expect(los(setHexside(openMap(), 'D4', 'D5', 'Fence'), 'C5', 'G5')).toEqual(clear(1));
  });

  it('a Railway hex hinders 1, but not a LOS straight along the railway (§T92)', () => {
    const map = setPath(openMap(), ['C4', 'C5', 'C6', 'C7', 'C8', 'C9'], 'Railway');
    expect(los(map, 'A5', 'E7')).toEqual(clear(1)); // crosses C6
    expect(los(map, 'C5', 'C8')).toEqual(clear(0)); // along it
  });
});

describe('roads (§T93, example F)', () => {
  it('a LOS running exactly along a road through Woods is clear; one crossing it is blocked', () => {
    const map = setTerrain(openMap(), 'M5', 'Woods');
    expect(los(map, 'M9', 'M4')).toEqual(blocked('Woods at M5'));
    setPath(map, ['M4', 'M5', 'M6', 'M7'], 'Road');
    expect(los(map, 'M9', 'M4')).toEqual(clear());
    const cross = setTerrain(openMap(), 'C6', 'Woods');
    setPath(cross, ['C5', 'C6', 'C7'], 'Road');
    expect(los(cross, 'C5', 'C8')).toEqual(clear());
    expect(los(cross, 'A5', 'E7')).toEqual(blocked('Woods at C6'));
    expect(los(cross, 'B5', 'D6')).toEqual(blocked('Woods at C6'));
  });

  it('a Trail gives no corridor', () => {
    const map = setTerrain(openMap(), 'M5', 'Woods');
    setPath(map, ['M4', 'M5', 'M6'], 'Trail');
    expect(los(map, 'M9', 'M4')).toEqual(blocked('Woods at M5'));
  });

  it('a road that bends inside the hex gives no corridor to a straight LOS', () => {
    const map = setTerrain(openMap(), 'C6', 'Woods');
    setPath(map, ['C5', 'C6', 'D6'], 'Road');
    expect(los(map, 'C5', 'C8')).toEqual(blocked('Woods at C6'));
  });
});

describe('§10.1 Blaze', () => {
  it('blocks in every hex the LOS passes, along its hexsides too, at every elevation', () => {
    expect(los(openMap(), 'C5', 'C8', { blaze: ['C6'] })).toEqual(blocked('Blaze at C6'));
    expect(los(openMap(), 'C5', 'G5', { blaze: ['D5'] })).toEqual(blocked('Blaze at D5'));
    const hills = setLevel(openMap(), ['C5', 'C8'], 2);
    expect(los(hills, 'C5', 'C8', { blaze: ['C7'] })).toEqual(blocked('Blaze at C7'));
  });

  it('not in an end hex (no unit can be there)', () => {
    expect(los(openMap(), 'C5', 'C8', { blaze: ['C8'] })).toEqual(clear());
  });
});

describe('§10.4 hills', () => {
  it('a level-1 hill between two level-0 hexes blocks (T88.3.3)', () => {
    expect(los(setLevel(openMap(), 'C6', 1, true), 'C5', 'C8')).toEqual(blocked('Hill level 1 at C6'));
  });

  it('same-level hills do not block: level 2 to level 2 across level-2 ground (step 4)', () => {
    const map = setLevel(openMap(), ['C1', 'C5'], 2, true);
    setLevel(map, ['C2', 'C3', 'C4'], 2);
    expect(los(map, 'C1', 'C5')).toEqual(clear());
    setTerrain(map, 'C3', 'Woods');
    expect(los(map, 'C1', 'C5')).toEqual(blocked('Woods at C3'));
  });

  it('a level-2 viewer sees down over a level-1 hill; a level-1 viewer does not (example B)', () => {
    const map = setLevel(openMap(), 'C5', 2, true);
    setLevel(map, 'C6', 1, true);
    expect(los(map, 'C5', 'C8')).toEqual(clear());
    setLevel(map, 'C5', 1, true);
    expect(los(map, 'C5', 'C8')).toEqual(blocked('Hill level 1 at C6'));
    expect(los(map, 'C8', 'C5')).toEqual(blocked('Hill level 1 at C6'));
  });

  it('looking up sees only the first (Crest) hex of each higher level (T88.3.2)', () => {
    const map = setLevel(openMap(), 'C3', 1, true);
    setLevel(map, ['C4', 'C5'], 1);
    expect(los(map, 'C1', 'C3')).toEqual(clear());
    expect(los(map, 'C1', 'C4')).toEqual(blocked('Hill level 1 at C3'));
    expect(los(map, 'C5', 'C1')).toEqual(blocked('Hill level 1 at C3'));
  });

  it('looking up or down needs a Crest hex at the higher end, except between adjacent hexes', () => {
    const map = setLevel(openMap(), 'C3', 1);
    expect(los(map, 'C1', 'C3')).toEqual(blocked('C3 is not a crest hex'));
    expect(los(map, 'C3', 'C6')).toEqual(blocked('C3 is not a crest hex'));
    expect(los(map, 'C2', 'C3')).toEqual(clear());
  });

  it('past a level-2 hill a level-2 viewer sees only hills of level 2+; past a level-3 hill only a level-4 Crest (T88.3.3)', () => {
    const map = setLevel(openMap(), 'C1', 2, true);
    setLevel(map, 'C3', 2, true);
    setLevel(map, 'C5', 1, true);
    expect(los(map, 'C1', 'C5')).toEqual(blocked('Hill level 2 at C3'));
    setLevel(map, 'C5', 2);
    expect(los(map, 'C1', 'C5')).toEqual(clear());
    setLevel(map, 'C5', 3, true);
    expect(los(map, 'C1', 'C5')).toEqual(clear());
    setLevel(map, 'C3', 3, true);
    expect(los(map, 'C1', 'C5')).toEqual(blocked('Hill level 3 at C3'));
    setLevel(map, 'C5', 4, true);
    expect(los(map, 'C1', 'C5')).toEqual(clear());
    setLevel(map, 'C5', 4, false);
    expect(los(map, 'C1', 'C5')).toEqual(blocked('C5 is not a crest hex'));
    setLevel(map, 'C5', 4, true);
    setLevel(map, 'C6', 4);
    expect(los(map, 'C1', 'C6')).toEqual(blocked('Hill level 4 at C5'));
  });

  it('a hill viewer sees over lower Woods to the same level (example C)', () => {
    const map = setLevel(openMap(), ['J9', 'N6'], 1, true);
    setTerrain(map, 'L8', 'Woods');
    expect(los(map, 'J9', 'N6')).toEqual(clear());
    setLevel(map, 'L8', 1);
    expect(los(map, 'J9', 'N6')).toEqual(blocked('Woods at L8'));
  });

  it('a hill viewer is blocked by Woods at its own level (example A)', () => {
    const map = setLevel(openMap(), ['J9', 'K6'], 1, true);
    setLevel(map, ['K8', 'J8', 'J7', 'K7'], 1);
    setTerrain(map, 'K8', 'Woods');
    expect(los(map, 'J9', 'K6')).toEqual(blocked('Woods at K8'));
  });

  it('lower Woods make one blind hex behind them (examples D and E)', () => {
    const map = setLevel(openMap(), 'J7', 1, true);
    setTerrain(map, 'L8', 'Woods');
    expect(los(map, 'J7', 'L8')).toEqual(clear()); // into the Woods hex itself
    expect(los(map, 'J7', 'M9')).toEqual(blocked('Woods at L8'));
    expect(los(map, 'J7', 'N9')).toEqual(clear());
  });

  it('T88.4.1 first example: from a level-1 hill past a level-0 building, all but the hex directly behind it', () => {
    const map = setLevel(openMap(), 'C3', 1, true);
    setTerrain(map, 'C5', 'Building');
    expect(los(map, 'C3', 'C5')).toEqual(clear());
    expect(los(map, 'C3', 'C6')).toEqual(blocked('Building at C5'));
    expect(los(map, 'C3', 'C7')).toEqual(clear());
    expect(los(map, 'C7', 'C3')).toEqual(clear());
  });

  it('T88.4.1 second example: past a level-1 building to level 2, unless it is the first intervening hex', () => {
    const map = setLevel(openMap(), ['C5', 'C6', 'C7'], 1);
    setLevel(map, 'C8', 2, true);
    setTerrain(map, 'C7', 'Building');
    expect(los(map, 'C5', 'C8')).toEqual(clear());
    setTerrain(map, 'C7', 'Open');
    setTerrain(map, 'C6', 'Building');
    expect(los(map, 'C5', 'C8')).toEqual(blocked('Building at C6'));
    expect(los(map, 'C8', 'C5')).toEqual(blocked('Building at C6'));
  });

  it('obstacles below both ends never block (step 5)', () => {
    const map = setLevel(openMap(), ['C1', 'C5'], 1, true);
    setTerrain(map, ['C2', 'C3', 'C4'], 'Woods');
    expect(los(map, 'C1', 'C5')).toEqual(clear());
  });

  it('mapboard hindrances below a hill end are ignored; on a hill they hinder between hexes of its level (T88.5)', () => {
    const map = setLevel(openMap(), 'C3', 1, true);
    setTerrain(map, 'C4', 'Brush');
    expect(los(map, 'C3', 'C6')).toEqual(clear(0));
    const ridge = setLevel(openMap(), ['C1', 'C5'], 1, true);
    setLevel(ridge, ['C2', 'C3', 'C4'], 1);
    setTerrain(ridge, 'C3', 'Brush');
    expect(los(ridge, 'C1', 'C5')).toEqual(clear(3));
    setLevel(ridge, 'C5', 2, true);
    expect(los(ridge, 'C1', 'C5')).toEqual(clear(0));
  });

  it('Smoke hinders at every elevation, unlike a printed hindrance', () => {
    const map = setLevel(openMap(), ['C5', 'C8'], 1);
    setTerrain(map, 'C7', 'Brush');
    expect(los(map, 'C5', 'C8')).toEqual(clear(0));
    expect(los(map, 'C5', 'C8', { smoke: { C6: 2 } })).toEqual(clear(2));
  });

  it('a hexside Obstacle stands at the higher level of its two hexes (R-21)', () => {
    const map = setLevel(openMap(), ['C1', 'C6'], 1, true);
    setLevel(map, 'C3', 1);
    setHexside(map, 'C3', 'C4', 'Wall');
    expect(los(map, 'C1', 'C6')).toEqual(blocked('Wall C3|C4'));
    setLevel(map, ['C1', 'C6'], 2, true);
    expect(los(map, 'C1', 'C6')).toEqual(clear());
  });

  it('a lower hexside Obstacle blinds only the hex right behind it, and a Fence below hinders nothing', () => {
    const map = setLevel(openMap(), 'C1', 1, true);
    setHexside(map, 'C4', 'C5', 'Wall');
    expect(los(map, 'C1', 'C6')).toEqual(blocked('Wall C4|C5'));
    expect(los(map, 'C1', 'C7')).toEqual(clear());
    setHexside(map, 'C4', 'C5', 'Fence');
    expect(los(map, 'C1', 'C7')).toEqual(clear(0));
  });

  it('a Gully is seen only from adjacent or higher hexes, and sees only those (T86)', () => {
    const map = setTerrain(openMap(), 'C5', 'Gully');
    expect(los(map, 'C5', 'C7')).toEqual(blocked('Gully at C5'));
    expect(los(map, 'C7', 'C5')).toEqual(blocked('Gully at C5'));
    expect(los(map, 'C5', 'C6')).toEqual(clear());
    setLevel(map, 'C8', 1, true);
    expect(los(map, 'C8', 'C5')).toEqual(clear());
    setTerrain(map, 'C7', 'Gully');
    expect(los(map, 'C5', 'C7')).toEqual(blocked('Gully at C5'));
  });
});

describe('the terrain mask (drawn terrain, §10.2 "touches the depiction")', () => {
  it('a LOS that misses the woods art inside a Woods hex is clear; one that touches it is blocked', () => {
    const blob = (east: number) =>
      addMask(setTerrain(openMap(), 'C6', 'Woods'), (x, y, hex) =>
        hex === H('C6') ? { cls: x > east ? MASK.woods : MASK.open } : undefined,
      );
    expect(los(setTerrain(openMap(), 'C6', 'Woods'), 'C5', 'C8')).toEqual(blocked('Woods at C6'));
    expect(los(blob(3.4), 'C5', 'C8')).toEqual(clear());
    expect(los(blob(2.95), 'C5', 'C8')).toEqual(blocked('Woods at C6'));
  });

  it('a road corridor through woods art is clear; leaving it is blocked', () => {
    const map = setTerrain(openMap(), 'C6', 'Woods');
    addMask(map, (x, y, hex) => (hex === H('C6') && Math.abs(x - 3) < 0.15 ? { cls: MASK.road } : undefined));
    expect(los(map, 'C5', 'C8')).toEqual(clear());
    expect(los(map, 'A5', 'E7')).toEqual(blocked('Woods at C6'));
    expect(los(map, 'B5', 'D6')).toEqual(blocked('Woods at C6'));
  });

  it('example F with a mask: the road past the Woods in M5', () => {
    const map = setTerrain(openMap(), 'M5', 'Woods');
    addMask(map, (x, y, hex) => (hex === H('M5') && Math.abs(x - 18) < 0.12 ? { cls: MASK.road } : undefined));
    expect(los(map, 'M9', 'M4')).toEqual(clear());
  });

  it('art of the end hexes never counts, even where it reaches their hexsides', () => {
    const map = addMask(setTerrain(openMap(), ['C5', 'C8'], 'Woods'));
    expect(los(map, 'C5', 'C8')).toEqual(clear());
    expect(los(map, 'C4', 'C8')).toEqual(blocked('Woods at C5'));
  });

  it('hindrance art counts where the LOS touches it', () => {
    const blob = (west: number) =>
      addMask(openMap(), (x, y, hex) => (hex === H('C6') && x < west ? { cls: MASK.brush } : undefined));
    expect(los(blob(2.6), 'C5', 'C8')).toEqual(clear(0));
    expect(los(blob(3.05), 'C5', 'C8')).toEqual(clear(3));
    const orchardAndField = addMask(openMap(), (x, y, hex) =>
      hex === H('C6') ? { cls: MASK.field } : hex === H('C7') && x > 2.9 ? { cls: MASK.orchard } : undefined,
    );
    expect(los(orchardAndField, 'C5', 'C8')).toEqual(clear(2));
  });

  it('railway art hinders a LOS that crosses it, not one along it', () => {
    const across = addMask(openMap(), (x, y, hex) =>
      hex === H('C6') && Math.abs(y - 8.66) < 0.12 ? { cls: MASK.railway } : undefined,
    );
    expect(los(across, 'C5', 'C8')).toEqual(clear(1));
    const along = addMask(openMap(), (x, y, hex) =>
      hex === H('C6') && Math.abs(x - 3) < 0.12 ? { cls: MASK.railway } : undefined,
    );
    expect(los(along, 'C5', 'C8')).toEqual(clear(0));
  });

  it('hill art: a LOS past the lower part of an intervening Crest hex is clear', () => {
    const blob = (east: number) => {
      const map = setLevel(openMap(), 'C6', 1, true);
      return addMask(map, (x, y, hex) => (hex === H('C6') ? { level: x > east ? 1 : 0 } : undefined));
    };
    expect(los(setLevel(openMap(), 'C6', 1, true), 'C5', 'C8')).toEqual(blocked('Hill level 1 at C6'));
    expect(los(blob(3.4), 'C5', 'C8')).toEqual(clear());
    expect(los(blob(2.95), 'C5', 'C8')).toEqual(blocked('Hill level 1 at C6'));
  });

  it('looking down: the LOS must leave the hill inside the viewer hex, not inside an intervening one', () => {
    // a level-1 band from y = 1.0 (inside C2) to y = 4.0 (inside C3): C2 and C3 are both Crest hexes
    const map = setLevel(openMap(), ['C2', 'C3'], 1, true);
    addMask(map, (x, y, hex) => (hex === H('C2') || hex === H('C3') ? { level: y > 1.0 && y < 4.0 ? 1 : 0 } : undefined));
    expect(los(map, 'C3', 'C6')).toEqual(clear());
    expect(los(map, 'C2', 'C5')).toEqual(blocked('Hill level 1 at C3'));
    // looking up the other way: C1 sees the edge of the band (C2), not C3 beyond it
    expect(los(map, 'C1', 'C2')).toEqual(clear());
    expect(los(map, 'C1', 'C3')).toEqual(blocked('Hill level 1 at C2'));
  });

  it('obstacle art on a hill uses its own level: the blind hex behind lower woods', () => {
    const map = setLevel(openMap(), 'J7', 1, true);
    setTerrain(map, 'L8', 'Woods');
    addMask(map, (x, y, hex) => (hex === H('J7') && y > 11.3 ? { level: 0 } : undefined));
    expect(los(map, 'J7', 'M9')).toEqual(blocked('Woods at L8'));
    expect(los(map, 'J7', 'N9')).toEqual(clear());
  });

  it('Smoke, Blaze and hexsides work the same with a mask', () => {
    const map = addMask(setHexside(openMap(), 'D4', 'D5', 'Wall'));
    expect(los(map, 'C5', 'G5')).toEqual(blocked('Wall D4|D5'));
    expect(los(map, 'C5', 'C8', { blaze: ['C7'] })).toEqual(blocked('Blaze at C7'));
    expect(los(map, 'C5', 'C8', { smoke: { C8: 4 } })).toEqual(clear(4));
  });

  it('a cell counts only where the LOS is inside the hex that owns it (cells straddle hexsides)', () => {
    // Coarse cells (half a hex radius) straddle hexsides widely. Find cells owned by an intervening hex that the LOS
    // clips only while inside a neighbouring hex: their art lies in that neighbour, so it must not count.
    const res = 2;
    let clipped = 0;
    let counted = 0;
    const lines: [string, string][] = [['A5', 'E7'], ['B2', 'H6'], ['C1', 'F9'], ['A9', 'K4'], ['D2', 'D9'], ['B8', 'L3']];
    for (const [from, to] of lines) {
      const a = centre(H(from));
      const b = centre(H(to));
      const ends = [H(from), H(to)];
      const path = new Set(lineHexes(H(from), H(to)).flatMap((s) => s.hexes));
      const probe = addMask(openMap(), undefined, res).mask!;
      // per cell: how many dense samples of the LOS inside it fall in each hex (a single sample may be a mere touch)
      const seen = new Map<number, Map<number, number>>();
      for (let k = 0; k <= 4000; k++) {
        const x = a.x + ((b.x - a.x) * k) / 4000;
        const y = a.y + ((b.y - a.y) * k) / 4000;
        const cell = Math.floor((y - probe.y0) * res) * probe.width + Math.floor((x - probe.x0) * res);
        const h = hexAt(x, y);
        if (h === null) continue;
        const counts = seen.get(cell) ?? seen.set(cell, new Map()).get(cell)!;
        counts.set(h, (counts.get(h) ?? 0) + 1);
      }
      for (const [cell, counts] of seen) {
        const i = cell % probe.width;
        const j = Math.floor(cell / probe.width);
        const owner = hexAt(probe.x0 + (i + 0.5) / res, probe.y0 + (j + 0.5) / res);
        if (owner === null || ends.includes(owner) || !path.has(owner)) continue;
        const map = addMask(openMap(), (x, y) => (Math.floor((x - probe.x0) * res) === i && Math.floor((y - probe.y0) * res) === j ? { cls: MASK.woods } : undefined), res);
        const r = los(map, from, to);
        const inside = counts.get(owner) ?? 0;
        const elsewhere = [...counts].filter(([h]) => h !== owner && !ends.includes(h)).reduce((n, [, c]) => n + c, 0);
        if (inside >= 3) {
          counted++;
          expect(r, `${from}→${to} cell ${i},${j} of ${label(owner)}`).toEqual(blocked(`Woods at ${label(owner)}`));
        } else if (inside === 0 && elsewhere >= 3) {
          clipped++;
          expect(r, `${from}→${to} cell ${i},${j} of ${label(owner)}`).toEqual(clear());
        }
      }
    }
    expect(clipped).toBeGreaterThan(0);
    expect(counted).toBeGreaterThan(10);
  });

  it('a whole-hex mask agrees with the no-mask check on every LOS that never runs along a hexside', () => {
    const rnd = mulberry32(7);
    const terrains: TerrainType[] = ['Open', 'Open', 'Open', 'Woods', 'Building', 'Brush', 'Orchard', 'Field', 'Marsh'];
    for (let n = 0; n < 4; n++) {
      const map = openMap();
      for (const h of ALL_HEXES) {
        map.terrain[h] = terrains[Math.floor(rnd() * terrains.length)];
        if (rnd() < 0.25) map.elevation[h] = 1 + Math.floor(rnd() * 2);
        map.crest[h] = map.elevation[h] > 0 && rnd() < 0.7;
      }
      const masked = addMask(structuredClone(map));
      for (let k = 0; k < 400; k++) {
        const a = Math.floor(rnd() * NUM_HEXES);
        const b = Math.floor(rnd() * NUM_HEXES);
        if (!wellInside(a, b)) continue;
        const v = view(map);
        const plain = losCheck(v, a, b);
        const withMask = losCheck({ ...v, map: masked }, a, b);
        expect(withMask, `${label(a)}→${label(b)}`).toEqual(plain);
      }
    }
  });
});

describe('reciprocity and robustness', () => {
  it('every LOS on random maps is reciprocal and never throws', () => {
    const rnd = mulberry32(42);
    const terrains = Object.keys({
      Open: 0,
      Woods: 0,
      Brush: 0,
      Orchard: 0,
      Field: 0,
      Building: 0,
      MajorBridge: 0,
      MinorBridge: 0,
      Gully: 0,
      Water: 0,
      Stream: 0,
      Marsh: 0,
    }) as TerrainType[];
    const features: HexsideFeature[] = ['Fence', 'Hedge', 'Wall', 'Cliff'];
    for (let n = 0; n < 3; n++) {
      const map = openMap();
      for (const h of ALL_HEXES) {
        map.terrain[h] = rnd() < 0.5 ? 'Open' : terrains[Math.floor(rnd() * terrains.length)];
        map.elevation[h] = rnd() < 0.3 ? Math.floor(rnd() * 4) : 0;
        map.crest[h] = rnd() < 0.5;
      }
      for (let k = 0; k < 120; k++) {
        const a = Math.floor(rnd() * NUM_HEXES);
        const side = (1 + Math.floor(rnd() * 6)) as HexSide;
        if (neighbour(a, side) === null) continue;
        map.hexsides[hexsideKey(a, side)] = features[Math.floor(rnd() * features.length)];
      }
      setPath(map, ['A1', 'A2', 'B2', 'C3', 'D3'], 'Road');
      setPath(map, ['H1', 'H2', 'H3', 'H4'], 'Railway');
      const m: Markers = { smoke: { E5: 3, K7: 1 }, blaze: ['G4'] };
      const variants = [map, addMask(structuredClone(map), (x, y, hex) => (rnd() < 0.05 ? { cls: MASK.woods } : undefined))];
      for (const mp of variants) {
        const v = view(mp, m);
        for (let k = 0; k < 600; k++) {
          const a = Math.floor(rnd() * NUM_HEXES);
          const b = Math.floor(rnd() * NUM_HEXES);
          expect(losCheck(v, a, b)).toEqual(losCheck(v, b, a));
        }
      }
    }
  });
});

describe('hexside Cover against a shot (T87, T97)', () => {
  it('a Wall or Hedge the LOS crosses into the target hex', () => {
    const map = setHexside(openMap(), 'C7', 'C8', 'Wall');
    setHexside(map, 'C8', 'D8', 'Hedge');
    expect(hexsideCoverAgainst(map, H('C5'), H('C8'))).toBe(2);
    expect(hexsideCoverAgainst(map, H('C7'), H('C8'))).toBe(2); // adjacent: across the shared hexside
    expect(hexsideCoverAgainst(map, H('C8'), H('C5'))).toBe(0); // not into C5
    expect(hexsideCoverAgainst(map, H('F9'), H('C8'))).toBe(1);
    expect(hexsideCoverAgainst(map, H('F9'), H('C8'), { hedge: { cost: 2, cover: 2 } })).toBe(2);
    expect(hexsideCoverAgainst(map, H('C10'), H('C8'))).toBe(0);
  });

  it('through a corner of the target hex, only when both of its sides there have one (the smaller)', () => {
    // C5→G5 enters G5 through its west corner, between G5|F4 and G5|F5
    const map = setHexside(openMap(), 'G5', 'F4', 'Wall');
    expect(hexsideCoverAgainst(map, H('C5'), H('G5'))).toBe(0);
    setHexside(map, 'G5', 'F5', 'Hedge');
    expect(hexsideCoverAgainst(map, H('C5'), H('G5'))).toBe(1);
  });
});

describe('losView', () => {
  const smoke = Array<number>(NUM_HEXES).fill(0);
  smoke[H('C8')] = 5;
  const blaze = Array<boolean>(NUM_HEXES).fill(false);

  it('reads smoke and blaze from the state, with the map passed in', () => {
    const map = setTerrain(openMap(), 'C6', 'Brush');
    const s = { smoke, blaze, scenario: { map: '1' } } as unknown as GameState;
    const v = losView(s, map);
    expect(v.map).toBe(map);
    expect(losCheck(v, H('C5'), H('C8'))).toEqual(clear(5));
  });

  it("uses the state's own map, else the scenario's map from data.ts; a GameState is itself a LosView", () => {
    const map = setTerrain(openMap(), 'C6', 'Woods');
    const s = { map, smoke, blaze, scenario: { map: '1' } } as unknown as GameState;
    expect(losView(s).map).toBe(map);
    expect(losCheck(s, H('C5'), H('C8'))).toEqual(blocked('Woods at C6'));
    const bare = { smoke, blaze, scenario: { map: '1' } } as unknown as GameState;
    expect(losView(bare).map).toBe(loadMap('1'));
  });
});

describe('the real maps (data.ts)', () => {
  const map1 = loadMap('1');

  it('Map 1: the building at E8 blocks E7–E9; the pond does not block G5–G8', () => {
    expect(los(map1, 'E7', 'E9')).toEqual(blocked('Building at E8'));
    expect(los(map1, 'G5', 'G8')).toEqual(clear());
  });

  it('Map 1: along the O-column road all is open; the orchards hinder 2; the woods block', () => {
    expect(los(map1, 'O1', 'O9')).toEqual(clear());
    expect(los(map1, 'M3', 'M6')).toEqual(clear(2));
    expect(los(map1, 'M7', 'M10')).toEqual(blocked('Woods at M8'));
  });

  it('Map 1: the fence between D8 and D9 hinders 1', () => {
    expect(los(map1, 'D7', 'D10')).toEqual(clear(1));
  });

  it('every map: each LOS is reciprocal, adjacent hexes always see each other, and a non-crest hill is never seen from below', () => {
    for (const id of ['1', '2', '3', '4', '5', '5w', '6', '7', '8', '9', '10', '11', '12']) {
      const map = loadMap(id);
      const v = view(map);
      let clearCount = 0;
      for (let a = 0; a < NUM_HEXES; a++) {
        for (let b = a + 1; b < NUM_HEXES; b++) {
          const r = losCheck(v, a, b);
          expect(losCheck(v, b, a)).toEqual(r);
          if (r.clear) clearCount++;
          if (lineHexes(a, b).length === 0) expect(r.clear, `${id} ${label(a)}-${label(b)}`).toBe(true);
          else if (map.elevation[a] < map.elevation[b] && !map.crest[b]) expect(r.clear, `${id} ${label(a)}-${label(b)}`).toBe(false);
        }
      }
      expect(clearCount, id).toBeGreaterThan(0);
    }
  });
});

describe('performance', () => {
  const time = (map: MapDef) => {
    const v = view(map, { smoke: { F5: 2 } });
    for (let a = 0; a < NUM_HEXES; a++) for (let b = 0; b < NUM_HEXES; b++) losCheck(v, a, b); // warm up
    const t0 = performance.now();
    let n = 0;
    for (let rep = 0; rep < 2; rep++)
      for (let a = 0; a < NUM_HEXES; a++)
        for (let b = 0; b < NUM_HEXES; b++) {
          losCheck(v, a, b);
          n++;
        }
    return (performance.now() - t0) / n;
  };

  it('checks a LOS well under 0.1 ms without a mask', () => {
    const ms = time(loadMap('1'));
    expect(ms).toBeLessThan(0.1);
  });

  it('checks a LOS well under 0.5 ms with a mask', () => {
    const map = structuredClone(loadMap('1'));
    addMask(map, (x, y, hex) => (hex !== null && distToCentre(x, y, label(hex)) > 0.8 ? { cls: MASK.open } : undefined));
    const ms = time(map);
    expect(ms).toBeLessThan(0.5);
  });
});
