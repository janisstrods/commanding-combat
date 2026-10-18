// Parts of the soldier figures: heads and headgear (drawn around the head centre, facing right, head radius ~3.2) and
// small arms (drawn from the firing grip at the origin toward +x, stock behind, y down). All original drawings.
import { type Mat, type Pt, P, blob, capsule, circle, ellipse, poly } from './geom';
import type { Layer, Sketch } from './sketch';

// ---------------------------------------------------------------------------------------------------------------------
// Heads

/** Profile of a head facing right: skull, brow, nose, chin. */
export const HEAD = blob(
  [
    [-3.1, 0.3],
    [-2.5, -2.4],
    [0.1, -3.3],
    [2.6, -2.2],
    [3.2, -0.6],
    [3.9, 0.7],
    [3.1, 1.2],
    [3.2, 2.1],
    [2.1, 3.3],
    [-0.2, 3.3],
    [-1.8, 2.6],
  ],
  0.85,
);

export type Hat =
  | 'stahlhelm' // German M35 helmet
  | 'stahlhelmCamo' // the same with a camouflage cover
  | 'jumpHelmet' // German paratrooper helmet, no flared skirt
  | 'fieldCap' // German M43 cap
  | 'peakedCap' // German officer's cap
  | 'm1' // American M1 helmet
  | 'm1Net' // with netting and fastened chinstrap (paratroopers)
  | 'ssh40' // Russian helmet
  | 'pilotka' // Russian side cap
  | 'ushanka' // fur hat with ear flaps
  | 'furazhka'; // Russian officer's cap

const HATS: Record<Hat, string> = {
  stahlhelm:
    'M4.2 -0.4 C3.8 -0.6 3.6 -1.1 3.5 -1.7 C3.1 -4.9 -1.8 -5.8 -3.5 -3.1 C-4 -2.2 -4 -0.9 -3.9 0.3 C-4.1 1.2 -4.6 2 -5.2 2.6 L-3.5 2.5 C-2.8 1.8 -2.5 0.9 -2.3 0 L2.7 -0.3 C3.2 -0.2 3.7 -0.2 4.2 -0.4 Z',
  stahlhelmCamo:
    'M4.2 -0.4 C3.8 -0.6 3.6 -1.1 3.5 -1.7 C3.1 -4.9 -1.8 -5.8 -3.5 -3.1 C-4 -2.2 -4 -0.9 -3.9 0.3 C-4.1 1.2 -4.6 2 -5.2 2.6 L-3.5 2.5 C-2.8 1.8 -2.5 0.9 -2.3 0 L2.7 -0.3 C3.2 -0.2 3.7 -0.2 4.2 -0.4 Z',
  jumpHelmet: 'M3.5 -1 C3.5 -5.3 -3.6 -5.6 -3.8 -1.3 L-3.7 1.5 L-2.5 1.6 L-2.3 -0.5 L3.5 -0.8 Z',
  fieldCap: 'M5.3 -1.4 L3.1 -1.7 L3.2 -4.1 C1 -4.7 -2.4 -4.7 -3.4 -3.5 L-3.3 -1 L3 -1.1 Z',
  peakedCap: 'M5.3 -1 C4.5 -1.2 3.8 -1.4 3.1 -1.5 L3.9 -5.1 C1.6 -5.3 -1.9 -4.8 -3.7 -3.7 L-3.3 -1.5 L3.1 -1.5 Z',
  m1: 'M4.7 -0.5 L4.4 -1.2 C4.2 -5.6 -4.2 -5.7 -4.5 -1 L-4.8 0.7 C-1.6 0.2 1.6 -0.2 4.7 -0.5 Z',
  m1Net: 'M4.7 -0.5 L4.4 -1.2 C4.2 -5.6 -4.2 -5.7 -4.5 -1 L-4.8 0.7 C-1.6 0.2 1.6 -0.2 4.7 -0.5 Z',
  ssh40: 'M4.3 -0.2 C3.9 -0.6 3.7 -1.2 3.6 -1.9 C3.4 -6 -3.4 -6 -3.6 -1.9 C-3.7 -1 -3.9 -0.1 -4.4 0.7 L-3 0.6 C-2.6 0.1 -2.4 -0.4 -2.3 -0.8 L2.3 -1 C2.7 -0.6 3.2 -0.3 4.3 -0.2 Z',
  pilotka: 'M3.5 -1.9 C2.6 -3.4 -1.6 -4.6 -3.7 -2.6 L-3.1 -1.6 C-1.2 -2.1 1.4 -2 3.5 -1.9 Z',
  ushanka:
    'M3.6 -0.9 C4.1 -3.4 2.7 -5.6 -0.2 -5.6 C-3.3 -5.6 -4.8 -3.5 -4.4 -0.8 L-4 2.7 L-1.9 2.9 L-1.8 -0.3 L3.3 -0.5 Z',
  furazhka: 'M5.3 -1 L3.1 -1.6 L4.9 -4.4 C2.2 -5.2 -2.9 -5.1 -5 -4.1 L-3.3 -1.5 L3.1 -1.6 Z',
};

