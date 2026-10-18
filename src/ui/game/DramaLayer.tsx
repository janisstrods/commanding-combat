// The randomiser and the hits of an Event or Sniper! on the map (randomiser.ts), drawn in board coordinates (hex
// radius units) inside the Board, so they zoom and pan with it: the hops (CSS-timed), the landed Random Hex with its
// label and what it reaches (a Sniper's reach, the nearest units an Event goes to instead), and a short burst on each
// hex hit. Nothing here is clickable.
import { label } from '../../engine/hex';
import { hexCentre, hexPoints } from '../board';
import type { HexPick, Impact } from './randomiser';
import './drama.css';

function tone(p: HexPick): string {
  return p.reason === 'sniper' ? 'sniper' : p.reason === 'setup' || p.reason === 'other' ? 'setup' : 'event';
}

/** A sniper's sight: a ring with four ticks, centred on (0, 0). */
function Reticle({ r }: { r: number }) {
  const t = r * 0.45;
  return (
    <>
      <circle r={r} />
      <circle r={r * 0.12} className="dr-dot" />
      <line x1={-r - t} y1={0} x2={-r + t} y2={0} />
      <line x1={r - t} y1={0} x2={r + t} y2={0} />
      <line x1={0} y1={-r - t} x2={0} y2={-r + t} />
      <line x1={0} y1={r - t} x2={0} y2={r + t} />
    </>
  );
}

function PickView({ pick, rotate180 }: { pick: HexPick; rotate180: boolean }) {
  const c = hexCentre(pick.target, rotate180);
  const name = label(pick.target);
  const w = name.length * 0.2 + 0.36;
  return (
    <g className={`dr-pick dr-pick--${tone(pick)} ${pick.calm ? 'is-calm' : ''}`}>
      {!pick.landed
        ? pick.hops.map((h, i) => (
            <polygon
              key={i}
              points={hexPoints(h.hex, rotate180, 0.94)}
              className="dr-hop"
              style={{ animationDelay: `${h.at}ms`, animationDuration: `${Math.max(180, Math.round(h.ms * 2.4))}ms` }}
            />
          ))
        : null}
      {pick.landed ? (
        <>
          {pick.area
            .filter((h) => h !== pick.target)
            .map((h) => (
              <polygon key={`a${h}`} points={hexPoints(h, rotate180, 0.92)} className="dr-area" />
            ))}
          {pick.redirect.map((h) => {
            const b = hexCentre(h, rotate180);
            return (
              <g key={`r${h}`} className="dr-redirect">
                <line x1={c.x} y1={c.y} x2={b.x} y2={b.y} className="dr-link" />
                <polygon points={hexPoints(h, rotate180, 0.92)} />
              </g>
            );
          })}
          <polygon points={hexPoints(pick.target, rotate180, 1)} className="dr-target" />
          <g transform={`translate(${c.x} ${c.y})`}>
            <circle r={0.05} className="dr-anchor" />
            {pick.calm ? null : <circle r={0.9} className="dr-shock" />}
            {pick.reason === 'sniper' ? (
              <g className="dr-reticle">
                <Reticle r={0.62} />
              </g>
            ) : null}
          </g>
          <g transform={`translate(${c.x} ${c.y - 1.12})`}>
            <g className="dr-chip">
              <rect x={-w / 2} y={-0.21} width={w} height={0.42} rx={0.08} />
              <text y={0.12}>{name}</text>
            </g>
          </g>
        </>
      ) : null}
    </g>
  );
}

function ImpactView({ impact, rotate180 }: { impact: Impact; rotate180: boolean }) {
  const c = hexCentre(impact.hex, rotate180);
  const a = impact.from !== null ? hexCentre(impact.from, rotate180) : null;
  return (
    <g className={`dr-impact dr-impact--${impact.look}`}>
      {a ? <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} className="dr-link" /> : null}
      <polygon points={hexPoints(impact.hex, rotate180, 0.96)} className="dr-impact__hex" />
      <g transform={`translate(${c.x} ${c.y})`}>
        <circle r={0.05} className="dr-anchor" />
        {impact.look === 'crosshair' ? (
          <g className="dr-impact__sight">
            <Reticle r={0.55} />
          </g>
        ) : (
          <circle r={0.7} className="dr-impact__ring" />
        )}
      </g>
    </g>
  );
}

export function DramaLayer({ pick, impacts, rotate180 }: { pick: HexPick | null; impacts: readonly Impact[]; rotate180: boolean }) {
  if (!pick && !impacts.length) return null;
  return (
    <g pointerEvents="none" className="dr-layer">
      {pick ? <PickView key={pick.id} pick={pick} rotate180={rotate180} /> : null}
      {impacts.map((i) => (
        <ImpactView key={i.id} impact={i} rotate180={rotate180} />
      ))}
    </g>
  );
}
