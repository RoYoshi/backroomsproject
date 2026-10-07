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

## Results (3B-F4)

*Filled in with the final candidate.*
