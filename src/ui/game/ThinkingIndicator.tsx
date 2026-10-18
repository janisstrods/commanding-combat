// The "thinking…" indicator: while the computer plans an Order of its own Turn — the long decisions, up to 8 s at Line
// and 20 s at Elite — the opponent's name with a swinging compass needle, the time taken so far and a bar against the
// level's thinking time, so a long wait reads as deliberate. Quick decisions (reactions, move steps, choices) never
// show it: it appears only for an own-Turn decision, and only after a moment.
import { useEffect, useState } from 'react';
import { LEVELS } from '../../ai/levels';
import { other } from '../../engine/types';
import type { GameController, ViewState } from './controller';
import { sideName } from './names';
import './ThinkingIndicator.css';

/** Shown once a decision has taken this long (ms): quicker ones would only flicker. */
export const SHOW_AFTER_MS = 400;

const LEVEL_NAME = { green: 'Green', line: 'Line', elite: 'Elite' } as const;

export function ThinkingIndicator({ view, controller }: { view: ViewState; controller: GameController }) {
  const pending = controller.driver.pending;
  const opp = other(view.humanSide);
  const active = view.thinking && !view.over && !view.fatal && pending?.kind === 'turn' && pending.side === opp;
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) {
      setSince(null);
      return;
    }
    const t0 = performance.now();
    setSince(t0);
    setNow(t0);
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [active, pending]);
  if (!active || since === null) return null;
  const elapsed = now - since;
  if (elapsed < SHOW_AFTER_MS) return null;
  const level = controller.config.level;
  const budget = (LEVELS[level] ?? LEVELS.line).budgetMs;
  const s = view.display;
  const orders = s.players[opp].orders;
  const order = Math.min(orders, s.turn.ordersGiven + 1);
  const name = sideName(s, opp);
  return (
    <div className="ti kit-paper" role="status" aria-live="polite" data-testid="thinking">
      <svg className="ti__mark" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="13" className="ti__dial" />
        <path d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3" className="ti__ticks" />
        <g className="ti__needle">
          <path d="M16 6.5 19 16h-6z" className="ti__north" />
          <path d="M16 25.5 13 16h6z" className="ti__south" />
        </g>
        <circle cx="16" cy="16" r="1.6" className="ti__pin" />
      </svg>
      <div className="ti__body">
        <p className="ti__title">
          The {name} are planning their next Order<span className="ti__dots" aria-hidden />
        </p>
        <div className="ti__bar" aria-hidden>
          <span style={{ transform: `scaleX(${Math.min(1, elapsed / budget)})` }} />
        </div>
        <p className="ti__meta">
          {s.phase === 'play' ? `Order ${order} of ${orders} · ` : ''}
          {(elapsed / 1000).toFixed(elapsed < 10000 ? 1 : 0)} s · {LEVEL_NAME[level] ?? level} thinks up to {Math.round(budget / 1000)} s
        </p>
      </div>
    </div>
  );
}
