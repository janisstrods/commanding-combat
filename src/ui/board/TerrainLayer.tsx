// The painted terrain of a map: painted once per map and resolution (paint/painter.ts, in a worker: paint/client.ts) and
// shown as an SVG <image>. While it paints, flat per-hex colours stand in. On a zoomed-in board the part in view gets
// sharper tiles (paint/tiles.ts), laid over the painting as they come in; the painting stays under them.
import { memo, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { ALL_HEXES } from '../../engine/hex';
import type { MapDef, TerrainType } from '../../engine/types';
import { BOUNDS, TURN_CENTRE, fmt, hexPoints } from './geometry';
import { Cancelled, paintsOffThread, requestPainting, type Painting } from './paint/client';
import { paintingSize, planTiles, tileBudget, type Tile, type TilePlan } from './paint/tiles';
import { SettledZoom } from './useBoardZoom';

/** Default resolution of the painted terrain, in pixels per hex radius. */
export const DEFAULT_PPU = 84;

const cache = new Map<string, Promise<string>>();
/** The finished paintings, by the same key: a board of a map painted before shows its terrain from the first frame. */
const painted = new Map<string, string>();

/** A cheap fingerprint of everything the painting depends on (so an edited map repaints). */
export function mapFingerprint(map: MapDef): string {
  let h = 0;
  const mix = (v: number) => {
    h = (Math.imul(h, 31) + v) | 0;
  };
  map.terrain.forEach((t) => mix(t.length * 7 + t.charCodeAt(0)));
  map.elevation.forEach((e) => mix(e));
  map.building.forEach((b) => mix(b + 2));
  for (const [k, v] of Object.entries(map.paths)) mix(Number(k) * 3 + v.length);
  if (map.mask) {
    const m = map.mask;
    mix(m.res);
    mix(m.width);
    mix(m.height);
    for (let i = 0; i < m.cls.length; i += 17) mix(m.cls[i] * 5 + m.level[i]);
  }
  return `${map.id}:${h >>> 0}`;
}

/** The painted terrain of `map` as an object URL (cached per map and resolution). */
export function terrainImage(map: MapDef, ppu = DEFAULT_PPU): Promise<string> {
  const fp = mapFingerprint(map);
  const key = `${fp}@${ppu}`;
  let p = cache.get(key);
  if (!p) {
    p = requestPainting({ key: fp, map, ppu }).promise.then(
      (url) => {
        painted.set(key, url);
        return url;
      },
      (e: unknown) => {
        cache.delete(key);
        throw e;
      },
    );
    cache.set(key, p);
  }
  return p;
}

/** The painted terrain of `map` if it is painted already (`terrainImage` has resolved), else null. */
export function paintedTerrain(map: MapDef, ppu = DEFAULT_PPU): string | null {
  return painted.get(`${mapFingerprint(map)}@${ppu}`) ?? null;
}

export function useTerrainImage(map: MapDef, ppu = DEFAULT_PPU): string | null {
  const [url, setUrl] = useState<{ key: string; url: string } | null>(null);
  const key = `${mapFingerprint(map)}@${ppu}`;
  useEffect(() => {
    let live = true;
    terrainImage(map, ppu).then(
      (u) => live && setUrl({ key, url: u }),
      (e) => console.error('Could not paint the map', e),
    );
    return () => {
      live = false;
    };
  }, [key, map, ppu]);
  return url && url.key === key ? url.url : (painted.get(key) ?? null);
}

// ---------------------------------------------------------------------------------------------------------------------
// Sharper tiles for a zoomed-in board (one zoomable board at a time: the tiles last asked for are the ones kept)

interface TileImage extends Tile {
  key: string;
  url: string;
  /** When it was last wanted (for dropping the least recently used). */
  used: number;
}

const tiles = new Map<string, TileImage>();
let tilePixels = 0;
let budget = 0;
let clock = 0;
/** Tile paintings asked for and not back yet, by tile id. */
const pending = new Map<string, Painting>();
/** The map and the tiles last asked for (never dropped to make room). */
let wantedKey = '';
let wanted = new Set<string>();
const listeners = new Set<() => void>();

const tileId = (key: string, t: Tile) => `${key}@${t.level}:${t.i},${t.j}`;

function dropTile(id: string) {
  const t = tiles.get(id);
  if (!t) return;
  tiles.delete(id);
  tilePixels -= t.rect.w * t.rect.h;
  // after the board has let go of it
  setTimeout(() => URL.revokeObjectURL(t.url), 2000);
}

/** Drop the least recently used tiles that are not wanted until the rest fit the budget. */
function trimTiles(): boolean {
  let dropped = false;
  while (tilePixels > budget) {
    let oldest: TileImage | null = null;
    let oldestId = '';
    for (const [id, t] of tiles) {
      if (!wanted.has(id) && (!oldest || t.used < oldest.used)) {
        oldest = t;
        oldestId = id;
      }
    }
    if (!oldest) break;
    dropTile(oldestId);
    dropped = true;
  }
  return dropped;
}

const notify = () => listeners.forEach((l) => l());

/**
 * Ask for tiles of map `key` in this order, keeping at most `px` tile pixels: requests that have not started are dropped
 * and asked again in the new order, and another map's tiles go.
 */
function wantTiles(key: string, map: MapDef, list: readonly Tile[], px: number) {
  for (const [id, job] of pending) {
    if (job.started()) continue;
    job.cancel();
    pending.delete(id);
  }
  let dropped = false;
  for (const [id, t] of tiles) {
    if (t.key === key) continue;
    dropTile(id);
    dropped = true;
  }
  wantedKey = key;
  wanted = new Set(list.map((t) => tileId(key, t)));
  budget = px;
  for (const t of list) {
    const id = tileId(key, t);
    const have = tiles.get(id);
    if (have) {
      have.used = ++clock;
      continue;
    }
    if (pending.has(id)) continue;
    const job = requestPainting({ key, map, ppu: t.level, rect: t.rect });
    pending.set(id, job);
    job.promise.then(
      (url) => {
        if (pending.get(id) === job) pending.delete(id);
        if (key !== wantedKey || tiles.has(id)) {
          URL.revokeObjectURL(url);
          return;
        }
        tiles.set(id, { ...t, key, url, used: ++clock });
        tilePixels += t.rect.w * t.rect.h;
        trimTiles();
        notify();
      },
      (e: unknown) => {
        if (pending.get(id) === job) pending.delete(id);
        if (!(e instanceof Cancelled)) console.error('Could not paint a terrain tile', e);
      },
    );
  }
  if (trimTiles() || dropped) notify();
}

/** The tiles to lay over the painting of map `key`: those up to `level`, coarser ones underneath. */
function tilesToShow(key: string, level: number): TileImage[] {
  const out: TileImage[] = [];
  for (const t of tiles.values()) if (t.key === key && t.level <= level) out.push(t);
  return out.sort((a, b) => a.level - b.level);
}

/** The tiles a zoomable board (`zoomable`) lays over its painting; boards that do not zoom take no part. */
function useTerrainTiles(zoomable: boolean, map: MapDef, key: string, plan: TilePlan | null, px: number): TileImage[] {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!zoomable) return;
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, [zoomable]);
  useEffect(() => {
    if (zoomable) wantTiles(key, map, plan ? [...plan.visible, ...plan.around] : [], px);
  }, [zoomable, key, map, plan, px]);
  // a board that goes lets its tiles go
  useEffect(() => (zoomable ? () => wantTiles(key, map, [], 0) : undefined), [zoomable, key, map]);
  return plan ? tilesToShow(key, plan.level) : [];
}

