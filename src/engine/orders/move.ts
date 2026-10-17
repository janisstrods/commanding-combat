// The Move Order (§O21) with Op Fire after every hex entry. (Milestone 1d.)
import type { OrderHandler } from '../registry';
import type { Answer, Decision, GameState } from '../types';

export const moveOrder: OrderHandler = {
  canGive: () => false,
  *run() {},
};

export function moveAnswerError(_s: GameState, _d: Extract<Decision, { kind: 'move' }>, _a: Answer): string | null {
  return 'Move is not implemented yet.';
}
