// A Recover, Rout or Commissar on the board, in board coordinates (it zooms and pans with the map): the unit being
// rolled for ringed, each result labelled at the hex where the unit stood, and a retreat's path drawn hex by hex.
import type { HexId, Side } from '../../engine/types';
import { hexCentre } from '../board';
import type { RallyResult, RallyShow } from './rallyShow';

const LABEL: Record<RallyResult, string> = {
  rallied: 'Rallied', suppressed: 'Suppressed', 'still broken': 'Still broken', holds: 'Holds', retreats: 'Retreats', eliminated: 'Eliminated',
};
const TONE: Record<RallyResult, 'good' | 'half' | 'bad'> = {
  rallied: 'good', holds: 'good', suppressed: 'half', 'still broken': 'half', retreats: 'bad', eliminated: 'bad',
};

export function RallyOverlay({ show, human, rotate180 }: { show: RallyShow; human: Side; rotate180: boolean }) {
  const c = (h: HexId) => hexCentre(h, rotate180);
  const head = `ro-head-${show.id}`;
  return (
    <g className={`ro ${show.roller === human ? 'is-you' : 'is-them'} ${show.done ? 'ro--done' : ''}`} data-rally={show.id} pointerEvents="none">
      <defs>
        <marker id={head} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="0.42" markerHeight="0.42" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L10,5 L0,10 L2.5,5 z" className="ro-head" />
        </marker>
      </defs>
      {show.units.map((u) => {
        if (u.from < 0) return null;
        const p = c(u.from);
        const path = u.retreat?.path ?? [];
        const pts = [p, ...path.map(c)];
        const end = pts[pts.length - 1];
        return (
          <g key={u.unit} className={`ro-unit ${u.active ? 'is-active' : ''} ${u.result ? `is-${TONE[u.result]}` : ''}`}>
            <circle cx={p.x} cy={p.y} r={0.84} className="ro-ring" />
            {pts.length > 1
              ? pts.slice(1).map((q, i) => (
                  <g key={i}>
                    <line x1={pts[i].x} y1={pts[i].y} x2={q.x} y2={q.y} className="ro-path" markerEnd={`url(#${head})`} />
                    <circle cx={q.x} cy={q.y} r={0.12} className="ro-step" />
                  </g>
                ))
              : null}
            {u.result ? (
              <g transform={`translate(${end.x} ${end.y + 0.98})`}>
                <g className="ro-label">
                  <rect x={-(LABEL[u.result].length * 0.065 + 0.15)} y={-0.19} width={LABEL[u.result].length * 0.13 + 0.3} height={0.38} rx={0.1} />
                  <text y={0.1}>{LABEL[u.result]}</text>
                </g>
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
