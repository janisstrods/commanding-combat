import { describe, expect, it } from 'vitest';
import { APOTHEM, SQRT3, boardViewBox } from '../../src/ui/board/geometry';
import { EXPANDED_MIN, FAN_PX, MAX_UNIT, READABLE_PX, WEAPON_REL, layoutStack, trayShift, type Slot, type StackRole } from '../../src/ui/board/stackLayout';

const U: StackRole = 'unit';
const W: StackRole = 'weapon';
const M: StackRole = 'marker';

/** Stacks to try: a lone unit up to the most one hex can hold (7 Leaders with 7 Weapons; an overstacked melee). */
const CASES: StackRole[][] = [
  [U],
  [U, W],
  [U, U],
  [U, W, U],
  [U, W, U, W],
  [U, U, U],
  [U, W, U, W, U, W],
  [M, U, W, U, U, M, M],
  [U, W, U, W, U, W, U, W],
  [U, W, U, W, U, W, U, W, U, W, U, W, U, W],
  [M, U, U, U, W, U, U, W, U, U, M, M, M],
  [M],
  [M, M, M],
  [W],
  [U, U, U, U, U, U, U, U, U, U, U, U],
];

const PX = [10, 18, 26, 34, 48, 70, 120, 200];

function overlap(a: Slot, b: Slot): boolean {
  const reach = (a.side + b.side) / 2 - 1e-6;
  return Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < reach;
}

function expectNoOverlaps(slots: Slot[]) {
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) expect(overlap(slots[i], slots[j]), `pieces ${i} and ${j}`).toBe(false);
}

/** Whether the square lies inside the hex (allowing the layout's small spill past the slanted sides). */
function insideHex(s: Slot): boolean {
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      const x = s.x + (dx * s.side) / 2;
      const y = s.y + (dy * s.side) / 2;
      if (Math.abs(y) > APOTHEM + 1e-6) return false;
      if (Math.abs(x) > 1 - Math.abs(y) / SQRT3 + 0.12 + 1e-6) return false;
    }
  }
  return true;
}

