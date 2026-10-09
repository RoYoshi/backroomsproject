# Stage 3B Final Visual Polish — Performance

**Law:** visual parity first, performance through engineering. MEDIUM is the primary target.

> **Software rendering only.** This machine renders with SwiftShader (2 CPUs, no GPU). A 1920×1080 page frame takes hundreds of milliseconds here, and canvas fills cost far more than on a GPU-backed canvas. **No real-GPU numbers are claimed.** Only the two builds measured against each other on the same scenes mean anything. The machine's speed drifts by tens of percent over an hour, so the builds are interleaved scene by scene (parent, QA2, QA2, parent; a fresh server and browser each time) and medians are compared (`dev/stage-3b-l-qa2/perf_ab_qa2.js`).

## What each fix costs, and the engineering in it

### The corner fix — the sight polygons (`Hl`, every frame, CPU)

The new darkness clip follows each face's band. The engineering that keeps it cheap:
- the clip **reuses the entity mask's rays**: `Uc` is exact and its tables static, so the result is the same;
- the faces are indexed once (by 96 px cell and by 768 px block, with stamps instead of sets);
- a pillar gets rays only at its **outline corners**; its far and hidden corners are skipped;
- a ray continues into a neighbouring face's band only where it leaves its own band across a mitre;
- a convex corner's L (Q3b) is chosen per frame from the stretches already found: one more ray per corner whose two faces are turned to the player.

Chromium micro benchmark, both polygons per frame, parent vs QA2 interleaved over 9 rounds (`perf_hl_qa2.js`; `evidence/q3/perf_hl_micro.json`):

| path | parent ms / frame (median; worst round) | QA2 | difference | rays / frame parent → QA2 |
|---|---|---|---|---|
| an empty corridor, walked | 0.123 (0.201) | 0.138 (0.205) | +0.014 | 291 → 326 |
| YELLOW HALL walked across (partitions, corners) | 0.123 (0.157) | 0.150 (0.234) | +0.027 | 286 → 335 |
| PILLAR HALL centre (every pillar in reach) | 0.123 (0.196) | 0.191 (0.244) | +0.069 | 288 → 468 |
| circling a pillar, 45 px from its centre | 0.138 (0.192) | 0.204 (0.239) | +0.066 | 266 → 399 |

The clip casts more rays (its band corners, a pillar's outline corners, a convex corner's L) and walks them through the bands: **+0.01 to +0.07 ms per frame**, the most beside the pillars.

### The corner fix — the receivers (BR-RoLE)

- The pieces of a band that reach over a convex corner's mitre (up to 46 px along a side face) are drawn inside its mitred outline (Q3b; before, only the last piece was), under one clip for each end's pieces (Q3c: the same pixels, fewer clips).
- Pieces are sized by how fast the facing changes: the same count where the light is far, up to 4× where it is close to a wall.

For a lamp, this happens once, when its cache is built (part of warm-up). For a carried light it happens every frame, for the faces it reaches.

### The infrared (BR-RoLE, only while night vision is on)

- **One light per emitter the sensor sees**, drawn like a carried light: field, shadows from the lens at the tier's source points, the faces it reaches, the lens spill.
- **NV off:** nothing is computed. The emitter list is empty, so no BR-RoLE work runs (N6: 0 infrared lights drawn).
- **NV on:** this replaces the bundle's six stacked fans (each a 24–48-ray `Uc` polygon plus a gradient fill) and the lens disc, which no longer draw.
- The camcorder has no visible beam, so with night vision on the infrared takes the place of a flashlight's work.

## After warm-up: parent `d3ec226` vs QA2, MEDIUM (interleaved, medians of 2 runs each; `evidence/q3/perf_ab.*`)

The final code (Q3c `1972506`).

