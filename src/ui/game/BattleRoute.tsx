// The battle routes: `#/play/<scenario>/<axis|allied>/<green|line|elite>[/<seed>]` starts a new battle (scenario
// `rsg` takes the random scenario the RSG screens left in sessionStorage), `#/continue` resumes the autosave. A new
// battle replaces its hash with `#/continue`, so a reload resumes it from the autosave instead of starting over.
// Dev flags after the hash: `?auto=N` answers your first N decisions at random, `?speed=instant|fast|...`,
// `?ai=random` plays the random stand-in instead of the AI. The battle starts once its map is loaded and painted.
import { useEffect, useRef, useState } from 'react';
import { SCENARIOS } from '../../engine/data';
import { BATTLE_PPU, usePreparedMap } from '../maps';
import { navigate, type Route } from '../routes';
import { NotFound } from '../screens/Placeholders';
import { GameController, SPEEDS, type Speed } from './controller';
import { GameScreen } from './GameScreen';
import { makeOpponent } from './makeOpponent';
import { RandomOpponent } from './opponent';
import {
  clearSave, configOfSave, historyOf, loadSave, newSessionConfig, pendingRsgScenario, rematchConfig, restoreDriver, scenarioOf,
  type SessionConfig,
} from './session';

/** The live session (kept across the hash change to `#/continue` and React's double mount in development). */
let live: { key: string; controller: GameController } | null = null;

function flags(hash: string): URLSearchParams {
  const q = hash.indexOf('?');
  return new URLSearchParams(q >= 0 ? hash.slice(q + 1) : '');
}

/** Dev `?ai=random`: the random stand-in instead of the AI (kept for the rest of the page's life). */
let randomAi = false;

function opponentFor(config: SessionConfig) {
  const side = config.humanSide === 'axis' ? 'allied' : 'axis';
  return randomAi ? new RandomOpponent() : makeOpponent(side, config.level);
}

function startSession(config: SessionConfig, key: string): GameController {
  live?.controller.dispose();
  const controller = new GameController(config, opponentFor(config));
  live = { key, controller };
  return controller;
}

type Got = { controller: GameController } | { error: string; title?: string };

function obtain(route: Route): Got {
  const hash = window.location.hash;
  if (live && (live.key === hash || route.kind === 'continue')) return { controller: live.controller };
  if (flags(hash).get('ai') === 'random') randomAi = true;
  if (route.kind === 'play') {
    let scn;
    if (route.scenario === 'rsg') {
      scn = pendingRsgScenario();
      if (!scn) return { error: 'There is no random battle waiting to start. Set one up from the main menu.', title: 'Random battle' };
    } else if (!SCENARIOS.some((x) => x.id === route.scenario)) {
      return { error: `There is no scenario “${route.scenario}”.` };
    }
    clearSave();
    const controller = startSession(newSessionConfig(route.scenario, route.side, route.level, route.seed, scn ?? undefined), hash);
    const f = flags(hash);
    const speed = f.get('speed');
    if (speed && SPEEDS.includes(speed as Speed)) controller.view = { ...controller.view, speed: speed as Speed };
    const auto = Number(f.get('auto') ?? 0);
    if (auto > 0) controller.autoPlay(auto);
    return { controller };
  }
  const save = loadSave();
  if (!save) return { error: 'There is no saved battle to continue.', title: 'Continue' };
  try {
    const driver = restoreDriver(save);
    const config = configOfSave(save);
    live?.controller.dispose();
    const controller = new GameController(config, opponentFor(config), driver, historyOf(save));
    live = { key: hash, controller };
    return { controller };
  } catch (e) {
    console.error('Could not resume the saved battle', e);
    clearSave();
    return { error: 'That saved battle could not be restored (it was made with an older version). Please start a new one.', title: 'Continue' };
  }
}

/** The map the battle of `route` is on (as `obtain` would find the battle), or null when there is no such battle. */
function mapOf(route: Route): string | null {
  if (live && (live.key === window.location.hash || route.kind === 'continue')) return scenarioOf(live.controller.config).map;
  if (route.kind === 'play') {
    if (route.scenario === 'rsg') return pendingRsgScenario()?.map ?? null;
    return SCENARIOS.find((x) => x.id === route.scenario)?.map ?? null;
  }
  const save = route.kind === 'continue' ? loadSave() : null;
  return save ? scenarioOf(configOfSave(save)).map : null;
}

export function BattleRoute({ route }: { route: Route }) {
  const mapId = mapOf(route);
  const { map, error } = usePreparedMap(mapId, BATTLE_PPU);
  if (mapId !== null && !map) {
    if (error) return <NotFound title="Battle" what={`Map ${mapId} could not be loaded. Check the connection and try again.`} />;
    return <div className="kit-desk app-loading">Loading map…</div>;
  }
  return <Battle route={route} />;
}

function Battle({ route }: { route: Route }) {
  const [got, setGot] = useState<Got>(() => obtain(route));
  const mounted = useRef(true);

  // another `#/play/...` while a battle is on screen (typed in, or a dev link): start that one
  const playHash = route.kind === 'play' ? window.location.hash : null;
  useEffect(() => {
    if (playHash === null || (live && live.key === playHash)) return;
    setGot(obtain(route));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playHash]);

  useEffect(() => {
    mounted.current = true;
    if ('controller' in got && route.kind === 'play') {
      if (live) live.key = '#/continue';
      navigate({ kind: 'continue' }, { replace: true });
    }
    return () => {
      mounted.current = false;
      // React's development double mount unmounts and mounts again at once: dispose only when really gone
      setTimeout(() => {
        if (!mounted.current && 'controller' in got && live?.controller === got.controller) {
          got.controller.dispose();
          live = null;
        }
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [got]);

  if (!('controller' in got)) return <NotFound title={got.title ?? 'Battle'} what={got.error} />;
  const c = got.controller;
  return (
    <GameScreen
      key={c.config.seed + c.config.humanSide}
      controller={c}
      onMenu={() => navigate({ kind: 'menu' })}
      onRematch={(switchSides) => {
        clearSave();
        const controller = startSession(rematchConfig(c.config, switchSides), '#/continue');
        setGot({ controller });
      }}
    />
  );
}
