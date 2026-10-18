// The soldier rig: a pose is a handful of joints (hip, neck, head, knees, ankles, hands) in a figure frame where the
// feet stand on y = 0 and the figure faces right, about 40 units tall. `buildFigure` dresses the pose in a kit
// (headgear, coat, legwear, webbing) and puts a weapon in its hands, collecting shapes per colour layer.
import { type Pt, P, add, angleOf, at, blob, capsule, circle, ellipse, ik, lerp, mul, norm, place, poly, sub, len } from './geom';
import { type Arm, type Hat, ammoBox, binoculars, bundleCharge, drawArm, drawHead, foreOf, roundGrenade, satchel, stickGrenade } from './parts';
import { type FlatFigure, Sketch, flatten } from './sketch';

export type PoseName =
  | 'walk'
  | 'run'
  | 'aim'
  | 'kneel'
  | 'prone'
  | 'throw'
  | 'carry'
  | 'point'
  | 'binos'
  | 'wave'
  | 'flee'
  | 'fleeBare'
  | 'cower'
  | 'stand'
  | 'flag'
  | 'sweep';

interface HandSpec {
  hand: Pt;
  elbow?: Pt;
  bend?: 1 | -1;
}

interface Hold {
  grip: Pt;
  angle: number;
  /** Which hand takes the grip ('near' by default); the other takes the fore-end unless it has its own place. */
  by?: 'near' | 'far';
  /** The gripping hand sits on the fore-end instead (a rifle held upright at the side). */
  atFore?: boolean;
  /** Drawn behind the body (held on the far side, or slung). */
  back?: boolean;
}

interface PoseDef {
  hip: Pt;
  neck: Pt;
  head: Pt;
  headTilt?: number;
  kneeN: Pt;
  ankleN: Pt;
  footN?: number;
  kneeF: Pt;
  ankleF: Pt;
  footF?: number;
  /** Shoulder offsets (along the spine from the neck, toward the front) when the default does not fit. */
  shoulderF?: [number, number];
  hold?: Hold;
  near?: HandSpec;
  far?: HandSpec;
  /** Where a weapon that is not in the hands is slung: grip and angle, drawn behind the body. */
  sling?: { grip: Pt; angle: number };
}

