# AI balance and strength

How the computer opponent's levels compare, and how its attackers fare against its defenders. Every game below is a
whole scenario played by the engine (`GameDriver`), each AI deciding on `redact(state, side)` only.

The first part is v1.1 (backlog §1: more thinking time, the battle plan, the re-roll judgement, effort-mode runs and
head-to-heads against the frozen v1.0.0 AI); the v1.0.0 tables (Task 12) follow as history.

# v1.1

<!-- v1.1 results -->

## Where v1.1 stands (the targets of backlog §1)

| Target | Result (effort mode, below) | Reached? |
|---|---|---|
| Elite beats Line ≥ 70 % over 40+ games, both ways | Elite 22 of 40 (55 %) | **no** |
| The German attacker in scenarios 3 and 11 at a fair share (Line vs Line) | S3 1 of 8, S11 2 of 8 | **no** (S3), **no** (S11) |
| Line stronger than v1.0.0's Line, head-to-head | Line 18 of 24 (75 %) | yes |
| Elite stronger than v1.0.0's Elite, head-to-head | not run (see below) | not measured |
| Thinking time up to Line 8 s, Elite 20 s per own-Turn decision | mean Elite 4.2 s (slowest 58 s), Line 0.7 s (slowest 11 s) under load | yes (the clock caps Elite's heaviest searches, see "Time per decision") |

**What made the difference was depth, not a longer clock.** With the wider searches, more worlds and longer budgets
alone, the new Line was even with v1.0.0's (24–24) and Elite was no better than Line (15 of 32): the searches already
ended on their world counts or the early stop, well inside the time. What won games was playing *the rest of the AI's
own Turn* after the candidate Order **with Move Orders in it** — the old look-ahead could only Fire, Recover or pass —
and, for Elite, the opponent's reply Turn with Moves too. Elite with that beat the Line without it 28 of 43 (65 %); Line
with it beat v1.0.0's Line 18 of 24 (75 %).

**Shipped:** Line looks ahead through its own Turn (Moves included), Elite also simulates the opponent's reply (Moves
included) and searches wider. That makes the default opponent clearly stronger than v1.0.0's, but it took most of
Elite's margin: against this Line, Elite wins only about half (the target is missed; restoring a clear margin needs new
work — a deeper or better-informed Elite search, see the backlog). The battle plan neither helps nor costs (24–24 in its
ablation). Attackers win 28 of 71 Line-vs-Line games (39 %; v1.0.0: 29 of 72 at reduced budgets), but the German
attacks in scenarios 3, 10 and 11 stay hard for the AI (1, 1 and 2 of 8).

### Elite vs Line, as shipped — scenarios 1–4 seeds 1–4, scenarios 9 and 11 seeds 1–2, both ways

| Scenario | Postures (Axis / Allied) | Games | Elite wins | Line wins | Attacker wins | Elite ms/Turn | Line ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 8 | 4 | 4 | — | 3085 | 488 |
| 2 Hedgerows & Hand Grenades | defend / attack | 8 | 3 | 5 | 5/8 | 3733 | 660 |
| 3 Bonfire of the NKVD | attack / defend | 8 | 4 | 4 | 0/8 | 3499 | 660 |
| 4 Closed for Renovation | defend / attack | 8 | 7 | 1 | 3/8 | 6136 | 969 |
| 9 Rush to Contact | defend / attack | 4 | 3 | 1 | 3/4 | 6578 | 741 |
| 11 Hold the Line | attack / defend | 4 | 1 | 3 | 1/4 | 2560 | 350 |
| **Total** |  | 40 | **22** | **18** | 12/32 | 4204 | 665 |

Elite 22/40 (55 %), Line 18/40 (45 %).

### Line vs v1.0.0's Line — seeds 1–2, both ways

| Scenario | Postures (Axis / Allied) | Games | Line wins | v1.0 Line wins | Attacker wins | Line ms/Turn | v1.0 Line ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 4 | 3 | 1 | — | 389 | 75 |
| 2 Hedgerows & Hand Grenades | defend / attack | 4 | 2 | 2 | 4/4 | 859 | 155 |
| 3 Bonfire of the NKVD | attack / defend | 4 | 3 | 1 | 1/4 | 502 | 102 |
| 4 Closed for Renovation | defend / attack | 4 | 3 | 1 | 3/4 | 952 | 141 |
| 9 Rush to Contact | defend / attack | 4 | 4 | 0 | 2/4 | 600 | 160 |
| 11 Hold the Line | attack / defend | 4 | 3 | 1 | 1/4 | 328 | 71 |
| **Total** |  | 24 | **18** | **6** | 11/20 | 605 | 117 |

