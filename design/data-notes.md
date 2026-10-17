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
