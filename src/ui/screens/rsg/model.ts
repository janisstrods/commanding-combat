// The Random Battle screens' model: pure functions over the RSG engine (src/engine/rsg.ts) that the screens use and the
// tests pin. Who chooses each step, what the human may see of the draft (the AI's OB pick until both are made, never
// the AI's secret chit), the start form, the URL flags for screenshots, and the hand-off to the battle screen.
import { RSG_MAPS, newRsgDraft, rsgAdvance, rsgAuto, rsgAutoRun, rsgChoose, rsgFinish, rsgStep } from '../../../engine/rsg';
import type { RsgAutoWhat, RsgChoiceWhat, RsgDraft, RsgFixed, RsgLogEntry, RsgOptions, RsgStep } from '../../../engine/rsg';
import { type Nation, type Side, other } from '../../../engine/types';
import { AI_LEVELS, DEFAULT_AI_LEVEL, routeHash, type AiLevel, type Route } from '../../routes';
import { aiRsgChoice } from './ai';
import { seededRnd, stepRnd } from './view';

export { HIDDEN_CHIT, bothObsChosen, obAsSeen, rsgView, seededRnd, stepRnd } from './view';

// ---------------------------------------------------------------------------------------------------------------------
// The start form

export type SideChoice = Side | 'either';
/** RsgFixed.defender as a form value: 'vp' = RS.8 decides from the VP marker. */
export type PostureChoice = 'vp' | 'axisDefend' | 'alliedDefend' | 'recon';
export type AlliedChoice = 'random' | 'American' | 'Russian';

export interface RsgForm {
  side: SideChoice;
  level: AiLevel;
  /** "1".."12" or 'random'. */
  map: string;
  /** 1941..1945 or 'random'. */
  year: number | 'random';
  allied: AlliedChoice;
  posture: PostureChoice;
  seed: number;
}

export const RSG_YEARS: readonly number[] = [1941, 1942, 1943, 1944, 1945];

export function defaultForm(seed: number): RsgForm {
  return { side: 'either', level: DEFAULT_AI_LEVEL, map: 'random', year: 'random', allied: 'random', posture: 'vp', seed };
}

/** The fixed options of the form (only what the player did not leave to the dice). */
export function formFixed(f: RsgForm): RsgFixed {
  const fixed: RsgFixed = {};
  if (f.map !== 'random') fixed.map = f.map;
  if (f.year !== 'random') fixed.year = f.year;
  if (f.allied !== 'random') fixed.allied = f.allied as Nation;
  if (f.posture === 'axisDefend') fixed.defender = 'axis';
  else if (f.posture === 'alliedDefend') fixed.defender = 'allied';
  else if (f.posture === 'recon') fixed.defender = null;
  return fixed;
}

export function formOptions(f: RsgForm): RsgOptions {
  const o: RsgOptions = { seed: f.seed >>> 0, fixed: formFixed(f) };
  if (f.side !== 'either') o.humanSide = f.side;
  return o;
}

