// Zoom and pan of the board, as pure maths (the gestures live in useBoardZoom.ts). A view is a zoom factor `k` (1 = the
// whole board fitted into the viewport, as before zooming) and the board point (cx, cy) shown at the viewport's centre.
// Two frames: board units (the SVG's hex-radius units) and viewport pixels (CSS px from the viewport's top left).
import type { Point } from './geometry';

export interface View {
  k: number;
  cx: number;
  cy: number;
}
export interface Size {
  w: number;
  h: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The least zoom: the whole board in view. */
export const MIN_ZOOM = 1;
/** Zooming in stops at a hex radius of about this many px (but always allows MIN_MAX_ZOOM..MAX_MAX_ZOOM times the fit). */
export const MAX_PX_PER_UNIT = 180;
const MIN_MAX_ZOOM = 3;
const MAX_MAX_ZOOM = 12;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pixels per board unit when the whole board just fits (k = 1). */
export function fitScale(vp: Size, world: Rect): number {
  if (!(vp.w > 0 && vp.h > 0)) return 1;
  return Math.min(vp.w / world.w, vp.h / world.h);
}

/** The largest zoom factor for this viewport. */
export function maxZoom(vp: Size, world: Rect): number {
  return clamp(MAX_PX_PER_UNIT / fitScale(vp, world), MIN_MAX_ZOOM, MAX_MAX_ZOOM);
}

/** The fitted view: the whole board, centred. */
export function fitView(world: Rect): View {
  return { k: 1, cx: world.x + world.w / 2, cy: world.y + world.h / 2 };
}

/** Pixels per board unit in `view`. */
export function pxPerUnit(view: View, vp: Size, world: Rect): number {
  return fitScale(vp, world) * view.k;
}

/** The board rectangle the viewport shows (the SVG viewBox; same aspect as the viewport). */
export function viewBoxOf(view: View, vp: Size, world: Rect): Rect {
  const s = pxPerUnit(view, vp, world);
  const w = vp.w / s;
  const h = vp.h / s;
  return { x: view.cx - w / 2, y: view.cy - h / 2, w, h };
}

/** The board point under viewport pixel (sx, sy). */
export function toBoard(view: View, vp: Size, world: Rect, sx: number, sy: number): Point {
  const s = pxPerUnit(view, vp, world);
  return { x: view.cx + (sx - vp.w / 2) / s, y: view.cy + (sy - vp.h / 2) / s };
}

/** The viewport pixel showing board point `p`. */
export function toViewport(view: View, vp: Size, world: Rect, p: Point): Point {
  const s = pxPerUnit(view, vp, world);
  return { x: vp.w / 2 + (p.x - view.cx) * s, y: vp.h / 2 + (p.y - view.cy) * s };
}

/**
 * The nearest allowed view: zoom between the fit and maxZoom; along each axis the board either covers the viewport
 * (no gap at either side) or, when it is narrower than the viewport, sits centred.
 */
export function clampView(view: View, vp: Size, world: Rect): View {
  const k = clamp(Number.isFinite(view.k) ? view.k : 1, MIN_ZOOM, maxZoom(vp, world));
  const s = fitScale(vp, world) * k;
  const hw = vp.w / s / 2;
  const hh = vp.h / s / 2;
  const axis = (c: number, lo: number, len: number, half: number) =>
    len <= 2 * half ? lo + len / 2 : clamp(Number.isFinite(c) ? c : lo + len / 2, lo + half, lo + len - half);
  return { k, cx: axis(view.cx, world.x, world.w, hw), cy: axis(view.cy, world.y, world.h, hh) };
}

/** Zoom by `factor` around viewport pixel (sx, sy): the board point under it stays put (as far as the limits allow). */
export function zoomAt(view: View, vp: Size, world: Rect, factor: number, sx: number, sy: number): View {
  const p = toBoard(view, vp, world, sx, sy);
  const k = clamp(view.k * factor, MIN_ZOOM, maxZoom(vp, world));
  const s = fitScale(vp, world) * k;
  return clampView({ k, cx: p.x - (sx - vp.w / 2) / s, cy: p.y - (sy - vp.h / 2) / s }, vp, world);
}

/** Move the board by (dx, dy) viewport pixels (it follows the pointer). */
export function panBy(view: View, vp: Size, world: Rect, dx: number, dy: number): View {
  const s = pxPerUnit(view, vp, world);
  return clampView({ k: view.k, cx: view.cx - dx / s, cy: view.cy - dy / s }, vp, world);
}

/**
 * A two-finger gesture that started at (a0, b0) in view `start` and is now at (a1, b1): zoom by the change of the
 * fingers' distance, and keep the board point that was under their midpoint under their new midpoint.
 */
export function pinchView(start: View, vp: Size, world: Rect, a0: Point, b0: Point, a1: Point, b1: Point): View {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const p = toBoard(start, vp, world, m0.x, m0.y);
  const k = clamp(start.k * (d0 > 1 ? d1 / d0 : 1), MIN_ZOOM, maxZoom(vp, world));
  const s = fitScale(vp, world) * k;
  return clampView({ k, cx: p.x - (m1.x - vp.w / 2) / s, cy: p.y - (m1.y - vp.h / 2) / s }, vp, world);
}

/** The zoom factor of one wheel event (a mouse wheel notch is about 1.2x; a trackpad pinch arrives as ctrl+wheel). */
export function wheelFactor(deltaY: number, deltaMode: number, ctrlKey: boolean, pageHeight = 800): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * pageHeight : deltaY;
  return clamp(Math.exp(-px * (ctrlKey ? 0.01 : 0.0018)), 0.5, 2);
}

/** Views in between, for an animated zoom: t = 0 gives `a`, t = 1 gives `b` (zoom interpolated geometrically). */
export function lerpView(a: View, b: View, t: number): View {
  const k = a.k * Math.pow(b.k / a.k, t);
  // keep the motion steady on screen: move the centre in proportion to the change of 1/k
  const u = Math.abs(1 / b.k - 1 / a.k) < 1e-9 ? t : (1 / k - 1 / a.k) / (1 / b.k - 1 / a.k);
  return { k, cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u };
}

/** Pixels per unit rounded to a quarter octave, so the counter layout only changes in steps while zooming. */
export function scaleStep(px: number): number {
  if (!(px > 0)) return 0;
  return Math.pow(2, Math.round(Math.log2(px) * 4) / 4);
}

export function sameView(a: View, b: View, eps = 1e-6): boolean {
  return Math.abs(a.k - b.k) < eps && Math.abs(a.cx - b.cx) < eps && Math.abs(a.cy - b.cy) < eps;
}

/** A view as stored (zoom and centre, rounded). */
export function serializeView(v: View): string {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return JSON.stringify({ k: r(v.k), cx: r(v.cx), cy: r(v.cy) });
}

/** A stored view, or null when missing or malformed (clamp it to the viewport before use). */
export function parseView(text: string | null): View | null {
  if (!text) return null;
  try {
    const o = JSON.parse(text) as Partial<View>;
    if (typeof o !== 'object' || o === null) return null;
    const { k, cx, cy } = o;
    if (typeof k !== 'number' || typeof cx !== 'number' || typeof cy !== 'number') return null;
    if (!Number.isFinite(k) || !Number.isFinite(cx) || !Number.isFinite(cy) || k < MIN_ZOOM || k > MAX_MAX_ZOOM) return null;
    return { k, cx, cy };
  } catch {
    return null;
  }
}
