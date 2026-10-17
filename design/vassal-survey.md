# VASSAL module survey: Combat Commander: Europe

Status: 2026-10-17. Research only. This repo contains no module images, rules text or card text. It contains only extracted facts (names and numbers) in `design/data/*.json`, plus read-only tools in `design/tools/`.

## 1. What was downloaded

| | |
|---|---|
| Library page | https://vassalengine.org/library/projects/Combat_Commander_Europe (project revision 21, package "Module", release 2.6.4) |
| File | `CombatCommanderEurope-2.6.4.vmod` |
| URL | https://obj.vassalengine.org/gls/4/3/CombatCommanderEurope-2.6.4.vmod |
| Size / SHA-256 | 140,136,479 bytes / `43f48e4a725025d71e8c40d9cbc839ee3ba6606e2ba854c31fce2ecb93b4f942` (matches the library listing) |
| Module metadata | name "Combat Commander: Europe", version 2.6.4, "Basic Edition", VASSAL 3.7.16, saved 2025-05-18 |
| Local copy | `<scratch>/vassal/CombatCommanderEurope-2.6.4.vmod`, unzipped to `<scratch>/vassal/extracted/` (1,829 files) |
| Durable copy | `reference/CombatCommanderEurope-2.6.4.vmod` and `reference/vassal-extracted/` in the project (git-ignored, never committed or shipped); the GMT rules PDFs are in `reference/rules/` |

`<scratch>` = `/private/tmp/claude-501/-Users-janisstrods-combat-commander/e08f64e5-6094-42a1-80d5-4901fbeed995/scratchpad`. It is session-scoped, so re-download it if it's gone. Re-verify the SHA-256 after downloading.