| scene | | page frame ms | drawLight ms | Hl ms | IR ms | BR ms |
|---|---|---|---|---|---|---|
| A YELLOW HALL (NV off) | standing | 688.0 → 753.0 (+65.0) | 44.50 → 44.06 (−0.44) | 0.11 → 0.54 | 0.00 → 0.00 | 50.62 → 50.22 |
| A YELLOW HALL (NV off) | walking | 701.8 → 730.1 (+28.4) | 54.34 → 51.67 (−2.67) | 0.28 → 0.42 | 0.00 → 0.00 | 57.03 → 55.59 |
| D PILLAR HALL (NV off) | standing | 715.3 → 754.8 (+39.5) | 46.47 → 45.03 (−1.44) | 0.18 → 0.25 | 0.00 → 0.00 | 51.48 → 50.86 |
| D PILLAR HALL (NV off) | walking | 713.7 → 766.8 (+53.0) | 42.69 → 49.38 (+6.69) | 0.41 → 0.68 | 0.00 → 0.00 | 46.67 → 54.67 |
| H long corridor (NV off) | standing | 487.9 → 499.4 (+11.6) | 37.33 → 35.24 (−2.09) | 0.15 → 0.44 | 0.00 → 0.00 | 39.90 → 38.08 |
| H long corridor (NV off) | walking | 551.1 → 550.3 (−0.8) | 47.11 → 39.77 (−7.34) | 0.18 → 0.46 | 0.00 → 0.00 | 49.72 → 42.41 |
| E BLACKOUT ZONE, flashlight (NV off) | standing | 683.0 → 682.9 (−0.1) | 41.52 → 45.09 (+3.57) | 0.06 → 0.45 | 0.00 → 0.00 | 45.15 → 48.96 |
| E BLACKOUT ZONE, flashlight (NV off) | walking | 664.9 → 696.5 (+31.7) | 26.39 → 27.47 (+1.08) | 0.07 → 0.70 | 0.00 → 0.00 | 31.57 → 32.21 |
| K flashlight across a convex corner (NV off) | standing | 724.1 → 723.4 (−0.7) | 25.59 → 26.25 (+0.66) | 0.14 → 0.10 | 0.00 → 0.00 | 28.64 → 29.06 |
| K flashlight across a convex corner (NV off) | walking | 760.4 → 808.9 (+48.5) | 30.59 → 33.59 (+3.00) | 0.10 → 0.39 | 0.00 → 0.00 | 34.21 → 36.54 |
| NA YELLOW HALL, NV on, IR LOW | standing | 893.9 → 943.2 (+49.4) | 46.73 → 73.56 (+26.83) | 0.16 → 0.21 | 0.53 → 22.80 | 51.01 → 77.84 |
| NA YELLOW HALL, NV on, IR LOW | walking | 947.9 → 990.9 (+43.0) | 51.77 → 67.30 (+15.53) | 0.82 → 0.50 | 0.35 → 19.54 | 50.26 → 96.70 |
| NB BLACKOUT ZONE, NV on, IR HIGH | standing | 837.5 → 804.1 (−33.3) | 5.62 → 49.04 (+43.42) | 0.21 → 0.51 | 1.03 → 43.36 | 5.14 → 54.33 |
| NB BLACKOUT ZONE, NV on, IR HIGH | walking | 831.1 → 837.4 (+6.2) | 3.27 → 48.34 (+45.07) | 0.13 → 0.59 | 0.30 → 41.94 | 4.64 → 54.72 |
| NP PILLAR HALL, NV on, IR LOW | standing | 982.3 → 1004.4 (+22.1) | 52.45 → 74.12 (+21.67) | 0.11 → 1.00 | 0.65 → 20.38 | 54.51 → 76.02 |
| NP PILLAR HALL, NV on, IR LOW | walking | 1019.2 → 1007.1 (−12.1) | 61.33 → 58.89 (−2.44) | 0.16 → 0.72 | 0.44 → 14.49 | 62.54 → 80.55 |

`drawLight` is the game's whole darkness overlay per frame: BR-RoLE, the line-of-sight clip and, in the parent, the camcorder's infrared fans. `Hl` is the two sight polygons. `IR` is the infrared alone: QA2's `irLight`, the parent's `drawFan`. These come from the DevTools sampling profiler (100 µs), per rendered frame. "BR" is BR-RoLE's own counter. "page" is the frame interval (rAF).

### NV off, again with 4 runs per build (`evidence/q3/perf_ab_off4.*`)

Each run is a fresh server and browser, alternating parent and QA2:

| scene | | page frame ms, 4 runs each (parent \| QA2) | median | drawLight ms, 4 runs each (parent \| QA2) | median |
|---|---|---|---|---|---|
| A YELLOW HALL (NV off) | standing | 706 773 668 720 \| 730 779 724 703 | 713 → 727 (+2.0 %) | 44.2 44.5 40.7 40.6 \| 44.2 40.2 44.6 50.3 | 42.5 → 44.4 |
| A YELLOW HALL (NV off) | walking | 735 721 678 696 \| 716 753 672 697 | 709 → 706 (-0.3 %) | 40.2 45.4 43.6 42.8 \| 59.8 48.5 46.6 48.8 | 43.2 → 48.7 |
| D PILLAR HALL (NV off) | standing | 673 748 734 721 \| 753 721 750 731 | 728 → 740 (+1.7 %) | 44.8 51.7 46.8 44.9 \| 45.6 46.0 46.7 42.9 | 45.9 → 45.8 |
| D PILLAR HALL (NV off) | walking | 765 744 746 717 \| 727 743 781 835 | 745 → 762 (+2.3 %) | 45.6 44.8 45.2 43.8 \| 44.5 44.3 44.6 44.7 | 45.0 → 44.5 |
| H long corridor (NV off) | standing | 497 489 505 516 \| 490 513 508 493 | 501 → 500 (-0.1 %) | 36.6 37.1 36.1 32.7 \| 35.4 39.9 33.0 36.3 | 36.4 → 35.8 |
| H long corridor (NV off) | walking | 581 535 539 539 \| 514 540 541 519 | 539 → 530 (-1.8 %) | 44.8 41.9 47.5 42.3 \| 37.9 40.2 39.5 42.2 | 43.6 → 39.8 |
| K flashlight across a convex corner (NV off) | standing | 768 732 699 694 \| 756 739 730 725 | 715 → 735 (+2.7 %) | 29.8 25.7 25.7 24.7 \| 26.9 27.6 26.1 26.3 | 25.7 → 26.6 |
| K flashlight across a convex corner (NV off) | walking | 706 783 726 737 \| 730 724 748 798 | 732 → 739 (+1.0 %) | 32.3 30.2 31.1 29.8 \| 31.2 30.0 31.7 31.5 | 30.7 → 31.3 |

