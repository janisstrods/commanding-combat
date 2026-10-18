// Vector geometry for the counter art: closed shapes made of line and Bézier segments, affine transforms, and helpers
// that build limbs (capsules), circles and smooth blobs. Every shape is normalised to clockwise winding, so the shapes
// of one colour layer can share a single <path> (nonzero fill paints their union without holes).

export type Pt = readonly [number, number];

/** A segment of a closed shape: move, line, quadratic or cubic Bézier (absolute coordinates). */
export type Seg =
  | readonly ['M', number, number]
  | readonly ['L', number, number]
  | readonly ['Q', number, number, number, number]
  | readonly ['C', number, number, number, number, number, number];

/** One closed subpath, starting with 'M'. */
export type Shape = readonly Seg[];

/** Affine matrix [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f. */
export type Mat = readonly [number, number, number, number, number, number];

export const ID: Mat = [1, 0, 0, 1, 0, 0];

export function mul(m: Mat, n: Mat): Mat {
  // m applied after n
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export const scale = (sx: number, sy = sx): Mat => [sx, 0, 0, sy, 0, 0];
export function rotate(deg: number): Mat {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, s, -s, c, 0, 0];
}

/** translate(x, y) · rotate(deg) · scale(s): place a part drawn around its own origin. */
export const place = (x: number, y: number, deg = 0, s = 1): Mat => mul(translate(x, y), mul(rotate(deg), scale(s)));

export function apply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function xf(shape: Shape, m: Mat): Shape {
  const out: Seg[] = shape.map((s): Seg => {
    switch (s[0]) {
      case 'M':
      case 'L': {
        const [x, y] = apply(m, s[1], s[2]);
        return [s[0], x, y];
      }
      case 'Q': {
        const [cx, cy] = apply(m, s[1], s[2]);
        const [x, y] = apply(m, s[3], s[4]);
        return ['Q', cx, cy, x, y];
      }
      case 'C': {
        const [ax, ay] = apply(m, s[1], s[2]);
        const [bx, by] = apply(m, s[3], s[4]);
        const [x, y] = apply(m, s[5], s[6]);
        return ['C', ax, ay, bx, by, x, y];
      }
    }
  });
  // a mirroring transform flips the winding
  return m[0] * m[3] - m[1] * m[2] < 0 ? orient(out) : out;
}

export const xfAll = (shapes: readonly Shape[], m: Mat): Shape[] => shapes.map((s) => xf(s, m));

/** End point of a segment. */
function end(s: Seg): [number, number] {
  switch (s[0]) {
    case 'M':
    case 'L':
      return [s[1], s[2]];
    case 'Q':
      return [s[3], s[4]];
    case 'C':
      return [s[5], s[6]];
  }
}

/** Twice the signed area of the control polygon (positive = clockwise on screen, y down). */
export function area2(shape: Shape): number {
  const pts: number[] = [];
  for (const s of shape) for (let i = 1; i < s.length; i += 2) pts.push(s[i] as number, s[i + 1] as number);
  let a = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1];
  }
  return a;
}

export function reverse(shape: Shape): Shape {
  const ends = shape.map(end);
  const out: Seg[] = [['M', ...ends[ends.length - 1]]];
  for (let i = shape.length - 1; i >= 1; i--) {
    const s = shape[i];
    const [px, py] = ends[i - 1];
    if (s[0] === 'L' || s[0] === 'M') out.push(['L', px, py]);
    else if (s[0] === 'Q') out.push(['Q', s[1], s[2], px, py]);
    else out.push(['C', s[3], s[4], s[1], s[2], px, py]);
  }
  return out;
}

/** The shape with clockwise winding. */
export const orient = (shape: Shape): Shape => (area2(shape) < 0 ? reverse(shape) : shape);

/**
 * Parse SVG path data (absolute M, L, H, V, Q, C, Z only) into clockwise shapes. Every subpath is closed.
 */
