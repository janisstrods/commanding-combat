// The main menu: New Scenario, Random Battle, Continue, Rules, Credits.
import { useState } from 'react';
import { BUILD_TIME, RELEASE, buildLabel } from '../../version';
import { Button, Stamp } from '../kit';
import { navigate } from '../routes';
import { storage } from '../storage';
import { RulesDialog } from './RulesDialog';
import './screens.css';

/** localStorage key of the autosaved battle (written by the battle screen, Task 11). */
export const SAVE_KEY = 'cce-save-v1';

/** Whether there is an autosaved battle to continue. */
export function hasSavedGame(): boolean {
  const raw = storage.get(SAVE_KEY);
  return raw !== null && raw.length > 0;
}

/** The scenario name stored with the autosave, when the save says. */
function savedLabel(): string | null {
  const raw = storage.get(SAVE_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { name?: unknown; scenarioName?: unknown; config?: { name?: unknown } };
    const name = v.scenarioName ?? v.name ?? v.config?.name;
    return typeof name === 'string' ? name : null;
  } catch {
    return null;
  }
}

/** Set when Task 13 (the Random Scenario Generator) lands. */
export const RANDOM_BATTLE_READY = false;

export function MainMenu(p: { onContinue?: () => void; notice?: string | null }) {
  const [rules, setRules] = useState(false);
  const saved = hasSavedGame();
  const label = saved ? savedLabel() : null;
  return (
    <div className="menu-root kit-desk">
      <main className="menu-sheet kit-paper">
        <div className="menu-classified" aria-hidden>
          <Stamp tone="red">Field Edition</Stamp>
        </div>
        <Emblem />
        <h1 className="menu-title">Combat Commander</h1>
        <div className="menu-sub">Europe</div>
        <p className="menu-tag">Infantry combat in the Second World War · twelve scenarios · you against the computer</p>
        {p.notice ? <div className="menu-notice">{p.notice}</div> : null}
        <nav className="menu-buttons" aria-label="Main menu">
          {saved ? (
            <Button size="lg" onClick={() => (p.onContinue ? p.onContinue() : navigate({ kind: 'continue' }))}>
              Continue{label ? `: ${label}` : ''}
            </Button>
          ) : null}
          <Button size="lg" variant={saved ? 'secondary' : 'primary'} onClick={() => navigate({ kind: 'scenarios' })}>
            New Scenario
          </Button>
          <Button size="lg" variant="secondary" disabled={!RANDOM_BATTLE_READY} title={RANDOM_BATTLE_READY ? undefined : 'Coming soon'}>
            Random Battle {RANDOM_BATTLE_READY ? null : <Stamp tone="ink">Coming soon</Stamp>}
          </Button>
          {!saved ? (
            <Button size="lg" variant="secondary" disabled title="No saved battle">
              Continue
            </Button>
          ) : null}
          <div className="menu-row">
            <Button variant="ghost" onClick={() => setRules(true)}>
              Rules
            </Button>
            <Button variant="ghost" onClick={() => navigate({ kind: 'credits' })}>
              Credits
            </Button>
          </div>
        </nav>
        <footer className="menu-version">
          <span>
            v{RELEASE.number} “{RELEASE.name}”
          </span>
          <span className="menu-build">{buildLabel(BUILD_TIME)}</span>
        </footer>
      </main>
      <p className="menu-disclaimer">
        An unofficial, fan-made edition of <i>Combat Commander: Europe</i> (Chad Jensen, GMT Games). Not affiliated with or
        endorsed by GMT Games.
      </p>
      <RulesDialog open={rules} onClose={() => setRules(false)} />
    </div>
  );
}

/** An original insignia: a map hex with contour lines, a compass tick and crossed bayonets. */
function Emblem() {
  const hex = [0, 1, 2, 3, 4, 5].map((i) => `${50 + 40 * Math.cos((Math.PI / 3) * i)},${50 + 40 * Math.sin((Math.PI / 3) * i)}`).join(' ');
  return (
    <svg className="menu-emblem" viewBox="0 0 100 100" aria-hidden>
      <polygon points={hex} fill="#56662f" stroke="#23241c" strokeWidth={3} />
      <path d="M26 58 C 36 46, 52 44, 62 50 S 76 60, 80 52" fill="none" stroke="#b9c08a" strokeWidth={2} opacity={0.8} />
      <path d="M30 68 C 42 58, 56 58, 66 62 S 74 68, 78 64" fill="none" stroke="#b9c08a" strokeWidth={2} opacity={0.6} />
      <g stroke="#ece3c8" strokeWidth={3.2} strokeLinecap="round">
        <line x1={33} y1={70} x2={67} y2={30} />
        <line x1={67} y1={70} x2={33} y2={30} />
      </g>
      <g fill="#ece3c8">
        <polygon points="67,30 70,23 63,27" />
        <polygon points="33,30 30,23 37,27" />
      </g>
      <circle cx={50} cy={50} r={5} fill="#962d22" stroke="#ece3c8" strokeWidth={2} />
    </svg>
  );
}
