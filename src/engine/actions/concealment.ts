// Concealment (§A29, R-17): just before the defending player makes a Defense Roll, reduce the Fire Attack Total by the
// Cover of the targeted hex, the Cover the defending units actually use against this attack (Wall / Hedge across the
// shot, Fortification +1 against Mortars and Artillery, Road −1; 0 against Flamethrowers and Mines; a negative Cover
// raises the total). With Spray Fire the better of the two target hexes. The reduction stands for every remaining
// Defense roll of the attack (fire.ts `defend` subtracts `attack.reduction`); several Concealments add up.
import { firerHexes } from '../fire';
import { hexsideCoverAgainst } from '../los';
import type { ActionHandler } from '../registry';
import { concealmentBonus } from '../scenarioRules';
import { cover, hexCover } from '../stats';
import { hasRoad } from '../terrain';
import type { AttackInfo, GameState, HexId, PieceId } from '../types';
import { cardsFor, plays } from './common';

/** The Cover of `hex` against `attack` from `firers`, as stats.ts `cover` gives it to a unit there. */
function hexCoverAgainst(s: GameState, hex: HexId, attack: AttackInfo, firers: HexId[]): number {
  if (attack.ignoresCover) return 0;
  let best = hexCover(s, hex, attack.mortarOrArtillery);
  if (!attack.mortarOrArtillery && firers.length) {
    let side = Infinity;
    for (const f of firers) side = Math.min(side, hexsideCoverAgainst(s.map, f, hex, s.scenario.special));
    if (side > 0) best = Math.max(best, side - (hasRoad(s.map, hex) ? 1 : 0));
  }
  return best;
}

/** What Concealment takes off `attack`'s total for defending unit `id`. */
export function concealmentValue(s: GameState, attack: AttackInfo, id: PieceId): number {
  const firers = firerHexes(s, attack.pieces);
  const own = s.pieces[id].hex;
  let best = cover(s, id, { firers, mortarOrArtillery: attack.mortarOrArtillery, ignoresCover: attack.ignoresCover });
  for (const h of attack.targets) if (h !== own) best = Math.max(best, hexCoverAgainst(s, h, attack, firers));
  return best;
}

export const concealmentAction: ActionHandler = {
  windows: ['beforeDefenseRoll'],
  options(s, side, _w, info) {
    const id = info.units?.[0];
    if (!info.attack || !id || info.attack.side === side || s.pieces[id]?.side !== side || s.pieces[id].where !== 'map') return [];
    return plays(cardsFor(s, side, 'Concealment'), 'Concealment');
  },
  *run(s, ctx, side, _opt, _a, info) {
    const attack = info.attack;
    const id = info.units?.[0];
    if (!attack || !id || s.pieces[id]?.where !== 'map') return;
    const v = concealmentValue(s, attack, id);
    attack.reduction += v;
    attack.reduction += concealmentBonus(s, ctx, side);
    attack.played.push('Concealment');
    ctx.emit({ kind: 'log', text: `Concealment: the attack total is ${v >= 0 ? `reduced by ${v}` : `raised by ${-v}`}.`, side });
  },
};
