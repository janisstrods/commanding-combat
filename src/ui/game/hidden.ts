// Hidden information on the battle screen. The human sees the game as `redact(state, humanSide)` shows it: never the
// opponent's hand, his drawn cards, any draw pile or the opponent's secret chits — except what the rules reveal
// (Interrogation shows the hand inside its own decision, Reconnaissance and the game end reveal chits as open chits).
// Every event goes through `publicEvent` before anything shows or logs it.
import { cloneState, redact } from '../../engine/state';
import type { GameEvent, GameState, Side } from '../../engine/types';
import { UNKNOWN_CARD, UNKNOWN_CHIT } from '../../engine/types';

/** The game as `viewer` may see it. Once the game is over nothing is secret any more. */
export function viewOf(s: GameState, viewer: Side): GameState {
  return s.phase === 'over' ? cloneState(s) : redact(s, viewer);
}

/**
 * Event `e` as `viewer` may see it, or null when he may not see it at all: the opponent's drawn cards become unknowns
 * (their number stays), a secret chit the opponent draws becomes an unknown chit, and in a hidden set-up (both sides
 * deploy at once, unseen) the opponent's placements are not shown. `s`: the game right after the event (for the hidden
 * set-up). Everything else in the events is public: revealed cards go face up to the discard pile, discards are face
 * up, chits revealed by the rules are open.
 */
export function publicEvent(e: GameEvent, viewer: Side, s?: GameState): GameEvent | null {
  switch (e.kind) {
    case 'draw':
      return e.side === viewer ? e : { ...e, cards: e.cards.map(() => UNKNOWN_CARD) };
    case 'chit':
      return !e.open && e.side !== null && e.side !== viewer ? { ...e, chit: UNKNOWN_CHIT } : e;
    case 'place':
      if (s && e.piece && s.phase === 'setup' && s.scenario.special.simultaneousSetup && s.pieces[e.piece]?.side !== viewer) return null;
      return e;
    default:
      return e;
  }
}
