// The page for unknown routes (and for a battle that cannot start).
import { Button } from '../kit';
import { navigate } from '../routes';
import './screens.css';

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