Line 18/24 (75 %), v1.0 Line 6/24 (25 %).

### Attackers against defenders, Line vs Line as shipped — seeds 1–8 (scenario 9: seeds 1–7)

| Scenario | Postures (Axis / Allied) | Games | Line wins | Attacker wins | Line ms/Turn |
|---|---|---|---|---|---|
| 2 Hedgerows & Hand Grenades | defend / attack | 8 | 8 | 8/8 | 605 |
| 3 Bonfire of the NKVD | attack / defend | 8 | 8 | 1/8 | 533 |
| 4 Closed for Renovation | defend / attack | 8 | 8 | 1/8 | 1097 |
| 5 Cold Front | defend / attack | 8 | 8 | 6/8 | 621 |
| 6 Paralyzed from the West Down | defend / attack | 8 | 8 | 3/8 | 1124 |
| 9 Rush to Contact | defend / attack | 7 | 7 | 4/7 | 1079 |
| 10 Commando School | attack / defend | 8 | 8 | 1/8 | 637 |
| 11 Hold the Line | attack / defend | 8 | 8 | 2/8 | 350 |
| 12 Misty Mountain | defend / attack | 8 | 8 | 2/8 | 2176 |
| **Total** |  | 71 | **71** | 28/71 | 911 |

Before the look-ahead (the same seeds, Line without it on both sides):

| Scenario | Postures (Axis / Allied) | Games | Line (no look-ahead) wins | Attacker wins | Line (no look-ahead) ms/Turn |
|---|---|---|---|---|---|
| 2 Hedgerows & Hand Grenades | defend / attack | 8 | 8 | 3/8 | 276 |
| 3 Bonfire of the NKVD | attack / defend | 8 | 8 | 1/8 | 186 |
| 4 Closed for Renovation | defend / attack | 8 | 8 | 4/8 | 324 |
| 5 Cold Front | defend / attack | 8 | 8 | 7/8 | 188 |
| 6 Paralyzed from the West Down | defend / attack | 8 | 8 | 3/8 | 320 |
| 9 Rush to Contact | defend / attack | 8 | 8 | 5/8 | 340 |
| 10 Commando School | attack / defend | 8 | 8 | 3/8 | 141 |
| 11 Hold the Line | attack / defend | 8 | 8 | 2/8 | 134 |
| 12 Misty Mountain | defend / attack | 8 | 8 | 2/8 | 539 |
| **Total** |  | 72 | **72** | 30/72 | 272 |

For comparison, the same seeds with v1.0.0's Line on both sides (scenarios 3 and 11 only; the full v1.0.0 table is in
the history below, run at reduced budgets):

| Scenario | Postures (Axis / Allied) | Games | v1.0 Line wins | Attacker wins | v1.0 Line ms/Turn |
|---|---|---|---|---|---|
| 3 Bonfire of the NKVD | attack / defend | 8 | 8 | 0/8 | 136 |
| 11 Hold the Line | attack / defend | 8 | 8 | 2/8 | 89 |
| **Total** |  | 16 | **16** | 2/16 | 112 |

Scenario 3 (Bonfire of the NKVD): the Germans must win back 20 VP against ten Militia Squads behind Wire, with three
Orders; their plan goes for the Command Post (Objective 5, 16 VP of open chits), and the attack bogs down in Recovers,
Routs and single-unit moves (`--verbose` logs). Scenario 11 (Hold the Line): two Orders, Sudden Death on Time 6 from
Time 1; the Germans win when they take Objective 5 early. Neither moved with the battle plan at full weight (2 of 16,
same seeds: 3 of 16).

### Not run

Elite vs v1.0.0's Elite (48 games) and the separate real-clock timing games were dropped to hand over in time. Elite
being at least Line's equal while Line beats v1.0.0's Line 75 % says Elite is stronger than v1.0.0's Elite too, but it
is not measured.

## How v1.1 got there (development runs, effort mode)

### Line vs v1.0.0's Line before the look-ahead (wider search, early stop, battle plan, re-roll judgement) — seeds 1–4

