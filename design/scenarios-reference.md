# Combat Commander: Europe — Scenarios and RSG Reference

Status: research deliverable, 2026-10-17. Base game only. Numbers and paraphrased summaries; no GMT prose copied.
Rules terms refer to `design/rules-reference.md` (§ numbers there).

## 0. Sources and edition notes

| Source | Use |
|---|---|
| S4 — 20th Anniversary Playbook v1.1 (2025), GMT public PDF: https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/CC_20th/CC-20thAnniv_Playbook_ONLINE.pdf | Scenarios 1–12 (pp. 3–14), setup procedure HS (p. 2), RSG RS.1–RS.16 (pp. 31–33), point values (p. 34), design hints (p. 35), example of play (pp. 39–43), card manifests (pp. 46–51). Forces boxes are pictures; counts and counter stats were read from page renders. |
| S6 — VASSAL module CombatCommanderEurope 2.6.4 (images, user-approved download) | Order of Battle tables, Support tables, Leader table, Fortification OBs (player-aid art, ©2025 and ©2006/2007 versions — identical content where both exist), Objective chits. |
| S8 — InsideGMT RSG walkthrough (2022) | Fragments of the *original 2006* CC:E RSG. |

**Edition caveat.** The original 2006 CC:E Playbook (24 pp.) is not posted publicly by GMT. The 20th Anniversary Playbook
reprints the twelve CC:E scenarios (marked "v1.1 of the playbook", blue text = changes from the first edition, which
we cannot see in a text render). Differences we know of:
- Scenario 12 (Misty Mountain) in the 20th edition uses **Brazilian** counters (from the Minor Nations material) with the
  US Fate deck. The base game has no Brazilian counters: use US counters with the same printed stats (the Brazilian
  Line Squad, Weapon Team, MMG, mortars match US ones; leaders need a substitution — see scenario 12 notes). The VASSAL
  save `012 - Misty Mountain.vsav` (decoded by the VASSAL survey agent) should be checked for the original pieces.
- The RSG printed in the 20th edition is the Volume II (CC:M) version covering six factions; the original 2006 CC:E
  RSG (Germany vs America/Russia only) is not public. See RSG §R0.

The VASSAL module's twelve scenario saves are an independent second source for every setup below; the VASSAL survey
agent owns that transcription (`design/data/`). Where the two differ, the playbook page image wins.

## 1. Conventions

- **Counter notation:** units: `Name (Morale; FP-Range-Movement)`, a stat in `[ ]` is boxed. Leaders:
  `Rank Name (Morale; Cmd n; FP-Range-Movement)`. Weapons: `Name (FP, Range, Movement modifier)`; Ordnance noted.
  Stats are as printed on the scenario page (unbroken side) for identification only — the counter data files are
  authoritative.
- **Orientation:** "X edge = compass n" = the side of the map toward which compass direction n points is X's friendly
  edge. Compass 1 = top, 4 = bottom (long edges, "wide" set-up, 10 hexes apart); 2/3 = right, 5/6 = left (short edges,
  "narrow", 15 hexes apart). Hex rows run 1 (compass-1 edge) → 10 (compass-4 edge); columns A (5/6 side) → O (2/3 side).
- **Set-up depth N** = within the first N hex rows counted from the player's own friendly edge, inclusive.
- **VP start** is given as "N toward side". It already includes listed open chits for the listed starting control.
- **Surrender N** = that side's Surrender marker goes on space N of its Casualty Track row.
- **Time / SD** = starting Time-marker space / Sudden Death marker space.
- "First / last" in SET UP = order of deployment. Defender usually sets up last.

## 2. Historical scenario set-up procedure (Playbook HS.1–HS.6, paraphrased)

1. **HS.1 Sides and forces** — decide sides (the app lets the human choose). Each side takes the pieces in its FORCES
   box in the listed numbers; superscript numbers point to special rules. Place each Surrender marker on its listed
   Casualty Track space.
2. **HS.2 Battlefield** — lay out the listed map oriented per the diagram; set the Track Display; put all Objective
   chits in one cup and all Smoke/Blaze markers in another.