const POSES: Record<PoseName, PoseDef> = {
  walk: {
    hip: [0, -19],
    neck: [1, -31.3],
    head: [2.1, -35.2],
    kneeN: [3, -10.3],
    ankleN: [5.6, -1.3],
    footN: -4,
    kneeF: [-1.8, -10.2],
    ankleF: [-5.6, -2.4],
    footF: 28,
    hold: { grip: [3.6, -21.6], angle: -52 },
  },
  run: {
    hip: [0, -18.4],
    neck: [3.4, -30.1],
    head: [5, -33.8],
    kneeN: [5.6, -10.8],
    ankleN: [7.4, -1.3],
    kneeF: [-3.6, -9.6],
    ankleF: [-9, -3.8],
    footF: 50,
    hold: { grip: [4.8, -20.8], angle: -14 },
  },
  aim: {
    hip: [0, -19],
    neck: [0.6, -31.4],
    head: [3.2, -33.9],
    headTilt: 10,
    kneeN: [2, -10.1],
    ankleN: [3.8, -1.3],
    kneeF: [-1.6, -10.1],
    ankleF: [-4.2, -1.3],
    shoulderF: [-1.8, 1.6],
    hold: { grip: [8.2, -29.9], angle: -3 },
  },
  kneel: {
    hip: [-0.8, -11.8],
    neck: [0.6, -24.1],
    head: [3.2, -26.6],
    headTilt: 10,
    kneeN: [2.4, -1.8],
    ankleN: [-5.4, -4.2],
    footN: 52,
    kneeF: [6.8, -12],
    ankleF: [6.6, -1.3],
    shoulderF: [-1.8, 1.6],
    hold: { grip: [8, -22.6], angle: -3 },
  },
  prone: {
    hip: [-7.6, -3.2],
    neck: [4.4, -5.4],
    head: [7.8, -7.8],
    headTilt: -10,
    kneeN: [-16.4, -2.2],
    ankleN: [-24.6, -3.6],
    footN: 112,
    kneeF: [-15.8, -2.8],
    ankleF: [-23.6, -4.4],
    footF: 108,
    hold: { grip: [9.6, -5.6], angle: -2 },
    near: { hand: [9.6, -5.6], elbow: [6.4, -1.6] },
    far: { hand: [3.2, -7.2], elbow: [3.6, -1.6] },
  },
  throw: {
    hip: [0, -19],
    neck: [-1, -31.2],
    head: [0, -35],
    kneeN: [4.4, -10.6],
    ankleN: [7.6, -1.3],
    kneeF: [-2.8, -10],
    ankleF: [-6.8, -1.8],
    footF: 22,
    near: { hand: [-7.2, -39.8], elbow: [-5, -33.4] },
    far: { hand: [9.4, -33.6], elbow: [4.6, -32.2] },
    sling: { grip: [-3.8, -21.4], angle: -78 },
  },
  carry: {
    hip: [0, -19],
    neck: [0.8, -31.4],
    head: [2.1, -35.3],
    kneeN: [3, -10.3],
    ankleN: [5.6, -1.3],
    footN: -4,
    kneeF: [-1.8, -10.2],
    ankleF: [-5.6, -2.4],
    footF: 28,
    hold: { grip: [-8.4, -27.4], angle: -24 },
    near: { hand: [4.6, -32.6] },
    far: { hand: [-3.4, -18.6] },
  },
  point: {
    hip: [0, -19],
    neck: [0.6, -31.4],
    head: [1.9, -35.3],
    kneeN: [2.8, -10.2],
    ankleN: [5, -1.3],
    kneeF: [-1.6, -10.1],
    ankleF: [-4.2, -1.3],
    near: { hand: [12.4, -34.4], elbow: [6.4, -31.8] },
    hold: { grip: [3.6, -20.6], angle: 32, by: 'far', back: true },
  },
  binos: {
    hip: [0, -19],
    neck: [0.4, -31.4],
    head: [1.4, -35.2],
    kneeN: [2.6, -10.2],
    ankleN: [4.8, -1.3],
    kneeF: [-1.6, -10.1],
    ankleF: [-4.2, -1.3],
    near: { hand: [6.1, -34.3] },
    far: { hand: [5.6, -36.2] },
  },
  wave: {
    hip: [0, -18.6],
    neck: [2.6, -30.6],
    head: [4, -34.4],
    kneeN: [5.6, -10.8],
    ankleN: [7.4, -1.3],
    kneeF: [-3.6, -9.6],
    ankleF: [-9, -3.8],
    footF: 50,
    near: { hand: [7.4, -41], elbow: [5.2, -35.6] },
    hold: { grip: [4.6, -21.2], angle: -12, by: 'far', back: true },
  },
  flee: {
    hip: [0, -17.6],
    neck: [4.2, -28.6],
    head: [5.6, -32.2],
    headTilt: 14,
    kneeN: [5, -10.2],
    ankleN: [6.8, -1.3],
    kneeF: [-3.4, -9],
    ankleF: [-8.6, -3.6],
    footF: 50,
    near: { hand: [4.8, -35.8], elbow: [7.6, -31.2] },
    hold: { grip: [-3.4, -19.8], angle: 160, by: 'far', back: true },
  },
  fleeBare: {
    hip: [0, -18],
    neck: [3.6, -29.6],
    head: [5, -33.2],
    kneeN: [5.4, -10.6],
    ankleN: [7, -1.3],
    kneeF: [-3.4, -9.2],
    ankleF: [-8.8, -3.6],
    footF: 50,
    near: { hand: [8.6, -23.8], elbow: [5, -24.4] },
    far: { hand: [-4.6, -22.8], elbow: [-2.2, -25.6] },
  },
  cower: {
    hip: [-1.4, -8.4],
    neck: [2.8, -18.6],
    head: [5.2, -21],
    headTilt: 24,
    kneeN: [4.8, -9.2],
    ankleN: [2.6, -1.3],
    kneeF: [3.6, -8.4],
    ankleF: [-0.6, -1.3],
    footF: 16,
    near: { hand: [5.2, -24.6], elbow: [8.4, -19.6] },
    far: { hand: [3.6, -25], elbow: [6.6, -21.4] },
  },
  stand: {
    hip: [0, -19.2],
    neck: [0.2, -31.6],
    head: [0.9, -35.5],
    kneeN: [1.2, -10.2],
    ankleN: [2, -1.3],
    kneeF: [-0.8, -10.2],
    ankleF: [-1.6, -1.3],
    hold: { grip: [3.8, -10.4], angle: -87, atFore: true },
    far: { hand: [-1.4, -17.6], elbow: [-1.8, -23.8] },
  },
  flag: {
    hip: [0, -19],
    neck: [1, -31.3],
    head: [2.1, -35.2],
    kneeN: [3, -10.3],
    ankleN: [5.6, -1.3],
    footN: -4,
    kneeF: [-1.8, -10.2],
    ankleF: [-5.6, -2.4],
    footF: 28,
    hold: { grip: [2.8, -21.2], angle: -74 },
    sling: { grip: [-3.6, -21.6], angle: -80 },
  },
  sweep: {
    hip: [0, -19],
    neck: [1.6, -31.2],
    head: [3.4, -34.6],
    headTilt: 16,
    kneeN: [3, -10.3],
    ankleN: [5.6, -1.3],
    footN: -4,
    kneeF: [-1.8, -10.2],
    ankleF: [-5.6, -2.4],
    footF: 28,
    hold: { grip: [4.2, -21.4], angle: 52 },
    sling: { grip: [-3.6, -21.6], angle: -80 },
  },
};

