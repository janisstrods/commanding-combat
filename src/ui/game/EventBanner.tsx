// The banner of an Event or Sniper! being carried out (randomiser.ts): its name and our paraphrase of what it does,
// the card revealed for its Random Hex (face down while the randomiser runs, face up once it lands) with what that hex
// reaches, and the lines of what it did as they happen. It sits at the top of the board, or at the bottom when the
// Random Hex or a hit lies under it. A click, a tap or Space ends a reading pause early (the board's own hurry).
import { useLayoutEffect, useRef, useState } from 'react';
import { FateCardView } from '../../art';
import { label } from '../../engine/hex';
import { cardOf } from '../../engine/state';
import type { CardId, GameState, Side } from '../../engine/types';
import { sideName } from './names';
import type { Banner } from './randomiser';
import './drama.css';

function safeCard(id: CardId | null) {
  if (!id) return null;
  try {
    return cardOf(id);
  } catch {
    return null;
  }
}

/** Does the banner cover the landed Random Hex or a hit (their anchors are drawn by DramaLayer)? */
function covers(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const board = el.parentElement;
  if (!board) return false;
  for (const a of board.querySelectorAll('.dr-anchor')) {
    const p = a.getBoundingClientRect();
    const x = p.left + p.width / 2;
    const y = p.top + p.height / 2;
    if (x > r.left - 24 && x < r.right + 24 && y > r.top - 24 && y < r.bottom + 24) return true;
  }
  return false;
}

export function EventBanner({ banner, s, human, choosing }: { banner: Banner; s: GameState; human: Side; choosing: boolean }) {
  const card = safeCard(banner.card);
  const hexCard = safeCard(banner.hexCard);
  const mine = banner.side === human;
  const ref = useRef<HTMLDivElement>(null);
  const [low, setLow] = useState(false);
  const up = banner.hex !== null;

  // once the hex is known (and as hits come in), keep it in sight: move to the bottom if the banner is over it
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !up) return;
    if (covers(el)) setLow((x) => !x);
  }, [up, banner.lines.length]);

  return (
    <div
      ref={ref}
      className={`eb eb--${banner.kind} ${mine ? 'is-you' : 'is-them'} ${low ? 'is-low' : ''} ${banner.calm ? 'is-calm' : ''} ${banner.done ? 'is-done' : ''}`}
      role="status"
      aria-live="polite"
    >
      {card ? (
        <div className="eb__card">
          <FateCardView card={card} size="sm" highlight="event" texts={false} />
        </div>
      ) : null}
      <div className="eb__body">
        <div className="eb__kicker">
          {banner.kind === 'event' ? 'Event' : 'Trigger'} · {mine ? 'yours' : `the ${sideName(s, banner.side)}’`}
        </div>
        <div className="eb__title">{banner.title}</div>
        <p className="eb__text">{banner.text}</p>
        {hexCard && banner.note ? <p className="eb__note">{banner.note}</p> : null}
        {banner.lines.length ? (
          <ul className="eb__lines">
            {banner.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        ) : null}
        <div className="eb__hint">{choosing ? 'Your choice — see the panel.' : banner.hold ? 'Click, tap or press Space to go on' : ' '}</div>
      </div>
      {hexCard ? (
        <div className="eb__hex">
          <div className={`eb__hexcard ${up ? 'is-up' : 'is-down'}`} key={up ? 'up' : 'down'}>
            <FateCardView card={hexCard} size="sm" faceDown={!up} texts={false} />
          </div>
          <div className="eb__hexname">
            <small>Random Hex</small>
            <b>{up ? label(banner.hex!) : '…'}</b>
          </div>
        </div>
      ) : null}
    </div>
  );
}
