import { describe, expect, it } from 'vitest';
import { ALL_HEXES, centre, corners, hexsideKey, neighbour, oppositeSide, parseHex, type HexSide } from '../../src/engine/hex';
import {
  ALL_HEXSIDE_KEYS,
  APOTHEM,
  BOUNDS,
  TURN_CENTRE,
  boardViewBox,
  fromScreen,
  hexAtScreen,
  hexCentre,
  hexCorners,
  hexPoints,
  hexsideMid,
  hexsideOfKey,
  hexsideSegment,
  screenEdge,
  sideCornerIndices,
  toScreen,
} from '../../src/ui/board/geometry';
import { stackOffsets } from '../../src/ui/board/StackView';

const SIDES: HexSide[] = [1, 2, 3, 4, 5, 6];
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const samePoint = (p: { x: number; y: number }, q: { x: number; y: number }) => close(p.x, q.x) && close(p.y, q.y);

describe('hex → board coordinates', () => {
  it('puts A1 at the origin and steps 1.5 per column, √3 per row, low columns half a row down', () => {
    expect(hexCentre(parseHex('A1'))).toEqual({ x: 0, y: 0 });
    const b1 = hexCentre(parseHex('B1'));
    expect(b1.x).toBeCloseTo(1.5);
    expect(b1.y).toBeCloseTo(Math.sqrt(3) / 2);
    const a2 = hexCentre(parseHex('A2'));
    expect(a2.y).toBeCloseTo(Math.sqrt(3));
    const o10 = hexCentre(parseHex('O10'));
    expect(o10.x).toBeCloseTo(21);
    expect(o10.y).toBeCloseTo(9 * Math.sqrt(3));
  });

  it('keeps every hex corner inside the combat zone, which touches the outermost corners', () => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const h of ALL_HEXES) {
      for (const c of hexCorners(h)) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x);
        maxY = Math.max(maxY, c.y);
      }
    }
    expect(minX).toBeCloseTo(BOUNDS.x);
    expect(minY).toBeCloseTo(BOUNDS.y);
    expect(maxX).toBeCloseTo(BOUNDS.x + BOUNDS.w);
    expect(maxY).toBeCloseTo(BOUNDS.y + BOUNDS.h);
  });

  it('builds a viewBox of the combat zone plus the margin', () => {
    const vb = boardViewBox(1);
    expect(vb.x).toBeCloseTo(BOUNDS.x - 1);
    expect(vb.w).toBeCloseTo(BOUNDS.w + 2);
    expect(vb.attr.split(' ').map(Number)).toEqual([vb.x, vb.y, vb.w, vb.h].map((v) => Math.round(v * 1000) / 1000));
  });

  it('finds the hex under each hex centre, and none off the board', () => {
    for (const rot of [false, true]) {
      for (const h of ALL_HEXES) {
        const c = hexCentre(h, rot);
        expect(hexAtScreen(c.x, c.y, rot)).toBe(h);
      }
    }
    expect(hexAtScreen(BOUNDS.x - 0.5, BOUNDS.y - 0.5)).toBeNull();
  });

  it('writes a polygon of six corners', () => {
    const pts = hexPoints(parseHex('F6')).split(' ');
    expect(pts).toHaveLength(6);
    const [x, y] = pts[0].split(',').map(Number);
    const c = centre(parseHex('F6'));
    expect(x).toBeCloseTo(c.x + 1, 3);
    expect(y).toBeCloseTo(c.y, 3);
  });
});

