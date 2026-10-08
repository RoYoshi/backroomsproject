# Stage 3B Lighting QA Correction — Performance

**Law:** VISUAL PARITY FIRST. PERFORMANCE THROUGH ENGINEERING. MEDIUM is primary.

> **Software rendering only.** This machine renders with SwiftShader (2 CPUs, no GPU). A 1920×1080 page frame takes 250–500 ms here, and BR-RoLE's canvas work is pixel-fill bound in a way a GPU-backed canvas is not. **No real-GPU numbers are claimed.**
>
> Only relative numbers (parent vs this branch, on the same scenes) mean anything. The machine's speed also drifts by tens of percent over an hour, so the comparison below interleaves the two builds scene by scene (`dev/stage-3b-l-qa1/perf_ab_qa1.js`) and takes medians.

## What the correction costs, and the engineering that pays for it

Twice the fixtures means more fixtures drawn per frame. MEDIUM draws 16–22 in lit rooms, against 7–10 before. Switching parts off (MEDIUM, SwiftShader, before the engineering below) showed where BR-RoLE's frame went.

**BR-RoLE time per frame by part (A normal room, 16 lamps)**

| part | ms |
|---|---|
| everything | 30 |
| with the lamps' core fields skipped | 10.5 |
| with the far fields and bounce skipped | 21.6 |
| with actor shadows off | 30 |

The I room (21 lamps) showed the same split: 34 ms in all, 10.7 ms without the core fields.

The core fields were two thirds of the frame. Each fixture's core field was drawn at full light-buffer resolution, although its cache only holds about half that density. This branch:

| change | what it does | light vs before (visible floor, A / I / D / H) | BR-RoLE time |
|---|---|---|---|
| **half-resolution core buffer** | the lamps' core fields are drawn into a buffer at half the light buffer's resolution (the caches' own density at every tier: `lampRes` .3 / .45 / .6 vs the buffer's .63 / .94 / 1.25 px per world px), added once | mean \|Δ\| 0.11–0.36 / 255, p99 ≤ 2, max 3 (8-bit rounding) | −30 % in lit rooms (A 32.8 → 22.8 ms, I 33.3 → 25.1, D 34.8 → 24.1) |
| **eighth-resolution far buffer** (was a quarter) | far fields and bounce at the far caches' own density (`farRes` .08 / .11 / .14) | mean 0.24–0.29 / 255, p99 1 | up to −5 ms (A 24.4 → 21.0, I 27.0 → 21.7, D 24.7 → 23.5, H ≈) |
| **dirty boxes** | only the box the lamps drew into is cleared and composited | identical | a fixture at the screen's edge no longer costs a full-screen pass: the BLACKOUT ZONE scene's two distant edge fixtures cost about 10 ms before, about 2 ms now |
| **far face pass** | its own build step, 96 px pieces | identical caches | the 23 ms warm-up spike is gone; the face step's longest is 0.6–1.8 ms (MEDIUM) |
| **face pass copies only its strips** | identical caches (occlusion audit counts equal to the texel) | — | a carried light facing no wall pays nothing |
| **prefetch never evicts** | — | — | at 170 fixtures the old prefetch built and evicted in a loop (210 builds in one corridor scene); now 0 |

A lamp an actor shadows still goes through the full-resolution scratch exactly as before, so actor shadows are unchanged. Every check in the report was run on the final code. The LOW / MEDIUM / HIGH parity check is described below.

## After warm-up: parent `b9f3a9b` vs this branch (interleaved, medians)

| tier | scene | fixtures drawn | BR-RoLE standing (ms) | BR-RoLE walking (ms) | page frame interval, standing (ms) |
|---|---|---|---|---|---|
| MEDIUM | A normal room (YELLOW HALL) | 7 → 16 | 22.4 → **25.9** | 22.2 → **29.7** | 424.5 → 446.6 |
| MEDIUM | I dense fixtures (REPEATING ROOMS) | 10 → 21 | 26.4 → **27.2** | 28.4 → **32.3** | 462.5 → 504.8 |
| MEDIUM | D PILLAR HALL | 10 → 18 | 26.6 → **25.7** | 27.5 → **29.1** | 452.3 → 450.1 |
| MEDIUM | H long corridor | 6 → 19 | 12.7 → **21.5** | 16.2 → **22.8** | 328.8 → 289.2 |
| MEDIUM | E BLACKOUT ZONE, flashlight on | 0 → 2 | 28.8 → **30.6** | 27.1 → **27.2** | 393.4 → 409.1 |
| HIGH | A normal room (YELLOW HALL) | 7 → 16 | 41.4 → **56.4** | 54.1 → **70** | 449.1 → 486.2 |
| HIGH | I dense fixtures (REPEATING ROOMS) | 13 → 21 | 47.6 → **47.1** | 44.5 → **55.9** | 468.1 → 509.9 |
| HIGH | D PILLAR HALL | 11 → 18 | 42.7 → **41.9** | 46.3 → **55.4** | 413 → 423.6 |
| HIGH | H long corridor | 6 → 19 | 18.6 → **34.7** | 30.8 → **50** | 271.7 → 297.2 |
| HIGH | E BLACKOUT ZONE, flashlight on | 0 → 2 | 55.6 → **56.7** | 49.1 → **50.1** | 388.1 → 397 |

