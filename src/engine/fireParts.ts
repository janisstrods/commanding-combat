// What the screen shows of a Fire Attack and its Defense rolls (the 'firePower' and 'defending' events): the same
// values fire.ts resolves with (attackFp, currentStats, cover), split into their parts.
import { attackFp, firerHexes, shooter, type Shooter } from './fire';
import { cover, currentStats, leaderCommand, type CoverVs } from './stats';
import { isUnit, typeOf } from './state';
import { other, type AttackInfo, type GameEvent, type GameState, type HexId, type PieceId } from './types';

/** The Leader Command included in a firing piece's current FP (stats.ts: Squads and Teams, and the non-Ordnance Weapons they carry). */
function commandIn(s: GameState, sh: Shooter): number {
  const p = s.pieces[sh.id];
  const unit = sh.weapon ? (p.carrier ? s.pieces[p.carrier] : null) : p;
  if (!unit || unit.where !== 'map' || sh.ordnance) return 0;
  const k = typeOf(unit).kind;
  return k === 'squad' || k === 'team' ? leaderCommand(s, unit.hex, unit.side) : 0;
}

/** What a defender's Cover is against `attack` (as fire.ts `defend` asks for it). */
const coverVs = (attack: AttackInfo, firers: HexId[]): CoverVs => ({ firers, mortarOrArtillery: attack.mortarOrArtillery, ignoresCover: attack.ignoresCover });

/** The 'firePower' event of `attack` just before its Fire Attack roll. */
export function firePowerEvent(s: GameState, attack: AttackInfo): GameEvent {
  const a = attackFp(s, attack.pieces, attack.targets);
  const pieces = attack.pieces
    .map((id) => shooter(s, id))
    .filter((x): x is Shooter => !!x)
    .map((sh) => ({ piece: sh.id, fp: sh.fp, command: commandIn(s, sh) }))
    .sort((x, y) => y.fp - x.fp);
  // as fire.ts adds it to the total after the roll
  const airburst = attack.mortarOrArtillery && attack.targets.some((h) => s.map.terrain[h] === 'Woods') ? 2 : 0;
  const vs = coverVs(attack, firerHexes(s, attack.pieces));
  const defenders = Object.values(s.pieces)
    .filter((p) => p.where === 'map' && attack.targets.includes(p.hex) && p.side === other(attack.side) && isUnit(p))
    .map((p) => ({ unit: p.id, morale: currentStats(s, p.id).morale, cover: cover(s, p.id, vs) }));
  return {
    kind: 'firePower', side: attack.side, targets: attack.targets.slice(),
    parts: { pieces, hindrance: a.hindrance, height: a.height, bonus: attack.bonus, played: attack.played.slice(), airburst, fp: a.fp + attack.bonus, defenders },
  };
}

/** The 'defending' event of unit `id` just before its Defense roll against `attack` (`firers`: the firing pieces' hexes). */
export function defendingEvent(s: GameState, id: PieceId, attack: AttackInfo, firers: HexId[]): GameEvent {
  return {
    kind: 'defending',
    unit: id,
    morale: currentStats(s, id).morale,
    cover: cover(s, id, coverVs(attack, firers)),
    attack: (attack.total ?? 0) - attack.reduction,
    moving: s.turn.moving.includes(id),
  };
}
