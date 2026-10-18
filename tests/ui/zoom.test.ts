import { describe, expect, it } from 'vitest';
import { boardViewBox } from '../../src/ui/board/geometry';
import {
  MIN_ZOOM,
  clampView,
  fitScale,
  fitView,
  lerpView,
  maxZoom,
  panBy,
  parseView,
  pinchView,
  pxPerUnit,
  scaleStep,
  serializeView,
  toBoard,
  toViewport,
  viewBoxOf,
  wheelFactor,
  zoomAt,
  type Size,
  type View,
} from '../../src/ui/board/zoom';

const world = boardViewBox();
const wide: Size = { w: 1200, h: 700 };
const tall: Size = { w: 390, h: 640 };
const phone: Size = { w: 375, h: 300 };

/** The board's rectangle in viewport pixels. */
function boardOnScreen(v: View, vp: Size) {
  const a = toViewport(v, vp, world, { x: world.x, y: world.y });
  const b = toViewport(v, vp, world, { x: world.x + world.w, y: world.y + world.h });
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}

describe('the fitted view', () => {
  it('shows the whole board, centred, as large as the viewport allows', () => {
    for (const vp of [wide, tall, phone]) {
      const v = clampView(fitView(world), vp, world);
      expect(v.k).toBe(1);
      const r = boardOnScreen(v, vp);
      expect(r.x0).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y0).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x1).toBeLessThanOrEqual(vp.w + 1e-9);
      expect(r.y1).toBeLessThanOrEqual(vp.h + 1e-9);
      // touches both sides along one axis, centred along the other
      const fillsW = Math.abs(r.x0) < 1e-6 && Math.abs(r.x1 - vp.w) < 1e-6;
      const fillsH = Math.abs(r.y0) < 1e-6 && Math.abs(r.y1 - vp.h) < 1e-6;
      expect(fillsW || fillsH).toBe(true);
      expect(r.x0 + r.x1).toBeCloseTo(vp.w);
      expect(r.y0 + r.y1).toBeCloseTo(vp.h);
    }
  });

  it('gives a viewBox with the viewport aspect ratio', () => {
    const vb = viewBoxOf({ k: 2.5, cx: 10, cy: 8 }, wide, world);
    expect(vb.w / vb.h).toBeCloseTo(wide.w / wide.h);
    expect(vb.x + vb.w / 2).toBeCloseTo(10);
    expect(vb.y + vb.h / 2).toBeCloseTo(8);
    expect(pxPerUnit({ k: 2.5, cx: 0, cy: 0 }, wide, world)).toBeCloseTo(fitScale(wide, world) * 2.5);
  });
});

describe('zoom limits', () => {
  it('never zooms out past the fit, nor in past the maximum', () => {
    const v0 = clampView(fitView(world), wide, world);
    expect(zoomAt(v0, wide, world, 0.5, 600, 350).k).toBe(MIN_ZOOM);
    const max = maxZoom(wide, world);
    expect(zoomAt(v0, wide, world, 1e6, 600, 350).k).toBeCloseTo(max);
    expect(clampView({ k: 0.2, cx: 0, cy: 0 }, wide, world).k).toBe(MIN_ZOOM);
    expect(clampView({ k: Number.NaN, cx: Number.NaN, cy: 3 }, wide, world).k).toBe(MIN_ZOOM);
  });

  it('allows between 3x and 12x, enough to read counters on a phone', () => {
    for (const vp of [wide, tall, phone, { w: 3000, h: 2000 }, { w: 100, h: 80 }]) {
      const m = maxZoom(vp, world);
      expect(m).toBeGreaterThanOrEqual(3);
      expect(m).toBeLessThanOrEqual(12);
    }
    expect(fitScale(phone, world) * maxZoom(phone, world)).toBeGreaterThanOrEqual(150);
  });

  it('keeps the board covering the viewport once it is larger than it', () => {
    const v = clampView({ k: 3, cx: -100, cy: 500 }, wide, world);
    const r = boardOnScreen(v, wide);
    expect(r.x0).toBeCloseTo(0);
    expect(r.y1).toBeCloseTo(wide.h);
    const v2 = clampView({ k: 3, cx: 100, cy: -500 }, wide, world);
    const r2 = boardOnScreen(v2, wide);
    expect(r2.x1).toBeCloseTo(wide.w);
    expect(r2.y0).toBeCloseTo(0);
  });

  it('centres the board along an axis where it is still smaller than the viewport', () => {
    // a wide viewport: at 1.1x the board's width is still less than the viewport's
    const v = clampView({ k: 1.1, cx: 0, cy: 3 }, wide, world);
    const r = boardOnScreen(v, wide);
    expect(r.x1 - r.x0).toBeLessThan(wide.w);
    expect(r.x0 + r.x1).toBeCloseTo(wide.w);
  });
});

