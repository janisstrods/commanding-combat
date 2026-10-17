// The static vector layers over the painted terrain: hex outlines and centre dots, the dimmed slivers outside the hex
// grid, hexside features (walls, hedges, fences, cliffs), hex labels and the objective circles. Drawn in screen
// coordinates (text stays upright when the board is turned).
import { memo, useMemo } from 'react';
import { ALL_HEXES, label } from '../../engine/hex';
import type { HexsideFeature, MapDef } from '../../engine/types';
import { BOUNDS, fmt, hexCentre, hexCorners, hexsideOfKey, hexsideSegment, type Point } from './geometry';

const P = (p: Point) => `${fmt(p.x)},${fmt(p.y)}`;

/** One path through every hex outline. */
export const GridLayer = memo(function GridLayer({ rotate180 }: { rotate180: boolean }) {
  const { grid, dots, outside } = useMemo(() => {
    let grid = '';
    let dots = '';
    let outside = `M${fmt(BOUNDS.x)},${fmt(BOUNDS.y)}h${fmt(BOUNDS.w)}v${fmt(BOUNDS.h)}h${fmt(-BOUNDS.w)}Z`;
    for (const h of ALL_HEXES) {
      const cs = hexCorners(h, rotate180);
      const ring = `M${cs.map(P).join('L')}Z`;
      grid += ring;
      outside += ring;
      const c = hexCentre(h, rotate180);
      dots += `M${fmt(c.x + 0.032)},${fmt(c.y)}a0.032,0.032 0 1,0 -0.064,0a0.032,0.032 0 1,0 0.064,0`;
    }
    return { grid, dots, outside };
  }, [rotate180]);
  return (
    <g className="board-grid" pointerEvents="none">
      <path d={outside} fillRule="evenodd" fill="rgba(36, 32, 16, 0.32)" />
      <path d={grid} fill="none" stroke="rgba(30, 30, 20, 0.42)" strokeWidth={0.022} strokeLinejoin="round" />
      <path d={dots} fill="rgba(30, 30, 20, 0.6)" />
    </g>
  );
});

export const LabelLayer = memo(function LabelLayer({ rotate180 }: { rotate180: boolean }) {
  return (
    <g className="board-labels" pointerEvents="none">
      {ALL_HEXES.map((h) => {
        const c = hexCentre(h, rotate180);
        return (
          <text key={h} x={fmt(c.x)} y={fmt(c.y - 0.69)} className="board-label">
            {label(h)}
          </text>
        );
      })}
    </g>
  );
});

/** Small circles along a segment (a hedge's foliage), as path data. */
function blobs(a: Point, b: Point, step: number, r: number, jitter: number, seed: number): string {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(2, Math.round(L / step));
  const nx = -(b.y - a.y) / L;
  const ny = (b.x - a.x) / L;
  let d = '';
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const o = (((k * 7 + seed) % 5) / 4 - 0.5) * jitter;
    const x = a.x + (b.x - a.x) * t + nx * o;
    const y = a.y + (b.y - a.y) * t + ny * o;
    const rr = r * (0.85 + ((k * 13 + seed) % 4) * 0.08);
    d += `M${fmt(x + rr)},${fmt(y)}a${fmt(rr)},${fmt(rr)} 0 1,0 ${fmt(-2 * rr)},0a${fmt(rr)},${fmt(rr)} 0 1,0 ${fmt(2 * rr)},0`;
  }
  return d;
}

