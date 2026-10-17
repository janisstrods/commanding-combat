// Short card texts for the Fate card faces and hover help: our own one- or two-sentence paraphrases written from
// design/rules-reference.md (Parts C, D, E). They summarise; the rules reference is the authority.
import type { ActionName, EventName, OrderName } from '../engine/types';

export const ORDER_TEXT: Record<OrderName, string> = {
  Advance:
    'Activate a unit, or a Leader and units in his Command radius. Each may enter one adjacent hex, even an enemy one, ignoring movement costs; melee follows.',
  'Artillery Denied': 'Break an enemy Radio; if it is already broken, eliminate it. Activates nothing.',
  'Artillery Request':
    'Repair your broken Radio, or with a working Radio and an unactivated Leader as spotter, place the Spotting Round in his line of sight and fire for effect.',
  'Command Confusion': 'Cannot be given as an Order. Use the card for its Action instead.',
  Fire: 'Activate a unit, or a Leader and units in his Command radius. Each may make one Fire Attack, alone or in a Fire Group, at an enemy hex in Range and line of sight.',
  Move: 'Activate a unit, or a Leader and units in his Command radius. Each spends its Movement Points to move; the enemy may Op Fire at every hex entered.',
  Recover: 'Activate yourself: remove all your Suppressed markers, then roll to rally each of your broken units against its Morale.',
  Rout: 'Activate a player with broken units and roll against each one’s Morale: equal suppresses it, higher makes it retreat toward its own edge.',
};

export const ACTION_TEXT: Record<ActionName, string> = {
  Ambush: 'Before the melee dice are rolled: your opponent must break one of his units in that melee.',
  'Assault Fire': 'While your units are activated to Move: those with boxed Firepower (or their Weapons) make one Fire Attack.',
  'Bore Sighting': 'Scenario Defender only. +2 FP to a Fire Attack that includes a Weapon with a printed Firepower of 5 or more.',
  'Command Confusion': 'Cannot be played as an Action.',
  Concealment: 'Before a Defense Roll: reduce the Fire Attack total by the Cover of the target hex.',
  Crossfire: '+2 FP to a Fire Attack on a hex with enemy units that are activated to Move.',
  Demolitions: 'When your opponent passes and discards: remove one Fortification from a hex with a friendly unit.',
  'Dig In': 'At the end of a Time advance: place Foxholes in a hex with a friendly unit.',
  Fire: 'Opportunity Fire: in an enemy Move, activate units as for a Fire Order and fire at the hex the movers just entered.',
  'Hand Grenades': '+2 FP to a Fire Attack in which a firing piece is adjacent to the target hex.',
  'Hidden Entrenchments':
    'Scenario Defender only. Before a Defense Roll: place Foxholes in the attacked hex (not a Building or Water hex, nor one with a Fortification).',
  'Hidden Mines': 'Scenario Defender only. After enemy units Move or Advance into a hex: place Mines there; they attack the units that entered.',
  'Hidden Pillbox': 'Scenario Defender only. Before a Defense Roll against an attack on an Objective hex: place the Pillbox there.',
  'Hidden Unit':
    'Scenario Defender only. When your opponent passes and discards: roll on your Support Table and set the unit up free in your setup area.',
  'Hidden Wire': 'Scenario Defender only. After enemy units Move or Advance into a hex: place Wire there; moving units must stop.',
  'Light Wounds': 'When one of your Squads would break: lose 1 VP and replace the Squad with a Team of your troop quality instead.',
  Marksmanship: 'German only. +2 FP to a Fire Attack that includes a firing German Squad or Team.',
  'No Quarter': 'After a melee one of your units survived: gain 2 VP. Germans may play it only against Russians; Russians against anyone.',
  'Smoke Grenades': 'A unit with boxed Movement that is activated to Move places a random Smoke marker in or next to its hex.',
  'Spray Fire': 'Every firing piece has boxed Range: one Fire Attack hits two adjacent enemy hexes with a single roll.',
  'Sustained Fire': '+2 FP to a Fire Attack that includes a Mortar or a machine gun; on doubles, one of them breaks.',
};

export const EVENT_TEXT: Record<EventName, string> = {
  'Air Support': 'Random Hex: you may break every unit there, or in the nearest hex holding units if it is empty.',
  'Battle Harden': 'Give a Veteran marker to one of your units that has none.',
  'Battlefield Integrity': 'Gain 1 VP for each enemy unit on the Casualty Track.',
  Blaze: 'Random Hex: a Blaze starts there, removing Smoke and any Fortification; the units there must move to an adjacent hex or are eliminated.',
  'Booby Trap': 'Random Hex: place Mines there (not in Water, a Blaze or a hex with a Fortification).',
  Breeze: 'Remove all Smoke from the map. Every Blaze spreads one hex downwind, in the direction of the arrow.',
  'Command & Control': 'Gain 1 VP for each Objective you control.',
  Commissar: 'Russian only. Roll for one of your broken units: above its Morale it is eliminated, otherwise it rallies.',
  Cower: 'Suppress each of your Squads that is outside the Command radius of every friendly Leader.',
  Deploy: 'You may replace one of your Squads on the map with two Teams of your troop quality.',
  Dust: 'Random Hex: place a random Smoke marker there.',
  Elan: 'Move your Surrender marker one space higher: one more casualty is needed before you surrender.',
  Entrench: 'Russian only. You may place Foxholes in a hex you occupy.',
  'Field Promotion': 'If your Private is not on the map, you may place him in a hex with one of your broken units.',
  'Fog of War': 'Each player takes a random card from the other’s hand; both go to their owners’ discard piles.',
  Hero: 'If your Hero is not on the map, place him in a hex with your units; he may rally one broken unit there.',
  Infiltration: 'Roll on your Support Table and take one item free (no Radio); place it in or next to a Random Hex.',
  Interdiction: 'Suppress one unit of either side in a hex whose Cover is less than 1.',
  Interrogation: 'Your opponent shows you his hand; you may send one of its cards to his discard pile.',
  KIA: 'Eliminate one broken unit of either side.',
  Malfunction: 'Random Hex: the unbroken Weapon nearest to it breaks (Radios are not Weapons).',
  Medic: 'Rally one broken unit of either side.',
  'Mission Objective': 'Draw a random Objective chit and keep it as an extra secret objective.',
  'Prisoners of War': 'Eliminate one of your broken units that is in or next to a hex with an enemy unit.',
  Reconnaissance: 'Your opponent must reveal one of his secret Objective chits; it scores at once.',
  Reinforcements: 'Roll on your Support Table and take one item free: a unit enters along your own edge, a Radio goes to your Artillery box.',
  Rubble: 'Random Hex: place Wire there (not in Water, a Blaze or a hex with a Fortification).',
  Sappers: 'You may remove one Mines or Wire marker from the map.',
  Scrounge: 'You may take one eliminated Weapon from the Casualty Track and give it to one of your units without a Weapon.',
  'Shell Shock': 'Random Hex: the unit nearest to it, of either side, breaks.',
  Shellholes: 'Random Hex: place Foxholes there (not in Water, a Blaze or a hex with a Fortification).',
  'Strategic Objective': 'Draw a random Objective chit and place it face up; it scores at once.',
  'Suppressing Fire': 'You may suppress one enemy unit in Range and line of sight of one of your working machine guns.',
  'Walking Wounded': 'Bring back one eliminated unit of either side, broken, in or next to a Random Hex.',
  'White Phosphorus':
    'American only. You may place a random Smoke next to one of your Squads; each player must then break one of his own units in that hex.',
};