/** Draw a head with its headgear; `m` places the head frame. */
export function drawHead(sk: Sketch, m: Mat, hat: Hat, marks: { stripe?: 'v' | 'h'; star?: boolean } = {}) {
  sk.add('skin', HEAD, m);
  // ear, and the shadow of the brim over the eyes
  sk.add('skin', circle(-0.5, 0.4, 0.9), m);
  if (hat !== 'pilotka') sk.add('skinShade', P('M2.9 -1.5 C3.2 -0.9 3.3 -0.2 3 0.5 C1.6 0.4 0.4 0 -1.6 -0.4 L-1.4 -1.7 Z'), m);
  sk.add('hat', P(HATS[hat]), m);
  switch (hat) {
    case 'stahlhelm':
      sk.line([[3.4, -0.6], [-2.3, -0.1], [-4.9, 2.4]], 'ink', m);
      sk.add('light', P('M2.6 -3.8 C1.4 -4.8 -1.4 -4.9 -2.7 -3.7 C-1.2 -4.2 1 -4.3 2.6 -3.8 Z'), m);
      break;
    case 'stahlhelmCamo':
      for (const [x, y, r] of [
        [1.6, -3.2, 0.9],
        [-1.4, -3.6, 0.8],
        [-3, -1, 0.7],
        [0.6, -1.2, 0.6],
        [2.9, -1.6, 0.5],
      ])
        sk.add('hatMark', circle(x, y, r), m);
      break;
    case 'jumpHelmet':
      sk.line([[3.3, -0.8], [-2.4, -0.5]], 'ink', m);
      sk.line([[-2.6, 1.4], [0.6, 3.4]], 'ink', m);
      sk.add('light', P('M2.4 -4 C1.2 -4.9 -1.4 -5 -2.7 -3.9 C-1.2 -4.4 1 -4.5 2.4 -4 Z'), m);
      break;
    case 'm1':
    case 'm1Net':
      sk.line([[4.4, -1.1], [-4.5, 0.4]], 'ink', m);
      if (hat === 'm1Net') {
        for (const [x, y] of [
          [2.4, -3.6],
          [0.2, -4.3],
          [-2.2, -3.8],
          [-3.6, -2],
          [1.4, -2],
          [-0.9, -2.2],
          [3.3, -1.8],
        ])
          sk.add('hatMark', circle(x, y, 0.42), m);
        // fastened chinstrap
        sk.line([[-3.6, 0.3], [-0.6, 2.4], [2.2, 3.1]], 'ink', m);
      } else {
        sk.line([[-3.8, 0.4], [-3.4, 3.4]], 'ink', m);
      }
      sk.add('light', P('M2.6 -4.1 C1.3 -5 -1.4 -5.1 -2.8 -4 C-1.2 -4.5 1 -4.6 2.6 -4.1 Z'), m);
      if (marks.stripe === 'v') sk.add('accent', capsule([-3.3, -3.9], [-4.2, -1.1], 0.42), m);
      if (marks.stripe === 'h') sk.add('accent', capsule([-4.3, -1.8], [-2.6, -1.9], 0.42), m);
      break;
    case 'ssh40':
      sk.line([[3.6, -1.1], [-3.6, -0.9]], 'ink', m);
      sk.add('light', P('M2.6 -4.6 C1.3 -5.6 -1.4 -5.7 -2.7 -4.5 C-1.2 -5.1 1 -5.2 2.6 -4.6 Z'), m);
      if (marks.star) sk.add('accent', circle(2.2, -3.2, 0.6), m);
      break;
    case 'pilotka':
      sk.add('accent', circle(2.6, -2.4, 0.55), m);
      break;
    case 'fieldCap':
      sk.add('light', capsule([-2.8, -2.4], [2.5, -2.5], 0.35), m);
      break;
    case 'peakedCap':
      sk.add('hatMark', P('M3.2 -1.6 L3.5 -2.9 L-3.4 -2.6 L-3.3 -1.5 Z'), m);
      sk.add('gold', circle(3.0, -3.6, 0.5), m);
      break;
    case 'furazhka':
      sk.add('accent', P('M3.2 -1.6 L3.9 -2.9 L-4.1 -2.7 L-3.3 -1.5 Z'), m);
      sk.add('gold', circle(3.4, -2.3, 0.45), m);
      break;
    case 'ushanka':
      sk.line([[3.2, -0.7], [-1.9, -0.5]], 'hi', m);
      break;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Small arms

export type Arm =
  | 'k98' // German bolt-action rifle
  | 'mp40'
  | 'stg44'
  | 'fg42'
  | 'mg42'
  | 'garand'
  | 'carbine'
  | 'thompson'
  | 'bar'
  | 'mosin' // with its bayonet fixed
  | 'mosinPlain'
  | 'ppsh'
  | 'dp'
  | 'pistol'
  | 'panzerfaust'
  | 'bazooka'
  | 'flameGun' // flamethrower projector
  | 'detector' // mine detector
  | 'flag'
  | 'none';

export interface ArmDef {
  /** x of the supporting (far) hand along the weapon. */
  fore: number;
  draw: (sk: Sketch, m: Mat, metal: Layer, wood: Layer) => void;
}

const stock = (x0: number, x1: number, butt = 3.2): Pt[] => [
  [x0, -0.7],
  [-2.6, -0.25],
  [-0.9, -0.65],
  [x1, -0.6],
  [x1 + 0.2, 0.5],
  [0.6, 0.75],
  [-1, 1.3],
  [x0, -0.7 + butt],
];

export const ARMS: Record<Exclude<Arm, 'none'>, ArmDef> = {
  k98: {
    fore: 6.5,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly(stock(-9.2, 10.4)), m);
      sk.add(metal, capsule([9.8, -0.15], [15.6, -0.2], 0.4, 0.34), m);
      sk.add(metal, capsule([-0.7, -0.85], [3.4, -0.85], 0.48), m);
      sk.add(metal, circle(0.4, 0.45, 0.5), m);
      sk.add(metal, capsule([8.4, -0.3], [8.4, 0.4], 0.45), m);
    },
  },
  mosin: {
    fore: 7,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly(stock(-9.2, 11.2)), m);
      sk.add(metal, capsule([10.6, -0.15], [16.6, -0.2], 0.4, 0.34), m);
      sk.add(metal, capsule([-0.7, -0.85], [3.6, -0.85], 0.5), m);
      sk.add(metal, circle(0.4, 0.5, 0.5), m);
      sk.add(metal, capsule([16.4, 0.15], [22.8, 0.2], 0.28, 0.08), m);
    },
  },
  mosinPlain: {
    fore: 7,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly(stock(-9.2, 11.2)), m);
      sk.add(metal, capsule([10.6, -0.15], [16.6, -0.2], 0.4, 0.34), m);
      sk.add(metal, capsule([-0.7, -0.85], [3.6, -0.85], 0.5), m);
      sk.add(metal, circle(0.4, 0.5, 0.5), m);
    },
  },
  garand: {
    fore: 6.5,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly(stock(-8.8, 9.2, 3.1)), m);
      sk.add(metal, capsule([-0.9, -0.9], [4.2, -0.9], 0.62), m);
      sk.add(wood, capsule([4.4, -0.85], [8.6, -0.8], 0.45), m);
      sk.add(metal, capsule([8.8, -0.2], [14.4, -0.25], 0.42, 0.36), m);
      sk.add(metal, capsule([12.8, 0.5], [14.4, 0.5], 0.5), m);
    },
  },
  carbine: {
    fore: 5,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly(stock(-7, 7.2, 2.7)), m);
      sk.add(metal, capsule([6.6, -0.15], [11, -0.2], 0.36), m);
      sk.add(metal, capsule([-0.7, -0.8], [3, -0.8], 0.5), m);
      sk.add(metal, poly([[1.2, 0.6], [2.4, 0.6], [2.4, 2.4], [1.2, 2.4]]), m);
    },
  },
  mp40: {
    fore: 3.4,
    draw: (sk, m, metal) => {
      sk.add(metal, capsule([-1.8, -0.5], [5.8, -0.5], 0.78), m);
      sk.add(metal, capsule([5.6, -0.45], [9.6, -0.45], 0.42), m);
      sk.add(metal, poly([[8.5, -0.2], [9.2, -0.2], [9.2, 0.7], [8.5, 0.7]]), m);
      sk.add(metal, poly([[2.6, 0.1], [4, 0.1], [3.9, 6], [2.5, 6]]), m);
      sk.add(metal, poly([[-0.6, 0], [0.9, 0], [0.5, 3.1], [-0.9, 3]]), m);
      sk.add(metal, capsule([-1.8, -0.2], [-7.6, 0], 0.3), m);
      sk.add(metal, capsule([-1.2, 0.8], [-7.6, 1.6], 0.3), m);
      sk.add(metal, capsule([-7.8, -0.3], [-7.8, 2], 0.45), m);
    },
  },
  stg44: {
    fore: 4.6,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly([[-1.2, -0.8], [-8.6, -0.4], [-8.6, 2.1], [-1.4, 1]]), m);
      sk.add(metal, poly([[-1.4, -1.1], [7, -1], [7, 0.8], [-1.4, 0.9]]), m);
      sk.add(metal, capsule([6.8, -0.65], [10.4, -0.65], 0.36), m);
      sk.add(metal, capsule([6.8, 0.15], [12, 0.15], 0.4), m);
      sk.add(metal, P('M2.3 0.6 L4.1 0.6 C4.5 2.4 5.1 3.9 6 5.2 L4.3 6 C3.2 4.5 2.6 2.6 2.3 0.6 Z'), m);
      sk.add(metal, poly([[-0.5, 0.6], [0.9, 0.6], [0.6, 3.3], [-0.8, 3.2]]), m);
    },
  },
  fg42: {
    fore: 5.5,
    draw: (sk, m, metal, wood) => {
      sk.add(metal, poly([[-1.2, -0.7], [-8.4, -0.5], [-8.6, 1.8], [-1.2, 0.8]]), m);
      sk.add(metal, poly([[-1.2, -1.0], [6.4, -0.9], [6.4, 0.8], [-1.2, 0.9]]), m);
      sk.add(wood, poly([[2.6, 0.6], [6.2, 0.6], [6, 1.6], [2.8, 1.6]]), m);
      sk.add(metal, capsule([6.2, -0.2], [13.6, -0.2], 0.4), m);
      sk.add(metal, poly([[1, -0.4], [2.6, -0.4], [2.6, -3.4], [1, -3.4]]), m);
      sk.add(metal, capsule([11.4, 0.2], [9.4, 4.2], 0.25), m);
      sk.add(metal, capsule([11.4, 0.2], [12.6, 4.4], 0.25), m);
      sk.add(metal, poly([[-0.4, 0.6], [1, 0.6], [0.4, 3.2], [-1, 3]]), m);
    },
  },
  mg42: {
    fore: 9.4,
    draw: (sk, m, metal) => {
      sk.add(metal, poly([[-1, -0.9], [-7.8, -0.6], [-8.8, 1.5], [-7.8, 2.4], [-1.2, 1]]), m);
      sk.add(metal, poly([[-1.2, -1.4], [5.6, -1.4], [5.6, 1.0], [-1.2, 1.0]]), m);
      sk.add(metal, poly([[-0.3, 0.6], [1.1, 0.6], [0.7, 3.2], [-0.7, 3.1]]), m);
      sk.add(metal, capsule([5.4, -0.4], [14.2, -0.4], 1.0), m);
      sk.add(metal, poly([[14, -1.4], [16.8, -1.0], [16.8, 0.2], [14, 0.6]]), m);
      sk.add(metal, capsule([12.6, 0.4], [9.6, 1.5], 0.28), m);
      for (let x = 6.6; x < 13.5; x += 1.6) sk.line([[x, -0.5], [x + 0.8, -0.5]], 'hi', m);
      sk.add('brass', P('M2.2 0.8 C2.3 2.6 2.6 4 1.6 5.8 L0.6 5.5 C1.4 4 1.2 2.6 1.2 0.8 Z'), m);
    },
  },
  thompson: {
    fore: 7.4,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly([[-1.2, -0.6], [-8.6, -0.2], [-8.6, 2.1], [-1.6, 1]]), m);
      sk.add(metal, poly([[-1.2, -1], [5.8, -1], [5.8, 0.8], [-1.2, 0.9]]), m);
      sk.add(metal, capsule([5.6, -0.3], [10.2, -0.3], 0.48), m);
      sk.add(metal, poly([[2.8, 0.6], [4.3, 0.6], [4.3, 4.8], [2.8, 4.8]]), m);
      sk.add(wood, poly([[-0.4, 0.6], [1, 0.6], [0.7, 3.3], [-0.8, 3.2]]), m);
      sk.add(wood, capsule([6.1, 0.65], [8.6, 0.65], 0.6), m);
    },
  },
  bar: {
    fore: 8.2,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly([[-1.2, -0.7], [-9, -0.3], [-9, 2.3], [-1.4, 1]]), m);
      sk.add(metal, poly([[-1.2, -1.05], [6.2, -1.05], [6.2, 0.95], [-1.2, 0.95]]), m);
      sk.add(metal, poly([[2.4, 0.8], [4.7, 0.8], [4.7, 3.7], [2.4, 3.7]]), m);
      sk.add(wood, poly([[6.2, -0.7], [10.6, -0.55], [10.6, 0.65], [6.2, 0.85]]), m);
      sk.add(metal, capsule([10.4, -0.1], [17.6, -0.1], 0.42), m);
      sk.add(metal, capsule([16.2, 0.3], [12.4, 1.1], 0.25), m);
      sk.add(metal, poly([[-0.4, 0.6], [1, 0.6], [0.6, 3.2], [-0.8, 3]]), m);
    },
  },
  ppsh: {
    fore: 2.6,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly([[-8.6, -0.5], [-1.4, -0.4], [-0.4, -0.9], [4.2, -0.9], [4.2, 0.7], [0.6, 0.95], [-1, 1.3], [-8.6, 2.5]]), m);
      sk.add(metal, capsule([-0.6, -1.15], [4.4, -1.15], 0.55), m);
      sk.add(metal, P('M4 -1.4 L10.4 -1.3 L11 -0.6 L10.6 0.4 L4 0.5 Z'), m);
      sk.add(metal, circle(2.3, 3, 2.6), m);
      for (let x = 5; x < 10; x += 1.5) sk.line([[x, -0.45], [x + 0.6, -0.45]], 'hi', m);
      sk.line([[0.8, 2.2], [3.8, 2.2]], 'hi', m);
    },
  },
  dp: {
    fore: 6.6,
    draw: (sk, m, metal, wood) => {
      sk.add(wood, poly([[-9, -0.5], [-1.4, -0.2], [-0.6, -0.8], [0.9, -0.8], [0.9, 1], [-1, 1.4], [-9, 2.5]]), m);
      sk.add(metal, poly([[0.6, -0.95], [6.2, -0.95], [6.2, 0.85], [0.6, 0.95]]), m);
      sk.add(metal, capsule([6, -0.2], [14.6, -0.2], 0.9), m);
      sk.add(metal, poly([[14.4, -0.7], [16.8, -1.2], [16.8, 0.8], [14.4, 0.3]]), m);
      sk.add(metal, ellipse(3, -2.1, 4, 0.95), m);
      sk.add(metal, capsule([12, 0.6], [16, 0.9], 0.25), m);
    },
  },
  pistol: {
    fore: 0,
    draw: (sk, m, metal) => {
      sk.add(metal, capsule([-0.3, -0.6], [4, -0.6], 0.58), m);
      sk.add(metal, poly([[-0.4, -0.3], [1.1, -0.3], [0.7, 2.6], [-0.8, 2.4]]), m);
    },
  },
  panzerfaust: {
    fore: 4,
    draw: (sk, m, metal) => {
      sk.add(metal, capsule([-9.6, 0], [4.4, 0], 0.62), m);
      sk.add(metal, blob([[3.8, -0.9], [6.2, -1.9], [9, -1.1], [9.9, 0], [9, 1.1], [6.2, 1.9], [3.8, 0.9]], 0.9), m);
      sk.add(metal, poly([[-0.4, -0.5], [0.4, -0.5], [0.4, -2], [-0.4, -2]]), m);
    },
  },
  bazooka: {
    fore: 4.6,
    draw: (sk, m, metal, wood) => {
      sk.add(metal, capsule([-12, 0], [10.4, 0], 0.95), m);
      sk.add(metal, poly([[10, -0.95], [12, -1.4], [12, 1.4], [10, 0.95]]), m);
      sk.add(wood, poly([[-4.6, 0.6], [-1.2, 0.6], [-1.2, 2.6], [-4.6, 2.2]]), m);
      sk.add(wood, poly([[-0.3, 0.6], [1, 0.6], [0.7, 3.1], [-0.6, 3]]), m);
      sk.add(wood, poly([[3.9, 0.6], [5.2, 0.6], [5, 3.1], [3.7, 3]]), m);
    },
  },
  flameGun: {
    fore: 5.2,
    draw: (sk, m, metal) => {
      sk.add(metal, capsule([-6, 0], [9.4, -0.2], 0.62), m);
      sk.add(metal, poly([[9.2, -0.8], [11, -0.6], [11, 0.4], [9.2, 0.4]]), m);
      sk.add(metal, poly([[-0.4, 0.4], [1, 0.4], [0.6, 3], [-0.8, 2.8]]), m);
      sk.add(metal, poly([[4.6, 0.4], [6, 0.4], [5.6, 2.8], [4.2, 2.7]]), m);
      sk.add('flame', blob([[11.2, -0.4], [13.6, -1.8], [15.8, -0.8], [18.4, -2.2], [18.2, 0.6], [15, 1.4], [12, 0.9]], 0.9), m);
      sk.add('flameCore', blob([[11.4, -0.1], [13.8, -0.8], [16, 0], [13.8, 0.6]], 0.9), m);
    },
  },
  detector: {
    fore: 9,
    draw: (sk, m, metal) => {
      sk.add(metal, capsule([-2, 0], [16.4, 0], 0.32), m);
      sk.add(metal, poly([[-0.4, 0.2], [0.9, 0.2], [0.6, 2.4], [-0.6, 2.3]]), m);
      sk.add(metal, poly([[1.2, -0.6], [3.6, -0.6], [3.6, 0.9], [1.2, 0.9]]), m);
    },
  },
  flag: {
    fore: 6,
    draw: (sk, m, _metal, wood) => {
      sk.add(wood, capsule([-5, 0], [25, 0], 0.36), m);
      sk.add('gold', circle(25.6, 0, 0.75), m);
      sk.add('accent', blob([[24.6, -0.2], [23.8, -4.2], [24.8, -8.2], [24, -12], [16.2, -11.2], [16.8, -7.4], [15.6, -3.6], [16.2, -0.2]], 0.8), m);
      sk.line([[22.6, -2.4], [18.2, -2.2]], 'hi', m);
    },
  },
};

