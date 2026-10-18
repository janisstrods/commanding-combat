// Spray Fire (§A40, R-19): just before a Fire Attack Roll whose firing pieces all have boxed Range, add a second target
// hex adjacent to the first, holding an enemy unit, in Range and LOS of every firing piece. One Attack Roll; every unit
// in both hexes defends against its total. Always exactly two hexes (not cumulative). fire.ts recomputes the FP over
// both hexes after the window (largest Hindrance of any line, height against either hex) and lets both hexes defend.
import { inRange, shooter } from '../fire';
import { neighbours } from '../hex';
import { losCheck } from '../los';
import type { ActionHandler } from '../registry';
import { hasUnitOf } from '../state';
import { type AttackInfo, type GameState, type HexId, other } from '../types';
import { boxed, cardsFor, ownAttack, plays } from './common';

/** The hexes Spray Fire may add to `attack` (none if it cannot be played on it). */
export function sprayHexes(s: GameState, attack: AttackInfo): HexId[] {
  if (attack.targets.length !== 1 || attack.ordnance || !attack.pieces.length) return [];
  const shooters = [];
  for (const id of attack.pieces) {
    const sh = shooter(s, id, attack.mode === 'opFire');
    if (!sh || !boxed(s, id, 'range')) return [];
    shooters.push(sh);
  }
  const enemy = other(attack.side);
  const out: HexId[] = [];
  for (const h of neighbours(attack.targets[0])) {
    if (!hasUnitOf(s, h, enemy)) continue;
    if (shooters.every((sh) => inRange(sh, h) && losCheck(s, sh.hex, h).clear)) out.push(h);
  }
  return out.sort((a, b) => a - b);
}

export const sprayFireAction: ActionHandler = {
  windows: ['beforeFireAttackRoll'],
  options(s, side, _w, info) {
    const attack = ownAttack(side, info.attack);
    if (!attack) return [];
    const cards = cardsFor(s, side, 'Spray Fire');
    if (!cards.length) return [];
    const hexes = sprayHexes(s, attack);
    return hexes.length ? plays(cards, 'Spray Fire', { hexes }) : [];
  },
  *run(_s, ctx, side, _opt, a, info) {
    const attack = info.attack;
    const hex = a.kind === 'play' ? a.targets?.hexes?.[0] : undefined;
    if (!attack || hex === undefined || attack.targets.length !== 1) return;
    attack.targets.push(hex);
    attack.played.push('Spray Fire');
    ctx.emit({ kind: 'log', text: 'Spray Fire: a second target hex.', side });
  },
};
