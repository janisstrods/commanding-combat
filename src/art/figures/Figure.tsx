// One soldier on a counter: a halo in the counter colour (so overlapping men stay apart), then one path per colour
// layer, each outlined in ink under its fill (paint-order: stroke), then the fine detail lines.
import { mix } from '../palette';
import { type Colors, layerFill } from './dress';
import { type FigureSpec, buildFigure } from './rig';
import { FLAT } from './sketch';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface FigureProps {
  spec: FigureSpec;
  colors: Colors;
  /** Feet at (x, y), scale s; `flip` mirrors (facing left). */
  x: number;
  y: number;
  s?: number;
  flip?: boolean;
  ink: string;
  /** Halo colour (the counter face), or null for none. */
  halo: string | null;
}

export function Figure({ spec, colors, x, y, s = 1, flip = false, ink, halo }: FigureProps) {
  const g = buildFigure(spec);
  return (
    <g transform={`translate(${r2(x)} ${r2(y)}) scale(${r2(flip ? -s : s)} ${r2(s)})`}>
      {halo ? <path d={g.union} fill={halo} stroke={halo} strokeWidth={3.2} strokeLinejoin="round" /> : null}
      {g.layers.map((l) =>
        FLAT.has(l.layer) ? (
          <path key={l.layer} d={l.d} fill={layerFill(l.layer, colors)} />
        ) : (
          <path key={l.layer} d={l.d} fill={layerFill(l.layer, colors)} stroke={ink} strokeWidth={1.25} strokeLinejoin="round" paintOrder="stroke" />
        ),
      )}
      {g.ink ? <path d={g.ink} fill="none" stroke={ink} strokeWidth={0.42} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} /> : null}
      {g.hi ? <path d={g.hi} fill="none" stroke={mix(colors.coat, '#f4f0e0', 0.45)} strokeWidth={0.42} strokeLinecap="round" opacity={0.85} /> : null}
    </g>
  );
}
