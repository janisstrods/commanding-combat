/// <reference lib="webworker" />
// Web Worker entry for the terrain painter (module worker): paints a map's whole terrain, or one tile of it, on an
// OffscreenCanvas and sends it back as a PNG, so the page never waits for a painting (client.ts sends one job at a time).
// In:  { id, key, map, ppu, rect? }  ->  Out: { id, png, ms } or { id, error, unsupported? }
import type { MapDef } from '../../../engine/types';
import { paintPart, paintWhole, preparePainting, sceneOf, type Prepared, type Scene } from './painter';
import type { PixelRect } from './tiles';

export interface PaintRequest {
  id: number;
  /** The map's fingerprint: the work done for a map is kept by it. */
  key: string;
  map: MapDef;
  ppu: number;
  /** One part of the painting at `ppu` (a tile); the whole painting when omitted. */
  rect?: PixelRect;
}

export type PaintResponse = { id: number; png: Blob; ms: number } | { id: number; error: string; unsupported?: boolean };

/** Recently used map preparations and scenes (per map and resolution), oldest first. */
const preps = new Map<string, Prepared>();
const scenes = new Map<string, Scene>();

function recall<T>(cache: Map<string, T>, key: string, keep: number, make: () => T): T {
  let v = cache.get(key);
  if (v === undefined) v = make();
  else cache.delete(key);
  cache.set(key, v);
  while (cache.size > keep) cache.delete(cache.keys().next().value as string);
  return v;
}

let canPaint: boolean | undefined;
function offscreen2d(): boolean {
  if (canPaint === undefined) {
    try {
      canPaint = typeof OffscreenCanvas !== 'undefined' && new OffscreenCanvas(1, 1).getContext('2d') !== null;
    } catch {
      canPaint = false;
    }
  }
  return canPaint;
}

/** Paint one job (exported for tests; the worker calls it for every message it gets). */
export async function handle(m: PaintRequest): Promise<PaintResponse> {
  if (!offscreen2d()) return { id: m.id, error: 'No 2D OffscreenCanvas in this worker', unsupported: true };
  try {
    const prep = recall(preps, m.key, 2, () => preparePainting(m.map));
    const { canvas, ms } = m.rect ? paintPart(recall(scenes, `${m.key}@${m.ppu}`, 3, () => sceneOf(prep, m.ppu)), m.rect) : paintWhole(prep, m.ppu);
    const png = await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' });
    return { id: m.id, png, ms };
  } catch (e) {
    return { id: m.id, error: e instanceof Error ? e.message : String(e) };
  }
}

declare const WorkerGlobalScope: { new (): unknown } | undefined;
const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof (WorkerGlobalScope as never);
if (inWorker) {
  const scope = self as unknown as DedicatedWorkerGlobalScope;
  scope.onmessage = (ev: MessageEvent<PaintRequest>) => {
    void handle(ev.data).then((r) => scope.postMessage(r));
  };
}