3. **HS.3 Set-up boxes** (follow the arrows from YEAR):
   1. Year marker. 2. VP marker. 3. Time and Sudden Death markers. 4. OB Stats (quality / # orders) for each side.
   5. Postures and initial Initiative holder.
   6. Objective chits: first remove chits a special rule excludes; place any named OPEN chits face up; draw any
      "random" OPEN chit(s) face up; each side with "random" draws one secret chit (no-secret-side chits R, V, W, X go
      open). "none" = no secret chit. If a random draw produces an open chit for a mapboard Objective, shift the VP
      marker for whoever controls that Objective at start.
   7. Objective control markers as listed.
   8. Set-up order and depth (and who takes the first Turn).
   9. Read remaining special rules.
4. **HS.4** Deploy in the listed order and areas; stacking applies.
5. **HS.5** Shuffle each Fate deck; draw to posture hand size (Attack 6, Recon 5, Defend 4). (Special rules may put a
   named card into a hand first — remove it from the deck before shuffling.)
6. **HS.6** The side named in SET UP takes the first Turn.

## 3. The twelve scenarios

### Summary

| # | Name | Map | Year | Allies | Postures (Allies/Axis) | Init | Time/SD | VP start | Quality/Orders (Allies; Axis) | First Turn |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Fat Lipki | 1 | 1941 | Russia | Recon / Recon | Axis | 2 / 7 | 0 | Line 3; Line 2 | Allies (SSR 2) |
| 2 | Hedgerows & Hand Grenades | 2 | 1944 | America | Attack / Defend | Axis | 0 / 8 | 10 toward Axis | Line 3; Green 4 | Allies |
| 3 | Bonfire of the NKVD | 3 | 1941 | Russia | Defend / Attack | Axis | 0 / 7 | 20 toward Allies | Green 4; Line 3 | Axis |
| 4 | Closed for Renovation | 4 | 1944 | America | Attack / Defend | Axis | 1 / 7 | 20 toward Axis | Elite 4; Elite 3 | Allies |
| 5 | Cold Front | 5 | 1941 | Russia | Attack / Defend | Allies | 5 / 13 | 9 toward Axis | Elite 5; Line 3 | Allies |
| 6 | Paralyzed from the West Down | 6 | 1944 | America | Attack / Defend | Allies | 0 / 6 | 9 toward Axis | Elite 4; Line 1–3 | Allies |
| 7 | Bessarabian Nights | 7 | 1944 | Russia | Defend / Recon | Axis | 0 / 5 | 0 | Line 1; Line 3 | Allies |
| 8 | Breakout Dance | 8 | 1943 | Russia | Recon / Recon | Axis | 0 / 5 | 2 toward Allies | Line 1; Line 3 | Axis |
| 9 | Rush to Contact | 9 | 1945 | America | Attack / Defend | Axis | 2 / 12 | 14 toward Axis | Elite 6; Line 4 | Allies |
| 10 | Commando School | 10 | 1943 | Russia | Defend / Attack | Axis | 0 / 6 | 9 toward Allies | Elite 3; Line 4 | Axis |
| 11 | Hold the Line | 11 | 1944 | America | Defend / Attack | Axis | 1 / 6 | 10 toward Allies | Line 2; Elite 2 | Axis |
| 12 | Misty Mountain | 12 | 1944 | America (Brazil in 20th ed.) | Attack / Defend | Axis | 4 / 12 | 16 toward Axis | Line 5; Line 4 | Allies |

---

### Scenario 1 — Fat Lipki (map 1)
Lipki, Russia, 3 July 1941. Flank guards of two armoured divisions meet in a wooded hamlet south of town while trying
to secure a crossroads.

- **Orientation:** Allies edge = compass 1 (top); Axis edge = compass 4 (bottom).
- **Year 1941; VP 0; Time 2; SD 7.**
- **Quality/Orders:** Allies Line / 3; Axis Line / 2.
- **Postures:** both Recon. **Initiative:** Axis.
- **Objective chits:** open — random; Allies — random secret; Axis — random secret.
- **Objective control:** none.

| German forces | Count |
|---|---|
| Lt. v.Karsties (9; Cmd 2; 2-1-6) | 1 |
| Cpl. Winkler (6; Cmd 1; 1-1-6) | 1 |
| Rifle Squad (7; 5-[5]-[4]) | 4 |
| Light MG ([4], [8], –) | 1 |
| Surrender | space 5 |

| Russian forces | Count |
|---|---|
| Sgt. Kovalev (8; Cmd 2; 2-1-6) | 1 |
| Cpl. Krylov (7; Cmd 1; 1-1-6) | 1 |
| Rifle Squad (8; 5-3-4) | 8 |
| Medium MG (6, [10], −2) | 2 |
| Light MG ([3], [6], –) | 1 |
| Surrender | space 7 |

- **Set-up:** simultaneous and hidden (SSR 1). Allies: in or adjacent to hexes A2 and O1. Axis: in or adjacent to G10
  and/or N10. Reveal when both are done.
- **Special rules:** (1) hidden simultaneous set-up as above (in the app: the AI deploys without seeing the human's
  deployment and vice versa). (2) Once both hands are dealt, the Axis player decides: keep the Initiative card and let the
  Allies move first, or give the card to the Allies and move first himself.

### Scenario 2 — Hedgerows & Hand Grenades (map 2)
Bocage near Pont-Hébert, Normandy, July 1944.

- **Orientation:** Allies edge = compass 5/6 (left); Axis edge = compass 2/3 (right) — narrow.
- **Year 1944; VP 10 toward Axis; Time 0; SD 8.**
- **Quality/Orders:** Allies Line / 3; Axis Green / 4. **Postures:** Allies Attack, Axis Defend. **Initiative:** Axis.
- **Objective chits:** open — T; Allies — random; Axis — random. **Control:** Axis all five.

| German forces | Count |
|---|---|
| Lt. Schrader (9; Cmd 1; 1-1-6) | 1 |
| Sgt. Esser (8; Cmd 2; 2-1-6) | 1 |
| Sgt. Biermann (8; Cmd 1; 1-1-6) | 1 |
| Cpl. Rettenhaus (7; Cmd 1; 1-1-6) | 1 |
| Volksgrenadier Squad (7; 5-[4]-4) | 3 |
| Conscript Squad (6; 5-[3]-3) | 5 |
| Heavy MG (8, [16], −1) | 2 |
| Light MG ([4], [8], –) | 2 |
| Surrender | space 8 |

| American forces | Count |
|---|---|
| Lt. Blankenship (9; Cmd 1; 1-1-6) — SSR 1 | 1 |
| Sgt. Smith (8; Cmd 2; 2-1-6) | 1 |
| Cpl. Hubbard (7; Cmd 1; 1-1-6) | 1 |
| Elite Squad (7; [6]-6-[5]) | 2 |
| Line Squad (6; [6]-6-[4]) | 6 |
| Weapon Team (7; 2-2-4) | 1 |
| Medium MG (6, [10], –) | 1 |
| Light Mortar (Ordnance; 7, range 2–16, −2) | 1 |
| Radio 105mm (10 FP, Smoke) | 1 |
| Surrender | space 9 |

- **Set-up:** Allies first, 3 hexes deep; Axis last, 12 deep. Allies take the first Turn.
- **Special rules:** (1) *Forward Observer* — the Allied player may place Lt. Blankenship after the Axis set-up, in any
  map hex without a German unit. (2) *Bocage* — every Hedge costs +2 to cross and gives Cover 2.

### Scenario 3 — Bonfire of the NKVD (map 3)
Outside Brest-Litovsk, 24 June 1941. A militia company must hold while a forward CP destroys its papers.

- **Orientation:** Axis edge = compass 5/6 (left); Allies edge = compass 2/3 (right) — narrow.
- **Year 1941; VP 20 toward Allies; Time 0; SD 7.**
- **Quality/Orders:** Allies Green / 4; Axis Line / 3. **Postures:** Allies Defend, Axis Attack. **Initiative:** Axis.
- **Objective chits (SSR 3):** open — Q, R and S; Allies — none; Axis — none. **Control:** Allies all.

| German forces | Count |
|---|---|
| Lt. Schrader (9; Cmd 1; 1-1-6) | 1 |
| Sgt. Ganz (8; Cmd 2; 2-1-6) | 1 |
| Rifle Squad (7; 5-[5]-[4]) | 6 |
| Weapon Team (8; 2-2-4) | 1 |
| Heavy MG (8, [16], −1) | 1 |
| Light MG ([4], [8], –) | 3 |
| Surrender | space 7 |

| Russian forces | Count |
|---|---|
| Cpt. Egorov (10; Cmd 2; 2-1-6) — SSR 1 | 1 |
| Sgt. Maisky (8; Cmd 1; 1-1-6) | 1 |
| Cpl. Gordov (6; Cmd 1; 1-1-6) | 1 |
| Militia Squad (7; 5-2-3) | 10 |
| Green Team (6; 3-2-3) | 1 |
| Medium MG (6, [10], −2) | 1 |
| Light MG ([3], [6], –) | 1 |
| Wire — SSR 2 | 12 |
| Surrender | space 10 |

- **Set-up:** Allies first, 12 deep; Axis last, 3 deep. Axis takes the first Turn.
- **Special rules:** (1) *Command Post* — Cpt. Egorov sets up in N5. (2) *Hidden Fortifications* — the Allies may place
  their Wire after the Axis set-up. (3) Chits V, W and X are left out of the cup. (4) *Sappers* — the Axis starts with
  card G-65 in hand (G-65 = Order Fire / Action Demolitions / Event Prisoners of War; S4 manifest).

### Scenario 4 — Closed for Renovation (map 4)
Humaine, Belgium, 27 December 1944. 9th Panzer remnants in a château refuse to surrender to CCR, 2nd Armored Division.

- **Orientation:** Allies edge = compass 1 (top); Axis edge = compass 4 (bottom) — wide.
- **Year 1944; VP 20 toward Axis; Time 1; SD 7.**
- **Quality/Orders:** Allies Elite / 4; Axis Elite / 3. **Postures:** Allies Attack, Axis Defend. **Initiative:** Axis.
- **Objective chits:** open — Q and R; Allies — none; Axis — none. **Control:** Axis all.

| German forces | Count |
|---|---|
| Lt. Lauerbach (9; Cmd 1; 1-1-6) | 1 |
| Lt. Schrader (9; Cmd 1; 1-1-6) | 1 |
| Elite Rifle Squad (8; 5-[6]-[5]) | 6 |
| Weapon Team (8; 2-2-4) — SSR 1 | 3 |
| IG 18 Gun (Ordnance; 10, 16, −3) — SSR 1 | 1 |
| Heavy MG (8, [16], −1) | 2 |
| Light MG ([4], [8], –) | 2 |
| Wire — SSR 2 | 5 |
| Surrender | space 8 |

| American forces | Count |
|---|---|
| Lt. Wray (9; Cmd 2; 2-1-6) | 1 |
| Sgt. Buehler (8; Cmd 2; 2-1-6) | 1 |
| Elite Squad (7; [6]-6-[5]) | 6 |
| Line Squad (6; [6]-6-[4]) | 4 |
| .50 cal MG (9, [16], −2) | 2 |
| Medium MG (6, [10], –) | 2 |
| Satchel Charge (Ordnance, one use; [12], 1) | 2 |
| Radio 75mm (8 FP, Smoke) | 1 |
| *Reinforcements (SSR 3), Time space 3:* Sgt. White (8; Cmd 1; 1-1-6) | 1 |
| *Reinforcements:* Engineer Squad (8; [7]-[3]-[5]) | 2 |
| *Reinforcements:* Flamethrower (Ordnance; [11], 1) | 2 |
| Surrender | space 11 |

- **Set-up:** Axis first, 9 deep; Allies last, 1 hex deep. Allies take the first Turn.
- **Special rules:** (1) *Hidden Gun* — the Axis may place one Weapon Team and the IG 18 after the Allied set-up. (2)
  *Rubble* — each Axis Wire is placed in a building hex or next to one. (3) *Reinforcements* — Sgt. White, both Engineer
  Squads and both Flamethrowers start on Time space 3.

### Scenario 5 — Cold Front (map 5)
Staritsa, Russia, 30 December 1941. Siberian Guards attack German Infantry Regiment 18 in its trenches.

- **Orientation:** Allies edge = compass 5/6 (left); Axis edge = compass 2/3 (right) — narrow.
- **Year 1941; VP 9 toward Axis; Time 5; SD 13.**
- **Quality/Orders:** Allies Elite / 5; Axis Line / 3. **Postures:** Allies Attack, Axis Defend. **Initiative:** Allies.
- **Objective chits (SSR 1):** open — W; Allies — none; Axis — none. **Control:** Axis all.

| German forces | Count |
|---|---|
| Lt. v.Karsties (9; Cmd 2; 2-1-6) | 1 |
| Sgt. Ganz (8; Cmd 2; 2-1-6) | 1 |
| Rifle Squad (7; 5-[5]-[4]) | 3 |
| Weapon Team (8; 2-2-4) | 1 |
| Heavy MG (8, [16], −1) — SSR 2 | 1 |
| Light MG ([4], [8], –) — SSR 2 | 2 |
| Satchel Charge ([12], 1) — SSR 2 | 1 |
| Trench (Cover 4) | 6 |
| Surrender | space 5 |

| Russian forces | Count |
|---|---|
| Sgt. Bikovets (8; Cmd 2; 2-1-6) | 1 |
| Sgt. Kovalev (8; Cmd 2; 2-1-6) | 1 |
| Sgt. Kaminsky (8; Cmd 1; 1-1-6) | 1 |
| Sgt. Maisky (8; Cmd 1; 1-1-6) | 1 |
| Guards SMG Squad (8; [6]-3-[5]) | 12 |
| Surrender | space 12 |

- **Set-up:** Allies first, 3 deep; Axis last, 12 deep. Allies take the first Turn.
- **Special rules:** (1) Chits R, V and X are left out of the cup. (2) *Deep Freeze* — a German Weapon chosen at random
  (out of the four) begins broken; after play starts no Fortification may enter play by any means (an Action or Event
  that would place one is treated as Command Confusion, i.e. does nothing). (3) *Snow* — Open Ground costs 1½ MP.
  (4) *Winter Camouflage* — an Allied Concealment Action also lowers the Axis Attack Total by a further 2.

### Scenario 6 — Paralyzed from the West Down (map 6)
St. Mère-Église, 7 June 1944. Lt. Wray's company of the 505th PIR counter-attacks a German battalion whose officers he
has just killed.

- **Orientation:** Allies edge = compass 1 (top); Axis edge = compass 4 (bottom) — wide.
- **Year 1944; VP 9 toward Axis; Time 0; SD 6.**
- **Quality/Orders:** Allies Elite / 4; Axis Line / 1–3 (SSR 1). **Postures:** Allies Attack, Axis Defend.
  **Initiative:** Allies.
- **Objective chits:** open — V and X; Allies — random (SSR 2); Axis — none. **Control:** Axis all.

| German forces | Count |
|---|---|
| Sgt. Esser (8; Cmd 2; 2-1-6) | 1 |
| Sgt. Biermann (8; Cmd 1; 1-1-6) | 1 |
| Parachute Squad (8; [5]-4-[5]) | 3 |
| Rifle Squad (7; 5-[5]-[4]) | 3 |
| Conscript Squad (6; 5-[3]-3) | 3 |
| Weapon Team (8; 2-2-4) | 2 |
| Heavy MG (8, [16], −1) | 2 |
| Light MG ([4], [8], –) | 3 |
| Surrender | space 9 |

| American forces | Count |
|---|---|
| Lt. Wray (9; Cmd 2; 2-1-6) | 1 |
| Sgt. Smith (8; Cmd 2; 2-1-6) | 1 |
| Cpl. Hubbard (7; Cmd 1; 1-1-6) | 1 |
| Paratroop Squad (8; [6]-[4]-[5]) | 10 |
| Weapon Team (7; 2-2-4) | 2 |
| Medium MG (6, [10], –) | 2 |
| Surrender | space 11 |

- **Set-up:** Axis first, 8 deep; Allies last, 2 deep. Allies take the first Turn.
- **Special rules:** (1) Axis Orders per Turn start at 1 and increase by 1 at every Time advance, to a maximum of 3.
  (2) Chit W is left out of the cup.

### Scenario 7 — Bessarabian Nights (map 7)
Bessarabia, April 1944. German rear-area troops against partisans.

- **Orientation:** Allies edge = compass 5/6 (left); Axis edge = compass 2/3 (right) — narrow.
- **Year 1944; VP 0; Time 0; SD 5.**
- **Quality/Orders:** Allies Line / 1; Axis Line / 3. **Postures:** Allies Defend, Axis Recon. **Initiative:** Axis.
- **Objective chits:** open — V and X; Allies — random; Axis — random (SSR 3). **Control:** decided by set-up (SSR 1)
  — each Objective goes to the side occupying it alone after set-up (rules §7.3.1); otherwise uncontrolled.

| German forces | Count |
|---|---|
| Lt. Schrader (9; Cmd 1; 1-1-6) | 1 |
| Sgt. Biermann (8; Cmd 1; 1-1-6) | 1 |
| Volksgrenadier Squad (7; 5-[4]-4) | 6 |
| Light MG ([4], [8], –) | 3 |
| Surrender | space 8 |

| Russian forces | Count |
|---|---|
| Sgt. Maisky (8; Cmd 1; 1-1-6) | 1 |
| Cpl. Bulganin (7; Cmd 1; 1-1-6) | 1 |
| SMG Squad (8; [5]-[2]-4) | 4 |
| Militia Squad (7; 5-2-3) | 4 |
| Green Team (6; 3-2-3) | 4 |
| Light MG ([3], [6], –) | 4 |
| Satchel Charge ([12], 1) | 4 |
| Light Mortar — a *German* counter (Ordnance; 6, range 2–13, −2) — SSR 2 | 1 |
| Surrender | space 14 |

- **Set-up:** Allies first, Axis last; both "15 deep" (i.e. anywhere, governed by SSR 1). Allies take the first Turn.
- **Special rules:** (1) Allied placement: for each Russian unit draw a Random Hex from the Russian Fate deck; the unit
  sets up in or adjacent to it; then the Allies hand out their Weapons to Russian units. Then the Axis sets up so that
  all German units form one contiguous chain of Axis-occupied hexes, none in a hex with a Russian unit. (Reshuffle the
  Russian deck afterwards — implied by HS.5.) (2) The captured German Light Mortar is eliminated instead of breaking.
  (3) *No Quarter* — chits R and W left out; nobody can earn Exit VP: a unit that leaves the map in any way is
  eliminated. (4) *Partisans* — Allied units pay Move Cost 1 for every hex. Project ruling: hexside (Fence/Hedge/Wall) and uphill
  extras are terrain too, so each hex entered costs exactly 1 MP; impassable terrain stays impassable (a movement
  restriction, not a cost) and Wire still ends movement (a Fortification, not terrain). (5) *Hidden Forces* — the Allies start with
  card R-31 in hand (R-31 = Order Artillery Request / Action Hidden Unit / Event Interdiction).

### Scenario 8 — Breakout Dance (map 8)
Velikiye Luki, January 1943. Night break-out attempt by Lt. Schrader's 32 men.

- **Orientation:** Allies edge = compass 5/6 (left); Axis edge = compass 2/3 (right) — narrow.
- **Year 1943; VP 2 toward Allies; Time 0; SD 5.**
- **Quality/Orders:** Allies Line / 1; Axis Line / 3. **Postures:** both Recon. **Initiative:** Axis.
- **Objective chits:** open — W; Allies — none; Axis — none. **Control:** Allies #1 and #4; Axis #2, #3 and #5.

| German forces | Count |
|---|---|
| Lt. Schrader (9; Cmd 1; 1-1-6) | 1 |
| Sgt. Ganz (8; Cmd 2; 2-1-6) | 1 |
| Rifle Squad (7; 5-[5]-[4]) | 3 |
| Light MG ([4], [8], –) | 3 |
| Foxholes (Cover 3) | 3 |
| Surrender | space 4 |

| Russian forces | Count |
|---|---|
| Sgt. Kaminsky (8; Cmd 1; 1-1-6) | 1 |
| Sgt. Maisky (8; Cmd 1; 1-1-6) | 1 |
| Rifle Squad (8; 5-3-4) | 10 |
| Medium MG (6, [10], −2) | 2 |
| Light MG ([3], [6], –) | 1 |
| Surrender | space 9 |

- **Set-up:** Allies first, 7 deep; Axis last, 7 deep. Axis takes the first Turn.
- **Special rules:** (1) *Night Action* — Axis Discard Capability is 1; every Fire Attack Total is reduced by X = the
  distance in hexes between the target and the closest firing hex. (2) *Breakout* — only the Axis can earn Exit VP; a Russian unit
  leaving the map for any reason counts as eliminated.

### Scenario 9 — Rush to Contact (map 9)
Outskirts of Hitdorf, Germany, 6 April 1945. 504th PIR meets 62nd Volksgrenadier Division; both call reinforcements.

- **Orientation:** Allies edge = compass 1 (top); Axis edge = compass 4 (bottom) — wide. (Map 9 confirmed by the
  VASSAL save "Board 9".)
- **Year 1945; VP 14 toward Axis; Time 2; SD 12.**
- **Quality/Orders:** Allies Elite / 6; Axis Line / 4. **Postures:** Allies Attack, Axis Defend. **Initiative:** Axis.
- **Objective chits:** open — U; Allies — random; Axis — random. **Control:** Axis all.

| German forces | Count | Where |
|---|---|---|
| Sgt. Pfeiffer (8; Cmd 1; 1-1-6) | 1 | map |
| Rifle Squad (7; 5-[5]-[4]) | 1 | map (printed with a "1" superscript, but SSR 1 does not list it — treat as on map) |
| Weapon Team (8; 2-2-4) | 3 | 1 map, 2 Time space 3 |
| Light MG ([4], [8], –) | 5 | 1 map, 4 Time space 3 |
| Radio 81mm (9 FP, Smoke) | 1 | Artillery Box |
| Mines — SSR 7 | 3 | map |
| Cpt. Wehling (10; Cmd 2; 2-1-6) | 1 | Time 3 |
| Sgt. Esser (8; Cmd 2; 2-1-6) | 1 | Time 3 |
| Sgt. Biermann (8; Cmd 1; 1-1-6) | 1 | Time 3 |
| Volksgrenadier Squad (7; 5-[4]-4) | 8 | Time 3 |
| Heavy MG (8, [16], −1) | 1 | Time 3 |
| Surrender | space 11 | |

| American forces | Count | Where |
|---|---|---|
| Lt. Wray (9; Cmd 2; 2-1-6) | 1 | map |
| Lt. Esparza (9; Cmd 2; 2-1-6) | 1 | map |
| Cpl. Hubbard (7; Cmd 1; 1-1-6) | 1 | map |
| Paratroop Squad (8; [6]-[4]-[5]) | 12 | 6 map; 2 each on Time 3, 4, 5 |
| Satchel Charge ([12], 1) | 3 | map |
| Sgt. Smith (8; Cmd 2; 2-1-6) | 1 | Time 3 |
| Medium MG (6, [10], –) | 1 | Time 3 |
| Lt. Blankenship (9; Cmd 1; 1-1-6) | 1 | Time 4 |
| Lt. Thomas (9; Cmd 1; 1-1-6) | 1 | Time 5 |
| Radio 105mm (10 FP, Smoke) | 1 | Time 6 (to Artillery Box) |
| Surrender | space 13 | |

- **Set-up:** Allies first, 1 hex deep; Axis last, 9 deep. Allies take the first Turn.
- **Special rules:** (1)–(6) the Time Track placements above. (7) Mines are 8 FP. As an option taken
  before his opening draw, the Axis player may cut them to 7 FP and in exchange start with card G-32 in hand (G-32 = Order Artillery Denied / Action
  Hidden Mines / Event Interdiction).

### Scenario 10 — Commando School (map 10)
Stanichka near Novorossiysk, 4 February 1943. Black Sea Fleet commandos hold a university beside a lake.

- **Orientation:** Allies edge = compass 5/6 (left); Axis edge = compass 2/3 (right) — narrow.
- **Year 1943; VP 9 toward Allies; Time 0; SD 6.**
- **Quality/Orders:** Allies Elite / 3; Axis Line / 4. **Postures:** Allies Defend, Axis Attack. **Initiative:** Axis.
- **Objective chits:** open — W; Allies — random; Axis — random. **Control:** Allies #1, #3, #5; Axis #2, #4.

| German forces | Count |
|---|---|
| Lt. Schrader (9; Cmd 1; 1-1-6) | 1 |
| Sgt. Esser (8; Cmd 2; 2-1-6) | 1 |
| Sgt. Biermann (8; Cmd 1; 1-1-6) | 1 |
| Pionier Squad (8; [7]-[3]-[5]) | 2 |
| Rifle Squad (7; 5-[5]-[4]) | 4 |
| Heavy MG (8, [16], −1) | 1 |
| Light MG ([4], [8], –) | 2 |
| Flamethrower ([11], 1) — SSR 1 | 1 |
| Satchel Charge ([12], 1) — SSR 1 | 1 |
| Surrender | space 7 |

| Russian forces | Count |
|---|---|
| Lt. Khukovsky (9; Cmd 2; 2-1-6) | 1 |
| Sgt. Bikovets (8; Cmd 2; 2-1-6) | 1 |
| Guards SMG Squad (8; [6]-3-[5]) | 2 |
| Guards Rifle Squad (8; 5-5-5) | 2 |
| Elite Team (8; 3-2-5) | 2 |
| .50 cal MG (Russian; 9, [16], −2) | 1 |
| Light MG ([3], [6], –) | 2 |
| Satchel Charge ([12], 1) | 1 |
| Surrender | space 6 |

- **Set-up:** Allies first, 12 deep; Axis last, 3 deep. Axis takes the first Turn.
- **Special rules:** (1) *Combat Engineers* — the two Pionier Squads begin carrying the German Flamethrower and
  Satchel Charge (one each). (2) *Commandos* — every Allied Melee roll gets +1.

### Scenario 11 — Hold the Line (map 11)
St. Jean de Daye, 8 July 1944. A small US force with an immobilised Sherman holds Hill 104 against a dawn counter-attack.

- **Orientation:** Allies edge = compass 5/6 (left); Axis edge = compass 2/3 (right) — narrow.
- **Year 1944; VP 10 toward Allies; Time 1; SD 6.**
- **Quality/Orders:** Allies Line / 2; Axis Elite / 2. **Postures:** Allies Defend, Axis Attack. **Initiative:** Axis.
- **Objective chits:** open — N and P; Allies — random; Axis — random. **Control:** Allies #1, #2, #4, #5; Axis #3.

| German forces | Count |
|---|---|
| Lt. Lauerbach (9; Cmd 1; 1-1-6) | 1 |
| Sgt. Ganz (8; Cmd 2; 2-1-6) | 1 |
| SS Squad (8; [6]-5-[5]) | 4 |
| Weapon Team (8; 2-2-4) | 1 |
| Heavy MG (8, [16], −1) | 1 |
| Light MG ([4], [8], –) | 2 |
| Wire — SSR 1 (pre-placed) | 14 |
| Mines (6 FP) — SSR 1 (pre-placed) | 4 |
| Surrender | space 6 |

| American forces | Count |
|---|---|
| Sgt. White (8; Cmd 1; 1-1-6) | 1 |
| Elite Squad (7; [6]-6-[5]) | 1 |
| Line Team (6; 3-4-4) | 2 |
| Satchel Charge ([12], 1) — SSR 4 | 2 |
| Foxholes (Cover 3) | 2 |
| Sgt. Buehler (8; Cmd 2; 2-1-6) — SSR 2 | 1 |
| Weapon Team (7; 2-2-4) — SSR 2 | 1 |
| .50 cal MG (9, [16], −2) — SSR 2 | 1 |
| Pack Howitzer (Ordnance; 10, 16, −3, Smoke) — SSR 2 | 1 |
| Bunker (Cover 6) — SSR 2 | 1 |
| *Reinforcements (SSR 3):* Line Squad (6; [6]-6-[4]) | 4 |
| Surrender | space 7 |

- **Set-up:** Allies first, 10 deep; Axis last, 1 hex deep. Axis takes the first Turn.
- **Special rules:** (1) *Uncleared Fortifications* — Wire in B2, B3, B5, B6, B8, B9, C8, D8, D5, E5, H5, G6, G8, G9;
  Mines in C5, C6, D7, E8; Mines are 6 FP. (Wire/Mines are drawn in the German box but are neutral obstacles placed by
  the rule.) (2) *Immobilised Sherman* — the Bunker goes into one non-Hill Open Ground hex together with
  the Weapon Team (carrying the Pack Howitzer) and Sgt. Buehler (carrying the .50 cal MG). While the Bunker exists,
  that hex's unit stacking limit is 4 figures (not 7). The Howitzer is fixed in the Bunker hex and dies if its carrier or
  the Bunker is eliminated. (3) *Reinforcements* — one US Line Squad on each of Time spaces 2, 3, 4 and 5. (4) The two
  Satchel Charges are captured panzerfausts: they may not attack a hex whose Cover is below 2.

### Scenario 12 — Misty Mountain (map 12)
Monte Castello, Italy, 12 December 1944. The Brazilian Expeditionary Force attacks in heavy fog.

- **Orientation:** Axis edge = compass 1 (top); Allies edge = compass 4 (bottom) — wide.
- **Year 1944; VP 16 toward Axis; Time 4; SD 12.**
- **Quality/Orders:** Allies Line / 5; Axis Line / 4. **Postures:** Allies Attack, Axis Defend. **Initiative:** Axis.
- **Objective chits:** open — N, Q and S; Allies — none; Axis — none. **Control:** Axis all.

| German forces | Count |
|---|---|
| Sgt. Esser (8; Cmd 2; 2-1-6) | 1 |
| Sgt. Biermann (8; Cmd 1; 1-1-6) | 1 |
| Sgt. Pfeiffer (8; Cmd 1; 1-1-6) | 1 |
| Volksgrenadier Squad (7; 5-[4]-4) | 9 |
| Weapon Team (8; 2-2-4) | 2 |
| Heavy MG (8, [16], −1) | 1 |
| Light MG ([4], [8], –) | 2 |
| Light Mortar (Ordnance; 6, range 2–13, −2) | 1 |
| Bunker (Cover 6) | 1 |
| Trench (Cover 4) | 2 |
| Surrender | space 10 |

| Allied (Brazilian in the 20th ed.) forces | Count |
|---|---|
| Lt. Oliveira (9; Cmd 1; 1-1-6) | 1 |
| Cpl. Pereira (7; Cmd 1; 1-1-6) | 1 |
| Cpl. Santos (7; Cmd 1; 1-1-6) | 1 |
| Line Squad (6; [6]-6-[4]) | 8 |
| Weapon Team (7; 2-2-4) | 5 |
| Medium MG (6, [10], –) | 2 |
| Medium Mortar (Ordnance; 9, range 3–16, −3, Smoke) | 2 |
| Light Mortar (Ordnance; 7, range 2–16, −2) | 1 |
| *Reinforcements (SSR 1), Time space 7:* Sgt. Alves (8; Cmd 2; 2-1-6) | 1 |
| *Reinforcements:* Green Squad (5; [5]-4-[3]) | 8 |
| Surrender | space 17 |

- **Set-up:** Allies first, 2 deep; Axis last, 8 deep. Allies take the first Turn (SSR 5).
- **Special rules:** (1) *Reinforcements* — Sgt. Alves and the eight Green Squads on Time space 7; when they enter, any
  of them may be placed in or adjacent to road hex A9 instead of the friendly edge. (2) *Caves* — an Axis Sniper may
  break an enemy unit up to 2 hexes from the Random Hex (instead of in/adjacent). (3) *Fog* — every hex has a −3
  Hindrance at every elevation, and it is *added* to the normal (largest) Hindrance (e.g. Orchard or Smoke) — the one
  exception to "Hindrances don't add up". Each Breeze Event lowers the fog by 1 (−2, −1, then 0); track it with a
  spare marker on Time space 3 moved left after each Breeze. (4) Any extra Allied pieces needed (Light Wounds, Deploy,
  Radio, etc.) are US equivalents. (5) The Allies use the US Fate deck and take the first Turn.
- **Base-game substitution (project decision):** use US counters: Line Squad, Weapon Team, MMG, Medium/Light Mortar,
  Green Squad have identical printed stats. Leaders: substitute US leaders with the same Morale/Command: Lt. Oliveira
  → Lt. Blankenship (9; Cmd 1), Cpl. Pereira / Cpl. Santos → Cpl. Hubbard and Cpl. Jensen (7; Cmd 1), Sgt. Alves →
  Sgt. Smith or Sgt. Buehler (8; Cmd 2). Verify against the VASSAL save `012` (the 2006 module may already use US
  pieces).
- Fog scope (project ruling): the fog is "in every hex, regardless of elevation", like Smoke filling a hex, so treat it
  like Smoke: it applies to every Fire Attack, Targeting and Accuracy LOS, including adjacent shots (the fog is also in
  the firer's and target's hexes). It does not affect Melee, Mine Attacks or Artillery Impact rolls. Alternative
  reading (only LOS with an intervening hex) noted in case play-testing prefers it.

---

## 4. Random Scenario Generator (RSG)

### R0. Which RSG, and the base-game adaptation
- The only complete public RSG is the 20th Anniversary / Volume II version (S4 pp. 31–33, steps RS.1–RS.16), which
  also matches the VASSAL module's built-in generator (its code names the Med playbook tables). It covers six factions.
- The original 2006 CC:E RSG is not public. S8 shows it differed: one roll on a combined nationality+year table (e.g.
  a total of 6 gave "Americans, 1944"); the map number came from a die (white die, +6 in that example); Support
  purchases were a single unit; Radios were bought in the Support step; a fortification OB was called "Hasty
  Entrenchments". Its tables are **missing**.
- **Recommended base-game procedure (project decision):** run RS.1–RS.16 below with these changes:
  1. The Axis is always Germany (skip the Germany/Italy roll; use the German year column).
  2. Allied nationality: roll on the "vs Germany" table; a result of France or Britain is re-rolled. Because 1939 and
     1940 offer only France/Britain, and US OBs exist only 1943–45, legal pairings are **Germany–Russia 1941–1945** and
     **Germany–America 1943–1945**; if the year roll gives 1939/1940, re-roll the year.
  3. The app's RSG screen may also let the user fix map, nations, year and postures directly ("or surprise me").

### RS.1 Battlefield
- One player rolls: even → he picks any map; odd → the other player picks.
- The player who did *not* pick rolls again and chooses either the white or the coloured die; he turns the map so that
  compass direction equals that die faces him (his friendly edge): 1 = top edge, 4 = bottom, 2/3 = right side, 5/6 =
  left side. 1/4 → "wide" map (edges 10 hexes apart); 2/3/5/6 → "narrow" (15 apart).
- Track Display beside the map; VP marker on 0.

### RS.2 Sides, Axis nationality, year
- Coin flip for sides.
- Axis roll: 2–9 Germany, 10–12 Italy (base game: always Germany).
- Axis year roll:

| Roll | Germany | (Italy) |
|---|---|---|
| 2 | 1939 | 1942 |
| 3 | 1943 | 1943 |
| 4 | 1940 | 1939 |
| 5 | 1945 | 1944 |
| 6 | 1941 | 1943 |
| 7 | 1942 | 1940 |
| 8 | 1943 | 1941 |
| 9 | 1944 | 1942 |
| 10 | 1944 | 1941 |
| 11–12 | 1944 | 1942 |

- Allied nationality vs Germany (RS.2.2):

| Roll | 1939 | 1940 | 1941 | 1942 | 1943 | 1944 | 1945 |
|---|---|---|---|---|---|---|---|
| 2 | France | France | France | Russia | France | France | France |
| 3 | France | France | France | Russia | America | Russia | Russia |
| 4 | France | France | France | Russia | America | America | America |
| 5 | France | France | Russia | Russia | America | America | America |
| 6 | France | France | Russia | Russia | Russia | America | America |
| 7 | France | France | Russia | Russia | Russia | Russia | Russia |
| 8 | France | France | Russia | Russia | Russia | Russia | Russia |
| 9 | France | Britain | Britain | Britain | Russia | Russia | Russia |
| 10 | France | Britain | Britain | Britain | Britain | Britain | Britain |
| 11 | France | Britain | Britain | Britain | Britain | Britain | Britain |
| 12 | France | Britain | Britain | Britain | Britain | Britain | Britain |

(The Italy table RS.2.3 is omitted — not in the base game.)

### RS.3 Troop quality (each side rolls on its nation's table)

German:

| Roll | 1939–41 | 1942 | 1943–44 | 1945 |
|---|---|---|---|---|
| 2–4 | Elite | Elite | Elite | Elite |
| 5 | Elite | Elite | Elite | Line |
| 6 | Elite | Elite | Line | Line |
| 7–8 | Line | Line | Line | Line |
| 9–10 | Line | Line | Line | Green |
| 11 | Line | Line | Green | Green |
| 12 | Line | Green | Green | Green |

American:

| Roll | 1943 | 1944 | 1945 |
|---|---|---|---|
| 2–3 | Elite | Elite | Elite |
| 4 | Line | Elite | Elite |
| 5–8 | Line | Line | Elite |
| 9–10 | Green | Line | Line |
| 11 | Green | Green | Line |
| 12 | Green | Green | Green |

Russian:

| Roll | 1939–40 | 1941 | 1942 | 1943 | 1944 | 1945 |
|---|---|---|---|---|---|---|
| 2–3 | Elite | Elite | Elite | Elite | Elite | Elite |
| 4 | Elite | Line | Elite | Elite | Elite | Elite |
| 5 | Line | Line | Line | Elite | Elite | Elite |
| 6 | Line | Line | Line | Line | Line | Elite |
| 7–8 | Line | Line | Line | Line | Line | Line |
| 9 | Line | Green | Line | Line | Line | Line |
| 10 | Line | Green | Green | Line | Line | Line |
| 11 | Line | Green | Green | Green | Line | Line |
| 12 | Line | Green | Green | Green | Green | Line |

### RS.4 Objectives
All 22 chits in the cup. Draw one open chit (centre of the Objective Box). Each player draws one secret chit (R, V, W, X
must be revealed when drawn).

### RS.5 Order of Battle
Each player secretly picks one OB from his nation's table that matches the nation, the year (Dates Available) and the
rolled Troop Quality; reveal simultaneously. VP: the Axis moves the VP marker toward the Allied side by his OB's Point
Value; the Allies then move it back toward the Axis side by theirs (net: the cheaper OB's side leads by the difference).
Set each OB Stats marker to the OB's Quality and Orders.

Tables (S6 images; columns are Company / Detachment / Platoon; Orders always 4 / 3 / 2; "–" = none). The leader row is
the number of Leader Table rolls (RS.6). Unit stats are those printed on the table icons.

#### German OBs (chits A–J)

| Chit | OB | Dates | Points C/D/P | Initiative | Quality | Contents (C / D / P) | Surrender |
|---|---|---|---|---|---|---|---|
| A | Pionier | 1940–43 | 32/22/12 | 13/13/13 | Elite | Leaders 3/2/1; Pionier Sq 6/4/2; Elite Rifle Sq 3/2/1; LMG 1/1/1; Flamethrower 3/2/1; Satchel 6/4/2 | 8/6/3 |
| B | SS | 1942–45 | 40/26/15 | 11/11/11 | Elite | Leaders 3/2/1; SS Sq 9/6/3; Weapon Tm 3/2/1; Elite Tm 2/1/1; LMG 4/2/1; HMG 2/1/1; Medium Mortar 3/2/1 | 12/8/5 |
| C | Elite Rifle | 1939–44 | 35/21/11 | 11/9/13 | Elite | Leaders 3/2/1; Elite Rifle Sq 9/6/3; Weapon Tm 2/–/–; Elite Tm 2/1/–; LMG 4/3/1; HMG 2/1/1; Light Mortar 1/–/–; Medium Mortar 1/–/– | 11/7/3 |
| D | Fallschirmjäger | 1940–45 | 32/20/10 | 15/9/7 | Elite | Leaders 3/2/1; Parachute Sq 9/6/3; Weapon Tm 2/1/–; Elite Tm 1/–/–; LMG 3/3/2; HMG 1/–/–; Light Mortar 2/1/– | 11/7/3 |
| E | Sturm | 1939–44 | 30/20/10 | 5/3/1 | Elite | Leaders 3/2/1; Parachute Sq 9/6/3; Elite Tm 3/2/1; LMG 3/2/1; Satchel 3/2/1 | 11/8/4 |
| F | Rifle | 1939–45 | 33/19/9 | 19/11/9 | Line | Leaders 3/2/1; Rifle Sq 9/6/3; Weapon Tm 2/–/–; Line Tm 3/2/–; LMG 4/3/2; HMG 2/1/–; Company only: 3 Light Mortars (1939–43) or 2 Medium Mortars (1944–45) | 12/7/3 |
| G | Conscripted Rifle | 1942–45 | 24/15/8 | 5/5/7 | Line | Leaders 3/2/1; Rifle Sq 3/2/1; Volksgrenadier Sq 6/4/2; Line Tm 1/–/–; LMG 3/2/1; HMG 1/–/– | 9/6/3 |
| H | Volksgrenadier | 1943–45 | 21/14/7 | 7/9/5 | Green | Leaders 3/2/1; Volksgrenadier Sq 6/4/2; Conscript Sq 3/2/1; LMG 2/2/1; HMG 1/–/– | 8/6/3 |
| J | Garrison | 1942–44 | 18/12/6 | −1/−1/−1 | Green | Leaders 3/2/1; Conscript Sq 9/6/3; LMG 1/2/1; HMG 1/–/– | 8/6/3 |

German counter stats (table icons): Pionier 8; [7]-[3]-[5] · SS 8; [6]-5-[5] · Elite Rifle 8; 5-[6]-[5] · Parachute
8; [5]-4-[5] · Rifle 7; 5-[5]-[4] · Volksgrenadier 7; 5-[4]-4 · Conscript 6; 5-[3]-3 · Weapon Team 8; 2-2-4 · Elite
Team 8; 3-[3]-[5] · Line Team 7; 3-[3]-4 · LMG [4],[8] · HMG 8,[16],−1 · Light Mortar 6, 2–13, −2 · Medium Mortar 9,
3–16, −3, Smoke · Flamethrower [11],1 · Satchel [12],1.

#### American OBs (chits R–Z)

| Chit | OB | Dates | Points C/D/P | Initiative | Quality | Contents (C / D / P) | Surrender |
|---|---|---|---|---|---|---|---|
| R | Combat Engineer | 1944–45 | 37/25/13 | 16/14/12 | Elite | Leaders 3/2/1; Engineer Sq 6/4/2; Paratroop Sq 3/2/1; Elite Sq 3/2/1; Elite Tm 3/2/1; MMG 3/2/1; Flamethrower 3/2/1; Satchel 6/4/2 | 13/9/5 |
| S | Paratroop | 1944–45 | 31/21/11 | 4/6/8 | Elite | Leaders 3/2/1; Paratroop Sq 12/8/4; Weapon Tm 3/2/1; Light Mortar 3/2/1 | 13/9/5 |
| T | Elite Rifle | 1943–45 | 37/24/12 | 10/10/6 | Elite | Leaders 3/2/1; Elite Sq 12/8/4; Weapon Tm 3/1/–; Elite Tm 4/3/2; MMG 2/2/2; HMG 1/–/–; .50 cal 1/1/–; Light Mortar 3/1/– | 15/11/6 |
| U | Ranger | 1943–45 | 34/23/12 | 18/16/14 | Elite | Leaders 3/2/1; Elite Sq 9/6/3; Weapon Tm 3/2/1; Elite Tm 3/2/1; MMG 3/2/1; Light Mortar 3/2/1 | 13/9/5 |
| V | Veteran Rifle | 1944–45 | 32/22/12 | 6/10/16 | Line | Leaders 3/2/1; Elite Sq 6/4/2; Line Sq 6/4/2; Weapon Tm 3/1/–; Line Tm 3/3/2; MMG 2/2/2; HMG –/1/–; .50 cal 1/–/–; Light Mortar 3/1/– | 15/10/6 |
| W | Line Rifle | 1943–45 | 27/18/9 | 8/6/4 | Line | Leaders 3/2/1; Line Sq 12/8/4; Line Tm 3/2/1; MMG 2/1/1; HMG –/1/–; .50 cal 1/–/– | 13/9/5 |
| X | Brazilian | 1944–45 | 27/18/9 | 6/4/2 | Line | Leaders 3/2/1; Line Sq 6/4/2; Green Sq 6/4/2; Line Tm 3/2/1; MMG 3/2/1; Light Mortar 3/2/1 | 13/9/5 |
| Y | Replacement | 1943–45 | 28/17/8 | 4/4/4 | Green | Leaders 3/2/1; Line Sq 6/4/2; Green Sq 6/4/2; Weapon Tm 3/1/–; Green Tm 3/2/1; MMG 2/2/1; HMG 1/–/–; Light Mortar 3/1/– | 15/10/5 |
| Z | Rear Echelon | 1943–45 | 19/13/7 | −4/0/4 | Green | Leaders 3/2/1; Green Sq 12/8/4; MMG 3/2/1 | 10/7/4 |

American counter stats (table icons): Engineer 8; [7]-[3]-[5] · Paratroop 8; [6]-[4]-[5] · Elite Squad 7; [6]-6-[5] ·
Line Squad 6; [6]-6-[4] · Green Squad 5; [5]-4-[3] · Weapon Team 7; 2-2-4 · Elite Team 7; [4]-4-[5] · Line Team 6;
3-4-4 · Green Team 5; 3-3-3 · MMG 6,[10],– · HMG 8,[12],−2 · .50 cal 9,[16],−2 · Light Mortar 7, 2–16, −2. (X
"Brazilian" is a 20th-edition column; in the base game field it with US Line/Green counters. Whether the 2006 table
had a different X OB is unknown — **missing**.)

#### Russian OBs (chits R–Z)

| Chit | OB | Dates | Points C/D/P | Initiative | Quality | Contents (C / D / P) | Surrender |
|---|---|---|---|---|---|---|---|
| R | Guards SMG | 1942–45 | 28/19/10 | 6/8/10 | Elite | Leaders 3/2/1; Guards SMG Sq 15/10/5; LMG 3/2/1; Satchel 3/2/1 | 13/9/5 |
| S | Commando | 1943–45 | 29/20/11 | 8/8/8 | Elite | Leaders 3/2/1; Guards SMG Sq 7/4/2; Guards Rifle Sq 7/4/2; Elite Tm 2/4/2; LMG 5/3/1; .50 cal 1/1/1; Satchel 3/2/1 | 13/11/6 |
| T | Assault Engineer | 1942–45 | 34/23/12 | 18/14/10 | Elite | Leaders 3/2/1; Assault Sq 6/4/2; Guards SMG Sq 8/5/2; Elite Tm 2/2/2; LMG 3/2/1; Flamethrower 3/2/1; Satchel 6/4/2 | 13/9/6 |
| U | Guards Rifle | 1939–45 | 30/19/10 | 10/6/8 | Elite | Leaders 3/2/1; Guards Rifle Sq 15/10/5; Weapon Tm 2/1/–; LMG 4/3/2; HMG 1/1/1; .50 cal 1/–/–; Light Mortar 2/1/– | 14/10/5 |
| V | SMG | 1941–45 | 22/15/8 | 10/10/10 | Line | Leaders 3/2/1; SMG Sq 15/10/5; Satchel 3/2/1 | 13/9/5 |
| W | Early-War Rifle | 1939–42 | 22/13/7 | 2/4/6 | Line | Leaders 3/2/1; Rifle Sq 12/8/4; Militia Sq 3/2/1; Weapon Tm 1/–/–; Line Tm 1/–/–; LMG 3/2/1; MMG 1/–/–; Light Mortar 1/–/– | 14/9/5 |
| X | Mid-War Rifle | 1943–44 | 25/17/8 | 4/8/12 | Line | Leaders 3/2/1; Rifle Sq 15/10/5; Weapon Tm 2/1/–; Line Tm 1/1/–; LMG 4/3/2; MMG –/1/–; HMG 1/–/–; Light Mortar 2/1/– | 15/10/5 |
| Y | Late-War Rifle | 1944–45 | 25/17/8 | 2/8/10 | Line | Leaders 3/2/1; Guards Rifle Sq 5/2/1; Rifle Sq 5/6/3; Militia Sq 5/2/1; Weapon Tm 2/1/–; Line Tm 1/1/–; LMG 4/3/2; HMG –/1/–; .50 cal 1/–/–; Light Mortar 2/1/– | 15/10/5 |
| Z | Militia | 1941–44 | 17/11/5 | 4/2/0 | Green | Leaders 3/2/1; Militia Sq 15/10/5; LMG 1/1/–; MMG 1/1/–; Light Mortar 1/–/– | 13/9/5 |

Russian counter stats (table icons): Assault 9; [7]-2-[5] · Guards SMG 8; [6]-3-[5] · Guards Rifle 8; 5-5-5 · SMG 8;
[5]-[2]-4 · Rifle 8; 5-3-4 · Militia 7; 5-2-3 · Weapon Team 9; 2-1-4 · Elite Team 8; 3-2-5 · Line Team 7; 3-2-4 ·
LMG [3],[6] · MMG 6,[10],−2 · HMG 8,[12],−2 · .50 cal 9,[16],−2 · Light Mortar 6, 2–14, −1.

### RS.6 Leaders
For each Leader in his OB, a player rolls the **white die only** (1–6), adds modifiers, and reads the Leader Table.
A duplicate name is re-rolled until an unused Leader comes up. Then gather the rolled Leaders and all OB pieces.

| Result | America | Germany | Russia |
|---|---|---|---|
| ≤0 | Cpl. Cassidy (6; Cmd 1) | Cpl. Winkler (6; Cmd 1) | Cpl. Gordov (6; Cmd 1) |
| 1 | Cpl. Hubbard (7; Cmd 1) | Cpl. Rettenhaus (7; Cmd 1) | Cpl. Krylov (7; Cmd 1) |
| 2 | Sgt. Divine (8; Cmd 1) | Sgt. Biermann (8; Cmd 1) | Cpl. Bulganin (7; Cmd 1) |
| 3 | Sgt. White (8; Cmd 1) | Sgt. Esser (8; Cmd 2) | Sgt. Maisky (8; Cmd 1) |
| 4 | Sgt. Buehler (8; Cmd 2) | Sgt. Ganz (8; Cmd 2) | Sgt. Kovalev (8; Cmd 2) |
| 5 | Sgt. Smith (8; Cmd 2) | Lt. Schrader (9; Cmd 1) | Sgt. Bikovets (8; Cmd 2) |
| 6 | Lt. Blankenship (9; Cmd 1) | Lt. Lauerbach (9; Cmd 1) | Lt. Gulikevich (9; Cmd 1) |
| 7+ | Lt. Wray (9; Cmd 2) | Lt. von Karsties (9; Cmd 2) | Lt. Khukovsky (9; Cmd 2) |

(All leaders above are FP-Range-Movement 1-1-6 with Cmd 1, or 2-1-6 with Cmd 2.)

Modifiers: Elite OB +1, Green OB −1; year:

| Year | America | Germany | Russia |
|---|---|---|---|
| 1939 | – | +1 | −2 |
| 1940 | – | +1 | −2 |
| 1941 | – | +1 | −1 |
| 1942 | – | +1 | 0 |
| 1943 | −1 | +1 | 0 |
| 1944 | 0 | 0 | +1 |
| 1945 | +1 | −1 | +1 |

### RS.7 Support rolls
- Skipped entirely when the VP marker sits on 0.
- Otherwise the player with the cheaper OB (VP marker on his side) rolls 2 dice and **must** buy one or more units (no
  Radios) from that column of his Support Table, each available in the scenario year and still in the counter mix
  (R-56; several, even several of the same item, allowed). He moves the VP marker toward the opponent by the total cost.
- If that purchase pushes the marker past 0 onto the other side, the other player now rolls and must buy in the same
  way (one round only).
- A Weapon listed with a unit must stay with that unit at set-up; a lone unit bought here gets no OB Weapon.
- If a column offers nothing legal, nothing is bought (project ruling).

#### German Support Table (roll: cost (years))

| Item | Columns |
|---|---|
| Cpt. Wehling (10; Cmd 2; 2-1-6) | 11: 6 (39–42) · 12: 6 (43–44) |
| Lt. Borbe (9; Cmd 2; 2-1-6) | 10: 6 (39–42) · 11: 6 (43–44) · 12: 6 (45) |
| Lt. Huntziger **or** Lt. Bolter (9; Cmd 1; 1-1-6) | 9: 5 (39–42) · 10: 5 (43–44) · 11: 5 (45) |
| Sgt. Benzing **or** Sgt. Grein (8; Cmd 2; 2-1-6) | 7: 5 (39–42) · 8: 5 (39–44) · 9: 5 (43–45) · 10: 5 (45) |
| Sgt. Pfeiffer (8; Cmd 1; 1-1-6) | 5: 4 (39–42) · 6: 4 (39–44) · 7: 4 (43–45) · 8: 4 (45) |
| Cpl. Schmidt (7; Cmd 1; 1-1-6) | 4: 3 (39–42) · 5: 3 (43–44) · 6: 3 (45) |
| Cpl. Guttman (6; Cmd 1; 1-1-6) | 2: 3 (39–44) · 3: 3 (45) |
| Weapon Team w/ Light MG | 4: 2 (39–43) · 5: 2 (44–45) · 7: 2 (39–45) |
| Weapon Team w/ Heavy MG | 3: 3 (44–45) · 6: 3 (39–45) · 8: 3 (44–45) · 9: 3 (42–43) · 10: 3 (39–41) |
| Weapon Team w/ Light Mortar | 4: 2 (44–45) · 5: 2 (43) · 7: 2 (39–42) |
| Weapon Team w/ Medium Mortar | 5: 2 (39–42) · 7: 2 (43–45) |
| Weapon Team w/ IG 18 Gun (10, 16, −3) | 8: 2 (39–45) |
| Weapon Team w/ IG 33 Gun (12, 16, −4, Smoke) | 11: 3 (39–45) |
| Pionier Squad w/ Flamethrower | 12: 3 (40–44) |
| Pionier Squad w/ Satchel Charge | 11: 2 (40–45) |
| SS Squad | 9: 2 (42) · 10: 2 (43–44) · 11: 2 (45) |
| Elite Rifle Squad | 10: 2 (39–42) · 11: 2 (39–44) · 12: 2 (39–45) |
| Parachute Squad | 8: 2 (39–42) · 9: 2 (43–44) · 10: 2 (45) |
| Rifle Squad | 5: 1 (39–42) · 6: 1 (39–44) · 7: 1 (39–45) · 8: 1 (43–45) · 9: 1 (45) |
| Volksgrenadier Squad | 3: 1 (39–42) · 4: 1 (39–44) · 5: 1 (43–45) · 6: 1 (45) |
| Conscript Squad | 2: 1 (39–45) · 3: 1 (43–45) · 4: 1 (45) · 10: 1 (45) · 11: 1 (44–45) · 12: 1 (43–45) |
| Radio 150mm (12 FP) | 5: 5 (39–41) · 6: 5 (42–43) · 7: 5 (44–45) |
| Radio 120mm (11 FP) | 2: 4 (42–43) · 3: 4 (44–45) |
| Radio 105mm (10 FP) | 4: 4 (44–45) · 5: 4 (42–43) · 6: 4 (39–41) |
| Radio 81mm (9 FP) | 7: 3 (39–42) · 8: 3 (43–45) · 12: 3 (39–41) |
| Radio 75mm (8 FP) | 10: 3 (39–41) · 11: 3 (42–45) |

"A or B" leader rows: one roll makes only one of the two available (FAQ, CC:M clarification RS.7). German radios all
show Smoke on the table icons.

#### American Support Table

| Item | Columns |
|---|---|
| Cpt. Sitner (10; Cmd 2; 2-1-6) | 11: 5 (45) · 12: 5 (44–45) |
| Lt. Esparza (9; Cmd 2; 2-1-6) | 10: 4 (45) · 11: 4 (44) · 12: 4 (43) |
| Lt. Thomas (9; Cmd 1; 1-1-6) | 9: 3 (45) · 10: 3 (44) · 11: 3 (43) |
| Sgt. Bergstrom (8; Cmd 2; 2-1-6) | 8: 4 (44–45) · 10: 4 (43) |
| Sgt. Fuller (8; Cmd 2; 2-1-6) | 7: 4 (45) · 9: 4 (43–44) |
| Sgt. Elkheart (8; Cmd 1; 1-1-6) | 6: 3 (44–45) · 8: 3 (43) |
| Sgt. Goziak (8; Cmd 1; 1-1-6) | 5: 3 (45) · 7: 3 (43–44) |
| Cpl. Jensen (7; Cmd 1; 1-1-6) | 4: 2 (45) · 5: 2 (44) · 6: 2 (43) |
| Cpl. Twells (6; Cmd 1; 1-1-6) | 2: 2 (43–45) · 3: 2 (43–44) · 4: 2 (43) |
| Weapon Team w/ Medium MG | 4: 2 (43–45) · 7: 2 (43–45) |
| Weapon Team w/ Heavy MG | 9: 2 (43–45) |
| Weapon Team w/ .50 cal MG | 5: 2 (43–45) |
| Weapon Team w/ Light Mortar | 2: 2 (43–45) · 3: 2 (43–45) · 6: 2 (43–45) |
| Weapon Team w/ Medium Mortar (9, 3–16, −3, Smoke) | 8: 2 (43–45) |
| Weapon Team w/ Pack Howitzer (10, 16, −3, Smoke) | 10: 2 (43–45) |
| Engineer Squad w/ Flamethrower | 12: 3 (43–45) |
| Engineer Squad w/ Satchel Charge | 11: 2 (43–45) |
| Paratroop Squad | 11: 2 (45) · 12: 2 (44–45) |
| Elite Squad | 9: 2 (45) · 10: 2 (44–45) · 11: 2 (43–44) · 12: 2 (43) |
| Line Squad | 5: 2 (45) · 6: 2 (44–45) · 7: 2 (43–45) · 8: 2 (43–45) · 9: 2 (43–44) · 10: 2 (43) |
| Green Squad | 2: 1 (43–45) · 3: 1 (43–45) · 4: 1 (43–45) · 5: 1 (43–44) · 6: 1 (43) |
| Radio 203mm (13 FP; icon shows no Smoke) | 2: 7 (44) · 3: 7 (45) |
| Radio 155mm (12 FP, Smoke) | 4: 7 (43–45) |
| Radio 105mm (10 FP, Smoke) | 7: 5 (43–45) |
| Radio 81mm (9 FP, Smoke) | 8: 5 (43–45) · 12: 5 (43–45) |
| Radio 75mm (8 FP, Smoke) | 11: 4 (43–45) |

#### Russian Support Table

| Item | Columns |
|---|---|
| Cpt. Egorov (10; Cmd 2; 2-1-6) | 11: 4 (44–45) · 12: 4 (42–45) |
| Lt. Ostroumov (9; Cmd 2; 2-1-6) | 10: 3 (44–45) · 11: 3 (42–43) · 12: 3 (39–41) |
| Lt. Bijak (9; Cmd 1; 1-1-6) | 9: 3 (44–45) · 10: 3 (42–43) · 11: 3 (39–41) |
| Sgt. Pyotor (8; Cmd 2; 2-1-6) | 8: 3 (44–45) |
| Sgt. Rodimtsev (8; Cmd 2; 2-1-6) | 9: 3 (42–43) · 10: 3 (39–41) |
| Sgt. Kaminsky (8; Cmd 1; 1-1-6) | 6: 2 (44–45) · 7: 2 (42–45) · 8: 2 (39–43) · 9: 2 (39–41) |
| Cpl. Anishchik (7; Cmd 1; 1-1-6) | 5: 2 (44–45) |
| Cpl. Kutikov (7; Cmd 1; 1-1-6) | 6: 2 (42–43) · 7: 2 (39–41) |
| Cpl. Denikin (6; Cmd 1; 1-1-6) | 2: 2 (39–45) · 3: 2 (39–43) · 4: 2 (39–41) |
| Weapon Team w/ Light MG | 2: 2 (44–45) · 4: 2 (45) · 6: 2 (39–45) |
| Weapon Team w/ Medium MG | 9: 2 (45) · 10: 2 (39–42) · 11: 2 (43–44) |
| Weapon Team w/ Heavy MG | 8: 2 (45) · 9: 2 (44) · 10: 2 (43) |
| Weapon Team w/ .50 cal MG | 11: 2 (45) · 12: 2 (39–44) |
| Weapon Team w/ Light Mortar | 2: 2 (43) · 3: 2 (39–41) · 5: 2 (39–45) |
| Weapon Team w/ Medium Mortar (9, 3–16, −3, Smoke) | 7: 2 (43–45) · 9: 2 (39–41) · 11: 2 (42) |
| Weapon Team w/ Infantry Gun (10, 16, −4, Smoke) | 8: 2 (39–45) |
| Assault Squad w/ Flamethrower | 12: 3 (42–45) |
| Assault Squad w/ Satchel Charge | 11: 2 (39–45) |
| Guards Rifle Squad | 9: 2 (45) · 10: 2 (43–45) · 11: 2 (42–45) · 12: 1 (39–45) |
| Guards SMG Squad | 8: 2 (45) · 9: 2 (43–44) · 10: 2 (42) · 11: 2 (39–41) |
| Rifle Squad | 5: 1 (45) · 6: 1 (43–45) · 7: 1 (42–45) · 8: 1 (39–44) · 9: 1 (39–42) · 10: 1 (39–41) |
| SMG Squad | 3: 1 (45) · 4: 1 (43–45) · 5: 1 (42–44) · 6: 1 (39–42) · 7: 1 (39–41) |
| Militia Squad | 2: 1 (39–45) · 3: 1 (39–44) · 4: 1 (39–42) · 5: 1 (39–41) · 6: 1 (39–45) · 7: 1 (39–45) · 8: 1 (45) · 9: 1 (43–45) · 10: 1 (42–45) · 11: 1 (39–45) |
| Radio 152mm (12 FP; icon appears to lack Smoke) | 2: 4 (39–40) · 3: 4 (41–42) · 4: 4 (43–45) |
| Radio 122mm (11 FP, Smoke) | 5: 4 (39–41) · 6: 4 (42–45) |
| Radio 82mm (9 FP, Smoke) | 7: 3 (39–45) · 11: 3 (39–45) |
| Radio 76mm (8 FP, Smoke) | 8: 2 (39–40) · 9: 2 (41–42) · 10: 2 (43–45) |

The same Support Tables feed Hidden Unit (non-Radio, free), Infiltration (non-Radio, free) and Reinforcements (any item,
free) during play. Smoke capability of the 203mm and 152mm Radios must be confirmed from the counter data.

### RS.8 Posture
The player with the VP marker on his side (spent less) is the Defender, the other the Attacker. VP marker on 0: both
Recon. Set the OB Stats markers' postures.

### RS.9 Fortifications
The Defender may spend up to his current VP total on Fortification OBs (counter mix permitting: R-56), moving the VP marker
toward the Attacker by the cost. All Minefield purchases must share one strength.

| Fortification OB | Contents | VP cost | Restriction |
|---|---|---|---|
| Entrenchments | 3 Foxholes | 1 | |
| Trench Line | 3 Trenches | 2 | |
| Barbed Wire | 9 Wire | 3 | |
| Strongpoint | 1 Bunker + 1 Trench | 2 | |
| Bunker Complex | 3 × (Bunker + Trench + Wire + Mines 8 FP) | 10 | not with 6- or 7-FP minefields |
| Hasty Minefield | 10 Mines, 6 FP | 6 | not with 7- or 8-FP minefields |
| Prepared Minefield | 10 Mines, 7 FP | 9 | not with 6- or 8-FP minefields |
| Extensive Minefield | 10 Mines, 8 FP | 12 | not with 6- or 7-FP minefields |

("3×" for the Bunker Complex is read as three of each item — project reading; the counter mix, R-56, caps the markers
of all the OBs bought together.)

### RS.10 Defender sets up
Within 8 rows (wide map) or 12 rows (narrow) of his edge; stacking applies. Fortifications wait until RS.12. Put his
control marker on every Objective; adjust VP for the open chit(s).

### RS.11 Attacker sets up
1. *Asset Request:* the Attacker may roll on his Support Table; if he does, he must buy that column's Radio if one is
   available for the year (Radios only), paying its cost (VP marker toward the Defender).
2. *Deployment:* within 2 rows (wide) or 3 rows (narrow). Radio to his Artillery Box. Flip control of any Objective he
   occupies that holds no enemy unit; adjust VP.

### RS.12 Fortification set-up
The Defender places his Fortifications within 8 rows (wide) / 12 rows (narrow).

### RS.13 Recon set-up (Recon vs Recon)
The player with the higher OB Initiative number sets up first, within 4 rows (wide) / 6 rows (narrow); then the other,
same depth. Each places his control marker on Objectives he alone occupies; adjust VP.

### RS.14 Markers
- Time marker on 0.
- Sudden Death space = Axis Orders + Allied Orders (from the OB Stats).
- Surrender markers on each OB's Surrender level.
- Minefields marker on the 7 or 8 side if 7-/8-FP Mines were bought.
- Smoke/Blaze cup.

### RS.15 Cards
The higher OB Initiative number takes the Initiative card (tie: coin flip — rules-reference R-50). Shuffle Fate decks;
draw hands (Attack 6, Recon 5, Defend 4).

### RS.16 H-Hour
The Initiative holder takes the first Turn.

### RS.x Point values for designing scenarios (S4 p. 34; base nations only)
Hundredths of a VP (divide totals by 100 for starting VP). Pieces on the Time Track at start are worth
value × (SD − space) / SD.

| Piece | America | Germany | Russia |
|---|---|---|---|
| Leader : Squad ratio | 1:4 | 1:3 | 1:5 |
| Captain | 443 | 597 | 344 |
| Lieutenant, Cmd 2 | 382 | 515 | 296 |
| Lieutenant, Cmd 1 | 304 | 409 | 236 |
| Sergeant, Cmd 2 | 326 | 439 | 253 |
| Sergeant, Cmd 1 | 252 | 340 | 196 |
| Corporal, Morale 7 | 206 | 277 | 160 |
| Corporal, Morale 6 | 164 | 221 | 127 |
| Private | 228 | 307 | 177 |
| Hero | 336 | 452 | 260 |
| Elite Squads | Engineer 137, Paratroop 141, Elite 125 | SS 154, Pionier 148, Elite Rifle 125, Parachute 123 | Assault 139, Guards SMG 115, Guards Rifle 103 |
| Line Squads | Line 114 | Rifle 100, Volksgrenadier 83 | SMG 89, Rifle 79 |
| Green Squads | Green 78 | Conscript 63 | Militia 61 |
| Weapon / Elite / Line / Green Team | 73 / 96 / 73 / 52 | 83 / 86 / 64 / 45 | 79 / 71 / 54 / 40 |
| Light MG | – | 62 | 35 |
| Medium MG | 84 | – | 74 |
| Heavy MG | 108 | 123 | 105 |
| .50 cal MG | 125 | – | 122 |
| Light Mortar | 87 | 71 | 79 |
| Medium Mortar | 105 | 107 | 102 |
| Gun | Pack Howitzer 119 | IG 33 137, IG 18 111 | Infantry Gun 110 |
| Satchel Charge | 37 | 38 | 36 |
| Flamethrower | 79 | 81 | 77 |
| Molotov Cocktail | 23 | 23 | 22 |
| Radio 13 / 12 / 11 / 10 / 9 / 8 FP | 700 / 700 / – / 521 / 439 / 364 | – / 510 / 440 / 380 / 320 / 265 | – / 334 / 334 / – / 243 / 201 |
| Foxhole / Trench / Bunker | 31 / 62 / 124 (all) | | |
| Mines 6 / 7 / 8 FP; Wire | 60 / 90 / 120; 33 (all) | | |

Other design hints (S4 p. 35, paraphrased): Company ≈ 9 German / 12 American / 15 Russian squads (Detachment ⅔,
Platoon ⅓); Leaders: Company 3, Detachment 2, Platoon 1; Orders = Leaders + 1; Surrender ≈ 70% (Company), 75%
(Detachment), 80% (Platoon) of Leaders+Squads+Teams; Sudden Death = 2 + total Leaders on both sides; Defender set-up 8
(wide) / 12 (narrow), Attacker 2 / 3.

## 5. What is missing / to be filled from the VASSAL module

1. **Original 2006 CC:E Playbook** (scenarios as first printed, original RSG tables, original Fortification OB costs,
   original American OB "X" column). Not public. The 20th-edition data above is the official current version.
2. **Scenario 12 counters** for the base game (Brazilian vs US) — check VASSAL save 012.
3. **Per-card data not in the manifest:** Breeze wind direction on each Breeze card; the exact printed text of each
   Event (paraphrased rules exist in rules-reference Part E). The S4 manifests do give, per card: Order, Action, Event,
   Random Hex, dice, trigger (for all 216 cards of the three decks).
4. **Counter data:** broken-side stats of every unit and Leader, Weapon Fix/Elim ranges, Smoke marker values and the
   number of Smoke and Blaze markers, counter-mix limits (Wire, Mines, Bunkers, Foxholes, Trenches; the single Pillbox),
   Heroes (one per nation) and the Private. Owned by the VASSAL survey (`design/data/`).
5. **Track Display** layout (number of Time Track and Casualty Track spaces) — not needed for rules (engine uses
   integers), only for art.
6. Cards named in scenario special rules are resolved above from the S4 manifests (G-65, R-31, G-32); remove such a
   card from the deck before shuffling and add it to the opening hand (project ruling: it counts toward the opening hand size).
