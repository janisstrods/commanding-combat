// The painted terrain of a map: painted once per map onto a canvas (paint/painter.ts) and shown as an SVG <image>.
// While it paints (a fraction of a second), flat per-hex colours stand in.
import { memo, useEffect, useMemo, useState } from 'react';
import { ALL_HEXES } from '../../engine/hex';
import type { MapDef, TerrainType } from '../../engine/types';
import { BOUNDS, TURN_CENTRE, fmt, hexPoints } from './geometry';

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
  const key = `${mapFingerprint(map)}@${ppu}`;
  let p = cache.get(key);
  if (!p) {
    p = new Promise<string>((resolve, reject) => {
      // give the page a frame to show the stand-in first
      setTimeout(async () => {
        try {
          const { paintTerrain } = await import('./paint/painter');
          const { canvas } = paintTerrain(map, ppu);
          const done = (url: string) => {
            painted.set(key, url);
            resolve(url);
          };
          canvas.toBlob((blob) => {
            if (blob) done(URL.createObjectURL(blob));
            else done(canvas.toDataURL('image/png'));
          }, 'image/png');
        } catch (e) {
          cache.delete(key);
          reject(e);
        }
      }, 16);
    });
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
  const transform = rotate180 ? `rotate(180 ${fmt(TURN_CENTRE.x)} ${fmt(TURN_CENTRE.y)})` : undefined;
  const flat = useMemo(() => <FlatTerrain map={map} />, [map]);
  return (
    <g className="board-terrain" transform={transform} pointerEvents="none">
      <rect x={BOUNDS.x} y={BOUNDS.y} width={BOUNDS.w} height={BOUNDS.h} fill={TERRAIN_FLAT.Open} />
      {url ? (
        // the canvas is a whole number of pixels: it covers a hair more than the combat zone
        <image href={url} x={BOUNDS.x} y={BOUNDS.y} width={Math.ceil(BOUNDS.w * ppu) / ppu} height={Math.ceil(BOUNDS.h * ppu) / ppu} preserveAspectRatio="none" />
      ) : (
        flat
      )}
    </g>
  );
});