| Scenario | Postures (Axis / Allied) | Games | Line (no look-ahead) wins | v1.0 Line wins | Attacker wins | Line (no look-ahead) ms/Turn | v1.0 Line ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 8 | 4 | 4 | — | 135 | 80 |
| 2 Hedgerows & Hand Grenades | defend / attack | 8 | 3 | 5 | 7/8 | 216 | 135 |
| 3 Bonfire of the NKVD | attack / defend | 8 | 4 | 4 | 0/8 | 174 | 115 |
| 4 Closed for Renovation | defend / attack | 8 | 5 | 3 | 1/8 | 312 | 182 |
| 9 Rush to Contact | defend / attack | 8 | 3 | 5 | 3/8 | 361 | 238 |
| 11 Hold the Line | attack / defend | 8 | 5 | 3 | 3/8 | 151 | 90 |
| **Total** |  | 48 | **24** | **24** | 14/40 | 225 | 140 |

Line (no look-ahead) 24/48 (50 %), v1.0 Line 24/48 (50 %).

### Elite vs Line before the look-ahead had Moves — seeds 1–4 (scenarios 1–3), 1–2 (4, 9, 11)

| Scenario | Postures (Axis / Allied) | Games | Elite (no Moves in its look-ahead) wins | Line (no look-ahead) wins | Attacker wins | Elite (no Moves in its look-ahead) ms/Turn | Line (no look-ahead) ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 8 | 3 | 5 | — | 608 | 156 |
| 2 Hedgerows & Hand Grenades | defend / attack | 8 | 3 | 5 | 5/8 | 1300 | 301 |
| 3 Bonfire of the NKVD | attack / defend | 4 | 3 | 1 | 1/4 | 853 | 187 |
| 4 Closed for Renovation | defend / attack | 8 | 4 | 4 | 2/8 | 2021 | 398 |
| 9 Rush to Contact | defend / attack | 4 | 2 | 2 | 4/4 | 1423 | 277 |
| **Total** |  | 32 | **15** | **17** | 12/24 | 1267 | 272 |

Elite (no Moves in its look-ahead) 15/32 (47 %), Line (no look-ahead) 17/32 (53 %).

### Elite with Moves in its look-ahead and reply vs Line without look-ahead — seeds 1–4

| Scenario | Postures (Axis / Allied) | Games | Elite wins | Line (no look-ahead) wins | Attacker wins | Elite ms/Turn | Line (no look-ahead) ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 8 | 6 | 2 | — | 3219 | 148 |
| 2 Hedgerows & Hand Grenades | defend / attack | 8 | 7 | 1 | 5/8 | 3630 | 261 |
| 3 Bonfire of the NKVD | attack / defend | 8 | 4 | 4 | 2/8 | 3090 | 176 |
| 4 Closed for Renovation | defend / attack | 8 | 6 | 2 | 2/8 | 8135 | 318 |
| 9 Rush to Contact | defend / attack | 7 | 4 | 3 | 6/7 | 9809 | 324 |
| 11 Hold the Line | attack / defend | 4 | 1 | 3 | 1/4 | 2653 | 154 |
| **Total** |  | 43 | **28** | **15** | 16/35 | 5206 | 235 |

Elite 28/43 (65 %), Line (no look-ahead) 15/43 (35 %).

### Elite without the reply simulation vs Line with look-ahead — seeds 1–2

| Scenario | Postures (Axis / Allied) | Games | Elite without the reply wins | Line wins | Attacker wins | Elite without the reply ms/Turn | Line ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 4 | 3 | 1 | — | 792 | 421 |
| 2 Hedgerows & Hand Grenades | defend / attack | 4 | 2 | 2 | 4/4 | 818 | 837 |
| 3 Bonfire of the NKVD | attack / defend | 4 | 3 | 1 | 1/4 | 718 | 567 |
| 4 Closed for Renovation | defend / attack | 4 | 1 | 3 | 1/4 | 1323 | 1403 |
| 9 Rush to Contact | defend / attack | 4 | 2 | 2 | 2/4 | 1113 | 749 |
| 11 Hold the Line | attack / defend | 4 | 2 | 2 | 0/4 | 449 | 375 |
| **Total** |  | 24 | **13** | **11** | 8/20 | 869 | 725 |

Elite without the reply 13/24 (54 %), Line 11/24 (46 %).

Elite's reply simulation adds little once both look ahead (13 of 24 without it, about half with it).

### The battle plan: Line with it (half weight, 4-hex zone) vs the same Line without — seeds 1–4

