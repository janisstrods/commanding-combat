// Small pieces of the Random Battle screens: dice, the coin, the VP track, Objective chits, rows of counters and the map
// preview with set-up areas.
import { useEffect, useState, type ReactNode } from 'react';
import { Counter, Marker } from '../../../art';
import { COUNTERS, OBJECTIVE_CHITS, areaHexes } from '../../../engine/data';
import type { HexId } from '../../../engine/hex';
import type { Edge, FortKind, Nation, Side } from '../../../engine/types';
import { Board, hexPoints } from '../../board';
import { SIDE_LABEL } from '../../kit';
import { MapLoading, usePreparedMap } from '../../maps';
import { HIDDEN_CHIT } from './view';

// ---------------------------------------------------------------------------------------------------------------------
// Dice and coin

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

export type DieColour = 'white' | 'coloured';

/** One die face (white with black pips, or the red "coloured" die), `size` px. */
export function DieFace({ value, colour, size = 40, rolling = false }: { value: number; colour: DieColour; size?: number; rolling?: boolean }) {
  const white = colour === 'white';
  return (
    <svg
      className={`rsg-die ${rolling ? 'is-rolling' : 'is-settled'}`}
      width={size}
      height={size}
      viewBox="-4 -4 108 108"
      role="img"
      aria-label={`${white ? 'White' : 'Coloured'} die: ${value}`}
    >
      <rect x={3} y={5} width={100} height={100} rx={20} fill="#000" opacity={0.25} />
      <rect x={0} y={0} width={100} height={100} rx={20} fill={white ? '#fbfaf5' : '#c0281f'} stroke={white ? '#6b675c' : '#6e130e'} strokeWidth={4} />
      <rect x={6} y={5} width={88} height={30} rx={14} fill="#fff" opacity={white ? 0.5 : 0.14} />
      {(PIPS[value] ?? []).map(([px, py], i) => (
        <circle key={i} cx={px * 100} cy={py * 100} r={9.5} fill={white ? '#1c1c1a' : '#fff'} />
      ))}
    </svg>
  );
}

/** Random faces while `rolling`, then the result. */
function useTumble(value: number, rolling: boolean): number {
  const [face, setFace] = useState(value);
  useEffect(() => {
    if (!rolling) {
      setFace(value);
      return;
    }
    const t = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 85);
    return () => clearInterval(t);
  }, [rolling, value]);
  return rolling ? face : value;
}

/** The white and (optionally) the coloured die; `null` values tumble while `rolling`. */
export function Dice({ white, coloured, rolling = false, size = 56, one = false }: { white?: number | null; coloured?: number | null; rolling?: boolean; size?: number; one?: boolean }) {
  const w = useTumble(white ?? 1, rolling);
  const c = useTumble(coloured ?? 1, rolling);
  return (
    <span className="rsg-dice">
      <DieFace value={w} colour="white" size={size} rolling={rolling} />
      {one ? null : <DieFace value={c} colour="coloured" size={size} rolling={rolling} />}
    </span>
  );
}

/** Small inline dice for the record ("4+3"). */
export function MiniDice({ dice }: { dice: number[] }) {
  return (
    <span className="rsg-minidice" aria-label={`Roll ${dice.join(' and ')}`}>
      {dice.map((v, i) => (
        <DieFace key={i} value={v} colour={i === 0 ? 'white' : 'coloured'} size={17} />
      ))}
    </span>
  );
}