## In short

**NV off: no material regression.**
- The page frame medians differ by −1.8 % to +2.7 % (mean +0.9 %). Two runs of the same build differ by up to 15 % here (A, parent: 668 to 773 ms).
- drawLight is flat in seven of the eight measurements (−3.7 to +1.9 ms).
- The one consistent increase is YELLOW HALL walked across with the player's own light: **+5.5 ms of drawLight** (the median; all 4 QA2 runs above all 4 parent runs). The light sweeps past the partitions' corners, where the face pieces are cut finer (Q1: by how fast the facing turns, up to 4×) and clipped at the mitres. The page frame there is unchanged (−0.3 %).
- The clip itself (`Hl`): +0.0 to +0.6 ms per frame in the profile, +0.01 to +0.07 ms in the micro benchmark.

**NV on: bounded.**
- The infrared costs **15–23 ms per frame at LOW and 42–43 ms at HIGH** in the profile. The parent's fans cost under 1 ms, but drew no shadows, lit no walls, and stepped.
- drawLight rises by up to 27 ms at LOW in the lit halls. In the BLACKOUT ZONE at HIGH, where it is the only light, it rises by 43–45 ms.
- For scale: the whole overlay with a flashlight in the BLACKOUT ZONE (scene E) costs 26–45 ms.
- The page frame moves −4 % to +6 % in these runs.
- It stays bounded:
  - one light per emitter the sensor sees (yours, then other camcorders within the tier's peer cap);
  - drawn like a carried light;
  - nothing at all with the sensor off (N6: 0 infrared lights).
- No real-GPU number is claimed.

## Warm-up (arriving in a new area)

The first seconds in an area, while BR-RoLE builds the caches of the lamps around you (the same walk in both builds; medians of 2 runs each):

| scene | lamp fields built (ms, total) parent → QA2 | slowest lamp build (ms) | far + bounce: slowest frame (ms) | BR-RoLE slowest frame in warm-up (ms) |
|---|---|---|---|---|
| A YELLOW HALL (NV off) | 38.1 → 0.0 | 9.6 → 0.0 | 9.6 → 14.9 | 119.0 → 108.0 |
| D PILLAR HALL (NV off) | 144.6 → 138.0 | 15.1 → 20.6 | 8.4 → 7.5 | 83.5 → 97.1 |
| H long corridor (NV off) | 82.3 → 139.4 | 13.6 → 20.8 | 8.1 → 7.2 | 94.2 → 103.0 |
| E BLACKOUT ZONE, flashlight (NV off) | 0.0 → 0.0 | 0.0 → 0.0 | 4.8 → 7.0 | 90.2 → 82.0 |
| K flashlight across a convex corner (NV off) | 0.0 → 0.0 | 0.0 → 0.0 | 6.1 → 6.1 | 104.8 → 65.8 |
| NA YELLOW HALL, NV on, IR LOW | 23.1 → 0.0 | 9.8 → 0.0 | 11.9 → 8.3 | 85.8 → 111.5 |
| NB BLACKOUT ZONE, NV on, IR HIGH | 0.0 → 0.0 | 0.0 → 0.0 | 5.0 → 4.9 | 91.8 → 80.5 |
| NP PILLAR HALL, NV on, IR LOW | 180.5 → 145.1 | 18.9 → 15.0 | 6.8 → 9.1 | 122.5 → 142.6 |

The lamps built during the measured walk differ from run to run (a cache built before the window opened is not counted), so the totals are not like for like. The slowest single lamp build and the slowest warm-up frame move both ways between the builds, with no pattern above the run-to-run spread. A lamp's cache now draws its faces' end pieces under one clip per end (Q3c).

## LOW / MEDIUM / HIGH

- Tiers change sampling and resolution only.
- The darkness clip does not depend on the tier: it is the same polygon at every tier.
- Infrared, N7: at the same points, |LOW − MEDIUM| mean 0.44 / p95 2 /255, and |HIGH − MEDIUM| mean 0.38 / p95 1 /255.
- The corner receivers use the same geometry (`S.bandM`) at every tier.
