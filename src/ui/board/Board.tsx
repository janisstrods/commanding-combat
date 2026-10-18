// The map board: painted terrain, hex grid, hexside features, labels, objective circles, highlight layers and a slot for
// counter stacks. It holds no game state: the battle screen (Task 11) passes highlights and renders stacks.
// Everything is in hex-radius units (viewBox), so the board scales to whatever box it is given. With `zoomKey` the board
// zooms and pans (useBoardZoom.ts): the view only changes the viewBox, so every layer, the stacks and the overlays
// (children) stay in board coordinates and zoom with the map.
import { memo, useCallback, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode, type Ref } from 'react';
import { ALL_HEXES, type HexId, type HexSide } from '../../engine/hex';
import type { Edge, MapDef } from '../../engine/types';
import { BOUNDS, boardViewBox, fmt, hexCentre, hexPoints, screenEdge, type Point } from './geometry';
import { GridLayer, HexsideLayer, LabelLayer, ObjectiveLayer } from './HexLayer';
import { MaskOverlay, type MaskOverlayMode } from './MaskOverlay';
import { BoardScale, StackOrigin } from './StackView';
import { DEFAULT_PPU, TerrainLayer } from './TerrainLayer';
import { SettledZoom, useBoardZoom, type BoardZoom } from './useBoardZoom';
import './board.css';

export interface LosLine {
  from: HexId;
  to: HexId;
  clear: boolean;
}

export interface BoardProps {
  map: MapDef;
  /** Turn the map 180 degrees (so the player's own edge is at the bottom). */
  rotate180?: boolean;
  /** Layers (all on by default except the mask overlay). */
  showLabels?: boolean;
  showGrid?: boolean;
  showHexsides?: boolean;
  showObjectives?: boolean;
  showCompass?: boolean;
  /** Debug overlay of the terrain field: mask classes or levels. */
  maskOverlay?: MaskOverlayMode | null;
  /** Hexes the player may pick now (outlined and lit). */
  selectable?: readonly HexId[];
  /** Hexes under threat / chosen targets (outlined in red). */
  targets?: readonly HexId[];
  /** A line of sight to draw, centre to centre: green when clear, red when blocked. */
  losLine?: LosLine | null;
  /** The hex to outline as hovered. Leave undefined to let the board follow the pointer itself. */
  hovered?: HexId | null;
  onHexClick?: (hex: HexId, e: MouseEvent<SVGElement>) => void;
  onHexHover?: (hex: HexId | null, e?: MouseEvent<SVGElement>) => void;
  /** Counters (or anything) to draw in a hex, centred on (0, 0) = the hex centre, upright, in hex units. */
  renderStack?: (hex: HexId) => ReactNode;
  /** A hex whose stack is drawn above all others (e.g. an expanded stack); the hovered hex's comes next. */
  topStack?: HexId | null;
  /** Text written in the margin along each map edge (map edges; they follow the turn). */
  edgeLabels?: Partial<Record<Edge, string>>;
  /** Size of the margin text and compass (1 = normal; larger for small previews). */
  marginScale?: number;
  /** Overlay layers above everything (animations, attack lines, flashes), in screen hex units: they zoom with the map. */
  children?: ReactNode;
  /**
   * Zoom (wheel, pinch, + / - buttons) and pan (drag) the board, keeping the view in localStorage under this key. The
   * board then fills its box (with the zoom buttons in its corner) instead of keeping the map's aspect.
   */
  zoomKey?: string;
  /** With `zoomKey`: + / - / 0 on the keyboard zoom too. */
  zoomKeys?: boolean;
  /** Terrain painting resolution, pixels per hex radius. */
  ppu?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible name of the board. */
  title?: string;
}

const NO_HEXES: readonly HexId[] = [];

export function Board(p: BoardProps) {
  return p.zoomKey !== undefined ? <ZoomableBoard {...p} zoomKey={p.zoomKey} /> : <BoardSvg {...p} />;
}

function ZoomableBoard(p: BoardProps & { zoomKey: string }) {
  // a pan or pinch carries the map away from the pointer: drop the hover (and the caller's tooltip) meanwhile
  const z = useBoardZoom(boardViewBox(), { storageKey: p.zoomKey, keys: p.zoomKeys, onGestureStart: () => p.onHexHover?.(null) });
  return (
    <div ref={z.containerRef} className={`board-zoom ${p.className ?? ''}`} style={p.style}>
      <SettledZoom.Provider value={z.settled}>
        <BoardScale.Provider value={z.settled.px}>
          <BoardSvg {...p} className={undefined} style={undefined} svgRef={z.svgRef} viewBox={z.viewBoxAttr()} />
        </BoardScale.Provider>
      </SettledZoom.Provider>
      <ZoomControls z={z} />
    </div>
  );
}

