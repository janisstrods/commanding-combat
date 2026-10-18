// Support weapon and radio drawings for the weapon counters, one per weapon type and nation (the German MG42, the
// American Browning guns, the Russian DP and Maxim; three mortar families; the IG 18 / Pack Howitzer / regimental gun;
// three flamethrowers, satchel charges and radios). Centred on (0, 0), about 64 units long, facing right, ground at
// y = 16. Original drawings, built from simple shapes into colour layers like the soldiers.
import type { Nation } from '../../engine/types';
import { type Mat, type Pt, ID, P, blob, capsule, circle, ellipse, mul, place, poly, rotate, translate } from './geom';
import { type FlatFigure, Sketch, flatten } from './sketch';

export const WLAYERS = [
  'far',
  'farPaint',
  'canvas',
  'paint',
  'metal',
  'steel',
  'wood',
  'brass',
  'tyre',
  'wheel',
  'wheelWood',
  'hub',
  'hole',
  'flame',
  'flameCore',
  'accent',
  'light',
] as const;
export type WLayer = (typeof WLAYERS)[number];
export const WFLAT: ReadonlySet<WLayer> = new Set<WLayer>(['hole', 'flameCore', 'light']);

type WS = Sketch<WLayer>;

export type WeaponArt =
  | 'lmg'
  | 'mmg'
  | 'hmg'
  | 'hmg50'
  | 'lightMortar'
  | 'mediumMortar'
  | 'gun'
  | 'heavyGun'
  | 'flamethrower'
  | 'satchel'
  | 'panzerfaust'
  | 'molotov'
  | 'radio';

const R = (x0: number, y0: number, x1: number, y1: number) =>
  poly([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]);

/** Short lines across a belt or a ribbed part, every `step` along the polyline, `w` to each side. */
function ticks(sk: WS, pts: Pt[], step: number, w: number, tone: 'ink' | 'hi', m: Mat = ID) {
  let carry = step / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const L = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / L;
    const uy = (by - ay) / L;
    let t = carry;
    for (; t < L; t += step) {
      const cx = ax + ux * t;
      const cy = ay + uy * t;
      sk.line(
        [
          [cx + uy * w, cy - ux * w],
          [cx - uy * w, cy + ux * w],
        ],
        tone,
        m,
      );
    }
    carry = t - L;
  }
}

function chain(sk: WS, layer: WLayer, pts: Pt[], r: number, m: Mat = ID) {
  for (let i = 0; i + 1 < pts.length; i++) sk.add(layer, capsule(pts[i], pts[i + 1], r), m);
}

/** A wheel standing on the ground at y = 16 (or centred at y). */
function wheel(sk: WS, x: number, y: number, r: number, style: 'disc' | 'spoked' | 'rubber', far = false, m: Mat = ID) {
  if (far) {
    sk.add('far', circle(x, y, r), m);
    return;
  }
  const add = (layer: WLayer, sh: ReturnType<typeof circle>) => sk.add(layer, sh, m);
  add('tyre', circle(x, y, r));
  if (style === 'rubber') {
    add('wheel', circle(x, y, r * 0.6));
    for (let k = 0; k < 5; k++) {
      const a = (k * 2 * Math.PI) / 5;
      add('hole', circle(x + Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36, r * 0.08));
    }
    add('hub', circle(x, y, r * 0.2));
    add('light', capsule([x - r * 0.62, y - r * 0.42], [x - r * 0.3, y - r * 0.72], 0.35));
    return;
  }
  if (style === 'disc') {
    add('wheel', circle(x, y, r - 1.5));
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + 0.3;
      add('hole', circle(x + Math.cos(a) * (r - 4.4), y + Math.sin(a) * (r - 4.4), Math.max(0.9, r * 0.14)));
    }
    add('hub', circle(x, y, Math.max(1.6, r * 0.22)));
    return;
  }
  // wooden spokes in an iron tyre: the gaps between spokes are cut out
  add('wheelWood', circle(x, y, r - 1.3));
  const n = 10;
  for (let k = 0; k < n; k++) {
    const a0 = (k * 2 * Math.PI) / n + 0.12;
    const a1 = ((k + 1) * 2 * Math.PI) / n - 0.12;
    const ri = r * 0.3;
    const ro = r - 2.6;
    const pts: Pt[] = [];
    for (let j = 0; j <= 4; j++) {
      const a = a0 + ((a1 - a0) * j) / 4;
      pts.push([x + Math.cos(a) * ro, y + Math.sin(a) * ro]);
    }
    pts.push([x + Math.cos((a0 + a1) / 2) * ri, y + Math.sin((a0 + a1) / 2) * ri]);
    add('hole', poly(pts));
  }
  add('hub', circle(x, y, r * 0.24));
}