export function Coin({ face, spinning = false, size = 58 }: { face: 'heads' | 'tails' | null; spinning?: boolean; size?: number }) {
  return (
    <svg className={`rsg-coin ${spinning ? 'is-spinning' : ''}`} width={size} height={size} viewBox="-52 -52 104 104" role="img" aria-label={face ? `Coin: ${face}` : 'Coin'}>
      <circle r={48} fill="#b38f3f" stroke="#6d5420" strokeWidth={4} />
      <circle r={39} fill="none" stroke="#e0c77f" strokeWidth={2} strokeDasharray="3 4" />
      <text y={9} textAnchor="middle" className="rsg-coin__text">
        {spinning || !face ? '?' : face === 'heads' ? 'H' : 'T'}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// VP track

/** "4 toward the Axis", "on 0". */
export function vpPhrase(vp: number): string {
  return vp === 0 ? 'on 0' : `${Math.abs(vp)} toward the ${vp > 0 ? 'Axis' : 'Allies'}`;
}

/**
 * The VP track: the Axis end on the left, the Allied end on the right, the marker on the side it favours (§4.1: positive
 * toward the Axis). `preview` shows where a purchase would move it.
 */
export function VpTrack({ vp, preview, names }: { vp: number; preview?: number | null; names?: Partial<Record<Side, string>> }) {
  const reach = Math.max(Math.abs(vp), Math.abs(preview ?? 0));
  const span = Math.max(10, Math.ceil((reach + 2) / 5) * 5);
  const at = (v: number) => `${50 - (v / span) * 50}%`;
  const ticks: number[] = [];
  const stepBy = span <= 15 ? 1 : span <= 30 ? 5 : 10;
  for (let v = -span; v <= span; v += stepBy) ticks.push(v);
  const moving = preview !== undefined && preview !== null && preview !== vp;
  return (
    <div className="rsg-vp" aria-label={`VP marker ${vpPhrase(vp)}${moving ? `, ${vpPhrase(preview!)} after the purchase` : ''}`}>
      <div className="rsg-vp__ends">
        <span>◀ {names?.axis ?? SIDE_LABEL.axis}</span>
        <span className="rsg-vp__now">VP {vpPhrase(moving ? preview! : vp)}</span>
        <span>{names?.allied ?? SIDE_LABEL.allied} ▶</span>
      </div>
      <div className="rsg-vp__rail">
        {ticks.map((v) => (
          <span key={v} className={`rsg-vp__tick ${v === 0 ? 'is-zero' : ''} ${v % (stepBy * 5) === 0 ? 'is-major' : ''}`} style={{ left: at(v) }}>
            {v === 0 || Math.abs(v) % (stepBy === 1 ? 5 : stepBy * 2) === 0 ? <i>{Math.abs(v)}</i> : null}
          </span>
        ))}
        {moving ? <span className="rsg-vp__span" style={{ left: `min(${at(vp)}, ${at(preview!)})`, width: `${(Math.abs(preview! - vp) / span) * 50}%` }} /> : null}
        <span className={`rsg-vp__marker ${moving ? 'is-ghost' : ''}`} style={{ left: at(vp) }}>
          <Marker kind="vp" size={30} />
        </span>
        {moving ? (
          <span className="rsg-vp__marker is-next" style={{ left: at(preview!) }}>
            <Marker kind="vp" size={30} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Objective chits

export function chitCaption(id: string): string {
  if (id === HIDDEN_CHIT) return 'secret';
  const c = OBJECTIVE_CHITS[id];
  if (!c) return '';
  if (c.effect === 'suddenDeathWin') return 'Sudden death win';
  if (c.effect === 'doubleExitVp') return 'Exit VP doubled';
  if (c.effect === 'doubleEliminationVp') return 'Kill VP doubled';
  if (c.objective === 'all') return `Every Objective +${c.vp}`;
  return `Objective ${c.objective} +${c.vp}`;
}

/** An Objective chit: letter and what it scores; hidden chits show "?". */
export function ChitToken({ id, secret = false, mine = false }: { id: string; secret?: boolean; mine?: boolean }) {
  const hidden = id === HIDDEN_CHIT;
  return (
    <span className={`rsg-chit ${secret ? 'is-secret' : ''} ${hidden ? 'is-hidden' : ''}`} title={hidden ? 'Secret: hidden' : chitCaption(id)}>
      <span className="rsg-chit__disc">{hidden ? '?' : id}</span>
      <span className="rsg-chit__text">
        {hidden ? 'Their secret chit' : chitCaption(id)}
        {secret && !hidden ? <small>{mine ? 'your secret' : 'secret'}</small> : null}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Counters

const KIND_ORDER: Record<string, number> = { leader: 0, squad: 1, team: 2, weapon: 3, radio: 4 };

/** Counter type ids in table order: Leaders, Squads, Teams, Weapons, Radios. */
export function sortTypes(types: string[]): string[] {
  return [...types].sort((a, b) => (KIND_ORDER[COUNTERS[a]?.kind ?? ''] ?? 9) - (KIND_ORDER[COUNTERS[b]?.kind ?? ''] ?? 9) || a.localeCompare(b));
}

/** Counters with counts ("×3"), in table order. */
export function Forces({ units, size = 38, title }: { units: Record<string, number>; size?: number; title?: string }) {
  const types = sortTypes(Object.keys(units).filter((t) => units[t] > 0));
  return (
    <div className="rsg-forces" aria-label={title}>
      {types.map((t) => {
        const type = COUNTERS[t];
        if (!type) return null;
        return (
          <span key={t} className="rsg-forces__item" title={`${units[t]} × ${type.name}`}>
            <Counter type={type} size={size} />
            {units[t] > 1 ? <b className="rsg-forces__n">×{units[t]}</b> : null}
          </span>
        );
      })}
    </div>
  );
}

/** Fortification counters with counts. */
export function Forts({ contents, minefield, size = 34 }: { contents: Partial<Record<FortKind, number>>; minefield?: number; size?: number }) {
  const kinds = (Object.keys(contents) as FortKind[]).filter((k) => (contents[k] ?? 0) > 0);
  if (!kinds.length) return null;
  return (
    <div className="rsg-forces">
      {kinds.map((k) => (
        <span key={k} className="rsg-forces__item" title={`${contents[k]} × ${k}`}>
          <Marker kind={k} value={k === 'mines' ? minefield : undefined} size={size} />
          {(contents[k] ?? 0) > 1 ? <b className="rsg-forces__n">×{contents[k]}</b> : null}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Map preview

export interface Tint {
  hexes: readonly HexId[];
  tone: 'mine' | 'theirs' | 'pick';
}

/** A map with tinted hexes (set-up areas, an edge band) and edge names. */
export function MapPreview(p: {
  map: string;
  rotate180?: boolean;
  edgeLabels?: Partial<Record<Edge, string>>;
  tints?: readonly Tint[];
  ppu?: number;
  marginScale?: number;
  objectives?: boolean;
  grid?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const ppu = p.ppu ?? 20;
  // shown once the map is loaded and painted (src/ui/maps.tsx)
  const { map, error } = usePreparedMap(p.map, ppu);
  if (!map) return <MapLoading id={p.map} error={error} className={p.className} />;
  const rotate = p.rotate180 ?? false;
  return (
    <Board
      map={map}
      className={p.className}
      rotate180={rotate}
      showLabels={false}
      showCompass={false}
      showGrid={p.grid ?? true}
      showObjectives={p.objectives ?? true}
      edgeLabels={p.edgeLabels}
      marginScale={p.marginScale ?? 2}
      ppu={ppu}
      title={`Map ${p.map}`}
      hovered={null}
    >
      {(p.tints ?? []).map((t, i) => (
        <g key={i} className={`rsg-tint rsg-tint--${t.tone}`} pointerEvents="none">
          {t.hexes.map((h) => (
            <polygon key={h} points={hexPoints(h, rotate, 0.97)} />
          ))}
        </g>
      ))}
      {p.children}
    </Board>
  );
}

/** Hexes within `depth` rows (or columns) of `edge`. */
export function edgeBand(edge: Edge, depth: number): HexId[] {
  return areaHexes({ kind: 'depth', depth }, edge);
}

/** "the top edge", "the left side". */
export function edgeName(e: Edge): string {
  return e === 'top' || e === 'bottom' ? `the ${e} edge` : `the ${e} side`;
}

export function nationLabel(n: Nation | null, side: Side): string {
  if (!n) return side === 'axis' ? 'Germans' : 'Allies';
  return n === 'German' ? 'Germans' : n === 'American' ? 'Americans' : 'Russians';
}
