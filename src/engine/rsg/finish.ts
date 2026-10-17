// A finished RSG draft as a ScenarioDef (id 'rsg'): RS.10–RS.16 set-up areas, order, markers and cards.
import { RSG } from '../data';
import { DISCARD_CAPABILITY, HAND_SIZE } from '../setup';
import { type FortKind, type Posture, type ScenarioDef, type Side, type SideSetup, type SpecialRules, SIDES } from '../types';
import { addAll, attackerOf, defenderOf, fortOb, nationOf, obOf, obUnits } from './tables';
import { rsgStep } from './steps';
import type { RsgDraft } from './types';

// ---------------------------------------------------------------------------------------------------------------------
// The scenario

const ROLE: Record<Posture, 'defender' | 'attacker' | 'recon'> = { defend: 'defender', attack: 'attacker', recon: 'recon' };

/** The ScenarioDef of a finished draft (throws before the last step). */
export function rsgFinish(d: RsgDraft): ScenarioDef {
  if (rsgStep(d).kind !== 'done') throw new Error('The RSG is not finished.');
  const year = d.year!;
  const postures = d.postures!;
  const edges = d.edges!;
  const wide = edges.axis === 'top' || edges.axis === 'bottom';
  const def = defenderOf(d);
  const carried: Partial<Record<Side, { unit: string; weapon: string }[]>> = {};
  const sides = {} as Record<Side, SideSetup>;
  for (const side of SIDES) {
    const nation = nationOf(d, side);
    const { size } = obOf(d, side);
    const forces: Record<string, number> = obUnits(size, year);
    for (const l of d.leaders[side]) addAll(forces, { [l]: 1 });
    for (const r of d.support) {
      if (r.side !== side) continue;
      for (const b of r.bought) {
        addAll(forces, b.pieces);
        if (b.carrier && b.weapon) (carried[side] ??= []).push({ unit: b.carrier, weapon: b.weapon });
      }
    }
    if (d.asset?.radio && side === attackerOf(d)) addAll(forces, { [d.asset.radio]: 1 }); // to the Artillery Box
    const fortifications: Partial<Record<FortKind, number>> = {};
    let minefield: number | undefined;
    if (side === def) {
      for (const id of d.fortifications) {
        const f = fortOb(id)!;
        addAll(fortifications, f.contents);
        if (f.minefield) minefield = f.minefield;
      }
    }
    const posture = postures[side];
    sides[side] = {
      nation, posture, quality: d.quality[side]!, orders: size.orders, handSize: HAND_SIZE[posture],
      discard: DISCARD_CAPABILITY[nation], surrender: size.surrender, edge: edges[side], forces, fortifications,
      reinforcements: {}, setupArea: { kind: 'depth', depth: RSG.setupDepth[ROLE[posture]][wide ? 'wide' : 'narrow'] },
      secretChits: [...d.secretChits[side]],
    };
    if (minefield !== undefined && fortifications.mines) sides[side].minefield = minefield;
  }
  const special: SpecialRules = { controlAfterSetup: true };
  if (d.fortifications.length) special.fortificationsLast = true;
  if (carried.axis || carried.allied) special.carried = carried;
  const label = (side: Side) => `${nationOf(d, side)} ${obOf(d, side).size.label}`;
  return {
    id: 'rsg',
    name: `Random ${year}: ${label('axis')} v ${label('allied')}`,
    map: d.map!,
    year,
    sides,
    initiative: d.initiative!,
    firstTurn: d.initiative!,
    // RS.10: the Defender sets up first. Ruling for RS.13: the Recon side with the higher OB Initiative sets up first,
    // and on a tie the side that won the Initiative coin flip (R-50).
    setupFirst: def ?? d.initiative!,
    time: 0,
    suddenDeath: sides.axis.orders + sides.allied.orders,
    vp: d.vp,
    control: [...d.control!],
    openChits: [...d.openChits],
    prePlaced: [],
    special,
  };
}
