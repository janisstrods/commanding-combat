# Combat Commander: Europe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A complete, rules-faithful browser edition of *Combat Commander: Europe* (base game, 12 scenarios + RSG)
played against a computer opponent, published as a static site.

**Architecture:** A pure, deterministic TypeScript rules engine (generator flow yielding `Decision`s, answered with
`Answer`s; every "roll" is a Fate-card reveal), an AI in a Web Worker that only sees a redacted state, and a React UI
that animates the engine's events. Game data (cards, counters, maps with sub-hex terrain masks, scenarios, RSG tables)
is JSON in `src/data`, validated by tests.

**Tech Stack:** TypeScript 5.6, Vite 5, React 18, Vitest 2 (node environment). No backend.

**Spec:** `design/superpowers/specs/2026-10-17-combat-commander-design.md`. Rules authority:
`design/rules-reference.md` (§ numbers below refer to it); scenarios and RSG: `design/scenarios-reference.md`;
research data: `design/data/`, `design/vassal-survey.md`.

## Global Constraints

- Engine contract: `src/engine/types.ts`. Unions may grow; existing fields keep their meaning; say so in the commit.
- `GameState` is plain JSON (no classes, Map, Set); `cloneState` must stay cheap (the AI clones thousands of times).
- Every random number during play comes from a Fate-card reveal; the seeded RNG (`src/engine/rng.ts`) only shuffles
  and runs pre-game tables (R-39). Initial state + answers replays a game exactly.
- No GMT artwork, card images, map scans or rules text in the repo or the build. Card and rules texts are our own
  paraphrases. `reference/` (the VASSAL module, rules PDFs) is git-ignored and never imported by `src/`.
- Static site: `base: './'`, hash routes `#/...`, build into `docs/`. No GitHub Actions.
- The AI receives only `redact(state, side)`.
- Commit only your own files, by explicit path (`git add <paths>`; never `git add -A`). Several agents share this
  checkout: if `.git/index.lock` exists, wait a few seconds and retry. Commit messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; author `-c user.name="Janis Strods" -c user.email=jstrods@gmail.com`.
- Type errors in files you don't own are someone else's work in progress: check your own files with
  `npx tsc --noEmit -p . 2>&1 | grep <your paths>`; never edit another task's files — report the need instead.
- Tests: `npx vitest run <your test paths>`; British spelling in user-facing text (as cnc-claude).

## Review Focus

1. **Deck exhaustion mid-resolution** (a reveal empties the draw pile inside a trigger, an Event, a refill or a melee):
   the Time advance happens at once and play resumes exactly where it paused (§6.1.2, R-07, R-08). Pinned by Task 1's
   `deck.test.ts` "last card" cases and by Task 14's fuzz run with tiny decks.
2. **The game ending mid-resolution** (surrender from an overstack elimination, from an Event, simultaneous surrender,
   last unit exiting): the flow stops cleanly, the winner is right (Initiative breaks ties). Task 1 `end.test.ts`.
3. **Hidden information**: the AI's input never contains the opponent's hand, any draw-pile order or the opponent's
   secret chits; UI pauses for AI reactions are uniform. Task 1 `redact.test.ts`, Task 12 `client.test.ts`.
4. **Save / resume**: an autosaved game reloads into exactly the same position (replay of answers), also after a
   page reload mid-AI-turn. Task 11 `save.test.ts`.
5. **Prompt flood**: a human is asked only when he has a legal choice; a whole AI turn with no human reactions
   available asks nothing. Task 1 `reactions.test.ts` ("no options → no decision") and Task 11's browser check.

---

## File structure