/** Where the hand holding a weapon at `grip` (angle `deg`) puts its supporting hand. */
export function foreOf(arm: Arm, m: Mat): Pt {
  const d = arm === 'none' ? 0 : ARMS[arm].fore;
  return [m[0] * d + m[4], m[1] * d + m[5]];
}

export function drawArm(sk: Sketch, arm: Arm, m: Mat, back = false) {
  if (arm === 'none') return;
  ARMS[arm].draw(sk, m, back ? 'backMetal' : 'metal', back ? 'backWood' : 'wood');
}

// ---------------------------------------------------------------------------------------------------------------------
// Things held in the free hand

export function stickGrenade(sk: Sketch, m: Mat) {
  sk.add('wood', capsule([0, 0], [4.8, 0], 0.4), m);
  sk.add('metal', capsule([4.6, 0], [7, 0], 1.05), m);
}

/** A bundle of grenade heads on one handle (the improvised heavy charge). */
export function bundleCharge(sk: Sketch, m: Mat) {
  sk.add('wood', capsule([0, 0], [4.4, 0], 0.4), m);
  for (const [x, y] of [
    [6, -1.4],
    [6, 1.4],
    [7.4, 0],
    [5.2, 0],
  ])
    sk.add('metal', capsule([x - 1.2, y], [x + 1.2, y], 1.05), m);
}

