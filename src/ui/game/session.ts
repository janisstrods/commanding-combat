// A battle session: what was chosen (scenario, side, AI level, seed), the opening position it makes, and the autosave
// (localStorage `cce-save-v1`): the session plus every answer given so far. Continue replays the answers from the
// opening position (the engine is deterministic), so a reload lands in exactly the same position, also mid-AI-turn.
import { GameDriver } from '../../engine/driver';
import { SCENARIOS } from '../../engine/data';
import { freshSeed } from '../../engine/rng';
import { newGame } from '../../engine/state';
import type { Answer, GameEvent, GameState, ScenarioDef, Side } from '../../engine/types';
import { other } from '../../engine/types';
import type { AiLevel } from '../routes';
import { storage } from '../storage';

export interface SessionConfig {
  /** "1".."12", or "rsg" for a random battle (then `scenario` holds the generated scenario). */
  scenarioId: string;
  /** The full scenario of a random battle (it cannot be looked up by id). */
  scenario?: ScenarioDef;
  humanSide: Side;
  level: AiLevel;
  seed: number;
}

/** The autosave. */
export interface SavedGame {
  version: 1;
  /** Engine version the answers were recorded with: saves of another version are discarded (see ENGINE_VERSION). */
  engine: number;
  scenarioId: string;
  /** The whole ScenarioDef of a random battle. */
  scenario?: ScenarioDef;
  /** Shown on the main menu's Continue button. */
  scenarioName: string;
  seed: number;
  humanSide: Side;
  level: AiLevel;
  answers: Answer[];
  savedAt: number;
  /** Consistency check of the replay: the answers taken and the RNG calls made. */
  check: { n: number; rngCalls: number };
}

export const SAVE_KEY = 'cce-save-v1';
/** sessionStorage key where the RSG screens leave the finished random scenario before routing to `#/play/rsg/...`. */
export const RSG_PENDING_KEY = 'cce-rsg-pending';
/** Bump when engine rules change in a way that breaks the replay of old saves. */
export const ENGINE_VERSION = 1;

/** The scenario of a session. */
export function scenarioOf(config: SessionConfig): ScenarioDef {
  if (config.scenario) return config.scenario;
  const s = SCENARIOS.find((x) => x.id === config.scenarioId);
  if (!s) throw new Error(`No scenario "${config.scenarioId}"`);
  return s;
}

/** The opening position of a session (phase 'setup'). */
export function initialState(config: SessionConfig): GameState {
  return newGame(scenarioOf(config), config.seed);
}

/** A driver for the UI: snapshots for the animations, 'window' events for the uniform reaction pauses. */
export function newDriver(config: SessionConfig): GameDriver {
  return new GameDriver(initialState(config), { snapshots: true, windows: true });
}

export function newSessionConfig(scenarioId: string, humanSide: Side, level: AiLevel, seed?: number, scenario?: ScenarioDef): SessionConfig {
  const c: SessionConfig = { scenarioId, humanSide, level, seed: seed ?? freshSeed() };
  if (scenario) c.scenario = scenario;
  return c;
}

/** The session to play a finished battle again: same scenario and level, a new seed, optionally the other side. */
export function rematchConfig(config: SessionConfig, switchSides: boolean): SessionConfig {
  const side = switchSides ? other(config.humanSide) : config.humanSide;
  let seed = freshSeed();
  if (seed === config.seed) seed = (seed + 1) >>> 0;
  return newSessionConfig(config.scenarioId, side, config.level, seed, config.scenario);
}

/** The save of a session after the answers `driver` has recorded. */
export function makeSave(config: SessionConfig, driver: GameDriver): SavedGame {
  const save: SavedGame = {
    version: 1,
    engine: ENGINE_VERSION,
    scenarioId: config.scenarioId,
    scenarioName: scenarioOf(config).name,
    seed: config.seed,
    humanSide: config.humanSide,
    level: config.level,
    answers: driver.answers.slice(),
    savedAt: Date.now(),
    check: { n: driver.answers.length, rngCalls: driver.state.rngCalls },
  };
  if (config.scenario) save.scenario = config.scenario;
  return save;
}

export function writeSave(save: SavedGame): void {
  storage.set(SAVE_KEY, JSON.stringify(save));
}

export function clearSave(): void {
  storage.remove(SAVE_KEY);
}

/** The autosave, or null (none, unreadable or from another engine version: then it is removed). */
export function loadSave(): SavedGame | null {
  const raw = storage.get(SAVE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SavedGame;
    const ok =
      !!s && s.version === 1 && s.engine === ENGINE_VERSION && typeof s.scenarioId === 'string' && Array.isArray(s.answers) &&
      (s.humanSide === 'axis' || s.humanSide === 'allied') && typeof s.seed === 'number' &&
      (s.scenario ? typeof s.scenario === 'object' : SCENARIOS.some((x) => x.id === s.scenarioId));
    if (ok) return s;
  } catch {
    /* unreadable */
  }
  clearSave();
  return null;
}

export function configOfSave(save: SavedGame): SessionConfig {
  return newSessionConfig(save.scenarioId, save.humanSide, save.level ?? 'line', save.seed, save.scenario);
}

/**
 * Rebuild the game of a save: the opening position replayed with every answer. Throws when the answers no longer fit
 * (an engine change): the caller drops the save.
 */
export function restoreDriver(save: SavedGame): GameDriver {
  const config = configOfSave(save);
  const d = GameDriver.replay(initialState(config), save.answers, { snapshots: true, windows: true });
  if (d.answers.length !== save.check?.n || d.state.rngCalls !== save.check?.rngCalls) throw new Error('The saved battle does not replay with this version.');
  return d;
}

/** Every event of the game a save records, in order (a second, plain replay: for the resumed log and VP tally). */
export function historyOf(save: SavedGame): GameEvent[] {
  const d = new GameDriver(initialState(configOfSave(save)), { windows: false });
  const out: GameEvent[] = d.drainEvents().map((q) => q.e);
  for (const a of save.answers) {
    if (!d.pending || !d.answer(a)) break;
    for (const q of d.drainEvents()) out.push(q.e);
  }
  return out;
}

/** The random scenario the RSG screens left for `#/play/rsg/...`, or null. */
export function pendingRsgScenario(): ScenarioDef | null {
  try {
    const raw = sessionStorage.getItem(RSG_PENDING_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ScenarioDef;
    return s && typeof s === 'object' && s.sides && s.map ? s : null;
  } catch {
    return null;
  }
}