describe('stack layout', () => {
  it('draws nothing for an empty stack', () => {
    expect(layoutStack([]).slots).toEqual([]);
  });

  it('draws a lone unit large, in the middle of its hex', () => {
    const lay = layoutStack([U], { px: 40 });
    expect(lay.mode).toBe('inside');
    expect(lay.slots[0]).toEqual({ x: 0, y: 0, side: MAX_UNIT });
    expect(insideHex(lay.slots[0])).toBe(true);
  });

  it('never lets one piece hide another, at any zoom, inside, fanned out or expanded', () => {
    for (const roles of CASES) {
      for (const px of [0, ...PX]) {
        for (const expanded of [false, true]) {
          const lay = layoutStack(roles, { px, expanded });
          expect(lay.slots).toHaveLength(roles.length);
          for (const s of lay.slots) expect(s.side).toBeGreaterThan(0);
          expectNoOverlaps(lay.slots);
        }
      }
    }
  });

  it('keeps an unfanned stack inside its hex, even the worst cases', () => {
    for (const roles of CASES) {
      const lay = layoutStack(roles, { px: 0 });
      expect(lay.mode).toBe('inside');
      expect(lay.tray).toBeNull();
      for (const s of lay.slots) expect(insideHex(s)).toBe(true);
      // still big enough to tell the pieces apart once zoomed in
      expect(lay.unit).toBeGreaterThan(0.24);
    }
  });

  it('puts each weapon beside the unit carrying it: to its right, smaller, bottom-aligned', () => {
    const roles = [U, W, U, U, W];
    const lay = layoutStack(roles, { px: 120 });
    for (const [u, w] of [
      [0, 1],
      [3, 4],
    ]) {
      const a = lay.slots[u];
      const b = lay.slots[w];
      expect(b.side).toBeCloseTo(a.side * WEAPON_REL);
      expect(b.x).toBeGreaterThan(a.x + a.side / 2);
      expect(b.x - b.side / 2 - (a.x + a.side / 2)).toBeLessThan(a.side * 0.1);
      expect(b.y + b.side / 2).toBeCloseTo(a.y + a.side / 2);
    }
  });

  it('puts hex markers in a band above the units', () => {
    const roles = [M, U, W, U, M];
    const lay = layoutStack(roles, { px: 120 });
    const markers = lay.slots.filter((_, i) => roles[i] === M);
    const units = lay.slots.filter((_, i) => roles[i] !== M);
    const bandBottom = Math.max(...markers.map((s) => s.y + s.side / 2));
    const unitsTop = Math.min(...units.map((s) => s.y - s.side / 2));
    expect(bandBottom).toBeLessThanOrEqual(unitsTop + 1e-9);
    expect(markers[0].y).toBeCloseTo(markers[1].y);
  });

  it('draws markers alone in the middle of the hex', () => {
    const lay = layoutStack([M], { px: 40 });
    expect(lay.slots[0].x).toBeCloseTo(0);
    expect(lay.slots[0].y).toBeCloseTo(0);
    expect(lay.slots[0].side).toBeGreaterThan(0.6);
  });

  it('gives smaller counters to fuller hexes', () => {
    let last = Infinity;
    for (let n = 1; n <= 8; n++) {
      const c = layoutStack(Array<StackRole>(n).fill(U)).unit;
      expect(c).toBeLessThanOrEqual(last + 1e-9);
      last = c;
    }
  });

  it('fans a crowded stack out when its counters would be too small to read', () => {
    const roles = [U, W, U, W, U, W];
    const inside = layoutStack(roles).unit;
    const px = 40;
    expect(inside * px).toBeLessThan(READABLE_PX);
    const lay = layoutStack(roles, { px });
    expect(lay.mode).toBe('fan');
    expect(lay.unit * px).toBeCloseTo(FAN_PX);
    expect(lay.tray).not.toBeNull();
    const t = lay.tray!;
    for (const s of lay.slots) {
      expect(s.x - s.side / 2).toBeGreaterThanOrEqual(t.x - 1e-9);
      expect(s.x + s.side / 2).toBeLessThanOrEqual(t.x + t.w + 1e-9);
      expect(s.y - s.side / 2).toBeGreaterThanOrEqual(t.y - 1e-9);
      expect(s.y + s.side / 2).toBeLessThanOrEqual(t.y + t.h + 1e-9);
    }
  });

  it('keeps stacks inside their hexes when readable, and when zoomed out to an overview', () => {
    const roles = [U, W, U, W, U, W];
    expect(layoutStack(roles, { px: 200 }).mode).toBe('inside');
    expect(layoutStack(roles, { px: 12 }).mode).toBe('inside');
    expect(layoutStack([U], { px: 20 }).mode).toBe('inside');
  });

  it('magnifies an expanded stack', () => {
    const roles = [U, W, U, U];
    const lay = layoutStack(roles, { px: 30, expanded: true });
    expect(lay.mode).toBe('expanded');
    expect(lay.unit).toBeGreaterThanOrEqual(EXPANDED_MIN);
    expect(lay.unit).toBeGreaterThan(layoutStack(roles, { px: 30 }).unit);
    expect(lay.tray).not.toBeNull();
  });

  it('shifts a tray at the map edge back onto the board', () => {
    const vb = boardViewBox();
    const lay = layoutStack([U, W, U, W, U, W, U], { px: 30, expanded: true });
    const at = { x: vb.x + 0.5, y: vb.y + 0.5 };
    const d = trayShift(lay, at, vb);
    const t = lay.tray!;
    expect(at.x + d.x + t.x).toBeGreaterThanOrEqual(vb.x - 1e-9);
    expect(at.y + d.y + t.y).toBeGreaterThanOrEqual(vb.y - 1e-9);
    expect(trayShift(lay, { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }, vb)).toEqual({ x: 0, y: 0 });
    expect(trayShift(layoutStack([U]), at, vb)).toEqual({ x: 0, y: 0 });
  });
});
