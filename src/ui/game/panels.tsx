// The battle screen's panels: Time track (Sudden Death, reinforcements), Victory (VP, Surrender, casualty rows),
// Objectives and chits, the Initiative, the hands (yours face up, the opponent's as backs), decks and discard piles, and
// the battle log.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CardBack, Counter, FateCardView, Marker } from '../../art';
import { OBJECTIVE_CHITS } from '../../engine/data';
import { cardOf, counterType } from '../../engine/state';
import type { CardId, GameState, Side } from '../../engine/types';
import { UNKNOWN_CARD, UNKNOWN_CHIT, other } from '../../engine/types';
import { TIME_TRACK_LAST } from '../../engine/casualties';
import { Modal, Tooltip } from '../kit';
import type { LogLine } from './controller';
import { logRows, vpTotalText } from './log';
import { chitText, pieceName, sideName } from './names';
import { objectiveWorth, worthText } from './objectiveWorth';
import { artilleryBox } from './artillery';

function Box({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`gp-box kit-paper ${className ?? ''}`}>
      <header className="gp-box__head">
        <h3>{title}</h3>
        {aside ? <span className="gp-box__aside">{aside}</span> : null}
      </header>
      {children}
    </section>
  );
}

const card = (id: CardId) => {
  try {
    return cardOf(id);
  } catch {
    return null;
  }
};

// ------------------------------------------------------------------------------------------------------ Time track

