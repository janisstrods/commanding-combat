// Hidden Pillbox (§A35.3, R-18): scenario Defender only, just before he makes a Defense Roll in an Objective hex (any
// hex of a building Objective) that is not Water and has no Fortification, if the one Pillbox is not in play (the mix,
// mix.ts, has it): the Pillbox is placed there (its Cover counts from that roll on).
import { fortsLeft } from '../mix';
import { objectivesAt } from '../objectives';
import type { ActionHandler } from '../registry';
import { canHoldFort, placeFort } from '../state';
import type { GameState, HexId } from '../types';
import { cardsFor, plays } from './common';
import { defendingHex } from './hiddenEntrenchments';

function canPlace(s: GameState, hex: HexId): boolean {
  return hex >= 0 && canHoldFort(s, hex) && objectivesAt(s, hex).length > 0 && fortsLeft(s, 'pillbox') > 0;
}

export const hiddenPillboxAction: ActionHandler = {
  windows: ['beforeDefenseRoll'],
  options(s, side, _w, info) {
    const cards = cardsFor(s, side, 'Hidden Pillbox');
    if (!cards.length) return [];
    return canPlace(s, defendingHex(s, side, info)) ? plays(cards, 'Hidden Pillbox') : [];
  },
  *run(s, ctx, side, _opt, _a, info) {
    const hex = defendingHex(s, side, info);
    if (canPlace(s, hex)) placeFort(s, ctx, hex, 'pillbox');
  },
};
