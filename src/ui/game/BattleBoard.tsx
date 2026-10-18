// The battle map: the painted Board (zoomable) with the game's stacks (units side by side, each with its Weapon beside
// it; Fortification, Smoke, Blaze, Spotting Round and Objective control markers in a band along the top of the hex),
// the prompt's lit hexes and labels, and the animations (units sliding, attack lines, flashes, counters flipping).
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { CounterG, MarkerG } from '../../art';
import type { MarkerKind } from '../../art';
import { counterType } from '../../engine/state';
import type { GameState, HexId, Nation, PieceId, Side } from '../../engine/types';
import { Board, StackView, hexCentre, type LosLine, type StackItem } from '../board';
import type { AttackShow, Flash, Slide } from './controller';
import { FireOverlay } from './FireOverlay';
import { RallyOverlay } from './RallyOverlay';
import type { RallyShow } from './rallyShow';
import type { FireShow } from './fireShow';
import type { HexMark } from './prompts';

export interface BattleBoardProps {
  s: GameState;
  human: Side;
  rotate180: boolean;
  selectable: readonly HexId[];
  targets: readonly HexId[];
  marks: readonly HexMark[];
  /** Pieces to outline as selected. */
  selected: readonly PieceId[];
  /** Pieces that can be clicked (outlined faintly). */
  clickable: readonly PieceId[];
  slides: readonly Slide[];
  flashes: readonly Flash[];
  flipping: readonly PieceId[];
  attack: AttackShow | null;
  /** The Fire Attack being shown (arrow, rings, total). */
  fire?: FireShow | null;
  /** The Recover / Rout / Commissar being shown. */
  rally?: RallyShow | null;
  losLine: LosLine | null;
  expanded: HexId | null;
  hovered?: HexId | null;
  onHexClick: (hex: HexId, e: MouseEvent<SVGElement>) => void;
  onPieceClick: (id: PieceId) => void;
  onHexHover: (hex: HexId | null, e?: MouseEvent<SVGElement>) => void;
  edgeLabels?: Partial<Record<'top' | 'bottom' | 'left' | 'right', string>>;
  /** More map overlays in board coordinates, under the flashes (the Random Hex randomiser). */
  overlay?: ReactNode;
}

/** The side the counters are drawn at (hex units); StackView scales them to their place in the hex. */
const SIZE = 1.18;

/** The pieces of each hex in order (units, each followed by its Weapon). */
function stacksOf(s: GameState, skip: ReadonlySet<PieceId>): Map<HexId, { id: PieceId; role: 'unit' | 'weapon' }[]> {
  const out = new Map<HexId, { id: PieceId; role: 'unit' | 'weapon' }[]>();
  const ids = Object.keys(s.pieces).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)) || a.localeCompare(b));
  for (const id of ids) {
    const p = s.pieces[id];
    if (p.where !== 'map' || skip.has(id)) continue;
    const list = out.get(p.hex) ?? [];
    list.push({ id, role: 'unit' });
    if (p.weapon && s.pieces[p.weapon]) list.push({ id: p.weapon, role: 'weapon' });
    out.set(p.hex, list);
  }
  return out;
}

/** Hexes with anything in their stack (their Objective control marker goes into the stack). */
function stackedHexes(s: GameState, stacks: Map<HexId, unknown>): Set<HexId> {
  const out = new Set<HexId>(stacks.keys());
  s.fort.forEach((v, h) => v && out.add(h));
  s.smoke.forEach((v, h) => v && out.add(h));
  s.blaze.forEach((v, h) => v && out.add(h));
  if (s.spottingRound >= 0) out.add(s.spottingRound);
  return out;
}

function UnitNode({ s, id, selected, clickable, flipping, onClick }: { s: GameState; id: PieceId; selected: boolean; clickable: boolean; flipping: boolean; onClick?: (id: PieceId) => void }) {
  const p = s.pieces[id];
  const t = s.pieces[id] ? safeType(s, id) : null;
  if (!p || !t) return null;
  return (
    <g
      className={`bb-piece ${flipping ? 'is-flipping' : ''} ${clickable ? 'is-clickable' : ''}`}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick(id);
            }
          : undefined
      }
    >
      <CounterG type={t} x={0} y={0} size={SIZE} broken={p.broken} suppressed={p.suppressed} veteran={p.veteran} selected={selected} />
    </g>
  );
}

