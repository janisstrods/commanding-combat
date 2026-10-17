# Game data notes (src/data)

Owner: Task 3 (game data). `scripts/build-data.ts` turns the research data in `design/data/` into `src/data/`;
`src/engine/data.ts` loads it. This file records every judgement call the conversion makes, and the caveats the data
carries from its sources. Re-run with `npx vite-node scripts/build-data.ts [cards|counters|scenarios|maps|rsg]`.

## Fate cards (`src/data/cards.json`)

- Source: `design/data/fate-cards.json` (VASSAL 2.6.4 card layers). Checked by `tests/data/cards.test.ts` against the
  rules reference: 72 cards per deck, every ordered dice pair twice, trigger counts (§1.9.1), Order / Action / Event
  mixes (Parts C–E), unique Random Hexes (odd rows German, even rows American / Russian).
- Ids: `G-nn` German, `A-nn` American, `R-nn` Russian (the module calls the Russian cards `S-nn`; the scenarios
  reference's `R-31` is the module's `S-31`).
- Names normalised to `types.ts`: "White Phosphorous" → "White Phosphorus" (Medic and Elan were already plain).
- `defenderOnly` = Bore Sighting and the five Hidden actions (§A27, §A35). The module's `action_defender_only` tags agree
  on all 216 cards; the build stops if they ever disagree.
- `fireIsAction` = every Fire Order card ("Order/Action Fire").
- `breeze`: only the six Breeze cards of each deck print a wind direction (one of each of 1–6 per deck). The other cards
  have `null`. **types.ts edit:** `FateCard.breeze` became `HexSide | null`.
- Caveat (survey): the cards are the module's encoding; no physical cards were compared. The S4 manifests agree with the
  mixes and trigger counts in the rules reference.

## Counters (`src/data/counters.json`)