export const HexsideLayer = memo(function HexsideLayer({ map, rotate180 }: { map: MapDef; rotate180: boolean }) {
  const paths = useMemo(() => {
    const seg: Record<HexsideFeature, string> = { Wall: '', Hedge: '', Fence: '', Cliff: '' };
    let hedgeLeaves = '';
    let hedgeLight = '';
    let cliffTeeth = '';
    for (const [keyText, feature] of Object.entries(map.hexsides)) {
      const key = Number(keyText);
      const { hex, side, other } = hexsideOfKey(key);
      const [a, b] = hexsideSegment(hex, side, rotate180);
      seg[feature] += `M${P(a)}L${P(b)}`;
      if (feature === 'Hedge') {
        hedgeLeaves += blobs(a, b, 0.085, 0.052, 0.03, key);
        const off = { x: -0.012, y: -0.016 };
        hedgeLight += blobs({ x: a.x + off.x, y: a.y + off.y }, { x: b.x + off.x, y: b.y + off.y }, 0.17, 0.022, 0.03, key + 3);
      } else if (feature === 'Cliff') {
        // teeth point down the slope: away from the higher of the two hexes
        const high = other !== null && map.elevation[other] > map.elevation[hex] ? other : hex;
        const cHigh = hexCentre(high, rotate180);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const l = Math.hypot(nx, ny);
        nx /= l;
        ny /= l;
        if ((mx - cHigh.x) * nx + (my - cHigh.y) * ny < 0) {
          nx = -nx;
          ny = -ny;
        }
        const n = 6;
        for (let k = 0; k < n; k++) {
          const t0 = (k + 0.15) / n;
          const t1 = (k + 0.85) / n;
          const tm = (k + 0.5) / n;
          const p0 = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 };
          const p1 = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 };
          const pm = { x: a.x + (b.x - a.x) * tm + nx * 0.11, y: a.y + (b.y - a.y) * tm + ny * 0.11 };
          cliffTeeth += `M${P(p0)}L${P(pm)}L${P(p1)}Z`;
        }
      }
    }
    return { seg, hedgeLeaves, hedgeLight, cliffTeeth };
  }, [map, rotate180]);
  const { seg } = paths;
  // the snow map: hedges are bare and dusted, walls and fences darker against the snow
  const winter = /w$/.test(map.id);
  const hedge = winter ? { base: '#3a4234', leaves: '#4c5444', light: '#e6ebee' } : { base: '#2f4320', leaves: '#3f5a2a', light: '#6f8c48' };
  return (
    <g className="board-hexsides" pointerEvents="none" strokeLinecap="round">
      {seg.Cliff && (
        <>
          <path d={paths.cliffTeeth} fill="#5b4428" opacity={0.9} />
          <path d={seg.Cliff} stroke="#3f2f1c" strokeWidth={0.07} fill="none" />
        </>
      )}
      {seg.Fence && (
        <>
          <path d={seg.Fence} stroke="rgba(250, 240, 210, 0.45)" strokeWidth={0.05} fill="none" />
          <path d={seg.Fence} stroke="#5e4429" strokeWidth={0.026} fill="none" />
          <path d={seg.Fence} stroke="#4a3420" strokeWidth={0.055} strokeDasharray="0.022 0.11" strokeLinecap="butt" fill="none" />
        </>
      )}
      {seg.Wall && (
        <>
          <path d={seg.Wall} stroke="rgba(20, 18, 12, 0.45)" strokeWidth={0.1} fill="none" transform="translate(0.012 0.018)" />
          <path d={seg.Wall} stroke="#4f4b42" strokeWidth={0.085} fill="none" />
          <path d={seg.Wall} stroke="#bdb5a3" strokeWidth={0.052} strokeDasharray="0.075 0.02" strokeLinecap="butt" fill="none" />
        </>
      )}
      {seg.Hedge && (
        <>
          <path d={seg.Hedge} stroke="rgba(16, 26, 8, 0.4)" strokeWidth={0.13} fill="none" transform="translate(0.018 0.024)" />
          <path d={seg.Hedge} stroke={hedge.base} strokeWidth={0.1} fill="none" />
          <path d={paths.hedgeLeaves} fill={hedge.leaves} />
          <path d={paths.hedgeLight} fill={hedge.light} opacity={0.85} />
        </>
      )}
    </g>
  );
});

export const ObjectiveLayer = memo(function ObjectiveLayer({ map, rotate180 }: { map: MapDef; rotate180: boolean }) {
  return (
    <g className="board-objectives" pointerEvents="none">
      {map.objectives.map((h, i) => {
        if (h === undefined || h < 0) return null;
        const c = hexCentre(h, rotate180);
        const bx = c.x - 0.43;
        const by = c.y - 0.34;
        return (
          <g key={i}>
            <circle cx={fmt(c.x)} cy={fmt(c.y)} r={0.6} fill="none" stroke="rgba(255, 248, 225, 0.75)" strokeWidth={0.1} />
            <circle cx={fmt(c.x)} cy={fmt(c.y)} r={0.6} fill="none" stroke="#8a2318" strokeWidth={0.05} />
            <circle cx={fmt(bx)} cy={fmt(by)} r={0.2} fill="#f4ecd2" stroke="#8a2318" strokeWidth={0.04} />
            <text x={fmt(bx)} y={fmt(by + 0.095)} className="board-objective-num">
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
});

