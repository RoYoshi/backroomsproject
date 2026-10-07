# Stage 3B final: full-map visual audit

This continues Stage 3B from the approved QA2 parent:
- **QA2:** `d124371`, tree `26edcf3`;
- **ancestors:** QA1 `24850ef`, BR-RoLE 1.0 `b86966b`, v23.3.6 `f2805bb`.

`main` and `br-role` are untouched.

## 3B-F0: parent verification

| check | result |
|---|---|
| local / remote `stage-3b-remaster` | both exactly `d124371224693f14b77510f1c206512297af9654`, tree `26edcf370771983a4d22b0a644905c7ad244fe5c`; workspace clean; nothing newer to reconcile |
| pack | SHA-256 `fe17253…` matches its `.sha256`; manifest of all 19 pack files OK |
| QA2 ZIP | SHA-256 `66fca30b…` as required; ZIP integrity OK (924 entries) |
| ancestry | QA2, BR-RoLE 1.0 and v23.3.6 are ancestors of HEAD |
| baselines | gameplay freeze **FREEZE OK**; Stage 3B unit **21 / 21**; BR-RoLE unit **32 / 32** |
| `main` / `br-role` | `7781e1a` / `b86966b`, untouched |

Evidence: `dev/stage-3b/evidence/f0/`.

## The production Level 0 (as the parent builds it)

`dev/stage-3b/evidence/f0/level0_map_ascii.txt` is the whole map, drawn from the shipped bundle and `world.js`:
- **96 × 72 cells** of 96 px;
- **12 rooms**, plus **376 corridor floor cells** in 4-cell-wide shafts and connectors;
- **3 308 floor cells**;
- **90 lamps**, **18 props**, **9 pillars** and **10 pits**.

| code | room | surface | lamps | physical things in it | QA2 |
|---|---|---|---|---|---|
| 01 | YELLOW HALL | carpet | 7 | L1 counter, G1 hole | **remastered** |
| 02 | REPEATING ROOMS | carpet | 13 | L2 "shelf", G2 hole, W1 window | old look |
| 03 | SEGMENTED ROOMS | carpet | 7 | L3 low wall, U2 bench, G3 hole | old look |
| 04 | HUMMING ROOMS | carpet | 8 | L4 counter, G4 hole | **remastered** |
| 05 | NORTH ROOMS | carpet | 6 | nothing | old look |
| 06 | LONG ROOM | **concrete** | 9 | **10 pits** in two rows of five | old look |
| 07 | BLACKOUT ZONE | carpet | 0 | U1 table | **remastered** |
| 08 | DAMP ROOMS | **wet tile** | 6 | L6 counter, G6 hole | old look |
| 09 | RED ROOMS | carpet | 6 | L7 low wall | old look |
| 10 | ARCH GALLERY | carpet | 12 | L5 railing, G5 hole, W2 window; two partitions with openings | old look |
| 11 | PILLAR HALL | carpet | 9 | 9 pillars | **remastered** |
| 12 | DEEP CARPET | **deep carpet** | 7 | L8 "machine" | old look |
| — | corridors | carpet | 0 | — | old look |

### Facts that shape the remaster

- **The LONG ROOM "columns" (`Mc`) are pits.**
  - The bundle carves them out of the floor, so they block walking. Its line-of-sight test `Hc` explicitly lets sight pass over them, and BR-RoLE builds its wall edges from `Hc`, so it casts nothing from them.
  - The legacy art painted them as black squares with a lit rim.
  - So the remaster must not paper them like walls. They are canon pits: "pits that lead deep into the floor … in a grid pattern".
- **ARCH GALLERY's "arches"** are pale outlines the legacy art strokes on the floor in two rows, regardless of the geometry. The room's real architecture is two north–south partitions with openings, the W2 window set in one of them, and the railing between.
- **Red tubes:** the legacy fixture art makes a lamp's tube red when `x ≥ RED.x0 && y ≥ RED.y0`. With no upper bound, DEEP CARPET's lamps are red too.
  - BR-RoLE colours no lamp red.
- **Legacy painting the remaster replaces:**
  - floor blots;
  - room tint rectangles laid over floor and walls alike (BLACKOUT black, RED red, DEEP CARPET brown, DAMP green);
  - glow ellipses and dark strips under every lamp;
  - the ARCH GALLERY outlines.
- **Legacy surfaces:** the legacy art shows one carpet everywhere, including LONG ROOM (concrete in gameplay) and DAMP ROOMS (wet tile in gameplay). The remaster's floors follow the gameplay surface.

