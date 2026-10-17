// Debug overlay: the terrain field the board paints from (the map's TerrainMask, or the one synthesized per hex), one
// pixel per cell, as mask classes or as levels.
import { memo, useMemo } from 'react';
import { MASK, type MapDef } from '../../engine/types';
import { TURN_CENTRE, fmt } from './geometry';
import { terrainField } from './paint/field';

export type MaskOverlayMode = 'classes' | 'levels';

/** Overlay colour per mask class (RGBA). */
export const MASK_COLORS: Record<number, [number, number, number, number]> = {
  [MASK.open]: [255, 255, 255, 0],
  [MASK.woods]: [0, 90, 20, 200],
  [MASK.building]: [220, 30, 30, 220],
  [MASK.brush]: [140, 170, 40, 200],
  [MASK.orchard]: [90, 220, 90, 200],
  [MASK.field]: [250, 210, 40, 200],
  [MASK.marsh]: [40, 170, 160, 200],
  [MASK.stream]: [40, 110, 255, 230],
  [MASK.water]: [10, 40, 200, 220],
  [MASK.gully]: [150, 90, 30, 220],
  [MASK.road]: [255, 255, 255, 230],
  [MASK.railway]: [20, 20, 20, 230],
  [MASK.bridge]: [230, 0, 230, 230],
};

const LEVEL_COLORS: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [255, 200, 60, 150],
  [255, 120, 20, 170],
  [200, 40, 10, 190],
  [120, 0, 60, 200],
  [60, 0, 120, 210],
];

export const MaskOverlay = memo(function MaskOverlay({ map, mode, rotate180 }: { map: MapDef; mode: MaskOverlayMode; rotate180: boolean }) {
  const img = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const f = terrainField(map);
    const canvas = document.createElement('canvas');
    canvas.width = f.width;
    canvas.height = f.height;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.createImageData(f.width, f.height);
    for (let i = 0; i < f.width * f.height; i++) {
      const c = mode === 'classes' ? (MASK_COLORS[f.cls[i]] ?? [255, 0, 255, 255]) : LEVEL_COLORS[Math.min(LEVEL_COLORS.length - 1, f.level[i])];
      data.data.set(c, i * 4);
    }
    ctx.putImageData(data, 0, 0);
    return { url: canvas.toDataURL('image/png'), f };
  }, [map, mode]);
  if (!img) return null;
  const { f, url } = img;
  return (
    <g pointerEvents="none" opacity={0.7} transform={rotate180 ? `rotate(180 ${fmt(TURN_CENTRE.x)} ${fmt(TURN_CENTRE.y)})` : undefined}>
      <image href={url} x={f.x0} y={f.y0} width={f.width / f.res} height={f.height / f.res} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
    </g>
  );
});
