// Original vector silhouettes for the counters: soldiers (helmet shape per nation) in a few poses, and the support
// weapons. Every figure is drawn in its own frame, facing right: soldiers stand with their feet on y = 0 and are about
// 40 units tall; weapons are centred on (0, 0) and about 64 units long. A figure is drawn twice: first as a halo in the
// counter colour (so overlapping figures stay apart), then in ink.
import type { ReactNode } from 'react';
import type { CounterType, Nation } from '../engine/types';
import { INK } from './palette';

export type Pose = 'advance' | 'stride' | 'aim' | 'kneel' | 'flee' | 'leader' | 'hero' | 'carry';
export type Gun = 'rifle' | 'smg' | 'pistol' | 'mg' | 'none';

interface Paint {
  ink: string;
  /** Halo width added around every shape (0 for the ink pass). */
  halo: number;
}

const r1 = (n: number) => Math.round(n * 100) / 100;

function Limb({ d, w, p }: { d: string; w: number; p: Paint }) {
  return <path d={d} fill="none" stroke={p.ink} strokeWidth={w + p.halo * 2} strokeLinecap="round" strokeLinejoin="round" />;
}

function Shape({ d, p }: { d: string; p: Paint }) {
  return <path d={d} fill={p.ink} stroke={p.halo ? p.ink : 'none'} strokeWidth={p.halo * 2} strokeLinejoin="round" />;
}

// ---------------------------------------------------------------------------------------------------------------------
// Helmets (head centre at 0,0, head radius 3.1, facing right)

/** German: deep coal-scuttle with a short front visor and the skirt flaring out over the neck at the back. */
const HELMET_DE =
  'M4.2 -0.2 L3.3 -1.3 C3.1 -5.2 -2.9 -6.1 -3.7 -1.7 L-3.8 0.4 L-5.4 2.6 L-3.4 2.4 L-2.3 0.3 L1.2 -0.3 Z';
/** American: low round bowl with a straight rim standing out a little all round. */
const HELMET_US = 'M4.7 -0.1 L3.9 -0.9 C3.7 -5.5 -3.7 -5.5 -3.9 -0.9 L-4.7 -0.1 L-4.6 0.5 L4.6 0.5 Z';
/** Russian: taller bowl with a short skirt that slopes down front and back. */
const HELMET_RU = 'M4.5 1.2 L3.5 -0.7 C3.6 -6.4 -3.6 -6.4 -3.5 -0.7 L-4.5 1.2 L-3.4 1.0 L-2.6 -0.3 L2.6 -0.3 L3.4 1.0 Z';

const HELMETS: Record<Nation, string> = { German: HELMET_DE, American: HELMET_US, Russian: HELMET_RU };

function Head({ x, y, nation, p }: { x: number; y: number; nation: Nation; p: Paint }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={3.1 + p.halo} fill={p.ink} />
      <Shape d={HELMETS[nation]} p={p} />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Small arms, drawn from butt (0,0) toward +x, then rotated into the hands

function Rifle({ x, y, a, nation, p, len = 19 }: { x: number; y: number; a: number; nation: Nation; p: Paint; len?: number }) {
  // stock, then the long fore-end; the Russian rifle carries its bayonet
  const bay = nation === 'Russian' ? 4.5 : 0;
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <Shape d="M0 -1.3 L5.5 -0.9 L6 0.6 L0.3 1.5 Z" p={p} />
      <Limb d={`M5 0 L${len} 0`} w={1.25} p={p} />
      {bay ? <Limb d={`M${len} 0 L${len + bay} 0`} w={0.55} p={p} /> : null}
    </g>
  );
}

function Smg({ x, y, a, nation, p }: { x: number; y: number; a: number; nation: Nation; p: Paint }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <Shape d="M0 -1.1 L4 -0.8 L4 0.9 L0.2 1.4 Z" p={p} />
      <Limb d="M3.5 0 L12.5 0" w={1.7} p={p} />
      {nation === 'Russian' ? (
        <circle cx={6.5} cy={2.4} r={2.3 + p.halo} fill={p.ink} />
      ) : (
        <Limb d="M7 0.5 L7.6 5" w={1.1} p={p} />
      )}
    </g>
  );
}

