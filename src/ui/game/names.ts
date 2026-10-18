// Names the battle screen writes: sides, pieces, hexes, chits, roll purposes.
import { OBJECTIVE_CHITS } from '../../engine/data';
import { label } from '../../engine/hex';
import { counterType, typeOf } from '../../engine/state';
import type { ChitId, GameState, HexId, Nation, PieceId, RevealPurpose, Side, WindowKind } from '../../engine/types';

export const NATION_PLURAL: Record<Nation, string> = { German: 'Germans', American: 'Americans', Russian: 'Russians' };
export const NATION_ADJ: Record<Nation, string> = { German: 'German', American: 'American', Russian: 'Russian' };

/** "Germans", "Americans", "Russians". */
export function sideName(s: GameState, side: Side): string {
  return NATION_PLURAL[s.players[side].nation];
}

/** "Rifle Squad", "Sgt Kluge", "LMG", "Radio (75mm)"; `fallback` when the piece is unknown. */
export function pieceName(s: GameState, id: PieceId, fallback = 'unit'): string {
  const p = s.pieces[id];
  if (!p) return fallback;
  try {
    return typeName(typeOf(p).name);
  } catch {
    return fallback;
  }
}

export function typeName(name: string): string {
  const radio = /^Radio:(.*)$/.exec(name);
  if (radio) return `Radio (${radio[1]})`;
  return name;
}

/** The counter type's display name ("Rifle Squad"). */
export function counterName(typeId: string): string {
  try {
    return typeName(counterType(typeId).name);
  } catch {
    return typeId.split('/').pop() ?? typeId;
  }
}

export function hexName(h: HexId): string {
  return h >= 0 && h < 150 ? label(h) : '—';
}

/** "Objective 3 is worth 2 VP", "Each Objective is worth 1 VP", "Exit VP doubled". */
export function chitText(c: ChitId): string {
  const d = OBJECTIVE_CHITS[c];
  if (!d) return 'Unknown objective';
  if (d.effect === 'suddenDeathWin') return 'Controlling all five Objectives wins before a Sudden Death roll';
  if (d.effect === 'doubleExitVp') return 'Exit VP doubled for both sides';
  if (d.effect === 'doubleEliminationVp') return 'Elimination VP doubled for both sides';
  if (d.objective === 'all') return `Each Objective is worth ${d.vp} VP`;
  return `Objective ${d.objective} is worth ${d.vp} VP`;
}

export const PURPOSE_TEXT: Record<RevealPurpose, string> = {
  fireAttack: 'Fire Attack',
  targeting: 'Targeting',
  defense: 'Defense',
  melee: 'Melee',
  rally: 'Rally',
  rout: 'Rout',
  mine: 'Mine Attack',
  impact: 'Artillery Impact',
  accuracy: 'Artillery Accuracy',
  suddenDeath: 'Sudden Death',
  support: 'Support Table',
  eventRoll: 'Event',
  randomHex: 'Random Hex',
  event: 'Event',
  drift: 'Artillery drift',
};

/** Purposes whose reveal is a die roll (the others only read the card's hex or Event). */
export function isRollPurpose(p: RevealPurpose): boolean {
  return p !== 'randomHex' && p !== 'event' && p !== 'drift';
}

export const WINDOW_TEXT: Record<WindowKind, string> = {
  beforeFireAttackRoll: 'Before the Fire Attack roll',
  beforeDefenseRoll: 'Before the Defense roll',
  squadWouldBreak: 'A Squad is about to break',
  afterHexEntry: 'The enemy entered a hex',
  afterAdvanceEntry: 'The enemy advanced into a hex',
  beforeMelee: 'Before the melee',
  afterMelee: 'After the melee',
  opponentPassed: 'Your opponent passed',
  timeAdvanceEnd: 'End of the Time advance',
  duringMove: 'While your units move',
};

export const END_REASON_TEXT: Record<string, string> = {
  surrender: 'surrender',
  annihilation: 'annihilation: the last unit on the map was lost',
  exit: 'the last unit on the map left it',
  suddenDeath: 'Sudden Death: the battle ended on the Time track',
  objectivesV: 'control of all five Objectives (chit V)',
};