/** Why the form cannot start an RSG (e.g. Americans in 1941), or null. */
export function formProblem(f: RsgForm): string | null {
  try {
    newRsgDraft(formOptions(f));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Whether an Allied nation can be fixed with the form's year (R0: Americans 1943–45, Russians 1941–45). */
export function alliedFits(n: Nation, year: number | 'random'): boolean {
  if (year === 'random') return true;
  return n === 'American' ? year >= 1943 : year >= 1941 && year <= 1945;
}

// ---------------------------------------------------------------------------------------------------------------------
// URL flags (`#/random?seed=7&side=axis&auto=8`): start straight away for screenshots and tests

export interface RsgFlags {
  form: Partial<RsgForm>;
  /** Play this many steps (every choice by rsgAuto) before showing the screen; 'all' = to the summary. */
  auto?: number | 'all';
  /** Do not run automatic steps on their own (screenshots of a step mid-way). */
  hold?: boolean;
}

/** The query part of a hash ("#/random?auto=8" → "auto=8"), or of the page's search string. */
export function queryOf(hash: string, search = ''): URLSearchParams {
  const q = hash.indexOf('?');
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (q >= 0) new URLSearchParams(hash.slice(q + 1)).forEach((v, k) => params.set(k, v));
  return params;
}

export function parseFlags(params: URLSearchParams): RsgFlags {
  const form: Partial<RsgForm> = {};
  const seed = params.get('seed');
  if (seed && /^\d+$/.test(seed)) form.seed = Number(seed) >>> 0;
  const side = params.get('side');
  if (side === 'axis' || side === 'allied' || side === 'either') form.side = side;
  const level = params.get('level');
  if (AI_LEVELS.includes(level as AiLevel)) form.level = level as AiLevel;
  const map = params.get('map');
  if (map && RSG_MAPS.includes(map)) form.map = map;
  const year = Number(params.get('year'));
  if (RSG_YEARS.includes(year)) form.year = year;
  const allied = params.get('allied');
  if (allied === 'American' || allied === 'Russian') form.allied = allied;
  const posture = params.get('posture');
  if (posture === 'axisDefend' || posture === 'alliedDefend' || posture === 'recon' || posture === 'vp') form.posture = posture;
  const flags: RsgFlags = { form };
  const auto = params.get('auto');
  if (auto === 'all') flags.auto = 'all';
  else if (auto && /^\d+$/.test(auto)) flags.auto = Number(auto);
  if (params.get('hold') === '1') flags.hold = true;
  return flags;
}

// ---------------------------------------------------------------------------------------------------------------------
// Who chooses

export type Chooser = 'auto' | 'human' | 'ai' | 'done';

/** Who acts at the draft's next step: an automatic roll, the human's choice, the AI's choice, or nothing (done). */
export function chooserOf(d: RsgDraft, st: RsgStep = rsgStep(d)): Chooser {
  if (st.kind === 'done') return 'done';
  if (st.kind === 'auto') return 'auto';
  return st.side === d.humanSide ? 'human' : 'ai';
}

/** The side the computer plays (null before RS.2's coin flip when the player left the side to it). */
export function aiSide(d: RsgDraft): Side | null {
  return d.humanSide ? other(d.humanSide) : null;
}

/** "Pick / buy for me": the engine's heuristic choice for the human's side (the cart is filled, not bought). */
export function suggestFor(d: RsgDraft, side: Side, salt = 0) {
  return rsgAuto(d, side, stepRnd(d, 0x51ed + salt));
}

/** One step: roll an automatic step, or let the AI choose; throws at the human's choice or the end. */
export function stepOnce(d: RsgDraft): RsgDraft {
  const st = rsgStep(d);
  const who = chooserOf(d, st);
  if (who === 'auto') return rsgAdvance(d);
  if (who === 'ai' && st.kind === 'choice') return rsgChoose(d, aiRsgChoice(d, st.side));
  throw new Error(who === 'done' ? 'The RSG is finished.' : 'The RSG waits for the player.');
}

/** Rolls and AI choices up to the human's next choice, or the end ("skip to my next choice"). */
export function runToHuman(d: RsgDraft): RsgDraft {
  for (let n = 0; n < 500; n++) {
    const who = chooserOf(d);
    if (who === 'human' || who === 'done') return d;
    d = stepOnce(d);
  }
  throw new Error('runToHuman: the RSG does not end');
}

/** "Surprise me completely": every roll and every choice of both sides by the engine (rsgAutoRun), seeded by the form. */
export function surpriseMe(f: RsgForm): RsgDraft {
  return rsgAutoRun(newRsgDraft(formOptions(f)), seededRnd((f.seed ^ 0x5eed5eed) >>> 0));
}

/**
 * The first `n` steps of any kind ('all' = every step), the human's choices too ("surprise me completely" and the
 * screenshot flag `?auto=`). The AI's choices are aiRsgChoice; the human's are suggestFor.
 */
export function autoSteps(d: RsgDraft, n: number | 'all'): RsgDraft {
  const limit = n === 'all' ? 500 : n;
  for (let i = 0; i < limit; i++) {
    const st = rsgStep(d);
    const who = chooserOf(d, st);
    if (who === 'done') return d;
    if (who === 'human' && st.kind === 'choice') d = rsgChoose(d, suggestFor(d, st.side));
    else d = stepOnce(d);
  }
  return d;
}

// ---------------------------------------------------------------------------------------------------------------------
// Steps as the screens name them

export type StepWhat = RsgAutoWhat | RsgChoiceWhat;

/** Stages of the RSG for the progress strip, with the steps in each. */
export const STAGES: readonly { id: string; label: string; steps: readonly StepWhat[] }[] = [
  { id: 'field', label: 'Battlefield', steps: ['sides', 'mapRoll', 'mapPick', 'edgeRoll', 'mapEdgeDie'] },
  { id: 'year', label: 'Year & nations', steps: ['year', 'allied'] },
  { id: 'quality', label: 'Troop quality', steps: ['quality'] },
  { id: 'chits', label: 'Objectives', steps: ['chits'] },
  { id: 'ob', label: 'Orders of Battle', steps: ['ob', 'obPoints'] },
  { id: 'leaders', label: 'Leaders', steps: ['leaders'] },
  { id: 'support', label: 'Support', steps: ['supportRoll', 'supportBuy'] },
  { id: 'posture', label: 'Posture', steps: ['posture', 'fortifications', 'control'] },
  { id: 'asset', label: 'Assets', steps: ['assetRequest', 'assetRoll'] },
  { id: 'start', label: 'Initiative', steps: ['initiative'] },
];

export function stageOf(what: StepWhat | 'fixed' | 'done'): number {
  if (what === 'done') return STAGES.length;
  const i = STAGES.findIndex((s) => s.steps.includes(what as StepWhat));
  return i < 0 ? 0 : i;
}

export const STEP_TITLE: Record<StepWhat, string> = {
  sides: 'Sides',
  mapRoll: 'Who picks the battlefield',
  mapPick: 'Pick the battlefield',
  edgeRoll: 'Friendly edge roll',
  mapEdgeDie: 'Choose the edge die',
  year: 'The year',
  allied: 'The Allied nation',
  quality: 'Troop quality',
  chits: 'Objective chits',
  ob: 'Order of Battle',
  obPoints: 'Points of the OBs',
  leaders: 'Leaders',
  supportRoll: 'Support roll',
  supportBuy: 'Support purchase',
  posture: 'Postures',
  fortifications: 'Fortifications',
  control: 'Objective control',
  assetRequest: 'Asset Request',
  assetRoll: 'Asset Request roll',
  initiative: 'Initiative',
};

/** The RS step of the reference (design/scenarios-reference.md §4) each step belongs to. */
export const STEP_RS: Record<StepWhat, string> = {
  sides: 'RS.2',
  mapRoll: 'RS.1',
  mapPick: 'RS.1',
  edgeRoll: 'RS.1',
  mapEdgeDie: 'RS.1',
  year: 'RS.2',
  allied: 'RS.2',
  quality: 'RS.3',
  chits: 'RS.4',
  ob: 'RS.5',
  obPoints: 'RS.5',
  leaders: 'RS.6',
  supportRoll: 'RS.7',
  supportBuy: 'RS.7',
  posture: 'RS.8',
  fortifications: 'RS.9',
  control: 'RS.10',
  assetRequest: 'RS.11',
  assetRoll: 'RS.11',
  initiative: 'RS.15',
};

/** The log entries added between two drafts (the narration of one step). */
export function newEntries(before: RsgDraft, after: RsgDraft): RsgLogEntry[] {
  return after.log.slice(before.log.length);
}

// ---------------------------------------------------------------------------------------------------------------------
// The hand-off to the battle screen (Task 11)

/** sessionStorage key the battle screen's `#/play/rsg/...` route reads the generated ScenarioDef from. */
export const RSG_PENDING_KEY = 'cce-rsg-pending';

export interface RsgHandoff {
  key: typeof RSG_PENDING_KEY;
  /** JSON of rsgFinish(draft). */
  value: string;
  route: Extract<Route, { kind: 'play' }>;
  hash: string;
}

/** What "To battle" stores and where it goes: the finished ScenarioDef, `#/play/rsg/<side>/<level>/<seed>`. */
export function rsgHandoff(d: RsgDraft, level: AiLevel): RsgHandoff {
  if (!d.humanSide) throw new Error('The RSG has no player side.');
  const scn = rsgFinish(d);
  const route: Extract<Route, { kind: 'play' }> = { kind: 'play', scenario: 'rsg', side: d.humanSide, level, seed: d.seed >>> 0 };
  return { key: RSG_PENDING_KEY, value: JSON.stringify(scn), route, hash: routeHash(route) };
}

/** Store the hand-off (sessionStorage may be unavailable: then false). */
export function storeHandoff(h: RsgHandoff, store: Pick<Storage, 'setItem'> | null = sessionStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(h.key, h.value);
    return true;
  } catch {
    return false;
  }
}

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