/** The + / - / fit buttons in the board's corner. */
function ZoomControls({ z }: { z: BoardZoom }) {
  const { k, max } = z.settled;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div className="board-zoom__controls" onClick={stop} onDoubleClick={stop}>
      <button type="button" onClick={() => z.zoomBy(1.5)} disabled={k >= max - 1e-3} aria-label="Zoom in" title="Zoom in (+, wheel or pinch)">
        +
      </button>
      {/* zoomed out all the way, only + is offered (the map stays clear) */}
      {k > 1 + 1e-3 ? (
        <>
          <button type="button" onClick={() => z.zoomBy(1 / 1.5)} aria-label="Zoom out" title="Zoom out (-)">
            −
          </button>
          <button type="button" onClick={z.fit} aria-label="Show the whole map" title="Show the whole map (0)">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </>
      ) : null}
    </div>
  );
}

function BoardSvg(p: BoardProps & { svgRef?: Ref<SVGSVGElement>; viewBox?: string }) {
  const {
    map,
    rotate180 = false,
    showLabels = true,
    showGrid = true,
    showHexsides = true,
    showObjectives = true,
    showCompass = true,
    maskOverlay = null,
    selectable = NO_HEXES,
    targets = NO_HEXES,
    losLine = null,
    onHexClick,
    onHexHover,
    renderStack,
    topStack = null,
  } = p;
  const [ownHover, setOwnHover] = useState<HexId | null>(null);
  const hovered = p.hovered !== undefined ? p.hovered : ownHover;
  const vb = boardViewBox();

  const enter = useCallback(
    (h: HexId, e: MouseEvent<SVGElement>) => {
      setOwnHover(h);
      onHexHover?.(h, e);
    },
    [onHexHover],
  );
  const leave = useCallback(() => {
    setOwnHover(null);
    onHexHover?.(null);
  }, [onHexHover]);

  const stacks = useMemo(() => {
    if (!renderStack) return null;
    // the hovered stack above its neighbours (a fanned-out stack spills over them), the top stack above all
    const raised: HexId[] = [];
    if (hovered !== null && hovered >= 0 && hovered < 150 && hovered !== topStack) raised.push(hovered);
    if (topStack !== null) raised.push(topStack);
    const order = raised.length ? [...ALL_HEXES.filter((h) => !raised.includes(h)), ...raised] : ALL_HEXES;
    const out: ReactNode[] = [];
    for (const h of order) {
      const node = renderStack(h);
      if (node === null || node === undefined || node === false) continue;
      const c = hexCentre(h, rotate180);
      out.push(
        <g
          key={h}
          transform={`translate(${fmt(c.x)} ${fmt(c.y)})`}
          onClick={onHexClick ? (e) => onHexClick(h, e) : undefined}
          onMouseEnter={(e) => enter(h, e)}
        >
          <StackOrigin.Provider value={c}>{node}</StackOrigin.Provider>
        </g>,
      );
    }
    return out;
  }, [renderStack, topStack, hovered, rotate180, onHexClick, enter]);

  return (
    <svg
      ref={p.svgRef}
      className={`board-svg ${p.className ?? ''}`}
      style={p.style}
      viewBox={p.viewBox ?? vb.attr}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={p.title ?? `Map ${map.id}`}
      onMouseLeave={leave}
    >
      <BoardFrame />
      <TerrainLayer map={map} rotate180={rotate180} ppu={p.ppu ?? DEFAULT_PPU} />
      {showGrid && <GridLayer rotate180={rotate180} />}
      {showHexsides && <HexsideLayer map={map} rotate180={rotate180} />}
      {maskOverlay && <MaskOverlay map={map} mode={maskOverlay} rotate180={rotate180} />}
      {showLabels && <LabelLayer rotate180={rotate180} />}
      {showObjectives && <ObjectiveLayer map={map} rotate180={rotate180} />}
      <MarginText edgeLabels={p.edgeLabels} rotate180={rotate180} scale={p.marginScale ?? 1} />
      {showCompass && <Compass rotate180={rotate180} />}
      <HitLayer rotate180={rotate180} onClick={onHexClick} onEnter={enter} />
      <Highlights hexes={selectable} kind="select" rotate180={rotate180} />
      <Highlights hexes={targets} kind="target" rotate180={rotate180} />
      {hovered !== null && hovered >= 0 && hovered < 150 ? (
        <polygon className="board-hover" points={hexPoints(hovered, rotate180, 0.96)} pointerEvents="none" />
      ) : null}
      {stacks ? <g className="board-stacks">{stacks}</g> : null}
      {losLine ? <LosLayer line={losLine} rotate180={rotate180} /> : null}
      {p.children ? <g className="board-overlays">{p.children}</g> : null}
    </svg>
  );
}

/** The paper margin and the double ink rule around the combat zone. */
const BoardFrame = memo(function BoardFrame() {
  const vb = boardViewBox();
  return (
    <g pointerEvents="none">
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className="board-margin" />
      <rect x={BOUNDS.x - 0.16} y={BOUNDS.y - 0.16} width={BOUNDS.w + 0.32} height={BOUNDS.h + 0.32} fill="none" stroke="#2a2a1e" strokeWidth={0.018} />
      <rect x={BOUNDS.x - 0.03} y={BOUNDS.y - 0.03} width={BOUNDS.w + 0.06} height={BOUNDS.h + 0.06} fill="#2a2a1e" />
    </g>
  );
});