```
src/engine/  types.ts (contract) hex.ts rng.ts
             data.ts        (T3) loads src/data JSON into FateCard / CounterType / MapDef / ScenarioDef
             terrain.ts los.ts (T2) terrain chart, line of sight with hills, hindrance and masks
             state.ts       (T1) newGame(ScenarioDef, seed) → GameState in 'setup', cloneState, redact, piece queries
             deck.ts        (T1) reveal, roll, triggers, Time advance, Sudden Death, refill, reshuffle
             stats.ts       (T1) current FP/Range/Move/Morale (leaders, veteran, suppressed, wire), Cover, stacking
             casualties.ts  (T1) breakUnit (Light Wounds window), eliminate, VP, Casualty Track, surrender, exit
             objectives.ts  (T1) control, chits (open/secret/reveal/score), game-end scoring
             reactions.ts   (T1) the Action window machinery (inactive first, one round, R-12)
             fire.ts        (T1) Fire Attack resolution: groups, hindrance, height, leader bonus, Targeting, defense
             flow.ts        (T1) game loop, Turn (orders/pass), end of Turn (overstack, refill), melee hook, game end
             decisions.ts   (T1) ask(), answerError()      driver.ts (T1) GameDriver (record, replay, undo)
             registry.ts    (T1) ORDERS / ACTIONS / EVENTS handler tables (stubs filled by T7–T10)
             setup.ts       (T1) deployment decisions, chit draws, opening hands
             orders/fire.ts orders/move.ts (T1)   orders/advance.ts orders/recover.ts orders/rout.ts melee.ts (T7)
             orders/artillery.ts (T8)   actions/*.ts (T9)   events/*.ts (T10)   rsg.ts (T13)
             random.ts      (T1, extended by T7–T10) randomAnswer(s, d, rnd): a random legal answer for fuzzing
src/data/    cards.json counters.json scenarios/<1..12>.json rsg.json maps/<id>.json masks/<id>.json card-texts.ts (T3/T4/T5)
src/art/     Counter.tsx Marker.tsx FateCardView.tsx palette.ts (T5)
src/ui/      App.tsx routes, kit/, screens/ (menus, picker, RSG, deploy, result), board/ (Board, terrain painting),
             game/ (controller, panels, prompts, log, LOS tool) (T6, T11)
src/ai/      (T12)
scripts/     ai-match.ts fuzz.ts (T12, T14)
tests/       engine/ rules/ data/ ai/ ui/ golden/ support/
```

---

## Phase 1 — in parallel now

### Task 1: Engine core (one agent; commits in milestones 1a–1d)

**Files:** `src/engine/{rng,state,deck,stats,casualties,objectives,reactions,fire,flow,decisions,driver,registry,setup,random}.ts`,
`src/engine/orders/{fire,move}.ts`, `tests/engine/*.test.ts`, `tests/rules/{fire,move,deck,turn,end}.test.ts`,
`tests/support/build.ts` (test kit: `build({ map?, pieces: [{type, side, hex, ...}], decks?: {axis: CardId[] …}, … })`
returning a GameState in 'play', so rules tests never depend on scenario files).

