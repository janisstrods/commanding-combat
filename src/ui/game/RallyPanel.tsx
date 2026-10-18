// A Recover, Rout or Commissar as a small scene (rallyShow.ts), in the Fire Attack panel's style: who rolls for whose
// units, then per unit its Morale (+ the Leader's part) + Cover, what each roll does — shown before the card is turned —,
// the roll and the result; for a retreat, who moves it and the hexes it goes through. Hero and Medic! show the unit they
// rally.
import { useLayoutEffect, useRef, useState } from 'react';
import type { GameState, Side } from '../../engine/types';
import type { Speed } from './controller';
import { placeCorner, type Corner } from './FirePanel';
import { hexName, sideName } from './names';
import { rallyHexes, rallyNeed, rallyTarget, type RallyResult, type RallyShow, type RallyUnitShow } from './rallyShow';
import './fire.css';
import './rally.css';

const STAGGER: Record<Speed, number> = { slow: 220, normal: 130, fast: 60, instant: 0 };

const RESULT_TEXT: Record<RallyResult, string> = {
  rallied: 'Rallied', suppressed: 'Suppressed', 'still broken': 'Still broken', holds: 'Holds', retreats: 'Retreats', eliminated: 'Eliminated',
};
/** Good for the unit's owner (green), half (amber), bad (red). */
const RESULT_TONE: Record<RallyResult, 'good' | 'half' | 'bad'> = {
  rallied: 'good', holds: 'good', suppressed: 'half', 'still broken': 'half', retreats: 'bad', eliminated: 'bad',
};

/** "You roll for your broken units", "The Germans roll for your broken units; you move any that retreat". */
export function rallyWho(show: RallyShow, s: GameState, human: Side): string {
  const who = (x: Side) => (x === human ? 'you' : `the ${sideName(s, x)}`);
  const Who = (x: Side) => (x === human ? 'You' : `The ${sideName(s, x)}`);
  const owner = show.units[0]?.side ?? show.roller;
  const whose = owner === human ? 'your' : owner === show.roller ? 'their' : `the ${sideName(s, owner)}’`;
  switch (show.kind) {
    case 'Recover':
      return `${Who(show.roller)} roll to rally ${whose} broken units`;
    case 'Rout':
      if (owner === show.roller) return `${Who(show.roller)} rout ${whose} own broken units`;
      return `${Who(show.roller)} roll for ${whose} broken units; ${who(owner)} move any that retreat`;
    case 'Commissar':
      return `${Who(show.roller)} roll for a broken unit: rallied or shot`;
    default:
      return `${Who(show.roller)} rally a broken unit, no roll`;
  }
}

function Unit({ show, u, s, human, delayMs }: { show: RallyShow; u: RallyUnitShow; s: GameState; human: Side; delayMs: number }) {
  const target = rallyTarget(u);
  const morale = u.morale !== null ? (u.command ? `Morale ${u.morale - u.command} + Leader ${u.command}` : `Morale ${u.morale}`) : null;
  const mover = u.side === human ? 'you move it' : `the ${sideName(s, u.side)} move it`;
  return (
    <li
      className={`fp-def rp-unit ${u.active ? 'is-active' : ''} ${u.result ? `is-${RESULT_TONE[u.result]}` : ''} ${u.side === human ? 'is-mine' : ''}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="fp-def__head">
        <span className="fp-def__name">
          {u.side === human ? 'Your ' : ''}
          {u.name}
          {u.from >= 0 ? <small className="rp-hex"> {hexName(u.from)}</small> : null}
        </span>
        {u.result ? <b className="fp-def__result">{RESULT_TEXT[u.result]}</b> : null}
      </div>
      {morale !== null && target !== null ? (
        <div className="fp-def__row">
          <span>
            {morale} {u.cover !== null && u.cover < 0 ? `− Cover ${-u.cover}` : `+ Cover ${u.cover}`} = <b>{target}</b>
          </span>
        </div>
      ) : null}
      {target !== null && !u.roll ? (
        <div className="fp-def__need">
          <b>{rallyNeed(show.kind, target)}</b>
        </div>
      ) : null}
      {u.roll && target !== null ? (
        <div className="fp-def__row fp-def__roll">
          <span>
            Roll {u.roll.dice ? <small>({u.roll.dice})</small> : null} <b>{u.roll.value}</b> vs {target}
          </span>
          <small className="fp-def__needs">{rallyNeed(show.kind, target).split(' · ')[0]}</small>
        </div>
      ) : null}
      {show.kind === 'Rout' && !u.retreat && !u.result && u.roll && target !== null && u.roll.value > target ? (
        <div className="fp-def__row rp-retreat">
          <span>
            Must go back {u.roll.value - target} hex{u.roll.value - target === 1 ? '' : 'es'} ({mover})
          </span>
        </div>
      ) : null}
      {u.retreat && u.retreat.hexes > 0 ? (
        <div className="fp-def__row rp-retreat">
          <span>
            Back {u.retreat.hexes} hex{u.retreat.hexes === 1 ? '' : 'es'} ({mover})
            {u.retreat.path.length ? `: ${[u.from, ...u.retreat.path].map(hexName).join(' → ')}` : ''}
            {u.result === 'eliminated' ? (u.retreat.end === 'edge' ? ', off its own map edge' : u.retreat.path.length ? ', then no way on' : ': no way back') : ''}
          </span>
        </div>
      ) : null}
    </li>
  );
}

export function RallyPanel({ show, s, human, speed, rotate180, onClose }: {
  show: RallyShow;
  s: GameState;
  human: Side;
  speed: Speed;
  rotate180: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [corner, setCorner] = useState<Corner>('tr');
  const where = rallyHexes(show);
  const whereKey = where.join(',');
  useLayoutEffect(() => {
    if (ref.current) setCorner(placeCorner(ref.current, `.ro[data-rally="${show.id}"]`, where, rotate180) ?? 'tr');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.id, whereKey, rotate180]);
  const mine = show.roller === human;
  const step = STAGGER[speed];
  return (
    <section ref={ref} className={`fp-panel fp-panel--${corner} rp-panel ${mine ? 'is-you' : 'is-them'}`} aria-live="polite" aria-label={show.kind}>
      <header className="fp-head">
        <span className="fp-head__title">{show.kind}</span>
        <span className="fp-head__side">
          {sideName(s, show.roller)}
          {mine ? ' (you)' : ''}
        </span>
        <button type="button" className="fp-close" onClick={onClose} aria-label={`Close the ${show.kind} panel`}>
          ×
        </button>
      </header>
      <div className="fp-aim rp-who">{rallyWho(show, s, human)}</div>
      {show.units.length ? (
        <ol className="fp-defs">
          {show.units.map((u, i) => (
            <Unit key={u.unit} show={show} u={u} s={s} human={human} delayMs={i * step} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
