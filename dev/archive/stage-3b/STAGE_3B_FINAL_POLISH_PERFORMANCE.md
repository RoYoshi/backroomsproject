# Stage 3B Final Polish — Performance Note

**Tool:** `dev/stage-3b-l/perf_3bl.js`, run on the parent and on BR-RoLE 1.1 with the same scenes and settings.
- 1920×1080 at the 1.25 camera, ceiling lamps on, no monsters.
- In each scene, every lamp in view is first fully built (BR-RoLE 1.1: including its far field and bounce light).
- Then 5 s are measured standing and 5 s walking across the room.

**Evidence:** `dev/stage-3b-l/evidence/perf_parent.json` and `perf_1_1.json`.

**Read this first:** this machine has no GPU. Chromium draws through SwiftShader, a software renderer on 2 CPUs, so a
whole page frame takes 0.4–0.7 s here. Absolute numbers are far slower than any real GPU. What matters is how the two
builds compare on identical scenes.

## After warm-up (MEDIUM, the desktop default)

| scene | BR-RoLE ms per frame, parent → 1.1 (standing) | walking | page frame interval, parent → 1.1 | lamps drawn |
|---|---|---|---|---|
| YELLOW HALL (open room) | 21.9 → 34.7 | 20.2 → 33.9 | 539 → 516 ms | 7 → 7 |
| PILLAR HALL | 29.1 → 44.7 | 29.5 → 44.8 | 620 → 607 ms | 9 → 10 |
| REPEATING ROOMS (overlapping fixtures) | 30.0 → 41.4 | 27.1 → 44.0 | 667 → 611 ms | 9 → 10 |
| corridor mouth | 11.3 → 22.3 | 10.9 → 33.4 | 392 → 387 ms | 3 → 8 |

HIGH tier, standing (parent → 1.1):

| scene | ms per frame |
|---|---|
| YELLOW HALL | 40.5 → 62.6 |
| PILLAR HALL | 52.2 → 76.0 |
| REPEATING ROOMS | 43.8 → 71.1 |
| corridor mouth | 19.5 → 38.9 |

- **BR-RoLE's own work is about 1.4–2× the parent's on this software renderer.** The extra cost is all fill (drawing pixels):
  - the larger core caches (868 × 808 px instead of 760 × 760);
  - the far-field + bounce light through a quarter-resolution buffer, which is added once per frame;
  - the sight-edge fade, which fills only a ring.

  Corridors draw more lamps (3 → 8), because lamps in neighbouring rooms now reach into them with their faint tail.
- **The page's frame interval did not get worse** (within noise on every scene). On this machine BR-RoLE is a small
  part of a frame: the WebGL scene dominates.
- On a real GPU these are a handful of composited image draws per frame, the same kind of work BR-RoLE 1.0 already
  did. They are expected to stay a small fraction of a 60 FPS frame budget. **LOW** remains the setting for phones and
  older PCs.

## Warm-up (entering a new area)

| item | cost |
|---|---|
| a lamp's core field (as in 1.0) | ~4 ms (MEDIUM) to ~20 ms (HIGH) each on this machine, at most 2 / 3 / 4 a frame (LOW / MEDIUM / HIGH), as in 1.0 |
| a lamp's far field + bounce light (new) | ~10–18 ms each, spread over frames within a per-frame budget of 2 / 3 / 4 ms; measured worst frame 4.6–6.1 ms (MEDIUM), 5–8.6 ms (HIGH) |
| visual effect | the far light and bounce fade in over 12 frames, so nothing pops |

Bounce points: 30–75 per lamp, all from geometry, computed once and cached with the lamp. Caches are released with the
lamp, by the same least-recently-used cap as 1.0 (24 / 32 / 40).

## Optimizations made while measuring

| change | saving (PILLAR HALL, MEDIUM, SwiftShader) |
|---|---|
| sight fade fills only the 620–700 px ring (the clip shows nothing past it), not the whole outside | 57 → 46 ms |
| core cache radius reduced from 430 to 400 px (the far cache takes the rest, invisibly) | included above |
| only lamps whose light can reach both the screen and the 700 px line-of-sight reach take a slot in the tier's lamp cap | included above |