### Temporary QA2 slice artifacts to resolve

| artifact | why it existed | full map |
|---|---|---|
| metal threshold strips at slice-room doorways | they hid the edge between the new carpet and the old corridor carpet | removed: the carpet runs on unbroken |
| `l0-legacy-carpet` (the old carpet redrawn under non-remastered floor) | the old carpet had to stay under rooms the remaster did not own | not needed once every floor cell is remastered |
| one chunk grid per room, clipped to the room's box | four separate rooms | one grid over the whole map: one textured layer, no overlapping room grids |
| walls drawn by the room whose box they are in | four isolated rooms | each wall face is drawn by the zone whose floor it faces, so every face is drawn once, in the right finish |

## Plan (3B-F1 … F3)

**Zones:**
- the 12 rooms, plus `zone:corridors` (every floor cell outside a room);
- each zone resolves an archetype from `assets/level0_visuals.js`;
- the zone's art is built once as a source container, as in QA2.

**One bake grid over the whole map:**
- 384 px chunks;
- each chunk bakes every zone source that has content in it into **one** texture, drawn as one quad;
- nothing is drawn per frame except visible chunk quads, as in QA2.

**Transitions:**
- **Carpet:** world-anchored (one continuous piece) in every zone.
- **Tone:** the corridor side of a doorway blends toward the room's carpet tone, so the room interiors keep their QA2 look exactly.
- **Damp:** room damp fades out at doorways, so a damp patch is never cut off by a zone edge.
- **Red shift:** corridors approaching RED ROOMS shift progressively toward red (canon: you "gauge distance" by it).

**Surfaces:**
- every zone's floor and wall runs join the QA2 receiver: surface-local, clipped, baked;
- static marks only, no dynamic blood.

**Special rooms and props:** per `STAGE_3B_FINAL_PROP_CANON_AUDIT.md`.

**Rendering (F3):**
- **Remove duplicate work:** once every floor and wall-facing cell is covered by baked chunks, the legacy carpet sprite and the legacy level art beneath them draw pixels nobody can see. Hiding them while the remaster shows removes about a full screen of hidden fill. Remaster off shows them again, unchanged.
- **Bake:** bounded tier caches, prewarm one ring ahead, measured at LOW / MEDIUM / HIGH.

## Checkpoints

Each is pushed to `stage-3b-remaster` and verified on GitHub (`dev/stage-3b/verify_remote.py`: remote tip, commit, tree and parent equal the local ones; `main` and `br-role` untouched; BR-RoLE 1.0 an ancestor).

| checkpoint | commit | tree | checks |
|---|---|---|---|
| 3B-F0 parent verification, inventory, canon audit | `a3430f6` | `c32adf3` | freeze OK; unit 21/21; BR-RoLE 32/32 |
| 3B-F1 corridors and common rooms | `f4fb0b5` | `283701d` | freeze OK; unit 23/23; BR-RoLE 32/32; smoke 9/9 |
| 3B-F2 special rooms, the remaining props | `6e9f6a1` | `b8c2246` | freeze OK; unit 24/24; BR-RoLE 32/32; smoke 9/9 |
| 3B-F3 full-map rendering optimization | `9551f97` | `2b217a6` | freeze OK; unit 25/25; BR-RoLE 32/32; smoke 9/9 |
| 3B-F4 final validation, the human-QA package | this candidate: commit and tree in `STAGE_3B_FINAL_PACKAGE_RECEIPT.txt` | | see "Results" |

## 3B-F1 and 3B-F2: what was built

**Zones and ownership (F1).**
- The remaster draws zones: the 12 rooms, plus the corridor network split into its **17 connected pieces** (each compact, with its own traffic lanes).
- A zone owns its floor cells. A wall face is drawn once, by the zone whose floor it faces, in that space's finish (unit check R14: all 1 489 faces that look onto floor, each exactly once).
- **One bake grid** over the whole map (384 px chunks). A chunk bakes every zone with content in it into one texture, so the screen still shows one quad per visible chunk.