Medians of 2 interleaved runs per build at MEDIUM and 1 at HIGH (`dev/stage-3b-l-qa1/evidence/perf_ab_medium.json`, `perf_ab_high.json`). Each run is a fresh server and browser at 1920×1080, the lamps on, no monsters, every lamp in view built first, then 4 s standing and 4 s walking (D held).

**MEDIUM (primary)**
- **Lit rooms (A, I, D):** BR-RoLE's own frame changes by −0.9 to +3.5 ms standing and +1.6 to +7.5 ms walking, while drawing about twice the fixtures.
- **The corridor (H):** about +9 ms (6 ms walking). It went from 6 lamps (YELLOW HALL's and NORTH ROOMS', far away) to 19, including its own.
- **The BLACKOUT ZONE with a flashlight (E):** +1.8 ms standing, unchanged walking.
- **The whole page's frame interval** moves by −12 % to +9 %, within this machine's noise. The page frame is dominated by SwiftShader drawing the scene itself.

**HIGH**
- **Walking:** +1 to +19 ms. HIGH draws the fixtures' caches at higher resolution and holds up to 28 lamps.
- **Standing in the dense rooms (I, D):** unchanged.
- **The open room (A) and the corridor (H):** +15 to +16 ms.


## Warm-up (arriving in a new area)

- Twice the fixtures means about twice the lamp builds on arrival. Each build also carries its face pass, which costs about a third more at MEDIUM.
- Builds stay spread over frames, as in 1.1:
  - lamp fields: at most 2 / 3 / 4 a frame (LOW / MEDIUM / HIGH), within a 6 ms budget after the first;
  - far fields and bounce: a 2 / 3 / 4 ms budget a frame, in steps;
  - each new lamp fades in over 12 frames, so nothing pops.
- Measured on arrival (MEDIUM, SwiftShader), by far-build phase:
  - field + mask: up to 8.8 ms;
  - bounce points: up to 0.4 ms;
  - bounce draws: up to 5.6 ms (budgeted);
  - faces: up to 1.8 ms.
- The longest single lamp-field build: up to about 17–25 ms at MEDIUM and 60–74 ms at HIGH. This is the shadow mask over 16 / 32 tube points, which 1.1 already had, plus the faces.
- A prefetch builds the next fixtures about to come into view in spare frames.

## LOW / HIGH logic parity (`dev/stage-3b-l-qa1/parity_qa1.js`, one frozen instant)

| scene | lamps drawn (LOW / MEDIUM / HIGH) | mean light (LOW / MED / HIGH) | \|LOW − MED\| mean / p95 | \|HIGH − MED\| mean / p95 |
|---|---|---|---|---|
| A normal room | 16 / 16 / 16 | .624 / .621 / .614 | 1.35 / 3 | 1.78 / 4 |
| I dense fixtures | 21 / 21 / 21 | .665 / .664 / .659 | 1.11 / 3 | 1.46 / 3 |
| D PILLAR HALL | 18 / 18 / 18 | .635 / .634 / .629 | 1.06 / 3 | 1.40 / 3 |
| H long corridor | 19 / 19 / 19 | .378 / .377 / .375 | 0.85 / 2 | 0.83 / 2 |

(Differences are in /255.) Every tier draws the same fixtures: the lamp caps are 24 / 24 / 28 and the densest room needs 21–23. Tiers differ only in sampling and resolution.

## Not done (would change the picture, or is a larger change)

- **Shorter core caches.** The core cache spans ±434 px with a 300–400 px crossfade to the far cache. Moving the crossfade in would cut fill further, but it softens mid-distance shadow edges, a visual change.
- **A static world light map (baked tiles).** All steady fixtures would be pre-summed per world tile, then a few tiles drawn per frame. This needs the dim tubes' flicker, failures, the NV gain and the actor shadows' per-lamp light handled outside the tiles. It is a bigger change, worth doing if real-GPU testing shows a need.