export function roundGrenade(sk: Sketch, m: Mat) {
  sk.add('metal', ellipse(0.8, 0, 1.25, 1.05), m);
  sk.add('metal', poly([[0.2, -1.4], [1.4, -1.4], [1.4, -0.6], [0.2, -0.6]]), m);
}

/** A canvas satchel charge with its fuse. */
export function satchel(sk: Sketch, m: Mat) {
  sk.add('kit2', poly([[-2.4, 0.8], [3.6, 0.8], [3.4, 5.6], [-2.2, 5.6]]), m);
  sk.add('kit2', capsule([-1.2, 0.8], [-0.6, -0.4], 0.3), m);
  sk.add('kit2', capsule([2.2, 0.8], [1.6, -0.4], 0.3), m);
  sk.line([[-2.2, 2.6], [3.4, 2.6]], 'ink', m);
  sk.line([[3.4, 4.6], [5.2, 4.4], [6, 5.6]], 'ink', m);
}

export function ammoBox(sk: Sketch, m: Mat) {
  sk.add('kit2', poly([[-2.2, 1.2], [2.6, 1.2], [2.6, 4.8], [-2.2, 4.8]]), m);
  sk.add('metal', capsule([-0.8, 0.2], [1.2, 0.2], 0.3), m);
  sk.line([[-2.2, 2], [2.6, 2]], 'ink', m);
}

export function binoculars(sk: Sketch, m: Mat) {
  sk.add('metal', blob([[0, -1.2], [2.8, -1.1], [3.1, 0], [2.8, 1.1], [0, 1.2], [-0.4, 0]], 0.7), m);
}
