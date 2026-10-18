# Combat Commander: Europe — Digital Edition

An unofficial, fan-made browser edition of Chad Jensen's *Combat Commander: Europe* (GMT Games): squad-level infantry
combat in the Second World War, played against a computer opponent. The base game in full: Germans, Americans and
Russians, all twelve scenarios, and the Random Scenario Generator.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5174 (the `dev` launch configuration). Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Type-check and build the static site into `docs/` (for GitHub Pages) |
| `npm test` | Engine, rules, data, scenario, UI and AI tests (Vitest) |
| `npm run typecheck` | TypeScript only |

## Playing

1. **New Scenario** → pick one of the twelve, the side you command and the opponent (Green, Line or Elite).
   **Random Battle** builds a battle with the Random Scenario Generator: you make your side's choices (map, Order of
   Battle, Support purchases, Fortifications) or let it surprise you.
2. Set up your forces in your set-up area (or "Deploy the rest for me").
3. On your Turn, click a Fate card to give its Order, or pass and discard. Moving units can draw Opportunity Fire at
   every hex; when the opponent attacks or moves you are asked only if you hold an Action you can play.
4. Every "die roll" is the next Fate card from the roller's deck, as on the table. Time advances on Time! triggers and
   whenever a deck runs out; the game can end at Sudden Death, by surrender, or when a side is wiped out.
5. Games are saved after every decision — **Continue** from the main menu.

Hover any counter, hex or card for its details. **Line of Sight** in the top bar checks sight lines (drawn terrain, hills
and hindrance, as the rules have it); **Rules** opens the in-app rules reference.

## The computer opponent

The AI (`src/ai`, in a Web Worker) only ever sees what its side would see: your hand, both draw piles and your secret
Objective are hidden from it. It plans each Turn by playing candidate Orders through the real rules engine in many
sampled versions of the unknowns, and answers your moves with Actions when they are worth the card.

| Level | Character |
|---|---|
| Green | Quick and sometimes careless |
| Line | A steady opponent (default) |
| Elite | Searches widest; slower turns |

## Project layout

```
src/engine/   Pure TypeScript rules engine (deterministic, replayable): Fate decks, triggers, LOS, fire, orders,
              actions/, events/, scenario special rules, the RSG
src/data/     Game data as JSON: Fate cards, counters, maps (with sub-hex terrain masks), scenarios, RSG tables
src/ai/       Computer opponent (Web Worker)
src/art/      Original SVG counters, markers and card faces
src/ui/       React UI: menus, painted map board, battle screen, RSG screens, rules reference
design/       Design spec, plan, rules and scenarios references (paraphrased), research notes and data provenance
tests/        Engine, rules, data, scenario, UI and AI tests; scripts/fuzz.ts plays thousands of random games
```

## Credits

Unofficial fan implementation; *Combat Commander* is a trademark of GMT Games LLC, and this edition is not affiliated
with or endorsed by GMT Games. All artwork is original, all texts are original paraphrases; names, numbers and map
terrain are transcribed game data. See `CREDITS.md`.
