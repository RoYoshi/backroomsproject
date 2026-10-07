# Stage 3B final: performance (the whole of Level 0)

**Status:** your real-machine test decides. Nothing here measures your hardware, and nothing here says performance is accepted.

## The short version

- **Per frame, the full-map remaster now costs less to draw than the old look did, at every pose measured.**
  - **Fill:** the Pixi scene covers the screen **1.3–2.0 times** with the remaster on, against **2.2–3.4 times** for the old look (12 poses, MEDIUM).
  - **The reason:** the old level art underneath no longer draws while the remaster shows.
  - **Per tier:** LOW, MEDIUM and HIGH cost the same per frame: one baked layer.
- **Here, with software rendering:**

| | old look | remaster on |
|---|---|---|
| draw calls per frame | 7.7 | 5.5 |
| Pixi scene time | | 32–46 % less |
| the page's real frame interval | | 25–48 % shorter |
| Graphics instructions the CPU re-transforms each frame | about 14 500 | 90–180 |

- **Tier changes no longer freeze.** The new tier is built in the background while the old one stays on screen. Before 3B-F3, the game froze for 1.1–1.6 s.
- **Moving through the map:** see "Moving through the map" below. Chunks bake as they come into view, a ring ahead.
- **The cost that grew:** texture memory and the build at load, with the new materials.
  - textures: MEDIUM 5.83 MPx (QA2 2.58), LOW 2.57, HIGH 7.31;
  - the first build: about 1.4–1.5 s here (QA2 0.68 s), during loading.

## How it was measured

- **Tools:** `dev/stage-3b/perf_3b.js` and `dev/stage-3b/walk_3b.js`. The page is headless Chromium at 1280 × 720, DPR 1, in a staged, frozen world with no monsters (the walk adds two).
- **The comparison:** the same pose, tier and viewport, with the remaster off (the exact old look, `?remaster=off` via the DEV switch) and on.
- **Overdraw (fill):** how many times the Pixi scene's layers cover the screen, counted exactly from the shapes every 4 px. It is noise-free, and it is what costs a real GPU.
- **Scene time:** the Pixi scene rendered with the GPU synced (median of 10), while the camera moves by half a pixel each time, as it does in play.
- **Frame interval:** the page's real time between frames over 6 s, with BR-RoLE and everything else included.

> **Caveat:** this container has no GPU. Chromium renders in software (SwiftShader), so a frame takes about 230–480 ms here. Absolute times mean nothing for your PC; the **relative** numbers and the overdraw do. Run-to-run noise on the software timings is about ±10 %.

Raw JSON: `dev/stage-3b/evidence/f4/perf/`.

## Overdraw at MEDIUM, every pose (screens of pixels; lower is cheaper)

| pose | old look | remaster on | the remaster's own layer |
|---|---|---|---|
| YELLOW HALL (spawn) | 2.20 | **1.89** | 1.01 |
| HUMMING ROOMS (counter) | 2.44 | **1.91** | 1.01 |
| BLACKOUT ZONE (table, flashlight) | 3.16 | **1.81** | 1.02 |
| PILLAR HALL | 2.29 | **1.94** | 1.03 |
| corridor between DAMP and RED | 2.67 | **1.61** | 1.01 |
| LONG ROOM | 2.51 | **2.01** | 1.02 |
| RED ROOMS | 3.36 | **1.92** | 1.01 |
| DEEP CARPET (cabinet) | 3.36 | **1.95** | 1.01 |
| ARCH GALLERY (north) | 2.16 | **1.83** | 1.01 |
| DAMP ROOMS (counter) | 3.42 | **1.93** | 1.02 |
| west corridor | 2.19 | **1.26** | 0.81 |
| doorway: corridor → DAMP ROOMS tile | 2.89 | **1.90** | 1.01 |

- **The remaster's own layer** is one screen: the visible baked chunks, plus the fixtures (under 0.03).
- **The rest** (0.45–0.99) is the game's other shapes, which Stage 3B does not draw or change: BR-RoLE's, the actors' and the game's other layers.
- **LOW and HIGH give the same numbers.** Checked at YELLOW HALL (1.89 at all three tiers) and HUMMING ROOMS (1.91).

## Scene time and frame interval (software rendering, relative)

**MEDIUM:**

| pose | Pixi scene off → on | page frame interval off → on | draw calls off → on |
|---|---|---|---|
| YELLOW HALL | 277 → 189 ms (**−32 %**) | 367 → 277 ms (**−25 %**) | 7.7 → 5.5 |
| BLACKOUT ZONE | 365 → 211 ms (**−42 %**) | 409 → 230 ms (**−44 %**) | 7.7 → 5.5 |
| PILLAR HALL | 358 → 193 ms (**−46 %**) | 369 → 276 ms (**−25 %**) | 7.7 → 5.5 |
| RED ROOMS | 380 → 210 ms (**−45 %**) | 441 → 230 ms (**−48 %**) | 7.7 → 5.5 |
| doorway into DAMP ROOMS | 379 → 211 ms (**−44 %**) | 413 → 236 ms (**−43 %**) | 7.7 → 5.5 |

**LOW and HIGH** (two poses):

| pose, tier | fill off → on | Pixi scene off → on | textures, marks |
|---|---|---|---|
| YELLOW HALL, LOW | 2.20 → 1.89 | 322 → 208 ms (**−36 %**) | 2.57 MPx, 572 |
| YELLOW HALL, HIGH | 2.20 → 1.89 | 336 → 234 ms (**−30 %**) | 7.31 MPx, 998 |
| PILLAR HALL, LOW | 2.29 → 1.94 | 600 → 291 ms (**−52 %**) | 2.57 MPx, 572 |
| PILLAR HALL, HIGH | 2.29 → 1.94 | 478 → 308 ms (**−35 %**) | 7.31 MPx, 998 |

