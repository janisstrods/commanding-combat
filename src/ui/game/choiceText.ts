// Wording of the generic 'choose' decision, by reason. Reasons other tasks add later fall back to a plain wording, so a
// new reason never breaks the screen (add its line here when it lands).
import type { ChoiceItem, GameState, HexId } from '../../engine/types';
import { hexName } from './names';

export interface ChoiceWords {
  title: string;
  /** The instruction; `{n}` is replaced by how many to choose ("one", "up to 2", ...). */
  text: string;
  /** Label of the button that chooses none, when choosing none is allowed. */
  none?: string;
}

export const CHOICE_TEXT: Record<string, ChoiceWords> = {
  rallyOrder: { title: 'Recover', text: 'Choose the broken unit that rolls to rally next.' },
  routOrder: { title: 'Rout', text: 'Choose the broken unit you roll for next.' },
  defenseOrder: { title: 'Defense rolls', text: 'Choose the unit that makes its Defense roll next (roll Leaders last: a broken Leader loses his Command).' },
  retreatStep: { title: 'Retreat', text: 'Choose the hex the routed unit retreats into.' },
  sniperTarget: { title: 'Sniper!', text: 'You may break one unit in or next to the Random Hex.', none: 'Break nobody' },
  airSupport: { title: 'Air Support', text: 'Choose the hex the planes strike: every unit there breaks.', none: 'Call it off' },
  battleHarden: { title: 'Battle Harden', text: 'Choose one of your units to become Veteran.' },
  commissar: { title: 'Commissar', text: 'Choose one of your broken units: it rallies or is shot.' },
  deploy: { title: 'Deploy', text: 'You may split one of your Squads into two Teams.', none: 'Do not deploy' },
  deployMarkers: { title: 'Deploy', text: 'Choose which Team keeps each marker of the Squad.' },
  fieldPromotion: { title: 'Field Promotion', text: 'You may place your Private with one of your broken units.', none: 'Do not place him' },
  heroPlace: { title: 'Hero', text: 'Choose the friendly hex where your Hero appears.' },
  heroRally: { title: 'Hero', text: 'You may rally one broken unit in the Hero’s hex.', none: 'Rally nobody' },
  infiltration: { title: 'Infiltration', text: 'Choose the unit that infiltrates.' },
  infiltrationPlace: { title: 'Infiltration', text: 'Choose where the infiltrators appear.' },
  interdiction: { title: 'Interdiction', text: 'Choose an unsuppressed unit without Cover to suppress.' },
  interrogation: { title: 'Interrogation', text: 'Your opponent shows you his hand. You may make him discard one card.', none: 'Discard none' },
  kia: { title: 'KIA', text: 'Choose a broken unit to eliminate.' },
  malfunctionTie: { title: 'Malfunction', text: 'Several Weapons are equally near: choose the one that breaks.' },
  medic: { title: 'Medic!', text: 'Choose a broken unit to rally.' },
  pow: { title: 'Prisoners of War', text: 'Choose one of your broken units next to the enemy: it is captured.' },
  reconnaissance: { title: 'Reconnaissance', text: 'Choose one of your secret Objective chits to reveal.' },
  reinforcementItem: { title: 'Reinforcements', text: 'Choose the reinforcement you take from the Support Table.' },
  reinforcementPlace: { title: 'Reinforcements', text: 'Choose where the reinforcement enters along your edge.' },
  sappers: { title: 'Sappers', text: 'You may remove one Mines or Wire marker.', none: 'Remove nothing' },
  scrounge: { title: 'Scrounge', text: 'You may take an eliminated Weapon from the Casualty Track.', none: 'Take nothing' },
  scroungeUnit: { title: 'Scrounge', text: 'Choose the unit that takes the Weapon.' },
  shellShockTie: { title: 'Shell Shock', text: 'Several units are equally near: choose the one that breaks.' },
  suppressingFire: { title: 'Suppressing Fire', text: 'You may suppress one enemy unit your MG can see.', none: 'Suppress nobody' },
  walkingWounded: { title: 'Walking Wounded', text: 'Choose the eliminated unit that comes back.' },
  walkingWoundedPlace: { title: 'Walking Wounded', text: 'Choose where the unit comes back.' },
  whitePhosphorus: { title: 'White Phosphorus', text: 'You may place Smoke next to one of your Squads.', none: 'No Smoke' },
  whitePhosphorusLoss: { title: 'White Phosphorus', text: 'Choose your unit in the smoke that breaks.' },
  smokeRemoval: { title: 'Time advance', text: 'Choose the Smoke marker to remove from the map.' },
  blazeDisplace: { title: 'Blaze', text: 'Choose where your unit escapes the fire.' },
  overstackDeploy: { title: 'Overstacked', text: 'Too many figures in one hex. You may first split a Squad into two Teams.', none: 'Do not deploy' },
  overstackEliminate: { title: 'Overstacked', text: 'Too many figures in one hex: choose a unit to eliminate.' },
  ambushVictim: { title: 'Ambush', text: 'Choose your unit in the melee that breaks.' },
  exitSpace: { title: 'Exit', text: 'Choose the Time Track space where the exited units wait to come back.' },
  supportItem: { title: 'Support Table', text: 'Choose an item from the Support Table.' },
  hiddenUnitPlace: { title: 'Hidden Unit', text: 'Choose where the hidden unit appears.' },
  sprayHex: { title: 'Spray Fire', text: 'Choose the second target hex.' },
  sustainedBreak: { title: 'Sustained Fire', text: 'Doubles: choose the MG or Mortar that breaks.' },
  fortRemove: { title: 'Demolitions', text: 'Choose the Fortification to remove.' },
  digInHex: { title: 'Dig In', text: 'Choose the hex for the Foxholes.' },
  entrenchHex: { title: 'Entrench', text: 'You may place Foxholes in a hex you occupy.', none: 'No Foxholes' },
  smokeGrenadeHex: { title: 'Smoke Grenades', text: 'Choose the hex for the Smoke.' },
  spotterSR: { title: 'Artillery Request', text: 'Choose the hex for the Spotting Round (lit: in your Spotter’s line of sight). The Accuracy roll may make it drift.' },
  artilleryKind: { title: 'Artillery Request', text: 'Choose the fire mission: high explosive, or a Smoke barrage.' },
  impactOrder: { title: 'Artillery', text: 'Choose the hex the next Artillery Impact roll is made in.' },
  meleeOrder: { title: 'Melee', text: 'Several melees are due: choose the one fought next.' },
  initiativeChoice: { title: 'Initiative', text: 'You hold the Initiative. Keep it and move second, or give it away and move first.' },
  placement: { title: 'Set-up', text: 'Choose the hex for this Fortification.' },
  scenarioOption: { title: 'Scenario option', text: 'Before the opening hands are dealt, this scenario offers you a choice.' },
};

