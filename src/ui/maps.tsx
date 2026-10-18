// Maps on demand for the screens: a map's data is fetched when a screen first needs it (src/engine/data.ts ensureMap)
// and its terrain is painted before its board is shown (TerrainLayer's cache), so no board flashes unpainted terrain.
// Until then a screen shows MapLoading in the board's place.
import { useEffect, useState } from 'react';
import { ensureMap, loadMap, mapLoaded } from '../engine/data';
import type { MapDef } from '../engine/types';
import { boardViewBox, fmt } from './board/geometry';
import { DEFAULT_PPU, paintedTerrain, terrainImage } from './board/TerrainLayer';
import './maps.css';

/** The battle board's painting resolution (BattleBoard leaves Board at its default). */
export const BATTLE_PPU = DEFAULT_PPU;

/** Loads map `id` and paints its terrain at `ppu` (both cached); resolves to the map. */
export async function prepareMap(id: string, ppu = DEFAULT_PPU): Promise<MapDef> {
  const map = await ensureMap(id);
  await terrainImage(map, ppu);
  return map;
}

/** Map `id` if it is loaded and painted at `ppu` (a board of it shows its terrain at once), else null. */
export function preparedMap(id: string, ppu = DEFAULT_PPU): MapDef | null {
  if (!mapLoaded(id)) return null;
  const map = loadMap(id);
  return paintedTerrain(map, ppu) ? map : null;
}

/**
 * Starts loading map `id` in the background, e.g. while the pointer is over a scenario that uses it: its data, and with
 * `ppu` its terrain painted at that resolution too.
 */
export function preloadMap(id: string, ppu?: number): void {
  // a failure shows when the map is really needed
  (ppu === undefined ? ensureMap(id) : prepareMap(id, ppu)).catch(() => undefined);
}

export interface PreparedMap {
  /** The map, once loaded and painted. */
  map: MapDef | null;
  /** Why it could not be loaded (null while loading or when there is none to load). */
  error: string | null;
}

/** Map `id` once it is loaded and painted at `ppu` (`prepareMap`); null while that runs or for no id. */
export function usePreparedMap(id: string | null, ppu = DEFAULT_PPU): PreparedMap {
  const map = id === null ? null : preparedMap(id, ppu);
  const key = `${id}@${ppu}`;
  const [failed, setFailed] = useState<{ key: string; error: string } | null>(null);
  const [, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (id === null || map) return;
    let live = true;
    prepareMap(id, ppu).then(
      () => live && setLoaded(key),
      (e: unknown) => {
        console.error(`Could not load map ${id}`, e);
        if (live) setFailed({ key, error: e instanceof Error ? e.message : String(e) });
      },
    );
    return () => {
      live = false;
    };
  }, [id, ppu, key, map]);
  return { map, error: !map && failed?.key === key ? failed.error : null };
}

/** Stands in for a board while its map loads: the board's shape and paper margin, no terrain. */
export function MapLoading({ id, error, className }: { id?: string; error?: string | null; className?: string }) {
  const vb = boardViewBox();
  const text = error ? `Map ${id ?? ''} could not be loaded` : 'Loading map…';
  return (
    <svg
      className={`board-svg map-loading ${error ? 'is-error' : ''} ${className ?? ''}`}
      viewBox={vb.attr}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={id ? `Map ${id}: ${text}` : text}
      aria-busy={!error}
    >
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className="board-margin" />
      <text x={fmt(vb.x + vb.w / 2)} y={fmt(vb.y + vb.h / 2)} className="map-loading__text">
        {text}
      </text>
    </svg>
  );
}
