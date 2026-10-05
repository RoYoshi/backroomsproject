# THE FAR BACKROOMS — 2D Lighting & Shadows: performance

**This is evidence, not hardware certification.** Everything here was measured with SwiftShader (software GL) on a
2-vCPU Linux container. No GPU and no phone was available, so nothing here certifies any hardware.

## How the module is bounded (by construction)

- **No full-map pass per frame.** Each light only looks at the casters inside its own range, through a 384 px bucket
  index. Each frame the module does three things:
  - culls the static grounding by 16×16-cell chunks;
  - shows at most `lamps` cached lamp shadows (2 / 5 / 9), nearest first;
  - rebuilds shadows for at most 1 + `peers` carried lights (1 / 3 / 5).
- **Capped casters and polygons.**
  - Per carried light: at most `localMax` / `peerMax` props and `localC` / `peerC` corners. One that leaves the cap
    fades out, so at most twice the cap are drawn while it fades.
  - Dynamic polygons per frame are capped by the tier's budget: 40 / 300 / 700. The busiest scenes used 4 / 12 / 19.
  - Unit test C19 checks that the ray queries per frame stay under a ceiling computed from the tier caps alone. The
    worst observed is 24 / 25 / 30 against ceilings of 136 / 768 / 2040.
- **Static geometry is cached.**
  - Grounding is built once at load (4–11 ms in these runs).
  - Each lamp's shadow is built once, the first time it is shown, and cached (LRU of 48). At most 1 / 1 / 2 lamps are
    built in a frame.
  - Light textures are built once per kind: five 128² canvases.
- **No CPU per-pixel work.** Light strength per pixel comes from a texture the GPU samples. Penumbrae and prop shadows
  are a handful of triangles each.
- **No forced layout.** Nothing layout-dependent is read inside a frame (see the SH3 finding below).
- **Nothing high-end-only.** It uses plain Pixi `Graphics` polygons and textures, which Pixi batches into the game's
  existing draw calls: the draw-call count is unchanged at every tier. It needs no extension, no shader and no render
  target.

## Quality tiers

| | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|
| default on | — | touch devices, small screens | desktop | — |
| grounding along wall bases | — | yes | yes | yes |
| entity shadows (most drawn) | — | 6 | 12 | 20 |
| lamp shadows shown (nearest lamps) | — | 2 | 5 | 9 |
| lamp: samples along the tube / penumbra sub-wedges per corner | — | 2 / 2 | 3 / 3 | 4 / 4 |
| lamp caches built per frame | — | 1 | 1 | 2 |
| your light: samples / props / corners / sub-wedges | — | 1 / 3 / 4 / 1 | 3 / 6 / 8 / 3 | 4 / 10 / 12 / 4 |
| other players' lights (nearest) | — | none | 2 | 4 |
| each other light: samples / props / corners / sub-wedges | — | — | 2 / 4 / 4 / 2 | 3 / 6 / 6 / 3 |
| dynamic polygons per frame (safety cap) | 0 | 40 | 300 | 700 |

