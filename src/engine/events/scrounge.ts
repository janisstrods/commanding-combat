// Scrounge (§E71, R-37): the receiver may take one eliminated Weapon (either side's) from the Casualty Track's Weapons
// box and give it, unbroken, to one of his units on the map that has no Weapon.
import { choose } from '../decisions';
import type { EventHandler } from '../registry';
import { attachWeapon, isWeapon } from '../state';
import type { Piece } from '../types';
import { mapUnits, note } from './helpers';

export const scroungeEvent: EventHandler = function* (s, ctx, receiver) {
  const weapons: Piece[] = [];
  for (const id in s.pieces) if (s.pieces[id].where === 'weaponsBox' && isWeapon(s.pieces[id])) weapons.push(s.pieces[id]);
  const units = mapUnits(s, receiver, (p) => !p.weapon);
  if (!weapons.length || !units.length) {
    note(ctx, receiver, weapons.length ? 'Scrounge: every unit of his already has a Weapon.' : 'Scrounge: no eliminated Weapon to take.');
    return;
  }
  const pick = yield* choose(s, ctx, receiver, 'scrounge', weapons.map((w) => ({ piece: w.id })), 0, 1);
  if (!pick.length) return;
  const w = weapons[pick[0]];
  const [j] = yield* choose(s, ctx, receiver, 'scroungeUnit', units.map((u) => ({ piece: u.id })), 1, 1, { weapon: w.id });
  const u = units[j];
  w.side = receiver;
  w.broken = false;
  attachWeapon(s, w, u);
  ctx.emit({ kind: 'place', piece: w.id, hex: u.hex });
};