/** Labels of 'label' items, by reason and label. */
const LABEL_TEXT: Record<string, Record<string, string>> = {
  initiativeChoice: { keep: 'Keep the Initiative, move second', give: 'Give it away, move first' },
  artilleryKind: { Barrage: 'Barrage: an Impact roll in every hex of the blast', 'Smoke barrage': 'Smoke barrage: Smoke in all seven hexes' },
};

export function choiceWords(reason: string, context?: unknown): ChoiceWords {
  const w = CHOICE_TEXT[reason] ?? { title: 'Choose', text: `Make a choice (${reason}).` };
  const ctx = context as { fort?: string; hex?: HexId } | undefined;
  if (reason === 'placement' && ctx?.fort) {
    const crew = (context as { units?: unknown[] }).units?.length ? ' Its crew sets up there with it.' : '';
    return { ...w, text: `Choose the hex for your ${cap(ctx.fort)}.${crew}` };
  }
  const opt = context as { minefield?: number; card?: string } | undefined;
  if (reason === 'scenarioOption' && opt?.minefield !== undefined && opt.card) {
    return { ...w, text: `You may weaken your Minefield to ${opt.minefield} FP and start with this card in your opening hand (shown below).` };
  }
  if ((reason === 'overstackEliminate' || reason === 'overstackDeploy' || reason === 'defenseOrder') && ctx?.hex !== undefined) {
    return { ...w, text: `${w.text} (${hexName(ctx.hex)})` };
  }
  return w;
}

export function labelText(reason: string, label: string): string {
  return LABEL_TEXT[reason]?.[label] ?? cap(label);
}

/** "Choose 1", "Choose up to 2", "Choose 1 to 3". */
export function countText(min: number, max: number): string {
  if (min === max) return `Choose ${min}.`;
  if (min === 0) return `Choose up to ${max}.`;
  return `Choose ${min} to ${max}.`;
}

/** The kind of the items of a choice ('piece' when all are pieces, etc.; 'mixed' otherwise). */
export function itemKind(items: ChoiceItem[]): 'piece' | 'hex' | 'card' | 'chit' | 'type' | 'space' | 'label' | 'mixed' | 'none' {
  if (!items.length) return 'none';
  const k = Object.keys(items[0])[0] as 'piece';
  return items.every((i) => k in i) ? k : 'mixed';
}

/** The hex of a choice item on the board, if it has one. */
export function itemHex(s: GameState, it: ChoiceItem): HexId | null {
  if ('hex' in it) return it.hex;
  if ('piece' in it) {
    const p = s.pieces[it.piece];
    if (!p) return null;
    if (p.where === 'map') return p.hex;
    if (p.where === 'carried' && p.carrier) {
      const c = s.pieces[p.carrier];
      return c?.where === 'map' ? c.hex : null;
    }
  }
  return null;
}

function cap(x: string): string {
  return x.charAt(0).toUpperCase() + x.slice(1);
}