These two rows ran slower overall than the MEDIUM ones; the noise here is large. Compare within a row only.

**Notes:**
- **JavaScript per render:** 0.2–0.5 ms, on or off. The CPU side of drawing was never the cost.
- **Texture binds:** 2.2 per frame becomes 3–12, one per visible chunk texture. On a GPU that is cheap at this scale.
- **BR-RoLE's own time:** it varies between runs here (5–17 ms a frame), with no direction between remaster on and off, because software rendering makes it share the CPU with the scene. Its output is byte-identical with the remaster on and off (smoke check S03).

## Moving through the map

**The walk** (`walk_3b.js`): each frame moves you along a route of floor cells at about running speed (380 px/s). A Hound and a Smiler stand near the start. Each route ran with the remaster off, then on, at each tier.
- **Route A** (YELLOW HALL → REPEATING → SEGMENTED → ARCH GALLERY): carpet, five doorways.
- **Route B** (BLACKOUT ZONE → DAMP → RED → DEEP CARPET): carpet into tile, the red approach, into deep pile.

| route, tier | frame interval, median: off → on | chunks baked on the way | most in one frame | bake time in one frame: 95th pct / max |
|---|---|---|---|---|
| A, LOW | 422 → **310 ms** | 67 | 2 | 2.1 / 2.5 ms |
| A, MEDIUM | 391 → **295 ms** | 67 | 3 | 1.8 / 4.8 ms |
| A, HIGH | 432 → **325 ms** | 73 | 2 | 2.7 / 5.1 ms |
| B, LOW | 433 → **279 ms** | 67 | 1 | 1.0 / 2.8 ms |
| B, MEDIUM | 430 → **330 ms** | 64 | 3 | 1.6 / 5.8 ms |
| B, HIGH | 474 → **345 ms** | 65 | 2 | 1.8 / 3.9 ms |

- **Even while moving and baking**, the remaster's frames were shorter than the old look's.
- **Baking:** at most 3 chunks and under 6 ms of baking in any one frame, in software. On a GPU a chunk bake is far cheaper.
- **Memory:** at most 22–28 chunks were held while moving (the ones in view, the ring ahead, and the cache). The visible ones never exceeded 12.
- **An upper bound:** frames here last about 300 ms, so you cross about 110 px of the map per frame, 20 times more than at 60 fps. More chunks enter the view in one frame here than ever would in play. At 60 fps, the ring ahead bakes one chunk per quiet frame (two on HIGH) long before it is needed.

## Tier changes

**How it works:** changing LOW / MEDIUM / HIGH builds the new tier in the background, a quarter of a frame at a time (6 ms a frame at 60 fps). The old tier stays on screen until the new one swaps in, in one step.

**Measured here** (the six tier changes of the walk, the smoke check, and the 3B-F3 run):

| | LOW | MEDIUM | HIGH |
|---|---|---|---|
| steps | 667 | 822 | 1 083 |
| frames to rebuild | 16–32 | 23–30 | 32–43 |
| the swap | 10–29 ms | 8–22 ms | 9–34 ms |
| the job's largest share of one frame | 49–107 ms | 48–56 ms | 53–96 ms |

- **Before 3B-F3:** the same rebuild ran in one frame, 1.1–1.6 s here.
- **The largest single steps** (19–51 ms; one outlier of 98 ms):
  - the traffic lanes of a big room;
  - one wallpaper texture.

  Frames here last 280–470 ms, and the CPU is shared with the software renderer, so these step times run long.
- **On a real machine** expect a frame or two to run somewhat long while the new tier builds, not a freeze. That is why the human-QA guide asks you to try a tier change.

## Memory and build, per tier

| | LOW | MEDIUM | HIGH |
|---|---|---|---|
| source textures (all zones) | 2.57 MPx | 5.83 MPx | 7.31 MPx |
| static marks | 572 | 998 | 998 |
| bake density (texels per world px) | 0.6–1.0 | 0.75–1.5 | 0.9–2.0 |
| chunk cache | 12 | 20 | 20 |
| baked chunks kept by the cache, at most (DPR 1 / DPR 2) | 1.8 / 1.8 MPx | 4.1 / 6.6 MPx | 4.1 / 11.8 MPx |

- **While you move,** the chunks in view and the ring ahead are kept as well: up to 22–28 chunks in the walk, about 3–6 MPx at DPR 1.
- **The first build at load** (MEDIUM, the whole map, browser here): about 1.4–1.5 s, of which textures 0.67 s and zones 0.72 s. QA2's four rooms took 0.68 s.
- **LOW keeps the same identity** with fewer texels and fewer small marks (`STAGE_3B_FINAL_VISUAL_AUDIT.md`, results).

## What you should measure (the decision is yours)

Follow "Performance" in `STAGE_3B_FINAL_FULLMAP_HUMAN_QA.md`.
- **Toggles:** F8 on/off at four spots, the `scene GPU` number where your browser offers it, a walk and a run through a few rooms, and one or two tier changes.
- **Please send:** your GPU, browser and tier, with the numbers or "no difference I can feel".

## Known limits

- **SwiftShader only.** None of this is your GPU, your CPU or your screen.
- **The first build at load** is still made at once, during loading.
- **A tier change** may make a frame or two run long while the new tier builds. It never freezes.
- **Out of scope here:**
  - BR-RoLE's lighting cost (BR-RoLE is protected);
  - the camera scale: `server.js` doesn't serve `camera_policy.js`, so the bundle uses its fixed fallback scale. This is reserved for Stage 3B-N.