export const POSE_NAMES = Object.keys(POSES) as PoseName[];

// ---------------------------------------------------------------------------------------------------------------------
// Kit

export type Coat = 'tunic' | 'smock' | 'greatcoat' | 'padded' | 'jump' | 'civil';
export type Legwear = 'jackboots' | 'gaiters' | 'leggings' | 'jumpboots' | 'boots' | 'puttees';
export type Gear = 'de' | 'us' | 'ru' | 'fj' | 'para' | 'officer' | 'light';

export interface Kit {
  hat: Hat;
  coat: Coat;
  legwear: Legwear;
  gear: Gear;
  camo?: 'oak' | 'splinter';
  cuirass?: boolean;
  /** Pack or sack on the back. */
  pack?: boolean;
  stripe?: 'v' | 'h';
}

/** What a figure carries besides its weapon. */
export type Extra = 'panzerfaust' | 'stick' | 'bundle' | 'pineapple' | 'satchel' | 'flamer' | 'ammo';

export interface FigureSpec {
  pose: PoseName;
  kit: Kit;
  arm: Arm;
  extra?: Extra;
}

// ---------------------------------------------------------------------------------------------------------------------
// Building

const UPPER = 7.2;
const FORE = 6.9;

function foot(sk: Sketch, layer: 'boot' | 'farBoot', ankle: Pt, deg: number) {
  sk.add(layer, P('M-1.9 -1 L1.2 -1.1 C2.7 -0.9 3.9 -0.2 4.2 1.3 L-1.9 1.3 Z'), place(ankle[0], ankle[1], deg));
}

