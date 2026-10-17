# Combat Commander: Europe — Digital Edition (Design)

Date: 2026-10-17
Status: Approved by the user on 2026-10-17; building autonomously.

## Intent

A complete, rules-faithful, unofficial browser edition of Chad Jensen's *Combat Commander: Europe* (GMT Games). One
person opens a web page and plays a full game against a strong, fair computer opponent. Nothing to install, no
server.

It is a sibling of the user's *cnc-claude* project (`~/Gamemaking/cnc-ancients`, published at
https://strods.work/cnc-claude/). It uses the same stack and conventions, and reuses the generic pieces that fit.
*Combat Commander* plays very differently from *Commands & Colors*, so its rules, AI judgement and art are new.

## Decisions made by the user

| Question | Answer |
|---|---|
| What "playable online" means | A static website (like cnc-claude on GitHub Pages): human against the computer in the browser. No server, no human-vs-human play. |
| Content | The base game: Germans, Americans and Russians; all 12 scenarios plus the Random Scenario Generator (RSG). |
| Sources | GMT's public living rules and online references, plus the free VASSAL module (downloaded with the user's OK) to transcribe maps, Fate cards, counters and any scenario setups. |
| Look | Classic counters: square, cardboard-style counters with original soldier silhouettes and their values printed on, on a painted top-down map. |
| Process | Ask first, then build autonomously until done and happy with it, parallelising where possible. |

## Goals

1. **Rules-complete.** Every Order, Action, Event and trigger, every terrain and hexside feature, weapon,
   fortification, objective type and artillery rule works as the living rules (with errata) describe. One condensed,
   paraphrased rules reference (`design/rules-reference.md`) is the authority the engine and its tests are written
   from.
2. **All content.** All 12 scenarios are playable from either side. The RSG builds legal random battles from any
   of the 12 maps, any pair of the three nations, any year it allows, all postures (Attack / Recon / Defend) and
   point-buy forces.
3. **A real opponent.** The computer plays all three nations in every posture. It uses cover and line of sight,
   forms fire groups, melees, goes for objectives, manages its hand (discards, holding Actions for the right moment)
   and reacts with Actions on your turn. It never cheats (see AI below). It has three levels.
4. **Smooth to play.** The game stops to ask you only when you have a legal choice. When the computer reacts
   against you, it is shown clearly and you can follow what happened.
5. **Comforts.** Autosave and Continue; undo where nothing new was revealed; an in-app rules reference; hover
   information for every counter, hex and card; a line-of-sight checker; fire-attack previews.
6. **Published** the cnc-claude way, once the user creates the GitHub repository and approves the push.

## Non-goals

