# Combat Commander: Europe — Rules Reference (condensed, paraphrased)

Status: research deliverable, 2026-10-17. Base game only (Germany, America, Russia).
This is the authority for the engine and the rules tests. Everything here is written in our own words;
it is not a copy of GMT text. Numbers, names and terms of art are data.

## 0. Sources, edition and conventions

### 0.1 Sources used

| # | Source | Where | Notes |
|---|---|---|---|
| S1 | Rulebook v1.1 (2007, "CC_Rulebook_v1.1.pdf", 24 pp.) | https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/living_rules/CC_Rulebook_v1.1.pdf (linked from GMT's CC:E product page) | Primary text. v1.1 already contains the v1.0 errata (blue text). |
| S2 | Official Consolidated FAQ, version 10, 8 Feb 2017 (2 pp.) | https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/combatcomm/CC-Consolidated-FAQ.pdf | Errata E52.1; clarifications 5/O15, 6.1.2, 6.3, 9.2, O16.4.2, O20.3.2, E42, counter mix, crest lines, troop quality. |
| S3 | 20th Anniversary Edition Rulebook (2025, "CC-20thAnniv_Rulebook_ONLINE.pdf", 24 pp.) | https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/CC_20th/CC-20thAnniv_Rulebook_ONLINE.pdf | Still "version 1.1". Word-diffed against S1: only real changes are E42 (melee inside an Event), E52.1 ("receiving"), the Russian light mortar range written as "2-14", and dice filled in on the examples. |
| S4 | 20th Anniversary Playbook v1.1 (2025, 52 pp.) | https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/CC_20th/CC-20thAnniv_Playbook_ONLINE.pdf | Scenario setup procedure, scenarios 1-12, RSG, point values, design notes, example of play, card manifests (every Fate card's Order/Action/Event/hex/dice/trigger). |
| S5 | 20th Anniversary Terrain Chart (1 p.) | https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/CC_20th/CC20th_Terrain_Chart.pdf | Terrain hierarchy and values. |
| S6 | VASSAL module CombatCommanderEurope-2.6.4 (user-approved download, in the scratchpad) | images `Misc CC Chart.png` (Track Display data boxes), `OBJ-*.png` (objective chits), OB/Support/Leader/Fortification tables | Fills data that GMT does not post as text. |
| S7 | Combat Commander: Pacific rulebook (later series volume) | https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/combatcommpac/CC-P_Rulebook_FINAL.pdf | Used only as "series precedent" where CC:E is silent; never overrides CC:E. |
| S8 | InsideGMT "CC:E Random Scenario Setup Example" (D. Waldorf, 2022) | https://insidegmt.com/combat-commander-europe-random-scenario-setup-example | Partial view of the original 2006 RSG. |

BoardGameGeek and ConsimWorld threads could not be fetched by our tools (search results did not surface
them, and BGG pages need JavaScript/login). Where neither the rules, the FAQ nor the examples settle a point,
the ruling below is marked **Project ruling** with its reasoning, so it can be revisited.

### 0.2 Conventions in this document

- Section headers follow the rulebook: `§O20 (rulebook O20.3.1)` means our section on rulebook rule O20.3.1.
  Rule letters: none = core, O = Orders, A = Actions, E = Events, T = Terrain, F = Fortifications.
- "Roll" always means the dice printed on the top card of the roller's own draw pile (see §1.9).
- "Player A / B", "active / inactive": the active player is the one whose Turn it is.
- The rulebook asks for literal reading: apply only the effects a rule states, never implied extras.
  Where a card's text conflicts with a rule, the card wins (Golden Rule, §1.0).
- Rulings numbered **R-nn** are collected in §20 (Ambiguities and rulings).

---

## Part A — Components and terminology

## §G Glossary of game terms (rulebook "Glossary")

| Term | Meaning for implementation |
|---|---|
| Fate card | One of 72 cards in a nation's deck. Has an Order (top), an Action (under the picture; for Fire it is printed at the top as "Order/Action"), an Event, a Random Hex (letter+number), and two dice (white + coloured) possibly inside a red trigger box (Event!, Jammed!, Sniper!, Time!). |
| Order | Card use on your own Turn only; counts against your Order Capability. |
| Action | Card use on either player's Turn when its prerequisite is met; unlimited number. |
| Event | Never played from hand; happens only when an Event! trigger reveals a card. |
| Activate | Units are normally activated at most once per Turn (Hero exception). Recover/Rout activate a *player*, not units. |
| Active / inactive | Player whose Turn it is / the other one. When both may do something at the same moment, the inactive player goes first (fully) — see §A24.2. |
| Adjacent | Sharing a hexside. |
| Broken | A unit, Weapon or Radio showing its reverse side. If an already-broken piece breaks a second time, it is eliminated. Broken Weapons/Radios cannot be used. Broken units still act, weaker. |
| Command | Leader-only stat (number in a hexagon). Radius of activation and bonus to stacked Squads/Teams and their Weapons. |
| Cover | Number for each terrain/fortification; the best single applicable Cover is added to the Morale of each unit in the hex. Never cumulative. |
| Friendly hex | A hex holding a friendly unit, or an Objective hex you control that holds no enemy unit. Enemy hex is the mirror. Fortifications are never friendly or enemy. |
| Hindrance | Terrain/marker that reduces fire *through* it (Smoke also into/out of its own hex). Not cumulative: only the largest applies. |
| Obstacle | Terrain that stops a LOS passing *across* it; a LOS that starts or ends in the Obstacle's own hex is never blocked by it. |
| LOS | Line of sight: straight segment between hex centre dots. |
| Marker | Any non-unit counter (Weapons, Wire, Control, Smoke, Spotting Round, etc.). |
| Morale | Unit stat (top right). Defence strength and the target number for Rally/Rout rolls. |
| Op Fire | Opportunity Fire: a Fire Action played during the opponent's Move Order. |
| Ordnance | A Weapon whose stats sit on a white band. Must hit with a Targeting roll first; never in a Fire Group; never Op Fire; never boosted by Leader Command. |
| Piece | Unit, Weapon, Radio or Fortification. |
| Posture | Attack / Recon / Defend. Sets hand size (6/5/4) and some Action eligibility. |
| Random Hex | Hex id printed on a Fate card; also used for broken Weapon Fix/Elim checks. |
| SR | Spotting Round marker (artillery). |
| Trigger | A red box around the dice on a card (Event!, Jammed!, Sniper!, Time!). |
| Turn | One player either giving one or more Orders, or passing (discarding 0..limit cards). |
| Unit | Squad (4 figures), Team (2 figures) or Leader (1 figure). |
| Weapon | Small counter with FP and Range (MGs, mortars, guns, flamethrower, satchel charge). Radios and Mines are NOT Weapons. |
| VP | Victory points; a single signed track (positive toward one side). |

## §1 Fate cards (rulebook 1)

### §1.0 Golden Rule (rulebook 1.0)
When a card's effect contradicts a rule, apply the card. Example: Interrogation lets you see the opponent's hand
despite hand secrecy (§1.2).

Non-Fate cards (Initiative card, cheat cards) are never part of a hand and never count as "a card".

### §1.1 Hand size (rulebook 1.1)
Attack 6, Recon 5, Defend 4. This is both the opening hand and the refill target at the end of each of your own Turns.

### §1.2 Card knowledge (rulebook 1.2)
Hand: secret from the opponent. Draw pile: face down, unknown to both (order unknown). Discard pile: public, may be
inspected at any time by both players.

### §1.3 Revealing (rulebook 1.3)
To "reveal" = flip the top card of your own draw pile face up and put it on top of your discard pile. Every die
roll, Random Hex check, Event draw and artillery drift check is a reveal. A reveal of the last card in the draw pile
triggers a Time advance (§6.1.2).

### §1.4 Reshuffle (rulebook 1.4)
Only during a Time advance: the triggering player shuffles his draw pile and discard pile together into a new draw
pile (hand untouched).

### §1.5 / §1.6 / §1.7 Using a card (rulebook 1.5–1.7)
A card in hand can be played for exactly one of: its Order (own Turn, within Order Capability) or its Action (either
Turn, prerequisite met). It then goes to its owner's discard pile. While in hand the Event and everything below it are
ignored. A card whose top reads "Order/Action Fire" can be played as a Fire Order, *or* as a Fire Action (Op Fire),
*or* for the Action printed under its picture.

### §1.8 Random Hex (rulebook 1.8)
To determine a Random Hex, reveal the top card of your draw pile and read only its hex id. Immediately (before the
Sniper/Event effect itself) compare the hex *number* with every broken Weapon in play, both sides (§11.4).

Data note: in the Fate decks (S4 card manifests) German cards carry hex numbers 1,3,5,7,9 only; American and Russian
cards carry 2,4,6,8,10 only; every letter A–O appears.

### §1.9 Die rolls (rulebook 1.9)
A "roll" = reveal the top card and use only its two dice; sum them, except a Targeting roll multiplies them (§O20.2.3).
Each deck holds every ordered pair of dice (white, coloured) exactly twice: 72 cards, sums distributed exactly like
2d6 twice over (S4 manifests). The two dice are distinguishable (white first, coloured second) — needed for artillery
drift (§O18.2.2) and for "doubles" (§A41).

#### §1.9.1 Triggers (rulebook 1.9.1)
A trigger (Event!, Jammed!, Sniper!, Time!) on a revealed roll pauses play. Rules:
1. The roll's numeric result is locked in, but its *result is applied only after the trigger is fully resolved*.
   Example: a rout roll that will force a 1-hex retreat and shows Event! — resolve the Event first; even if the Event
   rallies that unit, it still retreats afterwards.
2. Rolls made while resolving a trigger never produce triggers (e.g. the Sudden Death roll during a Time advance; any
   roll inside an Event, including a melee that an Event creates). See also §E42.
3. If the card that produced a non-Time trigger was the last card of the draw pile, do the Time advance (§6.1.2) first,
   then resolve the trigger. If a Time! trigger appears on the last card, advance only once.
4. The Initiative re-roll decision (§9.1) is taken after the roll is seen and before its trigger/result is applied.

Trigger effects:
- **Event! (1.9.1.1)** — the roller reveals his next card and carries out its Event (§E). He makes the Event's choices
  unless the Event says otherwise.
- **Jammed! (1.9.1.2, O20.3.3.1)** — only on a *Fire Attack Roll*: every Weapon firing in that attack breaks (a broken
  one is eliminated). The attack still happens at full strength. On any other roll (Targeting, Defense, Melee, Mine
  Attack, Artillery Impact, Rally, …) Jammed! has no effect.
- **Sniper! (1.9.1.3)** — the roller reveals his next card for a Random Hex (broken Weapon check happens first), then
  may break one unit of either side located in that hex or next to it. Optional.
- **Time! (1.9.1.4)** — Time advance (§6.1.2).

Deck trigger counts (S4): Germany 10 Event!, 7 Sniper!, 2 Jammed!, 2 Time!; America 12 / 6 / 2 / 2;
Russia 8 / 8 / 4 / 2. Time! is always on 6-6 (both copies); Jammed! on 1-1 (Russia also 1-2).

## §2 Maps (rulebook 2)

- 12 maps (6 boards, back-printed). Each: 150 hexes, 15 lettered columns A–O × 10 numbered rows 1–10 (S4 p.35).
  Hex id = letter + number, e.g. "C7".
- Compass (2.2.2) in the lower left: direction 1 = top edge, 4 = bottom, 2 and 3 = right, 5 and 6 = left. The six
  numbers are the six hexside directions of the grid (1 up, 2 upper-right, 3 lower-right, 4 down, 5 lower-left,
  6 upper-left). Used for map orientation, artillery drift and Breeze direction.
- Orientation: when the players sit at compass 1 and 4 (long edges) the map is "wide" (10 hexes between friendly
  edges); when at 2/3 and 5/6 (short edges) it is "narrow" (15 hexes between edges). Row numbers run from the
  compass-1 edge (row 1) to the compass-4 edge (row 10); letters run from the 5/6 side (A) to the 2/3 side (O)
  (consistent with scenario 1 and 11 hex references).
- Two opposite corners hold the Artillery Boxes (one per player; Radio lives there).
- Five Objectives per map, numbered 1–5 (red circles).
- Each hex has a centre dot used for LOS.
- Map edges: only the two friendly edges (each player's own and the opponent's) can be crossed; the flanks are an
  impassable barrier once play starts.

## §3 Units (rulebook 3)

### §3.1 Stats (rulebook 3.1)
Squad = 4 figures, Team = 2, Leader = 1. Bottom row: FP, Range, Movement. Top right: Morale. Leaders also have Command
(in a hexagon). Broken side: red bar, white Morale; usually lower stats.

Boxed stats (3.1.6): a box around FP, Range or Movement. Boxed FP gives +1 in melee strength and enables Assault Fire;
boxed Range enables Spray Fire; boxed Movement enables Smoke Grenades. No other intrinsic meaning.

### §3.2 Broken units (rulebook 3.2)
- Break: unbroken → broken (flip). Broken → eliminated (opponent scores VP, unit goes to Casualty Track).
- Attached markers (Suppressed, Veteran, Weapon) stay when flipping either way.
- Broken units cannot fire Weapons. A Weapon's state is independent of its carrier.
- Rally: broken → unbroken.

### §3.3 Leaders and Command (rulebook 3.3)
Use the Leader's *current* side's Command (a broken Leader usually has 0).

- **Command Radius (3.3.1.1):** when a Leader is activated for an Order or for Op Fire, the player may activate with it
  whichever friendly *non-Leader* units he likes (none, some or all) that are no more than that many hexes away (0 = own
  hex only; 1 = own + adjacent; 2 = up to 2 away). Distance ignores terrain, impassable hexes and enemy units. Leaders
  never activate other Leaders.
- **Unit Command (3.3.1.2):** a friendly Squad or Team gets the Command of each friendly Leader sharing its hex added
  to its own FP, Range, Movement and Morale — the Leader need not be activated. Multiple Leaders stack
  (cumulative). Leaders never boost themselves or other Leaders.
- **Weapon Command (3.3.1.3):** each friendly Leader also adds its Command to the FP and Range of every non-Ordnance
  Weapon carried by a Squad/Team in its hex (cumulative). Ordnance and Weapons carried by Leaders get nothing.
- Bonuses are positional and recomputed continuously: a moving Squad that leaves its Leader's hex loses the Movement
  bonus at once (S1 Op Fire example, H).

### §3.4 Heroes and the Private (rulebook E58.1, E56)
- A Hero is a Leader in all respects except: (a) it never scores exit VP for its owner and the opponent never gains VP
  for eliminating it; an eliminated/exited Hero returns to the counter mix, never to the Casualty Track or Time
  Track; (b) the once-per-Turn activation limit does not apply to it (several Orders; also repeated Op Fire per S7).
- The Private is the Leader brought in by Field Promotion (6 Morale, 2 Command per S1 text; exact counter from data).

## §4 Track Display (rulebook 4)

- **Victory Track (4.1):** one VP marker, signed total (positive toward one player). Beyond 20 the marker flips; the
  engine just stores an integer.
- **Attack Total marker (4.1.2):** memo only.
- **Casualty Track (4.2):** two rows, one per player, numbered spaces, plus a central Weapons box. Each eliminated
  non-Hero unit goes to the lowest empty space of its owner's row; its Weapon goes to the Weapons box. Each player's
  Surrender marker sits on a scenario-given space; placing an eliminated unit into that space loses the game (§6.3).
  Engine model: lose when the number of that player's units on the track reaches the Surrender value (see R-40).
- **OB Display (4.3.1):** per side: Troop Quality (Elite/Line/Green) and Orders per Turn (1–6).
- **Year Track (4.3.2):** scenario year (matters for Support Table items, Hidden Unit, Reinforcements, Infiltration).
- **Objective Box (4.3.3):** open chits in the centre; each player's secret chits on his side.
- **Data boxes (4.3.4):** quick-reference for Fortifications, Flamethrower, Satchel Charge, Artillery. The Artillery box
  holds the Fortification Vulnerability table (§O18.2.3.3).
- **Time Track (6):** Time marker and Sudden Death marker; reinforcements and exited units wait on its spaces.

---

## Part B — Core rules

## §5 Sequence of play (rulebook 5)

The scenario says who takes the first Turn. Players then alternate Turns until the game ends (§6.3). There are no
game turns or phases beyond this.

### §5.0 A Turn, step by step — engine view (rulebook 5, 5.4, 8.2)
1. The active player chooses **Orders** or **Pass**:
   - *Orders:* play one Order card at a time (up to the Order Capability, §5.1), resolve it completely (§O14.2),
     then decide whether to play another. He may also stop early. Playing zero Orders is not "Orders"; it is a Pass.
   - *Pass:* discard 0 up to his nation's Discard Capability (§5.3) cards from hand (FAQ: zero is allowed).
2. Throughout, both players may play Actions whose prerequisites are met (§A24).
3. Turn end: (a) enforce unit stacking for **both** players (§8.2; R-41 for order); (b) the active player (only) draws
   until his hand equals his Hand Size (§5.4). Drawing the last card triggers a Time advance mid-refill; finish the
   refill afterwards from the new pile.
4. The other player becomes active.

### §5.1 Order Capability (rulebook 5.1)
Max Orders per Turn = the "# of Orders" on the OB Display (scenario/OB value; some special rules change it).

### §5.2 Action Capability (rulebook 5.2)
No limit except cards in hand. Any player, any Turn, prerequisite met.

### §5.3 Discard Capability (rulebook 5.3, O15)
If no Order is given, the player may discard any number of cards from 0 up to his nation's limit:
**Germany 6, America 5, Russia 3** (Germany: S4 design notes "always able to discard every card"; America: S4 design
notes "discard capability of 5"; Russia: S4 example of play "maximum of three discards"). Scenarios may override
(e.g. scenario 8 Axis = 1). A player who gave one or more Orders cannot discard in that Turn.

### §5.4 Hand Refill (rulebook 5.4)
See step 3 above.

## §6 Game time (rulebook 6)

### §6.1 Time marker (rulebook 6.1)
Placed per scenario (usually space 0).

#### §6.1.2 Time advance — what causes it (rulebook 6.1.2)
- A Time! trigger on any roll that is allowed to trigger, or
- a player revealing or drawing the final card of his draw pile (handled exactly like a Time! trigger by that player). This
  happens even while resolving another trigger or Event (R-07).
- A Time! trigger on the last card advances the marker once, not twice.

#### §6.1.2 Time advance — procedure, in this exact order (rulebook 6.1.2)
The Time marker moves forward one space. Then:
1. The triggering player (only) shuffles his draw pile and discard pile into a new draw pile.
2. If the Time marker is now in or beyond the Sudden Death space, the triggering player makes the Sudden Death roll
   (§6.2.2). Immediately before that roll, check Objective chit V (§7.3.2).
3. If the game did not end: the scenario **Defender** (posture Defend) gains 1 VP. (Recon vs Recon: nobody.)
4. The triggering player must remove one Smoke marker of his choice from the map, if any exist.
5. Units/pieces on the Time Track space now occupied by the Time marker enter as reinforcements: each owner places
   them in hexes along his own friendly board edge (inactive player places first), respecting stacking limits. A
   reinforcement Radio goes to its owner's Artillery Box (only if empty; §8.1.2).
6. Each player may now play Dig In Actions (§A32), the inactive one first.
Then play resumes exactly where it paused (including an interrupted hand refill, or the pending result of the
triggering roll).

### §6.2 Sudden Death (rulebook 6.2)
Marker placed per scenario. Whenever the Time marker enters or passes it, the triggering player rolls (after his
reshuffle). If the roll is **less than the number of the space the Time marker now occupies** (not the SD space), the
game ends immediately. Otherwise play continues; every later Time advance repeats the roll. Note a roll can never be
below 2, so Time space ≤2 never ends the game this way; Time space ≥13 always does.

### §6.3 Game end (rulebook 6.3, as clarified by FAQ)
The game ends when any of these happens:
1. A player has to put one of his eliminated units into the Casualty Track space where his own Surrender marker sits.
2. The final unit a player has on the map is eliminated.
3. The final unit a player has on the map leaves it voluntarily, by Moving or Advancing off.
4. A Sudden Death roll comes up lower than the number of the Time space the marker occupies.

Outcome:
- Cases 1 or 2: that player loses at once regardless of VP. If both players lose this way simultaneously, the holder of
  the Initiative card wins.
- Cases 3 or 4 (and neither 1 nor 2 applies): reveal all secret Objective chits and score them for the current
  controllers; the side with the VP marker on its side of 0 wins; exactly 0 → Initiative holder wins (9.2).

## §7 Victory conditions (rulebook 7)

VP come from: eliminating enemy units, exiting own units off the enemy edge, controlling Objectives (as valued by the
Objective chits), plus Events/Actions (Defender time bonus, Command & Control, Battlefield Integrity, No Quarter,
Light Wounds penalty, …).

### §7.1 Elimination VP (rulebook 7.1)
Whenever a unit is eliminated for any reason, its opponent gains: Squad 2, Team 1, Leader 1 + its *unbroken-side*
Command, Hero 0. (Chit X doubles these for both sides.)

### §7.2 Exit VP (rulebook 7.2)
- Flanks (the two non-player edges) can never be crossed. Each player's own edge and the opponent's edge can be crossed
  as if the border were one more hex.
- **Voluntary exit (7.2.1):** a Moving (cost 1 MP) or Advancing unit may leave across the *opponent's* edge only. Its
  owner immediately gains the same VP value as in §7.1 (Hero 0; chit W doubles). Then the owner places it on any Time
  Track space he chooses (R-30), unbroken, still holding its Weapon (Weapon also flipped unbroken), but stripped of
  Veteran and Suppressed markers. From then on it is a new reinforcement unit.
- **Involuntary exit (7.2.2):** a Retreat that pushes a unit off its *own* edge eliminates it: opponent gains elimination
  VP, unit to the next empty Casualty space, its Weapon to the Weapons box unbroken, markers lost.
- A Move/Advance can never cross the unit's own edge or a flank.

### §7.3 Objective VP (rulebook 7.3)
Objectives are worth 0 VP unless an Objective chit gives them value.

#### §7.3.1 Control (rulebook 7.3.1)
- Scenario sets initial control; uncontrolled Objectives have no marker.
- After play starts, control belongs to the last side to have *solely* occupied the Objective hex (with any unit,
  broken or not). Control changes the moment a unit enters an Objective hex free of enemy units — including in the
  middle of a Move (S4 example of play, Turn 13) (R-31).
- **Building Objectives (7.3.1.1, T82):** an Objective in a building that spans several hexes is the whole building. To
  take control, a side needs a unit in the building and no enemy unit in any hex of that building.

#### §7.3.2 Objective chits — values from S6 chit images (rulebook 7.3.2)
22 chits, lettered A–X without I and O.

| Chit | Effect (open side) | Secret side? |
|---|---|---|
| A | Objective 1 = 1 VP | yes |
| B | Objective 2 = 1 VP | yes |
| C | Objective 3 = 1 VP | yes |
| D | Objective 4 = 1 VP | yes |
| E | Objective 5 = 1 VP | yes |
| F | Objective 2 = 2 VP | yes |
| G | Objective 3 = 2 VP | yes |
| H | Objective 4 = 2 VP | yes |
| J | Objective 5 = 2 VP | yes |
| K | Objective 3 = 3 VP | yes |
| L | Objective 4 = 3 VP | yes |
| M | Objective 5 = 3 VP | yes |
| N | Objective 4 = 4 VP | yes |
| P | Objective 5 = 4 VP | yes |
| Q | Objective 5 = 5 VP | yes |
| R | Objective 5 = 10 VP | **no — must be revealed** |
| S | Each of the 5 Objectives = 1 VP | yes |
| T | Each of the 5 Objectives = 2 VP | yes |
| U | Each of the 5 Objectives = 3 VP | yes |
| V | Sudden-death win: immediately before each Sudden Death roll, a player controlling all five Objectives wins outright | **no — must be revealed** |
| W | Exit VP doubled for both players | **no — must be revealed** |
| X | Elimination VP doubled for both players | **no — must be revealed** |

Which chits lack a secret side: S6 gives R, V, W, X a "MUST REVEAL" mask, and the S4 example of play has R and V both
revealed at start. Values add up across chits (C+G+K → Objective 3 worth 6).

#### §7.3.3 Open and secret chits (rulebook 7.3.3)
- Open chits score continuously: whenever control of a valued Objective changes, subtract from the old controller and
  add to the new one (a 4-VP Objective swings 8). An uncontrolled Objective scores for no one.
- Secret chits are known only to their owner and score only when revealed (Reconnaissance Event, game end). On
  reveal, award the chit's value to the *current* controller(s) at once; afterwards it behaves as open.
- A drawn "secret" chit with no secret side is placed open immediately (it then belongs to nobody in particular).
- Chit scoring is by the controlling *side*, not by the chit's drawer: a secret chit can end up paying the opponent.

## §8 Stacking (rulebook 8)

### §8.1 Markers — checked immediately on placement (rulebook 8.1)
- Per unit: at most one Suppressed, one Veteran and one Weapon. Any unit (incl. Leaders) may carry any Weapon.
- Radios: one per Artillery Box; if a second would enter, the first stays and the newcomer is not placed.
- Fortifications: one per hex; the first placed stays; a later placement into an occupied hex simply fails.
- Smoke: one per hex; if a second arrives keep the one with the larger Hindrance (ties: keep either — R-42).
- Blaze: one per hex; a hex holding a Blaze cannot also hold any unit or any of the markers above (unit markers,
  Fortification, Smoke).

### §8.2 Units (rulebook 8.2)
- Limit: friendly units totalling at most 7 figures per hex (Squad 4, Team 2, Leader 1). 8+ = overstacked.
- Overstacking is legal during a Turn; it is checked at the end of every Turn (both players' hexes). For each
  overstacked hex, the owner may first perform one free Deploy (§E52) there (two Teams left in the counter mix, R-56),
  then must eliminate units of his choice until legal. These are real eliminations (VP to the opponent, Casualty
  Track, possible Surrender).
- Scenario special rules may change the limit (scenario 11 Bunker hex: 4).
- Placement rules that say "stacking limits must be observed" (reinforcements, Infiltration, Reinforcements Event,
  Walking Wounded, setup) forbid placing into a hex that would then exceed 7 figures.

## §9 Initiative (rulebook 9)

- Scenario (or RSG higher Initiative number) gives one player the Initiative card. It is not part of the hand.
- **Re-roll (9.1):** at any time, its holder may cancel the most recent die roll *by either player* — including its
  trigger — and have it rolled again (by the same player, from his deck). Decide before any trigger or result of that
  roll is applied. Then hand the card to the opponent, who may use it the same way (even on the very re-roll).
  Unlimited passing.
- Only "rolls" can be cancelled: not Random Hex reveals, Event reveals, or artillery drift reveals (they are not rolls).
  A Time advance caused by the roll's card being the last card is not undone (R-08).
- **Ties (9.2):** any game ending in a tie (0 VP, or simultaneous loss) is won by the Initiative holder.

## §10 Line of sight (rulebook 10, with T88 for hills)

### §10.1 Basic check (rulebook 10.1)
- LOS between two hexes = straight segment between their centre dots. It is checked at any time, by either player;
  it is reciprocal.
- Only terrain in **intervening** hexes matters. Obstacles/Hindrances inside (or on the hexsides of) the sighting or
  target hex never matter — except Smoke, which hinders into/out of its own hex, and Blaze (which blocks in its hex,
  where no unit can be anyway).
- A hexside Wall/Hedge (Obstacle) or Fence (Hindrance) does count unless it forms part of the sighting or target hex's
  own border — even when the LOS runs exactly along that hexside (along the hexspine).
- Units never block or hinder LOS.

### §10.2 Obstacles (rulebook 10.2)
Terrain marked Obstacle on the Terrain Chart (Buildings, Woods, Hedges, Walls, Blaze; Hills relative to lower hexes).
A LOS that *touches* the drawn depiction of an Obstacle in an intervening hex is blocked. Blaze fills its entire hex
including all six hexsides.

Implementation note: obstacle and hindrance art must be represented as shapes (polygons) per hex, not whole-hex
flags, to match "touches the depiction" (the design forbids simplified LOS). Roads cutting through woods leave a gap:
a LOS running exactly along a road depiction is clear (S1 LOS example F).

### §10.3 Hindrances (rulebook 10.3)
- Hindrance number = penalty. Only the single largest Hindrance on the LOS applies (never summed). Smoke fills its whole
  hex including hexsides, and also hinders LOS into/out of its own hex.
- Effect on Targeting/Accuracy rolls: the roll (product) is reduced by the Hindrance; after a hit, the Fire Attack /
  Impact roll is not reduced again.
- Effect on non-Ordnance Fire Attacks: FP reduced by the largest Hindrance among all firing pieces' LOS.
- Minimum FP: if final FP ≤ 0 the attack cannot be rolled. Actions that add FP may be played to lift it to ≥1.

### §10.4 Hills and LOS (rulebook T88.3–T88.5)
Levels: 0 (ground) to 4. A hex with two levels is a Crest hex; its level is the higher one (FAQ: the centre dot of
every crest hex is at the higher level). The edge of the higher level drawn inside a crest hex is its Crest Line.
(CC:M clarification, FAQ: a hex at the top of a Cliff is a Crest hex.)

Algorithm for LOS between A (level a) and B (level b), applied in addition to §10.1–10.3:
1. **Hill as obstacle (T88.3.3):** any intervening hill area of level h blocks the LOS if h > a and h > b.
2. **Looking up (T88.3.2):** a unit can see a higher-level hex only if that hex is a Crest hex and is the first hex of
   its level (or higher) along the LOS — i.e. only the edge of each higher terrace is visible.
3. **Looking down (T88.3.2):** the higher unit at level a sees a lower hex only if the LOS crosses a Crest Line *inside
   the higher unit's own hex* before crossing any hexside, and afterwards never crosses another Crest Line of level ≥ a
   in an intervening hex.
4. **Same-level hills:** a hill at the same level as both ends does not block by itself (level-2 to level-2 across
   level-2 ground is fine); obstacles on it do.
5. **Obstacles vs elevation (T88.4):** let lo = min(a,b), hi = max(a,b), e = obstacle's elevation (its hex level):
   - e ≥ hi (and a ≠ b) or e = a = b → blocks normally.
   - lo ≤ e < hi → blocks only if the obstacle is in the intervening hex adjacent to the lower end (this is the
     "one blind hex" behind a lower Woods/Building, T88.4.1, and the mirror case of a same-level obstacle next to a
     lower viewer looking up, S1 T88.4.1 second example).
   - e < lo → never blocks.
   Blaze always blocks regardless of elevation. Only Woods and Buildings are listed as creating blind hexes; hexside
   Obstacles use the same elevation test with the hexside's elevation = higher adjoining hex (R-21).
6. **Hindrances vs elevation (T88.5):** printed Hindrance terrain that sits below a hill end of the LOS is ignored for
   that LOS; Hindrance terrain on a hill counts between hill hexes of its own level. Smoke counts at every elevation.
   Rule used: a mapboard Hindrance of level h applies only if h ≥ hi.
7. **Gully (T86):** LOS to or from a unit in a Gully exists only if the other hex is adjacent or higher.

## §11 Weapons (rulebook 11)

- **Effects (11.1):** Weapons have FP, Range (boxed or not) and may have a Movement penalty (red number) applied to the
  carrying unit's Movement. A Weapon is activated whenever its carrier is. Only an unbroken, unsuppressed carrier can
  fire it; it fires alone or in a Fire Group (non-Ordnance only), at the same or a different hex from its carrier.
- **Portage (11.2):** one Weapon per unit. A Weapon bought with a unit from a Support Table must start with that unit.
- **Transfer and removal (11.3):** transfer costs 1 MP during a Move (§O21.1.1). The owner may voluntarily eliminate a
  Weapon at any time. If the carrier is eliminated or exits, the Weapon goes with it (exit) or to the Casualty
  Track's Weapons box (elimination). When a Squad Deploys, one of the new Teams keeps the Weapon.
- **Broken Weapons (11.4):** broken side shows a Fix range and an Elim range. On every Random Hex determination, compare
  the hex number to every broken Weapon (both sides) *before* the Sniper/Event effect: in Fix range → flip unbroken
  (usable at once); in Elim range → eliminate (to Weapons box); else stays broken. Breaking an already-broken Weapon
  eliminates it.
- **Ordnance (11.5):** white band. Targeting roll first; never in a Fire Group; never Op Fire; no Leader bonus. The
  carrier may still fire its own FP normally (alone or in groups).
- **Specialised (11.6):** Flamethrower (and Molotov Cocktail if any) sets the target's Cover to 0, unmodifiable.
  Satchel Charge (and Molotov) is one-use: eliminate it right after it makes a Fire Attack Roll; a missed Targeting
  roll does not use it up (S6 Track Display data box).
- **Water/Wire:** no Weapon may fire from a Marsh or Stream hex (T89, T95) or from a hex containing Wire (F106.3).
- Mortars have a minimum range (written "2-13", "2-14", "2-16", "3-16" = min–max).

## §12 Radios (rulebook 12)
A Radio is an off-map battery (FP 8–13), kept in its owner's Artillery Box, max one per player. It is not a Weapon
(Jammed! never affects it). Some Radios can fire Smoke ("Smoke" on the counter). Use: §O17, §O18. An eliminated Radio
returns to the counter mix (not the Casualty Track).

## §13 Suppression (rulebook 13) and Veteran (E44.1)
- **Suppressed** comes from a tie on a Fire Defense roll (non-moving unit), a tie on a Rally roll, a tie on a Rout roll,
  and the Cower, Interdiction and Suppressing Fire Events. Effect: −1 FP, −1 Range, −1 Movement, −1 Morale; Command
  unchanged; the unit cannot fire its Weapon (it may fire its own FP). Max one per unit.
- Removal only: at the start of a Recover Order (all of that player's), on elimination, on exit. A Suppressed Squad that
  Deploys passes it to one of the two Teams.
- **Veteran:** +1 FP, +1 Range, +1 Movement, +1 Morale; Command unchanged. Removed only by elimination or exit. On
  Deploy one Team keeps it. (Series precedent S7: if a Squad has several markers they may be split between the Teams.)

---

## Part C — Orders (rulebook O14–O23)

Order mix per deck (S4 manifests):

| Order | Germany | America | Russia |
|---|---|---|---|
| Fire | 18 | 20 | 18 |
| Move | 12 | 12 | 13 |
| Rout | 10 | 9 | 9 |
| Recover | 9 | 8 | 9 |
| Command Confusion | 8 | 7 | 8 |
| Artillery Request | 8 | 9 | 6 |
| Advance | 5 | 4 | 6 |
| Artillery Denied | 2 | 3 | 3 |
| **Total** | 72 | 72 | 72 |

## §O14 General (rulebook O14)
- **Activation (O14.1):** only the active player gives Orders. Reveal the card from hand, announce the Order, put the
  card in the discard pile. If the Order activates something, activate one player or one friendly unit that has not
  yet been activated this Turn. If that unit is a Leader it may activate any of the friendly non-Leader units in its
  Command Radius that are also not yet activated. Name all activated units before carrying out the Order.
- No Order without a card bearing that Order's name.
- **Completion (O14.2):** finish an Order (and all Actions that need it to be in effect) before announcing another
  Order or ending the Turn. You cannot interleave Orders.
- **Actions/Events during Orders (O14.3):** any number of legal Actions by either side; any number of triggered Events.
- **Must carry out (O14.4):** at least one activated unit must actually perform the Order. A Move Order requires at
  least one activated unit to cross a hexside into another hex: you cannot give a Move Order just to play Assault Fire,
  nor one in which no activated unit can afford to enter any hex (S7 precedent). Other activated units may stay put.

## §O15 Pass (rulebook O15)
See §5.3. "Passing" is the trigger for Demolitions and Hidden Unit (see R-14 for zero-card passes).

## §O16 Advance (rulebook O16)
- Each activated unit may enter one adjacent hex and stops there. MP and terrain costs are ignored. Enemy-occupied hexes
  may be entered. The inactive player may not Op Fire at Advancing units (but Mines attack them; Hidden Mines/Wire may
  be played on them).
- May: enter an enemy hex; exit off the enemy edge (VP, §7.2.1); cross a Cliff hexside if not carrying a Weapon.
- May not: enter an impassable hex (Blaze, Water Barrier); enter or leave a Major Bridge hex except across its
  road/rail hexsides; exit off a flank or own edge.
- Activated units need not all go to the same hex, and need not move together.

### §O16.4 Melee (rulebook O16.4)
- **When:** at the end of any Order or trigger after which a hex contains units of both sides. If a melee arises
  inside an Event, it is fought at the end of that Event, still inside it (no triggers possible) (S2 E42 note; S3
  E42). Several melee hexes: the active player picks the order, one at a time.
- **Ambush first (A25):** inactive player plays all his Ambush Actions for this melee, then the active player.
- **Strength (O16.4.1):** each side sums the *current* FP of its remaining units in the hex (Weapons excluded; Leader
  Command, Veteran, Suppressed, Wire and broken sides all count), +1 per unit with boxed FP = Melee FP. If one or both
  sides have no units left (Ambush), the melee is over and nothing else happens.
- **Rolls (O16.4.2):** inactive player rolls and adds to his Melee FP = Melee Total; then the active player. (Staggered
  so triggers and Initiative re-rolls can be handled after each.) If a trigger during a melee roll leaves one or both
  sides with no units in the hex, the melee is over and nothing else happens (FAQ). Melee FP is fixed once computed
  (R-24).
- **Result (O16.4.3):** lower total → all that side's participating units eliminated. Tie → both sides eliminated,
  unless one side began the melee in a Bunker or Pillbox hex (F101/F104: the side that last solely occupied that hex),
  in which case just the opposing side dies.
- Overstacking into a melee is legal; excess is removed at Turn end if any survive.

## §O17 Artillery Denied (rulebook O17)
Requires an enemy Radio in play. Break it; if already broken, eliminate it (back to counter mix). Nothing is activated.

## §O18 Artillery Request (rulebook O18)
Choose one:
- **Battery Access (O18.1):** only if you have a broken Radio: flip it unbroken. Nothing activated (so a second
  Artillery Request this Turn may Fire For Effect).
- **Fire For Effect (O18.2):** only if you have an unbroken Radio and an unbroken Leader not yet activated this Turn.
  Activate that Leader (the Spotter), then:
  1. **Spotting (O18.2.1):** place the SR in any hex in the Spotter's LOS (no range limit; impassable hexes allowed).
     If the Radio shows "Smoke" you may announce a Smoke barrage now (before Accuracy).
  2. **Accuracy (O18.2.2):** Targeting roll (product, §O20.2.3) against range Spotter→SR, reduced by the largest
     Hindrance on that LOS. Hit if the modified product > range.
     - *Hit:* reveal a card (not a roll: no triggers, no re-roll). Move the SR one hex in the white die's compass
       direction, then one hex in the coloured die's direction (may return to the original hex).
     - *Miss:* reveal a card (not a roll). Move the SR in the white die's direction a number of hexes equal to the
       coloured die.
     - *Off map:* if the SR leaves the map at any point, even briefly, remove it; the Order ends with no effect.
  3. **Impact (O18.2.3):** the SR's final hex and its six neighbours are the blast area (off-map neighbours ignored).
     - *Smoke barrage:* place one random Smoke marker in each of the seven hexes (skipping hexes that cannot hold Smoke:
       Water, Blaze — R-26). Remove the SR. Order ends.
     - *Barrage:* in an order chosen by the active player, each blast hex that contains at least one unit (either side)
       or a Fortification gets exactly one Artillery Impact Roll: Radio FP + roll = Impact Total, resolved like a Fire
       Attack (§O20.3.3–4) against every unit in the hex. Hindrance does not apply (already used in Accuracy). Woods
       Airburst +2 applies. Height modifiers do not apply (R-25). Jammed! has no effect; other triggers work normally.
     - *Fortification Vulnerability (O18.2.3.3):* if the Impact **roll** (dice sum, before adding FP) exactly equals the
       Radio's number, destroy the Fortification in that hex before any Defense rolls:

       | Radio FP | 8 | 9 | 10 | 11 | 12 | 13 |
       |---|---|---|---|---|---|---|
       | Roll needed | 12 | 11 | 10 | 9 | 8 | 7 |

     - Foxholes/Trench/Pillbox/Bunker give +1 Cover vs Artillery (and Mortars); Wall/Hedge Cover does not apply vs
       Artillery.

## §O19 Command Confusion (rulebook O19)
Cannot be played as an Order (dead card for Orders). The card may still be used for its Action (if any; some cards are
Command Confusion on both halves).

## §O20 Fire (rulebook O20)

### §O20.1 Announcement (rulebook O20.1)
A Fire Order (and an Op Fire activation) is legal only if at least one activated unit, or its Weapon, has an enemy unit
within both LOS and Range. Others activated with it need not.

### §O20.2 Ordnance and Targeting (rulebook O20.2)
- Ordnance must hit the target hex first; everything else skips straight to the Fire Attack.
- **Smoke rounds (O20.2.1):** a Weapon showing "Smoke" may instead place Smoke. It may then target any hex in its Range
  and LOS even without enemy units. Declare when choosing the hex, before rolling. A hit places one random Smoke
  marker there; no Fire Attack.
- **Range (O20.2.2):** count hexes from firer to target, counting the target but not the firer's hex. Beyond Range, or
  below a Mortar's minimum range → not allowed.
- **Targeting roll (O20.2.3):** multiply the two dice; subtract the largest Hindrance on the LOS; hit if the result is
  strictly greater than the range. (1×6=6 hits range ≤5; 6×6=36 hits anything in range; 1×1 always misses.) Event!,
  Sniper! and Time! triggers on a Targeting roll work; Jammed! does not. On a hit, make a normal Fire Attack Roll with
  the Weapon's FP (no Hindrance reduction).

### §O20.3 Fire Attack (rulebook O20.3)
- Each activated piece may fire once (alone or in one Fire Group) at a hex within its Range and LOS that contains at
  least one enemy unit (unless firing Smoke). A unit and its Weapon may fire separately at the same or different hexes.
- Units in intervening hexes are never affected.
- Every enemy unit in the target hex is attacked.

#### §O20.3.1 Fire Groups (rulebook O20.3.1)
- Two or more activated pieces may combine. Every piece needs LOS and Range to the target hex. If the pieces are in
  several hexes, those hexes must form a chain where each is adjacent to at least one other.
- Never: Ordnance; pieces in a Wire hex together with pieces outside that hex (F106.3).
- Optional: pieces may fire separately or in smaller groups.
- **Group FP (O20.3.1.2):** FP of one chosen piece (X) + 1 for each other firing piece (Y). The firer chooses X
  (normally the highest).

#### §O20.3.2 Hindrance (rulebook O20.3.2)
Non-Ordnance attack: subtract the largest Hindrance among the LOS lines of all firing pieces. FP ≤ 0 → shot not
allowed (the pieces may choose another target).

#### §O20.3.3 Fire Attack Roll (rulebook O20.3.3)
Attack Total = final FP + roll. Jammed! → all firing Weapons break (attack still resolves). Mortar/Artillery vs a
Woods hex: +2 to the Attack Total (Airburst, T99), even if a defender uses an alternate Cover (S7 precedent).

#### §O20.3.4 Fire Defense Roll (rulebook O20.3.4)
The defending player rolls separately for every unit that was in the hex at the moment of the Attack Roll, in any
order he likes (tip: roll Leaders last; a broken Leader's Command drops). All Defense rolls for one attack are made
before the next attack is announced. Defense Total = current Morale (incl. Command, Cover, Veteran, Suppressed, Wire)
+ roll:
- Defense < Attack → unit breaks (broken → eliminated).
- Defense = Attack → Suppressed, unless the unit is currently activated to Move (then it breaks instead).
- Defense > Attack → no effect.
A unit whose Morale guarantees survival still rolls (triggers can occur) (S4 example of play, end).

### §O20.4 Consolidated Fire Attack formula (engine) (rulebook O20.4)
For each firing piece p:
- unit FP(p) = printed FP (current side) + Σ Command of friendly Leaders in hex (Squads/Teams only) + Veteran(+1)
  − Suppressed(1) − Wire(1) [+ scenario modifiers].
- weapon FP(p) = printed FP + Σ Command of friendly Leaders in hex if the Weapon is non-Ordnance and carried by a
  non-Leader; Weapons are not affected by Veteran/Suppressed/Wire on the carrier (but cannot fire at all if the carrier
  is broken/suppressed or in Wire/Water).
- Range(p) is modified the same way (Leader Command, Veteran, Suppressed, Wire for units; Leader Command for non-Ordnance
  Weapons carried by non-Leaders).
Then: FP = max over chosen base + (number of other pieces) − largest Hindrance (non-Ordnance) + height (−1 if the
target hex is higher than any firing piece; +1 if lower than any firing piece; both can apply) + 2 per Bore Sighting /
Crossfire / Hand Grenades / Marksmanship / Sustained Fire played. Require FP ≥ 1. Attack Total = FP + roll
(+2 Airburst if Mortar/Artillery vs Woods) − Concealment reductions.

Defender Morale = printed Morale (current side) + Σ Command (Squads/Teams with friendly Leaders in hex) + Veteran −
Suppressed − Wire + Cover (§T78.3; Cover forced to 0 vs Flamethrower/Molotov and Mine attacks).

## §O21 Move (rulebook O21)
- Each activated unit gets MPs equal to its current Movement (Leader Command, Veteran, Suppressed, Weapon penalty, Road
  bonus all apply; recomputed continuously).
- **Costs (O21.1):** entering a hex costs its terrain Move Cost, plus hexside costs (Fence/Hedge/Wall +1), plus +1 for
  entering a higher-elevation hex. A unit may enter a hex only if its remaining MP ≥ the total cost (no
  minimum-move exception). Units unable to afford any hex must wait for Advance or Rout.
- **Weapon transfer (O21.1.1):** at any point, an activated moving unit may spend 1 MP to hand its Weapon to a friendly
  unit in the same hex that has none (receiver need not be activated). This is not a hex entry (no Op Fire).
- **Moving together (O21.2):** finish one unit's move before the next starts — except units activated in the same hex
  may move as one group, staying together for the whole Order. The group's reach is limited by its weakest member's
  current Movement; if one member breaks and can go no further, the group stops (R-27).
- **Op Fire (O21.3):** each time a unit/group enters a new hex (one MP expenditure, however large), the inactive player
  may Op Fire at that hex (§A33).
- **Restrictions (O21.4):** never enter an enemy-occupied hex, an impassable hex, cross a Cliff hexside, enter/leave a
  Major Bridge except along its road/rail hexsides, or leave by a flank or own edge. Exiting off the enemy edge costs
  1 MP (§7.2.1) and draws no Op Fire (no hex is entered).
- **Etiquette/timing (O21.5–O21.6, errata "must"):** after each MP expenditure, pause. The inactive player must play
  all the Actions he wants (Op Fire, Hidden Mines, Hidden Wire …) before the active player may play any (Smoke
  Grenades, Assault Fire …).
- Wire (F106.2), Trench (F105.2), Road (T93) and Snow (scenario 5) modify costs — see those sections.

## §O22 Recover (rulebook O22)
- Allowed only while the player owns one or more units that are broken, Suppressed or both, and only if no Recover or
  Rout has activated him yet this Turn. Activates the *player* (so at most one Recover per Turn); the affected units
  are not activated and can be activated for another Order the same Turn.
- Procedure: (1) remove every Suppressed marker from his units; (2) Rally roll for each of his units that was broken
  when the Order was announced (owner chooses order; units broken by Events during the Order don't roll).
- Rally roll vs current Morale (Command, Cover etc. included): roll < Morale → Rally; = → becomes Suppressed (stays
  broken); > → nothing.

## §O23 Rout (rulebook O23)
- The active player chooses a player (himself or the opponent) who has at least one broken unit and has not been
  activated this Turn for Recover/Rout. Activates that player. Max two Routs per Turn (one per player); Recover and a
  Rout on yourself exclude each other.
- **Rout roll (O23.2):** the player who played the Order rolls (his deck) for each of the chosen player's units that
  were broken at announcement, in the order he chooses. Roll vs current Morale: < → no effect; = → Suppressed (if not
  already); > → must Retreat (difference) hexes.
- **Retreat (O23.3):** the unit's owner moves it. Each hex entered must have fewer intervening hexes between it and the
  owner's friendly edge than the hex left. A unit already in the edge row that must still retreat goes off the map and
  is eliminated (§7.2.2). Terrain costs ignored (O23.3.1); no Op Fire (O23.3.2); Wire does not stop it (O23.3.3); Mines
  attack it entering and/or leaving Mine hexes (O23.3.4).
- **Forced elimination (O23.3.5):** if the only way to continue is off its own edge, into an enemy-occupied hex
  (surrenders), into an impassable hex, or across a Cliff hexside, the unit is eliminated.
- Retreating into overstacking is allowed (fixed at Turn end).

---

## Part D — Actions (rulebook A24–A41)

Action mix per deck (S4 manifests):

| Action | GER | US | RUS | Action | GER | US | RUS |
|---|---|---|---|---|---|---|---|
| Ambush | 6 | 6 | 6 | Hidden Mines | 1 | 1 | 1 |
| Assault Fire | 6 | 6 | 6 | Hidden Pillbox | 1 | 0 | 1 |
| Bore Sighting | 1 | 1 | 1 | Hidden Unit | 1 | 1 | 1 |
| Command Confusion | 1 | 2 | 0 | Hidden Wire | 2 | 2 | 2 |
| Concealment | 5 | 4 | 7 | Light Wounds | 5 | 6 | 8 |
| Crossfire | 8 | 8 | 8 | Marksmanship | 1 | 0 | 0 |
| Demolitions | 1 | 1 | 1 | No Quarter | 3 | 0 | 3 |
| Dig In | 4 | 4 | 4 | Smoke Grenades | 6 | 9 | 3 |
| Hand Grenades | 6 | 6 | 6 | Spray Fire | 6 | 6 | 6 |
| Hidden Entrenchments | 2 | 3 | 2 | Sustained Fire | 6 | 6 | 6 |

Plus Fire (Op Fire) on every "Order/Action Fire" card (18/20/18). FAQ: the American cheat card is wrong (3 Hidden
Entrenchments, no Hidden Pillbox is correct).

## §A24 General (rulebook A24)
- Play any time from hand when the prerequisite is met; several may answer the same situation; effects add up.
- **Timing (A24.2, errata "must"):** if both players want to act at the same moment, the inactive player plays *all*
  his Actions first, then the active player. (One round: R-12.)
- **No activation (A24.3):** Actions do not activate units, except Op Fire. Already-activated units can be the subject
  of any number of other Actions.

### Timing windows (engine checklist)
| Window | Who | Actions |
|---|---|---|
| Just before a Fire Attack Roll (incl. Op Fire, Assault Fire; Spray Fire chosen here) | firing player | Bore Sighting, Crossfire, Hand Grenades, Marksmanship, Spray Fire, Sustained Fire |
| Just before a Defense Roll (any of the rolls of one attack) | defending player | Concealment, Hidden Entrenchments (Defender), Hidden Pillbox (Defender) |
| The instant a friendly Squad would break | owner | Light Wounds |
| After each MP expenditure into a hex during an enemy Move | inactive, then active | Fire (Op Fire), Hidden Mines, Hidden Wire (inactive); then Smoke Grenades, Assault Fire (active) |
| After an enemy unit Advances into a hex | Defender | Hidden Mines, Hidden Wire |
| Any time while own units are activated to Move | active | Assault Fire, Smoke Grenades |
| Before melee dice | inactive all, then active | Ambush |
| After a melee is resolved | survivor's player | No Quarter |
| Opponent passes and discards ≥1 card | player | Demolitions, Hidden Unit (Defender) |
| End of a Time advance (step 6) | both | Dig In |
| After any roll, before its trigger/result | Initiative holder | re-roll (§9.1, not an Action) |

## §A25 Ambush (rulebook A25)
Prerequisite: before melee dice are rolled; inactive player plays all of his first. Effect: the opponent must choose one
of his units participating in that melee and break it. All Ambushes resolve before Melee FP. Both sides can be wiped
out by Ambushes (melee then ends).

## §A26 Assault Fire (rulebook A26)
Prerequisite: at least one unit activated to Move (or its Weapon) has boxed FP and an enemy unit in its current Range
and LOS. Effect: one Fire Attack by any or all activated-to-Move units/Weapons with boxed FP (may be a Fire Group),
following all normal Fire Attack rules. May be played before, during or after physical movement. Ordnance with boxed
FP (e.g. Satchel Charge, Flamethrower) may use it alone with its Targeting roll (R-15).

## §A27 Bore Sighting (rulebook A27)
Scenario Defender only (never Attack/Recon). Just before a Fire Attack Roll in which a firing Weapon has printed FP ≥ 5.
+2 FP.

## §A28 Command Confusion (rulebook A28)
Cannot be played as an Action.

## §A29 Concealment (rulebook A29)
Just before the defending player makes a Defense Roll. Reduce the Fire Attack Total by the Cover of the targeted hex
(after all Cover modifiers such as Road −1 or Fortification +1 vs Mortar/Artillery). With Spray Fire, the Cover of
either target hex may be used. The reduction applies to that attack's total for all remaining Defense rolls (S4 example,
Turn 3). Useless against Flamethrower/Molotov/Mines (Cover 0). See R-17 for negative Cover and alternate Cover.

## §A30 Crossfire (rulebook A30)
Just before a Fire Attack Roll that targets one or more Moving units (activated to Move). +2 FP.

## §A31 Demolitions (rulebook A31)
When the opponent passes and throws away at least one card (Fog of War / Interrogation losses don't count). Pick a hex
that holds a friendly unit and take one Fortification out of it.

## §A32 Dig In (rulebook A32)
Only at the end of a Time advance (step 6). Place Foxholes in a hex with a friendly unit; not Water, not Blaze, no other
Fortification there.

## §A33 Fire — Opportunity Fire (rulebook A33)
- **Prerequisite (A33.1):** during the opponent's Move Order, right after a moving unit/group spends MP to enter a new
  hex.
- **Procedure (A33.2):** the inactive player halts movement and may do either or both: (a) play Fire Action card(s), each
  activating one unit/Leader(+radius) as for a Fire Order (needs an enemy in LOS and Range, §O20.1); (b) make **one**
  Fire Attack on *the hex just entered*, using any units he has activated for Op Fire so far in this Move Order.
  Then movement continues.
- **Exceptions (A33.3):** Ordnance cannot Op Fire (its carrier can). Op-Fire-activated units stay activated and may fire
  again at later hex entries during this Move Order only; they cannot be activated again this Turn (a later Move Order
  needs fresh units). At most one Fire Attack per MP expenditure, but another unit entering the same hex later is a new
  expenditure.
- Tied Defense rolls break units activated to Move (§O20.3.4).
- No Op Fire against Advancing or Retreating units, nor into a hex entered by Trench-to-Trench movement (F105.2).

## §A34 Hand Grenades (rulebook A34)
Just before a Fire Attack Roll where at least one firing piece is adjacent to the target (multi-hex group: one hex
adjacent suffices). +2 FP.

## §A35 Hidden actions (scenario Defender only) (rulebook A35)
- **A35.1 Hidden Entrenchments:** just before the Defender makes a Defense Roll; the attacked hex is not a Building or
  Water hex and has no Fortification. Place Foxholes there (Cover counts for that roll on).
- **A35.2 Hidden Mines:** right after enemy units enter a hex by Move or Advance (Retreat does not count); the hex is not Water
  and has no Fortification. Place Mines and make a Mine Attack (§F103) against each unit that just entered (units
  already there are immune to this attack).
- **A35.3 Hidden Pillbox:** just before the Defender makes a Defense Roll against an attack on an Objective hex (for a
  building Objective, any hex of the building — R-18), provided the Pillbox has not entered play yet; not Water; no
  Fortification. Place the Pillbox.
- **A35.4 Hidden Unit:** when the opponent passes and discards ≥1 card (not Event discards). (1) roll on own Support
  Table (a normal roll; triggers apply — R-16); (2) choose one non-Radio item from that column available in the
  scenario year, free; (3) place it (with its Weapon) in any hex of the Defender's original setup area that has no units
  of either side and Cover ≥ 1.
- **A35.5 Hidden Wire:** right after enemy units enter, by Move or Advance (not Retreat), a non-Water hex without a
  Fortification. Place Wire. A moving unit there must stop (it already spent MP to enter; leaving costs all MP).

## §A36 Light Wounds (rulebook A36)
The instant a friendly Squad (broken or not) would break — not when eliminated outright (KIA, lost melee, overstack).
Lose 1 VP. Instead of breaking (or dying if already broken), the Squad returns to the counter mix and is replaced in the
same hex by a Team of the player's OB Troop Quality (FAQ: quality comes from the OB Stats, not the Squad's name),
taken from the counter mix (with none left, Light Wounds cannot be played: R-56).
The Team is broken if the Squad was; it keeps the Squad's Weapon, Suppressed and Veteran markers and its activation
status.

## §A37 Marksmanship (rulebook A37)
Just before a Fire Attack Roll that includes a firing Squad or Team of the nationality printed on the card (only in the
German deck: German). +2 FP.

## §A38 No Quarter (rulebook A38)
After a melee, if at least one of the player's participating units is still alive. Playable by the German player only against
Russia, and by the Russian player against anyone. +2 VP.

## §A39 Smoke Grenades (rulebook A39)
For a unit with boxed Movement that is currently activated to Move. Draw a random Smoke marker and put it in that unit's
hex or a hex next to it (not Water, not Blaze). Smoke into Smoke: keep the larger.

## §A40 Spray Fire (rulebook A40)
Just before a Fire Attack Roll. All firing pieces have boxed Range. Two target hexes, adjacent to each other, each within
Range of every firing piece and each containing an enemy unit; LOS checked from every piece to both hexes. One Attack
Roll; every unit in both hexes defends against that single total (each with its own Cover). Not cumulative (always
exactly 2 hexes). Modifier details: R-19.

## §A41 Sustained Fire (rulebook A41)
Just before a Fire Attack Roll to which a Mortar or an MG (Light/Medium/Heavy/.50 cal) contributes. +2 FP. If the roll
shows doubles, one firing Mortar/MG (firer's choice) breaks — cumulative with other Sustained Fires and Jammed! (a
Weapon can break twice and be eliminated).

---

## Part E — Events (rulebook E42–E77)

Event mix per deck (S4 manifests):

| Event | GER | US | RUS | Event | GER | US | RUS |
|---|---|---|---|---|---|---|---|
| Air Support | 2 | 3 | 2 | Infiltration | 1 | 0 | 2 |
| Battle Harden | 5 | 5 | 3 | Interdiction | 6 | 6 | 6 |
| Battlefield Integrity | 2 | 2 | 2 | Interrogation | 3 | 3 | 3 |
| Blaze | 6 | 0 | 0 | KIA | 1 | 1 | 1 |
| Booby Trap | 1 | 1 | 1 | Malfunction | 1 | 1 | 1 |
| Breeze | 6 | 6 | 6 | Medic | 1 | 1 | 1 |
| Command & Control | 2 | 2 | 2 | Mission Objective | 1 | 1 | 1 |
| Commissar | 0 | 0 | 4 | Prisoners of War | 2 | 2 | 4 |
| Cower | 2 | 2 | 4 | Reconnaissance | 2 | 2 | 2 |
| Deploy | 3 | 3 | 0 | Reinforcements | 2 | 3 | 1 |
| Dust | 1 | 1 | 1 | Rubble | 1 | 1 | 1 |
| Élan | 2 | 2 | 2 | Sappers | 2 | 2 | 2 |
| Entrench | 0 | 0 | 4 | Scrounge | 1 | 2 | 1 |
| Field Promotion | 1 | 1 | 1 | Shell Shock | 1 | 1 | 1 |
| Fog of War | 1 | 2 | 3 | Shellholes | 1 | 1 | 1 |
| Hero | 5 | 5 | 2 | Strategic Objective | 1 | 1 | 1 |
| | | | | Suppressing Fire | 3 | 3 | 3 |
| | | | | Walking Wounded | 3 | 3 | 3 |
| | | | | White Phosphorus | 0 | 3 | 0 |

(Each column sums to 72. Breeze cards each print their own wind direction 1–6 — per-card data, not in S4's manifest.)

## §E42 General (rulebook E42)
- Events happen only through Event! triggers: reveal the next card, read and perform its Event.
- Do what is possible, skip what is impossible.
- Multi-part Events are done in the printed order.
- No die roll made during an Event can trigger anything.
- A melee created by an Event is fought at the end of (still inside) that Event (S2, S3).
- "Receiving player" = the player who rolled the Event! trigger (it is his deck). He makes all choices unless the
  Event names someone else.
- Strict reading (S1 p.3): "a unit" means any side's unless the text says friendly/enemy.
- Anything an Event brings into play must be taken from pieces not yet used; pieces sitting on the Track Display count as
  being in play
  (FAQ "Counter Mix Limits"). If none is available, that part does nothing. How many of each counter exist: R-56.

## §E43 Air Support (rulebook E43)
Determine a Random Hex. If it has units, the receiver may break all units there (all sides). If empty, use the nearest
hex (by hex distance) holding any unit; receiver breaks all units there if he wishes. Ties: receiver picks.

## §E44 Battle Harden (rulebook E44)
Receiver must put a Veteran marker on one of his units that lacks one (§13).

## §E45 Battlefield Integrity (rulebook E45)
Receiver scores 1 VP for each enemy unit on the Casualty Track.

## §E46 Blaze (rulebook E46)
Random Hex. If it is not Water and has no Blaze: place a Blaze; remove any Smoke and Fortification there; every unit
there is moved by its owner (inactive player first) to an adjacent hex that is not impassable (with Weapon); a unit with
no such hex is eliminated (see R-34 for enemy-occupied/overstacked destinations).

## §E47 Booby Trap (rulebook E47)
Random Hex; if not Water and no Blaze or Fortification: place Mines. Units already there are only attacked when they
later Move/Advance/Retreat out.

## §E48 Breeze (rulebook E48)
Remove all Smoke from the map. Then put a Blaze in every non-Water hex that is adjacent to an existing Blaze and lies in
the card's downwind direction (1–6, map compass) from it (spread only from Blazes existing before this Event). Units
in such hexes are displaced as in §E46 (or eliminated). Fortifications and Smoke there are removed (§8.1.5).

## §E49 Command & Control (rulebook E49)
Receiver gains VP equal to the number of Objectives he controls.

## §E50 Commissar (rulebook E50)
The Russian player must pick one of his broken units and roll for it: roll > Morale → eliminated; roll ≤ Morale →
Rally. (Only in the Russian deck.)

## §E51 Cower (rulebook E51)
Receiver must Suppress each of his Squads (not Teams/Leaders), broken or not, that is not already Suppressed and is
outside the Command Radius of every friendly Leader (using the Leader's current Command).

## §E52 Deploy (errata: "receiving") (rulebook E52)
Receiver may pick one of his Squads on the map: replace it with two Teams of his OB Troop Quality, from the counter mix
(fewer than two left: no Deploy, R-56). Teams are broken if
the Squad was; only one Team keeps each of its Weapon/Suppressed/Veteran markers (S7 precedent: may split between
Teams); both Teams count as the same unit — same activation status, and any pending result against the Squad
(suppress, break, eliminate) applies to both.

## §E53 Dust (rulebook E53)
Random Hex; if not Water and no Blaze: place a random Smoke.

## §E54 Élan (rulebook E54)
Receiver moves his own Surrender marker one space higher (one more casualty needed to surrender).

## §E55 Entrench — Russian deck only (rulebook E55)
Receiver may place Foxholes in any non-Water hex he occupies that has no Fortification.

## §E56 Field Promotion (rulebook E56)
If his Private is not on the map, the receiver may place it in a hex holding one of his broken units.

## §E57 Fog of War (rulebook E57)
Each player picks one card at random from the other player's hand; both cards go to their owners' discard piles.
(Not a "pass" discard.)

## §E58 Hero (rulebook E58)
If the receiver's Hero is not on the map he must place it in any friendly hex (§G), then may Rally one broken unit in
that hex. A unit that is only pending a break (e.g. tied while moving, trigger still resolving) is not yet broken and
cannot be rallied by it (S4 example, Turn 7).

## §E59 Infiltration (rulebook E59)
(1) roll on own Support Table; (2) choose one non-Radio item from that column, available in the scenario year, free;
(3) Random Hex; (4) place the unit (+Weapon) in or adjacent to that hex: stacking observed, not impassable. (Rolls
inside Events never trigger.)

## §E60 Interdiction (rulebook E60)
Receiver must Suppress one unsuppressed unit (any side, broken or not) in a hex whose Cover is less than 1 (R-36).

## §E61 Interrogation (rulebook E61)
Opponent shows his whole hand; receiver may pick one card, which goes to the opponent's discard pile.

## §E62 KIA (rulebook E62)
Receiver must eliminate one broken unit (any side). (Light Wounds cannot save it.)

## §E63 Malfunction (rulebook E63)
Random Hex; the unbroken Weapon (any side) nearest to it breaks. Ties: receiver picks. Radios are not Weapons.

## §E64 Medic! (rulebook E64)
Receiver must Rally one broken unit (any side).

## §E65 Mission Objective (rulebook E65)
Receiver draws one random Objective chit as an extra secret objective (kept secret unless it has no secret side, then
it is placed open). Adds to, never replaces, existing chits.

## §E66 Prisoners of War (rulebook E66)
Receiver must eliminate one of his own broken units that is in or adjacent to a hex with an enemy unit.

## §E67 Reconnaissance (rulebook E67)
The opponent must reveal one of his unrevealed secret chits (his choice), if any; it becomes open and scores at once.

## §E68 Reinforcements (rulebook E68)
(1) roll on own Support Table; (2) pick one item available in the scenario year, free (Radios allowed); (3) a Radio goes
to his empty Artillery Box (fails if occupied); a unit (+Weapon) goes in any hex along his friendly edge, stacking
observed, not impassable.

## §E69 Rubble (rulebook E69)
Random Hex; if not Water and no Blaze/Fortification: place Wire.

## §E70 Sappers (rulebook E70)
Receiver may take a single Mines or Wire marker off the map.

## §E71 Scrounge (rulebook E71)
Receiver may take one eliminated Weapon (any side) from the Casualty Track and give it to one of his units that has no
Weapon (it returns unbroken — R-37).

## §E72 Shell Shock (rulebook E72)
Random Hex; the unit (any side) nearest to it breaks. Ties: receiver picks.

## §E73 Shellholes (rulebook E73)
Random Hex; if not Water and no Blaze/Fortification: place Foxholes.

## §E74 Strategic Objective (rulebook E74)
Draw a random Objective chit and place it open in the centre; score it at once for current controllers.

## §E75 Suppressing Fire (rulebook E75)
Receiver may Suppress one enemy unit that has no Suppressed marker yet, if one of his unbroken MGs — held by a friendly
unit that is neither broken nor suppressed — has that unit in LOS and within its current Range.

## §E76 Walking Wounded (rulebook E76)
Receiver must: pick one eliminated unit (any side) on the Casualty Track; Random Hex; place that unit broken in or
adjacent to that hex (stacking observed, not impassable). VP already scored stay (R-38). Its Casualty space becomes
empty.

## §E77 White Phosphorus — American deck only (rulebook E77)
Receiver may draw a random Smoke and put it next to any unbroken Squad of his, in a hex that is not Water and has no
Blaze. If he does, each player with units in that hex must break one of his own units there.

---

## Part F — Terrain (rulebook T78–T99) and the Terrain Effects Chart

## §T78 General (rulebook T78)
- **Types vs features (T78.1):** each hex has one terrain *type* (green rows on the chart; the highest row present in
  the hex wins, so a hex where a Major Bridge spans a Stream counts as a Bridge hex, not Water). *Features* (tan rows:
  Road, Railway, Trail, hexside Fence/Hedge/Wall, Hill, Cliff, Smoke, Blaze) modify the type.
- **Move Cost (T78.2):** MP to enter the hex or cross the hexside.
- **Cover (T78.3):** always added to the Morale of every unit in the hex, for every purpose (Defense, Rally, Rout,
  Commissar...). Never cumulative: if several Covers are available (terrain, Fortification, Wall/Hedge vs a shot across
  it) the owner uses the single best one.
- **LOS (T78.4):** Obstacle / Hindrance (number) / Clear.

## §T-TEC Terrain Effects Chart (S1 T79–T99 + S5)

Type hierarchy, top wins: Building > Woods > Brush > Orchard > Field > Bridge (Major/Minor) > Gully > Water Barrier >
Stream > Marsh > Open Ground.

| Terrain | Kind | Move cost | Cover | LOS | Special rules |
|---|---|---|---|---|---|
| Building | type | 2 | 3 | Obstacle; one blind hex | Multi-hex building Objective = whole building (T82, 7.3.1.1). Hidden Entrenchments not allowed. |
| Woods | type | 2 | 2 | Obstacle; one blind hex | Airburst: Mortar or Artillery attack on a Woods hex: Attack Total +2. |
| Brush | type | 2 | 1 | Hindrance 3 | |
| Orchard | type | 1 | 1 | Hindrance 2 | |
| Field | type | 1 | 0 | Hindrance 1 | |
| Major Bridge | type | Impassable, or 1 if moving along the road/railway | 2 | Hindrance 1 | Spans whole hex(es). Enter/leave only via its two road/rail hexsides (also for Advance). Road usually makes net Cover 1. Not Water. |
| Minor Bridge | type | 1 if crossing a road/rail hexside; else the other terrain's cost | 2 | Hindrance 1 | Lies within one hex. |
| Gully | type | 2 | 1 | Clear | LOS to/from a unit in a Gully only from adjacent hexes or from higher elevation. |
| Water Barrier | type (Water, impassable) | Impassable | n/a | Clear | No unit, Blaze, Smoke or Fortification may ever be there (SR may land there). |
| Stream | type (Water) | 3 | −1 | Clear | No Weapon may fire from it; no Blaze/Smoke/Fortification. |
| Marsh | type (Water) | 3 | 0 | Hindrance 1 | No Weapon may fire from it; no Blaze/Smoke/Fortification. |
| Open Ground | type | 1 | 0 | Clear | Scenario 5 Snow: 1.5. |
| Road | feature | 1 if the unit crossed a road hexside to enter; else other terrain | −1 to whatever Cover the hex gives (Open Ground + Road = −1) | Clear if the LOS runs along the road depiction; else per other terrain | +1 Movement for the rest of the Move Order once the unit has entered any road hex (by any hexside). |
| Railway | feature | 1 if crossing a railway hexside; else other terrain | per other terrain | Hindrance 1, or Clear along the railway depiction | No Movement bonus. |
| Trail | feature | 1 if crossing a trail hexside; else other terrain | per other terrain | per other terrain | No Movement bonus; no Cover change. |
| Fence | hexside | +1 to cross | none | Hindrance 1; Clear if it is a side of the sighting or target hex | |
| Hedge | hexside | +1 to cross (scenario 2 Bocage: +2) | 1 vs a Fire Attack whose LOS crosses it into the target hex; not vs Mortars/Artillery (Bocage: 2) | Obstacle; Clear if a side of the sighting or target hex | |
| Wall | hexside | +1 to cross | 2 vs a Fire Attack crossing it into the target hex; not vs Mortars/Artillery | Obstacle; Clear if a side of the sighting or target hex | |
| Cliff | hexside | Impassable for Move/Retreat; an Advancing unit with no Weapon may cross | none | Clear | Retreat across it = elimination. Upper hex is a Crest hex (FAQ CC:M). |
| Hill (levels 1–4) | feature | +1 to enter a higher-level hex (once per hex, regardless of levels) | per other terrain | §10.4 | Height advantage ±1 FP (T88.2). |
| Smoke | marker | per other terrain | per other terrain | Hindrance 1–10 (printed), into, out of and through, whole hex incl. hexsides, at any elevation | One per hex (largest stays). Not in Water/Blaze. |
| Blaze | marker | Impassable | n/a | Obstacle at all elevations, whole hex | No units or other markers may share the hex. Not in Water. |

Fortifications (alternate Cover, §F) also act as terrain: Foxholes 3 (4 vs Mortar/Artillery), Trench 4 (5), Pillbox 5
(6), Bunker 6 (7); Wire −1 FP/Range/Morale to occupants; Mines attack movers.

### §T88 Hills — non-LOS parts (rulebook T88.1–T88.2)
- **Uphill (T88.1):** +1 MP to enter a hex of higher elevation than the one left (downhill free).
- **Height advantage (T88.2):** Fire Attack −1 FP if the target hex is higher than any one firing piece; +1 FP if the
  target hex is lower than any one firing piece (both can apply in a mixed group). Not for Artillery (R-25).
- LOS rules: §10.4.

### §T93 Road cover detail (rulebook T93)
Any Cover in a hex containing a Road (terrain or Fortification) is reduced by 1: Building+Road = 2; Foxholes in an
Open Ground road hex = 2 (Morale 7 → 9). Applies also to the alternate Wall/Hedge Cover of that hex (R-20).

---

## Part G — Fortifications (rulebook F100–F106)

## §F100 General (rulebook F100)
- Six kinds: Foxholes, Trenches, Mines, Wire, Bunkers, Pillbox (one Pillbox in the mix; the other counts: R-56).
- Enter play at setup, or by Actions/Events (Dig In, Hidden *, Entrench, Shellholes, Booby Trap, Rubble).
- Removed only by Events (Blaze, Breeze spread, Sappers), Demolitions, or Artillery Impact (Fortification
  Vulnerability).
- One per hex; never in Water (Marsh/Stream/Water Barrier without a Bridge); never with Blaze.
- Fortification Cover is an *alternate* Cover: not added to terrain Cover; the defender picks the best (§T78.3).

## §F101 Bunker (rulebook F101)
Alternate Cover 6 (7 vs Mortars and Artillery). Melee tie: the side that was last sole occupant of the hex wins.
Occupants may join multi-hex Fire Groups (rules are silent; the CC:M-era Track Display box says otherwise; the VASSAL
maintainers' errata follows the rulebook — R-22).

## §F102 Foxholes (rulebook F102)
Alternate Cover 3 (4 vs Mortars and Artillery).

## §F103 Mines (rulebook F103)
- A Mines hex attacks every unit of either side entering or leaving it by Move, Advance or Retreat. Units moving together
  are attacked with one roll; otherwise each unit separately, on entering or when about to leave. Units already in the
  hex when someone else enters/leaves are not attacked.
- Strength: 6 FP by default; 7 or 8 if the scenario/RSG gives the Defender that Minefield value (marker on the Track
  Display).
- Cover is fixed at 0, unmodifiable. Attack Roll by the mover's opponent, Defense Rolls by the mover; resolve as a Fire
  Attack (only the entering/leaving units defend). Ties: moving units (activated to Move) break; Advancing/Retreating
  units are Suppressed. Jammed! has no effect (Mines are not Weapons).
- A unit broken while leaving a Mines hex still arrives in the hex it was entering.

## §F104 Pillbox (rulebook F104)
Alternate Cover 5 (6 vs Mortars and Artillery). Melee tie rule as Bunker. Fire Group note as Bunker.

## §F105 Trench (rulebook F105)
Alternate Cover 4 (5 vs Mortars and Artillery). Moving between adjacent hexes each containing a Trench, Bunker or
Pillbox (at least one Trench involved: Trench↔Trench/Bunker/Pillbox) costs exactly 1 MP regardless of terrain,
hexsides and elevation (a Cliff still cannot be crossed), and the unit cannot be Op Fired in the hex entered.

## §F106 Wire (rulebook F106)
- Units in a Wire hex: −1 FP, −1 Range, −1 Morale (Command unchanged).
- Movement: a Moving unit loses all remaining MPs right after entering or leaving a Wire hex (so starting in Wire, it can
  move exactly one hex). Advance and Retreat ignore this.
- Fire: a Fire Group may not mix pieces inside and outside a Wire hex; Weapons in a Wire hex cannot fire at all.

---

## Part H — Setup procedure (Playbook HS) — summary
Details and per-scenario data: `design/scenarios-reference.md`.
1. Choose sides (coin flip in the paper game; in the app, the human chooses).
2. Gather each side's FORCES (counts per counter) and place Surrender markers on the listed Casualty spaces.
3. Lay out the map in the listed orientation; form the Objective-chit cup and the Smoke/Blaze cup.
4. Year marker; VP marker (start value already includes listed open chits; adjust for randomly drawn *open* chits
   according to who controls that Objective at start); Time and Sudden Death markers; OB Stats (quality/orders);
   postures and Initiative holder.
5. Objective chits: remove any chits the special rules exclude; place listed open chits; draw random open chits; each
   side draws its random secret chit(s) (no-secret-side chits go open). "none" = no draw.
6. Objective control markers; setup order and depth (rows counted from own edge, inclusive); special rules.
7. Deploy forces (stacking observed).
8. Shuffle Fate decks; draw opening hands (6/5/4 by posture).
9. First Turn per the SET UP box / special rules.

## Part I — Nationality differences (base game)

| Aspect | Germany | America | Russia |
|---|---|---|---|
| Discard capability | 6 (whole hand in any posture) | 5 | 3 |
| Typical Leader:Squad ratio | 1:3 | 1:4 | 1:5 |
| Fate-deck Random Hex rows | odd (1,3,5,7,9) | even | even |
| Trigger counts (Event/Sniper/Jammed/Time) | 10/7/2/2 | 12/6/2/2 | 8/8/4/2 |
| Unique / notable cards | Blaze Event ×6, Marksmanship ×1, No Quarter ×3 (only vs Russia), one extra Rout | Smoke Grenades ×9, White Phosphorus ×3, Fire ×20, no No Quarter, no Hidden Pillbox | Commissar ×4, Entrench ×4, No Quarter ×3 (vs anyone), Light Wounds ×8, Concealment ×7, extra Move/Advance |
| Unit style (design notes) | average-to-good, mostly boxed stats; best MGs; SS squad strongest unit | higher FP/Range, lower unbroken Morale, good broken Morale, boxed FP (Assault Fire, melee +1) | higher Morale, lower Range; big OBs |
| Leader Table year modifiers | +1 (1939–43), 0 (1944), −1 (1945) | −1 (1943), 0 (1944), +1 (1945) | −2 (39–40), −1 (41), 0 (42–43), +1 (44–45) |

Unit, Weapon, Leader and card data (exact stats, Fix/Elim ranges, card-by-card lists) are data files, not rules — see
the VASSAL survey (`design/vassal-survey.md`, `design/data/`) and the S4 manifests.

---

## Part J — Engine checklists

### §J.1 Who rolls what (always from the roller's own deck)
| Roll | Roller | Can trigger? |
|---|---|---|
| Targeting (Ordnance), Artillery Accuracy | firing player | Event/Sniper/Time yes; Jammed no |
| Fire Attack | firing player | all four (Jammed breaks firing Weapons) |
| Artillery Impact | requesting player | yes; Jammed no effect |
| Mine Attack | mover's opponent | yes; Jammed no effect |
| Fire Defense | owner of the defending unit | yes; Jammed no effect |
| Melee | each side, inactive first | yes; Jammed no effect |
| Rally | owner | yes |
| Rout | player who played the Rout Order | yes |
| Hidden Unit Support Table roll | Defender | yes (R-16) |
| Sudden Death | Time-advance triggering player | no (inside a trigger) |
| Commissar, Infiltration, Reinforcements rolls | receiver | no (inside an Event) |
| Artillery drift, Random Hex, Event reveals | — | not rolls (but can exhaust the deck → Time) |
| RSG/Leader Table rolls (pre-game) | as stated | no (R-39) |

### §J.2 Activation bookkeeping
- Per Turn: set of activated unit ids (Orders and Op Fire), Hero exempt; set of activated players (Recover/Rout).
- Op Fire activations are tied to the current Move Order for repeat firing; they stay "activated" for the rest of the
  opponent's Turn.
- Deployed Teams / Light Wounds Teams inherit activation status.

### §J.3 Things that happen "at the end of a Turn"
Overstack check (both players, free Deploy per hex), then refill (active player only).

---

## §20 Ambiguities, edge cases and rulings (project section; no rulebook equivalent)

Format: **R-nn — question.** Ruling. *Source / reasoning.*

**R-01 — Zero-card pass.** A player may pass and discard nothing. *FAQ (Glossary, 5, O15 changed to "any number").*

**R-02 — "may" vs "must" for reaction order.** After each MP expenditure, and whenever both players want to act, the
inactive player must play everything he wants first. *FAQ errata O21.6, A24.2.*

**R-03 — Deploy Event's player.** The receiving player (the one who drew the Event) deploys one of *his* Squads.
*FAQ errata E52.1; S3.*

**R-04 — Melee started by an Event.** Fought at the end of the Event, inside it: no triggers on its rolls. *FAQ E42;
S3 E42.*

**R-05 — Melee unit loss by a trigger during melee rolls.** If a side has no units left, the melee ends with no effect.
*FAQ O16.4.2.*

**R-06 — Ordnance and Hindrance.** Ordnance subtracts Hindrance from its Targeting roll only, never from its FP.
*FAQ O20.3.2; S1 10.3.1.*

**R-07 — Deck runs out during a trigger/Event.** The Time advance still happens immediately (reshuffle, SD roll, etc.),
then the interrupted resolution continues. *S1 6.1.2 (any reveal of the last card advances Time); S1 1.9.1 (such triggers wait for the advance).*

**R-08 — Initiative re-roll vs deck exhaustion.** If the cancelled roll's card was the last card, the Time advance it
caused stands; the re-roll is taken from the new pile. *Project ruling: the advance is caused by revealing the last
card, not by the roll's trigger (S1 6.1.2), and the re-roll decision comes after that advance (1.9.1 ordering).*

**R-09 — Initiative on non-rolls.** Random Hex reveals, Event reveals and artillery drift are not rolls and cannot be
re-rolled. *S1 O18.2.2 states drift reveals are not rolls; S1 9.1 only cancels die rolls.*

**R-10 — Initiative re-roll of the opponent's roll.** Allowed (any most-recent roll). *S4 example Turn 9.*

**R-11 — Sniper target.** The roller may break any one unit (either side) in or adjacent to the Random Hex, or decline.
*S1 1.9.1.3 names no side and makes the break optional; literal reading (S1 p.3). The AI will choose enemy units.*

**R-12 — How many rounds of reactions.** One round: inactive player plays all he wants, then the active player plays
all he wants; the inactive player does not get a second response at that same moment. A new game moment (e.g. the next
roll) opens a new window. *S1 A24.2/O21.6 (as errata'd). Project ruling on the "one round" detail.*

**R-13 — Fire Group height modifiers.** Both −1 and +1 can apply in one attack. *S1 T88.2 compares the target with each firing piece separately.*

**R-14 — Demolitions / Hidden Unit after a zero-card pass.** Not playable: they need the opponent to discard at least
one card while passing. *S1 A31 and A35.4 still require at least one discarded card; the FAQ changed only 5, O15 and the Glossary.*

**R-15 — Assault Fire with boxed-FP Ordnance (Satchel Charge, Flamethrower).** Allowed, firing alone with its Targeting
roll. *S1 A26 (all normal Fire rules apply; Ordnance just can't be grouped). Project ruling.*

**R-16 — Hidden Unit's Support Table roll.** It is an ordinary roll (made during an Action, not a trigger), so it can
trigger. *S1 1.9.1; S4 example Turn 5 shows it as a normal roll.*

**R-17 — Concealment with negative or hexside Cover.** Use the best Cover the defending units would actually use against
this attack (including Wall/Hedge if the shot crosses it, Fortification bonus vs Mortars/Artillery, Road −1). If that
Cover is negative, Concealment *raises* the total by that much (strict reading); the AI should not play it then.
*S1 A29 subtracts the target hex's Cover from the total; literal reading. Project ruling.*

**R-18 — Hidden Pillbox on a building Objective.** Any hex of a multi-hex building Objective counts as an Objective hex.
*S1 7.3.1.1 / T82 (the Objective is the whole building).*

**R-19 — Spray Fire modifiers.** One FP for both hexes: subtract the largest Hindrance found on any piece-to-hex LOS;
height modifiers are evaluated against the higher of the two target hexes for −1 and the lower for +1 (so both may
apply); Hand Grenades if any piece is adjacent to either hex; Crossfire if either hex holds a moving unit; Airburst
per hex is irrelevant (Mortars lack boxed Range). *S1 A40 is silent; project ruling, consistent with R-13.*

**R-20 — Road −1 and Wall/Hedge Cover.** The Road reduction applies to any Cover used in a road hex, including the
alternate hexside Cover. *S1 T93 lowers every other Cover source in a road hex by 1.
Project ruling for hexsides.*

**R-21 — Elevation of hexside Obstacles (Wall/Hedge) for hill LOS.** Treat the hexside as being at the higher of its two
adjoining hexes' levels. *Project ruling (rules silent).*

**R-22 — Bunker/Pillbox occupants in multi-hex Fire Groups.** Allowed. *S1 F101/F104 contain no such limit; the S6 data
box claims otherwise but the VASSAL maintainers' errata note on that same image follows the rulebook.*

**R-23 — Mine attacks and ties.** Tied Mine attacks break units *activated to Move* and suppress Advancing/Retreating
units. *S1 O20.3.4 applied via F103.2.*

**R-24 — Melee FP after triggers.** Melee FP is computed once (after Ambushes) and not recomputed if a trigger during the
melee rolls breaks a participant; only "no units left" ends the melee. *S7 19.2.2 (series precedent, explicit); S1
silent.*

**R-25 — Height advantage and Artillery.** Not applied to Artillery Impact (the battery is off-map). Applied to Mortar
and other Ordnance Fire Attacks after a hit. *S7 precedent ("attacks made by radios… are not affected"); S1 T88.2 speaks of
firing pieces.*

**R-26 — Smoke barrage hexes that cannot hold Smoke.** Skip Water, Blaze and off-map hexes. *S1 T89/T95/T98, 8.1.5.*

**R-27 — Group movement after a member breaks.** The group cannot split; it may continue only while every member can pay
the next hex. *S1 O21.2: a group stays together for the whole Order, and a broken member normally halts it.*

**R-28 — Moving-unit tie on units that already finished moving.** Any unit currently activated to Move (moved, moving or
not yet moved) breaks on a tie. *S1 O20.3.4 wording.*

**R-29 — Op Fire on exit or weapon transfer.** Neither enters a hex, so no Op Fire opportunity. *S1 A33.1 ties Op Fire to the MP spent on entering a hex.*

**R-30 — Exited unit's Time Track space.** RAW allows any space; a space at or behind the Time marker means the unit
never returns. The app offers only spaces ahead of the Time marker (choosing a passed space is pointless).
*S1 7.2.1; project UX ruling.*

**R-31 — Passing through an Objective.** Control flips whenever a unit enters an Objective hex that holds no enemy unit,
even mid-move, and stays with that side after the unit leaves. *S1 7.3.1 (control goes to the latest sole occupant); S4
example Turn 13.*

**R-32 — Last unit on the map with reinforcements still on the Time Track.** The rule speaks of units on the map: that
player loses (case 2) even with reinforcements pending. *S1 6.3 strict reading.*

**R-33 — Reinforcement placement into enemy-occupied edge hexes.** Allowed by RAW (only stacking and impassable terrain
restrict it); a melee follows at the end of the Time advance (a trigger). *S1 6.1.2; S1 O16.4 starts a melee after any Order or die trigger that mixes the sides.
Project ruling; the AI should avoid it unless favourable.*

**R-34 — Blaze displacement destinations.** Any adjacent non-impassable hex, even one with enemy units (melee at the end
of the Event) or one that becomes overstacked (fixed at Turn end). *S1 E46/E48 restrict only impassable; FAQ E42 melee
timing.*

**R-35 — Breeze chaining.** Spread only from Blazes that existed when the Event began (no chain reaction in one Event).
*Project ruling; one-hex spread per Event per S1 E48 wording.*

**R-36 — Interdiction "Cover less than 1".** Use the best Cover available in the hex itself (terrain +
Road adjustment, Fortification), ignoring hexside Cover. Mandatory if any eligible unit exists. *Project ruling.*

**R-37 — Scrounged Weapon state.** Weapons on the Casualty Track are unbroken (7.2.2 places them unbroken), so a
scrounged Weapon arrives unbroken. *S1 7.2.2, E71. (CC:P changed this to broken; not adopted.)*

**R-38 — Walking Wounded VP.** VP already scored for the elimination are not refunded. *S1 E76 silent; project ruling.*

**R-39 — Rolls before play starts (RSG, Leader Table).** No triggers; no Initiative re-rolls (the card isn't assigned
yet). *Project ruling; the app may simply use RNG with 2d6 distribution.*

**R-40 — Casualty Track gaps.** Each new casualty fills the lowest empty space (7.2.2 "next empty space"), so removals
by Walking Wounded are refilled first. Equivalent engine model: surrender happens when the count of units on the
player's track reaches his Surrender number (Élan raises that number by 1). *S1 4.2, 7.2.2, E54, E76.*

**R-41 — End-of-Turn order.** Stacking enforcement before hand refill. *Project ruling (no rolls involved, order only
matters for deck-exhaustion reinforcements, which must obey stacking anyway).*

**R-42 — Equal Smoke values.** If a placed Smoke equals the one present, keep the one present (return the new one).
*Project ruling.*

**R-43 — Hidden Mines/Wire on own units.** Only after *enemy* units enter. *S7 states it for enemy units; sensible reading
of S1 A35.2/A35.5.*

**R-44 — Fire at units in a hex where a melee is pending.** Cannot happen in CC:E: melee resolves at the end of the
Order/trigger that created it, so no hex stays mixed across Orders. (Do not import CC:P melee markers.)

**R-45 — Broken Leader activating and boosting.** A broken Leader uses its broken-side Command for radius and bonuses
(often 0: own hex only, no bonus). Leader VP use the unbroken side. *S1 3.3, 7.1, O20.3.4 box.*

**R-46 — Suppressed Leader as Spotter.** Allowed (CC:E requires only "unbroken"). *S1 O18. CC:P adds "unsuppressed" —
not adopted.*

**R-47 — Air Support/Sniper on own units.** Air Support breaks all units in the hex (including the receiver's own) if he
chooses to use it; it is all-or-nothing. *S1 E43.*

**R-48 — Overstack eliminations and Surrender.** They are eliminations: VP and Casualty Track apply, and can cause
Surrender (simultaneous surrender → Initiative holder wins). *S1 7.1, 8.2, 6.3.1.*

**R-49 — Reinforcement Radio when the box is occupied.** It is not placed (first Radio has precedence). *S1 8.1.2.*

**R-50 — Initiative tie in the RSG.** Equal Initiative numbers: decide by coin flip (rules silent). *Project ruling.*

**R-51 — Fire Order announced with no legal shot after all.** If at announcement some activated piece had an enemy in LOS
and Range, the Order is legal; pieces that end up with no legal shot (e.g. FP ≤ 0 after Hindrance) simply don't fire.
*S1 O20.1, O20.3.2.*

**R-52 — Units start a Move in Wire next to a road.** The Wire rule wins: they stop in the first hex entered regardless
of road/Leader bonuses. *S1 F106.2 example.*

**R-53 — Pending results on Deployed Teams.** If a Squad Deploys while a result is pending against it (e.g. an Event
mid-defense), the result applies to both Teams. *S1 E52.2.*

**R-54 — Light Wounds on a Squad broken by Ambush/Sniper/Air Support.** Allowed (it is breaking). Not allowed against
KIA, Prisoners of War, lost melee, overstack, or Retreat-off-map eliminations (outright eliminations). *S1 A36.*

**R-55 — A unit set up inside an Objective the other side controls (historical scenarios).** Control stays as the
scenario lists it until a unit *enters* an Objective hex free of enemy units; setting up is not entering. (RSG games
pass Objectives to sole occupants after set-up by RS.11.2 / RS.13: `SpecialRules.controlAfterSetup`.) *S1 7.3.1 strict
reading; project ruling. Found by the fuzzer on scenario 3.*

**R-56 — The counter mix.** The rules limit play by the counters in the box (§E42 and the FAQ "Counter Mix Limits":
whatever enters play comes from the unused mix; pieces on the map and on the Track Display are in play; RS.7 and RS.9
buy "countermix permitting"), but the box's mix is not public and the VASSAL module has none. One table,
`src/data/mix.json` (built from `design/data/counter-mix.json`; the counts are listed in design/data-notes.md), gives
how many there are:
- named Leaders, Heroes and Privates: 1 each; the Pillbox: 1 (§F100);
- every other counter type of a nation: the most any one base scenario uses (both sides, set-up and Time Track), the
  most any one RSG OB of the nation holds (year pieces included), or 1 if a Support Table offers it, whichever is
  largest;
- Elite / Line / Green Teams: that, plus one per Light Wounds Action and two per Deploy Event in the nation's deck;
- Fortification markers (no nation): the most any base scenario sets up (pre-placed included) or any one Fortification
  OB holds, plus the most that the Actions and Events of both decks of a base-game pairing place in one pass (a Scenario
  Defender Action in one deck only).

So in no base scenario does a Light Wounds, Deploy or Fortification card of the first pass through the decks find the
mix empty; later passes and big RSG purchases may. In play = anywhere but the mix: map, carried, staging, Time Track, Casualty Track, Weapons box, Artillery Box. Back to the mix
only by a rule: a Squad replaced by Teams (§A36, §E52), an eliminated Radio (§12) or Hero (§3.4), an exited Hero, a
Fortification taken off the map. When the mix lacks a counter: an Action that would bring it in cannot be played (Light
Wounds without a Team, Dig In and the Hidden Fortification Actions without a marker); Deploy (also the free one against
overstacking) needs two Teams, else no Squad can Deploy; an Event whose only effect is placing a marker does nothing and
draws no Random Hex (as under Deep Freeze, scenario 5, and Infiltration with no item); a Support Table item
(Infiltration, Reinforcements, Hidden Unit, RS.7) is offered only if the mix has all its counters, Weapon included; the
RSG's Fortification OBs bought together may not hold more markers of a kind than the mix. Smoke (the 50 chits) and the
Objective chits were already drawn from cups; Blaze, Suppressed and Veteran markers have no limit (no source gives one;
Breeze spreads Blazes without end). *S2 "Counter Mix Limits", S1 E42, A36, E52, S4 RS.7 / RS.9; project ruling (the
counts).*