describe('turning the board 180°', () => {
  it('is its own inverse and maps the combat zone onto itself', () => {
    for (const p of [{ x: 0, y: 0 }, { x: 3.2, y: -0.4 }, { x: 21, y: 15.5 }]) {
      expect(samePoint(fromScreen(toScreen(p, true), true), p)).toBe(true);
      expect(samePoint(toScreen(p, false), p)).toBe(true);
    }
    const tl = toScreen({ x: BOUNDS.x, y: BOUNDS.y }, true);
    expect(tl.x).toBeCloseTo(BOUNDS.x + BOUNDS.w);
    expect(tl.y).toBeCloseTo(BOUNDS.y + BOUNDS.h);
    expect(samePoint(toScreen(TURN_CENTRE, true), TURN_CENTRE)).toBe(true);
  });

  it('puts A1 at the bottom right and O10 at the top left', () => {
    const a1 = hexCentre(parseHex('A1'), true);
    const o10 = hexCentre(parseHex('O10'), true);
    expect(a1.x).toBeGreaterThan(20);
    expect(a1.y).toBeGreaterThan(15);
    expect(o10.x).toBeLessThan(1);
    expect(o10.y).toBeLessThan(1);
  });

  it('turns corners with their hex, and keeps the turned hexes within the combat zone', () => {
    for (const h of ALL_HEXES) {
      const turned = hexCorners(h, true);
      corners(h).forEach((c, i) => expect(samePoint(turned[i], toScreen(c, true))).toBe(true));
      for (const c of turned) {
        expect(c.x).toBeGreaterThanOrEqual(BOUNDS.x - 1e-9);
        expect(c.y).toBeLessThanOrEqual(BOUNDS.y + BOUNDS.h + 1e-9);
      }
    }
  });

  it('shows each map edge on the opposite side of the screen', () => {
    expect(screenEdge('top', true)).toBe('bottom');
    expect(screenEdge('left', true)).toBe('right');
    expect(screenEdge('right', false)).toBe('right');
  });
});

describe('hexsides', () => {
  it('draws side 1 along the top of the hex and side 4 along the bottom', () => {
    const h = parseHex('E5');
    const c = centre(h);
    const [a, b] = hexsideSegment(h, 1);
    expect(a.y).toBeCloseTo(c.y - APOTHEM);
    expect(b.y).toBeCloseTo(c.y - APOTHEM);
    const [d, e] = hexsideSegment(h, 4);
    expect(d.y).toBeCloseTo(c.y + APOTHEM);
    expect(e.y).toBeCloseTo(c.y + APOTHEM);
    expect(sideCornerIndices(1)).toEqual([4, 5]);
  });

  it('gives the same segment from both hexes of an inner hexside, facing the neighbour', () => {
    for (const rot of [false, true]) {
      for (const h of ALL_HEXES) {
        for (const s of SIDES) {
          const n = neighbour(h, s);
          if (n === null) continue;
          const [a, b] = hexsideSegment(h, s, rot);
          const [c, d] = hexsideSegment(n, oppositeSide(s), rot);
          expect((samePoint(a, c) && samePoint(b, d)) || (samePoint(a, d) && samePoint(b, c))).toBe(true);
          const m = hexsideMid(h, s, rot);
          const hc = hexCentre(h, rot);
          const nc = hexCentre(n, rot);
          expect((m.x - hc.x) * (nc.x - hc.x) + (m.y - hc.y) * (nc.y - hc.y)).toBeGreaterThan(0);
        }
      }
    }
  });

  it('decodes every hexside key back to one of its two hex/side pairs', () => {
    const all = new Set(ALL_HEXSIDE_KEYS);
    for (const h of ALL_HEXES) {
      for (const s of SIDES) {
        const key = hexsideKey(h, s);
        expect(all.has(key)).toBe(true);
        const d = hexsideOfKey(key);
        const n = neighbour(h, s);
        const same = (d.hex === h && d.side === s) || (n !== null && d.hex === n && d.side === oppositeSide(s));
        expect(same).toBe(true);
        expect(d.other).toBe(neighbour(d.hex, d.side));
      }
    }
    expect(new Set(ALL_HEXSIDE_KEYS).size).toBe(ALL_HEXSIDE_KEYS.length);
  });
});

describe('stack offsets', () => {
  it('fans a collapsed stack diagonally, centred on the hex', () => {
    const offs = stackOffsets(3, { step: 0.1 });
    expect(offs).toHaveLength(3);
    expect(offs[0].x).toBeCloseTo(-0.1);
    expect(offs[0].y).toBeCloseTo(0.1);
    expect(offs[2].x).toBeCloseTo(0.1);
    expect(offs[2].y).toBeCloseTo(-0.1);
    expect(offs.reduce((s, o) => s + o.x, 0)).toBeCloseTo(0);
  });

  it('lays an expanded stack out in a grid without overlaps', () => {
    const size = 0.6;
    const offs = stackOffsets(5, { size, expanded: true });
    for (let i = 0; i < offs.length; i++) {
      for (let j = i + 1; j < offs.length; j++) {
        const far = Math.abs(offs[i].x - offs[j].x) >= size || Math.abs(offs[i].y - offs[j].y) >= size;
        expect(far).toBe(true);
      }
    }
    expect(stackOffsets(0)).toEqual([]);
  });
});
