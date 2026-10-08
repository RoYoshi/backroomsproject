# Stage 3B Pillar LOS Correction — Performance

> **Software rendering only.** This machine renders with SwiftShader on 2 shared CPUs, with no GPU. A 1920×1080 game frame takes about 460 ms here, almost all of it spent drawing the scene. **No real-GPU or real-hardware frame rates are claimed.**
>
> The sight polygons are plain JavaScript, so their cost was measured directly in two ways:
> - **micro-benchmark:** both builds' own LOS code, run in the same Chromium JavaScript engine the game uses, interleaved round by round;
> - **in-game profile:** the real client's DevTools profile of the function.

## What is rebuilt every frame

The renderer calls `Hl` twice per frame:
- once for the entity mask (`Hl(x, y, 700)`, which hides monsters and other wanderers);
- once for the darkness clip (`Hl(x, y, 700, 24)`, which keeps everything outside it black).

Each call casts one ray per angle through the exact ray query `Uc`. The fix adds rays only for pillars in reach (sight range 700 plus the pillar's half-diagonal, 40 px):

| | entity mask | darkness clip |
|---|---|---|
| base fan (unchanged, not increased) | 96 | 96 |
| per wall corner in reach (unchanged) | 3 | 3 |
| **per pillar in reach (new)** | **12** (4 corners × angle − ε, angle, angle + ε) | **at most 14** (the same 12, plus the ray at each silhouette corner where the pillar's chord reaches 24 px) |

Level 0 has 9 pillars, all in PILLAR HALL. Anywhere more than 740 px from every pillar, both polygons are byte-identical to the parent's (test T04, checked at 1505 positions across the map).

## Micro-benchmark: both polygons per frame (MEDIUM-independent: `Hl` has no quality input)

`dev/stage-3b-pillar-los/perf_los.js`, Chromium, 9 interleaved rounds after a warm-up round. Each round walks the whole path 4 times.

| path | rays per frame (both polygons), parent → fix | ms per frame, median, parent → fix | worst round, parent → fix |
|---|---|---|---|
| empty corridor (YELLOW HALL → NORTH ROOMS, walking 2 px a frame) | 290.8 → 290.8 | 0.115 → 0.130 | 0.161 → 0.166 |
| PILLAR HALL centre (standing, all 9 pillars in reach) | 288 → 496 | 0.104 → **0.247** | 0.124 → 0.319 |
| close to a pillar while moving (45 px from its centre, 2° a frame) | 265.6 → 421.6 | 0.101 → **0.244** | 0.139 → 0.321 |

- **In the corridor nothing changes.** No pillar is in reach, so the polygons are the same rays. The 0.015 ms difference is inside the round-to-round spread (0.095–0.166 ms for both builds).
- **In PILLAR HALL the polygons cost about 0.14 ms more per frame,** about 0.25 ms in all. That is 1.5 % of a 60 fps frame (16.7 ms), on this slow shared CPU.

## In the real client (MEDIUM, 1920×1080, lamps on, circling a pillar 2° per rendered frame)

`perf_los.js --ingame`, DevTools sampling profiler at 50 µs over 30 s. Time is counted whenever `Hl` is on the stack (its `Uc` rays included).

| build | frames | frame interval | `Hl` per frame |
|---|---|---|---|
| parent `d3ec226` | 68 | 459.1 ms | 0.217 ms |
| this branch | 68 | 461.6 ms | 0.502 ms |

The profiler inflates absolute numbers about two-fold against the micro-benchmark, and here the frame itself is ~460 ms of software rendering. The difference (+0.29 ms) is invisible in the frame interval (+2.5 ms, run-to-run noise).

## Why it stays bounded

- **No brute force.** The 96-ray base fan is unchanged. Only the corners of pillars in reach add rays, as the master prompt expects: four corners, three events each, culled at sight range plus half-diagonal.
- **The darkness clip's extra rays cost no extra ray traversal to find.** The silhouette ray where the pillar chord reaches 24 px is found by bisection on the pillar's own rectangle (a few slab tests, no grid walk), then cast once like any other ray.
- **The padding rule is a test against the 9 pillar rectangles,** run only on darkness-clip rays.
- **Rebuilt per frame, as before.** No cache was added, so no stale polygon can show for a frame.

## Not done

- **Skip each pillar's farthest corner.** It is always behind its own pillar, so its 3 rays add no information. That would save about a quarter of the added rays. Left in to keep the specified four-corner rule.
- **Share one ray cast between the two polygons.** Both polygons use the same angles and the same `Uc` results, apart from the padding. That would halve the cost, but it changes the renderer's two call sites, which this pass leaves untouched.
