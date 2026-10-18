// Which parts of which painting a zoomed-in board needs. The board's terrain is painted once at a modest resolution;
// when the board shows it clearly enlarged (more screen pixels per hex than the painting has), the part in view is
// painted again at a higher resolution, in square tiles laid over the painting. A tile is exactly that part of the whole
// painting at its resolution (painter.ts), so tiles meet without seams. Pure helpers (no DOM), for TerrainLayer.tsx.
import { BOUNDS, TURN_CENTRE } from '../geometry';

/** A rectangle of a painting, in its pixels. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A rectangle in board units. */
export interface BoardRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The size of the whole painting at `ppu` pixels per hex-radius unit. */
export function paintingSize(ppu: number): { w: number; h: number } {
  return { w: Math.ceil(BOUNDS.w * ppu), h: Math.ceil(BOUNDS.h * ppu) };
}

/** Tile side, px. */
export const TILE_PX = 512;
/** Tiles go up to about this many pixels per hex radius (a phone at the deepest zoom). */
export const MAX_TILE_PPU = 700;
/** A painting looks sharp enough until the screen shows it this much enlarged. */
export const ENLARGE_OK = 1.25;
/** At most this many tile pixels for the view (else a coarser level). */
export const VIEW_BUDGET = 12e6;
/** The tiles in view are painted first, then those within this share of the view's size around it. */
const PREFETCH = 0.25;

/**
 * The resolution of the tiles for a board drawn at `need` device pixels per hex radius over a painting at `base` ppu (the
 * base times a power of two), or null when the painting is sharp enough.
 */
export function tileLevel(base: number, need: number): number | null {
  if (!(base > 0) || !(need > base * ENLARGE_OK)) return null;
  let level = base * 2;
  while (level * ENLARGE_OK < need && level * 2 <= MAX_TILE_PPU) level *= 2;
  return level;
}

/** The map rectangle drawn in board rectangle `box` (the terrain is drawn turned through TURN_CENTRE when `rotate180`). */
export function mapBox(box: BoardRect, rotate180: boolean): BoardRect {
  if (!rotate180) return { ...box };
  return { x: 2 * TURN_CENTRE.x - box.x - box.w, y: 2 * TURN_CENTRE.y - box.y - box.h, w: box.w, h: box.h };
}

export interface Tile {
  /** Its painting's resolution, px per hex radius. */
  level: number;
  i: number;
  j: number;
  /** Its part of the painting at `level`. */
  rect: PixelRect;
}

/** The tiles of the painting at `level` that `box` (map coordinates) touches, nearest the box's centre first. */
export function tilesCovering(level: number, box: BoardRect): Tile[] {
  const { w: W, h: H } = paintingSize(level);
  const x0 = Math.max(0, Math.floor((box.x - BOUNDS.x) * level));
  const y0 = Math.max(0, Math.floor((box.y - BOUNDS.y) * level));
  const x1 = Math.min(W, Math.ceil((box.x + box.w - BOUNDS.x) * level));
  const y1 = Math.min(H, Math.ceil((box.y + box.h - BOUNDS.y) * level));
  if (x1 <= x0 || y1 <= y0) return [];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const out: (Tile & { d: number })[] = [];
  for (let j = Math.floor(y0 / TILE_PX); j * TILE_PX < y1; j++) {
    for (let i = Math.floor(x0 / TILE_PX); i * TILE_PX < x1; i++) {
      const x = i * TILE_PX;
      const y = j * TILE_PX;
      const rect = { x, y, w: Math.min(TILE_PX, W - x), h: Math.min(TILE_PX, H - y) };
      out.push({ level, i, j, rect, d: Math.hypot(x + rect.w / 2 - cx, y + rect.h / 2 - cy) });
    }
  }
  return out.sort((a, b) => a.d - b.d).map(({ d, ...t }) => t);
}

export const tilePixels = (tiles: readonly Tile[]) => tiles.reduce((n, t) => n + t.rect.w * t.rect.h, 0);

export interface TilePlan {
  level: number;
  /** The tiles in view, nearest the middle first. */
  visible: Tile[];
  /** Tiles around the view, to paint after those. */
  around: Tile[];
}

/**
 * The tiles a board wants: `box` is the board rectangle in view, `need` its device pixels per hex radius, `base` the
 * resolution of its painting; all of them within `budget` pixels. Null when the painting is sharp enough, or when even
 * the coarsest tiles of the view would pass VIEW_BUDGET (or the budget).
 */
export function planTiles(base: number, need: number, box: BoardRect, rotate180: boolean, budget = Infinity): TilePlan | null {
  const first = tileLevel(base, need);
  if (first === null) return null;
  const inMap = mapBox(box, rotate180);
  const around = { x: inMap.x - inMap.w * PREFETCH, y: inMap.y - inMap.h * PREFETCH, w: inMap.w * (1 + 2 * PREFETCH), h: inMap.h * (1 + 2 * PREFETCH) };
  for (let level = first; level > base; level /= 2) {
    const visible = tilesCovering(level, inMap);
    let left = Math.min(VIEW_BUDGET, budget) - tilePixels(visible);
    if (left < 0) continue;
    const seen = new Set(visible.map((t) => `${t.i},${t.j}`));
    const extra: Tile[] = [];
    for (const t of tilesCovering(level, around)) {
      if (seen.has(`${t.i},${t.j}`)) continue;
      left -= t.rect.w * t.rect.h;
      if (left < 0) break;
      extra.push(t);
    }
    return { level, visible, around: extra };
  }
  return null;
}

/** How many tile pixels to keep for a board showing `viewPx` device pixels: a few screens' worth, within bounds. */
export function tileBudget(viewPx: number): number {
  return Math.min(24e6, Math.max(8e6, 4 * (viewPx > 0 ? viewPx : 0)));
}