function safeType(s: GameState, id: PieceId) {
  try {
    return counterType(s.pieces[id].type);
  } catch {
    return null;
  }
}

function MarkerNode({ kind, value, side, nation }: { kind: MarkerKind; value?: number; side?: Side; nation?: Nation }) {
  return <MarkerG kind={kind} value={value} side={side} nation={nation} x={0} y={0} size={SIZE} />;
}

/** Units sliding from one hex to the next (mounted at the start, moved to the end on the next frame). */
function Flyer({ slide, rotate180, children }: { slide: Slide; rotate180: boolean; children: ReactNode }) {
  const a = hexCentre(slide.from, rotate180);
  const b = hexCentre(slide.to, rotate180);
  const [at, setAt] = useState(a);
  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setAt(b));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id]);
  return (
    <g className="bb-flyer" style={{ transform: `translate(${at.x}px, ${at.y}px)`, transition: `transform ${slide.ms}ms ease-in-out` }} pointerEvents="none">
      {children}
    </g>
  );
}

export function BattleBoard(p: BattleBoardProps) {
  const { s, rotate180 } = p;
  const flying = useMemo(() => new Set(p.slides.flatMap((x) => x.units.flatMap((id) => [id, s.pieces[id]?.weapon ?? '']))), [p.slides, s]);
  const stacks = useMemo(() => stacksOf(s, flying), [s, flying]);
  const stacked = useMemo(() => stackedHexes(s, stacks), [s, stacks]);
  const selected = useMemo(() => new Set(p.selected), [p.selected]);
  const clickable = useMemo(() => new Set(p.clickable), [p.clickable]);
  const flipping = useMemo(() => new Set(p.flipping), [p.flipping]);

  const renderStack = (h: HexId) => {
    const ids = stacks.get(h) ?? [];
    const items: StackItem[] = [];
    const fort = s.fort[h];
    if (fort) items.push({ key: `fort-${h}`, role: 'marker', node: <MarkerNode kind={fort} value={fort === 'mines' ? s.players[p.human].minefield : undefined} /> });
    const expanded = p.expanded === h;
    for (const { id, role } of ids) {
      items.push({
        key: id,
        role,
        node: (
          <UnitNode
            s={s}
            id={id}
            selected={selected.has(id)}
            clickable={clickable.has(id)}
            flipping={flipping.has(id)}
            onClick={expanded ? p.onPieceClick : undefined}
          />
        ),
      });
    }
    if (s.smoke[h]) items.push({ key: `smoke-${h}`, role: 'marker', node: <MarkerNode kind="smoke" value={s.smoke[h]} /> });
    if (s.blaze[h]) items.push({ key: `blaze-${h}`, role: 'marker', node: <MarkerNode kind="blaze" /> });
    if (s.spottingRound === h) items.push({ key: `sr-${h}`, role: 'marker', node: <MarkerNode kind="spottingRound" /> });
    if (!items.length) return null;
    const obj = s.map.objectives.indexOf(h);
    const ctl = obj >= 0 ? s.control[obj] : null;
    if (ctl) items.push({ key: `ctl-${h}`, role: 'marker', node: <MarkerNode kind="objective" side={ctl} nation={s.players[ctl].nation} /> });
    return <StackView items={items} size={SIZE} expanded={expanded && items.length > 1} />;
  };

  return (
    <Board
      map={s.map}
      rotate180={rotate180}
      selectable={p.selectable}
      targets={p.targets}
      losLine={p.losLine}
      hovered={p.hovered}
      onHexClick={p.onHexClick}
      onHexHover={p.onHexHover}
      renderStack={renderStack}
      topStack={p.expanded}
      edgeLabels={p.edgeLabels}
      title={`Map ${s.map.id}`}
      zoomKey="battle"
      zoomKeys
    >
      {/* Overlay layers, bottom to top, in board coordinates (they zoom and pan with the map): add new ones here. */}
      <ControlMarkers s={s} rotate180={rotate180} skip={stacked} />
      <Marks marks={p.marks} rotate180={rotate180} />
      {p.attack ? <AttackLines key={p.attack.id} attack={p.attack} rotate180={rotate180} /> : null}
      {p.fire ? <FireOverlay key={p.fire.id} show={p.fire} human={p.human} rotate180={rotate180} /> : null}
      {p.rally ? <RallyOverlay key={p.rally.id} show={p.rally} human={p.human} rotate180={rotate180} /> : null}
      {p.slides.map((sl) => (
        <Flyer key={sl.id} slide={sl} rotate180={rotate180}>
          <StackView
            size={SIZE}
            items={sl.units.flatMap((id) => {
              const u = s.pieces[id];
              const out: StackItem[] = [{ key: id, node: <UnitNode s={s} id={id} selected={false} clickable={false} flipping={false} /> }];
              if (u?.weapon) out.push({ key: u.weapon, role: 'weapon', node: <UnitNode s={s} id={u.weapon} selected={false} clickable={false} flipping={false} /> });
              return out;
            })}
          />
        </Flyer>
      ))}
      {p.overlay}
      <Flashes flashes={p.flashes} rotate180={rotate180} />
    </Board>
  );
}

