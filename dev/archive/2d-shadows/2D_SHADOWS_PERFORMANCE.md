# THE FAR BACKROOMS — 2D Lighting & Shadows: performance

**This is evidence, not hardware certification.** Everything here was measured with SwiftShader (software GL) on a
2-vCPU Linux container. No GPU and no phone was available, so nothing here certifies any hardware.

This report covers the final module (`shadows-2d 1.1`, after the SH5 visibility correction). The correction changed
strengths and the size of some shapes, not the number of shapes: the casters, caps, samples, budgets and tiers are
SH4's.

## How the module is bounded (by construction)

- **No full-map pass per frame.** Each light only looks at the casters inside its own range, through a 384 px bucket
  index. Each frame the module does three things:
  - culls the static grounding by 16×16-cell chunks;
  - shows at most `lamps` cached lamp shadows (2 / 5 / 9), nearest first;
  - rebuilds shadows for at most 1 + `peers` carried lights (1 / 3 / 5).
- **Capped casters and polygons.**
  - Per carried light: at most `localMax` / `peerMax` props and `localC` / `peerC` corners. One that leaves the cap
    fades out, so at most twice the cap are drawn while it fades.
  - Dynamic polygons per frame are capped by the tier's budget: 40 / 300 / 700. The busiest scenes of the matrix used 4 / 14 / 20.
  - Unit test C19 checks that the ray queries per frame stay under a ceiling computed from the tier caps alone.
- **Static geometry is cached.**
  - Grounding is built once at load (4–7 ms in these runs).
  - Each lamp's shadow is built once, the first time it is shown, and cached (LRU of 48). At most 1 / 1 / 2 lamps are
    built in a frame.
  - Light textures are built once per kind.
- **No CPU per-pixel work.** Light strength per pixel comes from a texture the GPU samples. Penumbrae and prop shadows
  are a handful of triangles each.
- **No forced layout.** Nothing layout-dependent is read inside a frame (the SH3 finding below).
- **Nothing high-end-only.** It uses plain Pixi `Graphics` polygons and textures, which Pixi batches into the game's
  existing draw calls. It needs no extension, no shader and no render target.

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

