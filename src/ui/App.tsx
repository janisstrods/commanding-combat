// Placeholder shell: replaced by the menus and the battle screen (plan Task 13).
import { RELEASE } from '../version';

export function App() {
  return (
    <main style={{ fontFamily: 'Oswald, sans-serif', padding: 32 }}>
      <h1>Combat Commander: Europe</h1>
      <p>
        Digital edition {RELEASE.number} “{RELEASE.name}”
      </p>
    </main>
  );
}
