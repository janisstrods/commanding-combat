// The Fire Attack panel on the board: who fires at whom, the attack total built line by line (each piece's FP, Leader,
// group, Hindrance, height, Actions, the Fate roll, the total), then each defender's Morale + Cover, the roll it needs
// to hold, its roll and the result. Drawn from the controller's FireShow (fireShow.ts); lines appear one after another.
import { useLayoutEffect, useRef, useState } from 'react';
import type { GameState, HexId, Side } from '../../engine/types';
import { hexCentre } from '../board';
import type { Speed } from './controller';
import { defenderNeed, facing, type DefenderShow, type DefenseResult, type FireShow } from './fireShow';
import { hexName, pieceName, sideName } from './names';
import { needPhrase } from './odds';
import './fire.css';

const STAGGER: Record<Speed, number> = { slow: 220, normal: 130, fast: 60, instant: 0 };

export type Corner = 'tr' | 'br' | 'bl';
const CORNERS: readonly Corner[] = ['tr', 'br', 'bl']; // top left is the shown card's
const MARGIN = 10;
/** The panel's height for placing it (it grows as the attack goes on). */
const PLACE_HEIGHT = 330;

/**
 * The corner of the board area where the panel covers the least of the attack: the one whose box is farthest from
 * the firing and target hexes, found on screen through the overlay's own transform (so it follows zoom and pan).
 */
export function placeCorner(panel: HTMLElement, overlay: string, hexes: HexId[], rotate180: boolean): Corner | null {
  const host = panel.offsetParent as HTMLElement | null;
  const g = host?.querySelector<SVGGraphicsElement>(overlay);
  const m = g?.getScreenCTM();
  if (!host || !m || !hexes.length) return null;
  const box = host.getBoundingClientRect();
  const w = panel.offsetWidth;
  const h = Math.min(PLACE_HEIGHT, box.height - 2 * MARGIN);
  const pts = hexes.map((hex) => {
    const p = hexCentre(hex, rotate180);
    return { x: m.a * p.x + m.c * p.y + m.e - box.left, y: m.b * p.x + m.d * p.y + m.f - box.top };
  });
  const rect = (c: Corner) => {
    const x0 = c === 'bl' ? MARGIN : box.width - MARGIN - w;
    const y0 = c === 'tr' ? MARGIN : box.height - MARGIN - h;
    return { x0, y0, x1: x0 + w, y1: y0 + h };
  };
  let best: Corner = 'tr';
  let bestGap = -Infinity;
  for (const c of CORNERS) {
    const r = rect(c);
    const gap = Math.min(...pts.map((p) => Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.y0 - p.y, 0, p.y - r.y1))));
    if (gap > bestGap + 1) {
      best = c;
      bestGap = gap;
    }
  }
  return best;
}

const RESULT_TEXT: Record<DefenseResult, string> = { holds: 'Holds', suppressed: 'Suppressed', broken: 'Broken', eliminated: 'Eliminated' };