**Interfaces:**
- Consumes: `types.ts`, `hex.ts`; `data.ts` (Task 3) — until it lands, tests build cards/counters inline via the kit.
- Produces (exact names other tasks call):
  - `rng.ts`: `random(s)`, `randInt(s,n)`, `shuffle(s,arr)`, `freshSeed()` (copy from cnc-claude, minus dice).
  - `state.ts`: `newGame(scn: ScenarioDef, seed: number): GameState`; `cloneState(s)`; `redact(s, viewer: Side): GameState`;
    `unitsIn(s, hex): Piece[]`; `unitsOf(s, side, where?)`; `typeOf(p): CounterType`; `isUnit(p)`; `newPiece(s, type, side)`.
  - `deck.ts`: `type Gen<T=void> = Generator<Decision, T, Answer>`;
    `reveal(s, ctx, side, purpose): Gen<FateCard>` (not a roll); `roll(s, ctx, side, purpose, opts?): Gen<Roll>` with
    `Roll = { card: FateCard; white: number; red: number; sum: number; product: number; jammed: boolean; doubles: boolean }`
    (handles last card → Time advance, Initiative re-roll, triggers unless inside a trigger/Event);
    `randomHex(s, ctx, side): Gen<HexId>` (broken-weapon fix/elim check first, §1.8); `advanceTime(s, ctx, side): Gen`;
    `refill(s, ctx, side): Gen`; `ctx.depth` (trigger depth; rolls with depth > 0 never trigger).
  - `stats.ts`: `currentStats(s, unitId): { fp, range, move, morale, command }` (§O20.4, §13, §F106);
    `weaponStats(s, weaponId)`; `cover(s, unitId, vs?: { firers?: HexId[]; mortarOrArtillery?: boolean; ignoresCover?: boolean }): number`
    (best single Cover, Road −1, fortifications, Wall/Hedge across the shot, R-17/R-20); `figures(s, hex, side)`;
    `stackLimit(s, hex)`.
  - `casualties.ts`: `breakPiece(s, ctx, id, cause): Gen` (Light Wounds window for Squads, §A36; broken → eliminate);
    `eliminate(s, ctx, id, cause): Gen<void>`; `suppress(s, ctx, id)`; `rally(s, ctx, id)`; `addVp(s, ctx, side, n, why)`;
    `exitUnits(s, ctx, ids): Gen`; game end via `throw new GameOver(winner, reason)` caught by flow.
  - `objectives.ts`: `updateControl(s, ctx, hex)`; `objectiveValue(s, n)`; `revealChit(s, ctx, side, chit)`;
    `drawChit(s, ctx, side, open: boolean)`; `finalScore(s, ctx)`.
  - `reactions.ts`: `window(s, ctx, w: WindowKind, info: WindowInfo): Gen<void>` — asks the inactive player (all plays,
    then pass), then the active one; yields only when `ACTIONS[*].options()` gives that player something.
  - `fire.ts`: `fireOptions(s, pieces): Map<HexId, FireSpec[]>`; `firePower(s, spec, mods)`;
    `fireAttack(s, ctx, side, spec, mode): Gen` (window `beforeFireAttackRoll`, roll, Jammed, defense rolls with window
    `beforeDefenseRoll`, results); `defend(s, ctx, unit, attackTotal, info): Gen`.
  - `registry.ts`: `ORDERS: Record<OrderName, OrderHandler>`, `ACTIONS: Record<ActionName, ActionHandler>`,
    `EVENTS: Record<EventName, EventHandler>` where
    `OrderHandler = { canGive(s, side): boolean; run(s, ctx, side, card): Gen }`,
    `ActionHandler = { windows: WindowKind[]; options(s, side, w: WindowKind, info: WindowInfo): ActionOption[]; run(s, ctx, side, opt: ActionOption, a: Answer, info: WindowInfo): Gen }`,
    `EventHandler = (s, ctx, receiver: Side, card: FateCard) => Gen`. Unimplemented entries log "not yet implemented".
  - `flow.ts`: `gameFlow(s, ctx): Gen` (setup → turns → end); `resolveMelees(s, ctx): Gen` hook (Task 7 fills `melee.ts`).
  - `driver.ts`: `GameDriver` as cnc-claude (`answer`, `drainEvents`, `replay`, `undo` limited to steps that revealed
    nothing: no reveal since, same side).
  - `random.ts`: `randomAnswer(s, d, rnd: () => number): Answer` (always legal).

- [ ] **1a — state, deck, flow skeleton, driver.** Tests: hand sizes by posture; refill to hand size; drawing the last
  card advances Time mid-refill then finishes from the new pile; a Time! trigger on the last card advances once; a roll
  inside an Event never triggers; Initiative re-roll cancels and re-rolls from the same player's deck, then the card
  passes to the opponent; Sudden Death roll `< time space` ends the game; Defender +1 VP per advance; Recon vs Recon
  none; pass with 0..discard cards; replay reproduces state exactly. Commit `feat(engine): state, Fate decks, triggers,
  time and the turn skeleton`.
- [ ] **1b — stats, casualties, objectives, reactions.** Tests: leader command adds to squads/teams and their
  non-ordnance weapons, not to leaders or ordnance; broken leader command 0; best single cover with Road −1 (Foxholes in
  Open+Road = 2); Wall cover only across the shot; elimination VP Squad 2 / Team 1 / Leader 1+Cmd / Hero 0; surrender
  when casualties reach the level; simultaneous surrender → Initiative holder; control flips on entering an empty
  objective; open chits swing; secret chits score on reveal; reaction window with no options yields nothing; inactive
  plays first; one round (R-12). Commit.