export function parse(d: string): Shape[] {
  const tok = d.match(/[MLHVQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const shapes: Shape[] = [];
  let cur: Seg[] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  const num = () => Number(tok[i++]);
  const flush = () => {
    if (cur.length > 1) shapes.push(orient(cur));
    cur = [];
  };
  while (i < tok.length) {
    if (/^[A-Za-z]$/.test(tok[i])) cmd = tok[i++].toUpperCase();
    switch (cmd) {
      case 'M':
        flush();
        x = num();
        y = num();
        cur.push(['M', x, y]);
        cmd = 'L';
        break;
      case 'L':
        x = num();
        y = num();
        cur.push(['L', x, y]);
        break;
      case 'H':
        x = num();
        cur.push(['L', x, y]);
        break;
      case 'V':
        y = num();
        cur.push(['L', x, y]);
        break;
      case 'Q': {
        const cx = num();
        const cy = num();
        x = num();
        y = num();
        cur.push(['Q', cx, cy, x, y]);
        break;
      }
      case 'C': {
        const ax = num();
        const ay = num();
        const bx = num();
        const by = num();
        x = num();
        y = num();
        cur.push(['C', ax, ay, bx, by, x, y]);
        break;
      }
      case 'Z':
        flush();
        break;
      default:
        i++;
    }
  }
  flush();
  return shapes;
}

const memoParse = new Map<string, Shape[]>();
/** parse(), memoised (art paths are constants). */
export function P(d: string): Shape[] {
  let hit = memoParse.get(d);
  if (!hit) memoParse.set(d, (hit = parse(d)));
  return hit;
}

const f = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

/** SVG path data of the shapes (one closed subpath each). */
export function toD(shapes: readonly Shape[]): string {
  let out = '';
  for (const sh of shapes) {
    for (const s of sh) {
      out += s[0];
      for (let i = 1; i < s.length; i++) out += (i > 1 ? ' ' : '') + f(s[i] as number);
    }
    out += 'Z';
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Builders

const K = 0.5523;

export function circle(cx: number, cy: number, r: number): Shape {
  const k = r * K;
  return [
    ['M', cx, cy - r],
    ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy],
    ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r],
    ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy],
    ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r],
  ];
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, deg = 0): Shape {
  return xf(circle(0, 0, 1), mul(place(cx, cy, deg), scale(rx, ry)));
}

/** A stadium from a to b with end radii ra and rb (a limb segment, a barrel, a strap). */
export function capsule(a: Pt, b: Pt, ra: number, rb = ra): Shape {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return circle(a[0], a[1], Math.max(ra, rb));
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const [ax, ay] = a;
  const [bx, by] = b;
  const ka = ra * K;
  const kb = rb * K;
  return orient([
    ['M', ax + nx * ra, ay + ny * ra],
    ['L', bx + nx * rb, by + ny * rb],
    ['C', bx + nx * rb + ux * kb, by + ny * rb + uy * kb, bx + ux * rb + nx * kb, by + uy * rb + ny * kb, bx + ux * rb, by + uy * rb],
    ['C', bx + ux * rb - nx * kb, by + uy * rb - ny * kb, bx - nx * rb + ux * kb, by - ny * rb + uy * kb, bx - nx * rb, by - ny * rb],
    ['L', ax - nx * ra, ay - ny * ra],
    ['C', ax - nx * ra - ux * ka, ay - ny * ra - uy * ka, ax - ux * ra - nx * ka, ay - uy * ra - ny * ka, ax - ux * ra, ay - uy * ra],
    ['C', ax - ux * ra + nx * ka, ay - uy * ra + ny * ka, ax + nx * ra - ux * ka, ay + ny * ra - uy * ka, ax + nx * ra, ay + ny * ra],
  ]);
}

/** A chain of capsules through the points with the given radii (one per point). */
export function limb(pts: readonly Pt[], radii: readonly number[]): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(capsule(pts[i], pts[i + 1], radii[i], radii[i + 1]));
  return out;
}

export function poly(pts: readonly Pt[]): Shape {
  return orient([['M', pts[0][0], pts[0][1]], ...pts.slice(1).map((p): Seg => ['L', p[0], p[1]])]);
}

/** A smooth closed curve through the points (Catmull-Rom as cubic Béziers); `t` < 1 tightens it. */
export function blob(pts: readonly Pt[], t = 1): Shape {
  const n = pts.length;
  const out: Seg[] = [['M', pts[0][0], pts[0][1]]];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    out.push([
      'C',
      p1[0] + ((p2[0] - p0[0]) / 6) * t,
      p1[1] + ((p2[1] - p0[1]) / 6) * t,
      p2[0] - ((p3[0] - p1[0]) / 6) * t,
      p2[1] - ((p3[1] - p1[1]) / 6) * t,
      p2[0],
      p2[1],
    ]);
  }
  return orient(out);
}

// ---------------------------------------------------------------------------------------------------------------------
// Vectors

export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mulv = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const len = (a: Pt) => Math.hypot(a[0], a[1]);
export const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
/** a + u·x + n·y in the frame of unit vector u (n = u turned 90° clockwise on screen). */
export const at = (a: Pt, u: Pt, x: number, y: number): Pt => [a[0] + u[0] * x - u[1] * y, a[1] + u[1] * x + u[0] * y];
export const angleOf = (v: Pt) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
export const dir = (deg: number): Pt => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

/** Two-bone IK: the elbow (or knee) between root and tip with bone lengths l1, l2; `bend` picks the side. */
export function ik(root: Pt, tip: Pt, l1: number, l2: number, bend: 1 | -1): Pt {
  const v = sub(tip, root);
  const d = Math.min(Math.max(len(v), 1e-3), l1 + l2 - 1e-3);
  const u = norm(v);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  // n = u turned 90° clockwise (screen): (-u.y, u.x)
  return [root[0] + u[0] * a - u[1] * h * bend, root[1] + u[1] * a + u[0] * h * bend];
}