- Source: `design/data/counters.json` (VASSAL Parts palette). Ids `<Nation>/<name>` with the module names, so the
  scenario forces resolve: e.g. `German/Fallschirmjager Squad` (the Playbook's "Parachute Squad"), `German/Lt Von
  Karsties`, `American/Radio:105mm`, `German/Dietel (Hero)`.
- **Broken sides are module-only.** Front values and boxes were checked against the GMT OB / Support charts; broken
  values come from the module's break increments and were never compared with physical counters. Patterns: broken
  Leaders have Command 0, Range 0, Movement 1; broken Morale is sometimes higher than the front (e.g. German Rifle Squad
  7 → 7, Conscript 6 → 5, but SS 8 → 10).
- **Boxed values on broken sides:** the module's box layers switch off when a unit breaks, so every unit's `broken.boxed`
  is all false. (Boxed FP gives +1 melee and Assault Fire, §3.1.6: a broken unit therefore never gets those.) To check
  against physical counters.
- **Heroes:** the module eliminates a Hero instead of flipping it; the rules reference treats a Hero as a Leader in all
  respects (§3.4), so the engine flips it. Its broken values (1-2-3, Morale 9, Command 0) are the module's.
- **Privates** (Pvt Herzog / Gelon / Adamson): the module gives FP 2 and Command 2, odd for a Private (§E56 says
  Morale 6, Command 2 — the Command matches; FP 2 is unverified). They are on no support table.
- Leaders: `rank` Pvt / Cpl / Sgt / Lt / Cpt; Heroes have no rank and `hero: true`; Privates `private: true`.
- Squad `quality` from the Playbook point-value table (S4 p. 34): Elite = German Pionier, SS, Fallschirmjäger, Elite Rifle;
  American Engineer, Paratroop, Elite; Russian Assault, Guards SMG, Guards Rifle. Line = German Rifle, Volksgrenadier;
  American Line; Russian SMG, Rifle. Green = German Conscript, American Green, Russian Militia. Teams take the quality in
  their name; the **Weapon Team has no quality**. `teamFor(nation, quality)` (data.ts) gives the Elite / Line / Green
  Team for Light Wounds and Deploy, which use the OB troop quality (FAQ), not the squad's.
- Weapons: `front.move` is the printed Movement modifier, **0 or negative** (e.g. HMG −1), to be *added* to the carrier's
  Movement. `broken` repeats the front values (a broken weapon only shows fix / elim). `fix` / `elim` are the Random Hex
  number ranges printed on the broken side. Mortars: `minRange` and `front.range` = maximum range (German 2–13, Russian
  2–14, American 2–16, all Medium 3–16).
- `weaponClass`: LMG / MMG / HMG / .50 cal MG → `mg`; Light / Medium Mortar → `mortar`; Flamethrower → `flamethrower`
  (`ignoresCover`); Satchel Charge → `satchel` (`oneUse`); IG 18 / IG 33 / Infantry Gun / Pack Howitzer → `gun`.
  `ordnance` = white band (mortars, guns, Flamethrower, Satchel Charge). `smoke` = "Smoke" on the counter.
- Radios: `front.fp` = battery FP (8–13), range / move 0; `smoke` from the counter (no Smoke on American 203mm and
  Russian 152mm). No fix / elim (Battery Access repairs, Artillery Denied eliminates).
- **Left out:** Molotov Cocktail (all three nations) and the German Panzerfaust. Neither is on the 2006 CC:E charts, no
  base scenario or RSG table uses them, and the Molotov's fix number ("1 or 10") does not fit the `fix` range.
  Scenario 11 uses the Playbook's two American Satchel Charges (the module stages two German Panzerfausts there).
- Objective chits (`OBJECTIVE_CHITS`): values from the chit images (§7.3.2); S / T / U value `'all'` five Objectives;
  R, V, W, X have no secret side (`secret: false`). Smoke markers (`SMOKE_MIX`): hindrance 1–5 six each, 6–10 four each
  (50). Counter-mix limits are not in the module (survey §3) and are not modelled.

<!-- auto:scenarios -->
## Scenarios (src/data/scenarios/<n>.json)

_Generated by scripts/build-data.ts; edit the build, not this section._

Built from design/data/scenarios.json (the VASSAL setups: forces, quality, orders, surrender, time, SD, VP, chits,
initiative, reinforcements, pre-placed pieces) plus scripts/data/scenario-rules.ts (design/scenarios-reference.md:
names, edges, set-up areas and order, first Turn, special rules). Hand size by posture and Discard Capability by
nation unless a special rule says otherwise. Where the Playbook and the module differ, the Playbook wins.

### Conversion calls

- Scenario 1 (Fat Lipki): Set-up is simultaneous and hidden (simultaneousSetup); setupFirst = allied only orders the prompts.
- Scenario 1 (Fat Lipki): firstTurn = allied: the default when the Axis keeps the Initiative card (initiativeChoice may swap it).
- Scenario 2 (Hedgerows & Hand Grenades): Forward Observer: Lt Blankenship stays in the Allied forces and is listed in latePlacement (placed after the Axis set-up).
- Scenario 2 (Hedgerows & Hand Grenades): Bocage: hedge.cost is the extra cost to cross a Hedge (+2 instead of +1), hedge.cover its Cover (2 instead of 1).
- Scenario 5 (Cold Front): Played on the winter map 5w (the module setup uses Board 5W; the Playbook prints map 5 with Snow).
- Scenario 7 (Bessarabian Nights): Set-up areas: Allies depth 15 (anywhere, placed by the Random Hex rule in the notes); Axis anyFree (not in a hex with a Russian unit, after the Allies).
- Scenario 7 (Bessarabian Nights): The captured Light Mortar is the counter German/Light Mortar in the Allied forces.
- Scenario 8 (Breakout Dance): Chit W: the module parks it in the Axis box; it has no secret side, so it is an open chit (as the Playbook lists it).
- Scenario 9 (Rush to Contact): Allied Radio 105mm on Time space 6 (to the Artillery Box) added from the Playbook; the module setup lacks it.
- Scenario 9 (Rush to Contact): The module pre-places the 7 FP and 8 FP Minefield strength markers; the Playbook says 8 FP (minefield 8).
- Scenario 10 (Commando School): German leader: the Playbook lists Lt Schrader where the module setup has Lt Lauerbach (same values); the Playbook wins.
- Scenario 11 (Hold the Line): The module stages two German Panzerfaust counters with the Americans; the Playbook lists two American Satchel Charges (SSR 4).
- Scenario 11 (Hold the Line): The module's "Immobilized Sherman" fortification is the Playbook's Bunker.
- Scenario 12 (Misty Mountain): Base-game stand-ins (as in the VASSAL setup): US Lt Blankenship, Cpl Hubbard and Cpl Jensen for the Brazilian Lt Oliveira, Cpl Pereira and Cpl Santos; Sgt Smith for Sgt Alves; US Line / Green Squads, Weapon Teams, MMGs and mortars (same printed values).

### Special rules the SpecialRules fields cannot express (`special.notes`; each needs code in Task 1 / 7-10)

- Scenario 3 (Bonfire of the NKVD): Command Post: Cpt Egorov sets up in N5.
- Scenario 3 (Bonfire of the NKVD): Hidden Fortifications: the Allies may place their Wire after the Axis set-up (in their own set-up area).
- Scenario 3 (Bonfire of the NKVD): Sappers: the Axis starts with card G-65 in hand (taken out of the deck before shuffling; it counts toward the opening hand).
- Scenario 4 (Closed for Renovation): Hidden Gun: the Axis may set up one Weapon Team and the IG 18 Gun after the Allied set-up (in the Axis set-up area).
- Scenario 4 (Closed for Renovation): Rubble: Axis Wire must be placed in or adjacent to Building hexes.
- Scenario 5 (Cold Front): Deep Freeze: one of the four German Weapons, picked at random, starts broken. After play starts no Fortification can enter play by any means (an Action or Event that would place one does nothing, like Command Confusion).
- Scenario 5 (Cold Front): Winter Camouflage: an Allied Concealment Action lowers the Axis Fire Attack Total by a further 2.
- Scenario 6 (Paralyzed from the West Down): Axis Orders per Turn start at 1 and rise by 1 at every Time advance, to at most 3.
- Scenario 7 (Bessarabian Nights): Allied set-up: for each Russian unit reveal a Random Hex from the Russian Fate deck; the unit sets up in or adjacent to that hex. Then the Allies hand out their Weapons to Russian units, and the Russian deck is reshuffled.
- Scenario 7 (Bessarabian Nights): Axis set-up: all German units form one contiguous chain of Axis-occupied hexes, none in a hex with a Russian unit.
- Scenario 7 (Bessarabian Nights): Objective control starts with the side that alone occupies each Objective after set-up; the others start uncontrolled.
- Scenario 7 (Bessarabian Nights): The captured German Light Mortar is eliminated instead of breaking.
- Scenario 7 (Bessarabian Nights): No Quarter: nobody can earn Exit VP; a unit that leaves the map in any way is eliminated.
- Scenario 7 (Bessarabian Nights): Partisans: Allied units pay exactly 1 MP for every hex they enter (terrain, hexside and uphill costs are ignored); impassable terrain stays impassable and Wire still ends their movement.
- Scenario 7 (Bessarabian Nights): Hidden Forces: the Allies start with card R-31 in hand (taken out of the deck before shuffling; it counts toward the opening hand).
- Scenario 8 (Breakout Dance): Night Action: every Fire Attack Total is reduced by the distance in hexes between the target and the closest firing hex.
- Scenario 8 (Breakout Dance): Breakout: only the Axis can earn Exit VP; a Russian unit that leaves the map for any reason counts as eliminated.
- Scenario 9 (Rush to Contact): Mines option: before the opening draw the Axis may cut his Mines from 8 to 7 FP and in exchange start with card G-32 in hand (taken out of the deck before shuffling; it counts toward the opening hand).
- Scenario 10 (Commando School): Combat Engineers: the two Pionier Squads start carrying the Flamethrower and the Satchel Charge (one each).
- Scenario 10 (Commando School): Commandos: every Allied Melee roll gets +1.
- Scenario 11 (Hold the Line): Uncleared Fortifications: the pre-placed Wire and Mines belong to neither side; the Mines are 6 FP.
- Scenario 11 (Hold the Line): Immobilised Sherman: the Bunker, Sgt Buehler with the .50 cal MG and the Weapon Team with the Pack Howitzer set up together in one non-Hill Open Ground hex. While the Bunker exists, that hex holds at most 4 figures of units. The Pack Howitzer cannot leave the Bunker hex and is eliminated if its carrier or the Bunker is.
- Scenario 11 (Hold the Line): Captured Panzerfausts: the two American Satchel Charges cannot attack a hex whose Cover is below 2.
- Scenario 12 (Misty Mountain): Reinforcements: when the Time space 7 group enters, any of it may be placed in or adjacent to road hex A9 instead of along the friendly edge.
- Scenario 12 (Misty Mountain): Caves: an Axis Sniper may break an enemy unit up to 2 hexes from the Random Hex.
- Scenario 12 (Misty Mountain): Fog: every hex has a Hindrance of 3 at every elevation, added to the largest other Hindrance (also for adjacent shots; not for Melee, Mine Attacks or Artillery Impact). Each Breeze Event lowers the fog by 1 (to 2, 1, then 0).
<!-- /auto:scenarios -->
