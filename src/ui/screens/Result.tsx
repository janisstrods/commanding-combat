// The end of a battle: who won and why, where the VP came from, and what next (rematch, switch sides, menu).
import type { EndReason, GameState, Side } from '../../engine/types';
import { other } from '../../engine/types';
import { Button, Modal, Stamp } from '../kit';
import type { VpBreakdown } from '../game/controller';
import { vpTotalText } from '../game/log';
import { END_REASON_TEXT, sideName } from '../game/names';

const ROWS: (keyof VpBreakdown)[] = ['Eliminations', 'Exits', 'Objectives', 'Time', 'Other'];

export function ResultDialog({
  open, s, human, winner, reason, vp, onRematch, onSwitch, onMenu, onClose,
}: {
  open: boolean;
  s: GameState;
  human: Side;
  winner: Side;
  reason: EndReason;
  vp: Record<Side, VpBreakdown>;
  onRematch: () => void;
  onSwitch: () => void;
  onMenu: () => void;
  onClose: () => void;
}) {
  const won = winner === human;
  const opp = other(human);
  const start = s.scenario.vp;
  return (
    <Modal
      open={open}
      title={won ? 'Victory' : 'Defeat'}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onMenu}>
            Main menu
          </Button>
          <Button variant="secondary" onClick={onSwitch}>
            Switch sides
          </Button>
          <Button onClick={onRematch}>Rematch</Button>
        </>
      }
    >
      <div className="result">
        <div className="result__stamp">
          <Stamp tone={won ? 'olive' : 'red'}>{won ? 'Mission accomplished' : 'Mission failed'}</Stamp>
        </div>
        <p className="result__lead">
          The <b>{sideName(s, winner)}</b> win <i>{s.scenario.name}</i> by {END_REASON_TEXT[reason] ?? reason}.
        </p>
        <p>
          Final VP: <b>{vpTotalText(s.vp)}</b>
          {start ? ` (the scenario started at ${vpTotalText(start)})` : ''}. Time {s.time}, Sudden Death {s.suddenDeath}. Casualties: you{' '}
          {s.players[human].casualties.length} of {s.players[human].surrender}, the {sideName(s, opp)} {s.players[opp].casualties.length} of{' '}
          {s.players[opp].surrender}.
        </p>
        <table className="result__table">
          <thead>
            <tr>
              <th>VP from</th>
              <th>You ({sideName(s, human)})</th>
              <th>{sideName(s, opp)}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) =>
              vp[human][r] || vp[opp][r] ? (
                <tr key={r}>
                  <th>{r}</th>
                  <td>{vp[human][r]}</td>
                  <td>{vp[opp][r]}</td>
                </tr>
              ) : null,
            )}
            <tr className="result__sum">
              <th>Total gained</th>
              <td>{ROWS.reduce((t, r) => t + vp[human][r], 0)}</td>
              <td>{ROWS.reduce((t, r) => t + vp[opp][r], 0)}</td>
            </tr>
          </tbody>
        </table>
        <p className="result__note">Objective VP swing: when an Objective changes hands, its value moves from one side to the other.</p>
      </div>
    </Modal>
  );
}
