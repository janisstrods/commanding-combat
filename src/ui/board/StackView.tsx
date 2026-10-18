// The pieces of one hex, side by side (stackLayout.ts): units in rows, each with its weapon beside it, hex markers in a
// band along the top; fanned out on a tray when the hex is too small on screen, larger still when expanded. The board
// knows nothing about game pieces: the caller passes ready-made nodes (e.g. CounterG), each drawn centred on (0, 0) at
// `size` hex units (a unit counter's side; weapons as the art draws them at that size), and StackView scales them.
import { createContext, useContext, type ReactNode } from 'react';
import { WEAPON_SCALE } from '../../art/Counter';
import { boardViewBox, fmt, type Point } from './geometry';
import { layoutStack, trayShift, type StackRole } from './stackLayout';

export interface StackItem {
  key: string;
  node: ReactNode;
  /** 'unit' (the default): a counter of its own. 'weapon': sits beside the unit before it. 'marker': a hex marker. */
  role?: StackRole;
}

/** Screen pixels per hex unit of the board being drawn (the zoomable board provides it; 0 = unknown). */
export const BoardScale = createContext(0);
/** Where the board draws this stack (its hex centre on screen), so that a tray can keep clear of the board's edges. */
export const StackOrigin = createContext<Point | null>(null);

/** The side a node drawn at `size` comes out at, for each role (weapons are drawn smaller by the art). */
function drawnSide(role: StackRole, size: number): number {
  return role === 'weapon' ? size * WEAPON_SCALE : size;
}

export function StackView(p: { items: readonly StackItem[]; size?: number; expanded?: boolean }) {
  const px = useContext(BoardScale);
  const at = useContext(StackOrigin);
  const size = p.size ?? 0.8;
  const roles = p.items.map((it) => it.role ?? 'unit');
  const lay = layoutStack(roles, { px, expanded: p.expanded });
  const shift = at ? trayShift(lay, at, boardViewBox()) : { x: 0, y: 0 };
  return (
    <g className={`board-stack is-${lay.mode}`} transform={shift.x || shift.y ? `translate(${fmt(shift.x)} ${fmt(shift.y)})` : undefined}>
      {lay.tray ? <rect className="board-stack__tray" x={fmt(lay.tray.x)} y={fmt(lay.tray.y)} width={fmt(lay.tray.w)} height={fmt(lay.tray.h)} rx={fmt(Math.min(0.08, lay.unit * 0.1))} /> : null}
      {p.items.map((it, i) => {
        const s = lay.slots[i];
        const k = s.side / drawnSide(roles[i], size);
        return (
          <g key={it.key} transform={`translate(${fmt(s.x)} ${fmt(s.y)}) scale(${Math.round(k * 10000) / 10000})`}>
            {it.node}
          </g>
        );
      })}
    </g>
  );
}