- Human-vs-human play, accounts, matchmaking, any server.
- Expansions: the Battle Packs, *Mediterranean* nations, *Pacific*, vehicles.
- Commander personalities and battle-log banter (cnc-claude's historical temperaments). There are no named
  historical commanders here. A one-line flavour message is fine; a personality system is not in scope.
- Phone-first layout. Desktop, laptop and tablet are the target. A phone should load and be usable, but isn't
  tuned (builder's call).

## Anti-goals (failure even if it technically works)

- Shipping any GMT artwork, card images, map scans, counter scans or rulebook/card text. Everything drawn is
  original, and every text is paraphrased. Names, numbers and map terrain facts are data and may be transcribed.
  The VASSAL module stays in the scratchpad as a reference and never enters the repository.
- Simplifications that change how the game plays: no dropped Actions or Events, no simplified line of sight, no
  "skip the reactive part".
- An AI that peeks at your hand, your deck order or the upcoming draws.
- Endless prompting, such as clicking "Pass" a dozen times per turn.
- Long computer turns. A decision should take a few seconds at most on a laptop at the default level.

## Constraints

- **Stack:** TypeScript, Vite and React 18; tests in Vitest; no backend. Same tooling and versions as cnc-claude.
- **Static site:** built into `docs/`, `base: './'`, hash routes (`#/...`), served by GitHub Pages from `main:/docs`.
  No GitHub Actions (the push token lacks the `workflow` scope). Push over HTTPS with the macOS keychain; the `gh`
  CLI is not set up.
- **Engine:** pure, deterministic and serialisable. Initial state plus the list of answers replays a game exactly.
- **AI:** runs in a Web Worker, so the page never freezes.
- **Licences:** fonts under SIL OFL, icons from game-icons.net (CC BY 3.0) credited in `CREDITS.md` the way
  cnc-claude does it.

## How it is built (architecture)

The structure mirrors cnc-claude, so moving between the two projects feels familiar.

```
src/
  engine/     Pure TS rules engine (no DOM), deterministic
  ai/         Computer opponent (Web Worker)
  data/       Game data as JSON: maps, counters per nation, Fate decks, scenarios, RSG tables
  scenarios/  Scenario + RSG setup builders, scenario texts (original summaries)
  art/        Original SVG counters, markers, card faces
  ui/         React UI: menus, board, terrain art, hand, tracks, prompts, log, rules reference
design/       Specs, plans, the rules reference, research notes and transcribed data with provenance
docs/         Built site (generated; never hand-edited)
tests/        Engine, rules, data, scenario, UI, AI and golden-game tests
```

### Engine contract (same pattern as cnc-claude)

- `GameState` is plain data: map, units and their stacks, weapons, markers, both Fate decks (draw pile order,
  discards, hands), the time track, sudden death, VP, surrender levels, initiative, objectives (open and secret) and
  RNG state.
- The game is a generator flow that `yield`s `Decision`s (`{ kind, side, options… }`) and takes `Answer`s. Decisions
  can belong to either player: reaction windows, opportunity fire, discards, morale choices and the like.
- Events (`move`, `fire`, `draw`, `trigger`, `break`, `eliminate`, `melee`, `vp`, `time`, `log`…) go into a queue
  that the UI animates.
- **Fate-deck randomness:** in *Combat Commander*, every "dice roll", random hex and trigger comes from drawing the
  top Fate card. The engine models this exactly. The only true randomness is shuffling, which uses the seeded RNG
  stored in the state. This keeps replay, autosave and undo exact.
- **Reaction windows** are explicit decision kinds. The engine computes which of a player's cards may legally be
  played in each window. When that player has none, the window passes silently. This is how goal 4 is met without
  the user having to pass by hand.
- **Undo** is offered only for steps that revealed no new information (no card drawn, no hidden marker revealed, no
  opponent decision taken since). Exactly which steps qualify is the builder's call.

### Reused from cnc-claude (copied in and adapted, not shared as a library)

Seeded RNG; the `GameDriver` (answer recording, replay, undo, autosave); the Worker client and protocol; storage and
sound helpers; the generic UI kit (buttons, panels, dialogs, theme tokens); hash routing; build and publish setup;
test helpers such as the localStorage stub; the AI's rollout/planner *pattern*. The rules engine, AI evaluation,
board geometry (different map size and labelling), terrain art and counter art are new.

### Hidden information and the AI

- The AI worker only ever receives `redact(state, side)`. In that view the opponent's hand and both decks' unseen
  order are replaced by "unknown cards" (with counts and the known composition of the unseen pool). The AI cannot
  cheat because the information isn't there.
- For lookahead, the AI fills the unknowns by sampling (determinisation): it deals the opponent a plausible hand from
  the unseen cards and shuffles the unseen deck portions, many times.
- The AI's own reaction windows always take the same brief, fixed pause in the UI. A pause that appears only when the
  AI holds a playable card would give its hand away.

### AI design

- **Levels:** *Green*, *Line*, *Elite* (named after the game's troop qualities), from shallow and noisy to the widest
  search and most rollouts. Default: *Line*.
- **Own turn:** it builds candidate plans from its hand: which Orders, in what order, with which units and targets
  (fire groups, moves toward objectives and cover, advances into melee, recovery, rout, artillery), plus discards.
  It scores each plan by playing it through the real engine many times under sampled hidden information, against a
  simple opponent reaction policy, and evaluates the outcomes. It re-plans after every Order, because results change
  the picture.
- **Before the battle:** it buys RSG forces and deploys its units (objectives, cover, fields of fire, depth). The
  same code powers the human's "buy for me" and "deploy for me" buttons.
- **Reactions:** policies backed by quick expected-value checks: when to play each Action, opportunity fire, melee
  choices, which units take losses, discards.
- **Evaluation:** VP margin and objective control, distance to surrender, sudden-death and time pressure, unit and
  leader value (good order vs broken), weapons, exposure (enemy firepower with line of sight to each stack, cover),
  and hand quality.
- The AI calls the engine's own rule queries rather than re-implementing rules. Any deliberate approximation for
  speed says so in a comment.

### UI and art

- **Screens:** main menu (New Scenario, Random Battle, Continue, Rules, Credits); a scenario picker with original
  one-paragraph summaries, side choice and AI level; the RSG setup (map, nations, year, postures, or "surprise me");
  the RSG force purchase (spend the points on units, with a "buy for me" button); the deployment screen, where you
  place your units in your setup area in the order the rules set (with "deploy for me"); the battle; the result.
- **Battle screen:** the board (SVG; map can be turned 180° so your side is at the bottom); your hand of Fate cards
  face up; the opponent's hand face down with a count; time track, sudden-death marker, VP and surrender, initiative
  card, deck and discard counts; the battle log; a prompt bar for decisions.
- **Counters (user's choice):** square, cardboard-style, in nation colours, with original soldier and weapon
  silhouettes and the printed values laid out the way the game's counters show them. They flip to their broken side,
  stack with a visible offset, and a stack can be expanded on click. Leaders, weapons, fortifications and markers
  all get their own counters.
- **Map art:** original painted top-down terrain (buildings, woods, brush, orchards, fields, marsh, hills with
  elevation shading, roads, streams, hedges, walls and the rest of the terrain chart), with the hex labels and
  objective spots each map uses.
- **Fate cards:** original card faces showing the Order, Action and Event names with paraphrased text, the dice roll,
  the random hex and any trigger. Drawing for a die roll is animated as a card flip.
- **Helpers:** hover a counter for its values and abilities; hover a hex for terrain, cover and hindrance; a
  line-of-sight tool; a fire-attack preview with the attack total against the target's morale.

### Data pipeline

- **Research (running before the build):** one agent surveys the VASSAL module, extracts the counter mix and one
  nation's Fate deck, and transcribes one map as a pilot, with a how-to for the rest (`design/vassal-survey.md`,
  `design/data/`). The other writes the rules reference and a scenarios + RSG reference (below).
- **Transcription is a build task.** The remaining maps, Fate decks and scenario setups are transcribed by parallel
  build agents. It is the biggest error-prone job and on the critical path, so each map and deck gets an independent
  second pass by another agent that compares it against the source. The two passes' disagreements are resolved
  against the image.
- **The VASSAL module** (the user OK'd downloading it once) is kept in `reference/` inside the project folder. That
  folder is git-ignored: never committed, never built into the site, so it outlives the session's scratchpad without
  entering the repository.
- `design/data/*.json` (with provenance notes) is promoted to `src/data/*.json` once it passes validation tests, for
  example: each Fate deck has the right card count and dice-roll distribution; every scenario's units exist in the
  counter mix; every map has every hex labelled and every objective spot present.

### Rules reference

`design/rules-reference.md` covers the core rules, what every Order, Action, Event and trigger does (and how they
differ by nation), the terrain chart and the rulings on ambiguities. `design/scenarios-reference.md` covers each
scenario's forces, setup, special rules and victory conditions, plus every RSG step and table. Both are finished, and
the engine's types and contracts are checked against their full list of concepts, before those contracts are frozen.
Anything the public sources lack is filled from the VASSAL module, or else becomes a research task in the plan ahead
of the rule area that needs it.

### Testing

- Rules tests written from the rules reference, one file per rule area, using forced deck orders.
- Data validation tests, as above.
- Golden replays: recorded random-play and AI games that must replay identically.
- AI-vs-AI match script (`scripts/ai-match.ts`) for smoke and balance runs.
- Browser verification in the in-app browser preview: start a scenario, play turns, check the screens.

### Process (my calls)

- I write the engine core and contracts (types, map/hex/line of sight, Fate deck, flow skeleton, driver) myself,
  because everything depends on them.
- Then background subagents work in parallel, each owning its own files: data transcription with a second checking
  pass (maps, Fate decks, counters and scenarios), art, UI, the separate rule areas behind fixed module boundaries, and the AI once the engine
  core passes its tests. After that come integration, browser playtests and a final review pass.
- A local git repository in `~/combat-commander`, committed as work lands. Publishing needs the user to create the
  GitHub repository and to say yes to the push.

## Left to the builder

The module layout below `src/engine`; AI weights and search sizes; animation timings; colours and art details within
the "classic counters on a painted map" brief; keyboard shortcuts; the exact undo boundary; how rules ambiguities are
ruled (each one recorded in the rules reference with its source); release naming (cnc-claude names each release
after a battle; here, after a scenario or a place in the game).
