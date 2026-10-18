// The prompt: what the human is asked now (from the prompt model), with its buttons, choice lists, cards and the
// selected pieces as chips; or what is happening while he waits.
import { FateCardView } from '../../art';
import { cardOf } from '../../engine/state';
import type { Decision, GameState, PieceId, Side } from '../../engine/types';
import { Button } from '../kit';
import { DeployPanel } from '../screens/Deploy';
import type { ViewState } from './controller';
import { hexName, pieceName, sideName } from './names';
import type { PromptButton, PromptModel } from './prompts';

const card = (id: string) => {
  try {
    return cardOf(id);
  } catch {
    return null;
  }
};

export function PromptPanel({
  view, s, d, model, human, onButton, onPiece, onCard, onHoverPieces,
}: {
  view: ViewState;
  s: GameState;
  d: Decision | null;
  model: PromptModel | null;
  human: Side;
  onButton: (b: PromptButton) => void;
  onPiece: (id: PieceId) => void;
  onCard: (id: string) => void;
  onHoverPieces: (ids: PieceId[] | null) => void;
}) {
  if (view.over) {
    return (
      <section className="gp-prompt kit-paper">
        <h2 className="gp-prompt__title">Battle over</h2>
        <p>The {sideName(s, view.over.winner)} have won.</p>
      </section>
    );
  }
  if (!d || !model) return <Waiting view={view} s={s} human={human} />;
  const chips = model.kind !== 'deploy' && model.pieces.length > 0 && model.pieces.length <= 14 && model.kind !== 'choose';
  return (
    <section className={`gp-prompt kit-paper gp-prompt--${model.kind}`} aria-live="polite">
      <h2 className="gp-prompt__title">{model.title}</h2>
      <p className="gp-prompt__text">{model.text}</p>
      {model.detail.length ? (
        <ul className="gp-prompt__detail">
          {model.detail.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : null}
      {d.kind === 'deploy' ? <DeployPanel s={s} d={d} selected={model.selected} onPiece={onPiece} /> : null}
      {chips ? (
        <div className="gp-chips">
          {model.pieces.map((id) => (
            <button
              key={id}
              type="button"
              className={`gp-chip ${model.selected.includes(id) ? 'is-on' : ''}`}
              onClick={() => onPiece(id)}
              onMouseEnter={() => onHoverPieces([id])}
              onMouseLeave={() => onHoverPieces(null)}
            >
              {pieceName(s, id)} <small>{hexName(hexOf(s, id))}</small>
            </button>
          ))}
        </div>
      ) : null}
      {model.showCards.length && (d.kind !== 'choose' || !model.list.some((b) => b.card)) ? (
        <div className="gp-prompt__cards">
          {model.showCards.map((id) => {
            const c = card(id);
            return c ? <FateCardView key={id} card={c} size="md" /> : null;
          })}
        </div>
      ) : null}
      {model.list.length ? (
        <div className="gp-prompt__list">
          {model.list.map((b) => (
            <button
              key={b.key}
              type="button"
              className={`gp-option ${b.on ? 'is-on' : ''} ${b.card ? 'has-card' : ''}`}
              onClick={() => (b.card && d.kind === 'choose' ? onCard(b.card) : onButton(b))}
              disabled={b.disabled}
              onMouseEnter={() => onHoverPieces(b.pieces ?? null)}
              onMouseLeave={() => onHoverPieces(null)}
            >
              {b.card && card(b.card) ? (
                <span className="gp-option__card">
                  <FateCardView card={card(b.card)!} size="sm" highlight={d.kind === 'react' || d.kind === 'move' ? 'action' : null} texts={false} />
                </span>
              ) : null}
              <span className="gp-option__body">
                <b>{b.label}</b>
                {b.text ? <small>{b.text}</small> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {view.error ? <p className="gp-prompt__error">{view.error}</p> : null}
      <div className="gp-prompt__buttons">
        {model.buttons.map((b) => (
          <Button
            key={b.key}
            size="sm"
            variant={b.primary ? 'primary' : b.tone === 'danger' ? 'danger' : b.tone === 'ghost' ? 'ghost' : 'secondary'}
            disabled={b.disabled}
            title={b.hint ?? b.text}
            onClick={() => onButton(b)}
            onMouseEnter={() => onHoverPieces(b.pieces ?? null)}
            onMouseLeave={() => onHoverPieces(null)}
          >
            {b.label}
          </Button>
        ))}
      </div>
    </section>
  );
}

function hexOf(s: GameState, id: PieceId): number {
  const p = s.pieces[id];
  if (!p) return -1;
  if (p.where === 'map') return p.hex;
  if (p.carrier && s.pieces[p.carrier]?.where === 'map') return s.pieces[p.carrier].hex;
  return -1;
}

function Waiting({ view, s, human }: { view: ViewState; s: GameState; human: Side }) {
  const opp = sideName(s, human === 'axis' ? 'allied' : 'axis');
  let text = 'The battle unfolds…';
  if (view.fatal) text = view.error ?? 'The battle cannot continue.';
  else if (view.waiting) text = `The ${opp} may react…`;
  else if (view.thinking) text = `The ${opp} are deciding…`;
  else if (s.phase === 'setup') text = `The ${opp} are setting up.`;
  else if (s.active !== human) text = `The ${opp}’ Turn.`;
  return (
    <section className={`gp-prompt kit-paper gp-prompt--wait ${view.thinking || view.waiting ? 'is-busy' : ''}`}>
      <h2 className="gp-prompt__title">{s.phase === 'setup' ? 'Set-up' : s.active === human ? 'Your Turn' : `${opp}’ Turn`}</h2>
      <p className="gp-prompt__text">
        {view.thinking || view.waiting ? <span className="gp-spinner" aria-hidden /> : null}
        {text}
      </p>
      {view.animating ? <p className="gp-prompt__hint">Click the map to hurry the animations.</p> : null}
    </section>
  );
}
