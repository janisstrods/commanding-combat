// Board geometry in hex-radius units (the engine's units: A1's centre is (0, 0), x to the right, y down; see
// engine/hex.ts). "Map" coordinates are the engine's; "screen" coordinates are what the SVG draws, which differ only when
// the board is turned 180 degrees (so the player's own edge is at the bottom). Turning is a point reflection through the
// centre of the combat zone, so the viewBox stays the same either way.
import { ALL_HEXES, centre, corners, hexAt, hexsideKey, neighbour, type HexId, type HexSide, type Point } from '../../engine/hex';
import type { Edge } from '../../engine/types';

export type { Point };

export const SQRT3 = Math.sqrt(3);
/** Distance from a hex centre to the middle of a side. */
export const APOTHEM = SQRT3 / 2;

/** The combat zone: the bounding box of all 150 hexes (columns A..O, rows 1..10, zig-zag edges). */
export const BOUNDS = {
  x: -1,
  y: -APOTHEM,
  w: 1.5 * 14 + 2,
  h: SQRT3 * 10 + APOTHEM,
} as const;

/** The point the 180-degree turn reflects through. */
export const TURN_CENTRE: Point = { x: BOUNDS.x + BOUNDS.w / 2, y: BOUNDS.y + BOUNDS.h / 2 };

/** Margin around the combat zone (frame, edge names, compass), in hex units. */
export const BOARD_MARGIN = 1.0;

/** The SVG viewBox of the whole board (combat zone plus margin). */
export function boardViewBox(margin = BOARD_MARGIN): { x: number; y: number; w: number; h: number; attr: string } {
  const x = BOUNDS.x - margin;
  const y = BOUNDS.y - margin;
  const w = BOUNDS.w + 2 * margin;
  const h = BOUNDS.h + 2 * margin;
  return { x, y, w, h, attr: `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}` };
}

/** Map point → screen point (the turn is its own inverse, so this also maps screen → map). */
export function toScreen(p: Point, rotate180 = false): Point {
  return rotate180 ? { x: 2 * TURN_CENTRE.x - p.x, y: 2 * TURN_CENTRE.y - p.y } : { x: p.x, y: p.y };
}
export const fromScreen = toScreen;

/** Screen centre of hex `h`. */
export function hexCentre(h: HexId, rotate180 = false): Point {
  return toScreen(centre(h), rotate180);
}

/** Screen corners of hex `h` (clockwise on screen, starting at the east corner when not turned). */
export function hexCorners(h: HexId, rotate180 = false): Point[] {
  return corners(h).map((c) => toScreen(c, rotate180));
}

/** The `points` attribute of hex `h`'s polygon. */
export function hexPoints(h: HexId, rotate180 = false, scale = 1): string {
  const c = hexCentre(h, rotate180);
  return hexCorners(h, rotate180)
    .map((p) => `${fmt(c.x + (p.x - c.x) * scale)},${fmt(c.y + (p.y - c.y) * scale)}`)
    .join(' ');
}

/** The hex under a screen point, or null off the map. */
export function hexAtScreen(x: number, y: number, rotate180 = false): HexId | null {
  const p = fromScreen({ x, y }, rotate180);
  return hexAt(p.x, p.y);
}

/** Indices into `corners(h)` of the two ends of side `side` (1 = N ... 6 = NW). */
export function sideCornerIndices(side: HexSide): [number, number] {
  return [(side + 3) % 6, (side + 4) % 6];
}

/** The two screen end points of side `side` of hex `h`. */
export function hexsideSegment(h: HexId, side: HexSide, rotate180 = false): [Point, Point] {
  const cs = hexCorners(h, rotate180);
  const [i, j] = sideCornerIndices(side);
  return [cs[i], cs[j]];
}

/** Screen midpoint of side `side` of hex `h`. */
export function hexsideMid(h: HexId, side: HexSide, rotate180 = false): Point {
  const [a, b] = hexsideSegment(h, side, rotate180);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** The hex and side a hexsideKey was made from (the smaller of the two encodings, see engine/hex.ts). */
export function hexsideOfKey(key: number): { hex: HexId; side: HexSide; other: HexId | null } {
  const hex = Math.floor(key / 6);
  const side = ((key % 6) + 1) as HexSide;
  return { hex, side, other: neighbour(hex, side) };
}

/** Every hexside key on the board (inner and edge sides), once each. */
export const ALL_HEXSIDE_KEYS: readonly number[] = (() => {
  const keys = new Set<number>();
  for (const h of ALL_HEXES) for (let s = 1 as HexSide; s <= 6; s = (s + 1) as HexSide) keys.add(hexsideKey(h, s));
  return [...keys].sort((a, b) => a - b);
})();

/** Which map edge a screen side shows: turned, the top edge is drawn at the bottom and left at the right. */
export function screenEdge(edge: Edge, rotate180 = false): Edge {
  if (!rotate180) return edge;
  return ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const)[edge];
}

/** Round to 3 decimals for SVG attributes. */
export function fmt(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}