const HitLayer = memo(function HitLayer({
  rotate180,
  onClick,
  onEnter,
}: {
  rotate180: boolean;
  onClick?: (h: HexId, e: MouseEvent<SVGElement>) => void;
  onEnter: (h: HexId, e: MouseEvent<SVGElement>) => void;
}) {
  return (
    <g className="board-hits">
      {ALL_HEXES.map((h) => (
        <polygon
          key={h}
          points={hexPoints(h, rotate180)}
          data-hex={h}
          onClick={onClick ? (e) => onClick(h, e) : undefined}
          onMouseEnter={(e) => onEnter(h, e)}
          style={onClick ? { cursor: 'pointer' } : undefined}
        />
      ))}
    </g>
  );
});

const Highlights = memo(function Highlights({ hexes, kind, rotate180 }: { hexes: readonly HexId[]; kind: 'select' | 'target'; rotate180: boolean }) {
  if (!hexes.length) return null;
  return (
    <g className={`board-${kind}`} pointerEvents="none">
      {hexes.map((h) => (
        <polygon key={h} points={hexPoints(h, rotate180, 0.9)} />
      ))}
    </g>
  );
});

function LosLayer({ line, rotate180 }: { line: LosLine; rotate180: boolean }) {
  const a = hexCentre(line.from, rotate180);
  const b = hexCentre(line.to, rotate180);
  const cls = line.clear ? 'is-clear' : 'is-blocked';
  return (
    <g className={`board-los ${cls}`} pointerEvents="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="board-los__casing" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="board-los__line" />
      <circle cx={a.x} cy={a.y} r={0.12} className="board-los__end" />
      <circle cx={b.x} cy={b.y} r={0.12} className="board-los__end" />
    </g>
  );
}

/** Edge names in the margin, upright, on the side of the screen where that map edge is drawn. */
function MarginText({ edgeLabels, rotate180, scale }: { edgeLabels?: Partial<Record<Edge, string>>; rotate180: boolean; scale: number }) {
  if (!edgeLabels) return null;
  const vb = boardViewBox();
  const midX = BOUNDS.x + BOUNDS.w / 2;
  const midY = BOUNDS.y + BOUNDS.h / 2;
  const off = (BOUNDS.x - vb.x) / 2 + 0.05;
  const at: Record<Edge, { x: number; y: number; rot: number }> = {
    top: { x: midX, y: BOUNDS.y - off, rot: 0 },
    bottom: { x: midX, y: BOUNDS.y + BOUNDS.h + off, rot: 0 },
    left: { x: BOUNDS.x - off, y: midY, rot: -90 },
    right: { x: BOUNDS.x + BOUNDS.w + off, y: midY, rot: 90 },
  };
  return (
    <g className="board-edge-labels" pointerEvents="none">
      {(Object.keys(edgeLabels) as Edge[]).map((e) => {
        const text = edgeLabels[e];
        if (!text) return null;
        const pos = at[screenEdge(e, rotate180)];
        return (
          <text
            key={e}
            x={fmt(pos.x)}
            y={fmt(pos.y)}
            transform={pos.rot ? `rotate(${pos.rot} ${fmt(pos.x)} ${fmt(pos.y)})` : undefined}
            className="board-edge-label"
            style={scale !== 1 ? { fontSize: `${0.3 * scale}px` } : undefined}
            dominantBaseline="central"
          >
            {text}
          </text>
        );
      })}
    </g>
  );
}

/** The map compass (directions 1..6 as printed on the maps, used by Breeze and artillery drift), in the corner margin. */
const Compass = memo(function Compass({ rotate180 }: { rotate180: boolean }) {
  const vb = boardViewBox();
  const c: Point = { x: vb.x + 0.55, y: vb.y + vb.h - 0.55 };
  const r = 0.18;
  const hex = [0, 1, 2, 3, 4, 5].map((i) => `${fmt(c.x + r * Math.cos((Math.PI / 3) * i))},${fmt(c.y + r * Math.sin((Math.PI / 3) * i))}`).join(' ');
  const dirs: HexSide[] = [1, 2, 3, 4, 5, 6];
  return (
    <g className="board-compass" pointerEvents="none">
      <polygon points={hex} className="board-compass__hex" />
      {dirs.map((s) => {
        const ang = (-90 + 60 * (s - 1) + (rotate180 ? 180 : 0)) * (Math.PI / 180);
        const x = c.x + Math.cos(ang) * 0.36;
        const y = c.y + Math.sin(ang) * 0.36;
        const x1 = c.x + Math.cos(ang) * (r * 0.87);
        const y1 = c.y + Math.sin(ang) * (r * 0.87);
        const x2 = c.x + Math.cos(ang) * 0.26;
        const y2 = c.y + Math.sin(ang) * 0.26;
        return (
          <g key={s}>
            <line x1={fmt(x1)} y1={fmt(y1)} x2={fmt(x2)} y2={fmt(y2)} className={s === 1 ? 'board-compass__north' : 'board-compass__tick'} />
            <text x={fmt(x)} y={fmt(y)} className="board-compass__num" dominantBaseline="central">
              {s}
            </text>
          </g>
        );
      })}
    </g>
  );
});
