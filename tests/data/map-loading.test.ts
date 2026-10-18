// Maps load on demand (src/engine/data.ts ensureMap): a fresh copy of the data module, as the browser starts, has no
// map until it is loaded, and says so clearly when one is used too early.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Data = typeof import('../../src/engine/data');
let data: Data;

beforeEach(async () => {
  vi.resetModules();
  data = await import('../../src/engine/data');
});

describe('maps on demand', () => {
  it('knows every map before any is loaded, but has none loaded', () => {
    expect([...data.MAP_IDS]).toEqual(['1', '2', '3', '4', '5', '5w', '6', '7', '8', '9', '10', '11', '12']);
    expect(data.hasMap('5w')).toBe(true);
    for (const id of data.MAP_IDS) expect(data.mapLoaded(id)).toBe(false);
  });

  it('throws a clear error when a map is used before it is loaded, and another for an unknown map', () => {
    expect(() => data.loadMap('3')).toThrow(/Map "3" is not loaded yet: await ensureMap\("3"\)/);
    expect(() => data.loadMap('99')).toThrow(/No map "99"/);
  });

  it('loads a map once, with its mask; loadMap then returns the same map synchronously', async () => {
    const [a, b] = await Promise.all([data.ensureMap('7'), data.ensureMap('7')]);
    expect(a).toBe(b);
    expect(data.mapLoaded('7')).toBe(true);
    expect(data.loadMap('7')).toBe(a);
    expect(a.id).toBe('7');
    expect(a.mask?.cls.length).toBe(a.mask!.width * a.mask!.height);
    expect(await data.ensureMap('7')).toBe(a);
    expect(data.mapLoaded('8')).toBe(false);
  });

  it('rejects an unknown map', async () => {
    await expect(data.ensureMap('nope')).rejects.toThrow(/No map "nope"/);
  });

  it('loads several maps (all by default)', async () => {
    await data.ensureMaps(['1', '5w']);
    expect(data.mapLoaded('1') && data.mapLoaded('5w') && !data.mapLoaded('5')).toBe(true);
    await data.ensureMaps();
    for (const id of data.MAP_IDS) expect(data.mapLoaded(id)).toBe(true);
  });

  it('adopts a map that arrived another way (the AI worker gets it inside each view)', async () => {
    const sent = structuredClone(await data.ensureMap('4')); // as postMessage copies it
    vi.resetModules();
    const worker: Data = await import('../../src/engine/data');
    worker.adoptMap(sent);
    expect(worker.loadMap('4')).toBe(sent);
    worker.adoptMap({ ...sent, id: 'test' });
    expect(worker.mapLoaded('test')).toBe(false);
  });

  it('newGame of a scenario whose map is not loaded fails with that error; after ensureMap it works', async () => {
    const { newGame } = await import('../../src/engine/state');
    const scn = data.scenario('1');
    expect(() => newGame(scn, 1)).toThrow(/is not loaded yet/);
    await data.ensureMap(scn.map);
    expect(newGame(scn, 1).map).toBe(data.loadMap(scn.map));
  });
});