/** Tripod or bipod legs from `top` to the ground (the far ones fainter). */
function legs(sk: WS, m: Mat, top: Pt, near: Pt[], far: Pt[], r = 0.95) {
  for (const p of far) sk.add('far', capsule(top, p, r * 0.9), m);
  for (const p of near) {
    sk.add('metal', capsule(top, p, r), m);
    sk.add('metal', R(p[0] - 1.6, p[1] - 0.6, p[0] + 1.6, p[1] + 0.6), m);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Machine guns

function mg42(sk: WS, m: Mat) {
  sk.add('metal', poly([[-18, -3], [-29.6, -2.2], [-31.2, -1.2], [-31.2, 3.4], [-29.8, 4.6], [-24, 2.4], [-18, 2.2]]), m);
  sk.add('metal', poly([[-18.4, -3.6], [-2.4, -3.8], [-1.4, -2.8], [-1.4, 2.2], [-18.4, 2.2]]), m);
  sk.add('metal', poly([[-15, 2], [-12, 2], [-12.6, 8.2], [-15.8, 7.8]]), m);
  sk.line([[-12, 2.4], [-10.4, 4.8], [-12.4, 5.4]], 'ink', m);
  sk.add('metal', R(-1.6, -2.9, 20.4, 1.9), m);
  for (const x of [0.4, 4.2, 8, 11.8]) sk.add('hole', capsule([x, -1.2], [x + 2, -1.2], 0.72), m);
  sk.add('hole', R(15.2, -1.9, 19.2, 0.5), m);
  sk.add('metal', poly([[20.2, -2.3], [24.6, -1.5], [24.6, 0.7], [20.2, 1.4]]), m);
  sk.add('metal', capsule([24.4, -0.4], [27.6, -0.4], 0.85), m);
  sk.add('metal', poly([[17.4, -2.8], [18.4, -5.4], [19.2, -5.4], [19.2, -2.8]]), m);
  sk.add('steel', capsule([-9, -4.1], [-4, -4.1], 0.6), m);
  sk.add('light', capsule([-17.4, -2.9], [-3, -3.1], 0.32), m);
}

function browning(sk: WS, m: Mat, water: boolean) {
  // box receiver, back plate and pistol grip
  sk.add('metal', poly([[-20, -4.4], [-3, -4.4], [-2, -3.6], [-2, 3.4], [-20, 3.4]]), m);
  sk.add('metal', poly([[-20, -1.4], [-22.4, -1.4], [-22.4, 1.6], [-24.8, 7.6], [-21.8, 8], [-20, 3]]), m);
  sk.add('steel', capsule([-17, -5], [-12, -5], 0.55), m);
  if (water) {
    sk.add('metal', poly([[-2.4, -3.8], [18.6, -3.8], [19.6, -2.8], [19.6, 2.8], [18.6, 3.6], [-2.4, 3.6]]), m);
    sk.line([[2, -3.8], [2, 3.6]], 'hi', m);
    sk.line([[14.6, -3.8], [14.6, 3.6]], 'hi', m);
    sk.add('steel', capsule([6, -4.6], [9, -4.6], 0.7), m);
    sk.add('metal', capsule([19.4, -0.2], [24.4, -0.2], 1.0), m);
    sk.add('light', capsule([-1.6, -2.8], [18, -2.8], 0.4), m);
  } else {
    sk.add('metal', capsule([-2.4, -0.4], [17.6, -0.4], 2.4), m);
    for (let x = 0; x < 16; x += 2.6) {
      sk.add('hole', circle(x, -1.4, 0.62), m);
      sk.add('hole', circle(x + 1.3, 0.7, 0.62), m);
    }
    sk.add('metal', capsule([17.4, -0.4], [22.6, -0.4], 1.15), m);
    sk.add('metal', poly([[19, -1.6], [19.6, -4.4], [20.4, -4.4], [20.4, -1.6]]), m);
  }
}

function m2hb(sk: WS, m: Mat) {
  sk.add('metal', poly([[-22, -5.2], [-5, -5.2], [-4, -4.2], [-4, 3.8], [-22, 3.8]]), m);
  sk.add('metal', poly([[-22, -4.4], [-25.2, -4.4], [-26.6, -3], [-26.6, 2], [-25.2, 3.2], [-22, 3.2]]), m);
  sk.line([[-26.6, -0.6], [-24, -0.6]], 'hi', m);
  sk.add('steel', capsule([-16, -0.6], [-11, -0.6], 0.8), m);
  sk.add('metal', capsule([-4.4, -0.8], [5, -0.8], 2.4), m);
  for (let x = -2.6; x < 4; x += 2.2) sk.add('hole', capsule([x, -1.6], [x, 0], 0.55), m);
  sk.add('metal', capsule([4.8, -0.8], [29.2, -0.8], 1.25), m);
  sk.add('metal', capsule([28.6, -0.8], [31.6, -0.8], 1.55), m);
  sk.add('metal', poly([[-9, -5], [-8, -8.6], [-6.6, -8.6], [-6.6, -5]]), m);
  sk.add('light', capsule([-21, -4.2], [-5.6, -4.2], 0.4), m);
  sk.add('light', capsule([6, -1.6], [28, -1.6], 0.28), m);
}

function dp(sk: WS, m: Mat) {
  sk.add('wood', poly([[-14, -2], [-29, -1], [-31, 0], [-31, 4.4], [-29.6, 5.6], [-14, 2.6]]), m);
  sk.add('wood', poly([[-15.6, 2.2], [-12.8, 2.2], [-13.6, 7.6], [-16.6, 7.2]]), m);
  sk.add('metal', poly([[-14.4, -2.6], [-1.6, -2.6], [-1.6, 2.6], [-14.4, 2.8]]), m);
  sk.add('metal', ellipse(-8, -5, 9.8, 2.5), m);
  sk.add('steel', ellipse(-8, -5.6, 7.6, 1.2), m);
  sk.add('metal', circle(-8, -7.2, 1.1), m);
  sk.add('metal', R(-2, -2.4, 16, 1.8), m);
  for (const x of [0, 3.6, 7.2, 10.8]) sk.add('hole', capsule([x, -0.4], [x + 1.6, -0.4], 0.75), m);
  sk.add('metal', poly([[15.6, -1.4], [22.4, -2.8], [22.4, 2.2], [15.6, 0.8]]), m);
  sk.add('metal', poly([[13, -2.4], [13.6, -5], [14.4, -5], [14.4, -2.4]]), m);
  sk.add('light', capsule([-16, -5.4], [-4, -6.4], 0.35), m);
}

function maxim(sk: WS, m: Mat) {
  // ribbed water jacket with its big filler cap
  sk.add('metal', poly([[-6, -4.4], [17.6, -4.4], [18.6, -3.2], [18.6, 3.2], [17.6, 4.2], [-6, 4.2]]), m);
  for (let x = -4.4; x < 17; x += 1.7) sk.line([[x, -4.2], [x, 4]], 'hi', m);
  sk.add('metal', poly([[10.6, -4.4], [11, -6.4], [10, -6.6], [10.2, -8], [14.4, -8], [14.6, -6.6], [13.6, -6.4], [14, -4.4]]), m);
  sk.add('metal', capsule([18.4, -0.2], [23, -0.2], 1.1), m);
  sk.add('metal', poly([[22.6, -1.6], [25.4, -2.2], [25.4, 1.8], [22.6, 1.2]]), m);
  // receiver and spade grips
  sk.add('metal', poly([[-21, -4], [-6, -4], [-6, 3.4], [-21, 3.4]]), m);
  sk.add('metal', capsule([-21, -2.2], [-25, -2.2], 0.8), m);
  sk.add('metal', capsule([-21, 1.6], [-25, 1.6], 0.8), m);
  sk.add('steel', capsule([-18, -4.8], [-11, -4.8], 0.5), m);
}

function dshk(sk: WS, m: Mat) {
  sk.add('metal', poly([[-21, -4.2], [-6, -4.2], [-6, 3.4], [-21, 3.4]]), m);
  sk.add('metal', capsule([-21, -1.6], [-24.6, -1.6], 0.85), m);
  sk.add('metal', capsule([-21, 1.6], [-24.6, 1.6], 0.85), m);
  sk.add('metal', R(-6.4, -3, 5.4, 2.4), m);
  for (let x = -5; x < 5; x += 1.3) sk.line([[x, -3], [x, 2.4]], 'hi', m);
  sk.add('metal', capsule([5, -0.3], [25.6, -0.3], 1.15), m);
  sk.add('metal', R(25.2, -1.9, 30.8, 1.3), m);
  sk.add('hole', R(26.4, -1.2, 27.4, 0.6), m);
  sk.add('hole', R(28.6, -1.2, 29.6, 0.6), m);
  // the ring sight
  sk.add('metal', poly([[-1.4, -3], [-0.8, -6], [0.6, -6], [1, -3]]), m);
  sk.add('metal', circle(-0.2, -9.6, 3.9), m);
  sk.add('hole', circle(-0.2, -9.6, 2.9), m);
  sk.add('metal', capsule([-0.2, -12.4], [-0.2, -6.8], 0.3), m);
  sk.add('metal', capsule([-3, -9.6], [2.6, -9.6], 0.3), m);
}

function lmg(sk: WS, nation: Nation) {
  if (nation === 'Russian') {
    const m = translate(1, -4);
    sk.add('far', capsule([12, 1.6], [16.6, 15], 0.75), m);
    dp(sk, m);
    sk.add('metal', capsule([12, 1.6], [8, 15], 0.8), m);
    sk.add('metal', poly([[6.6, 15.4], [9.6, 14.6], [9.4, 16.2]]), m);
    return;
  }
  if (nation === 'American') {
    // Browning with a shoulder stock, carrying handle and a bipod at the muzzle
    const m = translate(4, -4);
    sk.add('far', capsule([17, 0.6], [21, 15], 0.7), m);
    sk.add('metal', poly([[-22, -2], [-31.4, -1.2], [-32.6, 0], [-32.6, 4], [-31.2, 5], [-22, 2.4]]), m);
    browning(sk, m, false);
    sk.add('metal', P('M4 -2.6 C4.4 -7 11 -7 11.4 -2.6 L10 -2.6 C9.6 -5.4 5.8 -5.4 5.4 -2.6 Z'), m);
    sk.add('metal', capsule([17, 0.6], [13, 15.2], 0.75), m);
    sk.add('metal', R(11.6, 14.6, 14.6, 16), m);
    const belt: Pt[] = [
      [-11, 3.4],
      [-11.6, 9],
      [-15, 13.6],
      [-22, 15.4],
    ];
    chain(sk, 'brass', belt, 1.15, m);
    ticks(sk, belt, 1.45, 1.1, 'ink', m);
    return;
  }
  // MG42 on its bipod with a belt of rounds hanging from the feed
  const m = translate(1.5, -4);
  sk.add('far', capsule([16.8, 1.4], [20.8, 15], 0.7), m);
  mg42(sk, m);
  sk.add('metal', capsule([16.4, 1.4], [12.6, 15.2], 0.75), m);
  sk.add('metal', R(11.2, 14.6, 14.2, 16), m);
  const belt: Pt[] = [
    [-7, 2.6],
    [-7.6, 8.4],
    [-10.4, 13.4],
    [-16.6, 15.4],
    [-24, 15.6],
  ];
  chain(sk, 'brass', belt, 1.15, m);
  ticks(sk, belt, 1.45, 1.1, 'ink', m);
}

function mmg(sk: WS, nation: Nation) {
  if (nation === 'Russian') {
    // SG-43 on its small wheeled carriage
    const m = translate(0, -6);
    sk.add('paint', poly([[-6, 4.6], [-29, 18.4], [-30.4, 21.4], [-27.6, 21.6], [-3, 7.8]]), m);
    sk.add('metal', capsule([-29.6, 19.6], [-31.6, 15.6], 0.8), m);
    sk.add('metal', poly([[-15, -3.4], [-2, -3.4], [-2, 2.6], [-15, 2.6]]), m);
    sk.add('metal', capsule([-15, -1.4], [-18, -1.4], 0.75), m);
    sk.add('metal', capsule([-15, 1.4], [-18, 1.4], 0.75), m);
    sk.add('metal', capsule([-2.4, -0.6], [18, -0.6], 1.9), m);
    for (let x = 0; x < 16; x += 1.6) sk.line([[x, -2.4], [x, 1.2]], 'hi', m);
    sk.add('metal', poly([[17.6, -1.6], [21.6, -2.4], [21.6, 1.4], [17.6, 0.6]]), m);
    sk.add('metal', P('M3 -2.4 C3.6 -6.4 9.4 -6.4 10 -2.4 L8.8 -2.4 C8.2 -5 4.8 -5 4.2 -2.4 Z'), m);
    sk.add('paint', R(-10, 2.4, -2, 5.6), m);
    wheel(sk, -5.6, 16.2, 5.8, 'disc', true, m);
    wheel(sk, -4.4, 16.2, 5.8, 'disc', false, m);
    return;
  }
  // German MG42 on the Lafette tripod; American Browning on its low tripod
  if (nation === 'German') {
    hmg(sk, nation);
    return;
  }
  const m = translate(1, -3);
  legs(sk, m, [-8, 6.4], [[7, 18.6], [-25, 18.6]], [[-20, 18]]);
  sk.add('metal', capsule([-8, 3], [-8, 6.6], 1.2), m);
  browning(sk, m, false);
  sk.add('paint', R(-17, 6.4, -9.8, 13), m);
  sk.add('metal', capsule([-15.4, 6.2], [-11.4, 6.2], 0.4), m);
  sk.line([[-17, 8], [-9.8, 8]], 'ink', m);
  chain(sk, 'brass', [[-12.4, 6.4], [-11.4, 3.6]], 1, m);
}

function hmg(sk: WS, nation: Nation) {
  if (nation === 'Russian') {
    // Maxim on the wheeled carriage behind its shield
    const m = translate(1, -4);
    sk.add('paint', poly([[-12, -15], [1, -16], [2, 7], [-11, 8]]), m);
    sk.add('hole', R(-7.6, -6.4, -1.4, -5), m);
    sk.add('paint', P('M-4 6 L-28 16.6 L-29.4 19.6 L-26 20 L-1 9 Z'), m);
    sk.add('metal', P('M-28.6 17 C-32 15 -32 12 -29.4 10.6 L-28.2 11.8 C-29.8 12.8 -29.6 14.6 -27.6 15.6 Z'), m);
    maxim(sk, m);
    sk.add('paint', R(-12, 3.4, -4, 6), m);
    wheel(sk, -5.6, 12.6, 7.4, 'spoked', true, m);
    wheel(sk, -4.4, 12.6, 7.4, 'spoked', false, m);
    return;
  }
  if (nation === 'American') {
    const m = translate(0, -4);
    legs(sk, m, [-9, 7.4], [[6, 20], [-26, 20]], [[-21, 19.4]]);
    sk.add('metal', capsule([-9, 3], [-9, 7.4], 1.2), m);
    browning(sk, m, true);
    // condenser can and hose
    sk.add('paint', R(8, 12.4, 15, 20), m);
    sk.add('metal', capsule([10, 12.2], [13, 12.2], 0.5), m);
    chain(sk, 'tyre', [[4, 3.4], [5.2, 8], [9, 11]], 0.8, m);
    sk.add('paint', R(-18, 6, -11.6, 12.2), m);
    chain(sk, 'brass', [[-14, 6], [-13.4, 3.4]], 1, m);
    return;
  }
  // MG42 on the Lafette: a sled-like tripod with a long front leg and a periscope sight
  const m = mul(translate(2, -6), rotate(-3));
  sk.add('far', capsule([-10, 6], [-23, 21], 0.9), m);
  sk.add('metal', capsule([-12, 5.6], [-28, 21.4], 1.0), m);
  sk.add('metal', capsule([-2, 5], [12.6, 21.6], 1.0), m);
  sk.add('metal', R(-30, 20.6, -24, 22.2), m);
  sk.add('metal', R(10.6, 20.8, 16, 22.4), m);
  sk.add('canvas', capsule([5, 13], [8.8, 17.6], 1.5), m);
  sk.add('metal', poly([[-14, 2], [-1, 2], [-2, 6.4], [-12, 6.4]]), m);
  sk.add('metal', circle(-10, 5.8, 1.6), m);
  mg42(sk, mul(m, mul(translate(2, -1), place(0, 0, 0, 0.92))));
  sk.add('metal', R(-13.4, -10.6, -10.6, -3.4), m);
  sk.add('steel', capsule([-13.4, -10], [-16.6, -10], 0.9), m);
}

function hmg50(sk: WS, nation: Nation) {
  if (nation === 'Russian') {
    // DShK on a low wheeled tripod
    const m = translate(1, -2);
    legs(sk, m, [-8, 4.6], [[5.6, 18], [-26, 18]], [[-21, 17.4]]);
    sk.add('metal', capsule([-8, 2], [-8, 5], 1.3), m);
    dshk(sk, m);
    wheel(sk, -14, 14.2, 3.8, 'disc', false, m);
    return;
  }
  const m = translate(0, -3);
  legs(sk, m, [-10, 7], [[7, 19], [-28, 19]], [[-23, 18.4]]);
  sk.add('metal', capsule([-10, 3.4], [-10, 7.2], 1.3), m);
  m2hb(sk, m);
  sk.add('paint', R(-19.4, 4.8, -12.4, 11.4), m);
  sk.line([[-19.4, 6.6], [-12.4, 6.6]], 'ink', m);
  chain(sk, 'brass', [[-15, 4.8], [-14.4, 3.6]], 1.1, m);
}

// ---------------------------------------------------------------------------------------------------------------------
// Mortars

function tube(sk: WS, base: Pt, deg: number, L: number, r: number) {
  const m = place(base[0], base[1], deg);
  sk.add('metal', capsule([0, 0], [L, 0], r), m);
  sk.add('metal', capsule([L - 1.2, 0], [L + 0.4, 0], r + 0.55), m);
  sk.add('steel', capsule([0.6, 0], [3.4, 0], r + 0.35), m);
  sk.add('light', capsule([3, -r * 0.5], [L - 2, -r * 0.5], 0.3), m);
  return m;
}

function lightMortar(sk: WS, nation: Nation) {
  if (nation === 'German') {
    // compact 5 cm mortar: tube fixed on its baseplate by a single strut with a handwheel
    sk.add('paint', poly([[-22, 12.4], [10, 12.4], [8.4, 15.8], [-20.4, 15.8]]));
    sk.add('metal', capsule([-17, 12], [-3, 12], 1));
    tube(sk, [-12, 10.4], -50, 24, 2.1);
    sk.add('metal', capsule([1.6, -5.6], [5, 12], 1));
    sk.add('steel', circle(5, 4, 2.6));
    sk.add('hole', circle(5, 4, 1.4));
    sk.add('metal', circle(5, 4, 0.8));
    sk.add('metal', R(2.6, -10.6, 6.4, -7.6));
    return;
  }
  if (nation === 'American') {
    sk.add('paint', poly([[-20, 12.6], [-6, 12.6], [-7.4, 15.6], [-18.6, 15.6]]));
    sk.add('far', capsule([2, -6], [14, 15.6], 0.75));
    tube(sk, [-13, 11], -55, 27, 2.1);
    sk.add('metal', capsule([2, -6], [8.6, 15.6], 0.8));
    sk.add('metal', R(7.2, 15, 10, 16.2));
    sk.add('metal', capsule([2.6, -6], [3.4, 4], 0.7));
    sk.add('steel', circle(3.4, 4.4, 1.4));
    sk.line([[5.6, 6], [11.4, 7.6]], 'ink');
    sk.add('metal', R(-1.2, -9, 2.2, -6.4));
    return;
  }
  // Russian 50 mm: round baseplate
  sk.add('paint', ellipse(-11, 13.6, 11, 2.6));
  sk.add('far', capsule([1, -4], [12, 15.6], 0.75));
  tube(sk, [-11, 11.6], -56, 25, 2);
  sk.add('metal', capsule([1, -4], [7, 15.6], 0.8));
  sk.add('metal', R(5.6, 15, 8.4, 16.2));
  sk.add('steel', capsule([1.4, -4], [4.6, 2], 0.6));
}

function mediumMortar(sk: WS, nation: Nation) {
  const L = 36;
  const deg = -58;
  if (nation === 'Russian') sk.add('paint', ellipse(-15, 13.4, 13, 3));
  else {
    sk.add('paint', poly([[-27, 12], [-5, 12], [-7.4, 15.8], [-24.6, 15.8]]));
    sk.add('metal', capsule([-25, 11.4], [-7, 11.4], 0.7));
  }
  const base: Pt = [-16, 11];
  const collar: Pt = [base[0] + Math.cos((deg * Math.PI) / 180) * 23, base[1] + Math.sin((deg * Math.PI) / 180) * 23];
  sk.add('far', capsule(collar, [17, 15.6], 0.9));
  tube(sk, base, deg, L, 2.7);
  sk.add('metal', capsule(collar, [12.4, 15.6], 0.95));
  sk.add('metal', R(10.8, 15, 14, 16.4));
  // elevating screw and traverse
  sk.add('metal', capsule([collar[0] + 1.6, collar[1] + 0.6], [collar[0] + 4.4, collar[1] + 10], 0.9));
  sk.line([[collar[0] + 4.4, collar[1] + 10], [14.4, collar[1] + 13.4]], 'ink');
  if (nation === 'American') {
    sk.add('paint', capsule([collar[0] - 0.4, collar[1] - 2.6], [collar[0] + 6.4, collar[1] - 1.4], 1.4));
    sk.add('paint', capsule([collar[0] - 0.4, collar[1] + 2.2], [collar[0] + 6.4, collar[1] + 3.2], 1.4));
  }
  sk.add('steel', circle(collar[0] + 4.4, collar[1] + 10, 1.9));
  // sight
  sk.add('metal', R(collar[0] + 1.4, collar[1] - 7.4, collar[0] + 5.2, collar[1] - 3.6));
  sk.add('steel', capsule([collar[0] + 5.2, collar[1] - 6.4], [collar[0] + 7.4, collar[1] - 6.4], 0.8));
}

// ---------------------------------------------------------------------------------------------------------------------
// Guns

function boxTrail(sk: WS, from: Pt, to: Pt, h0: number, h1: number) {
  sk.add('paint', poly([[from[0] + 2, from[1] - h0], [to[0], to[1] - h1], [to[0] - 1, to[1]], [from[0] + 2, from[1] + h0]]));
  sk.add('metal', poly([[to[0] + 0.6, to[1] - 1.4], [to[0] - 3, to[1] - 2.4], [to[0] - 2.4, 16.4], [to[0] + 1.4, 16.4]]));
}

function gun(sk: WS, nation: Nation, heavy: boolean) {
  if (nation === 'American') {
    // Pack Howitzer: split trail, small rubber-tyred wheels, no shield, long recoil cylinder under a short tube
    sk.add('farPaint', poly([[0, 7], [-27, 14.4], [-27.6, 16], [-25, 16], [1, 9.4]]));
    sk.add('paint', poly([[1, 6.4], [-31, 14.6], [-31.6, 16.2], [-28.6, 16.4], [2.4, 9.2]]));
    sk.add('metal', R(-32.6, 14.8, -28.4, 16.4));
    const m = mul(translate(0, 3), rotate(-8));
    sk.add('paint', poly([[-12, -0.8], [14, -0.8], [14, 2.4], [-10, 3]]), m);
    sk.add('metal', capsule([-11, -2.6], [21, -2.6], 1.5), m);
    sk.add('metal', capsule([20, -2.6], [22.6, -2.6], 1.9), m);
    sk.add('metal', R(-16, -5, -11, 1.4), m);
    sk.add('light', capsule([-9, -3.6], [19, -3.6], 0.35), m);
    sk.add('paint', poly([[-3, 2], [4, 2], [5, 8], [-2, 8]]));
    wheel(sk, 1, 9.6, 6.4, 'rubber', true);
    wheel(sk, 2.4, 9.6, 6.4, 'rubber');
    return;
  }
  if (nation === 'Russian') {
    // 76 mm regimental gun: tall spoked wheels, a flat-topped shield, short tube
    boxTrail(sk, [0, 6], [-31, 15], 2, 1.2);
    sk.add('paint', poly([[-6, -15.6], [4, -16.2], [4.6, 1.6], [-5.4, 2.2]]));
    sk.add('hole', R(-2.6, -12.4, 0.8, -10.8));
    const m = mul(translate(0, -3.4), rotate(-5));
    sk.add('metal', capsule([-8, -1.4], [17, -1.4], 1.65), m);
    sk.add('metal', capsule([16, -1.4], [18.6, -1.4], 2), m);
    sk.add('metal', R(-12, -4.2, -7.6, 1.6), m);
    sk.add('paint', poly([[-8, 0.6], [9, 0.6], [9, 2.6], [-8, 3.2]]), m);
    sk.add('light', capsule([-6, -2.4], [15.6, -2.4], 0.35), m);
    wheel(sk, -1.2, 5.6, 10.4, 'spoked', true);
    wheel(sk, 0, 5.6, 10.4, 'spoked');
    return;
  }
  // German infantry guns: the IG 18 (light) and the heavy IG 33
  if (heavy) {
    boxTrail(sk, [0, 4], [-31, 15], 2.6, 1.6);
    sk.add('paint', poly([[-5, -18.4], [4, -19.4], [5, -0.4], [-4, 0.4]]));
    const m = mul(translate(-1, -4), rotate(-11));
    sk.add('metal', capsule([-10, -2], [22, -2], 2.9), m);
    sk.add('metal', capsule([21, -2], [23.4, -2], 3.4), m);
    sk.add('metal', R(-16, -6.6, -9, 2.6), m);
    sk.add('metal', capsule([-8, 2.8], [12, 2.8], 1.4), m);
    sk.add('light', capsule([-8, -3.8], [20, -3.8], 0.45), m);
    wheel(sk, 0.4, 3.6, 12.4, 'disc', true);
    wheel(sk, 2, 3.6, 12.4, 'disc');
    return;
  }
  boxTrail(sk, [0, 6], [-31, 15], 2, 1.2);
  // the IG 18's shield has a notch in its top edge
  sk.add('paint', poly([[-5, -16], [-2.2, -16.4], [-1.4, -13.4], [1, -13.6], [1.4, -17], [3.6, -17.2], [4.2, 3.6], [-4.2, 4.2]]));
  const m = mul(translate(-1, -3.6), rotate(-6));
  sk.add('metal', capsule([-6, -1.4], [15.6, -1.4], 1.75), m);
  sk.add('metal', capsule([14.6, -1.4], [16.8, -1.4], 2.1), m);
  sk.add('metal', R(-11.6, -6.6, -5.6, 1.4), m);
  sk.add('metal', capsule([-5, 1.6], [9, 1.6], 1.1), m);
  sk.add('light', capsule([-4, -2.4], [14, -2.4], 0.35), m);
  wheel(sk, -1.2, 6.4, 9.6, 'disc', true);
  wheel(sk, 0, 6.4, 9.6, 'disc');
}

// ---------------------------------------------------------------------------------------------------------------------
// Flamethrowers, charges, radios

function flameJet(sk: WS, x: number, y: number) {
  sk.add('flame', blob([[x, y - 1], [x + 4, y - 4], [x + 8, y - 2.2], [x + 10.4, y - 5], [x + 10.6, y + 0.6], [x + 6.6, y + 3.2], [x + 2, y + 1.8]], 0.9));
  sk.add('flameCore', blob([[x + 0.4, y - 0.4], [x + 4, y - 1.8], [x + 7, y - 0.4], [x + 3.6, y + 1]], 0.9));
}

function flamethrower(sk: WS, nation: Nation) {
  if (nation === 'Russian') {
    // a flat backpack tank, and a projector shaped like a rifle
    sk.add('paint', blob([[-28, -13], [-15, -13.6], [-14.4, 9.6], [-27.4, 10.2]], 0.35));
    sk.add('metal', capsule([-25, -13.6], [-18, -13.6], 0.8));
    sk.add('canvas', capsule([-26.6, -9], [-26.6, 6], 0.9));
    sk.line([[-27, -4], [-15, -4]], 'ink');
    chain(sk, 'tyre', [[-16, 9], [-9, 13.4], [-2, 12.4], [1, 8]], 0.9);
    sk.add('wood', poly([[-8, 2.6], [1.4, 2.6], [2.4, 4.6], [-8, 8]]));
    sk.add('metal', capsule([0, 4.4], [21, 1.6], 1.05));
    sk.add('metal', R(17.6, -0.4, 21.6, 3.6));
    flameJet(sk, 22.4, 1.6);
    return;
  }
  const m = translate(0, -1);
  if (nation === 'American') {
    sk.add('paint', capsule([-26, -11.6], [-26, 9], 4.1), m);
    sk.add('paint', capsule([-16.6, -11.6], [-16.6, 9], 4.1), m);
    sk.add('metal', circle(-21.3, -1, 2.8), m);
    sk.add('metal', capsule([-26, -16], [-26, -14.4], 1), m);
    sk.add('metal', capsule([-16.6, -16], [-16.6, -14.4], 1), m);
    sk.add('light', capsule([-28, -10], [-28, 7], 0.5), m);
    sk.add('light', capsule([-18.6, -10], [-18.6, 7], 0.5), m);
  } else {
    // the German pack: a large fuel tank and a small pressure bottle side by side
    sk.add('paint', capsule([-25, -11.6], [-25, 9.6], 4.6), m);
    sk.add('paint', capsule([-15.4, -7.6], [-15.4, 9.6], 3.4), m);
    sk.add('metal', capsule([-25, -16.6], [-25, -15], 1.2), m);
    sk.add('metal', capsule([-15.4, -12], [-15.4, -10.6], 1), m);
    sk.add('metal', capsule([-30, -4], [-11.4, -4], 0.5), m);
    sk.add('light', capsule([-27.4, -10], [-27.4, 8], 0.55), m);
  }
  chain(sk, 'tyre', [[-18, 13], [-10, 15.4], [-3, 13.6], [1, 8.6]], 0.9, m);
  const g = mul(m, mul(translate(0, 8), rotate(-12)));
  sk.add('metal', capsule([0, 0], [22, 0], 1.15), g);
  sk.add('metal', poly([[2, 0.6], [4, 0.6], [3.4, 5], [1.2, 4.8]]), g);
  sk.add('metal', poly([[10, 0.6], [12, 0.6], [11.4, 4.6], [9.4, 4.4]]), g);
  sk.add('steel', capsule([16, 0], [20.4, 0], 1.9), g);
  flameJet(sk, 22.4, 3.2);
}

function satchel(sk: WS, nation: Nation) {
  if (nation === 'German') {
    // a bundle of grenade heads bound round one grenade, on its long wooden handle
    sk.add('wood', capsule([-27, 6], [-4, 1], 1.35));
    sk.add('metal', circle(-27, 6.2, 1.8));
    sk.line([[-27.6, 7.8], [-29, 11], [-26.6, 12.6]], 'ink');
    const m = mul(translate(4, 0), rotate(-12));
    for (const y of [-5.6, 5.6, 0]) {
      sk.add('metal', capsule([-6, y], [6, y], 2.8), m);
      sk.add('light', capsule([-5, y - 1.4], [5, y - 1.4], 0.35), m);
    }
    sk.add('metal', capsule([-4, -3], [8, -3], 2.6), m);
    sk.add('metal', capsule([-4, 3], [8, 3], 2.6), m);
    sk.line([[-2.6, -8.6], [-2.6, 8.6]], 'hi', m);
    sk.line([[2.6, -8.6], [2.6, 8.6]], 'hi', m);
    return;
  }
  if (nation === 'Russian') {
    // blocks of explosive tied together, with a fuse
    for (const [x, y] of [
      [-16, -8],
      [-3, -8],
      [-16, 2],
      [-3, 2],
    ])
      sk.add('canvas', R(x, y, x + 12.4, y + 9.4));
    sk.line([[-16, -3.3], [9.4, -3.3]], 'ink');
    sk.line([[-16, 6.7], [9.4, 6.7]], 'ink');
    sk.add('wood', R(-17, -1.2, 10.4, 0.8));
    sk.add('metal', capsule([9.4, -6], [13.4, -6], 1));
    sk.line([[13.4, -6], [17, -9], [21, -7], [24, -11]], 'ink');
    sk.add('flame', circle(24.4, -11.4, 1.3));
    return;
  }
  // American canvas satchel with its straps and a fuse lighter
  sk.add('canvas', blob([[-20, -6], [14, -6.6], [15, 12], [-19.6, 12.4]], 0.25));
  sk.add('canvas', blob([[-20, -6], [14, -6.6], [13.6, 1.4], [-19.4, 1.6]], 0.25));
  sk.line([[-19.4, 1.6], [13.6, 1.4]], 'ink');
  sk.add('canvas', P('M-12 -6 C-12 -17 6 -17 6 -6.4 L3.6 -6.4 C3.6 -14.4 -9.6 -14.4 -9.6 -6 Z'));
  sk.add('metal', R(-5, -2, -1, 1.2));
  sk.line([[15, 6], [20, 4], [22, 8]], 'ink');
  sk.add('metal', capsule([22, 8], [26.4, 10.4], 1));
}

function radio(sk: WS, nation: Nation) {
  if (nation === 'American') {
    // a tall backpack set with a long whip and a telephone handset
    sk.add('paint', blob([[-16, -14], [2, -14.4], [2.6, 14], [-15.6, 14.4]], 0.2));
    sk.add('steel', R(-13, -11, -1, -4));
    sk.add('metal', circle(-10, -7.4, 1.4));
    sk.add('metal', circle(-4.4, -7.4, 1.4));
    sk.line([[-15.6, 2], [2.4, 2]], 'ink');
    sk.add('metal', capsule([-1, -14], [3, -22], 0.75));
    sk.add('metal', capsule([2.8, -21.6], [7.6, -26.4], 0.45));
    sk.add('metal', P('M9 4 C12 0 18 0 21 4 L20 6 C18 3.6 12 3.6 10 6 Z'));
    sk.add('metal', capsule([9.6, 5], [9, 9], 1.6));
    sk.add('metal', capsule([20.4, 5], [21, 9], 1.6));
    sk.line([[2.6, 10], [8, 12], [14, 12.6], [16, 6]], 'ink');
    return;
  }
  if (nation === 'Russian') {
    sk.add('paint', blob([[-20, -8], [8, -8.6], [8.6, 12], [-19.4, 12.6]], 0.15));
    sk.add('steel', R(-16, -4.6, 4.4, 4.4));
    sk.add('metal', circle(-11, 0, 2.4));
    sk.add('hole', circle(-11, 0, 1.4));
    sk.add('metal', circle(-3.6, -1.6, 1.2));
    sk.add('metal', circle(1, -1.6, 1.2));
    sk.add('metal', P('M-12 -8 C-12 -14 0 -14 0 -8.4 L-2 -8.4 C-2 -12 -10 -12 -10 -8 Z'));
    sk.add('metal', capsule([6, -8.4], [17, -24], 0.55));
    sk.add('metal', circle(17.2, -24.4, 0.9));
    sk.add('metal', circle(15.6, 11, 2.6));
    sk.add('metal', circle(24.6, 11, 2.6));
    sk.line([[15.6, 9], [17.4, 4.4], [22.6, 4.4], [24.6, 9]], 'ink');
    return;
  }
  // German pack set: radio over its battery box, rod antenna, headphones
  sk.add('paint', blob([[-20, -11], [5, -11.4], [5.4, 1.2], [-19.6, 1.6]], 0.15));
  sk.add('paint', blob([[-19.6, 3], [5.4, 2.8], [5.4, 13.6], [-19.4, 14]], 0.15));
  sk.add('steel', R(-17, -8.6, -5, -1.6));
  sk.add('metal', circle(-11, -5, 2.4));
  sk.add('hole', circle(-11, -5, 1.3));
  sk.add('metal', circle(-1.4, -7.4, 1.3));
  sk.add('metal', circle(-1.4, -3.2, 1.3));
  sk.add('metal', capsule([-17, 8.4], [3, 8.4], 0.4));
  sk.add('metal', capsule([2, -11.2], [10.4, -25], 0.65));
  sk.add('metal', circle(10.6, -25.4, 1.1));
  sk.add('metal', circle(14.6, 10.6, 2.6));
  sk.add('metal', circle(24, 10.6, 2.6));
  sk.line([[14.6, 8.6], [16, 3.6], [22.6, 3.6], [24, 8.6]], 'ink');
}

function panzerfaust(sk: WS) {
  const m = rotate(-8);
  sk.add('paint', capsule([-30, 0], [12, 0], 1.8), m);
  sk.add('paint', blob([[10, -3.6], [20, -5.8], [30, -3], [33, 0], [30, 3], [20, 5.8], [10, 3.6]], 0.9), m);
  sk.add('metal', R(-6, -6.4, -3.6, -1.8), m);
  sk.add('light', capsule([12, -3.4], [28, -2], 0.5), m);
}

function molotov(sk: WS) {
  const m = rotate(16);
  sk.add('steel', P('M-8 -6 L-8 14 C-8 17 8 17 8 14 L8 -6 C8 -10 3 -11 3 -14 L3 -19 L-3 -19 L-3 -14 C-3 -11 -8 -10 -8 -6 Z'), m);
  sk.add('canvas', P('M-2 -19 C-5 -24 -1 -25 -2 -29 C2 -26 3 -24 1 -19 Z'), m);
  sk.add('flame', P('M-1 -27 C-6 -33 0 -36 -1 -41 C4 -37 7 -33 3 -27 Z'), m);
}

const CACHE = new Map<string, FlatFigure<WLayer>>();

/** The weapon's colour layers (cached per weapon and nation). */
export function weaponFigure(art: WeaponArt, nation: Nation): FlatFigure<WLayer> {
  const key = `${art}|${nation}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const sk: WS = new Sketch<WLayer>();
  switch (art) {
    case 'lmg':
      lmg(sk, nation);
      break;
    case 'mmg':
      mmg(sk, nation);
      break;
    case 'hmg':
      hmg(sk, nation);
      break;
    case 'hmg50':
      hmg50(sk, nation);
      break;
    case 'lightMortar':
      lightMortar(sk, nation);
      break;
    case 'mediumMortar':
      mediumMortar(sk, nation);
      break;
    case 'gun':
      gun(sk, nation, false);
      break;
    case 'heavyGun':
      gun(sk, nation, true);
      break;
    case 'flamethrower':
      flamethrower(sk, nation);
      break;
    case 'satchel':
      satchel(sk, nation);
      break;
    case 'panzerfaust':
      panzerfaust(sk);
      break;
    case 'molotov':
      molotov(sk);
      break;
    case 'radio':
      radio(sk, nation);
      break;
  }
  const out = flatten(sk, WLAYERS, WFLAT);
  CACHE.set(key, out);
  return out;
}