**OFF** draws nothing: it is the v23.3.6 look. **LOW** is a complete mode. It keeps every kind of shadow (grounding,
entity shadows, lamp prop shadows and penumbrae, your light's prop shadows and penumbrae), with fewer samples and
smaller caps, and no shadows from other players' lights. Quality never changes gameplay information: the tiers differ
only in what the module draws on the floor.

## How it was measured

`dev/shadows/scene_bench.js` starts the shipped `node server.js` for each tree and drives the real client in Chromium.
The same harness and scenes ran back to back, in one session on one container, against:
- **the baseline**: a pristine `git archive` of the parent `f2805bb` (v23.3.6), which has no shadow module;
- **the candidate**: the final module at OFF, LOW, MEDIUM and HIGH.

The world is staged through the page's own admin WebSocket and confirmed from the server's snapshots: frozen halls,
no monsters unless the scene adds them, god mode, lights as the scene needs. The clock runs normally. Settling and
measuring are counted in frames: at least 8 frames and until the lamp caches stop building, then at least 20 frames or
8 s, whichever is longer. For every run the bench records:
- frames per second and the rAF frame intervals;
- main-thread time inside rAF callbacks per frame, i.e. all of the game's per-frame JavaScript, the module included;
- WebGL draw calls and 2D-canvas calls per frame, counted by wrapping the contexts;
- the module's own per-frame time and counters (`__shadows.stats()`);
- a screenshot.

| the prompt's case | bench scene | what it stresses |
|---|---|---|
| normal | `room` | YELLOW HALL spawn: the spawn lamp, a partition at arm's length, the flashlight along the room |
| dense | `dense` | PILLAR HALL: nine pillars, wall stubs, nine lamps in reach — the most casters on screen |
| flashlight | `sweep`, `props` | the flashlight turning a full circle at 1.6 rad/s among the pillars; the flashlight across the reception counter |
| multi-player light | `peers` | three other wanderers (flashlight, headlamp, lantern) around you, lights on |
| blackout | `blackout` | forced blackout: lamps out, only the flashlight |
| (lamp flicker) | `flicker` | beside a dim flickering fixture |
| (entities) | `entities` | a hound and a smiler near, the hound in your light |
| high-DPR | profile `hidpi` | 1920×1080 at DPR 2, i.e. 3840×2160 device pixels: room, dense, sweep, peers |
| mobile-like | profile `mobile` | 390×844 at DPR 3 with touch, main thread slowed 4× by CDP CPU throttling: room, dense, sweep, peers |

The `16x9` profile (1280×720, DPR 1) runs all eight scenes. Software rendering draws a few frames a second at 1280×720
and below one at 4K. Every covered pixel costs CPU time here, which a GPU makes nearly free, and frame intervals swing
by ±15 % between identical runs. Read the **OFF** column as the noise floor: OFF draws nothing, so its distance from
the baseline is run-to-run variation. The precise numbers are the module's own time and the call counts.

Raw data: `dev/shadows/evidence/sh3/` (`bench-parent/`, `bench-candidate/`, `bench-ab/`, `profile/`,
`bench_compare.md`) and `dev/shadows/evidence/sh4/build_probe.json`.

## Results

### The module's own time per frame (ms, mean / p95)

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | — | 0.008 / 0.10 | 0.142 / 0.20 | 0.180 / 0.40 | 0.088 / 0.20 |
| 16x9 | props | — | 0.007 / 0.10 | 0.212 / 0.50 | 0.215 / 0.60 | 0.171 / 0.30 |
| 16x9 | dense | — | 0.004 / 0.00 | 0.308 / 0.50 | 0.217 / 0.40 | 0.204 / 0.50 |
| 16x9 | sweep | — | 0.019 / 0.10 | 0.165 / 0.30 | 0.179 / 0.30 | 0.454 / 1.00 |
| 16x9 | peers | — | 0.011 / 0.10 | 0.172 / 0.20 | 0.208 / 0.40 | 0.388 / 0.40 |
| 16x9 | blackout | — | 0.008 / 0.10 | 0.108 / 0.20 | 0.139 / 0.50 | 0.268 / 0.40 |
| 16x9 | flicker | — | 0.023 / 0.10 | 0.278 / 0.30 | 0.135 / 0.20 | 0.115 / 0.40 |
| 16x9 | entities | — | 0.019 / 0.10 | 0.146 / 0.20 | 0.163 / 0.40 | 0.267 / 0.60 |
| hidpi | room | — | 0.035 / 0.10 | 0.208 / 0.70 | 0.146 / 0.30 | 0.140 / 0.30 |
| hidpi | dense | — | 0.008 / 0.10 | 0.192 / 0.30 | 0.192 / 0.30 | 0.435 / 0.70 |
| hidpi | sweep | — | 0.016 / 0.10 | 0.162 / 0.40 | 0.228 / 0.60 | 0.196 / 0.30 |
| hidpi | peers | — | 0.023 / 0.10 | 0.296 / 0.70 | 0.227 / 0.30 | 0.324 / 0.70 |
| mobile | room | — | 0.016 / 0.10 | 0.258 / 0.80 | 0.936 / 3.20 | 0.476 / 2.00 |
| mobile | dense | — | 0.052 / 0.40 | 0.948 / 3.30 | 0.792 / 2.10 | 0.796 / 4.00 |
| mobile | sweep | — | 0.040 / 0.30 | 0.884 / 3.10 | 1.192 / 3.50 | 0.817 / 3.40 |
| mobile | peers | — | 0.150 / 0.90 | 1.192 / 3.40 | 0.916 / 2.10 | 1.575 / 3.70 |

On the desktop-like profiles (1280×720 and 4K) the shadow work costs **0.09–0.45 ms a frame** at every tier, p95 ≤ 1 ms.
On the mobile-like profile, with the main thread slowed 4×, it costs **0.26–1.6 ms** (p95 ≤ 4 ms), while the game's own
per-frame JavaScript takes 10–28 ms there (see the main-thread table below).

### Draw calls

WebGL draw calls per frame are **identical to the baseline** at every tier in every scene: 8 in the empty scenes, 14
with other players or monsters on screen. Pixi batches the shadow `Graphics` into the draws the game already makes.

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| 16x9 | props | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| 16x9 | dense | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| 16x9 | sweep | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| 16x9 | peers | 14.0 | 14.0 | 14.0 | 14.0 | 14.0 |
| 16x9 | blackout | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| 16x9 | flicker | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| 16x9 | entities | 14.0 | 14.0 | 14.0 | 14.0 | 14.0 |
| hidpi | room | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| hidpi | dense | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| hidpi | sweep | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| hidpi | peers | 14.0 | 14.0 | 14.0 | 14.0 | 14.0 |
| mobile | room | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| mobile | dense | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| mobile | sweep | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| mobile | peers | 14.0 | 14.0 | 14.0 | 14.0 | 14.0 |

2D-canvas calls per frame (the darkness overlay) are identical to the baseline at every tier in 13 of 16 scenes. The
three exceptions differ from the baseline at **OFF too**, where the module draws nothing, and are flat across the tiers:
`16x9 entities` (the admin `near` command puts the hound and the smiler somewhere different in each run) and
`mobile dense / sweep` (run-session state). `canvas_calls_probe.js` then counted every 2D call by canvas and method over
10 frames in the mobile PILLAR HALL scene: the baseline and the candidate at OFF, LOW, MEDIUM and HIGH are identical
(`sh3/profile/canvas_calls.txt`). The module never draws on a 2D canvas.

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | 60.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| 16x9 | props | 60.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| 16x9 | dense | 58.0 | 58.0 | 58.0 | 58.0 | 58.0 |
| 16x9 | sweep | 58.0 | 58.0 | 58.0 | 58.0 | 58.0 |
| 16x9 | peers | 141.0 | 141.0 | 141.0 | 141.0 | 141.0 |
| 16x9 | blackout | 46.0 | 46.0 | 46.0 | 46.0 | 46.0 |
| 16x9 | flicker | 54.0 | 54.0 | 54.0 | 54.0 | 54.0 |
| 16x9 | entities | 52.0 | 66.0 | 66.0 | 66.0 | 66.0 |
| hidpi | room | 60.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| hidpi | dense | 68.0 | 68.0 | 68.0 | 68.0 | 68.0 |
| hidpi | sweep | 68.0 | 68.0 | 68.0 | 68.0 | 68.0 |
| hidpi | peers | 141.0 | 141.0 | 141.0 | 141.0 | 141.0 |
| mobile | room | 60.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| mobile | dense | 64.3 | 90.0 | 90.4 | 90.7 | 91.0 |
| mobile | sweep | 64.4 | 90.9 | 90.9 | 91.3 | 90.9 |
| mobile | peers | 141.0 | 141.0 | 141.0 | 141.0 | 141.0 |

### Main-thread time per frame inside rAF callbacks (ms, mean)

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | 6.11 | 3.98 | 3.73 | 3.38 | 3.28 |
| 16x9 | props | 3.23 | 3.06 | 3.13 | 2.76 | 3.19 |
| 16x9 | dense | 2.84 | 2.78 | 3.59 | 2.87 | 3.17 |
| 16x9 | sweep | 3.10 | 2.53 | 3.56 | 2.96 | 3.42 |
| 16x9 | peers | 4.66 | 5.04 | 4.80 | 4.98 | 5.73 |
| 16x9 | blackout | 2.68 | 2.63 | 2.97 | 2.92 | 2.64 |
| 16x9 | flicker | 3.01 | 2.75 | 3.27 | 3.04 | 2.62 |
| 16x9 | entities | 5.16 | 5.24 | 5.38 | 5.57 | 5.14 |
| hidpi | room | 4.36 | 4.47 | 3.61 | 3.25 | 3.36 |
| hidpi | dense | 4.25 | 3.65 | 3.54 | 3.83 | 3.84 |
| hidpi | sweep | 2.97 | 3.01 | 3.22 | 3.56 | 3.29 |
| hidpi | peers | 5.37 | 6.06 | 5.88 | 6.68 | 6.33 |
| mobile | room | 13.31 | 14.49 | 11.88 | 12.36 | 12.81 |
| mobile | dense | 12.97 | 10.58 | 14.80 | 14.65 | 12.43 |
| mobile | sweep | 12.71 | 13.07 | 14.88 | 13.01 | 12.61 |
| mobile | peers | 24.45 | 23.37 | 28.38 | 26.75 | 22.32 |

### Frame times

Frames per second:

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | 2.54 | 2.46 | 2.48 | 2.49 | 2.44 |
| 16x9 | props | 2.41 | 2.38 | 2.20 | 2.08 | 2.04 |
| 16x9 | dense | 2.16 | 2.34 | 2.16 | 2.21 | 2.18 |
| 16x9 | sweep | 2.21 | 2.30 | 2.26 | 2.22 | 2.12 |
| 16x9 | peers | 2.29 | 2.17 | 2.11 | 2.23 | 2.15 |
| 16x9 | blackout | 2.61 | 2.57 | 2.42 | 2.43 | 2.42 |
| 16x9 | flicker | 2.47 | 2.40 | 2.33 | 2.24 | 2.27 |
| 16x9 | entities | 2.31 | 2.08 | 2.00 | 2.07 | 2.04 |
| hidpi | room | 0.48 | 0.44 | 0.44 | 0.45 | 0.44 |
| hidpi | dense | 0.44 | 0.44 | 0.43 | 0.44 | 0.44 |
| hidpi | sweep | 0.46 | 0.43 | 0.43 | 0.41 | 0.42 |
| hidpi | peers | 0.46 | 0.44 | 0.41 | 0.43 | 0.43 |
| mobile | room | 0.95 | 0.91 | 0.87 | 0.85 | 0.87 |
| mobile | dense | 0.95 | 0.88 | 0.76 | 0.82 | 0.86 |
| mobile | sweep | 0.92 | 0.87 | 0.90 | 0.88 | 0.84 |
| mobile | peers | 0.77 | 0.72 | 0.69 | 0.70 | 0.74 |

Frame interval, ms, p50 / p95:

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | 383 / 450 | 400 / 483 | 400 / 450 | 400 / 417 | 417 / 467 |
| 16x9 | props | 400 / 500 | 417 / 450 | 450 / 483 | 483 / 517 | 500 / 533 |
| 16x9 | dense | 450 / 533 | 433 / 467 | 467 / 500 | 450 / 483 | 450 / 517 |
| 16x9 | sweep | 433 / 500 | 433 / 483 | 433 / 467 | 433 / 517 | 467 / 517 |
| 16x9 | peers | 433 / 467 | 467 / 517 | 467 / 550 | 450 / 467 | 467 / 533 |
| 16x9 | blackout | 383 / 433 | 383 / 417 | 417 / 467 | 400 / 450 | 417 / 450 |
| 16x9 | flicker | 400 / 450 | 417 / 450 | 417 / 500 | 433 / 517 | 433 / 517 |
| 16x9 | entities | 433 / 467 | 467 / 550 | 500 / 583 | 483 / 550 | 483 / 583 |
| hidpi | room | 2050 / 2150 | 2233 / 2700 | 2283 / 2583 | 2250 / 2333 | 2283 / 2350 |
| hidpi | dense | 2266 / 2433 | 2233 / 2416 | 2316 / 2500 | 2267 / 2550 | 2283 / 2367 |
| hidpi | sweep | 2166 / 2250 | 2317 / 2450 | 2317 / 2450 | 2417 / 2583 | 2317 / 2567 |
| hidpi | peers | 2167 / 2333 | 2250 / 2467 | 2450 / 2816 | 2300 / 2433 | 2317 / 2517 |
| mobile | room | 1067 / 1117 | 1100 / 1183 | 1133 / 1400 | 1183 / 1283 | 1133 / 1333 |
| mobile | dense | 1017 / 1350 | 1100 / 1300 | 1300 / 1433 | 1200 / 1367 | 1150 / 1333 |
| mobile | sweep | 1050 / 1383 | 1133 / 1417 | 1100 / 1167 | 1133 / 1317 | 1183 / 1383 |
| mobile | peers | 1250 / 1550 | 1350 / 1633 | 1417 / 1650 | 1417 / 1467 | 1317 / 1450 |

Frame times stay within the OFF column's noise in every scene but one: `props`, where your flashlight lights a long
counter. That shadow is large, and SwiftShader fills every covered pixel on the CPU. A dedicated A/B (`sh3/bench-ab/`)
ran three alternating rounds per tier in one session:

| props scene, 1280×720 | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|
| fps (mean of 3 rounds) | 2.32 | 2.20 (−5 %) | 2.08 (−10 %) | 2.04 (−12 %) |
| module ms per frame | 0.02 | 0.15–0.26 | 0.19–0.34 | 0.20–0.29 |
| dynamic polygons | 0 | 2 | 4 | 5 |

The module's CPU time stays a fraction of a millisecond, so the rest is fill. A GPU fills a few translucent
screen-sized polygons in well under a millisecond, but no GPU was available to show it. SH3 cut this overdraw by
drawing one core per prop shadow instead of one per sample.

### Lights, casters, polygons, primitives (max over a run)

Lights / candidate·active casters / dynamic polygons / primitives:

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 15 | 6 / 25·10 / 0 / 35 | 8 / 29·13 / 0 / 57 |
| 16x9 | props | — | 0 / 0·0 / 0 / 0 | 3 / 12·7 / 2 / 16 | 6 / 28·16 / 4 / 52 | 8 / 40·19 / 5 / 80 |
| 16x9 | dense | — | 0 / 0·0 / 0 / 0 | 3 / 21·5 / 3 / 9 | 6 / 43·10 / 9 / 32 | 9 / 60·16 / 12 / 66 |
| 16x9 | sweep | — | 0 / 0·0 / 0 / 0 | 3 / 22·6 / 4 / 10 | 6 / 43·11 / 12 / 35 | 9 / 60·17 / 16 / 70 |
| 16x9 | peers | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 18 | 8 / 27·12 / 3 / 41 | 11 / 32·16 / 7 / 67 |
| 16x9 | blackout | — | 0 / 0·0 / 0 / 0 | 1 / 0·0 / 0 / 4 | 1 / 0·0 / 0 / 4 | 1 / 0·0 / 0 / 4 |
| 16x9 | flicker | — | 0 / 0·0 / 0 / 0 | 3 / 7·3 / 0 / 9 | 6 / 26·11 / 0 / 36 | 6 / 26·11 / 0 / 47 |
| 16x9 | entities | — | 0 / 0·0 / 0 / 0 | 3 / 12·6 / 1 / 15 | 4 / 20·9 / 3 / 31 | 4 / 20·9 / 4 / 40 |
| hidpi | room | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 15 | 6 / 25·10 / 0 / 35 | 8 / 29·13 / 0 / 57 |
| hidpi | dense | — | 0 / 0·0 / 0 / 0 | 3 / 21·5 / 3 / 11 | 6 / 47·13 / 9 / 43 | 10 / 72·19 / 12 / 80 |
| hidpi | sweep | — | 0 / 0·0 / 0 / 0 | 3 / 20·5 / 3 / 11 | 6 / 47·14 / 12 / 46 | 10 / 73·21 / 19 / 87 |
| hidpi | peers | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 18 | 8 / 27·12 / 3 / 41 | 11 / 32·16 / 7 / 67 |
| mobile | room | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 13 | 6 / 25·10 / 0 / 33 | 8 / 29·13 / 0 / 55 |
| mobile | dense | — | 0 / 0·0 / 0 / 0 | 3 / 21·5 / 3 / 11 | 6 / 47·13 / 9 / 43 | 7 / 59·16 / 12 / 68 |
| mobile | sweep | — | 0 / 0·0 / 0 / 0 | 3 / 22·6 / 4 / 12 | 6 / 48·14 / 12 / 46 | 7 / 60·17 / 16 / 72 |
| mobile | peers | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 16 | 8 / 27·12 / 3 / 39 | 11 / 32·16 / 7 / 65 |

### One-time build costs: walking into new rooms

The bench measures steady state, with warm caches. `dev/shadows/build_probe.js` measures the one-time cost instead. It
tours the whole map in the real client, teleporting next to the nearest lamp whose shadow has not been built yet, until
every lamp has been built.

| profile | tier | lamps built / lamps on the map | grounding build, once at load (ms) | lamp-cache builds | mean per build (ms) | slowest build (ms) | module ms per frame over the tour, mean / p95 / max |
|---|---|---|---|---|---|---|---|
| 16x9 (1280×720) | MEDIUM | 90 / 90 | 6.9 | 84 | 0.26 | 6.1 | 0.25 / 0.6 / 6.3 |
| 16x9 (1280×720) | HIGH | 90 / 90 | 6.7 | 83 | 0.16 | 1.9 | 0.31 / 0.8 / 6.8 |
| mobile-like (390×844 DPR 3, CPU ÷4) | LOW | 58 / 90 ² | 5.1 ¹ | 53 | 0.67 | 8.1 | 0.77 / 3.4 / 10.2 |
| mobile-like (390×844 DPR 3, CPU ÷4) | HIGH | 90 / 90 | 3.9 ¹ | 86 | 0.66 | 4.2 | 0.85 / 3.8 / 5.4 |

¹ The grounding is built when the page loads, before the probe slows the main thread, so this is not a 4× figure.
² LOW shows only the 2 nearest lamps, so its tour needs more stops; it reached its 10-minute deadline after 58 of the
90 lamps.

The slowest single lamp build was **6.1 ms** at 1280×720 and **8.1 ms** on the 4×-slowed mobile-like profile.
The module's worst frame over a whole-map tour, the frames that built lamps included, was **6.8 ms** at 1280×720
(HIGH) and **10.2 ms** on the mobile-like profile (LOW). There, the game's own per-frame
JavaScript takes 10–28 ms (the main-thread table above).

- **The mean build is a fraction of a millisecond.** The slowest builds are not the biggest ones: HIGH builds the most
  geometry per lamp, yet its slowest builds were the lowest of each profile. That suggests an occasional
  garbage-collection or compilation pause landing inside a build, rather than at the build work itself.
- **A lamp is built once per tier,** and from then on only its alpha changes. At most 1 / 1 / 2 lamps are built in a
  frame, so walking into a new room spreads the builds over several frames instead of stalling one.
- **The tour is the worst case.** It teleports into rooms that have never been seen. Walking reveals lamps a few at a
  time.

### SH3 finding: a forced layout every frame

`profile_probe.js` ran on the mobile-like profile at LOW, on the same container (`sh3/profile/`):

| module | its time per frame (mean / p95) | the hottest function |
|---|---|---|
| SH2 (`fb65693`) | 3.39 ms / 6.8 ms | `viewRect` 29.3 ms self over 15 frames: reading `innerWidth` / `innerHeight` forced a synchronous layout |
| SH3 (final) | 0.56 ms / 1.5 ms | none above 2 ms self over 16 frames |

The viewport size is now read only on `resize` / `orientationchange`, the way the game's own renderer keeps it.

## What this does not show

- **No GPU and no phone.** Software rendering shows the CPU side exactly (the module's own time, the call counts, the
  bounded work) but turns fill into CPU time, which a GPU makes nearly free. Real-device frame rates are for human QA.
- **Noise.** Frame intervals swing by about ±15 % between identical runs. The container also restarted during the
  stage, onto a slower machine, so only numbers from the same session are compared: the baseline and every tier in the
  tables above ran back to back.
