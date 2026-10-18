# Backlog

Work for releases after v1.0.0 "Rush to Contact", most valuable first. Each item says why it matters and what done looks
like. Take an item into its own session; move it to "Done" (with the release it shipped in) when it lands.

## Open

### 1. Strengthen the AI opponent

**Why:** in v1.0.0, Line beats Green 20–4 but Elite beats Line only 29–19 (60 %); Line-vs-Line attackers win 40 % over
the attack/defend scenarios, and scenarios 3 (Bonfire of the NKVD) and 11 (Hold the Line) are very hard for the German
attacker. All match runs so far used 0.2–0.3 of the real time budgets, so the true baselines are unknown.

**Done when:**
- The level and attacker tables have been run at the real budgets (long runs in the background) and recorded in
  `design/ai-balance.md` as the baseline.
- Elite beats Line by ≥ 70 % over 40+ games, with Elite decisions still ≤ ~4 s.
- The attacker wins a fair share in scenarios 3 and 11.
- The AI's decision to re-roll its own Defense rolls takes the attack total into account (today it judges on the dice
  alone), if the decision context allows.
- Every change is backed by head-to-head runs against the previous AI; `npx vitest run` and `npx tsc --noEmit -p .` stay
  green; hidden information unchanged (the AI only ever sees `redact(state, side)`).

**Where:** `src/ai/*`, `scripts/ai-match.ts`, `tests/ai/*`, `design/ai-balance.md`.

### 2. Initiative re-roll prompt asks too often

**Why:** with the default setting "When it matters", the human holding the Initiative was asked whether to cancel an
enemy Fire Attack roll of 5 — a low roll that already went the human's way (seen on the live site, scenario 2, turn 1).

**Done when:** "When it matters" asks only for rolls whose result is bad for the human (a high enemy attack or rout roll,
a low own defense, rally or melee roll, a Sudden Death roll that ends a game the human is winning, …), with a test per
roll purpose in `tests/ui/game/reroll.test.ts`.

**Where:** the re-roll policy in `src/ui/game/`.

### 3. Counter-mix limits

**Why:** the box's exact counter mix is not public, so limits are approximated: named Leaders, the single Pillbox and
the RSG purchase caps (`src/engine/rsg/mix.ts`) are enforced, but Teams for Deploy and Light Wounds, Fortification
markers and units from Infiltration / Reinforcements are unlimited (`design/data-notes.md`). Matters only in random
battles and a few Events.

**Done when:** a single counter-mix table (counts per counter type, from a physical count or a published component
list) drives every place that brings pieces into play, with tests.

### 4. Smaller first load

**Why:** the main bundle is ~1 MB (260 KB gzipped); all 13 maps and their terrain masks load up front.

**Done when:** map and mask data load per map on demand (dynamic import), the main chunk is well under 500 KB, and the
map gallery, scenario picker previews and battle screen still paint without a flash of unpainted terrain.

## Done

_(nothing yet)_
