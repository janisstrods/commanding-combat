import { describe, expect, it } from 'vitest';
import {
  ALL_HEXES,
  NUM_HEXES,
  centre,
  distance,
  edgeHexsides,
  hexAt,
  hexId,
  hexsideBetween,
  hexsideKey,
  label,
  lineHexes,
  neighbour,
  neighbours,
  parseHex,
  sideTo,
} from '../../src/engine/hex';

const H = parseHex;

describe('hex labels and ids', () => {
  it('has 150 hexes A1..O10', () => {
    expect(NUM_HEXES).toBe(150);
    expect(ALL_HEXES.length).toBe(150);
    expect(label(ALL_HEXES[0])).toBe('A1');
    expect(label(ALL_HEXES[149])).toBe('O10');
  });

  it('round-trips labels', () => {
    for (const h of ALL_HEXES) expect(parseHex(label(h))).toBe(h);
    expect(hexId(7, 5)).toBe(H('H5'));
    expect(() => parseHex('P1')).toThrow();
    expect(() => parseHex('A11')).toThrow();
  });
});

describe('neighbours (sides 1=N, 2=NE, 3=SE, 4=S, 5=SW, 6=NW)', () => {
  it('follows the high-column table (A, C, ... O)', () => {
    // C5: high column
    expect(label(neighbour(H('C5'), 1)!)).toBe('C4');
    expect(label(neighbour(H('C5'), 2)!)).toBe('D4');
    expect(label(neighbour(H('C5'), 3)!)).toBe('D5');
    expect(label(neighbour(H('C5'), 4)!)).toBe('C6');
    expect(label(neighbour(H('C5'), 5)!)).toBe('B5');
    expect(label(neighbour(H('C5'), 6)!)).toBe('B4');
  });

  it('follows the low-column table (B, D, ... N)', () => {
    expect(label(neighbour(H('D5'), 1)!)).toBe('D4');
    expect(label(neighbour(H('D5'), 2)!)).toBe('E5');
    expect(label(neighbour(H('D5'), 3)!)).toBe('E6');
    expect(label(neighbour(H('D5'), 4)!)).toBe('D6');
    expect(label(neighbour(H('D5'), 5)!)).toBe('C6');
    expect(label(neighbour(H('D5'), 6)!)).toBe('C5');
  });

  it('stops at the map edges', () => {
    expect(neighbour(H('A1'), 1)).toBeNull();
    expect(neighbour(H('A1'), 6)).toBeNull();
    expect(neighbours(H('A1')).map(label).sort()).toEqual(['A2', 'B1']);
    expect(neighbours(H('H5')).length).toBe(6);
    expect(neighbour(H('B10'), 3)).toBeNull();
    expect(neighbour(H('O5'), 2)).toBeNull();
  });

  it('is symmetric: the side back is opposite', () => {
    for (const h of ALL_HEXES) {
      for (let s = 1; s <= 6; s++) {
        const n = neighbour(h, s as 1);
        if (n === null) continue;
        expect(sideTo(n, h)).toBe(((s + 2) % 6) + 1);
        expect(sideTo(h, n)).toBe(s);
      }
    }
  });
});

describe('distance', () => {
  it('counts hexes', () => {
    expect(distance(H('C5'), H('C5'))).toBe(0);
    expect(distance(H('C5'), H('D4'))).toBe(1);
    expect(distance(H('A1'), H('O10'))).toBe(16);
    expect(distance(H('A1'), H('A10'))).toBe(9);
    expect(distance(H('A1'), H('O1'))).toBe(14);
    expect(distance(H('D5'), H('F5'))).toBe(2);
  });

  it('agrees with breadth-first search', () => {
    const from = H('G6');
    const seen = new Map<number, number>([[from, 0]]);
    const queue = [from];
    while (queue.length) {
      const h = queue.shift()!;
      for (const n of neighbours(h)) {
        if (seen.has(n)) continue;
        seen.set(n, seen.get(h)! + 1);
        queue.push(n);
      }
    }
    for (const h of ALL_HEXES) expect(distance(from, h)).toBe(seen.get(h));
  });
});

describe('hexsides', () => {
  it('has one key per shared side', () => {
    expect(hexsideKey(H('C5'), 2)).toBe(hexsideKey(H('D4'), 5));
    expect(hexsideBetween(H('C5'), H('D4'))).toBe(hexsideKey(H('C5'), 2));
    expect(hexsideBetween(H('C5'), H('E5'))).toBeNull();
  });

  it('lists the edge sides of edge hexes', () => {
    expect(edgeHexsides(H('A1')).sort()).toEqual([1, 2, 5, 6]);
    expect(edgeHexsides(H('B1'))).toEqual([1]);
    expect(edgeHexsides(H('B10')).sort()).toEqual([3, 4, 5]);
    expect(edgeHexsides(H('H5'))).toEqual([]);
  });
});

describe('centres and hexAt', () => {
  it('puts low columns half a hex lower', () => {
    expect(centre(H('B1')).y).toBeGreaterThan(centre(H('A1')).y);
    expect(centre(H('C1')).y).toBeCloseTo(centre(H('A1')).y);
  });
  it('finds the hex under a point', () => {
    for (const h of ALL_HEXES) {
      const c = centre(h);
      expect(hexAt(c.x, c.y)).toBe(h);
      expect(hexAt(c.x + 0.3, c.y - 0.3)).toBe(h);
    }
    expect(hexAt(-5, -5)).toBeNull();
  });
});

describe('lineHexes (centre-to-centre tracing for line of sight)', () => {
  const names = (a: string, b: string) => lineHexes(H(a), H(b)).map((s) => `${s.alongHexside ? '|' : ''}${s.hexes.map(label).join('/')}`);

  it('lists the hexes strictly between, in order', () => {
    expect(names('C5', 'C9')).toEqual(['C6', 'C7', 'C8']);
    expect(names('C5', 'E4')).toEqual(['D4']);
    expect(names('C5', 'E3')).toEqual(['D4', 'D3']);
  });

  it('is empty for adjacent hexes', () => {
    expect(lineHexes(H('C5'), H('D4'))).toEqual([]);
  });

  it('reports both hexes where the line runs along a hexside', () => {
    // C5 -> E5 (both high columns, same row): the line runs along the side between D4 and D5 (a "spine" direction)
    expect(names('C5', 'E5')).toEqual(['|D4/D5']);
    expect(names('A3', 'G3')).toEqual(['|B2/B3', 'C3', '|D2/D3', 'E3', '|F2/F3']);
  });

  it('keeps only the on-map hex along a map-edge hexside', () => {
    // A1 -> C1 runs along B1's north side, the map edge
    expect(names('A1', 'C1')).toEqual(['|B1']);
  });

  it('is symmetric', () => {
    const a = names('B2', 'L8');
    const b = names('L8', 'B2').reverse();
    expect(a).toEqual(b);
  });

  it('forms an unbroken chain of hexes from one end to the other', () => {
    for (const [a, b] of [['A1', 'O10'], ['A10', 'O1'], ['H1', 'H10'], ['A5', 'O6'], ['B3', 'M9']]) {
      const steps = lineHexes(H(a), H(b));
      let prev: number[] = [H(a)];
      for (const s of steps) {
        expect(s.hexes.some((h) => prev.some((p) => p === h || neighbours(p).includes(h)))).toBe(true);
        prev = s.hexes;
      }
      expect(prev.some((p) => neighbours(p).includes(H(b)))).toBe(true);
      expect(steps.length).toBeGreaterThanOrEqual(distance(H(a), H(b)) - 1);
    }
  });
});