// ---------------------------------------------------------------------------------------------------------------------

/** Flat colours per terrain type: the stand-in while the painting is made, and the legend. */
export const TERRAIN_FLAT: Record<TerrainType, string> = {
  Open: '#a6aa6c',
  Woods: '#4c6434',
  Brush: '#7d8a50',
  Orchard: '#93a160',
  Field: '#c6b476',
  Building: '#9a6a52',
  MajorBridge: '#a6aa6c',
  MinorBridge: '#a6aa6c',
  Gully: '#8c7650',
  Water: '#5f8aa2',
  Stream: '#86a8a0',
  Marsh: '#7c8a68',
};

const FlatTerrain = memo(function FlatTerrain({ map }: { map: MapDef }) {
  return (
    <g>
      {ALL_HEXES.map((h) => (
        <polygon key={h} points={hexPoints(h)} fill={TERRAIN_FLAT[map.terrain[h]] ?? TERRAIN_FLAT.Open} />
      ))}
    </g>
  );
});

/** The terrain picture, in map coordinates; turned with the board when `rotate180`. */
export const TerrainLayer = memo(function TerrainLayer({ map, rotate180 = false, ppu = DEFAULT_PPU }: { map: MapDef; rotate180?: boolean; ppu?: number }) {
  const url = useTerrainImage(map, ppu);
  const key = useMemo(() => mapFingerprint(map), [map]);
  // a zoomable board: sharper tiles of the part in view once it is shown clearly enlarged
  const zoom = useContext(SettledZoom);
  const budget = zoom ? tileBudget(zoom.box.w * zoom.box.h * (zoom.scale * zoom.dpr) ** 2) : 0;
  const plan = useMemo(
    () => (zoom && zoom.scale > 0 && paintsOffThread() ? planTiles(ppu, zoom.scale * zoom.dpr, zoom.box, rotate180, budget) : null),
    [zoom, ppu, rotate180, budget],
  );
  const sharp = useTerrainTiles(zoom !== null, map, key, plan, budget);
  const transform = rotate180 ? `rotate(180 ${fmt(TURN_CENTRE.x)} ${fmt(TURN_CENTRE.y)})` : undefined;
  const flat = useMemo(() => <FlatTerrain map={map} />, [map]);
  const size = paintingSize(ppu);
  return (
    <g className="board-terrain" transform={transform} pointerEvents="none">
      <rect x={BOUNDS.x} y={BOUNDS.y} width={BOUNDS.w} height={BOUNDS.h} fill={TERRAIN_FLAT.Open} />
      {url ? (
        // the canvas is a whole number of pixels: it covers a hair more than the combat zone
        <image href={url} x={BOUNDS.x} y={BOUNDS.y} width={size.w / ppu} height={size.h / ppu} preserveAspectRatio="none" />
      ) : (
        flat
      )}
      {sharp.map((t) => (
        <image
          key={`${t.level}:${t.i},${t.j}`}
          href={t.url}
          x={BOUNDS.x + t.rect.x / t.level}
          y={BOUNDS.y + t.rect.y / t.level}
          width={t.rect.w / t.level}
          height={t.rect.h / t.level}
          preserveAspectRatio="none"
        />
      ))}
    </g>
  );
});