**OFF** draws nothing: it is the v23.3.6 look. Since SH5, LOW, MEDIUM and HIGH are equally strong (unit test V03).
Their differences are softness (samples), coverage (lamps, other players' lights) and caps. Quality never changes
gameplay information.

## How it was measured

`dev/shadows/scene_bench.js` starts the shipped `node server.js` for each tree and drives the real client in Chromium.
The same harness and scenes ran back to back, in one session on one container, against:
- **the baseline**: a pristine `git archive` of the parent `f2805bb` (v23.3.6), which has no shadow module;
- **the candidate**: the final module at OFF, LOW, MEDIUM and HIGH.

The world is staged through the page's own admin WebSocket: frozen halls, no monsters unless the scene adds them, god
mode, lights as the scene needs. The clock runs normally. Settling and measuring are counted in frames.

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

Software rendering draws a few frames a second at 1280×720 and below one at 4K. Every covered pixel costs CPU time
here, which a GPU makes nearly free. Read the **OFF** column as the noise floor: OFF draws nothing, so its distance from
the baseline is run-to-run variation. Across these scenes, OFF's frames per second are +0 % to +14 % off the
baseline's.

Raw data:
- `dev/shadows/evidence/sh6/`: `bench-parent/`, `bench-candidate/`, `bench_compare.md`;
- `sh5/perf/`: the repeated mobile-like A/B and the overlay-tint probe;
- `sh3/`: the SH3 profiles and the SH3 matrix of module 1.0.

## Results

**Not measured.** The candidate run of the matrix ended before its last cells, `mobile peers` MEDIUM, HIGH, without an error message, after the queued follow-up runs were stopped by instruction. It was not restarted. Those cells read "—" in every table below; every figure in this report comes from the cells that completed.

### The module's own time per frame (ms, mean / p95)

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | — | 0.037 / 0.10 | 0.162 / 0.40 | 0.233 / 0.30 | 0.127 / 0.20 |
| 16x9 | props | — | 0.032 / 0.10 | 0.322 / 1.20 | 0.200 / 0.60 | 0.196 / 0.50 |
| 16x9 | dense | — | 0.212 / 0.10 | 0.288 / 1.00 | 0.204 / 0.30 | 0.292 / 0.70 |
| 16x9 | sweep | — | 0.048 / 0.10 | 0.154 / 0.20 | 0.208 / 0.30 | 0.400 / 0.90 |
| 16x9 | peers | — | 0.016 / 0.10 | 0.133 / 0.30 | 0.265 / 0.40 | 0.200 / 0.40 |
| 16x9 | blackout | — | 0.008 / 0.00 | 0.104 / 0.20 | 0.141 / 0.50 | 0.100 / 0.40 |
| 16x9 | flicker | — | 0.011 / 0.10 | 0.084 / 0.20 | 0.162 / 0.40 | 0.119 / 0.20 |
| 16x9 | entities | — | 0.012 / 0.10 | 0.204 / 0.20 | 0.104 / 0.20 | 0.236 / 0.20 |
| hidpi | room | — | 0.035 / 0.10 | 0.280 / 1.10 | 0.139 / 0.30 | 0.113 / 0.30 |
| hidpi | dense | — | 0.024 / 0.10 | 0.223 / 0.70 | 0.188 / 0.30 | 0.339 / 1.20 |
| hidpi | sweep | — | 0.016 / 0.10 | 0.188 / 0.30 | 0.217 / 0.70 | 0.168 / 0.30 |
| hidpi | peers | — | 0.012 / 0.10 | 0.159 / 0.20 | 0.386 / 1.30 | 0.338 / 0.70 |
| mobile | room | — | 0.021 / 0.10 | 0.216 / 0.70 | 0.396 / 1.20 | 0.472 / 2.60 |
| mobile | dense | — | 0.029 / 0.10 | 1.029 / 3.70 | 0.968 / 4.70 | 0.848 / 3.20 |
| mobile | sweep | — | 0.042 / 0.10 | 0.783 / 3.20 | 0.572 / 3.20 | 0.662 / 3.20 |
| mobile | peers | — | 0.046 / 0.10 | 1.042 / 2.60 | — | — |

- **Desktop-like profiles** (1280×720 and 4K): the shadow work costs **0.08–0.40 ms a frame** at LOW,
  MEDIUM and HIGH, with p95 ≤ 1.3 ms.
- **Mobile-like profile**, main thread slowed 4×: **0.22–1.04 ms**, with p95 ≤ 4.7 ms. The game's own
  per-frame JavaScript there takes 9–26 ms (the main-thread table below).

### Draw calls

WebGL draw calls per frame are identical to the baseline in 12 of 16 scenes. In the other 4 (`hidpi room` 10 → 8, `hidpi dense` 10 → 8, `hidpi sweep` 10 → 8, `hidpi peers` 16 → 14), the candidate draws the same at every tier, OFF included. OFF draws nothing, so the module does not make that difference. At SH3 both trees drew 8 and 14 in these scenes. Why the baseline run drew two more here was not investigated at SH6, by instruction. Within each scene the count does not change from OFF to HIGH: Pixi batches the
shadow `Graphics` into the draws the game already makes.

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
| hidpi | room | 10.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| hidpi | dense | 10.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| hidpi | sweep | 10.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| hidpi | peers | 16.0 | 14.0 | 14.0 | 14.0 | 14.0 |
| mobile | room | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| mobile | dense | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| mobile | sweep | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| mobile | peers | 14.0 | 14.0 | 14.0 | — | — |

The module's shapes are Pixi `Graphics` in the game's WebGL scene. It never touches the game's 2D canvases, the
darkness overlay included: the overlay's pixels are byte-identical at every quality (browser check B02). Its own small
2D canvases build its textures once each, and hold the admin-only debug view.

2D-canvas calls per frame match the baseline at every tier in 11 of 16 scenes. The others:
- `16x9 entities`: baseline 68, candidate 66 / 66 / 66 / 66 (flat across the tiers; OFF, which draws nothing, differs too). The wanderer stood somewhere else in the two runs: (1269, 3826) for the baseline, (1716, 2842) for the candidate (`state` in the bench JSON).
- `hidpi room`: baseline 55, candidate 60 / 60 / 60 / 60 (flat across the tiers; OFF, which draws nothing, differs too).
- `hidpi dense`: baseline 55, candidate 68 / 68 / 68 / 68 (flat across the tiers; OFF, which draws nothing, differs too).
- `hidpi sweep`: baseline 55, candidate 68 / 68 / 68 / 68 (flat across the tiers; OFF, which draws nothing, differs too).
- `hidpi peers`: baseline 136, candidate 141 / 141 / 141 / 141 (flat across the tiers; OFF, which draws nothing, differs too).
A difference that OFF shows too cannot come from the module, which draws nothing at OFF. `canvas_calls_probe.js` counted every 2D call by canvas and by method in the mobile PILLAR HALL scene at SH3: the baseline and every tier were identical (`sh3/profile/canvas_calls.txt`).

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | 60.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| 16x9 | props | 60.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| 16x9 | dense | 58.0 | 58.0 | 58.0 | 58.0 | 58.0 |
| 16x9 | sweep | 58.0 | 58.0 | 58.0 | 58.0 | 58.0 |
| 16x9 | peers | 141.0 | 141.0 | 141.0 | 141.0 | 141.0 |
| 16x9 | blackout | 46.0 | 46.0 | 46.0 | 46.0 | 46.0 |
| 16x9 | flicker | 54.0 | 54.0 | 54.0 | 54.0 | 54.0 |
| 16x9 | entities | 68.0 | 66.0 | 66.0 | 66.0 | 66.0 |
| hidpi | room | 55.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| hidpi | dense | 55.0 | 68.0 | 68.0 | 68.0 | 68.0 |
| hidpi | sweep | 55.0 | 68.0 | 68.0 | 68.0 | 68.0 |
| hidpi | peers | 136.0 | 141.0 | 141.0 | 141.0 | 141.0 |
| mobile | room | 60.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| mobile | dense | 58.0 | 58.0 | 58.0 | 58.0 | 58.0 |
| mobile | sweep | 58.0 | 58.0 | 58.0 | 58.0 | 58.0 |
| mobile | peers | 141.0 | 141.0 | 141.0 | — | — |

### Main-thread time per frame inside rAF callbacks (ms, mean)

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | 7.30 | 4.62 | 4.05 | 3.59 | 3.88 |
| 16x9 | props | 3.64 | 2.86 | 3.83 | 4.21 | 3.59 |
| 16x9 | dense | 3.89 | 3.12 | 3.24 | 3.05 | 3.32 |
| 16x9 | sweep | 3.78 | 2.93 | 3.52 | 2.90 | 4.36 |
| 16x9 | peers | 6.46 | 5.61 | 5.53 | 5.16 | 5.30 |
| 16x9 | blackout | 3.19 | 2.65 | 2.83 | 3.04 | 3.55 |
| 16x9 | flicker | 3.39 | 2.95 | 2.69 | 2.69 | 2.65 |
| 16x9 | entities | 8.83 | 5.52 | 5.73 | 5.51 | 6.77 |
| hidpi | room | 13.76 | 4.07 | 3.58 | 3.60 | 3.25 |
| hidpi | dense | 14.28 | 3.17 | 3.96 | 3.61 | 4.36 |
| hidpi | sweep | 12.03 | 3.38 | 3.64 | 3.75 | 3.53 |
| hidpi | peers | 13.81 | 6.90 | 6.30 | 7.12 | 6.76 |
| mobile | room | 14.48 | 14.08 | 12.96 | 14.28 | 12.35 |
| mobile | dense | 15.62 | 9.11 | 13.49 | 12.88 | 13.49 |
| mobile | sweep | 13.03 | 11.43 | 13.58 | 12.03 | 11.52 |
| mobile | peers | 25.87 | 25.23 | 25.74 | — | — |

### Frame times

Frames per second:

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | 2.26 | 2.27 | 2.15 | 2.33 | 2.25 |
| 16x9 | props | 2.06 | 2.15 | 1.85 | 1.94 | 1.83 |
| 16x9 | dense | 1.87 | 2.09 | 1.96 | 1.97 | 2.06 |
| 16x9 | sweep | 1.88 | 2.14 | 1.85 | 2.09 | 2.05 |
| 16x9 | peers | 1.97 | 2.11 | 1.92 | 1.97 | 2.01 |
| 16x9 | blackout | 2.23 | 2.40 | 2.15 | 2.29 | 2.44 |
| 16x9 | flicker | 2.04 | 2.21 | 2.11 | 2.29 | 2.26 |
| 16x9 | entities | 1.92 | 1.96 | 1.91 | 1.89 | 1.91 |
| hidpi | room | 0.41 | 0.45 | 0.42 | 0.43 | 0.42 |
| hidpi | dense | 0.39 | 0.42 | 0.43 | 0.42 | 0.39 |
| hidpi | sweep | 0.41 | 0.41 | 0.41 | 0.41 | 0.41 |
| hidpi | peers | 0.41 | 0.43 | 0.40 | 0.40 | 0.40 |
| mobile | room | 0.87 | 0.87 | 0.86 | 0.82 | 0.83 |
| mobile | dense | 0.84 | 0.90 | 0.86 | 0.85 | 0.87 |
| mobile | sweep | 0.87 | 0.88 | 0.83 | 0.86 | 0.88 |
| mobile | peers | 0.71 | 0.78 | 0.72 | — | — |

Frame interval, ms, p50 / p95:

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | 433 / 533 | 433 / 533 | 467 / 517 | 417 / 500 | 433 / 500 |
| 16x9 | props | 483 / 550 | 467 / 517 | 500 / 750 | 500 / 600 | 533 / 617 |
| 16x9 | dense | 517 / 633 | 467 / 550 | 483 / 600 | 500 / 583 | 467 / 533 |
| 16x9 | sweep | 500 / 650 | 467 / 533 | 533 / 583 | 467 / 567 | 483 / 533 |
| 16x9 | peers | 517 / 567 | 467 / 517 | 500 / 633 | 517 / 600 | 483 / 567 |
| 16x9 | blackout | 433 / 517 | 417 / 450 | 450 / 583 | 433 / 483 | 400 / 450 |
| 16x9 | flicker | 467 / 583 | 450 / 517 | 467 / 550 | 433 / 517 | 433 / 533 |
| 16x9 | entities | 500 / 600 | 517 / 550 | 517 / 600 | 533 / 617 | 533 / 600 |
| hidpi | room | 2400 / 2633 | 2233 / 2433 | 2333 / 2567 | 2300 / 2550 | 2366 / 2616 |
| hidpi | dense | 2533 / 2817 | 2333 / 2650 | 2333 / 2517 | 2367 / 2550 | 2517 / 2783 |
| hidpi | sweep | 2450 / 2550 | 2433 / 2766 | 2433 / 2667 | 2400 / 2650 | 2383 / 2667 |
| hidpi | peers | 2433 / 2716 | 2333 / 2483 | 2483 / 2733 | 2516 / 2733 | 2433 / 2733 |
| mobile | room | 1117 / 1383 | 1133 / 1367 | 1150 / 1250 | 1183 / 1400 | 1183 / 1333 |
| mobile | dense | 1150 / 1466 | 1100 / 1350 | 1133 / 1400 | 1167 / 1317 | 1150 / 1217 |
| mobile | sweep | 1133 / 1350 | 1117 / 1450 | 1200 / 1300 | 1117 / 1400 | 1117 / 1250 |
| mobile | peers | 1416 / 1633 | 1267 / 1417 | 1350 / 1717 | — | — |

Measured against OFF, the tier cells outside OFF's own noise band (+0 % to +14 %) are: 35 of 45; the largest: `16x9 props` HIGH −15 %; `16x9 props` LOW −14 %; `16x9 sweep` LOW −14 %; `16x9 blackout` LOW −10 %. The band comes from one round of each tree, and here OFF ran as fast as or faster than
the baseline in every scene, so the band sits entirely above zero and most tier cells fall outside it. These single rounds
are indicative only. A single round of a cell can fall outside the band by chance, so cells were measured again in
repeated, alternating rounds where time allowed:

**The mobile-like PILLAR HALL** (`sh5/perf/ab_mobile_dense.md`). The SH4 report left a one-off −14 % at LOW unrepeated.
Three rounds per tree and tier, back to back:

Profile `mobile`, scene `dense` (mobile-like: 390×844 at DPR 3, touch, main thread slowed 4×; SwiftShader on 2 vCPUs).

| tree | tier | fps per round | mean fps | vs its OFF | vs the parent | module ms / frame (mean / worst p95) |
|---|---|---|---|---|---|---|
| v23.3.6 parent | parent | 0.90, 0.88, 0.87 | 0.883 | — | +0.0 % | — |
| SH4 (1.0) | OFF | 0.83, 0.90, 0.87 | 0.867 | — | −1.9 % | 0.03 / 0.1 |
| SH4 (1.0) | LOW | 0.82, 0.87, 0.82 | 0.837 | −3.5 % | −5.3 % | 1.10 / 4.5 |
| SH5 (1.1) | OFF | 0.86, 0.87, 0.88 | 0.870 | — | −1.5 % | 0.04 / 0.2 |
| SH5 (1.1) | LOW | 0.82, 0.81, 0.84 | 0.823 | −5.4 % | −6.8 % | 0.71 / 3.6 |
| SH5 (1.1) | MEDIUM | 0.80, 0.82, 0.80 | 0.807 | −7.3 % | −8.7 % | 1.25 / 3.7 |
| SH5 (1.1) | HIGH | 0.80, 0.82, 0.79 | 0.803 | −7.7 % | −9.1 % | 1.23 / 5.1 |

The −14 % did not reproduce: LOW against OFF is −3.5 % for SH4 and −5.4 % for the final module. The difference
is fill: the same polygons covering more pixels, which software rendering pays for on the CPU.

**The reception counter in your flashlight, 1280×720** (`16x9 props`), the largest flashlight shadow, shows the largest
single-round drop above. **Its repeated A/B was planned for SH6 but not run**: the follow-up runs were stopped by
instruction. It remains a limitation; step 2 of the human-QA tour plays that view.

### Lights, casters, polygons, primitives (max over a run)

Lights / candidate·active casters / dynamic polygons / primitives:

| profile | scene | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|---|
| 16x9 | room | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 15 | 6 / 25·10 / 0 / 35 | 8 / 29·13 / 0 / 57 |
| 16x9 | props | — | 0 / 0·0 / 0 / 0 | 3 / 12·7 / 2 / 16 | 6 / 28·16 / 4 / 52 | 8 / 40·19 / 5 / 80 |
| 16x9 | dense | — | 0 / 0·0 / 0 / 0 | 3 / 21·5 / 3 / 9 | 6 / 43·10 / 9 / 32 | 9 / 60·16 / 12 / 66 |
| 16x9 | sweep | — | 0 / 0·0 / 0 / 0 | 3 / 22·5 / 3 / 9 | 6 / 44·11 / 12 / 35 | 9 / 59·16 / 12 / 66 |
| 16x9 | peers | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 18 | 8 / 27·12 / 3 / 41 | 11 / 32·16 / 8 / 68 |
| 16x9 | blackout | — | 0 / 0·0 / 0 / 0 | 1 / 0·0 / 0 / 4 | 1 / 0·0 / 0 / 4 | 1 / 0·0 / 0 / 4 |
| 16x9 | flicker | — | 0 / 0·0 / 0 / 0 | 3 / 7·3 / 0 / 9 | 6 / 26·11 / 0 / 36 | 6 / 26·11 / 0 / 47 |
| 16x9 | entities | — | 0 / 0·0 / 0 / 0 | 3 / 11·5 / 0 / 15 | 4 / 19·8 / 0 / 29 | 4 / 19·8 / 0 / 37 |
| hidpi | room | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 15 | 6 / 25·10 / 0 / 35 | 8 / 29·13 / 0 / 57 |
| hidpi | dense | — | 0 / 0·0 / 0 / 0 | 3 / 21·5 / 3 / 11 | 6 / 47·13 / 9 / 43 | 10 / 72·19 / 12 / 80 |
| hidpi | sweep | — | 0 / 0·0 / 0 / 0 | 3 / 21·6 / 4 / 12 | 6 / 47·15 / 14 / 48 | 10 / 71·19 / 12 / 80 |
| hidpi | peers | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 18 | 8 / 27·12 / 3 / 41 | 11 / 32·16 / 8 / 68 |
| mobile | room | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 13 | 6 / 25·10 / 0 / 33 | 8 / 29·13 / 0 / 55 |
| mobile | dense | — | 0 / 0·0 / 0 / 0 | 3 / 21·5 / 3 / 11 | 6 / 47·13 / 9 / 43 | 7 / 59·16 / 12 / 68 |
| mobile | sweep | — | 0 / 0·0 / 0 / 0 | 3 / 22·6 / 4 / 12 | 6 / 48·13 / 9 / 43 | 7 / 60·18 / 20 / 76 |
| mobile | peers | — | 0 / 0·0 / 0 / 0 | 3 / 16·5 / 0 / 16 | — | — |

### How much of a shadow reaches the screen

The overlay paints a carried light's colour tint over its beam, above the floor. `tint_probe.js` measured that in the
real client: 75–79 % of what the module draws in your beam reaches the screen
(`sh5/perf/tint_probe.json`). This is why the SH5 strengths are set where they are. It is not a cost: the probe changes
no work.

### One-time build costs: walking into new rooms

The bench measures steady state, with warm caches. `dev/shadows/build_probe.js` tours the whole map in the real client,
teleporting next to the nearest lamp whose shadow has not been built yet.

**Not re-measured for the final module.** The SH6 re-run of this probe was stopped by instruction before it ran. The
table below is SH4's tour of module 1.0 (`sh4/build_probe.json`). The SH5 correction kept the lamp-shadow build path
and its polygon counts, but made lamp prop shadows larger (presentation height 240 → 180 px). A lamp's first build
may therefore cost somewhat more than shown. Treat this as a pending item: watch for a hitch on entering a new room
on a slow phone.


| profile | tier | lamps built / lamps on the map | grounding build, once at load (ms) | lamp-cache builds | mean per build (ms) | slowest build (ms) | module ms per frame over the tour, mean / p95 / max |
|---|---|---|---|---|---|---|---|
| 16x9 (1280×720) | MEDIUM | 90 / 90 | 6.9 | 84 | 0.26 | 6.1 | 0.25 / 0.6 / 6.3 |
| 16x9 (1280×720) | HIGH | 90 / 90 | 6.7 | 83 | 0.16 | 1.9 | 0.31 / 0.8 / 6.8 |
| mobile-like (390×844 DPR 3, CPU ÷4) | LOW | 58 / 90 ² | 5.1 ¹ | 53 | 0.67 | 8.1 | 0.77 / 3.4 / 10.2 |
| mobile-like (390×844 DPR 3, CPU ÷4) | HIGH | 90 / 90 | 3.9 ¹ | 86 | 0.66 | 4.2 | 0.85 / 3.8 / 5.4 |

¹ The grounding is built when the page loads, before the probe slows the main thread, so this is not a 4× figure.
² LOW shows only the 2 nearest lamps, so its tour needs more stops; it reached its deadline after 58 of the 90 lamps.


- **Slowest single lamp build:** 6.1 ms at 1280×720 and 8.1 ms on the 4×-slowed
  mobile-like profile.
- **The module's worst frame over a whole-map tour,** the frames that built lamps included: 6.8 ms
  at 1280×720 (HIGH) and 10.2 ms on the mobile-like profile
  (LOW).
- **A lamp is built once per tier.** From then on only its alpha changes. At most 1 / 1 / 2 lamps are built in a frame.
- **The tour is the worst case.** It teleports into rooms that have never been seen; walking reveals lamps a few at a
  time.

### SH3 finding: a forced layout every frame (kept)

`profile_probe.js` ran on the mobile-like profile at LOW (`sh3/profile/`):

| module | its time per frame (mean / p95) | the hottest function |
|---|---|---|
| SH2 (`fb65693`) | 3.39 ms / 6.8 ms | `viewRect` 29.3 ms self over 15 frames: reading `innerWidth` / `innerHeight` forced a synchronous layout |
| SH3 | 0.56 ms / 1.5 ms | none above 2 ms self over 16 frames |

The viewport size is read only on `resize` / `orientationchange`. The SH5 correction kept this: it changed constants
and the prop-shadow composition, not the frame loop.

## What this does not show

- **No GPU and no phone.** Software rendering shows the CPU side exactly (the module's own time, the call counts, the
  bounded work) but turns fill into CPU time, which a GPU makes nearly free. Real-device frame rates are for human QA.
- **Noise.** Between the baseline and OFF, which show the same picture, frames per second differ by +0 % to +14 %
  across scenes. Only numbers from one session are compared: the baseline and every tier in each table ran back to
  back.
