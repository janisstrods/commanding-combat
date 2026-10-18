// Sharper terrain for the zoomed-in board: which tiles at which resolution (paint/tiles.ts), and how the page hands
// paintings to the painter's worker (paint/client.ts: whole paintings first, one job at a time, cancellable tiles).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMap } from '../../src/engine/data';
import { BOUNDS, TURN_CENTRE } from '../../src/ui/board/geometry';
import { ENLARGE_OK, MAX_TILE_PPU, TILE_PX, VIEW_BUDGET, mapBox, paintingSize, planTiles, tileBudget, tileLevel, tilePixels, tilesCovering, type Tile } from '../../src/ui/board/paint/tiles';
import { handle, type PaintRequest, type PaintResponse } from '../../src/ui/board/paint/worker';

const ZONE = { x: BOUNDS.x, y: BOUNDS.y, w: BOUNDS.w, h: BOUNDS.h };
const holds = (t: Tile, px: number, py: number) => px >= t.rect.x && px < t.rect.x + t.rect.w && py >= t.rect.y && py < t.rect.y + t.rect.h;

describe('tile resolution', () => {
  it('keeps the painting until the board shows it clearly enlarged', () => {
    expect(tileLevel(84, 60)).toBeNull();
    expect(tileLevel(84, 84 * ENLARGE_OK)).toBeNull();
    expect(tileLevel(84, 110)).toBe(168);
    expect(tileLevel(84, 168 * ENLARGE_OK)).toBe(168);
    expect(tileLevel(84, 220)).toBe(336);
    // the deepest zoom (180 px per hex) on a 2x and a 3x screen
    expect(tileLevel(84, 360)).toBe(336);
    expect(tileLevel(84, 540)).toBe(672);
    expect(tileLevel(84, 5000)).toBe(672);
  });

  it('is never more enlarged than ENLARGE_OK below the cap, nor finer than that needs', () => {
    for (let need = 106; need < 1500; need += 3) {
      const level = tileLevel(84, need)!;
      expect(level).toBeLessThanOrEqual(MAX_TILE_PPU);
      expect(level * ENLARGE_OK >= need || level * 2 > MAX_TILE_PPU).toBe(true);
      expect(level === 168 || (level / 2) * ENLARGE_OK < need).toBe(true);
    }
  });
});

describe('tiles', () => {
  it('cut the whole painting into whole-pixel tiles, each once', () => {
    for (const level of [168, 336, 672]) {
      const { w, h } = paintingSize(level);
      const all = tilesCovering(level, { x: ZONE.x - 3, y: ZONE.y - 3, w: ZONE.w + 6, h: ZONE.h + 6 });
      expect(tilePixels(all)).toBe(w * h);
      expect(new Set(all.map((t) => `${t.i},${t.j}`)).size).toBe(all.length);
      for (const t of all) {
        expect(t.level).toBe(level);
        expect(t.rect.x).toBe(t.i * TILE_PX);
        expect(t.rect.y).toBe(t.j * TILE_PX);
        expect(t.rect.w).toBeGreaterThan(0);
        expect(t.rect.h).toBeGreaterThan(0);
        expect(t.rect.w).toBeLessThanOrEqual(TILE_PX);
        expect(t.rect.h).toBeLessThanOrEqual(TILE_PX);
        expect(t.rect.x + t.rect.w).toBeLessThanOrEqual(w);
        expect(t.rect.y + t.rect.h).toBeLessThanOrEqual(h);
      }
    }
  });

  it('cover the box asked for, the tile at its middle first', () => {
    const box = { x: 5.3, y: 4.1, w: 4.2, h: 3.3 };
    const level = 336;
    const ts = tilesCovering(level, box);
    const px = (x: number) => Math.floor((x - BOUNDS.x) * level);
    const py = (y: number) => Math.floor((y - BOUNDS.y) * level);
    for (const [x, y] of [
      [box.x, box.y],
      [box.x + box.w - 1e-6, box.y],
      [box.x, box.y + box.h - 1e-6],
      [box.x + box.w - 1e-6, box.y + box.h - 1e-6],
    ]) {
      expect(ts.some((t) => holds(t, px(x), py(y)))).toBe(true);
    }
    expect(holds(ts[0], px(box.x + box.w / 2), py(box.y + box.h / 2))).toBe(true);
    // no tile beyond the box
    for (const t of ts) {
      expect(t.rect.x).toBeLessThan(px(box.x + box.w));
      expect(t.rect.x + t.rect.w).toBeGreaterThan(px(box.x));
    }
    expect(tilesCovering(168, { x: -20, y: -20, w: 3, h: 3 })).toEqual([]);
  });

  it('follow a board turned 180 degrees', () => {
    const box = { x: 2, y: 3, w: 4, h: 5 };
    const turned = mapBox(box, true);
    expect(turned.x + turned.w / 2).toBeCloseTo(2 * TURN_CENTRE.x - (box.x + box.w / 2), 9);
    expect(turned.y + turned.h / 2).toBeCloseTo(2 * TURN_CENTRE.y - (box.y + box.h / 2), 9);
    const back = mapBox(turned, true);
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(back[k]).toBeCloseTo(box[k], 9);
    expect(mapBox(box, false)).toEqual(box);
  });
});