export function TimePanel({ s, human }: { s: GameState; human: Side }) {
  const spaces = Array.from({ length: TIME_TRACK_LAST + 1 }, (_, i) => i);
  const waiting: Record<number, Record<Side, string[]>> = {};
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where !== 'time' || p.space < 0) continue;
    const t = counterType(p.type);
    if (t.kind === 'weapon') continue;
    waiting[p.space] ??= { axis: [], allied: [] };
    waiting[p.space][p.side].push(pieceName(s, id));
  }
  return (
    <Box title="Time" aside={<>Sudden Death {s.suddenDeath}</>}>
      <div className="gp-time">
        {spaces.map((n) => {
          const w = waiting[n];
          const cls = `gp-time__space ${n === s.time ? 'is-now' : ''} ${n >= s.suddenDeath ? 'is-sd' : ''} ${n < s.time ? 'is-past' : ''}`;
          const tip = w ? (['axis', 'allied'] as Side[]).filter((x) => w[x].length).map((x) => `${sideName(s, x)}: ${w[x].join(', ')}`).join('\n') : undefined;
          return (
            <div key={n} className={cls} title={tip ?? (n === s.suddenDeath ? 'Sudden Death' : undefined)}>
              <span className="gp-time__n">{n}</span>
              {n === s.time ? <span className="gp-time__marker" aria-label="Time marker" /> : null}
              {n === s.suddenDeath ? <span className="gp-time__sd">SD</span> : null}
              {w ? (
                <span className="gp-time__reinf">
                  {(['axis', 'allied'] as Side[]).map((x) =>
                    w[x].length ? (
                      <i key={x} className={`gp-dot gp-dot--${x === human ? 'you' : 'them'}`}>
                        {w[x].length}
                      </i>
                    ) : null,
                  )}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="gp-note">
        From Time {s.suddenDeath} on, every Time advance rolls for Sudden Death: below the Time space, the battle ends.
      </p>
    </Box>
  );
}

// --------------------------------------------------------------------------------------------------------- Victory

export function VictoryPanel({ s, human }: { s: GameState; human: Side }) {
  const vp = s.vp;
  const toYou = human === 'axis' ? vp : -vp;
  const pct = Math.max(-1, Math.min(1, vp / 20));
  return (
    <Box title="Victory">
      <div className="gp-vp">
        <div className={`gp-vp__total ${toYou > 0 ? 'is-good' : toYou < 0 ? 'is-bad' : ''}`}>
          <b>{Math.abs(vp)}</b> <span>{vp === 0 ? 'VP — even' : `VP to the ${vp > 0 ? sideName(s, 'axis') : sideName(s, 'allied')}`}</span>
        </div>
        <div className="gp-vp__bar" aria-hidden>
          <span className="gp-vp__mid" />
          <span className={`gp-vp__fill ${vp >= 0 ? 'is-axis' : 'is-allied'}`} style={{ width: `${Math.abs(pct) * 50}%`, [vp >= 0 ? 'left' : 'right']: '50%' }} />
        </div>
        <div className="gp-vp__ends">
          <span>{sideName(s, 'allied')}</span>
          <span>{sideName(s, 'axis')}</span>
        </div>
      </div>
      {([human, other(human)] as Side[]).map((side) => {
        const pl = s.players[side];
        const n = pl.casualties.length;
        return (
          <div key={side} className="gp-cas">
            <div className="gp-cas__head">
              <span>{side === human ? 'Your casualties' : `${sideName(s, side)} casualties`}</span>
              <b className={n >= pl.surrender - 1 ? 'is-bad' : ''}>
                {n} / {pl.surrender}
              </b>
            </div>
            <div className="gp-cas__row" title={`Surrender at ${pl.surrender} casualties`}>
              {Array.from({ length: Math.max(pl.surrender, n) }, (_, i) => {
                const id = pl.casualties[i];
                const p = id ? s.pieces[id] : null;
                return (
                  <span key={i} className={`gp-cas__slot ${i === pl.surrender - 1 ? 'is-surrender' : ''}`} title={p ? pieceName(s, id) : undefined}>
                    {p ? <Counter type={counterType(p.type)} size={18} /> : null}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </Box>
  );
}

// ------------------------------------------------------------------------------------------------------ Objectives

export function ObjectivesPanel({ s, human }: { s: GameState; human: Side }) {
  const mine = s.players[human].secretChits;
  const theirs = s.players[other(human)].secretChits;
  return (
    <Box title="Objectives">
      <div className="gp-objs">
        {s.map.objectives.map((_, i) => {
          const c = s.control[i];
          const w = objectiveWorth(s, human, i + 1);
          const title = `${worthText(s, human, i + 1)}. ${c ? `${sideName(s, c)} control` : 'Uncontrolled'}.`;
          return (
            <div key={i} className={`gp-obj ${c ? (c === human ? 'is-you' : 'is-them') : ''}`} title={title}>
              <span className="gp-obj__n">{i + 1}</span>
              <span className="gp-obj__v">
                <span className={w.secret.length ? 'gp-obj__secret' : undefined}>{w.total}</span> VP
                {w.more ? <span className="gp-obj__more">+?</span> : null}
              </span>
              <span className="gp-obj__c">{c ? (c === human ? 'yours' : 'enemy') : '—'}</span>
            </div>
          );
        })}
      </div>
      <div className="gp-chits">
        {s.openChits.map((c) => (
          <span key={c} className="gp-chit is-open" title={chitText(c)}>
            {c}
          </span>
        ))}
        {mine.map((c) => (
          <span key={c} className="gp-chit is-mine" title={`Your secret objective: ${chitText(c)}`}>
            {c}
          </span>
        ))}
        {theirs.map((c, i) => (
          <span key={`t${i}`} className="gp-chit is-hidden" title="The enemy's secret objective">
            {c === UNKNOWN_CHIT || !OBJECTIVE_CHITS[c] ? '?' : c}
          </span>
        ))}
      </div>
      <p className="gp-note">
        {s.openChits.length ? 'Open chits score for whoever controls their Objective. ' : ''}
        {mine.length ? 'Your secret chits (gold) score when revealed; gold values include them. ' : ''}
        {theirs.length ? '+?: an enemy secret chit could add to it.' : ''}
      </p>
    </Box>
  );
}

// ------------------------------------------------------------------------------------------------- Artillery Boxes

/** Each side's Artillery Box: its Radio (broken face when broken), calibre and FP, or "No Radio"; open information. */
export function ArtilleryPanel({ s, human }: { s: GameState; human: Side }) {
  return (
    <Box title="Artillery">
      <div className="gp-arty">
        {([human, other(human)] as Side[]).map((side) => {
          const b = artilleryBox(s, side);
          return (
            <div key={side} className={`gp-arty__side is-${b.status} ${side === human ? 'is-you' : 'is-them'}`} title={b.tip}>
              <span className="gp-arty__who">{side === human ? 'You' : sideName(s, side)}</span>
              <span className="gp-arty__counter">
                {b.type ? <Counter type={b.type} broken={b.broken} size={44} /> : <span className="gp-arty__empty" aria-hidden="true" />}
              </span>
              <span className="gp-arty__text">
                {b.type ? (
                  <b>
                    {b.calibre || 'Radio'} · FP {b.fp}
                  </b>
                ) : null}
                <span className="gp-arty__status">{b.label}</span>
              </span>
            </div>
          );
        })}
      </div>
    </Box>
  );
}

// ---------------------------------------------------------------------------------------------------------- Hands

export function HandStrip({
  s, human, playable, tags, picked, onCard, small = false,
}: {
  s: GameState;
  human: Side;
  /** Smaller cards (narrow screens). */
  small?: boolean;
  playable: readonly CardId[];
  tags: Record<CardId, string>;
  picked: readonly CardId[];
  onCard: (c: CardId) => void;
}) {
  const hand = s.players[human].hand;
  const [hover, setHover] = useState<{ id: CardId; x: number; y: number } | null>(null);
  // overlap the cards when the hand is wider than its room
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setRoom(el.clientWidth));
    ro.observe(el);
    setRoom(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const cw = small ? 84 : 120;
  const gap = hand.length > 1 && room ? Math.min(6, Math.floor((room - 8 - hand.length * cw) / (hand.length - 1))) : 6;
  return (
    <div className="gp-hand" ref={ref} onMouseLeave={() => setHover(null)}>
      {hand.map((id, i) => {
        const c = card(id);
        if (!c) return null;
        const can = playable.includes(id);
        const on = picked.includes(id);
        return (
          <button
            type="button"
            key={id}
            className={`gp-card ${can ? 'is-playable' : ''} ${on ? (tags[id] === 'Discard' ? 'is-picked' : 'is-chosen') : ''}`}
            style={i ? { marginLeft: gap - 6 } : undefined}
            onClick={() => onCard(id)}
            onMouseEnter={(e) => setHover({ id, x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => setHover({ id, x: e.clientX, y: e.clientY })}
            aria-label={`${c.order} / ${c.action} / ${c.event}`}
          >
            {tags[id] ? <span className="gp-card__tag">{tags[id]}</span> : null}
            <FateCardView card={c} size={small ? 'sm' : 'md'} highlight={tags[id] && tags[id] !== 'Discard' ? 'order' : null} />
          </button>
        );
      })}
      {!hand.length ? <div className="gp-hand__empty">No cards in hand.</div> : null}
      {hover && card(hover.id) ? (
        <Tooltip x={hover.x} y={hover.y - 360} variant="bare" offset={12}>
          <FateCardView card={card(hover.id)!} size="lg" />
        </Tooltip>
      ) : null}
    </div>
  );
}

/** The opponent's hand (backs), both decks and both discard piles. */
export function DecksPanel({ s, human, compact = false }: { s: GameState; human: Side; compact?: boolean }) {
  const [browse, setBrowse] = useState<Side | null>(null);
  const opp = other(human);
  const theirs = s.players[opp];
  return (
    <div className={`gp-decks ${compact ? 'is-compact' : ''}`}>
      <div className="gp-deckrow">
        <div className="gp-deckrow__label">{sideName(s, opp)}</div>
        <div className="gp-opphand" title={`${theirs.hand.length} cards in hand`}>
          {theirs.hand.map((c, i) => (
            <span key={i} className="gp-opphand__card" style={{ marginLeft: i ? -30 : 0 }}>
              {c === UNKNOWN_CARD || !card(c) ? <CardBack nation={theirs.nation} size="sm" /> : <FateCardView card={card(c)!} size="sm" />}
            </span>
          ))}
          <span className="gp-count">{theirs.hand.length}</span>
        </div>
        <Pile s={s} side={opp} onBrowse={() => setBrowse(opp)} />
      </div>
      <div className="gp-deckrow">
        <div className="gp-deckrow__label">You</div>
        <Pile s={s} side={human} onBrowse={() => setBrowse(human)} />
      </div>
      <Modal open={browse !== null} title={browse ? `${sideName(s, browse)} discard pile` : ''} onClose={() => setBrowse(null)} width={760}>
        {browse ? <DiscardList s={s} side={browse} /> : null}
      </Modal>
    </div>
  );
}

function Pile({ s, side, onBrowse }: { s: GameState; side: Side; onBrowse: () => void }) {
  const p = s.players[side];
  const top = p.discards[p.discards.length - 1];
  const c = top ? card(top) : null;
  return (
    <div className="gp-pile">
      <div className="gp-pile__deck gp-mini" title="Draw pile (face down)">
        <CardBack nation={p.nation} size="sm" />
        <span className="gp-count">{p.deck.length}</span>
      </div>
      <button type="button" className="gp-pile__discard gp-mini" onClick={onBrowse} title="Discard pile: click to browse" disabled={!p.discards.length}>
        {c ? <FateCardView card={c} size="sm" /> : <span className="gp-pile__empty">discards</span>}
        <span className="gp-count">{p.discards.length}</span>
      </button>
    </div>
  );
}

function DiscardList({ s, side }: { s: GameState; side: Side }) {
  const list = s.players[side].discards.slice().reverse();
  if (!list.length) return <p>No cards yet.</p>;
  return (
    <div className="gp-discards">
      {list.map((id, i) => {
        const c = card(id);
        return c ? <FateCardView key={`${id}-${i}`} card={c} size="md" /> : null;
      })}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------ Log

export function LogPanel({ log, s, human }: { log: readonly LogLine[]; s: GameState; human: Side }) {
  const ref = useRef<HTMLDivElement>(null);
  // follow the newest line unless the reader has scrolled up; keep following when the panel changes size
  const stick = useRef(true);
  const toEnd = () => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  };
  const last = log.length ? log[log.length - 1].id : 0;
  useEffect(toEnd, [last]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(toEnd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <section className="gp-log kit-paper" aria-label="Battle log">
      <header className="gp-box__head">
        <h3>Battle log</h3>
        <span className="gp-box__aside">VP {vpTotalText(s.vp)}</span>
      </header>
      <div
        className="gp-log__lines"
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
        }}
      >
        {logRows(log).map((l) => (
          <div
            key={l.id}
            className={`gp-log__line gp-log__line--${l.kind} gp-log__line--d${l.depth} ${l.side ? (l.side === human ? 'is-you' : 'is-them') : ''} ${l.reaction ? 'is-reaction' : ''}`}
          >
            {l.reaction ? <span className="gp-log__tag">reaction</span> : null}
            {l.text}
          </div>
        ))}
      </div>
    </section>
  );
}

/** The Initiative card holder, as a small marker with a label. */
export function InitiativeBadge({ s, human }: { s: GameState; human: Side }) {
  return (
    <span className={`gp-init ${s.initiative === human ? 'is-you' : 'is-them'}`} title="The Initiative card: cancels a roll, wins ties">
      <Marker kind="initiative" side={s.initiative} size={22} />
      {s.initiative === human ? 'You hold the Initiative' : `${sideName(s, s.initiative)} hold the Initiative`}
    </span>
  );
}
