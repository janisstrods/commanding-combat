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

The previous session's own AI suggestions should be added here too; they were not found in the saved notes.

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
