# Backlog: improvements for later

Logged after v1.0.0 "Rush to Contact". Nothing here is started yet. Each section is a candidate for its own release.

## 1. AI

**More thinking time at the higher levels.** Slower decisions are fine for Line and Elite if they play better.
- Raise `budgetMs` in `src/ai/levels.ts` (now Green 0.6 s, Line 2.5 s, Elite 4 s per own-Turn decision), and with it
  `worlds`, `maxCands`, `minSims` and the act/variant counts, so the extra time goes into wider and deeper search, not
  only more samples.
- Show a "thinking…" indicator in the UI so a long wait reads as deliberate.
- Measure each change with `scripts/ai-match.ts` (Elite vs Line, both ways) and record the tables in
  `design/ai-balance.md`.

**A battle plan.** The AI plans one Turn at a time. Give it a longer-term plan that it keeps across Turns:
- at set-up (and at the first own Turn), choose a plan from the scenario: which Objectives to take or hold, a main
  effort and a supporting effort (which units go where), and a rough timing against the Time track / Sudden Death;
- store it in the AI's own state (worker side, from `redact(state, side)` only; never from hidden information);
- feed it into the evaluation (`evaluate.ts` / `weightsFor`) as extra terms: progress of the main-effort units towards
  their target, keeping the support group in firing positions, not drifting off the plan for small gains;
- **re-plan when things change sharply**: a big VP swing, the main-effort group broken or eliminated, an Objective
  chit revealed or changed, Sudden Death getting near, reinforcements arriving, or the plan's target taken;
- log the plan and each re-plan in the match logs, so `ai-match.ts` runs show why the AI did what it did.

**Strength targets from the v1.0.0 match runs** (the previous session's AI proposal). In v1.0.0 Line beats Green 20–4,
Elite beats Line only 29–19 (60 %), and Line-vs-Line attackers win 40 % over the attack/defend scenarios; scenarios 3
and 11 are very hard for the German attacker. All runs so far used 0.2–0.3 of the real time budgets.
- Run the level and attacker tables at the real budgets (in the background) and record them in `design/ai-balance.md`
  as the baseline.
- Widen Elite's margin over Line to ≥ 70 % over 40+ games (the extra thinking time above should help).
- Lift the German attacker in scenarios 3 and 11 to a fair share.
- Let the AI's re-roll of its own Defense rolls take the attack total into account (today it judges the dice alone).
- Back every change with head-to-head runs against the previous AI; keep hidden information unchanged.

## 2. Visuals

**Zoomable board.**
- Zoom (mouse wheel / pinch, plus buttons) and pan (drag), with the zoom level kept per viewer.
- **No stacking on top of each other:** units in one hex are laid out side by side inside the hex (or fanned out
  next to it when zoomed out), so every unit, its state (broken, suppressed, veteran) and its markers are visible
  without mouseover.
- Keep LOS, move and fire highlighting correct at every zoom level.

**Unit graphics with more detail and character.** Original art only (see the copyright rules in `CLAUDE.md`):
distinct silhouettes per unit type and nation (squads, teams, leaders, weapons), readable firepower / range / movement
/ morale, and clear broken and veteran faces.

## 3. UX: rolls, pacing, drama

**Clearer rolls, above all in fire attacks.** Show, for each attack:
- who fires at whom (attacking units and leader highlighted, a line or arrow to the target hex);
- how the attack total is built: each unit's firepower, leader bonus, weapon, hindrance and terrain modifiers, the
  Fate-card roll, and the sum;
- for the defender: the defence total being built the same way (morale, cover, modifiers, roll), and **what number
  the roll must reach to hold** — shown before the re-roll choice, so the player knows whether a re-roll is worth it.

**A slower pace with more drama.**
- An adjustable game speed, with a slower default for the opponent's actions.
- Events and Sniper triggers resolved visibly: a card or banner that names the event, a short animation on the
  affected hex(es) and units, and a pause long enough to read what happened before play continues.

**Rallying and routing with more detail and drama.** Recover and Rout orders (and Hero / Medic rallies) now pass by as a
few log lines. Make each one a small scene:
- say plainly **who rolls** — which side, for which unit — and what the roll must reach, shown before the Fate card is
  turned; highlight the unit being rolled for;
- show the result on the counter (rallied, still broken, routs, eliminated) with a short pause;
- for a rout, say **who moves** the unit and animate the retreat hex by hex, so the path is visible.

**Orders as subheadings in the battle log.** Each Order acted on starts a small heading in the log (side and Order,
e.g. "Axis — Fire"), with the lines it produced underneath; Actions and Events played in reaction sit under the Order
they interrupted. The Turn headings stay above them (`src/ui/game/log.ts`, `LogKind`).

**Objective values that include your secret chits.** The per-Objective VP in the Objectives panel counts open chits
only (`objectiveValue`). Add the human's own secret chits to those numbers (marked as secret, e.g. in the chits' gold,
with the breakdown in the tooltip). While the enemy holds unrevealed secret chits, show "+?" after each number that
they could still raise. Computed from what the human knows only; no hidden information.

**Re-roll prompt asks too often.** With "When it matters" (the default), the human holding the Initiative was asked
about an enemy Fire Attack roll of 5, a low roll that already went the human's way (live site, scenario 2, turn 1). Ask
only for rolls whose result is bad for the human; one test per roll purpose in `tests/ui/game/reroll.test.ts`.

## 4. Other known issues from v1.0.0

**Counter-mix limits.** The box's exact counter mix is not public: named Leaders, the single Pillbox and the RSG
purchase caps (`src/engine/rsg/mix.ts`) are enforced, but Teams for Deploy / Light Wounds, Fortification markers and
units from Infiltration / Reinforcements are unlimited (`design/data-notes.md`). One counter-mix table should drive them all.

**Smaller first load.** The main bundle is ~1 MB (260 KB gzipped) because all 13 maps and masks load up front; load
map and mask data per map on demand without a flash of unpainted terrain.