function names(s: GameState, show: FireShow): string {
  const list = show.pieces.map((id) => pieceName(s, id));
  if (!list.length) return show.title === 'Mines' ? 'Mines' : '—';
  return list.length <= 3 ? list.join(', ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`;
}

function Defender({ show, d, human, delayMs }: { show: FireShow; d: DefenderShow; human: Side; delayMs: number }) {
  const base = d.morale !== null && d.cover !== null ? d.morale + d.cover : null;
  const against = d.against ?? facing(show);
  const need = defenderNeed(show, d);
  const provisional = d.against === null && show.total === null;
  return (
    <li className={`fp-def ${d.active ? 'is-active' : ''} ${d.result ? `is-${d.result}` : ''} ${d.side === human ? 'is-mine' : ''}`} style={{ animationDelay: `${delayMs}ms` }}>
      <div className="fp-def__head">
        <span className="fp-def__name">
          {d.side === human ? 'Your ' : ''}
          {d.name}
        </span>
        {d.result ? <b className="fp-def__result">{RESULT_TEXT[d.result]}</b> : null}
      </div>
      {base !== null ? (
        <div className="fp-def__row">
          <span>
            Morale {d.morale} + Cover {d.cover} = <b>{base}</b>
          </span>
        </div>
      ) : null}
      {base !== null && against !== null && need !== null && !d.roll ? (
        <div className="fp-def__need">
          <b>{needPhrase(base, against, d.moving)}</b>
          {provisional ? <small> if the roll is kept</small> : null}
        </div>
      ) : null}
      {d.roll && base !== null ? (
        <div className="fp-def__row fp-def__roll">
          <span>
            Roll {d.roll.dice ? <small>({d.roll.dice})</small> : null} {d.roll.value} → {base + d.roll.value}
            {against !== null ? (
              <>
                {' '}
                vs <b>{against}</b>
              </>
            ) : null}
          </span>
          {need !== null ? <small className="fp-def__needs">{need <= 2 ? 'any roll holds' : need > 12 ? 'no roll holds' : `needed ${need}+`}</small> : null}
        </div>
      ) : null}
    </li>
  );
}

export function FirePanel({
  show, s, human, speed, rotate180, onClose,
}: {
  show: FireShow;
  s: GameState;
  human: Side;
  speed: Speed;
  rotate180: boolean;
  onClose: () => void;
}) {
  const mine = show.side === human;
  const ref = useRef<HTMLElement>(null);
  const [corner, setCorner] = useState<Corner>('tr');
  const where = [...show.from, ...show.targets];
  const whereKey = where.join(',');
  useLayoutEffect(() => {
    if (ref.current) setCorner(placeCorner(ref.current, `.fo[data-fire="${show.id}"]`, where, rotate180) ?? 'tr');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.id, whereKey, rotate180]);
  const step = STAGGER[speed];
  const delay = (i: number) => ({ animationDelay: `${i * step}ms` });
  const total = facing(show);
  const night = show.total !== null && show.fp !== null && show.roll ? show.total - show.fp - show.roll.value - show.airburst : 0;
  let i = 0;
  return (
    <section ref={ref} className={`fp-panel fp-panel--${corner} ${mine ? 'is-you' : 'is-them'} fp--${show.stage}`} aria-live="polite" aria-label="Fire Attack">
      <header className="fp-head">
        <span className="fp-head__title">{show.title}</span>
        <span className="fp-head__side">
          {sideName(s, show.side)}
          {mine ? ' (you)' : ''}
        </span>
        <button type="button" className="fp-close" onClick={onClose} aria-label="Close the Fire Attack panel">
          ×
        </button>
      </header>
      <div className="fp-aim">
        <span className="fp-aim__who">{names(s, show)}</span>
        <span className="fp-aim__arrow" aria-hidden="true">
          ➜
        </span>
        <span className="fp-aim__at">{show.targets.map(hexName).join(' + ')}</span>
      </div>
      {show.targeting ? (
        <div className={`fp-targeting ${show.targeting.hit ? 'is-hit' : 'is-miss'}`}>
          Targeting roll {show.targeting.product}, needs {show.targeting.need}+: <b>{show.targeting.hit ? 'hit' : 'miss'}</b>
        </div>
      ) : null}
      {show.lines.length ? (
        <ol className="fp-lines">
          {show.lines.map((l) => (
            <li key={l.key} className={`fp-line fp-line--${l.kind}`} style={delay(i++)}>
              <span className="fp-line__label">
                {l.label}
                {l.note ? <small>{l.note}</small> : null}
              </span>
              <span className="fp-line__value">{l.value}</span>
            </li>
          ))}
          {show.roll ? (
            <li key="roll" className="fp-line fp-line--roll">
              <span className="fp-line__label">
                Fate roll
                <small>
                  {show.roll.dice}
                  {show.roll.rerolled ? ' · re-rolled' : ''}
                </small>
              </span>
              <span className="fp-line__value">+{show.roll.value}</span>
            </li>
          ) : show.stage === 'power' ? (
            <li key="roll-wait" className="fp-line fp-line--wait" style={delay(i)}>
              <span className="fp-line__label">Fate roll…</span>
              <span className="fp-line__value">?</span>
            </li>
          ) : null}
          {show.airburst && show.roll ? (
            <li key="airburst" className="fp-line fp-line--plus">
              <span className="fp-line__label">
                Airburst<small>Mortar into Woods</small>
              </span>
              <span className="fp-line__value">+{show.airburst}</span>
            </li>
          ) : null}
          {night ? (
            <li key="night" className="fp-line fp-line--minus">
              <span className="fp-line__label">Night</span>
              <span className="fp-line__value">{night}</span>
            </li>
          ) : null}
          {total !== null ? (
            <li key="total" className={`fp-line fp-line--total ${show.total === null ? 'is-provisional' : ''}`} style={delay(1)}>
              <span className="fp-line__label">
                Attack total
                {show.total === null ? <small>if kept</small> : null}
              </span>
              <span className="fp-line__value">{total}</span>
            </li>
          ) : null}
        </ol>
      ) : null}
      {show.defenders.length ? (
        <ol className="fp-defs">
          {show.defenders.map((d) => (
            <Defender key={d.unit} show={show} d={d} human={human} delayMs={(show.lines.length + 1) * step} />
          ))}
        </ol>
      ) : null}
      {show.note ? <div className="fp-note">{show.note}</div> : null}
    </section>
  );
}
