// Helpers shared by the Action handlers (§A24): which cards in hand may be played as an Action (scenario-Defender-only
// cards need the Defend posture), the options they make, boxed values (§3.1.6), and the +2 FP Actions played just
// before a Fire Attack Roll. Every `options` function checks the hand first, so a window costs next to nothing when the
// player holds none of the cards (the AI asks often).
import { CARDS } from '../data';
import type { ActionHandler } from '../registry';
import { typeOf } from '../state';
import type { ActionName, ActionOption, AttackInfo, CardId, FateCard, GameState, HexId, PieceId, Side } from '../types';

/** Is `side` the scenario Defender (Defend posture), who alone may play Bore Sighting and the Hidden Actions? */
export function isDefender(s: GameState, side: Side): boolean {
  return s.players[side].posture === 'defend';
}

/** The cards in `side`'s hand that may be played as `action` (Defender-only cards only by the Defender). */
export function cardsFor(s: GameState, side: Side, action: ActionName): CardId[] {
  const out: CardId[] = [];
  let defender: boolean | undefined;
  for (const c of s.players[side].hand) {
    const card = CARDS[c];
    if (!card || card.action !== action) continue;
    if (card.defenderOnly && !(defender ??= isDefender(s, side))) continue;
    out.push(c);
  }
  return out;
}

/** One option per card, each with its own copy of the targets. */
export function plays(cards: CardId[], action: ActionName, targets?: { pieces?: PieceId[]; hexes?: HexId[] }): ActionOption[] {
  return cards.map((card) => {
    const o: ActionOption = { card, action };
    if (targets) {
      o.targets = {};
      if (targets.pieces) o.targets.pieces = targets.pieces.slice();
      if (targets.hexes) o.targets.hexes = targets.hexes.slice();
    }
    return o;
  });
}

/** Is the value `stat` of piece `id` boxed on the side it shows now (units: broken side when broken; Weapons: front)? */
export function boxed(s: GameState, id: PieceId, stat: 'fp' | 'range' | 'move'): boolean {
  const p = s.pieces[id];
  if (!p) return false;
  const t = typeOf(p);
  const v = t.kind === 'weapon' || !p.broken ? t.front : t.broken;
  return v.boxed[stat];
}

/** The attack in a 'beforeFireAttackRoll' window that `side` is making and has not rolled yet, or null. */
export function ownAttack(side: Side, attack: AttackInfo | undefined): AttackInfo | null {
  return attack && attack.side === side && attack.total === null ? attack : null;
}

/**
 * A +2 FP Action played by the firing player just before the Fire Attack Roll (Bore Sighting, Crossfire, Hand Grenades,
 * Marksmanship, Sustained Fire): `applies` is its prerequisite on the attack (and on the card, for Marksmanship's
 * printed nationality). Several may be played on one attack; their bonuses add up (§A24.1).
 */
export function fpAction(action: ActionName, applies: (s: GameState, attack: AttackInfo, card: FateCard) => boolean): ActionHandler {
  return {
    windows: ['beforeFireAttackRoll'],
    options(s, side, _w, info) {
      const attack = ownAttack(side, info.attack);
      if (!attack) return [];
      const cards = cardsFor(s, side, action);
      if (!cards.length) return [];
      return plays(cards.filter((c) => applies(s, attack, CARDS[c])), action);
    },
    *run(_s, ctx, side, _opt, _a, info) {
      const attack = info.attack;
      if (!attack) return;
      attack.bonus += 2;
      attack.played.push(action);
      ctx.emit({ kind: 'log', text: `${action}: +2 FP.`, side });
    },
  };
}