function leg(sk: Sketch, kit: Kit, hip: Pt, knee: Pt, ankle: Pt, footDeg: number, far: boolean) {
  sk.add(far ? 'farLeg' : 'legs', [capsule(hip, knee, 2.35, 1.95), capsule(knee, ankle, 1.95, 1.55)]);
  const bootL = far ? 'farBoot' : 'boot';
  const wearL = far ? 'farLegwear' : 'legwear';
  const up = (t: number) => lerp(ankle, knee, t);
  switch (kit.legwear) {
    case 'jackboots':
      sk.add(bootL, capsule(ankle, up(0.6), 1.65, 1.9));
      break;
    case 'boots':
      sk.add(bootL, capsule(ankle, up(0.5), 1.65, 1.85));
      break;
    case 'jumpboots':
      sk.add(bootL, capsule(ankle, up(0.42), 1.65, 1.85));
      break;
    case 'gaiters':
      sk.add(wearL, capsule(ankle, up(0.34), 1.8, 1.95));
      sk.add(bootL, capsule(ankle, up(0.08), 1.75));
      break;
    case 'leggings': {
      sk.add(wearL, capsule(ankle, up(0.5), 1.8, 2.0));
      const u = norm(sub(knee, ankle));
      for (const t of [0.15, 0.3, 0.45]) sk.line([at(up(t), u, 0, -0.4), at(up(t), u, 0, 1.6)], 'ink');
      break;
    }
    case 'puttees': {
      sk.add(wearL, capsule(ankle, up(0.46), 1.75, 1.95));
      const u = norm(sub(knee, ankle));
      for (const t of [0.12, 0.24, 0.36]) sk.line([at(up(t), u, -0.3, -1.6), at(up(t), u, 0.5, 1.6)], 'ink');
      break;
    }
  }
  foot(sk, bootL, ankle, footDeg);
}

function arm(sk: Sketch, shoulder: Pt, h: HandSpec, far: boolean): Pt {
  const elbow = h.elbow ?? ik(shoulder, h.hand, UPPER, FORE, h.bend ?? 1);
  sk.add(far ? 'farArm' : 'arm', [capsule(shoulder, elbow, 1.85, 1.55), capsule(elbow, h.hand, 1.55, 1.2)]);
  sk.add(far ? 'farHand' : 'skin', circle(h.hand[0], h.hand[1], 1.3));
  return elbow;
}

