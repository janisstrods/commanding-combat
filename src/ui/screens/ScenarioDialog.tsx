// The scenario's briefing in the battle: the situation, the key facts, each side's set-up numbers and the special rules
// (Night, Fog, Bocage, Deep Freeze ... change how the battle plays). Only what both players know: never a side's
// secret Objective chit (a random battle names the drawn ones in its scenario).
import type { GameState, ScenarioDef, Side } from '../../engine/types';
import { other } from '../../engine/types';
import { summaryOf } from '../../scenarios/summaries';
import { Button, Modal } from '../kit';
import './screens.css';
import './scenario.css';

const NATION_PLURAL = { German: 'Germans', American: 'Americans', Russian: 'Russians' } as const;
const POSTURE = { attack: 'Attack', recon: 'Recon', defend: 'Defend' } as const;

/** The special rules of a scenario, as a list (nothing when it has none). */
export function SpecialRulesList({ scn, title = 'Special rules' }: { scn: ScenarioDef; title?: string }) {
  const notes = scn.special.notes ?? [];
  if (!notes.length) return null;
  return (
    <section className="brief-special">
      <h4 className="brief-special__title">{title}</h4>
      <ul>
        {notes.map((n, i) => {
          const m = /^([^:]{2,40}):\s*(.*)$/.exec(n);
          return <li key={i}>{m ? <><b>{m[1]}:</b> {m[2]}</> : n}</li>;
        })}
      </ul>
    </section>
  );
}

export function ScenarioDialog({ open, onClose, s, human }: { open: boolean; onClose: () => void; s: GameState; human: Side }) {
  const scn = s.scenario;
  const summary = summaryOf(scn.id);
  const sideRow = (side: Side) => {
    const d = scn.sides[side];
    const p = s.players[side];
    return (
      <tr key={side}>
        <th>
          {NATION_PLURAL[d.nation]}
          {side === human ? ' (you)' : ''}
        </th>
        <td>{POSTURE[d.posture]}</td>
        <td>{p.orders}</td>
        <td>{p.handSize}</td>
        <td>{p.discard}</td>
        <td>{p.surrender}</td>
      </tr>
    );
  };
  return (
    <Modal open={open} title={scn.name} onClose={onClose} width={680} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="scn-dialog">
        {summary ? (
          <>
            <div className="brief-place">{summary.place}</div>
            <p className="brief-text">{summary.text}</p>
          </>
        ) : null}
        <dl className="brief-facts">
          <div>
            <dt>Map</dt>
            <dd>{scn.map}</dd>
          </div>
          <div>
            <dt>Year</dt>
            <dd>{scn.year}</dd>
          </div>
          <div>
            <dt>Time / Sudden Death</dt>
            <dd>
              {s.time} / {s.suddenDeath}
            </dd>
          </div>
          <div>
            <dt>First turn</dt>
            <dd>{NATION_PLURAL[scn.sides[scn.firstTurn].nation]}</dd>
          </div>
        </dl>
        <div className="brief-sides-wrap">
          <table className="brief-sides">
            <thead>
              <tr>
                <th />
                <th>Posture</th>
                <th>Orders</th>
                <th>Hand</th>
                <th>Discard</th>
                <th>Surrender</th>
              </tr>
            </thead>
            <tbody>{[human, other(human)].map(sideRow)}</tbody>
          </table>
        </div>
        <SpecialRulesList scn={scn} />
        {!(scn.special.notes ?? []).length ? <p className="brief-text">No special rules: the standard rules apply.</p> : null}
      </div>
    </Modal>
  );
}