| Scenario | Postures (Axis / Allied) | Games | Line (no look-ahead) wins | Line (no look-ahead), no plan wins | Attacker wins | Line (no look-ahead) ms/Turn | Line (no look-ahead), no plan ms/Turn |
|---|---|---|---|---|---|---|---|
| 1 Fat Lipki | recon / recon | 8 | 3 | 5 | — | 192 | 177 |
| 2 Hedgerows & Hand Grenades | defend / attack | 8 | 3 | 5 | 5/8 | 257 | 280 |
| 3 Bonfire of the NKVD | attack / defend | 8 | 3 | 5 | 1/8 | 219 | 211 |
| 4 Closed for Renovation | defend / attack | 8 | 6 | 2 | 2/8 | 384 | 365 |
| 9 Rush to Contact | defend / attack | 8 | 5 | 3 | 7/8 | 408 | 398 |
| 11 Hold the Line | attack / defend | 8 | 4 | 4 | 4/8 | 193 | 195 |
| **Total** |  | 48 | **24** | **24** | 19/40 | 276 | 271 |

Line (no look-ahead) 24/48 (50 %), Line (no look-ahead), no plan 24/48 (50 %).

The first version (full weight, the main effort and support group pulled from anywhere, a defender holding the
nearest threatened Objective) lost all six Scenario 2 games against v1.0.0's Line where the Line without it won most;
the hold choice, Cover on the approach, the 4-hex zone and the half weight came from those runs.

### Mines and Wire in the movement search: Line with the fix vs v1.0.0's Line (S3, S11, seeds 1–4)

| Scenario | Postures (Axis / Allied) | Games | Line (no look-ahead) wins | v1.0 Line wins | Attacker wins | Line (no look-ahead) ms/Turn | v1.0 Line ms/Turn |
|---|---|---|---|---|---|---|---|
| 3 Bonfire of the NKVD | attack / defend | 8 | 4 | 4 | 0/8 | 207 | 138 |
| 11 Hold the Line | attack / defend | 8 | 5 | 3 | 3/8 | 166 | 98 |
| **Total** |  | 16 | **9** | **7** | 3/16 | 186 | 118 |

Line (no look-ahead) 9/16 (56 %), v1.0 Line 7/16 (44 %).

The same without the fix: Line (no look-ahead) 9 of 16 (56 %). Most Scenario 11 games are the same move for move (the paths
rarely crossed the Minefields); in Scenario 3 the German attacker finished closer (mean VP −13 instead of −21) but won
0 of 4 instead of 1. Kept: it is what the rules do.

### German attacker experiments in S3 and S11 (attacker variant vs Line, seeds 1–8)

Battle plan at full weight for the attacker:

| Scenario | Postures (Axis / Allied) | Games | Line (no look-ahead), plan at full weight wins | Line (no look-ahead) wins | Attacker wins | Line (no look-ahead), plan at full weight ms/Turn | Line (no look-ahead) ms/Turn |
|---|---|---|---|---|---|---|---|
| 3 Bonfire of the NKVD | attack / defend | 8 | 0 | 8 | 0/8 | 266 | 136 |
| 11 Hold the Line | attack / defend | 8 | 2 | 6 | 2/8 | 177 | 104 |
| **Total** |  | 16 | **2** | **14** | 2/16 | 222 | 120 |

Line (no look-ahead), plan at full weight 2/16 (12 %), Line (no look-ahead) 14/16 (88 %).

