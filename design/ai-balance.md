# AI balance and strength (Task 12)

How the computer opponent's levels compare, and how its attackers fare against its defenders. Every game below is a
whole scenario played by the engine (`GameDriver`), each AI deciding on `redact(state, side)` only. Each seed is played
both ways (sides swapped), so a scenario's side advantage cancels between the two players.

**Budgets.** To fit hundreds of games, the runs give each level a fraction of its own thinking time (`× 0.2` / `× 0.3`
of Green 0.6 s, Line 2.5 s, Elite 4 s per own-Turn decision). "ms/Turn" is the mean time of an own-Turn decision in
those runs (a busy shared machine); small decisions (reactions, re-rolls, choices) take a few ms at any level. In the
browser each level has its full budget, so Line and Elite search more than here.

**Reproduce.** `npx vite-node scripts/ai-match.ts -- --scenario 1,8 --games 6 --axis elite --allied line --scale 0.3 --swap`
(see the script's header for the options).

## Levels

Green: 1 sampled world per plan, 4 candidate plans, plan scores with ±4 VP noise, 60 % of reactions skipped, no
Initiative re-rolls. Line (default): up to 48 worlds, 12 candidates, successive halving after 6 simulations each.
Elite: up to 96 worlds, 18 candidates, and each simulation also plays the rest of its own Turn and then the opponent's
reply Turn (greedy) before it is judged.

### Line vs Green — scenarios 1, 8, 2, 4; seeds 1–3, both ways; budgets × 0.3

| Scenario | Postures (Axis / Allied) | Games | Green wins | Line wins | Attacker wins | Green ms/Turn | Line ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 6 | 2 | 4 | — | 13 | 172 |
| 2 Hedgerows & Hand Grenades | defend / attack | 6 | 0 | 6 | 3/6 | 13 | 256 |
| 4 Closed for Renovation | defend / attack | 6 | 1 | 5 | 2/6 | 19 | 269 |
| 8 Breakout Dance | recon / recon | 6 | 1 | 5 | — | 16 | 152 |
| **Total** | | 24 | **4** | **20** | 5/12 | 15 | 212 |

### Elite vs Line — scenarios 1, 8, 2, 4; seeds 1–6, both ways; budgets × 0.3

| Scenario | Postures (Axis / Allied) | Games | Elite wins | Line wins | Attacker wins | Elite ms/Turn | Line ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 12 | 7 | 5 | — | 653 | 156 |
| 2 Hedgerows & Hand Grenades | defend / attack | 12 | 8 | 4 | 6/12 | 950 | 275 |
| 4 Closed for Renovation | defend / attack | 12 | 7 | 5 | 1/12 | 1110 | 414 |
| 8 Breakout Dance | recon / recon | 12 | 7 | 5 | — | 745 | 185 |
| **Total** | | 48 | **29** | **19** | 7/24 | 864 | 258 |

Line beats Green 20–4 (83 %). Elite beats Line 29–19 (60 %) — clearly ahead, not crushing: the extra worlds and the
reply simulation are worth about one game in five here, at under a third of Elite's real budget.

## Attackers against defenders (Line vs Line)

The attack/defend scenarios (2, 3, 4, 5, 6, 9, 10, 11, 12). "Attacker wins" counts games the side with the Attack
posture won.

### Now: Line vs Line with the attacker weights in evaluate.ts — seeds 1–4, both ways; budget × 0.2

| Scenario | Postures (Axis / Allied) | Games | Line wins | Attacker wins | Line ms/Turn |
|---|---|---|---|---|---|
| 2 Hedgerows & Hand Grenades | defend / attack | 8 | 8 | 5/8 | 234 |
| 3 Bonfire of the NKVD | attack / defend | 8 | 8 | 3/8 | 182 |
| 4 Closed for Renovation | defend / attack | 8 | 8 | 3/8 | 257 |
| 5 Cold Front | defend / attack | 8 | 8 | 6/8 | 140 |
| 6 Paralyzed from the West Down | defend / attack | 8 | 8 | 1/8 | 264 |
| 9 Rush to Contact | defend / attack | 8 | 8 | 3/8 | 302 |
| 10 Commando School | attack / defend | 8 | 8 | 4/8 | 123 |
| 11 Hold the Line | attack / defend | 8 | 8 | 2/8 | 116 |
| 12 Misty Mountain | defend / attack | 8 | 8 | 2/8 | 310 |
| **Total** | | 72 | **72** | 29/72 | 214 |

Attackers win 29 of 72 (40 %), inside the 35–50 % aim. Scenarios 3 (Bonfire of the NKVD) and 11 (Hold the Line),
German attacks against strong defences, and 6 and 12 remain hard for the attacker.

How it got there:

### Before the attacker weights (commit 03aa7f8) — seeds 1–2; budget × 0.2

| Scenario | Postures (Axis / Allied) | Games | Line wins | Attacker wins | Line ms/Turn |
|---|---|---|---|---|---|
| 2 Hedgerows & Hand Grenades | defend / attack | 4 | 4 | 3/4 | 255 |
| 3 Bonfire of the NKVD | attack / defend | 4 | 4 | 0/4 | 222 |
| 4 Closed for Renovation | defend / attack | 4 | 4 | 0/4 | 297 |
| 5 Cold Front | defend / attack | 4 | 4 | 2/4 | 177 |
| 6 Paralyzed from the West Down | defend / attack | 4 | 4 | 2/4 | 305 |
| 9 Rush to Contact | defend / attack | 4 | 4 | 2/4 | 293 |
| 10 Commando School | attack / defend | 4 | 4 | 2/4 | 165 |
| 11 Hold the Line | attack / defend | 4 | 4 | 0/4 | 172 |
| 12 Misty Mountain | defend / attack | 4 | 4 | 1/4 | 418 |
| **Total** | | 36 | **36** | 12/36 | 256 |

### Commit 6dee6f5 (before the melee term and the level changes) — seeds 1–2; budget × 0.2

| Scenario | Postures (Axis / Allied) | Games | Line wins | Attacker wins | Line ms/Turn |
|---|---|---|---|---|---|
| 2 Hedgerows & Hand Grenades | defend / attack | 4 | 4 | 3/4 | — |
| 3 Bonfire of the NKVD | attack / defend | 4 | 4 | 0/4 | — |
| 4 Closed for Renovation | defend / attack | 4 | 4 | 3/4 | — |
| 5 Cold Front | defend / attack | 4 | 4 | 3/4 | — |
| 6 Paralyzed from the West Down | defend / attack | 4 | 4 | 1/4 | — |
| 9 Rush to Contact | defend / attack | 4 | 4 | 3/4 | — |
| 10 Commando School | attack / defend | 4 | 4 | 2/4 | — |
| 11 Hold the Line | attack / defend | 4 | 4 | 0/4 | — |
| 12 Misty Mountain | defend / attack | 4 | 4 | 2/4 | — |
| **Total** | | 36 | **36** | 17/36 | — |

The first all-scenario Line vs Line run (commit 4a74190, one game per scenario) had defenders winning 10 of 11. What
was wrong, from the match logs:

- the AI lost games it led by 20+ VP by surrender: surrender risk was weighed in points, not at the game's stake
  (now the chance of losing by surrender times the game, `values.ts surrenderPressure`);
- two passive players could pass without discarding for ever (now a pass discards once both did so since the AI's
  last Turn);
- a side behind on VP did not push harder as Sudden Death neared (now `weightsFor` raises the Objective weight and
  lowers exposure for it, more the later it is);
- the attacker had no way to step into cover without Op Fire (now Advance-to-better-ground candidates) and no sense of
  the melee its Advance cards threaten (now the melee term, below);
- attackers feared exposure and card cycling too much (now the attack posture weights: Objectives 1.96, exposure
  0.26, threat 0.39, time 1; 13/36 with them against 12/36 and 10/36 for two other settings on the same seeds —
  within the noise — and 16/36 on fresh seeds).

## Evaluation changes tried (A/B against the AI of commit 6dee6f5)

### A/B: the melee term (new) vs commit 6dee6f5 (base) — adopted; Line, budget × 0.2

| Scenario | Postures (Axis / Allied) | Games | base wins | new wins | Attacker wins | base ms/Turn | new ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 6 | 3 | 3 | — | 84 | 93 |
| 2 Hedgerows & Hand Grenades | defend / attack | 6 | 2 | 4 | 3/6 | 157 | 161 |
| 3 Bonfire of the NKVD | attack / defend | 6 | 3 | 3 | 0/6 | 158 | 165 |
| 4 Closed for Renovation | defend / attack | 6 | 1 | 5 | 4/6 | 211 | 222 |
| 5 Cold Front | defend / attack | 6 | 2 | 4 | 5/6 | 128 | 118 |
| 6 Paralyzed from the West Down | defend / attack | 2 | 1 | 1 | 1/2 | 260 | 227 |
| **Total** | | 32 | **12** | **20** | 13/26 | 155 | 157 |

### A/B: the melee term + counting a third unit at each Objective (new) vs base

| Scenario | Postures (Axis / Allied) | Games | base wins | new wins | Attacker wins | base ms/Turn | new ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 4 | 3 | 1 | — | 89 | 108 |
| 2 Hedgerows & Hand Grenades | defend / attack | 4 | 3 | 1 | 3/4 | 162 | 168 |
| 3 Bonfire of the NKVD | attack / defend | 4 | 3 | 1 | 1/4 | 104 | 127 |
| 4 Closed for Renovation | defend / attack | 4 | 2 | 2 | 2/4 | 190 | 233 |
| 5 Cold Front | defend / attack | 4 | 1 | 3 | 3/4 | 86 | 96 |
| 6 Paralyzed from the West Down | defend / attack | 4 | 0 | 4 | 2/4 | 195 | 205 |
| 8 Breakout Dance | recon / recon | 4 | 0 | 4 | — | 110 | 109 |
| 9 Rush to Contact | defend / attack | 4 | 2 | 2 | 2/4 | 237 | 234 |
| 10 Commando School | attack / defend | 4 | 1 | 3 | 1/4 | 111 | 126 |
| 11 Hold the Line | attack / defend | 4 | 2 | 2 | 0/4 | 117 | 119 |
| 12 Misty Mountain | defend / attack | 4 | 3 | 1 | 1/4 | 268 | 273 |
| **Total** | | 44 | **20** | **24** | 15/36 | 152 | 163 |

### A/B: counting a third unit at each Objective only (new) vs base — rejected

| Scenario | Postures (Axis / Allied) | Games | base wins | new wins | Attacker wins | base ms/Turn | new ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 4 | 3 | 1 | — | 124 | 120 |
| 2 Hedgerows & Hand Grenades | defend / attack | 4 | 3 | 1 | 1/4 | 186 | 178 |
| 3 Bonfire of the NKVD | attack / defend | 4 | 2 | 2 | 0/4 | 120 | 128 |
| 4 Closed for Renovation | defend / attack | 4 | 3 | 1 | 1/4 | 192 | 197 |
| 5 Cold Front | defend / attack | 4 | 2 | 2 | 4/4 | 131 | 140 |
| 6 Paralyzed from the West Down | defend / attack | 4 | 3 | 1 | 1/4 | 209 | 205 |
| 8 Breakout Dance | recon / recon | 4 | 2 | 2 | — | 89 | 97 |
| 9 Rush to Contact | defend / attack | 2 | 1 | 1 | 2/2 | 178 | 201 |
| **Total** | | 30 | **19** | **11** | 9/22 | 152 | 155 |

## Earlier baselines

- Line vs random play, scenario 1, both sides: 8–0 (and 4 of 4 in `tests/ai/vs-random.slow.test.ts`).
- Line vs a "greedy" baseline (the same policies with a greedy Turn rule and no simulations), scenarios 1–3: 10–2.

## Caveats

- 24–72 games per table: a difference of 5 games in 36 is within chance; per-scenario rows (4–12 games) are
  anecdotes.
- All at reduced budgets on a shared machine; the browser gives each level its full budget.