**Doorways (F1, fixed in F2).**
- The carpet is one world-anchored texture in every carpeted zone, so it runs on unbroken.
- The wear / damp maps blend to shared values within 1.5 cells of a doorway; floor marks never cross into another zone (R15).
- A corridor takes the colour of the room it leads into. **F2 fix:** every room a corridor reaches now counts, and the two nearest doorways blend near the point midway between them, so at each doorway the corridor matches that room exactly. (F1 multiplied the rooms' tints, so a short corridor between RED ROOMS and DEEP CARPET carried red right up to DEEP CARPET's door.)
- **F2 fix, the wear map's edges:** the map is sampled linearly and Pixi repeats a matrix-mapped texture, so a zone's last half-texel blended with whatever lay beyond it (a wall's neutral texel, or the far side of the map). At a corridor tinted toward a room, that showed as a thin light line at the doorway. The texels around a zone's own cells now take their owned neighbours' values, and each map has a one-texel border. A unit check (R15) now samples the maps as the GPU does, half a pixel either side of every doorway: within 0.5 %.

**The special rooms (F2), per `STAGE_3B_FINAL_PROP_CANON_AUDIT.md`.**
- **LONG ROOM:** a warm concrete slab (trowel swirls, saw-cut joints, faint old adhesive, hairline cracks, damp); its 10 pits drawn on the game's pit cells as voids with a broken lip, over the slab's own concrete, with grit beside them.
- **DAMP ROOMS:** old yellowed vinyl tile under standing water, missing and lifted tiles on the tile grid, mildew, heavy damp wicking up the walls; the counter's kick panel swollen and tide-marked; the crawl hole's insulation sodden.
- **RED ROOMS:** a deep brick-red carpet with a coarse, matted, sticky pile and sticky patches; the paper peeling to crimson. The corridors leading there shift toward red, grow the coarse pile and show crimson peel as you approach (canon: you "gauge distance" by them).
- **ARCH GALLERY:** pale paper; its two partition openings found and drawn as archways (pale plaster reveals on the jambs, small pilasters, a faint shade beneath the arch; nothing overhead); the steel guard rail; the arched window.
- **DEEP CARPET:** a deeper, shaggier pile, flattened along the traffic lanes; the dead mechanical cabinet and the condensate soaked into the pile beside it.
- **Carpet meeting a hard floor** (LONG ROOM, DAMP ROOMS): the carpet's own bound edge on its side and the pile's soft shade on the slab's. No metal strip.
- With every room remastered, no floor is left to the legacy carpet copy (R16).

**QA2 parity.** The four QA2 rooms render as approved:
- **Interiors:** identical except the wanderer's breathing.
- **The F2 edge fix:** it changes a one-texel outline at the base of their walls, under BR-RoLE's grounding shadow (up to 0.5 % of pixels by a few levels in the bare-material view; nothing visible in play).
- **Beyond their doorways:** the corridors are now remastered.

Evidence: `dev/stage-3b/evidence/f1/qa2_parity.txt`, `evidence/f2/`.

## 3B-F3: the rendering, briefly

Details and measurements: `STAGE_3B_FINAL_RENDERING_OPTIMIZATION.md`.
- **The legacy level art rests while the remaster shows.** It drew 0.3–1.5 screens of hidden pixels a frame, depending on the pose. The bare scene is pixel-identical with it kept or resting (7 poses).
- **Tier changes rebuild in the background** and swap in when ready (no more 1.1–1.6 s freeze).
- **Textures upload ahead of need** on quiet frames.

## Results (3B-F4)

### What was looked at

All captures come from the game in headless Chromium at 1280 × 720 (software rendering), from a frozen, staged world. Sheets are under `dev/stage-3b/evidence/f4/`.

| set | what | where |
|---|---|---|
| **the whole map at once** | every zone's bare materials in one picture (no lighting, no actors), legacy beside remaster, plus LOW and HIGH | `overview/` (the DEV view `__l0v.dev.overview`, tool `overview_3b.js`) |
| **23 views across the map**, remaster OFF and ON (MEDIUM) | each sheet has three rows: as played, the same ×2.5, and the bare materials | `look/` |
| **LOW / MEDIUM / HIGH** | 7 views at all three tiers | `tiers/` |
| **readability** | 10 poses with Hounds, Smilers, another wanderer, the cartograph and crawl holes; ON and OFF at the same instant | `readability/` (tool `readability_3b.js`) |
| **moving through the map** | two routes across eight rooms and their doorways, at about running speed, at each tier | `STAGE_3B_FINAL_PERFORMANCE.md` (tool `walk_3b.js`) |

The 23 views:
- **every room type:**
  - the QA2 rooms: YELLOW HALL, HUMMING, BLACKOUT with the flashlight, PILLAR HALL;
  - NORTH, REPEATING (the window), SEGMENTED (the bench, the knee wall);
  - LONG ROOM (pits), DAMP (the counter), RED, ARCH GALLERY (archways, rail), DEEP CARPET (the cabinet);
- **corridors:** the hub;
- **transitions:**
  - corridor → LONG ROOM's concrete;
  - LONG ROOM → PILLAR HALL;
  - corridor → DAMP's tile;
  - DAMP → RED (the red approach);
  - RED → DEEP CARPET;
- **a global blackout with only your flashlight:** YELLOW HALL, PILLAR HALL, RED ROOMS.

### What I found

- **Cohesion.**
  - **The map overview:** one Level 0. The same carpet and paper run through every corridor and doorway, and the special rooms stand out only by their own material: concrete, tile, red, deep pile.
  - **No seams:** no strip, line or chunk edge is visible at any doorway in the captures (unit check R15 samples every doorway as the GPU does).
- **QA2's four rooms** are unchanged since 3B-F2. There, a one-texel outline at their wall bases changed with the doorway-seam fix (see "QA2 parity" above).
- **LOW / MEDIUM / HIGH:** the same rooms, materials and props at each tier.
  - LOW draws fewer small marks and fewer texels; HIGH is MEDIUM with finer textures and the same marks.
  - **One inconsistency found and fixed in 3B-F4:** at LOW, the pile overlays (RED ROOMS' coarse pile, DEEP CARPET's deep pile) came out twice as coarse as at MEDIUM. Their pattern followed the texture's texel count.
    - **The fix:** LOW now gets MEDIUM's exact pattern, filtered to its smaller texture (unit check R18).
    - **Unchanged:** MEDIUM and HIGH are byte-identical to before.
    - Before and after: `tiers/red-low-overlay-before-after.jpg`.
- **Blackout and the flashlight:** with every lamp out, the remastered rooms look as dark as the old ones. Your beam is the only light, and nothing new glows or reads in the dark.
- **Readability:** see `STAGE_3B_FINAL_PROP_CANON_AUDIT.md`, "Final pass". In short:
  - Hounds, Smilers, another wanderer, the cartograph and the crawl holes all read with the remaster on.
  - **Brightness:** the scene's mean brightness ON / OFF is within about ±15 % at every pose (`readability/mean_luma.txt`).
  - **RED ROOMS** is the exception, about 26 % darker: its floor is the deepest colour on the map.
- **Kept, but flagged for your verdict:**
  - RED ROOMS' depth of colour;
  - DAMP ROOMS' missing tiles (the darkest marks on any floor);
  - the fallen ceiling tiles (from QA2).

### Harness notes (capture only, no game change)

- **The danger flicker:** near a monster, the game's danger flicker (`#light` opacity) and screen shake are random per frame. During each ON / OFF pair of the readability captures they are pinned, so the two shots differ only by the remaster.
- **Exit walls:** the server drops a few glitched exit walls at random spots in every world. Their full-screen tear covered one early archway capture, so the art captures pin the page's list of them empty (`--noglitch`).
- **The cartograph:** the game's one item lies at a random spot, so the readability poses pin it beside you. It is still the game's own drawing.

### The candidate's checks

Logs: `dev/stage-3b/evidence/f4/checks/`. The receipt (`STAGE_3B_FINAL_PACKAGE_RECEIPT.txt`) repeats the freeze on the extracted ZIP.

| check | result |
|---|---|
| gameplay freeze | **FREEZE OK**: all 13 protected files byte-identical; the two presentation files undo to the parent |
| Stage 3B unit | **26 / 26**, with R18 new (LOW keeps MEDIUM's patterns) |
| BR-RoLE unit | **32 / 32** |
| browser smoke | **9 / 9** (see below) |
| `main` / `br-role` | untouched (`7781e1a` / `b86966b`) |
| scope since QA2 | only the remaster module, its data, `dev/stage-3b` and the `STAGE_3B_FINAL_*` documents changed |

**The smoke run:**
- **The flaky first run:** S09 read 0 changed pixels after stamping its two test marks on a freshly opened second page (`checks/smoke_3b_run1_S09_flake.log`). Nothing in S09's path changed in 3B-F4.
- **The fix:** S07, which runs just before S09 on that page, now waits until F8 has turned the remaster back on. S09 also logs the page's state when it reads the picture.
- **Two later runs:** 9 / 9 each, the marks showing (`checks/smoke_3b.log`).