Look-ahead with Moves for the attacker only (before it became Line's default; "Line" is the attacker):

| Scenario | Postures (Axis / Allied) | Games | Line wins | Line (no look-ahead) wins | Attacker wins | Line ms/Turn | Line (no look-ahead) ms/Turn |
|---|---|---|---|---|---|---|---|
| 3 Bonfire of the NKVD | attack / defend | 8 | 1 | 7 | 1/8 | 796 | 152 |
| 11 Hold the Line | attack / defend | 8 | 4 | 4 | 4/8 | 529 | 79 |
| **Total** |  | 16 | **5** | **11** | 5/16 | 662 | 115 |

Line 5/16 (31 %), Line (no look-ahead) 11/16 (69 %).

## Time per decision

`ms/Turn` in the tables is the real wall-clock mean of an own-Turn decision in those runs, on the shared machine (load
average 4–9 on 8 cores, so roughly 1.5–3 × a quiet machine). No search in any v1.1 run reached its simulation count:
clear 20050, worlds 16941, even 10232, single 2117 of 49340 searches. So effort mode played every search to its end, where a browser's clock may stop the heaviest ones early:
the look-ahead with Move Orders makes a simulation dearer than the v1.0.0 simulations the effort rates were measured
with.

- Line: mean 0.35–2.2 s per own-Turn decision under load (Scenario 12 the slowest), so roughly 0.2–1 s on a quiet
  machine; the slowest decision of a game took 2–11 s under load (median), up to 20 s in Scenarios 9 and 12 — perhaps
  7–10 s on a quiet machine, where the 8 s clock stops the search with what it has.
- Elite: mean 3–16 s under load (about 2–6 s quiet); its slowest decisions took 20–58 s under load (Scenarios 4 and 9;
  perhaps 10–30 s quiet), which the 20 s clock cuts short in a browser.

So the tables credit Line and Elite slightly more search in their heaviest decisions than a browser gives them (Elite
more than Line; it still only matches Line). Re-measure the rates (`ai-probe.ts --calibrate --players line,elite`)
before more runs.

The v1.0.0 probe on 31 fixed positions (quiet machine): Green 21 ms, Line 460 ms (max 2.5 s), Elite 1.7 s (max 4 s) —
v1.0.0's searches too ended on their world counts long before their budgets.

<!-- /v1.1 results -->

## Levels (v1.1)

| | Green | Line (default) | Elite |
|---|---|---|---|
| Own-Turn thinking time, at most | 0.6 s | 8 s (v1.0: 2.5 s) | 20 s (v1.0: 4 s) |
| Worlds per candidate, at most | 1 | 128 (48) | 256 (96) |
| Candidates | 4 | 18 (12) | 26 (18) |
| Fire activations / Move activations × variants | 2 / 2 × 1 | 5 / 8 × 3 (4 / 6 × 2) | 7 / 12 × 4 (6 / 9 × 3) |
| Worlds each before the first cut | 1 | 8 (6) | 12 (10) |
| A simulation plays | the Order | the Order and the rest of its Turn (Fire, Move or Recover; v1.0: the Order only) | the Order, the rest of its Turn and the opponent's reply Turn (both may Fire, Move or Recover; v1.0: no Moves) |
| Early stop | — | yes | yes |
| Battle plan | — | yes (half weight, 4-hex zone) | yes (half weight, 4-hex zone) |
| Initiative re-rolls | never | judged | judged |
| Noise / careless reactions | ±4 VP / 60 % | — | — |

**Early stop.** The search used to run until every surviving candidate had all its worlds or the clock ran out. Now,
from 2 × `minSims` worlds on, it stops when the best candidate leads the runner-up by 3 standard errors of their paired
difference (the worlds are shared, so the difference is measured world by world), or (from 4 × `minSims`) when the
two are even within 0.3 VP. A prior spread of 1 VP is added to the observed one: eight equal results do not prove that
a rare large outcome (an Op Fire, a lost melee) is absent (the first version stopped as soon as 8 worlds agreed).

**Battle plan** (`src/ai/battleplan.ts`, Line and Elite). Made at the AI's first own Turn from its own view only (open
chits, its own secret chits, control, the units on the map; the opponent's secret chits and hand are unknown there):
- the target: each Objective's worth to the AI (a posture base, the open chits on it, its own secret chits),
  discounted for one not yet held by the Turns needed to reach it (about three hexes a Turn) against the Turns left
  before Sudden Death, and by the enemy around it; for one held, weighted by how strongly the enemy is coming;
- the main effort: the nearest units in good order (about half the force, at least two) and the nearest Leader;
  a lone garrison of another held Objective stays where it is;
- the support group: up to three of the other units with the best fire that can reach a firing position (a hex within
  6 of the target with a clear line of sight to it);
- the timing: the main effort should be on the target by two Time spaces before Sudden Death.

The evaluation (weight `plan`, Line and Elite at half weight: `planWeight` 0.5) scores each main-effort unit within 4
hexes of the target by its nearness (to hold it, anywhere on or next to it is as good), more as that Time comes near,
and — once the main effort is that near — each support unit in a firing position within its range; both fully from
Cover facing the target, less in the open (bounds from cover to cover). The approach march is left to the rest of the
evaluation (the Objective, exposure and threat terms). The Move planner's destination search uses the same term. A first
version that pulled the main effort and the support group from anywhere at full weight cost games (below). Re-plans: the target taken (or, held, lost); half the main effort broken or eliminated; a projected VP swing of 5;
an Objective chit revealed or changed; Sudden Death two Time spaces away; reinforcements (units from the Time Track or
new counters other than Teams) on either side. A re-plan keeps the old target unless another is clearly better (×1.25).
`ai-match.ts --plans` prints every plan; for example (Scenario 11, the Germans):

```
T1 axis plan [first plan]: take Objective 1 (N7, worth 1.2) …
T3 axis re-plan [target taken]: take Objective 5 (I8, worth 15.2) (was take Objective 1) by Time 4 (now 1, Sudden Death 6); main 5: …
T17 axis re-plan [main effort broken (3 of 6 in good order)]: take Objective 5 (I8, worth 15.2) (same target) …
T29 axis re-plan [Sudden Death near]: take Objective 5 (I8, worth 15.2) (same target) by Time 5 …
```

**Re-rolls of Fire Attack and Defense rolls.** The engine now offers, with each re-roll question, what the roll's
total is built on (`RollStake`: the attack's FP, pieces and targets; or the defender's Morale + Cover and the Attack
Total it must beat). The AI compares the result of the roll with a fresh roll's average (the worth of the attack, or
the cost of the break / suppression) and re-rolls when the gain beats the Initiative card's worth (1.1 VP + 0.2), for
its own rolls and the enemy's. Before, its own Defense roll was re-rolled on a sum of 3 or less, whatever the attack.

