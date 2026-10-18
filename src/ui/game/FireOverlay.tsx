// The Fire Attack on the board, in board coordinates (it zooms and pans with the map): the firing hexes ringed, an
// arrow from each to the target hex(es), the target ringed, and the attack total next to it once rolled. Fades once
// every defender has rolled.
import type { HexId, Side } from '../../engine/types';
import { hexCentre } from '../board';
import type { FireShow } from './fireShow';

function arrow(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // from the edge of the firing hex's ring to the edge of the target's, the head ending on the ring
  const start = Math.min(0.5, len / 4);
  const end = Math.min(0.88, len / 3);
  return { x1: a.x + ux * start, y1: a.y + uy * start, x2: b.x - ux * end, y2: b.y - uy * end };
}

export function FireOverlay({ show, human, rotate180 }: { show: FireShow; human: Side; rotate180: boolean }) {
  const head = `fo-head-${show.id}`;
  const c = (h: HexId) => hexCentre(h, rotate180);
  const total = show.total;
  return (
    <g className={`fo ${show.side === human ? 'is-you' : 'is-them'} fo--${show.stage}`} data-fire={show.id} pointerEvents="none">
      <defs>
        <marker id={head} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="0.5" markerHeight="0.5" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L10,5 L0,10 L2.5,5 z" className="fo-head" />
        </marker>
      </defs>
      {show.from.map((h) => {
        const p = c(h);
        return <circle key={`from-${h}`} cx={p.x} cy={p.y} r={0.8} className="fo-from" />;
      })}
      {show.targets.map((t) => {
        const p = c(t);
        return (
          <g key={`t-${t}`}>
            <circle cx={p.x} cy={p.y} r={0.86} className="fo-target" />
            <path d={`M${p.x - 0.3},${p.y} h0.6 M${p.x},${p.y - 0.3} v0.6`} className="fo-cross" />
          </g>
        );
      })}
      {show.targets.flatMap((t) =>
        show.from.filter((f) => f !== t).map((f) => {
          const l = arrow(c(f), c(t));
          return <line key={`a-${f}-${t}`} {...l} className="fo-arrow" markerEnd={`url(#${head})`} />;
        }),
      )}
      {total !== null
        ? show.targets.map((t) => {
            const p = c(t);
            const label = `Attack ${total}`;
            const w = label.length * 0.13 + 0.3;
            return (
              <g key={`total-${t}`} transform={`translate(${p.x} ${p.y + 0.98})`}>
                <g className="fo-total">
                  <rect x={-w / 2} y={-0.2} width={w} height={0.4} rx={0.1} />
                  <text y={0.11}>{label}</text>
                </g>
              </g>
            );
          })
        : null}
    </g>
  );
}