describe('tile plans', () => {
  it('want nothing while the painting is sharp enough', () => {
    expect(planTiles(84, 100, ZONE, false)).toBeNull();
  });

  it('want the view first, then around it, within the budget', () => {
    const box = { x: 6, y: 5, w: 4, h: 3 };
    const p = planTiles(84, 360, box, false, 8e6)!;
    expect(p.level).toBe(336);
    const ids = (ts: Tile[]) => ts.map((t) => `${t.i},${t.j}`);
    expect(ids(p.visible)).toEqual(ids(tilesCovering(336, box)));
    expect(p.around.length).toBeGreaterThan(0);
    expect(ids(p.around).some((id) => ids(p.visible).includes(id))).toBe(false);
    expect(tilePixels(p.visible) + tilePixels(p.around)).toBeLessThanOrEqual(8e6);
    // a tight budget leaves only the view
    const tight = planTiles(84, 360, box, false, tilePixels(p.visible))!;
    expect(tight.around).toEqual([]);
  });

  it('go coarser when the view would take too many pixels, and stop at the painting', () => {
    // the whole combat zone wanted at 336 px per hex is ~47 MP
    const p = planTiles(84, 300, ZONE, false)!;
    expect(p.level).toBe(168);
    expect(tilePixels(p.visible)).toBeLessThanOrEqual(VIEW_BUDGET);
    expect(planTiles(84, 300, ZONE, false, 1e6)).toBeNull();
  });

  it('keep a few screens of tiles, within bounds', () => {
    expect(tileBudget(0)).toBe(8e6);
    expect(tileBudget(3e6)).toBe(12e6);
    expect(tileBudget(50e6)).toBe(24e6);
  });
});

describe('painter worker', () => {
  it('declines where it has no OffscreenCanvas (the page then paints)', async () => {
    const r = await handle({ id: 7, key: 'k', map: loadMap('1'), ppu: 10 });
    expect(r).toMatchObject({ id: 7, unsupported: true });
  });
});

describe('painting client', () => {
  class FakeWorker {
    static last: FakeWorker;
    posted: PaintRequest[] = [];
    terminated = false;
    onmessage: ((ev: { data: PaintResponse }) => void) | null = null;
    onerror: unknown = null;
    onmessageerror: unknown = null;
    constructor() {
      FakeWorker.last = this;
    }
    postMessage(m: PaintRequest) {
      this.posted.push(m);
    }
    terminate() {
      this.terminated = true;
    }
    /** Answer the job last posted. */
    done() {
      this.onmessage?.({ data: { id: this.posted[this.posted.length - 1].id, png: new Blob(['png']), ms: 1 } });
    }
  }

  async function client() {
    vi.resetModules();
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('OffscreenCanvas', class {});
    return import('../../src/ui/board/paint/client');
  }
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const map = loadMap('1');
  const tile = (x: number) => ({ key: 'k', map, ppu: 168, rect: { x, y: 0, w: TILE_PX, h: TILE_PX } });

  it('hands the worker one job at a time, whole paintings before tiles', async () => {
    const c = await client();
    expect(c.paintsOffThread()).toBe(true);
    const a = c.requestPainting(tile(0));
    const b = c.requestPainting(tile(512));
    const whole = c.requestPainting({ key: 'k', map, ppu: 84 });
    const w = FakeWorker.last;
    expect(w.posted).toHaveLength(1);
    expect(a.started()).toBe(true);
    expect(b.started()).toBe(false);
    w.done();
    expect(await a.promise).toMatch(/^blob:/);
    expect(w.posted).toHaveLength(2);
    expect(w.posted[1].rect).toBeUndefined();
    expect(whole.started()).toBe(true);
    w.done();
    await whole.promise;
    expect(w.posted[2].rect?.x).toBe(512);
    w.done();
    await b.promise;
  });

  it('drops a tile that has not started when asked', async () => {
    const c = await client();
    const a = c.requestPainting(tile(0));
    const b = c.requestPainting(tile(512));
    const d = c.requestPainting(tile(1024));
    b.cancel();
    await expect(b.promise).rejects.toBeInstanceOf(c.Cancelled);
    a.cancel(); // started: it goes on
    const w = FakeWorker.last;
    w.done();
    await a.promise;
    expect(w.posted.map((m) => m.rect?.x)).toEqual([0, 1024]);
    w.done();
    await d.promise;
  });

  it('gives up on a worker that cannot paint: no more tiles', async () => {
    const c = await client();
    const a = c.requestPainting(tile(0));
    const w = FakeWorker.last;
    w.onmessage?.({ data: { id: w.posted[0].id, error: 'no 2d', unsupported: true } });
    await expect(a.promise).rejects.toThrow(/worker only/);
    expect(w.terminated).toBe(true);
    expect(c.paintsOffThread()).toBe(false);
    await expect(c.requestPainting(tile(512)).promise).rejects.toThrow(/worker only/);
  });
});