- [ ] **1c — Fire.** Fire Order activation (leader + radius; needs an enemy in LOS and range), Fire Groups (adjacent
  chain; X + 1 per extra), largest hindrance, height ±1 (both may apply), FP ≥ 1, Jammed! breaks firing weapons,
  defense per unit (< breaks, = suppress or break if moving, > nothing), ordnance Targeting (product − hindrance >
  range), mortar min range, Airburst +2. Uses `los.ts` (Task 2) — until it lands, a stub `losCheck` that treats every
  LOS as clear. Commit.
- [ ] **1d — Move with Op Fire.** MP from current Movement; terrain/hexside/uphill costs; Road +1 bonus after entering a
  road hex; group moves limited by the weakest; weapon transfer 1 MP; exit off the enemy edge for VP (Time Track space
  choice, R-30); after each hex entry the `afterHexEntry` window: inactive Op Fire (new activations via Fire Action
  cards + one attack on the entered hex with any op-fire-activated units), then active; ties break moving units; units
  can't enter enemy hexes, impassable hexes, cliffs, flanks. End of Turn: overstack (free Deploy then eliminations),
  refill. `random.ts` covers every decision so far; a 200-game random-play smoke test on a synthetic scenario never
  throws. Commit.

### Task 2: Terrain chart and line of sight

**Files:** `src/engine/terrain.ts`, `src/engine/los.ts`, `tests/engine/terrain.test.ts`, `tests/rules/los.test.ts`.

**Interfaces:**
- Consumes: `types.ts` (`MapDef`, `TerrainMask`, `MASK`), `hex.ts` (`lineHexes`, `centre`).
- Produces: `TERRAIN: Record<TerrainType, { move: number | null; cover: number | null; hindrance: number; obstacle: boolean; water: boolean; blindHex: boolean }>`
  (values from §T-TEC); `HEXSIDE: Record<HexsideFeature, { cost: number | null; cover: number; hindrance: number; obstacle: boolean }>`;
  `moveCost(map, from, to, special): number | null` (terrain + hexside + uphill + path rules, no MP/unit context);
  `losCheck(view: LosView, from: HexId, to: HexId): { clear: boolean; hindrance: number; blockedBy: string | null }`
  where `LosView = { map: MapDef; smoke: number[]; blaze: boolean[] }` (a GameState satisfies it via `losView(s)`).
- Rules: §10.1–§10.4 (intervening hexes only; hexside obstacles/hindrances that are not sides of either end hex count,
  also along a spine; units never block; smoke into/out of its hex; blaze blocks; hills algorithm steps 1–7; gully).
  With `map.mask`, obstacles/hindrances/levels come from the cells the segment crosses inside intervening hexes
  (roads as clear corridors); without a mask, from the whole intervening hex (`lineHexes`; an `alongHexside` step is
  blocked only if both hexes block — the no-mask fallback).
- [ ] Tests first from the rules' examples: open ground clear; woods hex between blocks; brush gives hindrance 3; two
  hindrances take the largest; smoke hinders into its own hex; fence on a side of the target hex is ignored, in between
  it hinders 1; hill level 1 between two level-0 hexes blocks; level-2 viewer sees over a level-1 hill; looking up sees
  only the first hex of the higher level; one blind hex behind lower woods; gully seen only from adjacent or higher;
  mask: a LOS that misses the woods art inside a woods hex is clear. Then implement; commit.

### Task 3: Game data in `src/data` and its loader

**Files:** `src/data/{cards,counters,rsg}.json`, `src/data/scenarios/<1..12>.json`, `src/data/maps/<id>.json`,
`src/engine/data.ts`, `tests/data/*.test.ts`, `scripts/build-data.ts` (converts `design/data` → `src/data`, re-runnable).

