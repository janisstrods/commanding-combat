# Combat Commander: Europe — notes for Claude

Browser game: TypeScript + Vite + React, pure rules engine in `src/engine`, AI in `src/ai` (Web Worker). Sibling of
cnc-claude (`~/Gamemaking/cnc-ancients`): same stack and conventions.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on http://localhost:5174 (launch config `dev`) |
| `npm test` | All Vitest tests (engine, rules, data, scenarios, UI, AI) |
| `npm run typecheck` | `tsc --noEmit -p .` |
| `npm run build` | Type-check, then build the static site into `docs/` |
| `npx vite-node scripts/fuzz.ts -- --games 500 [--scenario N] [--tiny-decks] [--seed S]` | Random-legal games with replay and invariant checks |
| `npx vite-node scripts/ai-match.ts -- --scenario 1 --games 2` | AI vs AI (see the file header for flags) |
| `npx vite-node scripts/build-data.ts [cards counters scenarios maps rsg]` | Rebuild `src/data` from `design/data` |

## Dev shortcuts

- Routes: `#/play/<scenario 1-12|rsg>/<axis|allied>/<green|line|elite>[/<seed>]`, `#/random` (RSG), `#/continue`,
  `#/gallery/map/<id>` (maps 1–12, 5w; mask overlays, LOS demo), `#/gallery/counters`, `#/gallery/cards`.
  `?ai=random` plays against random answers.
- In dev, `window.__cce` is the battle controller; `__cce.autoAnswer()` plays a random legal answer for the human.
- Browser tests must be silent: `localStorage.setItem('cce-muted','1')` on the origin first.
- Saves: localStorage `cce-save-v1` (scenario or full RSG ScenarioDef, seed, side, level, answers; Continue replays).

## Where things live

- **Contract:** `src/engine/types.ts` (state, decisions, answers, events). Unions may grow; fields keep their meaning.
- **Rules authority:** `design/rules-reference.md` (paraphrased; § numbers in code comments; rulings R-01…R-55 in §20)
  and `design/scenarios-reference.md` (scenarios, RSG). Rules tests in `tests/rules` are written from them.
- **Engine:** `state.ts` (newGame, cloneState, redact), `deck.ts` (every "roll" is a Fate-card reveal; triggers, Time
  advance, Sudden Death), `flow.ts` (Turn), `decisions.ts` (`ask`, `answerError` — the one answer check, also used by
  the AI), `reactions.ts` (Action windows: inactive first, one round), `fire.ts`, `stats.ts`, `casualties.ts`,
  `objectives.ts`, `melee.ts`, `forts.ts`, `los.ts` / `terrain.ts`, `setup.ts`, `scenarioRules.ts` (special rules,
  read from `ScenarioDef.special`, never by scenario number), `rsg.ts` + `rsg/`.
- **Handlers:** `orders/`, `actions/`, `events/`, each with an `index.ts` of **getters** over namespace imports; the
  registry (`registry.ts`) looks handlers up when used. Never build a handler table while modules load
  (`tests/engine/load-order.test.ts`).
- **Data:** `src/data/*.json` generated from `design/data` by `scripts/build-data.ts`; maps carry sub-hex terrain masks
  (`src/data/masks`, from `design/tools/build_masks.py`) used by LOS (drawn terrain blocks, not whole hexes) and by the
  map painter. `design/data/masks-audit.json` feeds type upgrades, crest hexes and multi-hex buildings into the maps.
- **Hidden information:** the AI gets only `redact(state, side)`; the UI filters events for the human
  (`src/ui/game`), and pauses uniformly at the opponent's reaction windows.
- **Backlog:** `design/backlog.md` (planned AI, visual and UX improvements; not started).
- **Reference material:** `reference/` (git-ignored) holds the VASSAL module and GMT's public rules PDFs. Never import
  from it, never commit or ship it.

## Backlog

`design/backlog.md` lists the work for releases after v1.0.0, most valuable first (AI strength, the re-roll prompt,
counter-mix limits, a smaller first load). Take an item into its own session and move it to "Done" when it ships.

## Copyright rules

No GMT artwork, card images, map scans or rules/card text in the repository or the build. Texts are our own
paraphrases; art is original; names, numbers and terrain facts are data.

## Publishing

- Repo: https://github.com/janisstrods/commanding-combat. GitHub Pages serves `main:/docs`; live site
  https://strods.work/commanding-combat/ (the same custom domain as cnc-claude; also reachable as
  https://janisstrods.github.io/commanding-combat/).
- `docs/` is generated build output (`npm run build`): never hand-edit it; commit it together with the source changes of
  a release. `docs/.nojekyll` comes from `public/.nojekyll`; keep it.
- `vite.config.ts` uses `base: './'` and routes are hash-based (`#/...`), so the site works under a sub-path. Check the
  built site under the sub-path with the `pages-preview` launch config (http://localhost:4174/commanding-combat/).
- No GitHub Actions (the push token lacks the `workflow` scope). Push over HTTPS with the macOS keychain; `gh` and SSH
  are not set up.
- Every publish is a release: add it at the top of `RELEASES` in `src/version.ts` (named after a scenario or a place in
  the game, never reused) and set the same number in `package.json` and the root of `package-lock.json`.
- Before publishing, run `python3 -I design/tools/text_overlap.py reference/text .`: only data rows may match the GMT texts.