describe('zooming and panning', () => {
  it('keeps the board point under the pointer where it is', () => {
    const v0 = clampView({ k: 2, cx: 12, cy: 9 }, wide, world);
    const p = toBoard(v0, wide, world, 700, 300);
    const v1 = zoomAt(v0, wide, world, 1.5, 700, 300);
    expect(v1.k).toBeCloseTo(3);
    const q = toViewport(v1, wide, world, p);
    expect(q.x).toBeCloseTo(700);
    expect(q.y).toBeCloseTo(300);
  });

  it('comes back to the same view after zooming in and out at the same point', () => {
    const v0 = clampView({ k: 2, cx: 12, cy: 9 }, wide, world);
    const v1 = zoomAt(zoomAt(v0, wide, world, 1.7, 500, 400), wide, world, 1 / 1.7, 500, 400);
    expect(v1.k).toBeCloseTo(v0.k);
    expect(v1.cx).toBeCloseTo(v0.cx);
    expect(v1.cy).toBeCloseTo(v0.cy);
  });

  it('pans the board with the pointer', () => {
    const v0 = clampView({ k: 3, cx: 12, cy: 9 }, wide, world);
    const p = toBoard(v0, wide, world, 600, 350);
    const v1 = panBy(v0, wide, world, 40, -25);
    const q = toViewport(v1, wide, world, p);
    expect(q.x).toBeCloseTo(640);
    expect(q.y).toBeCloseTo(325);
  });

  it('cannot pan the fitted board', () => {
    const v0 = clampView(fitView(world), wide, world);
    const v1 = panBy(v0, wide, world, 300, 200);
    expect(v1.cx).toBeCloseTo(v0.cx);
    expect(v1.cy).toBeCloseTo(v0.cy);
  });

  it('maps viewport and board points back and forth', () => {
    const v = { k: 2.2, cx: 7, cy: 5 };
    const p = toBoard(v, tall, world, 123, 456);
    const q = toViewport(v, tall, world, p);
    expect(q.x).toBeCloseTo(123);
    expect(q.y).toBeCloseTo(456);
  });

  it('pinches: zooms by the change of distance around the fingers, pans with their midpoint', () => {
    const v0 = clampView({ k: 3, cx: 12, cy: 9 }, tall, world);
    const a0 = { x: 150, y: 300 };
    const b0 = { x: 250, y: 300 };
    const mid = toBoard(v0, tall, world, 200, 300);
    // spread apart: twice the distance, same midpoint
    const v1 = pinchView(v0, tall, world, a0, b0, { x: 100, y: 300 }, { x: 300, y: 300 });
    expect(v1.k).toBeCloseTo(6);
    const q = toViewport(v1, tall, world, mid);
    expect(q.x).toBeCloseTo(200);
    expect(q.y).toBeCloseTo(300);
    // both fingers move together: a pan
    const v2 = pinchView(v0, tall, world, a0, b0, { x: 170, y: 330 }, { x: 270, y: 330 });
    expect(v2.k).toBeCloseTo(3);
    const q2 = toViewport(v2, tall, world, mid);
    expect(q2.x).toBeCloseTo(220);
    expect(q2.y).toBeCloseTo(330);
  });
});

describe('wheel, animation and storage helpers', () => {
  it('zooms in on a wheel turned away from the user, about 1.2x a notch, more for a pinch', () => {
    expect(wheelFactor(-100, 0, false)).toBeGreaterThan(1.15);
    expect(wheelFactor(-100, 0, false)).toBeLessThan(1.3);
    expect(wheelFactor(100, 0, false)).toBeLessThan(1);
    expect(wheelFactor(-3, 1, false)).toBeCloseTo(wheelFactor(-48, 0, false));
    expect(wheelFactor(-10, 0, true)).toBeGreaterThan(wheelFactor(-10, 0, false));
    expect(wheelFactor(-100000, 0, false)).toBe(2);
    expect(wheelFactor(100000, 0, false)).toBe(0.5);
  });

  it('animates from one view to another', () => {
    const a = { k: 1, cx: 10, cy: 8 };
    const b = { k: 4, cx: 4, cy: 2 };
    expect(lerpView(a, b, 0)).toEqual(a);
    const end = lerpView(a, b, 1);
    expect(end.k).toBeCloseTo(4);
    expect(end.cx).toBeCloseTo(4);
    expect(end.cy).toBeCloseTo(2);
    expect(lerpView(a, b, 0.5).k).toBeCloseTo(2);
    const same = lerpView({ k: 2, cx: 0, cy: 0 }, { k: 2, cx: 10, cy: 0 }, 0.25);
    expect(same.cx).toBeCloseTo(2.5);
  });

  it('rounds the scale to quarter octaves', () => {
    expect(scaleStep(32)).toBe(32);
    expect(scaleStep(33)).toBe(32);
    expect(scaleStep(40)).toBeCloseTo(Math.pow(2, 5.25));
    expect(scaleStep(0)).toBe(0);
    let last = 0;
    for (let px = 5; px < 400; px += 0.5) {
      const s = scaleStep(px);
      expect(s).toBeGreaterThanOrEqual(last);
      expect(Math.abs(Math.log2(s / px))).toBeLessThanOrEqual(0.125 + 1e-9);
      last = s;
    }
  });

  it('stores a view and reads it back, and rejects anything else', () => {
    const v = { k: 2.34567, cx: 3.21, cy: -0.5 };
    const back = parseView(serializeView(v))!;
    expect(back.k).toBeCloseTo(v.k, 2);
    expect(back.cx).toBeCloseTo(v.cx, 2);
    expect(back.cy).toBeCloseTo(v.cy, 2);
    for (const bad of [null, '', 'nope', '[]', '{}', '{"k":"2","cx":1,"cy":1}', '{"k":0.5,"cx":1,"cy":1}', '{"k":99,"cx":1,"cy":1}', '{"k":2,"cx":null,"cy":1}', 'null']) {
      expect(parseView(bad)).toBeNull();
    }
  });
});
