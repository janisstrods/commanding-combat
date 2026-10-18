# Credits

## The game

*Combat Commander: Europe* was designed by Chad Jensen and published by GMT Games LLC. *Combat Commander* is a trademark
of GMT Games. This is an unofficial fan edition, not affiliated with or endorsed by GMT Games; please support the
publisher by buying the game.

## What is ours, and what is data

- **Artwork:** every map painting, counter, marker and card face was made for this edition (SVG and canvas painting
  from our own terrain data). No GMT artwork, scans or card images are included.
- **Texts:** the in-app rules reference, card texts, scenario briefings and the RSG narration are our own paraphrases
  and summaries (`design/rules-reference.md`, `src/data/card-texts.ts`, `src/scenarios/summaries.ts`).
- **Data:** names, numbers and terrain facts — the counters' values, the Fate decks' contents, which hex holds which
  terrain and where its art lies, the scenarios' forces and set-ups, the RSG tables — are game data, transcribed from
  GMT's public living rules and playbook and from the free VASSAL module (CombatCommanderEurope 2.6.4), whose files
  were used only as a reference and are not distributed. Provenance notes: `design/vassal-survey.md`,
  `design/data-notes.md`, `design/data/masks-report.md`.

## Fonts

- **Oswald** — Vernon Adams, Kalapi Gajjar, Cyreal. SIL Open Font License 1.1.
- **Source Sans 3** — Paul D. Hunt, Adobe. SIL Open Font License 1.1.

Both are bundled through the `@fontsource` packages.

## Software

TypeScript, React 18 and Vite; tests with Vitest. Sounds are synthesised in the browser (no audio files).