Not downloaded:
- The Mediterranean extension and the Battle Pack extensions (`.vmdx`).
- `CCE-RSG.vmdx` (15,560 bytes, https://obj.vassalengine.org/gls/1/a/CCE-RSG.vmdx). It's a small RSG helper and may be worth a look later.

The base module already holds the minor nations, British, French and Italians. Their pieces were ignored.

Nothing from the download was executed. The module's Java classes (`cc/*.class`, `jep/*.class`) were not touched. All parsing used `python3 -I` from directories outside `extracted/`.

## 2. What the module contains (paths relative to `extracted/`)

| Path | Content | Use |
|---|---|---|
| `buildFile.xml` (2.4 MB) | Whole module definition: maps, boards, grids, 468 prototypes, the Parts palette (614 PieceSlots), 14 DrawPiles (504 CardSlots), 15 predefined setups | Source for counters, Fate cards, grids |
| `moduledata`, `info` | Version metadata | |
| `001 - Fat Lipki.vsav` … `012 - Misty Mountain.vsav` | Predefined setups of the 12 base scenarios. Zip → `savedGame`, obfuscated as `!VCSK` + 1-byte hex key + hex pairs XOR key | Source for scenarios.json |
| `startup` | Zip with the empty start position | not needed |
| `terrainMaps/Board N.txt` (1-12, 5W, 6r, 7-104, 12h) | Machine-readable terrain for every board (old VASSAL terrain plugin): `h,col,row,Terrain` / `e,c1,r1,c2,r2,Hexside` / `a,col,row,Line,flag` | Draft map terrain (see §5) |
| `images/Map1.png` … `Map12.png`, `Map5w.png`, `Map7-104.png`, `Map12h.png` | Map art, 3300×2600 RGBA, hex labels printed in every hex, numbered objective circles printed | Map transcription |
| `images/O-*`, `OA-*`, `Action-*`, `Event-*`, `dr*-*.png`, `H-*.png` | Fate-card face layers, 300×420. A card = order image + action/event layers + dice layer + random-hex layer | Card verification |
| `images/Ger|Sov|US …`, `Base * Front/Back.png`, `FP n`, `Range n`, `MP n`, `Morale n`, `Command n`, `Box *`, `Wpn MP n`, `Repair * X *.png`, `Radio-*.png` | Counter layers, 135×135. Counters are *composed* from value images, so there is no scan of the printed counters | |
| `images/CC German|Russian|American Order of Battle.jpg`, `CC * Support Table.jpg` | Official GMT 2006 RSG charts (included with GMT permission) | Cross-check and RSG |
| `images/German|Soviet|American OOB Table.png`, `* Support Table.png`, `RSG Leaders and Fortifications.png` | 2025 GMT versions, higher resolution | RSG transcription (not done yet) |
| `images/CC Terrain Summary Europe.jpg`, `CCE - Terrain Chart*.png`, `LOS Map.png`, `Misc CC Chart.png` | GMT terrain chart and LOS examples | For the rules-reference agent |
| `images/OBJ-A.png` … `OBJ-X.png` | 22 objective chits | Transcribed into counters.json |
| `images/Smoke 1..10.png`, `Foxholes/Trench/Bunker/Pillbox/Wire/Minefield*.png`, `Blaze.png` | Markers | counters.json `markers` |
| `cc/*.class`, `jep/*.class` | Custom Java code | not used |

## 3. What was extracted (`design/data/`)

Every file has a `_source` key and notes. The builders are in `design/tools/build/` and are re-runnable.

### `fate-cards.json`: complete for all 3 base decks (216 cards)

Each card records:
- id/number
- order, `order_also_playable_as_action` (Fire), action, `action_defender_only`, event
- dice `{white, red, total}`
- trigger (Jammed / Sniper / Event / Time / null)
- random_hex
- `breeze_direction` 1-6
- the module's layer and prototype names

**How it was derived:** cards are encoded as prototypes (`DR-w-r[j|s|e|t]`, `H-<hex>`, `O-…`, `A-…`/`AF-…`, `E-…`). Display names were read from the title bars of every layer image (montage at `<scratch>/work/ord_titles.png`, `act_titles.png`, `ev_titles*.png`).

**Checks that passed:**
- 72 cards per deck.
- Each ordered dice pair appears exactly twice per deck.
- Random hexes are unique per deck. German = odd-numbered hexes except A1/H1/O1. Russian and American = even-numbered hexes except A10/H10/O10.

**Order mix:**

| Deck | Fire | Move | Rout | Recover | Confusion | Art. Request | Advance | Art. Denied |
|---|---|---|---|---|---|---|---|---|
| German | 18 | 12 | 10 | 9 | 8 | 8 | 5 | 2 |
| Russian | 18 | 13 | 9 | 9 | 8 | 6 | 6 | 3 |
| American | 20 | 12 | 9 | 8 | 7 | 9 | 4 | 3 |

**Trigger counts per deck:** Time 2 (always on 6-6). Jammed 2/4/2, Sniper 7/8/6, Event 10/8/12 (German/Russian/American).

**Uncertain:** these are the module's encoding. Nothing was compared against physical cards. Spot-check about 10 cards per deck, especially the triggers.

### `counters.json`

For German, Russian and American: 19 leaders (incl. hero), squads, teams, weapons/ordnance/radios. Each has front and broken FP / range / movement / morale / command, boxed values, weapon portage penalty, min-max range band, smoke capability, and broken-weapon repair/eliminate numbers. Radio artillery FP and SMOKE were read from the radio images. The file also has fortification and marker values, the smoke-chit mix (hindrance 1-5 ×6, 6-10 ×4 = 50) and the objective chits A-X (objective → VP).

**How it was derived:**
- Front values are the start values of the dynamic properties in each PieceSlot.
- Broken value = front + the property's Ctrl-B (break) increment. Rally is the inverse.
- Boxes come from the `Box FRM|RM|R|FR|F|M` prototypes.

**Verified:** every front value and box of every squad, team and weapon matches the counter icons on the GMT 2006 and 2025 OOB/Support charts in the module. Leader values match the support tables and the RSG leader table.

**Not verified / missing:**
- **Broken-side values are module-only.** Notable patterns: broken leaders get command 0, range 0, move 1; broken morale can be higher than front morale.
- **The counter mix is not in the module.** Leaders are named, so `count: 1`. Everything else has `count: null` plus `max_needed_in_base_scenarios` as a lower bound.
- Privates (Pvt Herzog/Gelon/Adamson) have FP 2 and command 2, which looks odd. They are not on any support table.
- Panzerfaust and Molotov Cocktail are not on the 2006 charts. Panzerfaust is still used by scenario 11, where it sits in the *American* staging area.

### `scenarios.json`: all 12 scenarios

Per scenario:
- map (scenario 5 uses winter map 5w), year
- per side:
  - nation, posture (Defender/Recon/Attacker), troop quality, Orders value, hand size, surrender level
  - units in the staging area (counts), fortifications to place
  - reinforcements parked on the Time Track (by space)
- Initiative holder, time-marker start, sudden-death space, VP marker start
- the 5 printed objective hexes with initial control
- objective chits: fixed open/axis/allied, random-draw reminders, set aside
- items pre-placed on map hexes (scenario 11: 14 wire, 4 mines)
- non-default module flags

**How it was derived:** decoded saves (`<scratch>/work/saves/NNN.txt`) → `vassal_extract.py scenario`.

**Missing (not in the module):** set-up areas and edges, special rules, exit VP/edges, exact reinforcement rules. These need the scenario cards. Units are **not** on hexes in any setup; they sit on the off-board Stage Map.

### `maps.json`

- Common grid: formula, label scheme, neighbour table, hexside numbering, board edges.
- For each of the 15 boards: image path, size, scenarios using it, the 5 printed objective hexes (from the scenario VPO markers), and a summary of the module terrain draft.
- **Map 1 pilot:** full terrain (see §5).

## 4. Grid and hex-label facts (all 15 boards identical)

**Grid:**
- VASSAL `terrain.TerrainHexGrid`: dx=146.15829 px, dy=168.8 px, x0=79, y0=28, `sideways=false`.
- Flat-topped hexes in vertical columns. Circumradius 97.46 px.
- Combat-zone rectangle: 417,361 – 2666,2142.

**Labels:**
- Column letter A-O (15 columns) + row 1-10 (top to bottom), 150 hexes. Printed in every hex.
- VASSAL numbering: first=H, hType=A, hOff=-3, vType=N, vOff=-2, stagger=true.

**Hex centre:**
- x = 79 + (k+3)·dx, with k=0 for A.
- High columns A,C,E,…,O: y = 28 + (n+1)·dy + dy/2.
- Low columns B,D,…,N (half a hex lower): y = 28 + (n+2)·dy.
- Examples: A1 = (517.5, 450.0), B1 = (663.6, 534.4), O10 = (2563.7, 1969.2).

**Terrain-file coordinates:** col = k+3. Row = n+1 for high columns, n+2 for low columns.

**Hexsides:** 1=N, 2=NE, 3=SE, 4=S, 5=SW, 6=NW. This is the same 1-6 compass printed on every map and used by the Breeze event.

**Neighbour offsets [dk, dn]:**

| Column type | 1 (N) | 2 (NE) | 3 (SE) | 4 (S) | 5 (SW) | 6 (NW) |
|---|---|---|---|---|---|---|
| High (even k) | 0,-1 | +1,-1 | +1,0 | 0,+1 | -1,0 | -1,-1 |
| Low (odd k) | 0,-1 | +1,0 | +1,+1 | 0,+1 | -1,+1 | -1,0 |

**Edges:**
- The edges zig-zag; there are no half hexes.
- Top edge: row 1. Bottom edge: row 10, where the low columns protrude.
- Left edge: column A. Right edge: column O.
- Map art has no compass rose.

## 5. Map terrain: module draft and the Map 1 pilot

Every board has a complete 150-hex terrain file in the module. The terrain plugin itself is gone, but the data is intact. Run `vassal_extract.py terrain` to get it with hex labels.

**Vocabulary:** Open, Woods, Brush, Orchard, Field, Building, Water, Stream, Marsh, Gully, Road, Wood trail, Railway track, Hill, Hill+X, Rubble. Hexsides: Fence, Hedge, Wall, Cliff.

**What the files lack:**
- Elevation levels (only "Hill").
- Road, trail and railway connectivity: "Road" replaces the base terrain of the hex.
- Bridges and objectives.
- Possibly some streams or hexsides on other maps (not checked).

**Pilot, Map 1** (`maps.json` → `maps[map=1].terrain_pilot`):

All 150 hexes and all hexsides were checked visually on overlay sheets and zoomed crops. The pilot records:
- terrain, using the terrain at the centre dot
- features (Road, Trail)
- elevation (all 0; the map is flat)
- objectives 1-5 (E8, D3, H8, N5, F6)
- 21 fence hexsides
- 31 road hexside crossings plus 5 map-edge exits
- 4 trail crossings

Seven hexes are flagged `confidence: medium` with a note (D2, D3, H5, I2, N9, O9, F7).

**Result:**
- **The module file agreed 150/150 on hex type and 21/21 on fences.**
- About 25 minutes of work once the tools existed.
- Reliability is high for type and hexsides. Road connectivity needed manual tracing.

**Open rules question** for rules-reference: is a hex's terrain decided by the centre dot or by "any artwork in the hex, highest on the chart wins"? It matters for hexes like D3. The pilot keeps both readings via the notes.

## 6. Tools (`design/tools/`)

All tools read only the paths passed as arguments. Run them with `python3 -I`, never with cwd inside `extracted/`.

- **`vassal_extract.py`** subcommands:
  - `fate-cards` (clean) and `cards` (raw)
  - `counters`
  - `grids`
  - `decode-save <vsav> <out.txt>` (the `!VCSK` decoder)
  - `save-pieces <decoded> [--map MainMap]`: every piece with position, hex, properties and active layers
  - `scenario <buildFile> <decoded>`
  - `terrain <Board N.txt>`: hex-label JSON
  - `hex A1 …`: pixel centres

  It also contains a VASSAL SequenceEncoder decoder and prototype expansion, which are reusable.
- **`crop_hex.py <MapN.png> <HEX> <out.png> [--ring 0|1|2] [--scale 2]`**: enlarged crop with hex outlines, labels and hexside numbers 1-6. `--sheet <out> --cols A-C --scale 1.0` draws all hexes of 3 columns. Split the sheet into top and bottom halves before viewing.
- **`hex_colors.py <MapN.png> [--palette]`**: median colour around every centre dot. Hill shades are flat colours. On Map 12: level 1 ≈ (206,165,105), level 2 ≈ (156,121,87), level 3 ≈ (122,90,66), open ≈ (222,222,156). This gives an automatic first pass for elevation.
- **`compose_layers.py <out.png> <imgdir> <layer…>`**: rebuilds a card face from the layer list in `fate-cards.json` (`module.layers`), so you can view it.
- **`build/`**: the scripts that produced the four JSON files: `build_counters.py`, `build_scenarios.py`, `build_maps.py`, `pilot_map1.py`.

## 7. Instructions for follow-up transcription agents

**1. Map terrain, maps 2-12**

Suggested split into three agents:
- Agent A: maps 2 (hedges, orchards), 3 (walls, brush), 4 (gully, walls and fences).
- Agent B: maps 5 / 5w (stream, marsh, pond), 6 (town; a rubble terrain file 6r exists but has no image), 7 (forest, railway, trails).
- Agent C: hill maps 8, 9, 11, 12 (12 has cliffs) and 10 (town and water).

Procedure for each map:
1. `vassal_extract.py terrain "terrainMaps/Board N.txt"` → draft.
2. Run `hex_colors.py` to propose elevation levels, and calibrate the shade-to-level mapping per map from obvious hexes.
3. `crop_hex.py --sheet --cols A-C|D-F|G-I|J-L|M-O --scale 1.0`, split each sheet into halves, and check every hex and hexside against the draft.
4. Trace road, trail and railway crossings and cliff hexsides. Stream is a hex type on map 5.
5. Take the objective hexes from `maps.json` and confirm the printed circles.
6. Write in the Map 1 pilot schema.

Budget about 30 minutes per flat map and 45-60 minutes per hill or town map.

**2. RSG tables (not started)**

Transcribe:
- `German|Soviet|American OOB Table.png`: OB chits A-J and R-Z with dates, points, initiative, orders, quality, unit counts and surrender levels.
- `CC German|Russian|American Support Table.jpg`: die roll × item, VP cost and dates.
- `RSG Leaders and Fortifications.png`.

Before starting, compare the 2006 jpg and 2025 png versions; the 2025 charts may include later errata or units. Also check `CCE-RSG.vmdx`.

**3. Physical-source checks**

These cannot be closed from the module:
- the counter mix
- broken-side values
- the Pvt leaders
- Fate-card triggers
- scenario set-up zones and special rules (scenario cards)

## 8. Scratchpad index

| What | Path |
|---|---|
| Decoded saves | `<scratch>/work/saves/001.txt` … `012.txt` |
| Raw extractions | `<scratch>/work/cards_raw.json`, `counters_raw.json`, `scen/NNN.json`, `terr_<board>.json` |
| Pilot sheets | `<scratch>/work/pilot/` |
| Title montages | `<scratch>/work/*_titles*.png` |
