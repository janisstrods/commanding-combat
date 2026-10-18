// A figure under construction: shapes collected per colour layer, then flattened into one SVG path per layer (drawn
// in LAYERS order) plus the union of everything for the halo. Detail strokes ("lines") are kept apart.
import { type Mat, type Pt, type Shape, ID, apply, toD, xf } from './geom';

/** Colour layers, back to front. */
export const LAYERS = [
  'backKit', // packs, tanks and slung weapons behind the body
  'backMetal',
  'backWood',
  'farLeg',
  'farLegwear',
  'farBoot',
  'farArm',
  'farHand',
  'legs',
  'legwear',
  'boot',
  'coat',
  'pattern',
  'pattern2',
  'kit',
  'kit2',
  'metal',
  'wood',
  'brass',
  'arm',
  'armPattern',
  'skin',
  'skinShade',
  'hat',
  'hatMark',
  'accent',
  'flame',
  'flameCore',
  'gold',
  'light',
] as const;

export type Layer = (typeof LAYERS)[number];

/** Layers that are surface detail (inside other shapes): no outline, not part of the halo. */
export const FLAT: ReadonlySet<Layer> = new Set<Layer>(['pattern', 'pattern2', 'armPattern', 'skinShade', 'hatMark', 'flameCore', 'light']);

export interface Line {
  pts: Pt[];
  /** 'ink' (dark detail) or 'hi' (light detail). */
  tone: 'ink' | 'hi';
}

export class Sketch<L extends string = Layer> {
  readonly shapes = new Map<L, Shape[]>();
  readonly lines: Line[] = [];

  add(layer: L, shapes: Shape | readonly Shape[], m: Mat = ID): this {
    if (!shapes.length) return this;
    const list = this.shapes.get(layer) ?? [];
    const arr = (Array.isArray(shapes[0]) && typeof shapes[0][0] !== 'string' ? shapes : [shapes]) as Shape[];
    for (const s of arr) list.push(m === ID ? s : xf(s, m));
    this.shapes.set(layer, list);
    return this;
  }

  line(pts: readonly Pt[], tone: 'ink' | 'hi' = 'ink', m: Mat = ID): this {
    this.lines.push({ pts: pts.map((p) => (m === ID ? p : apply(m, p[0], p[1]))), tone });
    return this;
  }
}

const f1 = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};

/** Round path data to 0.1 (figures are ~40 units tall; 0.1 is under half a pixel even on a 300 px counter). */
function short(d: string): string {
  return d.replace(/-?\d+\.\d+/g, (m) => f1(Number(m)));
}

export interface FlatFigure<L extends string = Layer> {
  /** Union of every shape (the halo). */
  union: string;
  layers: { layer: L; d: string }[];
  ink?: string;
  hi?: string;
}

function lineD(lines: Line[]): string | undefined {
  if (!lines.length) return undefined;
  return lines.map((l) => 'M' + l.pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')).join('');
}

export function flatten<L extends string = Layer>(
  sk: Sketch<L>,
  order: readonly L[] = LAYERS as unknown as readonly L[],
  flat: ReadonlySet<L> = FLAT as unknown as ReadonlySet<L>,
): FlatFigure<L> {
  const layers: { layer: L; d: string }[] = [];
  const all: Shape[] = [];
  for (const layer of order) {
    const list = sk.shapes.get(layer);
    if (!list?.length) continue;
    layers.push({ layer, d: short(toD(list)) });
    if (!flat.has(layer)) all.push(...list);
  }
  return {
    union: short(toD(all)),
    layers,
    ink: lineD(sk.lines.filter((l) => l.tone === 'ink')),
    hi: lineD(sk.lines.filter((l) => l.tone === 'hi')),
  };
}