function torso(sk: Sketch, pd: PoseDef, kit: Kit) {
  const H = pd.hip;
  const N = pd.neck;
  const u = norm(sub(N, H));
  const L = len(sub(N, H));
  const w = kit.coat === 'padded' ? 1.14 : kit.coat === 'smock' || kit.coat === 'jump' ? 1.06 : 1;
  const T = (s: number, t: number) => at(H, u, s, t * w);
  sk.add('coat', blob([T(-2.4, -3.1), T(-2.6, 3.1), T(2.2, 3.2), T(6.8, 3.7), T(L - 0.7, 2.1), T(L + 0.7, 0.2), T(L - 0.8, -3), T(5, -3.4), T(0.8, -3.3)], 0.9));

  // skirt of long coats and smocks, hanging over the thighs
  const kFront = pd.kneeN[0] > pd.kneeF[0] ? pd.kneeN : pd.kneeF;
  const kBack = pd.kneeN[0] > pd.kneeF[0] ? pd.kneeF : pd.kneeN;
  const skirt = (t: number, flare: number) => {
    const hf = lerp(at(H, u, 0, 2.9), add(kFront, [1.6, 0]), t);
    const hb = lerp(at(H, u, 0, -3), add(kBack, [-1.8, 0]), t);
    const mid = lerp(hf, hb, 0.5);
    sk.add('coat', blob([at(H, u, 1.4, -3.3 * w), at(H, u, 1.4, 3.1 * w), add(hf, [flare, 0.3]), add(mid, [0, 0.7]), add(hb, [-flare, 0.3])], 0.7));
  };
  if (kit.coat === 'greatcoat') skirt(0.86, 1.6);
  else if (kit.coat === 'civil') skirt(0.7, 1.2);
  else if (kit.coat === 'smock') skirt(0.42, 0.6);

  // camouflage on the smock
  if (kit.camo) {
    const spots: [number, number, number, 'pattern' | 'pattern2'][] =
      kit.camo === 'oak'
        ? [
            [2, -1.6, 1.1, 'pattern'],
            [5.4, 1.4, 1.2, 'pattern'],
            [9, -1, 1, 'pattern'],
            [3.6, 1.8, 0.8, 'pattern2'],
            [7.4, -2.2, 0.9, 'pattern2'],
            [10.6, 1.2, 0.7, 'pattern2'],
            [0.4, 1, 0.8, 'pattern'],
          ]
        : [
            [2, -1.2, 1, 'pattern'],
            [6, 1.6, 1, 'pattern'],
            [9.4, -1.4, 0.9, 'pattern'],
            [4, -0.2, 0.8, 'pattern2'],
            [8, 0.6, 0.8, 'pattern2'],
            [0.2, 1.8, 0.7, 'pattern2'],
          ];
    for (const [s, t, r, layer] of spots) {
      const c = T(s, t);
      if (kit.camo === 'oak') sk.add(layer, ellipse(c[0], c[1], r * 1.2, r * 0.8, angleOf(u) + 30));
      else sk.add(layer, poly([at(c, u, -r * 1.4, -r * 0.4), at(c, u, r * 0.6, -r * 0.9), at(c, u, r * 1.4, r * 0.3), at(c, u, -r * 0.4, r * 0.8)]));
    }
  }

  if (kit.coat === 'padded') {
    for (const s of [1.4, 3.8, 6.2, 8.6]) sk.line([T(s, -3.1), T(s + 0.3, 3.3)], 'ink');
  }
  if (kit.coat === 'jump') {
    sk.line([T(5.6, 0.6), T(5.6, 3.3)], 'ink');
    sk.line([T(1.2, 0.8), T(3.6, 0.8), T(3.6, 3.2)], 'ink');
  }
  if (kit.coat === 'greatcoat') {
    for (const s of [1.6, 4.6, 7.6]) sk.add('light', circle(...T(s, 2.4), 0.36));
  }
}

function gear(sk: Sketch, pd: PoseDef, kit: Kit) {
  const H = pd.hip;
  const N = pd.neck;
  const u = norm(sub(N, H));
  const w = kit.coat === 'padded' ? 1.14 : 1;
  const T = (s: number, t: number) => at(H, u, s, t * w);
  const TN = (s: number, t: number) => at(N, u, s, t * w);
  const belt = (r: number) => sk.add('kit', capsule(T(1.5, -3.3), T(1.5, 3.2), r));
  switch (kit.gear) {
    case 'de':
      belt(0.72);
      sk.add('kit', poly([T(2.7, 2.1), T(2.7, 4), T(0.4, 4.1), T(0.4, 2.2)]));
      sk.add('kit', capsule(TN(-0.8, 1.5), T(2.3, 2.4), 0.4));
      sk.add('kit2', capsule(T(1.1, -4.4), T(-3.6, -3.2), 1.35));
      sk.line([T(-0.4, -5.2), T(-0.6, -2.6)], 'ink');
      sk.line([T(-2, -4.8), T(-2.2, -2.2)], 'ink');
      break;
    case 'us':
      belt(0.92);
      sk.add('kit', capsule(TN(-0.6, 1.6), T(2.5, 2.6), 0.45));
      sk.add('kit2', ellipse(...T(0.6, -3.6), 1.35, 1.9, angleOf(u) + 90));
      break;
    case 'para':
      belt(0.92);
      sk.add('kit', capsule(TN(-0.6, 1.6), T(2.5, 2.6), 0.45));
      break;
    case 'ru':
      belt(0.72);
      sk.add('kit', poly([T(2.4, 2.3), T(2.4, 3.9), T(0.6, 4), T(0.6, 2.4)]));
      sk.add('kit2', capsule(TN(-0.5, -1.4), T(2.6, 3.1), 1.35));
      sk.line([TN(-2.6, -0.2), TN(-3.6, 1.2)], 'hi');
      break;
    case 'fj':
      belt(0.72);
      sk.add('kit2', capsule(TN(-0.6, 1.1), T(3, 3.4), 1.05));
      for (const s of [4.4, 6.6, 8.8]) sk.line([T(s, 2.1), T(s, 3.9)], 'ink');
      break;
    case 'officer':
      belt(0.78);
      sk.add('kit', capsule(TN(-0.4, 1.8), T(2.4, 2.6), 0.36));
      sk.add('kit', blob([T(1, 2.6), T(1.2, 4.3), T(-1.6, 4.4), T(-1.4, 2.8)], 0.6));
      sk.add('kit', poly([T(1.2, -2.6), T(1.2, -4.4), T(-2.4, -4.2), T(-2.4, -2.6)]));
      break;
    case 'light':
      belt(0.7);
      break;
  }
  if (kit.cuirass) {
    sk.add('kit2', blob([TN(-0.8, 0.6), TN(-1.8, 3.9), T(4.4, 4.2), T(2.2, 3.5), T(2.2, 0.4)], 0.8));
    sk.add('light', blob([TN(-1.6, 2.6), TN(-2.4, 3.6), T(6.6, 3.6), T(6.8, 2.8)], 0.8));
  }
  if (kit.pack) {
    const back: Pt[] = kit.gear === 'us' ? [TN(-0.8, -2.4), TN(-1.2, -5.6), T(5.2, -5.8), T(4.6, -2.8)] : [TN(-1.8, -2.4), TN(-2.6, -5.4), T(4.6, -5.6), T(4, -2.6)];
    sk.add('backKit', blob(back, 0.7));
  }
}

