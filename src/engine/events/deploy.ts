// Deploy (§E52, R-03): the receiver may replace one of his Squads on the map by two Teams of his OB troop quality. The
// Teams are broken if the Squad was and share its activation status (casualties.ts `deploySquad`). Each of the Squad's
// markers (Weapon, Suppressed, Veteran) goes to one Team; with two or more he chooses how they split (S7 precedent).
import { deploySquad } from '../casualties';
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { typeOf } from '../state';
import type { GameState, Piece } from '../types';
import { mapUnits, note } from './helpers';

type Marker = 'weapon' | 'suppressed' | 'veteran';
type Split = Partial<Record<Marker, number>>;

export const deployEvent: EventHandler = function* (s, ctx, receiver) {
  const squads = mapUnits(s, receiver, (p) => typeOf(p).kind === 'squad');
  if (!squads.length) {
    note(ctx, receiver, 'Deploy: no Squad of his on the map.');
    return;
  }
  const pick = yield* choose(s, ctx, receiver, 'deploy', squads.map((p) => ({ piece: p.id })), 0, 1);
  if (!pick.length) return;
  const sq = squads[pick[0]];
  const markers: Marker[] = [];
  if (sq.weapon) markers.push('weapon');
  if (sq.suppressed) markers.push('suppressed');
  if (sq.veteran) markers.push('veteran');
  let split: Split = {};
  if (markers.length > 1) {
    const splits = splitsOf(markers);
    const items = splits.map((sp) => ({ label: describe(s, sq, markers, sp) }));
    const [i] = yield* choose(s, ctx, receiver, 'deployMarkers', items, 1, 1, { piece: sq.id, splits });
    split = splits[i];
  }
  deploySquad(s, ctx, sq.id, split);
};

/** The ways to share the markers between two identical Teams: the first goes to Team 1, each other to Team 1 or 2. */
function splitsOf(markers: Marker[]): Split[] {
  const out: Split[] = [];
  for (let mask = 0; mask < 1 << (markers.length - 1); mask++) {
    const sp: Split = { [markers[0]]: 0 };
    markers.slice(1).forEach((m, i) => {
      sp[m] = (mask >> i) & 1;
    });
    out.push(sp);
  }
  return out;
}

function describe(s: GameState, sq: Piece, markers: Marker[], sp: Split): string {
  const name = (m: Marker) => (m === 'weapon' ? typeOf(s.pieces[sq.weapon!]).name : m === 'suppressed' ? 'Suppressed' : 'Veteran');
  const team = (n: number) => markers.filter((m) => sp[m] === n).map(name).join(', ');
  const second = team(1);
  return second ? `Team 1: ${team(0)} · Team 2: ${second}` : `Team 1: ${team(0)} · Team 2: nothing`;
}
