// Marker counters: fortifications, Smoke, Blaze, Suppressed, Veteran, the Spotting Round, objective control, and the
// track markers (VP, Time, Sudden Death, the Initiative card). Same 100-unit frame and cardboard plate as the unit
// counters; `Marker` is a standalone <svg> of `size` px, `MarkerG` draws it inside another SVG centred on (x, y).
import type { ReactNode } from 'react';
import type { FortKind, Nation, Side } from '../engine/types';
import { Plate } from './Counter';
import { FONT, INK, NATION, SIDE_NATION, darken, lighten } from './palette';
import { starPath } from './silhouettes';
import { fit } from './text';

export type MarkerKind =
  | FortKind
  | 'smoke'
  | 'blaze'
  | 'suppressed'
  | 'veteran'
  | 'spottingRound'
  | 'objective'
  | 'vp'
  | 'time'
  | 'suddenDeath'
  | 'initiative';

export const MARKER_KINDS: readonly MarkerKind[] = [
  'foxholes',
  'trench',
  'pillbox',
  'bunker',
  'wire',
  'mines',
  'smoke',
  'blaze',
  'suppressed',
  'veteran',
  'spottingRound',
  'objective',
  'vp',
  'time',
  'suddenDeath',
  'initiative',
];

export interface MarkerProps {
  kind: MarkerKind;
  /** Mines: strength 6 / 7 / 8 (default 6). Smoke: hindrance 1..10 (default 1). VP: the total shown (optional). */
  value?: number;
  /** Objective control: whose marker (or give `side`). */
  nation?: Nation;
  side?: Side;
  size?: number;
  selected?: boolean;
  dim?: boolean;
}

const PAD = 6;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cover printed on each fortification (alternate Cover, +1 against Mortars and Artillery). */
export const FORT_COVER: Partial<Record<MarkerKind, number>> = { foxholes: 3, trench: 4, pillbox: 5, bunker: 6 };

const NAMES: Record<MarkerKind, string> = {
  foxholes: 'Foxholes',
  trench: 'Trench',
  pillbox: 'Pillbox',
  bunker: 'Bunker',
  wire: 'Wire',
  mines: 'Mines',
  smoke: 'Smoke',
  blaze: 'Blaze',
  suppressed: 'Suppressed',
  veteran: 'Veteran',
  spottingRound: 'Spotting Round',
  objective: 'Objective control',
  vp: 'Victory Points',
  time: 'Time',
  suddenDeath: 'Sudden Death',
  initiative: 'Initiative',
};

/** "Smoke 4", "Mines 7 FP", "Foxholes". */
export function markerLabel(kind: MarkerKind, value?: number, nation?: Nation): string {
  if (kind === 'smoke') return `Smoke ${value ?? 1}`;
  if (kind === 'mines') return `Mines ${value ?? 6} FP`;
  if (kind === 'objective') return `${nation ?? ''} control`.trim();
  if (kind === 'vp' && value !== undefined) return `VP ${value}`;
  return NAMES[kind];
}

