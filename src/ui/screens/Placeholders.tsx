// Stand-ins for screens other tasks build: the battle (Task 11) and Continue; plus the page for unknown routes.
import { useMemo } from 'react';
import { SCENARIOS, loadMap } from '../../engine/data';
import type { Edge, Side } from '../../engine/types';
import { Board } from '../board';
import { Button } from '../kit';
import { navigate, type AiLevel } from '../routes';
import { AI_LEVEL_INFO, NATION_PLURAL, turnFor } from './ScenarioPicker';
import './screens.css';

/** Until the battle screen exists: what would start, on the map it would start on. */
export function PlayPlaceholder(p: { scenario: string; side: Side; level: AiLevel; seed?: number }) {
  const scn = SCENARIOS.find((s) => s.id === p.scenario);
  const map = useMemo(() => {
    try {
      return scn ? loadMap(scn.map) : null;
    } catch {
      return null;
    }
  }, [scn]);
  if (!scn) return <NotFound what={`There is no scenario “${p.scenario}”.`} />;
  const mine = scn.sides[p.side];
  const theirs = scn.sides[p.side === 'axis' ? 'allied' : 'axis'];
  const edges: Partial<Record<Edge, string>> = { [mine.edge]: `${NATION_PLURAL[mine.nation]} (you)`, [theirs.edge]: NATION_PLURAL[theirs.nation] };
  return (
    <div className="play-root kit-desk">
      <header className="play-head">
        <Button variant="ghost" size="sm" onClick={() => navigate({ kind: 'scenarios', selected: scn.id })}>
          ← Scenarios
        </Button>
        <div className="play-title">
          <b>
            {scn.id}. {scn.name}
          </b>
          <span>
            You command the {NATION_PLURAL[mine.nation]} against {p.level === 'elite' ? 'an' : 'a'} {AI_LEVEL_INFO[p.level].label} computer opponent
            {p.seed !== undefined ? ` (seed ${p.seed})` : ''}.
          </span>
        </div>
      </header>
      <div className="play-board">{map ? <Board map={map} rotate180={turnFor(mine.edge)} edgeLabels={edges} /> : null}</div>
      <div className="play-note kit-paper">The battle screen is still being built. This is the map you will fight on.</div>
    </div>
  );
}

export function ContinuePlaceholder() {
  return <NotFound title="Continue" what="Resuming a saved battle arrives with the battle screen." />;
}

export function NotFound(p: { title?: string; what?: string }) {
  return (
    <div className="page-root kit-desk">
      <article className="page-sheet page-sheet--small kit-paper">
        <header className="page-head">
          <h2 className="page-title">{p.title ?? 'Not found'}</h2>
        </header>
        <p>{p.what ?? 'There is nothing at this address.'}</p>
        <Button onClick={() => navigate({ kind: 'menu' })}>Main menu</Button>
      </article>
    </div>
  );
}