**Interfaces:** `CARDS: Record<CardId, FateCard>`; `deckOf(nation): CardId[]`; `COUNTERS: Record<string, CounterType>`
(id `<Nation>/<name>`); `counterByName(nation, name)`; `loadMap(id): MapDef` (maps JSON keeps hex labels; the loader
converts to ids, `hexsideKey`, crest flags, building ids; attaches the mask from `src/data/masks/<id>.json` when present);
`SCENARIOS: ScenarioDef[]`; `scenario(id)`; `RSG` (typed tables from `rsg.json`).
- Event/Action names normalised to the `types.ts` spellings (`White Phosphorus`, `Medic`, `Elan`).
- Scenario JSON: one file per scenario in the `ScenarioDef` shape with hex labels, built from `design/data/scenarios.json`
  (forces, quality, orders, surrender, time, SD, VP, chits, initiative) plus `design/scenarios-reference.md` (edges,
  setup areas, setup order, first turn, special rules as `SpecialRules`; anything not expressible goes to `notes` and is
  reported).
- [ ] Validation tests: 72 cards per deck; every ordered dice pair exactly twice per deck; trigger counts per §1.9.1;
  order/action/event mixes equal the tables in rules-reference Parts C–E; random hexes unique per deck; every scenario
  force names an existing counter; leaders unique; every map has 150 hexes, objectives 1–5, adjacent hexside pairs;
  scenario 12 uses American counters (R0 stand-ins). Commit cards/counters first (others need them), then scenarios,
  then maps as the transcription agents finish (maps 1–12 and 5w).

### Task 4: Terrain masks

**Files:** `design/tools/build_masks.py`, `src/data/masks/<id>.json`, `design/data/masks-report.md`.
- Classify each map image (`reference/vassal-extracted/images/MapN.png`) into `MASK` classes and elevation per cell at
  `res = 8` cells per hex radius over the combat zone, store RLE (`{res, x0, y0, width, height, cls: rle, level: rle}`;
  loader in Task 3 decodes). Validate per hex: the hex's transcribed terrain type is the highest-hierarchy class present
  in its cells (§T78.1); elevation of the centre cell equals the hex's level; crest hexes = hexes with two levels.
  Report agreement per map; fix systematic colour errors. Masks are coarse classifications (no image pixels).

### Task 5: Counter, marker and card art; card texts

**Files:** `src/art/{palette,Counter,Marker,FateCardView,silhouettes}.tsx`, `src/data/card-texts.ts`,
`src/dev/ArtGallery.tsx` (`#/gallery/counters`, `#/gallery/cards`), `tests/art/*.test.ts`.
- `Counter({ type: CounterType, broken, suppressed?, veteran?, size })`: square counter in nation colours (German field
  grey, American olive drab, Russian earth brown; elite/line/green tint bands), original silhouettes per kind (squad 4
  figures, team 2, leader 1 with rank, MG/mortar/flamethrower/satchel/radio shapes), values laid out FP–Range–Movement
  along the bottom and Morale top right, Command in a hexagon, boxed values boxed, broken side with a red bar.
- `Marker({ kind })`: Foxholes, Trench, Pillbox, Bunker, Wire, Mines (6/7/8), Smoke 1–10, Blaze, Suppressed, Veteran,
  Spotting Round, objective control (side), VP, Time, Sudden Death, Initiative card.
- `FateCardView({ card, size, highlight? })`: original card face: Order (with its Order/Action Fire variant), Action,
  Event names with our short paraphrases from `card-texts.ts` (written from rules-reference §O/§A/§E, never GMT text),
  dice (white + red), trigger box, random hex, card back.

### Task 6: UI shell and board

