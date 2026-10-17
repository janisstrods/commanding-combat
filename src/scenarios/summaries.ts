// Original one-paragraph briefings for the twelve scenarios, shown in the scenario picker. Written for this edition from
// the historical situation and the set-up facts in design/scenarios-reference.md (never the playbook's text).

export interface ScenarioSummary {
  /** Where and when, in a few words. */
  place: string;
  /** One paragraph: the situation and what each side must do. */
  text: string;
}

export const SUMMARIES: Record<string, ScenarioSummary> = {
  '1': {
    place: 'Lipki, Russia · 3 July 1941',
    text:
      'Two armoured spearheads have each sent infantry out to guard their flanks, and the patrols collide in a wooded ' +
      'hamlet south of the town, both racing for the same crossroads. Neither side knows where the other has gone to ' +
      'ground: both deploy unseen and at once, the Russians around the northern corners and the Germans along the ' +
      'southern edge. The Russians bring twice as many squads and more orders each turn; the Germans have fewer men but ' +
      'sharper leaders, and their player decides who moves first.',
  },
  '2': {
    place: 'Pont-Hébert, Normandy · July 1944',
    text:
      'In the hedgerow country of Normandy every field is a fortress walled with earth banks and thick hedges. An ' +
      'American rifle company, backed by a mortar, a machine gun and a radio to the guns, must prise a scratch force of ' +
      'Volksgrenadiers and conscripts out of the bocage. Crossing a hedge is slow and the hedges give real cover, so ' +
      'every field costs time; an American officer can slip forward behind the lines as an artillery spotter before the ' +
      'shooting starts.',
  },
  '3': {
    place: 'Near Brest-Litovsk · 24 June 1941',
    text:
      'Two days into the invasion, a forward NKVD command post is burning its files while a green militia company tries ' +
      'to buy it the time to finish. German infantry well stocked with machine guns arrive from the west, ready to blow open ' +
      'whatever stands in the way. The Russians start well ahead on points and hold every objective, with wire they can reveal once ' +
      'the attackers have shown their hand; the Germans must break in fast before the bonfire, and the clock, run out.',
  },
  '4': {
    place: 'Humain, Belgium · 27 December 1944',
    text:
      'At the far tip of the Bulge, the last men of a panzer division have turned a château and its village into a ' +
      'strongpoint and refuse to give it up. Veteran American armoured infantry close in from the north, with engineers ' +
      'and flamethrowers on the way. Both sides are elite. The Germans may keep a gun and its crew hidden until the ' +
      'Americans have committed, and their wire is strung through the rubble of the buildings.',
  },
  '5': {
    place: 'Staritsa, Russia · 30 December 1941',
    text:
      'In the bitter winter counter-offensive before Moscow, fresh Siberian Guards in snow smocks storm a German infantry ' +
      'regiment dug into trenches on the frozen front. Deep snow makes open ground slow to cross, the cold has jammed one ' +
      'of the German weapons before the battle begins, and no new defences can be dug once it starts. The Russians have ' +
      'the numbers, the initiative and white camouflage; the Germans have the trenches and the time.',
  },
  '6': {
    place: 'Sainte-Mère-Église · 7 June 1944',
    text:
      'The day after the airborne landings, a company of American paratroopers counter-attacks a German battalion that ' +
      'has just lost its officers to the same men. Leaderless and slow to react at first, the defenders can give only one ' +
      'order a turn, then more as the battle goes on and the chain of command is restored. The elite Americans must ' +
      'strike through the town before the Germans pull themselves together.',
  },
  '7': {
    place: 'Bessarabia · April 1944',
    text:
      'Far behind the front, German rear-area troops sweep the countryside for partisans. The Russian fighters are ' +
      'scattered across the map wherever the cards place them, slip through any terrain at the same pace and start with ' +
      'a hidden unit in hand; the Germans must then set up in one unbroken chain. Nobody can walk away from this fight: ' +
      'any unit that leaves the map is lost. The side holding the more valuable ground when time runs out takes the day.',
  },
  '8': {
    place: 'Velikiye Luki · January 1943',
    text:
      'The encircled garrison is doomed, and a German lieutenant leads a few dozen men out through the snow at night to ' +
      'reach their own lines. In the dark, fire grows weaker with every hex of distance, and the Germans can hardly ' +
      'discard cards. Only the Germans score for leaving the map, and a Russian unit that leaves counts as lost. The ' +
      'Russians must stop the breakout with too few orders to be everywhere at once.',
  },
  '9': {
    place: 'Hitdorf, Germany · 6 April 1945',
    text:
      'In the last weeks of the war, American paratroopers on the Rhine run into a Volksgrenadier division on the edge ' +
      'of a small town, and both sides feed reinforcements into the fight as they arrive. The Americans attack with elite ' +
      'troops and many orders but must cross a minefield; the Germans can trade some of the mines’ strength for a ' +
      'hidden-minefield card in hand. A long, see-saw battle with plenty of time on the clock.',
  },
  '10': {
    place: 'Stanichka, near Novorossiysk · 4 February 1943',
    text:
      'Black Sea Fleet commandos have stormed ashore and seized a university by a lake, and now they must hold it against ' +
      'a German counter-attack. The Germans bring combat engineers carrying a flamethrower and a satchel charge for the ' +
      'buildings, and more orders each turn. The sailors are elite and deadly at close quarters: every Russian melee roll ' +
      'gets a bonus, so storming a building they hold is never cheap.',
  },
  '11': {
    place: 'Saint-Jean-de-Daye · 8 July 1944',
    text:
      'A small American force holds Hill 104 around a Sherman that has thrown a track, its machine gun and a pack ' +
      'howitzer dug in beside it like a bunker. At dawn elite German troops counter-attack across ground still strewn ' +
      'with uncleared wire and mines. American reinforcements trickle in one squad at a time; the Germans must take the ' +
      'hill before the line can be rebuilt.',
  },
  '12': {
    place: 'Monte Castello, Italy · 12 December 1944',
    text:
      'Brazilian infantry of the Expeditionary Force climb a fortified Apennine mountain in thick fog against German ' +
      'defenders who know every cave and gully on it. The fog hinders every shot and only lifts as the wind rises, ' +
      'German snipers strike from further away than usual, and a column of fresh troops arrives late by the road. The ' +
      'attackers have numbers and time; the defenders have the heights. (The Brazilians are played with American ' +
      'pieces and the American Fate deck.)',
  },
};

/** The briefing of scenario `id`, or null for one without (e.g. a random scenario). */
export function summaryOf(id: string): ScenarioSummary | null {
  return SUMMARIES[id] ?? null;
}