function extra(sk: Sketch, pd: PoseDef, x: Extra | undefined, hand: Pt, rest: Pt) {
  const H = pd.hip;
  const N = pd.neck;
  const u = norm(sub(N, H));
  switch (x) {
    case 'panzerfaust':
      drawArm(sk, 'panzerfaust', place(...at(N, u, -3, -3.6), angleOf(u) - 8), true);
      break;
    case 'flamer': {
      sk.add('backKit', capsule(at(N, u, -1.8, -4.2), at(H, u, 0.4, -4.4), 2));
      sk.add('backKit', capsule(at(N, u, -1.6, -7.4), at(H, u, 0.8, -7.2), 2));
      sk.add('backMetal', capsule(at(N, u, -0.6, -5.8), at(N, u, -2.6, -5.8), 1.2));
      sk.line([at(H, u, 0.4, -4.4), at(H, u, -1.8, -1), lerp(at(H, u, 0, 2), rest, 0.5)], 'ink');
      break;
    }
    case 'stick':
      stickGrenade(sk, place(hand[0], hand[1], -118));
      break;
    case 'bundle':
      bundleCharge(sk, place(hand[0], hand[1], -118));
      break;
    case 'pineapple':
      roundGrenade(sk, place(hand[0] - 0.6, hand[1] - 1.4, 0));
      break;
    case 'satchel':
      satchel(sk, place(rest[0] - 0.6, rest[1], 0));
      break;
    case 'ammo':
      ammoBox(sk, place(rest[0], rest[1], 0));
      break;
  }
}