export function Marker({ size = 48, ...p }: MarkerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-PAD} ${-PAD} ${100 + 2 * PAD} ${100 + 2 * PAD}`}
      role="img"
      aria-label={markerLabel(p.kind, p.value, p.nation ?? (p.side ? SIDE_NATION[p.side] : undefined))}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <MarkerBody {...p} />
    </svg>
  );
}

/** The marker inside an SVG, centred on (x, y), `size` units wide. */
export function MarkerG({ x, y, size = 48, ...p }: MarkerProps & { x: number; y: number }) {
  const k = size / 100;
  return (
    <g transform={`translate(${r2(x - size / 2)} ${r2(y - size / 2)}) scale(${r2(k * 1000) / 1000})`}>
      <MarkerBody {...p} />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------------

interface Look {
  fill: string;
  light: string;
  dark: string;
  ink: string;
}

const CARDBOARD: Look = { fill: '#cfc298', light: '#ece2bf', dark: '#7f7049', ink: '#2b2418' };
const look = (fill: string, ink: string): Look => ({ fill, light: lighten(fill, 0.45), dark: darken(fill, 0.4), ink });

function Title({ text, ink, y = 18, size = 14, x = 50, max = 86 }: { text: string; ink: string; y?: number; size?: number; x?: number; max?: number }) {
  return (
    <text x={x} y={y} fontFamily={FONT.title} fontWeight={600} fontSize={size} fill={ink} textAnchor="middle" letterSpacing={0.6} {...fit(text, size, max, 'title', 0.6)}>
      {text}
    </text>
  );
}

function Big({ v, x, y, size, ink, anchor = 'middle' }: { v: string | number; x: number; y: number; size: number; ink: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} fontFamily={FONT.title} fontWeight={600} fontSize={size} fill={ink} textAnchor={anchor}>
      {v}
    </text>
  );
}

/** Cover value in a small shield, bottom right, with "COVER" beside it. */
function CoverBadge({ v, ink, paper }: { v: number; ink: string; paper: string }) {
  return (
    <g>
      <text x={8} y={91} fontFamily={FONT.title} fontWeight={600} fontSize={12} fill={ink} letterSpacing={0.6}>
        COVER
      </text>
      <path d="M66 70 L94 70 L94 82 C94 91 86 95 80 98 C74 95 66 91 66 82 Z" fill={ink} />
      <Big v={v} x={80} y={91} size={22} ink={paper} />
    </g>
  );
}

function Sandbags({ cx, cy, rx, ry, n, fill, edge }: { cx: number; cy: number; rx: number; ry: number; n: number; fill: string; edge: string }) {
  const out: ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    out.push(<ellipse key={k} cx={r2(x)} cy={r2(y)} rx={4.2} ry={2.8} transform={`rotate(${r2((a * 180) / Math.PI + 90)} ${r2(x)} ${r2(y)})`} fill={fill} stroke={edge} strokeWidth={0.9} />);
  }
  return <>{out}</>;
}

function Flames({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-24 18 C-30 4 -22 -6 -16 -14 C-15 -6 -10 -4 -8 -2 C-8 -14 -2 -24 6 -32 C6 -20 14 -14 16 -6 C18 -10 20 -14 20 -18 C28 -8 30 6 22 18 Z" fill="#e8582a" />
      <path d="M-16 18 C-20 8 -14 0 -10 -6 C-8 2 -4 2 -2 4 C-2 -6 2 -14 8 -20 C8 -10 14 -6 14 2 C16 0 18 -4 18 -6 C22 2 22 10 16 18 Z" fill="#f59a2e" />
      <path d="M-8 18 C-10 12 -6 6 -4 2 C-2 8 2 8 4 10 C4 4 6 -2 10 -6 C10 2 14 6 12 18 Z" fill="#fbd65a" />
    </g>
  );
}

function Cloud({ x, y, s, fill, edge }: { x: number; y: number; s: number; fill: string; edge: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-20 8 C-28 8 -28 -4 -20 -4 C-20 -14 -6 -16 -2 -8 C2 -18 18 -16 18 -4 C28 -4 28 8 20 8 Z"
      fill={fill}
      stroke={edge}
      strokeWidth={1.6 / s}
      strokeLinejoin="round"
    />
  );
}

function Hourglass({ x, y, ink, sand }: { x: number; y: number; ink: string; sand: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-15} y={-22} width={30} height={4} rx={1.5} fill={ink} />
      <rect x={-15} y={18} width={30} height={4} rx={1.5} fill={ink} />
      <path d="M-11 -18 L11 -18 C11 -6 3 -3 3 0 C3 3 11 6 11 18 L-11 18 C-11 6 -3 3 -3 0 C-3 -3 -11 -6 -11 -18 Z" fill="#f4efe2" stroke={ink} strokeWidth={2} />
      <path d="M-7 -12 L7 -12 C6 -6 1 -4 0 -1 C-1 -4 -6 -6 -7 -12 Z" fill={sand} />
      <path d="M0 2 L0 12 M-8 16 C-6 11 6 11 8 16 Z" fill={sand} stroke={sand} strokeWidth={1.4} />
    </g>
  );
}

function Stopwatch({ x, y, ink, face }: { x: number; y: number; ink: string; face: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-4} y={-24} width={8} height={6} rx={1.5} fill={ink} />
      <path d="M12 -15 L16 -19" stroke={ink} strokeWidth={3.4} strokeLinecap="round" />
      <circle r={18} fill={face} stroke={ink} strokeWidth={3} />
      <path d="M0 -13 L0 -10 M13 0 L10 0 M0 13 L0 10 M-13 0 L-10 0" stroke={ink} strokeWidth={2} />
      <path d="M0 0 L7 -9" stroke={INK.broken} strokeWidth={2.6} strokeLinecap="round" />
      <circle r={2.4} fill={ink} />
    </g>
  );
}

/** National insignia of a control marker, centred on (0, 0), about 56 units across. */
function Insignia({ nation }: { nation: Nation }) {
  if (nation === 'German')
    return (
      <g>
        <path d="M-7 -26 L7 -26 L7 -7 L26 -7 L26 7 L7 7 L7 26 L-7 26 L-7 7 L-26 7 L-26 -7 L-7 -7 Z" fill="#fff" />
        <path d="M-4 -23 L4 -23 L4 -4 L23 -4 L23 4 L4 4 L4 23 L-4 23 L-4 4 L-23 4 L-23 -4 L-4 -4 Z" fill="#151515" />
      </g>
    );
  if (nation === 'American')
    return (
      <g>
        <circle r={25} fill="#24365e" stroke="#fff" strokeWidth={2} />
        <path d={starPath(0, 2, 22, 0.4)} fill="#fff" />
      </g>
    );
  return (
    <g>
      <path d={starPath(0, 2, 29, 0.42)} fill="#fff" />
      <path d={starPath(0, 2, 24, 0.42)} fill="#c42b1f" />
    </g>
  );
}

export function MarkerBody({ kind, value, nation, side, selected, dim }: Omit<MarkerProps, 'size'>) {
  let lk = CARDBOARD;
  let art: ReactNode = null;
  switch (kind) {
    case 'foxholes': {
      art = (
        <>
          <Title text="FOXHOLES" ink={lk.ink} />
          {[
            [32, 42],
            [66, 38],
            [46, 62],
          ].map(([x, y], i) => (
            <g key={i}>
              <Sandbags cx={x} cy={y} rx={12} ry={7.5} n={9} fill="#b49d6a" edge="#5a4a2a" />
              <ellipse cx={x} cy={y} rx={8.5} ry={4.6} fill="#3a2e1d" />
            </g>
          ))}
          <CoverBadge v={3} ink={lk.ink} paper={lk.light} />
        </>
      );
      break;
    }
    case 'trench':
      art = (
        <>
          <Title text="TRENCH" ink={lk.ink} />
          <path d="M6 54 L22 38 L38 56 L56 36 L74 54 L94 38" fill="none" stroke="#8c7a4c" strokeWidth={17} strokeLinejoin="miter" />
          <path d="M6 54 L22 38 L38 56 L56 36 L74 54 L94 38" fill="none" stroke="#3a2e1d" strokeWidth={9} strokeLinejoin="miter" />
          <path d="M6 54 L22 38 L38 56 L56 36 L74 54 L94 38" fill="none" stroke="#5a4a2a" strokeWidth={1.2} strokeDasharray="3 3" transform="translate(0 -6.5)" />
          <CoverBadge v={4} ink={lk.ink} paper={lk.light} />
        </>
      );
      break;
    case 'pillbox':
      art = (
        <>
          <Title text="PILLBOX" ink={lk.ink} />
          <ellipse cx={50} cy={64} rx={36} ry={6} fill="#000" opacity={0.18} />
          <path d="M18 64 L24 38 L76 38 L82 64 Z" fill="#a4a39a" stroke="#4a4a44" strokeWidth={1.6} />
          <path d="M22 38 L30 30 L70 30 L78 38 Z" fill="#c2c1b8" stroke="#4a4a44" strokeWidth={1.6} />
          <path d="M50 38 L50 64" stroke="#7a7a72" strokeWidth={1.2} />
          <rect x={30} y={45} width={40} height={5.5} rx={1.5} fill="#1e1e1c" />
          <CoverBadge v={5} ink={lk.ink} paper={lk.light} />
        </>
      );
      break;
    case 'bunker':
      art = (
        <>
          <Title text="BUNKER" ink={lk.ink} />
          <path d="M8 66 C14 36 30 28 50 28 C70 28 86 36 92 66 Z" fill="#7f8c4e" stroke="#3d4524" strokeWidth={1.6} />
          {[36, 42, 48].map((y, i) => (
            <path key={i} d={`M${22 + i * 2} ${y} L${78 - i * 2} ${y}`} stroke="#5b4a2c" strokeWidth={4} strokeLinecap="round" />
          ))}
          <rect x={30} y={53} width={40} height={6} rx={1.5} fill="#1e1e1c" />
          <CoverBadge v={6} ink={lk.ink} paper={lk.light} />
        </>
      );
      break;
    case 'wire': {
      // two pickets and a concertina coil between them
      const loops: ReactNode[] = [];
      for (let x = 20; x <= 80; x += 7.5)
        loops.push(<ellipse key={x} cx={x} cy={50} rx={7.5} ry={13} fill="none" stroke="#2f2f2f" strokeWidth={1.5} transform={`rotate(-14 ${x} 50)`} />);
      art = (
        <>
          <Title text="WIRE" ink={lk.ink} />
          <path d="M12 30 L12 70 M88 30 L88 70" stroke="#5b4a2c" strokeWidth={4} strokeLinecap="round" />
          {loops}
          <path d="M12 37 L88 37 M12 63 L88 63" stroke="#2f2f2f" strokeWidth={1.2} />
          <text x={50} y={91} fontFamily={FONT.title} fontWeight={600} fontSize={11} fill={lk.ink} textAnchor="middle" letterSpacing={0.3} {...fit('−1 FP · RANGE · MORALE', 11, 86, 'title', 0.3)}>
            −1 FP · RANGE · MORALE
          </text>
        </>
      );
      break;
    }
    case 'mines': {
      const v = value ?? 6;
      art = (
        <>
          <Title text="MINES" ink={lk.ink} />
          {[
            [28, 44],
            [70, 40],
            [48, 60],
          ].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y + 2} rx={13} ry={5.5} fill="#8c7a4c" />
              <path d={`M${x - 10} ${y + 1} L${x - 10} ${y - 3} C${x - 10} ${y - 8} ${x + 10} ${y - 8} ${x + 10} ${y - 3} L${x + 10} ${y + 1} Z`} fill="#3d4433" stroke="#1e221a" strokeWidth={1} />
              <rect x={x - 2.4} y={y - 10} width={4.8} height={4} rx={1} fill="#1e221a" />
            </g>
          ))}
          <Big v={v} x={60} y={94} size={26} ink={lk.ink} anchor="end" />
          <text x={63} y={94} fontFamily={FONT.title} fontWeight={600} fontSize={14} fill={lk.ink}>
            FP
          </text>
        </>
      );
      break;
    }
    case 'smoke': {
      lk = look('#c7cbcd', '#26292b');
      const v = value ?? 1;
      art = (
        <>
          <Cloud x={34} y={44} s={1.05} fill="#f1f2f2" edge="#8d9497" />
          <Cloud x={66} y={36} s={0.9} fill="#e6e8e9" edge="#8d9497" />
          <Cloud x={56} y={58} s={0.95} fill="#fbfbfb" edge="#8d9497" />
          <text x={8} y={18} fontFamily={FONT.title} fontWeight={600} fontSize={14} fill={lk.ink} letterSpacing={0.6}>
            SMOKE
          </text>
          <Big v={v} x={93} y={94} size={34} ink={lk.ink} anchor="end" />
        </>
      );
      break;
    }
    case 'blaze':
      lk = look('#3d2219', '#fff4e0');
      art = (
        <>
          <Flames x={50} y={56} s={1.1} />
          <Title text="BLAZE" ink={lk.ink} y={18} size={15} />
          <text x={50} y={93} fontFamily={FONT.title} fontWeight={600} fontSize={11} fill="#f3c890" textAnchor="middle" letterSpacing={0.6}>
            BLOCKS LOS
          </text>
        </>
      );
      break;
    case 'suppressed':
      lk = look(INK.suppressed, '#1f1408');
      art = (
        <>
          <path d="M24 22 L50 40 L76 22 M24 44 L50 62 L76 44" fill="none" stroke="#fff" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
          <Title text="SUPPRESSED" ink={lk.ink} y={91} size={15} max={88} />
        </>
      );
      break;
    case 'veteran':
      lk = look(INK.veteran, '#f6f0dc');
      art = (
        <>
          <path d={starPath(50, 44, 28)} fill={INK.gold} stroke={darken(INK.goldDark, 0.3)} strokeWidth={1.5} />
          <Title text="VETERAN" ink={lk.ink} y={91} size={15} />
        </>
      );
      break;
    case 'spottingRound':
      lk = look('#f2efe6', '#1d1d1b');
      art = (
        <>
          <circle cx={50} cy={50} r={24} fill="none" stroke={INK.broken} strokeWidth={4} />
          <circle cx={50} cy={50} r={11} fill="none" stroke={INK.broken} strokeWidth={3} />
          <path d="M50 18 L50 38 M50 62 L50 82 M18 50 L38 50 M62 50 L82 50" stroke={lk.ink} strokeWidth={3} />
          <circle cx={50} cy={50} r={3} fill={INK.broken} />
          <Title text="SPOTTING" ink={lk.ink} y={15} size={12} />
          <Title text="ROUND" ink={lk.ink} y={95} size={12} />
        </>
      );
      break;
    case 'objective': {
      const n = nation ?? SIDE_NATION[side ?? 'axis'];
      const pal = NATION[n];
      // round control marker
      return (
        <g opacity={dim ? 0.42 : undefined}>
          {selected ? <circle cx={50} cy={50} r={55} fill="none" stroke={INK.select} strokeWidth={4} /> : null}
          <circle cx={51.8} cy={52.8} r={50} fill="#000" opacity={0.34} />
          <circle cx={50} cy={50} r={50} fill={pal.frame} />
          <circle cx={50} cy={50} r={46} fill="none" stroke={pal.frameLight} strokeWidth={2.4} />
          <circle cx={50} cy={50} r={49.4} fill="none" stroke={pal.frameDark} strokeWidth={1.2} />
          <g transform="translate(50 50)">
            <Insignia nation={n} />
          </g>
        </g>
      );
    }
    case 'vp':
      lk = look('#efe6c8', '#1f1a12');
      art = (
        <>
          <Big v="VP" x={50} y={value === undefined ? 66 : 52} size={value === undefined ? 44 : 34} ink={lk.ink} />
          {value !== undefined ? <Big v={value > 0 ? `+${value}` : value} x={50} y={88} size={26} ink={INK.broken} /> : null}
          <path d="M14 22 L86 22" stroke={lk.ink} strokeWidth={1.2} opacity={0.4} />
          <text x={50} y={17} fontFamily={FONT.title} fontWeight={600} fontSize={10} fill={lk.ink} textAnchor="middle" letterSpacing={1}>
            VICTORY
          </text>
        </>
      );
      break;
    case 'time':
      lk = look('#33465c', '#f4efe2');
      art = (
        <>
          <Hourglass x={50} y={47} ink="#1b2633" sand="#d9a640" />
          <Title text="TIME" ink={lk.ink} y={93} size={16} />
        </>
      );
      break;
    case 'suddenDeath':
      lk = look('#7d1d17', '#fbefe2');
      art = (
        <>
          <Stopwatch x={50} y={46} ink="#2a0b08" face="#f4efe2" />
          <Title text="SUDDEN DEATH" ink={lk.ink} y={93} size={13} max={88} />
        </>
      );
      break;
    case 'initiative':
      // the Initiative card: portrait, gold frame
      return (
        <g opacity={dim ? 0.42 : undefined}>
          <g transform="translate(15 0)">
            {selected ? <rect x={-4} y={-4} width={78} height={108} rx={9} fill="none" stroke={INK.select} strokeWidth={3.5} /> : null}
            <rect x={1.8} y={2.8} width={70} height={100} rx={6} fill="#000" opacity={0.34} />
            <rect x={0} y={0} width={70} height={100} rx={6} fill="#2d2a24" />
            <rect x={4} y={4} width={62} height={92} rx={3.5} fill="#f0e6c6" stroke={INK.gold} strokeWidth={2.4} />
            <path d={starPath(35, 42, 18)} fill={INK.gold} stroke={INK.goldDark} strokeWidth={1.4} />
            <path d="M14 56 C10 46 12 34 20 26 M56 56 C60 46 58 34 50 26" fill="none" stroke="#5f6b33" strokeWidth={3} strokeLinecap="round" />
            <text x={35} y={78} fontFamily={FONT.title} fontWeight={600} fontSize={11} fill="#2d2a24" textAnchor="middle" letterSpacing={0.3} {...fit('INITIATIVE', 11, 54, 'title', 0.3)}>
              INITIATIVE
            </text>
            <text x={35} y={89} fontFamily={FONT.body} fontSize={7} fill="#655a45" textAnchor="middle">
              re-roll once
            </text>
          </g>
        </g>
      );
  }
  return (
    <g opacity={dim ? 0.42 : undefined}>
      <Plate fill={lk.fill} light={lk.light} dark={lk.dark} selected={selected}>
        {art}
      </Plate>
    </g>
  );
}
