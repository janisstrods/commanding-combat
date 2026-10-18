// The set-up: while the human deploys (and when reinforcements arrive) the prompt shows the pieces still to place as
// counters, the set-up area is lit on the board, and "Deploy for me" lets the engine place the rest.
import { Counter } from '../../art';
import { counterType } from '../../engine/state';
import type { Decision, GameState, PieceId, Side } from '../../engine/types';
import { NATION_PLURAL } from '../game/names';

export function DeployPanel({
  s, d, selected, onPiece,
}: {
  s: GameState;
  d: Extract<Decision, { kind: 'deploy' }>;
  selected: readonly PieceId[];
  onPiece: (id: PieceId) => void;
}) {
  const units = d.pieces.filter((id) => counterType(s.pieces[id].type).kind !== 'weapon');
  const weapons = d.pieces.filter((id) => counterType(s.pieces[id].type).kind === 'weapon');
  return (
    <div className="deploy">
      {s.phase === 'setup' ? <SetupBrief s={s} side={d.side} /> : null}
      {[units, weapons].map((group, gi) =>
        group.length ? (
          <div key={gi} className="deploy__group">
            <div className="deploy__label">{gi === 0 ? 'Units' : 'Weapons (go to a unit without one)'}</div>
            <div className="deploy__pieces">
              {group.map((id) => {
                const t = counterType(s.pieces[id].type);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`deploy__piece ${selected.includes(id) ? 'is-on' : ''}`}
                    onClick={() => onPiece(id)}
                    title={t.name}
                  >
                    <Counter type={t} size={44} selected={selected.includes(id)} />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function SetupBrief({ s, side }: { s: GameState; side: Side }) {
  const def = s.scenario.sides[side];
  const area = def.setupArea;
  const where =
    area.kind === 'depth'
      ? `within ${area.depth} ${def.edge === 'top' || def.edge === 'bottom' ? 'rows' : 'columns'} of your edge`
      : area.kind === 'anyFree'
        ? 'anywhere without enemy units'
        : 'in the hexes shown';
  return (
    <p className="deploy__brief">
      The {NATION_PLURAL[def.nation]} set up {where} (lit on the map), at most 7 figures per hex (Squad 4, Team 2, Leader 1).
      {s.scenario.setupFirst === side ? ' You set up first.' : ' The enemy has set up.'}
    </p>
  );
}
