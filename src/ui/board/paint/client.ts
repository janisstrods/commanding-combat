// The terrain painter as the page sees it: paintings are made in a Web Worker (worker.ts), one at a time, whole
// paintings (a board waits for them) before tiles, so the page never stalls on one. Where no worker can paint (no
// OffscreenCanvas, or the worker failed) whole paintings are made on the page as before, and there are no tiles.
import type { MapDef } from '../../../engine/types';
import type { PixelRect } from './tiles';
import type { PaintRequest, PaintResponse } from './worker';

export interface PaintJob {
  /** The map's fingerprint (TerrainLayer's mapFingerprint). */
  key: string;
  map: MapDef;
  ppu: number;
  /** A tile: this part of the painting at `ppu` (worker only). Omitted: the whole painting. */
  rect?: PixelRect;
}

export interface Painting {
  /** The image's URL (an object URL; whoever drops the image revokes it). */
  promise: Promise<string>;
  /** Drop the job if it has not started (the promise then rejects with Cancelled). */
  cancel: () => void;
  /** Whether the worker has it (it can no longer be cancelled). */
  started: () => boolean;
}

export class Cancelled extends Error {
  constructor() {
    super('Painting cancelled');
  }
}

interface Job extends PaintJob {
  id: number;
  started: boolean;
  resolve: (url: string) => void;
  reject: (e: unknown) => void;
}

/** A job the worker does not answer in this long is taken as lost: the worker is dropped. */
const WATCHDOG_MS = 60000;

let worker: Worker | null = null;
let failed = false;
let nextId = 1;
const queue: Job[] = [];
let running: Job | null = null;
let watchdog: ReturnType<typeof setTimeout> | undefined;

/** Whether paintings are made off the page (and tiles can be had). */
export function paintsOffThread(): boolean {
  return !failed && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
}

/** Ask for a painting: whole paintings go first, then tiles in the order asked. */
export function requestPainting(job: PaintJob): Painting {
  let j!: Job;
  const promise = new Promise<string>((resolve, reject) => {
    j = { ...job, id: nextId++, started: false, resolve, reject };
  });
  if (paintsOffThread()) {
    queue.push(j);
    pump();
  } else run(j);
  return {
    promise,
    cancel: () => {
      const i = queue.indexOf(j);
      if (i < 0) return;
      queue.splice(i, 1);
      j.reject(new Cancelled());
    },
    started: () => j.started,
  };
}

function pump() {
  if (running || !queue.length) return;
  const w = spawn();
  if (!w) {
    fail();
    return;
  }
  const at = queue.findIndex((j) => !j.rect);
  const j = queue.splice(at >= 0 ? at : 0, 1)[0];
  j.started = true;
  running = j;
  const msg: PaintRequest = { id: j.id, key: j.key, map: j.map, ppu: j.ppu, rect: j.rect };
  try {
    w.postMessage(msg);
  } catch (e) {
    console.error('Could not hand the painting to its worker', e);
    fail();
    return;
  }
  watchdog = setTimeout(() => {
    console.error('The terrain painter stopped answering');
    fail();
  }, WATCHDOG_MS);
}

function spawn(): Worker | null {
  if (worker || failed) return worker;
  try {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<PaintResponse>) => {
      if (worker === w) answer(ev.data);
    };
    w.onerror = (ev) => {
      ev.preventDefault?.();
      console.error('The terrain painter failed', ev.message);
      if (worker === w) fail();
    };
    w.onmessageerror = () => {
      if (worker === w) fail();
    };
    worker = w;
  } catch (e) {
    console.error('No worker for the terrain painter', e);
    worker = null;
  }
  return worker;
}

function answer(r: PaintResponse) {
  const j = running;
  if (!j || r.id !== j.id) return;
  clearTimeout(watchdog);
  if ('png' in r) {
    running = null;
    j.resolve(URL.createObjectURL(r.png));
  } else if (r.unsupported) {
    fail();
    return;
  } else {
    running = null;
    j.reject(new Error(r.error));
  }
  pump();
}

/** No more worker: what waits is painted on the page (tiles are refused). */
function fail() {
  failed = true;
  clearTimeout(watchdog);
  worker?.terminate();
  worker = null;
  const left = running ? [running, ...queue] : [...queue];
  running = null;
  queue.length = 0;
  for (const j of left) run(j);
}

/** Paint on the page (no worker): a whole painting, after a frame so a stand-in can show first. */
function run(j: Job) {
  if (j.rect) {
    j.reject(new Error('Tiles are painted in a worker only'));
    return;
  }
  setTimeout(async () => {
    try {
      const { paintTerrain } = await import('./painter');
      const canvas = paintTerrain(j.map, j.ppu).canvas as HTMLCanvasElement;
      canvas.toBlob((blob) => j.resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')), 'image/png');
    } catch (e) {
      j.reject(e);
    }
  }, 16);
}