/** Objective control markers of hexes with nothing else in them (a stack shows its own). */
function ControlMarkers({ s, rotate180, skip }: { s: GameState; rotate180: boolean; skip: ReadonlySet<HexId> }) {
  return (
    <g pointerEvents="none" className="bb-control">
      {s.map.objectives.map((h, i) => {
        const side = s.control[i];
        if (!side || h < 0 || skip.has(h)) return null;
        const c = hexCentre(h, rotate180);
        return <MarkerG key={i} kind="objective" side={side} nation={s.players[side].nation} x={c.x - 0.5} y={c.y + 0.5} size={0.5} />;
      })}
    </g>
  );
}

function Marks({ marks, rotate180 }: { marks: readonly HexMark[]; rotate180: boolean }) {
  if (!marks.length) return null;
  return (
    <g pointerEvents="none" className="bb-marks">
      {marks.map((m) => {
        const c = hexCentre(m.hex, rotate180);
        const w = Math.max(0.56, m.label.length * 0.125 + 0.18);
        return (
          <g key={`${m.hex}-${m.label}`} transform={`translate(${c.x} ${c.y + 0.6})`} className={`bb-mark bb-mark--${m.tone}`}>
            <rect x={-w / 2} y={-0.155} width={w} height={0.31} rx={0.14} />
            <text y={0.075}>{m.label}</text>
          </g>
        );
      })}
    </g>
  );
}

function AttackLines({ attack, rotate180 }: { attack: AttackShow; rotate180: boolean }) {
  return (
    <g pointerEvents="none" className="bb-attack">
      {attack.targets.flatMap((t) => {
        const b = hexCentre(t, rotate180);
        return [
          ...attack.from.map((f) => {
            const a = hexCentre(f, rotate180);
            return <line key={`${f}-${t}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="bb-attack__line" />;
          }),
          <circle key={`ring-${t}`} cx={b.x} cy={b.y} r={0.78} className="bb-attack__ring" />,
        ];
      })}
    </g>
  );
}

function Flashes({ flashes, rotate180 }: { flashes: readonly Flash[]; rotate180: boolean }) {
  // several flashes on one hex stack upwards
  const byHex = new Map<HexId, Flash[]>();
  for (const f of flashes) byHex.set(f.hex, [...(byHex.get(f.hex) ?? []), f]);
  return (
    <g pointerEvents="none" className="bb-flashes">
      {[...byHex.entries()].flatMap(([h, list]) =>
        list.map((f, i) => {
          const c = hexCentre(h, rotate180);
          const w = Math.max(0.8, f.text.length * 0.115 + 0.3);
          return (
            <g key={f.id} transform={`translate(${c.x} ${c.y - 0.2 - (list.length - 1 - i) * 0.4})`}>
              <g className={`bb-flash bb-flash--${f.tone}`}>
                <rect x={-w / 2} y={-0.19} width={w} height={0.38} rx={0.08} />
                <text y={0.1}>{f.text}</text>
              </g>
            </g>
          );
        }),
      )}
    </g>
  );
}