## How the v1.1 runs were made

**Effort mode, not the clock.** Seven sessions shared the 8-core machine while these tables ran (load average 8–30),
so wall-clock budgets would have given the AI a fraction of what it gets in a browser, and a different fraction from
game to game. `scripts/ai-match.ts --effort 1` replaces the clock by a simulation count per own-Turn search: what the
player reaches in its budget on a quiet machine in that scenario (`scripts/ai-effort.ts`: simulations per second per
scenario, measured by `scripts/ai-probe.ts` for v1.0.0's levels on 31 fixed positions while the machine was quiet; the
first v1.1 levels' simulations cost the same, which `ai-probe.ts --calibrate` checked side by side under load; with Move
Orders in the look-ahead they cost more, and the rates should be re-measured). With it a seed fully determines a game —
the tables repeat exactly — and the load changes only how long they take.

In practice the simulation count never bound in these runs: every search ended earlier, when every candidate had
played its worlds, when the choice was clear (the early stop) or with a single candidate. So effort mode played the
full search — the same as a browser on a quiet machine, except for Elite's heaviest decisions, which a browser's 20 s
clock cuts short (see "Time per decision").

The tables were run on this branch before it was merged with the other v1.1 branches (the AI is the same; their engine
changes — the counter-mix limits, new events — came in afterwards).

**The previous AI.** `scripts/ai-v1/` is the v1.0.0 AI (src/ai at 24a414e) frozen, playing on the current engine
(players `v1-green`, `v1-line`, `v1-elite`). It gets the same effort treatment (its own levels' rates and budgets:
Line 2.5 s, Elite 4 s).

**Seeds and sides.** Head-to-head tables play each seed both ways (sides swapped), so a scenario's side advantage
cancels between the two players. Line-vs-Line tables play distinct seeds (in effort mode the swapped game of two equal
players is the same game).

**Reproduce.** For example
`npx vite-node scripts/ai-match.ts -- --scenario 1,2,3,4,9,11 --games 3 --axis elite --allied line --swap --effort 1`;
`--plans` prints every battle plan and re-plan, `--verbose` every own-Turn decision too; `--out f.jsonl` writes one
JSON line per game.

# v1.0.0 (history)

Each seed is played both ways (sides swapped), so a scenario's side advantage cancels between the two players.

**Budgets.** To fit hundreds of games, the runs give each level a fraction of its own thinking time (`× 0.2` / `× 0.3`
of Green 0.6 s, Line 2.5 s, Elite 4 s per own-Turn decision). "ms/Turn" is the mean time of an own-Turn decision in
those runs (a busy shared machine); small decisions (reactions, re-rolls, choices) take a few ms at any level. In the
browser each level has its full budget, so Line and Elite search more than here. (v1.1 found that this mattered less
than it seemed: v1.0.0's Line and Elite ended most searches on their world counts, well inside even the reduced
budgets — see the probe below.)

**Reproduce.** `npx vite-node scripts/ai-match.ts -- --scenario 1,8 --games 6 --axis v1-elite --allied v1-line --scale 0.3 --swap`
(the v1.0.0 AI is kept as players v1-green / v1-line / v1-elite).

## Levels (v1.0.0)

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

### v1.0.0: Line vs Line with the attacker weights in evaluate.ts — seeds 1–4, both ways; budget × 0.2

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