/** Dress the pose in the kit and arm it; returns the figure's colour layers (cached). */
export function buildFigure(spec: FigureSpec): FlatFigure {
  const key = figureKey(spec);
  const hit = CACHE.get(key);
  if (hit) return hit;
  const pd = POSES[spec.pose];
  const kit = spec.kit;
  const sk = new Sketch();
  const H = pd.hip;
  const N = pd.neck;
  const u = norm(sub(N, H));

  // legs
  const hipN = at(H, u, 0, 0.8);
  const hipF = at(H, u, 0.2, -0.7);
  leg(sk, kit, hipF, pd.kneeF, pd.ankleF, pd.footF ?? 0, true);
  leg(sk, kit, hipN, pd.kneeN, pd.ankleN, pd.footN ?? 0, false);

  torso(sk, pd, kit);
  gear(sk, pd, kit);

  // weapon and hands
  const shN = at(N, u, -1.9, 0.5);
  const shF = pd.shoulderF ? at(N, u, pd.shoulderF[0], pd.shoulderF[1]) : at(N, u, -1.6, -0.6);
  let handN: HandSpec | undefined = pd.near;
  let handF: HandSpec | undefined = pd.far;
  const hold = pd.hold;
  // the flag-bearer and the mine-sweeper carry their own weapon slung
  const special = spec.pose === 'flag' ? 'flag' : spec.pose === 'sweep' ? 'detector' : null;
  const held: Arm = special ?? spec.arm;
  if (hold && held !== 'none') {
    const m = place(hold.grip[0], hold.grip[1], hold.angle);
    drawArm(sk, held, m, hold.back);
    const fore = foreOf(held, m);
    const gripHand = hold.atFore ? fore : hold.grip;
    if ((hold.by ?? 'near') === 'near') {
      handN = handN ?? { hand: gripHand };
      if (!hold.atFore && held !== 'pistol') handF = handF ?? { hand: fore };
    } else {
      handF = handF ?? { hand: gripHand };
    }
    if (held === 'detector') {
      const tip = foreOf(held, mul(m, place(7.4, 0)));
      sk.add('metal', ellipse(tip[0] + 0.8, tip[1] + 0.5, 3.1, 0.85));
    }
    if (spec.pose === 'prone' && (held === 'mg42' || held === 'dp' || held === 'bar')) {
      const b = foreOf(held, mul(m, place(held === 'mg42' ? 3.4 : 5, 0)));
      sk.add('metal', [capsule(b, [b[0] - 1.6, 0], 0.32), capsule(b, [b[0] + 1.4, 0], 0.32)]);
    }
  }
  // a weapon that is not in the hands is slung on the back
  const slung: Arm = special ? spec.arm : hold ? 'none' : spec.arm;
  if (pd.sling && slung !== 'none') drawArm(sk, slung, place(pd.sling.grip[0], pd.sling.grip[1], pd.sling.angle), true);
  handN = handN ?? { hand: at(H, u, 0.4, 2.6) };
  handF = handF ?? { hand: at(H, u, 0.6, -2.4) };
  arm(sk, shF, handF, true);
  arm(sk, shN, handN, false);
  if (spec.pose === 'point') {
    const d = norm(sub(handN.hand, shN));
    sk.add('skin', capsule(handN.hand, add(handN.hand, [d[0] * 2, d[1] * 2]), 0.5));
  }
  if (spec.pose === 'binos') binoculars(sk, place(pd.head[0] + 3.3, pd.head[1] - 0.3, 0));
  extra(sk, pd, spec.extra, handN.hand, handF.hand);

  // head on top
  const neckTop = lerp(N, pd.head, 0.55);
  sk.add('skin', capsule(N, neckTop, 1.55));
  sk.add('coat', capsule(at(N, u, -0.6, -0.4), at(N, u, 0.4, 0.6), 1.7));
  const tilt = (pd.headTilt ?? 0) + (angleOf(u) + 90) * 0.35;
  drawHead(sk, place(pd.head[0], pd.head[1], tilt), kit.hat, { stripe: kit.stripe });
  const out = flatten(sk);
  CACHE.set(key, out);
  return out;
}

const CACHE = new Map<string, FlatFigure>();

export function figureKey(spec: FigureSpec): string {
  const k = spec.kit;
  return [spec.pose, spec.arm, spec.extra ?? '', k.hat, k.coat, k.legwear, k.gear, k.camo ?? '', k.cuirass ? 'c' : '', k.pack ? 'p' : '', k.stripe ?? ''].join('|');
}