**Files:** `src/ui/App.tsx`, `src/ui/routes.ts`, `src/ui/kit/*` (copy and restyle cnc-claude's kit), `src/ui/sound.ts`,
`src/ui/board/{Board,TerrainLayer,HexLayer,StackView,geometry}.tsx`, `src/ui/screens/{MainMenu,ScenarioPicker,Credits}.tsx`,
`src/dev/MapGallery.tsx` (`#/gallery/map/<id>`), `tests/ui/*.test.ts`.
- Board renders a `MapDef` with original painted terrain: from the mask when present (woods canopy texture, buildings
  with roofs, brush, orchards in rows, fields with furrows, marsh, streams, ponds, gullies, roads/trails/railways, hill
  levels as tinted plateaus with contour lines), else per hex; hexside walls/hedges/fences/cliffs; hex labels; objective
  circles 1–5; stacks of `Counter`s with offsets; highlight layers (selectable hexes, LOS line); optional 180° turn.
- Main menu (New Scenario, Random Battle, Continue, Rules, Credits), scenario picker (12 scenarios with original
  one-paragraph summaries, side, AI level Green / Line / Elite), credits.

## Phase 2 — after Task 1 (and Task 2 for anything that fires)

### Task 7: Advance, melee, Recover, Rout; mines, wire, trenches
**Files:** `src/engine/orders/{advance,recover,rout}.ts`, `src/engine/melee.ts`, `src/engine/forts.ts` (mine attacks,
wire stops, trench movement), `tests/rules/{advance,melee,recover,rout,forts}.test.ts`. Rules §O16, §O22, §O23, §F100–F106,
R-23, R-24, R-27. Hooks into Task 1's move loop through `forts.ts` functions named in Task 1 (`onEnterHex`, `onLeaveHex`).

### Task 8: Artillery and smoke rounds
**Files:** `src/engine/orders/artillery.ts`, additions to `orders/fire.ts` for Smoke rounds, `tests/rules/artillery.test.ts`.
§O17, §O18 (Battery Access, Fire For Effect: spotting, accuracy, drift by compass, off-map cancel, smoke barrage,
impact per hex, fortification vulnerability table), §O20.2.1.

### Task 9: Actions
**Files:** `src/engine/actions/<name>.ts` (one per Action, registered in `registry.ts`), `tests/rules/actions/*.test.ts`.
All 21 Actions in §A25–§A41 with their windows (§A24 table), defender-only checks, nationality limits (Marksmanship,
No Quarter), R-14–R-19, R-43.

### Task 10: Events
**Files:** `src/engine/events/<name>.ts`, `tests/rules/events/*.test.ts`. All 35 Events §E43–§E77 with R-34–R-38, R-47,
counter-mix limits (§E42), melee inside an Event.

### Task 11: The battle screen
**Files:** `src/ui/game/*` (controller wrapping `GameDriver` and the AI client; autosave/Continue in localStorage
`cce-save-v1`; event animation queue; prompts for every `Decision` kind; hand, opponent hand backs, tracks, casualty
rows, objective chits, log; LOS tool; fire preview; undo), `src/ui/screens/{Deploy,Result,RulesDialog}.tsx`,
`tests/ui/*.test.ts`. Dev: `window.__cce` = controller, `__cce.autoAnswer()`, `#/play/<scenario>/<axis|allied>/<green|line|elite>[/<seed>]`.

### Task 12: The AI
**Files:** `src/ai/*` (`index.ts chooseAnswer(view, decision, opts, mem)`, `determinize.ts`, `evaluate.ts`, `planner.ts`,
`policies.ts` per decision kind, `deploy.ts`, `buy.ts`, `worker.ts`, `client.ts` copied from cnc-claude and adapted),
`scripts/ai-match.ts`, `tests/ai/*.test.ts`. Levels Green / Line / Elite; a decision within ~2.5 s at Line.

### Task 13: RSG
**Files:** `src/engine/rsg.ts`, `src/ui/screens/{RsgSetup,RsgBuy}.tsx`, `tests/rules/rsg.test.ts`. Every RS step of
scenarios-reference §4 producing a `ScenarioDef`, with "buy for me" from Task 12's `buy.ts`.

## Phase 3 — integration

### Task 14: Fuzz, golden games, balance, review, docs, release
- `scripts/fuzz.ts`: thousands of random-legal games over all scenarios (and tiny-deck variants): no throw, no hang,
  replay identical. Golden fixtures of a few games (`tests/golden`).
- AI-vs-AI matches for every scenario both sides; log in `design/ai-balance.md`.
- Browser playtests of every screen; fix.
- Code review agents (rules fidelity vs the reference; UI; AI fairness), fix findings.
- README, CLAUDE.md, CREDITS.md; `src/version.ts` release; `npm run build`; publish after the user's OK.
