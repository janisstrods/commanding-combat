// A stack of counters in a hex: drawn bottom to top with a diagonal offset, or fanned out in a grid when expanded.
// The board knows nothing about game pieces: the caller passes ready-made nodes (e.g. Task 5's Counter), each drawn
// centred on (0, 0) at `size` hex units (default 0.8: a counter about half a hex across).
import type { ReactNode } from 'react';
import type { Point } from '../../engine/hex';

export interface StackItem {
  key: string;
  node: ReactNode;
}

/** Offsets of the items of a stack of `n` (index 0 = bottom), centred on the hex centre. */
export function stackOffsets(n: number, opts: { size?: number; step?: number; expanded?: boolean } = {}): Point[] {
  const size = opts.size ?? 0.8;
  const step = opts.step ?? 0.08;
  if (n <= 0) return [];
  if (!opts.expanded) {
    const mid = (n - 1) / 2;
    return Array.from({ length: n }, (_, i) => ({ x: (i - mid) * step, y: -(i - mid) * step }));
  }
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gap = size * 1.1;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;
    return { x: (c - (inRow - 1) / 2) * gap, y: (r - (rows - 1) / 2) * gap };
  });
}

export function StackView(p: { items: readonly StackItem[]; size?: number; step?: number; expanded?: boolean }) {
  const offs = stackOffsets(p.items.length, p);
  const size = p.size ?? 0.8;
  return (
    <g className={`board-stack ${p.expanded ? 'is-expanded' : ''}`}>
      {p.expanded && p.items.length > 1 ? (
        <rect
          className="board-stack__tray"
          x={Math.min(...offs.map((o) => o.x)) - size * 0.62}
          y={Math.min(...offs.map((o) => o.y)) - size * 0.62}
          width={Math.max(...offs.map((o) => o.x)) - Math.min(...offs.map((o) => o.x)) + size * 1.24}
          height={Math.max(...offs.map((o) => o.y)) - Math.min(...offs.map((o) => o.y)) + size * 1.24}
          rx={0.06}
        />
      ) : null}
      {p.items.map((it, i) => (
        <g key={it.key} transform={`translate(${offs[i].x} ${offs[i].y})`}>
          {it.node}
        </g>
      ))}
    </g>
  );
}
