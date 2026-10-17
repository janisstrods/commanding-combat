// Fire Attacks (§O20): firing pieces, Fire Groups, Hindrance, height, Targeting for Ordnance, the Attack and Defense
// rolls and their results. (Milestone 1c.)
import type { Answer, Decision, GameState, PieceId } from './types';

/** Can any of `units` (or their Weapons) fire at an enemy unit in LOS and Range (§O20.1)? `opFire`: no Ordnance. */
export function canShootSomething(_s: GameState, _units: PieceId[], _opFire = false): boolean {
  return false;
}

export function fireAnswerError(_s: GameState, _d: Extract<Decision, { kind: 'fire' }>, _a: Answer): string | null {
  return 'Fire is not implemented yet.';
}