function Pistol({ x, y, a, p }: { x: number; y: number; a: number; p: Paint }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <Limb d="M0 0 L4.2 0 M0.4 0 L0 2.4" w={1.2} p={p} />
    </g>
  );
}

function SmallArm({ gun, x, y, a, nation, p }: { gun: Gun; x: number; y: number; a: number; nation: Nation; p: Paint }) {
  if (gun === 'rifle') return <Rifle x={x} y={y} a={a} nation={nation} p={p} />;
  if (gun === 'smg') return <Smg x={x} y={y} a={a} nation={nation} p={p} />;
  if (gun === 'pistol') return <Pistol x={x} y={y} a={a} p={p} />;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Bodies

function Pack({ x, y, p }: { x: number; y: number; p: Paint }) {
  return <Shape d={`M${x} ${y} l-2.6 0.6 l-0.4 6.4 l2.8 0.2 Z`} p={p} />;
}

function Torso({ d, p }: { d: string; p: Paint }) {
  return <Shape d={d} p={p} />;
}

const LEG = 3.5;
const ARM = 2.6;

function Body({ pose, gun, nation, p }: { pose: Pose; gun: Gun; nation: Nation; p: Paint }) {
  switch (pose) {
    case 'advance':
      // walking forward, rifle held across the body at the port, muzzle high
      return (
        <>
          <Limb d="M-1 -18 L-3.4 -9.6 L-6.6 -1 L-4.6 -0.6" w={LEG} p={p} />
          <Limb d="M1.4 -18 L5.2 -10 L6.4 -1 L8.6 -0.8" w={LEG} p={p} />
          <Pack x={-2.4} y={-29} p={p} />
          <Torso d="M-3.2 -29.6 L3.4 -30.4 L3.2 -18 L-2.8 -17.2 Z" p={p} />
          <Limb d="M-1.6 -28.4 L-0.6 -22.4 L3.4 -21.2" w={ARM} p={p} />
          <SmallArm gun={gun} x={-0.8} y={-17.6} a={-48} nation={nation} p={p} />
          <Limb d="M2.4 -28.6 L6.2 -24.6 L8.6 -27.2" w={ARM} p={p} />
          <Head x={1.6} y={-34} nation={nation} p={p} />
        </>
      );
    case 'stride':
      // a longer step, leaning in, weapon levelled at the hip
      return (
        <>
          <Limb d="M-1.4 -17.4 L-5.4 -9.8 L-9.6 -3.4 L-9.4 -1" w={LEG} p={p} />
          <Limb d="M1.2 -17.6 L6.8 -11.4 L7.8 -1 L10 -0.8" w={LEG} p={p} />
          <Pack x={-1.4} y={-28.6} p={p} />
          <Torso d="M-2.2 -29.2 L4.4 -29.8 L3 -17.6 L-3 -16.8 Z" p={p} />
          <Limb d="M-0.4 -28 L1 -21.6 L5 -20.8" w={ARM} p={p} />
          <SmallArm gun={gun} x={-1} y={-20.6} a={-12} nation={nation} p={p} />
          <Limb d="M3.4 -28.2 L7.4 -23.6 L10.4 -22.6" w={ARM} p={p} />
          <Head x={3} y={-33.4} nation={nation} p={p} />
        </>
      );
    case 'aim':
      // standing, weapon shouldered and aimed level
      return (
        <>
          <Limb d="M-1.2 -18 L-3.6 -9.4 L-5 -1 L-2.8 -0.8" w={LEG} p={p} />
          <Limb d="M1.2 -18 L3.2 -9.4 L4.4 -1 L6.6 -0.8" w={LEG} p={p} />
          <Pack x={-2.6} y={-29.2} p={p} />
          <Torso d="M-3.2 -29.8 L3.2 -30.2 L2.6 -18 L-3 -17.6 Z" p={p} />
          <SmallArm gun={gun} x={-0.4} y={-28.4} a={-2} nation={nation} p={p} />
          <Limb d="M1.6 -28.6 L2.4 -26 L4 -27.6" w={ARM} p={p} />
          <Limb d="M2.4 -28.8 L7.4 -26.2 L9.6 -28.4" w={ARM} p={p} />
          <Head x={2} y={-34} nation={nation} p={p} />
        </>
      );
    case 'kneel':
      // kneeling, weapon shouldered
      return (
        <>
          <Limb d="M-1.6 -11.2 L-1.4 -1.4 L-8.2 -1.2" w={LEG} p={p} />
          <Limb d="M0.8 -11.2 L7 -11.8 L7.6 -1 L9.8 -0.8" w={LEG} p={p} />
          <Pack x={-2.8} y={-22.6} p={p} />
          <Torso d="M-3.4 -23 L3 -23.6 L2.2 -11 L-3.4 -10.6 Z" p={p} />
          <SmallArm gun={gun} x={-0.6} y={-21.8} a={-3} nation={nation} p={p} />
          <Limb d="M2.2 -22.2 L7.2 -18.8 L9.6 -21.6" w={ARM} p={p} />
          <Head x={2.2} y={-27.4} nation={nation} p={p} />
        </>
      );
    case 'flee':
      // running away (facing left), crouched, weapon trailing low
      return (
        <>
          <Limb d="M1.6 -15.6 L5.6 -8.6 L9.4 -3.4 L9.6 -1" w={LEG} p={p} />
          <Limb d="M-0.6 -15.8 L-5.4 -10.4 L-6.2 -1 L-8.4 -0.8" w={LEG} p={p} />
          <Pack x={4.8} y={-25} p={p} />
          <Torso d="M3.6 -26.8 L-3 -24.4 L-1.6 -15.8 L3.4 -16 Z" p={p} />
          <SmallArm gun={gun} x={8.6} y={-12} a={196} nation={nation} p={p} />
          <Limb d="M1.2 -25 L5 -20 L7.6 -15.4" w={ARM} p={p} />
          <Limb d="M-1.4 -24.6 L-4.6 -27.8 L-5.6 -31.6" w={ARM} p={p} />
          <Head x={-2.8} y={-28.6} nation={nation} p={p} />
        </>
      );
    case 'leader':
      // standing, arm thrown forward to point the way, pistol in the other hand
      return (
        <>
          <Limb d="M-1.2 -18 L-3.4 -9.2 L-5.4 -1 L-3.2 -0.8" w={LEG} p={p} />
          <Limb d="M1.2 -18 L3.4 -9.4 L4.2 -1 L6.4 -0.8" w={LEG} p={p} />
          <Torso d="M-3.2 -29.8 L3.2 -30.2 L2.8 -18 L-3 -17.6 Z" p={p} />
          <Shape d="M-3.6 -19.6 l-2.6 0.4 l0.2 4.4 l2.6 -0.4 Z" p={p} />
          <Limb d="M-1.6 -28.6 L-4 -22.6 L-1.4 -19.8" w={ARM} p={p} />
          <SmallArm gun={gun} x={-1.6} y={-19.6} a={20} nation={nation} p={p} />
          <Limb d="M2.4 -28.8 L7.4 -31 L12.2 -33.8" w={ARM} p={p} />
          <Head x={1} y={-34.2} nation={nation} p={p} />
        </>
      );
    case 'hero':
      // charging, one arm raised high with the weapon, waving the others on
      return (
        <>
          <Limb d="M-1.4 -17.4 L-5.6 -10 L-10 -4 L-9.8 -1.2" w={LEG} p={p} />
          <Limb d="M1.2 -17.6 L7.2 -12 L8 -1 L10.2 -0.8" w={LEG} p={p} />
          <Torso d="M-2.2 -29.4 L4.4 -30 L3 -17.6 L-3 -16.8 Z" p={p} />
          <Limb d="M-0.6 -28.4 L-2.2 -35.4 L-0.4 -41.6" w={ARM} p={p} />
          <SmallArm gun={gun} x={-4.6} y={-40.8} a={-8} nation={nation} p={p} />
          <Limb d="M3.4 -28.6 L8.2 -26.2 L12 -28.6" w={ARM} p={p} />
          <Head x={3} y={-33.8} nation={nation} p={p} />
        </>
      );
    case 'carry':
      // walking with a support weapon carried on the shoulder
      return (
        <>
          <Limb d="M-1 -18 L-3.4 -9.6 L-6.6 -1 L-4.6 -0.6" w={LEG} p={p} />
          <Limb d="M1.4 -18 L5.2 -10 L6.4 -1 L8.6 -0.8" w={LEG} p={p} />
          <Torso d="M-3.2 -29.6 L3.4 -30.4 L3.2 -18 L-2.8 -17.2 Z" p={p} />
          <Limb d="M-11 -31.6 L13 -32.8" w={2.4} p={p} />
          <Shape d="M-6 -33.8 L2 -34.2 L2 -30.6 L-6 -30.2 Z" p={p} />
          <Limb d="M-1.6 -28.6 L-3 -24 L-1 -21" w={ARM} p={p} />
          <Limb d="M2.4 -28.6 L5.4 -29.8 L4.8 -32" w={ARM} p={p} />
          <Head x={1.4} y={-36.4} nation={nation} p={p} />
        </>
      );
  }
}

/** One soldier, feet at (x, y), scale s; `flip` mirrors it (facing left). */
export function Soldier({
  x,
  y,
  s = 1,
  pose,
  gun = 'rifle',
  nation,
  ink,
  halo,
  flip = false,
}: {
  x: number;
  y: number;
  s?: number;
  pose: Pose;
  gun?: Gun;
  nation: Nation;
  ink: string;
  /** Halo colour (the counter colour), or null for none. */
  halo: string | null;
  flip?: boolean;
}) {
  const t = `translate(${r1(x)} ${r1(y)}) scale(${flip ? -s : s} ${s})`;
  return (
    <g transform={t}>
      {halo ? (
        <g opacity={0.9}>
          <Body pose={pose} gun={gun} nation={nation} p={{ ink: halo, halo: 0.9 }} />
        </g>
      ) : null}
      <Body pose={pose} gun={gun} nation={nation} p={{ ink, halo: 0 }} />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Figure groups for unit counters

export interface FigureSlot {
  x: number;
  y: number;
  s: number;
  pose: Pose;
  gun: Gun;
}

/** Which small arm the unit's men carry, from its name (SMG squads, assault troops, paratroopers). */
export function unitGun(type: CounterType): Gun {
  const n = type.name.toLowerCase();
  if (/smg|assault|sturm/.test(n)) return 'smg';
  return 'rifle';
}

/** The figures of a counter, back rank first. Feet sit on y = 0 of the figure area (the counter puts it in place). */
export function figureSlots(type: CounterType, broken: boolean): FigureSlot[] {
  const gun = unitGun(type);
  const other: Gun = gun === 'smg' ? 'rifle' : 'smg';
  const flee = (x: number, y: number, s: number, g: Gun = gun): FigureSlot => ({ x, y, s, pose: 'flee', gun: g });
  if (type.kind === 'squad') {
    if (broken)
      return [flee(-22, -4, 0.92), flee(3, -4.5, 0.92), flee(-10, 0, 1), flee(17, 0, 1, other)];
    return [
      { x: -22, y: -4.5, s: 0.9, pose: 'advance', gun },
      { x: 3, y: -5, s: 0.9, pose: 'aim', gun },
      { x: -11, y: 0, s: 1, pose: 'stride', gun },
      { x: 15, y: 0, s: 1, pose: 'kneel', gun: other },
    ];
  }
  if (type.kind === 'team') {
    const weapons = /weapon/i.test(type.name);
    if (broken) return [flee(-9, -3, 0.98), flee(9, 0, 1.04)];
    if (weapons)
      return [
        { x: -8, y: -2, s: 1.04, pose: 'carry', gun: 'none' },
        { x: 10, y: 0, s: 1.06, pose: 'stride', gun: 'rifle' },
      ];
    return [
      { x: -9, y: -3, s: 1, pose: 'advance', gun },
      { x: 9, y: 0, s: 1.06, pose: 'kneel', gun: other },
    ];
  }
  // leaders and heroes: one larger figure
  if (broken) return [flee(4, 0, 1.12, 'pistol')];
  if (type.hero) return [{ x: 2, y: 0, s: 1.08, pose: 'hero', gun: 'smg' }];
  return [{ x: 2, y: 0, s: 1.14, pose: 'leader', gun: 'pistol' }];
}

// ---------------------------------------------------------------------------------------------------------------------
// Support weapons (centred on 0,0, about 64 long, facing right)

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

/** The silhouette a weapon or radio counter shows, from its name (and weapon class as a fallback). */
export function weaponArt(type: CounterType): WeaponArt {
  const n = type.name.toLowerCase();
  if (type.kind === 'radio' || /radio/.test(n)) return 'radio';
  if (/\.50|50 ?cal/.test(n)) return 'hmg50';
  if (/hmg|heavy machine/.test(n)) return 'hmg';
  if (/mmg|medium machine/.test(n)) return 'mmg';
  if (/lmg|light machine/.test(n)) return 'lmg';
  if (/medium mortar/.test(n)) return 'mediumMortar';
  if (/mortar/.test(n)) return 'lightMortar';
  if (/flame/.test(n)) return 'flamethrower';
  if (/satchel/.test(n)) return 'satchel';
  if (/panzerfaust|bazooka|faust/.test(n)) return 'panzerfaust';
  if (/molotov/.test(n)) return 'molotov';
  if (/ig ?33|150|heavy/.test(n)) return 'heavyGun';
  if (/gun|howitzer|ig ?18/.test(n)) return 'gun';
  switch (type.weaponClass) {
    case 'mg':
      return 'lmg';
    case 'mortar':
      return 'lightMortar';
    case 'flamethrower':
      return 'flamethrower';
    case 'satchel':
      return 'satchel';
    case 'gun':
      return 'gun';
    default:
      return 'lmg';
  }
}

function Wheel({ x, y, r, ink, bg }: { x: number; y: number; r: number; ink: string; bg: string }) {
  const spokes: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    spokes.push(`M${r1(x)} ${r1(y)} L${r1(x + Math.cos(a) * (r - 1.6))} ${r1(y + Math.sin(a) * (r - 1.6))}`);
  }
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={ink} />
      <circle cx={x} cy={y} r={r - 1.9} fill={bg} />
      <path d={spokes.join('')} stroke={ink} strokeWidth={1.3} />
      <circle cx={x} cy={y} r={1.8} fill={ink} />
    </g>
  );
}

/** A machine gun body from the butt at x0 to the muzzle at x1 (y = 0 is the bore line). */
function MgBody({ x0, x1, jacket, ink, bg, drum, heavy }: { x0: number; x1: number; jacket: 'vented' | 'water' | 'thick'; ink: string; bg: string; drum?: boolean; heavy?: boolean }) {
  const rcv = x0 + (heavy ? 6 : 9);
  const rcvEnd = rcv + (heavy ? 16 : 15);
  const holes: ReactNode[] = [];
  if (jacket === 'vented') {
    for (let x = rcvEnd + 3; x < x1 - 7; x += 4.2) holes.push(<rect key={x} x={x} y={-1.2} width={2} height={2.4} rx={0.6} fill={bg} />);
  }
  return (
    <g>
      {heavy ? (
        // spade grips at the back
        <path d={`M${x0} -4 L${x0 + 3} -4 L${x0 + 6} -1.5 L${x0 + 6} 1.5 L${x0 + 3} 4 L${x0} 4`} fill="none" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      ) : (
        <path d={`M${x0} -2.4 L${rcv} -3.2 L${rcv} 2.8 L${x0 + 2} 5.2 L${x0} 4.8 Z`} fill={ink} />
      )}
      <rect x={rcv} y={-4.6} width={rcvEnd - rcv} height={8} rx={1} fill={ink} />
      <path d={`M${rcv + 4} 3 l-1.4 5.2 l2.6 0 l1.2 -5.2 Z`} fill={ink} />
      {jacket === 'water' ? (
        <rect x={rcvEnd - 0.5} y={-4.2} width={x1 - rcvEnd - 6} height={7.6} rx={2.4} fill={ink} />
      ) : jacket === 'thick' ? (
        <rect x={rcvEnd - 0.5} y={-2.6} width={x1 - rcvEnd - 4} height={4.6} rx={1.4} fill={ink} />
      ) : (
        <rect x={rcvEnd - 0.5} y={-2.8} width={x1 - rcvEnd - 6} height={5.2} rx={1.2} fill={ink} />
      )}
      {holes}
      <rect x={x1 - 7} y={-1.2} width={7} height={2.4} fill={ink} />
      <rect x={x1 - 2.4} y={-2.2} width={2.4} height={4.4} rx={0.6} fill={ink} />
      {drum ? <ellipse cx={rcv + 7} cy={-6.2} rx={8} ry={2} fill={ink} /> : <rect x={rcv + 3} y={-7.2} width={2} height={3} fill={ink} />}
    </g>
  );
}

function Tripod({ x, y, h, spread, ink }: { x: number; y: number; h: number; spread: number; ink: string }) {
  return (
    <path
      d={`M${x} ${y} L${x - spread} ${y + h} M${x} ${y} L${x + spread * 0.9} ${y + h} M${x} ${y} L${x - spread * 0.25} ${y + h * 1.05}`}
      stroke={ink}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />
  );
}

/** A support weapon silhouette centred on (x, y), scale s. */
export function WeaponSilhouette({ art, nation, x, y, s = 1, ink, bg }: { art: WeaponArt; nation: Nation; x: number; y: number; s?: number; ink: string; bg: string }) {
  return <g transform={`translate(${r1(x)} ${r1(y)}) scale(${s})`}>{weaponBody(art, nation, ink, bg)}</g>;
}

function weaponBody(art: WeaponArt, nation: Nation, ink: string, bg: string): ReactNode {
  switch (art) {
    case 'lmg':
      // bipod light machine gun; the Russian one carries its flat pan magazine on top
      return (
        <g transform="translate(0 -2)">
          <MgBody x0={-31} x1={31} jacket="vented" ink={ink} bg={bg} drum={nation === 'Russian'} />
          <path d="M19 1 L13 13 M19 1 L24 13" stroke={ink} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      );
    case 'mmg':
      return (
        <g transform="translate(0 -5)">
          {nation === 'Russian' ? (
            <>
              <MgBody x0={-28} x1={31} jacket="water" ink={ink} bg={bg} />
              <path d="M-4 3 L-4 9 L14 9" stroke={ink} strokeWidth={2.2} fill="none" />
              <path d="M-20 13 L18 9" stroke={ink} strokeWidth={2} strokeLinecap="round" />
              <Wheel x={6} y={14} r={6} ink={ink} bg={bg} />
            </>
          ) : (
            <>
              <MgBody x0={-30} x1={31} jacket="vented" ink={ink} bg={bg} />
              <Tripod x={-6} y={3} h={13} spread={14} ink={ink} />
            </>
          )}
        </g>
      );
    case 'hmg':
      if (nation === 'Russian')
        // wheeled water-cooled gun with a shield
        return (
          <g transform="translate(0 -6)">
            <MgBody x0={-26} x1={32} jacket="water" ink={ink} bg={bg} heavy />
            <path d="M-8 -12 L2 -13 L3 4 L-8 5 Z" fill={ink} />
            <path d="M-30 17 L4 12" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
            <Wheel x={-4} y={15} r={6.5} ink={ink} bg={bg} />
          </g>
        );
      return (
        <g transform="translate(0 -6)">
          <MgBody x0={-30} x1={32} jacket={nation === 'American' ? 'water' : 'vented'} ink={ink} bg={bg} />
          <Tripod x={-4} y={3} h={16} spread={20} ink={ink} />
        </g>
      );
    case 'hmg50':
      return (
        <g transform="translate(0 -8)">
          <MgBody x0={-30} x1={33} jacket="thick" ink={ink} bg={bg} heavy />
          <rect x={-18} y={-11} width={8} height={5} fill={ink} />
          <path d="M-6 3 L-6 9" stroke={ink} strokeWidth={2.4} />
          <Tripod x={-6} y={9} h={13} spread={20} ink={ink} />
        </g>
      );
    case 'lightMortar':
      return (
        <g transform="translate(-2 2)">
          <path d="M-16 13 L4 13 L2 10 L-14 10 Z" fill={ink} />
          <g transform="translate(-7 10) rotate(-58)">
            <rect x={0} y={-2.4} width={26} height={4.8} rx={1} fill={ink} />
            <rect x={23} y={-3.2} width={3.4} height={6.4} rx={0.8} fill={ink} />
          </g>
          <path d="M2 -6 L10 13 M2 -6 L4 13" stroke={ink} strokeWidth={1.7} strokeLinecap="round" />
          <path d="M3 3 L8 3" stroke={ink} strokeWidth={1.4} />
        </g>
      );
    case 'mediumMortar':
      return (
        <g transform="translate(-4 4)">
          <path d="M-22 13 L4 13 L1 9 L-19 9 Z" fill={ink} />
          <g transform="translate(-10 10) rotate(-56)">
            <rect x={0} y={-3.2} width={36} height={6.4} rx={1.2} fill={ink} />
            <rect x={32.5} y={-4.2} width={4} height={8.4} rx={1} fill={ink} />
          </g>
          <path d="M6 -13 L18 13 M6 -13 L9 13" stroke={ink} strokeWidth={2} strokeLinecap="round" />
          <path d="M8 -1 L15 -1" stroke={ink} strokeWidth={1.6} />
          <circle cx={12} cy={-1} r={2.2} fill={ink} />
        </g>
      );
    case 'gun':
    case 'heavyGun': {
      // small field piece: trail on the ground, spoked wheel, shield, barrel; the heavy one is bigger and stubbier
      const big = art === 'heavyGun';
      const g = 15;
      const wr = big ? 11 : 9.5;
      const ay = g - wr;
      return (
        <g>
          <path d={`M-33 ${g} L-4 ${ay - 1}`} stroke={ink} strokeWidth={3.4} strokeLinecap="round" />
          <path d={`M-34 ${g - 3} L-32 ${g + 1}`} stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
          <Wheel x={0} y={ay} r={wr} ink={ink} bg={bg} />
          <path d={`M-9 ${ay - 6} L9 ${ay - 6} L11 ${ay - 1} L-9 ${ay} Z`} fill={ink} />
          <rect x={4} y={ay - (big ? 11.5 : 9.6)} width={big ? 24 : 29} height={big ? 6.4 : 4.4} rx={1.2} fill={ink} />
          {big ? <rect x={26} y={ay - 12.4} width={4} height={8.2} rx={1} fill={ink} /> : <rect x={31.5} y={ay - 10.4} width={3} height={6} rx={0.8} fill={ink} />}
          <path d={`M-5 ${ay - 25} L3 ${ay - 26} L4 ${ay - 4} L-4 ${ay - 3} Z`} fill={ink} />
        </g>
      );
    }
    case 'flamethrower':
      return (
        <g>
          <rect x={-30} y={-14} width={8.5} height={26} rx={4.2} fill={ink} />
          <rect x={-20.5} y={-14} width={8.5} height={26} rx={4.2} fill={ink} />
          <circle cx={-16.2} cy={-15.2} r={3.4} fill={ink} />
          <path d="M-16 12 C-12 20 -2 18 2 8" stroke={ink} strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <path d="M-2 4 L22 -2" stroke={ink} strokeWidth={3.2} strokeLinecap="round" />
          <path d="M4 3 L4 9 M12 1 L12 6" stroke={ink} strokeWidth={2} strokeLinecap="round" />
          <path d="M23 -3 C28 -8 30 -2 35 -6 C33 0 38 1 34 4 C30 5 27 3 23 1 Z" fill={INK.suppressed} />
          <path d="M23.5 -1.6 C27 -4 29 -1 31.5 -2.6 C30.5 0.4 28 1.2 24 0.6 Z" fill="#f8d35a" />
        </g>
      );
    case 'satchel':
      return (
        <g transform="translate(-2 2)">
          <path d="M-12 -10 C-12 -20 10 -20 10 -10" stroke={ink} strokeWidth={2.4} fill="none" />
          <rect x={-18} y={-10} width={34} height={22} rx={3} fill={ink} />
          <path d="M-18 -4 L16 -4 L12 3 L-14 3 Z" fill={bg} opacity={0.35} />
          <rect x={-5} y={-1} width={6} height={5} rx={1} fill={bg} opacity={0.55} />
          <path d="M16 6 C22 6 22 -2 26 -4" stroke={ink} strokeWidth={1.4} fill="none" />
          <path d="M26 -4 l2.4 -3 l0.4 2.6 l2.8 -0.8 l-2 2.4 l2.6 1.4 l-3 0.4 l0.2 2.8 l-1.8 -2.2 Z" fill={INK.suppressed} />
        </g>
      );
    case 'panzerfaust':
      return (
        <g transform="rotate(-8)">
          <rect x={-30} y={-1.8} width={42} height={3.6} rx={1.2} fill={ink} />
          <path d="M10 -5.6 C20 -7.4 26 -4 33 0 C26 4 20 7.4 10 5.6 Z" fill={ink} />
          <path d="M-6 -1.8 L-6 -6.4 L-3.6 -6.4 L-3.6 -1.8" fill={ink} />
          <rect x={-14} y={1.6} width={3} height={5} fill={ink} />
        </g>
      );
    case 'molotov':
      return (
        <g transform="rotate(16)">
          <path d="M-8 -6 L-8 14 C-8 17 8 17 8 14 L8 -6 C8 -10 3 -11 3 -14 L3 -19 L-3 -19 L-3 -14 C-3 -11 -8 -10 -8 -6 Z" fill={ink} />
          <path d="M-2 -19 C-5 -24 -1 -25 -2 -29 C2 -26 3 -24 1 -19 Z" fill={INK.paper} />
          <path d="M-1 -27 C-6 -33 0 -36 -1 -41 C4 -37 7 -33 3 -27 Z" fill={INK.suppressed} />
          <path d="M0 -28 C-2 -31 1 -33 0 -36 C3 -33 4 -31 2 -28 Z" fill="#f8d35a" />
        </g>
      );
    case 'radio':
      return (
        <g transform="translate(-4 4)">
          <rect x={-16} y={-10} width={26} height={22} rx={2} fill={ink} />
          <rect x={-12} y={-6} width={8} height={5} rx={1} fill={bg} opacity={0.6} />
          <circle cx={3} cy={-3.5} r={2.6} fill={bg} opacity={0.6} />
          <circle cx={-8} cy={5} r={1.8} fill={bg} opacity={0.6} />
          <circle cx={-1} cy={5} r={1.8} fill={bg} opacity={0.6} />
          <path d="M6 -10 C10 -22 18 -30 30 -36" stroke={ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <circle cx={30} cy={-36} r={1.6} fill={ink} />
          <path d="M10 6 C18 8 20 14 26 12" stroke={ink} strokeWidth={1.3} fill="none" />
          <path d="M23 9 C25 6 30 8 30 11 C30 14 26 16 24 14 Z" fill={ink} />
        </g>
      );
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Rank insignia (centred on 0,0)

export function RankInsignia({ rank, ink, x, y, s = 1 }: { rank: string | undefined; ink: string; x: number; y: number; s?: number }) {
  const r = (rank ?? '').toLowerCase();
  const chevron = (dy: number) => <path key={dy} d={`M-5 ${dy + 2.6} L0 ${dy - 1} L5 ${dy + 2.6}`} fill="none" stroke={ink} strokeWidth={1.9} strokeLinejoin="miter" />;
  let body: ReactNode = null;
  if (r.startsWith('pv')) body = chevron(0);
  else if (r.startsWith('cp') && r !== 'cpt') body = [chevron(-2.2), chevron(2.2)];
  else if (r.startsWith('sg')) body = [chevron(-4.2), chevron(0), chevron(4.2)];
  else if (r.startsWith('lt')) body = <rect x={-1.6} y={-5} width={3.2} height={10} rx={0.6} fill={ink} />;
  else if (r.startsWith('cpt') || r.startsWith('capt'))
    body = (
      <>
        <rect x={-4} y={-5} width={3} height={10} rx={0.6} fill={ink} />
        <rect x={1} y={-5} width={3} height={10} rx={0.6} fill={ink} />
      </>
    );
  else if (r.startsWith('maj')) body = <path d="M0 -5.5 L4.5 0 L0 5.5 L-4.5 0 Z" fill={ink} />;
  if (!body) return null;
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{body}</g>;
}

/** Five-pointed star centred on (x, y) with outer radius r. */
export function starPath(x: number, y: number, r: number, inner = 0.42): string {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * inner;
    pts.push(`${r1(x + Math.cos(a) * rr)} ${r1(y + Math.sin(a) * rr)}`);
  }
  return `M${pts.join(' L')} Z`;
}
