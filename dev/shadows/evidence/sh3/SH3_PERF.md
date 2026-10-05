# SH3 — quality tiers, performance and debug tooling

Parent checkpoint: SH2 `fb65693c75c7630c6f6257ebe9123d82094ad246` (tree `af5ccc21642ed585808bdcfc07e0b20b41349ba3`),
verified on GitHub before this work started (`sh2_remote_verify.json`).

## What changed

**In the shipped module** (`assets/shadows-2d.js`; nothing else in the game changed):

| change | why |
|---|---|
| The viewport size is read on `resize` / `orientationchange` only, never inside a frame | The profile (`profile_probe.js`, mobile-like profile) showed the module's own time dominated by `viewRect`, which read `innerWidth` / `innerHeight`. Under mobile emulation that forced a synchronous layout: 29.3 ms of self time over 15 frames in `profile/before_sh2.txt`, about 2 ms a frame. The game itself keeps its size from its resize handler, and the module now does the same. |
| One darker core per prop shadow instead of one per sample | Each sample along the light still draws its own soft tail, then one core is drawn from the light's centre with the same combined alpha. The samples barely differ next to the prop, so this cuts a prop shadow's overdraw (MEDIUM 6 → 4 polygons, HIGH 8 → 5) with no visible change. |
| No per-frame allocation of constant tables (jitter samples, prop corners, the light-model closure) | Less garbage on phones |
| `VERSION` is `shadows-2d 1.0` | the release string shown by `__shadows.stats()` and the debug panel |

**In the tooling** (`dev/shadows/`):

| file | change |
|---|---|
| `scene_bench.js` | Rebuilt on `harness_lib`. The world is staged over the page's own WebSocket and confirmed from the server's snapshots: frozen halls, no monsters unless a scene adds them, god mode, lights. The SH0 bench clicked the admin panel, and its freeze button sat in another tab. New profiles: 4K hi-DPR, and mobile-like (390×844 at DPR 3 with touch, main thread slowed 4× by CDP CPU throttling). Settling and the measuring window are counted in **frames**: at least 8 frames and until the lamp caches stop building, then at least 20 frames or 8 s, whichever is longer. Software rendering draws ~1 frame a second at 4K, so seconds-based windows had measured the caches being built. |
| `harness_lib.js` | `join(..., { init })`: extra page init scripts (the bench's frame accounting). `join` also waits up to 60 s for the lobby: on this container (slower after a restart) a third client's lobby took longer than Playwright's default 30 s twice, while two other software-rendered clients were drawing |
| `browser_shadows.js` | Bob's page (the non-admin of B06) closes as soon as B06 is checked, so only two clients draw while Carol's lobby loads for B05. No check changed |
| `profile_probe.js` | new: a 20 s CPU profile of the module in the real client on the mobile-like profile |
| `summarize.py` | `compare`: the parent next to every quality tier, per profile and scene |
| `test_shadows.js` | C19 bounded work: in steady state, the ray queries per frame stay under a ceiling computed from the tier caps alone (never from the map), and at most `builds` lamp caches are built per frame |

## How it was measured

The bench starts the shipped `node server.js` for each tree and drives the real client in Chromium. Rendering is
SwiftShader, i.e. software GL on the CPU, on a 2-vCPU container. The same harness and scenes ran back to back on the
same container against:
- **the parent**: a pristine `git archive` of `f2805bb`, which has no shadow module;
- **the candidate**: this tree at OFF, LOW, MEDIUM and HIGH.

The clock runs normally (it is not frozen). For every run the bench records:
- frames per second and rAF frame intervals;
- main-thread time inside rAF callbacks per frame — all of the game's per-frame JavaScript, the module included;
- WebGL draw calls and 2D-canvas calls per frame, counted by wrapping the contexts;
- CDP task and script time;
- the module's own per-frame time and counters (`__shadows.stats()`);
- a screenshot.

| scene | what it stresses |
|---|---|
| room | YELLOW HALL spawn: the spawn lamp, a partition at arm's length, the flashlight along the room (normal) |
| props | the reception counter in the flashlight, lamps around (prop shadows) |
| dense | PILLAR HALL: nine pillars, wall stubs, nine lamps in reach — the most casters on screen |
| sweep | PILLAR HALL with the flashlight turning a full circle at 1.6 rad/s (flashlight) |
| peers | three other wanderers (flashlight, headlamp, lantern) around you, lights on (multi-player light) |
| blackout | forced blackout: lamps out, only the flashlight |
| flicker | beside a dim flickering fixture |
| entities | a hound and a smiler near, the hound in your light |

Profiles: `16x9` (1280×720, DPR 1) runs all scenes. `hidpi` (1920×1080 at DPR 2, i.e. 3840×2160 device pixels) and
`mobile` (the mobile-like profile above) run room, dense, sweep and peers.

**This is evidence, not hardware certification.** SwiftShader rasterises on the same two CPU cores that run the game, so
the frame rates are a few per second at 1280×720 and below one at 4K. Every extra pixel a layer covers costs frame time
here, which a GPU would make nearly free. Between the parent and OFF, which draw the same, frames per second differ
by −10 % to +8 % across the 16 scenes. The precise numbers are the module's own time per frame and the call counts. For the one place where fill cost shows (large flashlight
prop shadows), there is a dedicated A/B run below.

## Results

The full tables are in `bench_compare.md`, generated by `summarize.py compare` from `bench-parent/bench.json` and
`bench-candidate/bench.json`; the parent column is v23.3.6 with no module. Read the OFF column as the noise floor: OFF
draws nothing, so its distance from the parent is pure run-to-run variation.

#### The module's own time per frame, ms, mean / p95 (`__shadows.stats().buildMs`)

| profile | scene | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|
| 16x9 | room | 0.008 / 0.1 | 0.142 / 0.2 | 0.180 / 0.4 | 0.088 / 0.2 |
| 16x9 | props | 0.007 / 0.1 | 0.212 / 0.5 | 0.215 / 0.6 | 0.171 / 0.3 |
| 16x9 | dense | 0.004 / 0.0 | 0.308 / 0.5 | 0.217 / 0.4 | 0.204 / 0.5 |
| 16x9 | sweep | 0.019 / 0.1 | 0.165 / 0.3 | 0.179 / 0.3 | 0.454 / 1.0 |
| 16x9 | peers | 0.011 / 0.1 | 0.172 / 0.2 | 0.208 / 0.4 | 0.388 / 0.4 |
| 16x9 | blackout | 0.008 / 0.1 | 0.108 / 0.2 | 0.139 / 0.5 | 0.268 / 0.4 |
| 16x9 | flicker | 0.023 / 0.1 | 0.278 / 0.3 | 0.135 / 0.2 | 0.115 / 0.4 |
| 16x9 | entities | 0.019 / 0.1 | 0.146 / 0.2 | 0.163 / 0.4 | 0.267 / 0.6 |
| hidpi | room | 0.035 / 0.1 | 0.208 / 0.7 | 0.146 / 0.3 | 0.140 / 0.3 |
| hidpi | dense | 0.008 / 0.1 | 0.192 / 0.3 | 0.192 / 0.3 | 0.435 / 0.7 |
| hidpi | sweep | 0.016 / 0.1 | 0.162 / 0.4 | 0.228 / 0.6 | 0.196 / 0.3 |
| hidpi | peers | 0.023 / 0.1 | 0.296 / 0.7 | 0.227 / 0.3 | 0.324 / 0.7 |
| mobile | room | 0.016 / 0.1 | 0.258 / 0.8 | 0.936 / 3.2 | 0.476 / 2.0 |
| mobile | dense | 0.052 / 0.4 | 0.948 / 3.3 | 0.792 / 2.1 | 0.796 / 4.0 |
| mobile | sweep | 0.040 / 0.3 | 0.884 / 3.1 | 1.192 / 3.5 | 0.817 / 3.4 |
| mobile | peers | 0.150 / 0.9 | 1.192 / 3.4 | 0.916 / 2.1 | 1.575 / 3.7 |

On the desktop-like profiles (1280×720 and 4K), shadow work costs **0.1–0.45 ms a frame** at every tier, with p95
≤ 1 ms. On the mobile-like profile, where the main thread is slowed 4×, it is **0.26–1.6 ms** (p95 ≤ 4 ms). In those
runs the game's own per-frame JavaScript takes 10–28 ms a frame.

#### Calls

- **WebGL draw calls per frame are identical** to the parent at every tier and in every scene: 8 in the empty
  scenes, 14 with other players or monsters on screen. Pixi batches the shadow `Graphics` into the draws the game already makes.
- **2D-canvas calls per frame (the darkness overlay) are identical to the parent at every tier** in 13 of 16 scenes.
  The three exceptions differ from the parent at **OFF too**, and are flat across the tiers:
  - `16x9 entities` (52 / 66): the wanderer stood somewhere else in the two runs, at (1971, 2797) and (1538, 2704)
    (`state` in the bench JSON), after the admin `near` command placed the monsters.
  - `mobile dense / sweep` (64 / 90): same spot (and in `dense` the same aim; `sweep` turns it by design); the cause
    was not pinned down.

  `canvas_calls_probe.js` then counted every 2D call by canvas and method, over 10 frames in the same mobile PILLAR
  HALL scene (`profile/canvas_calls.txt`). The parent and the candidate at OFF, LOW, MEDIUM and HIGH are identical, with
  no call on a canvas of the module's. The module's shapes are Pixi `Graphics` in the game's WebGL scene. It never
  touches the game's 2D canvases. Its own small 2D canvases only build its textures, once each, and hold the admin-only
  debug view.

#### Frames per second

Against OFF, three tier cells fall outside OFF's own noise band (−10 % to +8 %): `16x9 props` at MEDIUM and HIGH, and
`mobile dense` at LOW (−14 %, not re-measured; MEDIUM and HIGH, which draw more there, stay inside the band). In
`props` your flashlight lights a long counter: its shadow is large, and SwiftShader pays for every covered pixel on
the CPU. A dedicated A/B (`bench-ab/`) ran three alternating rounds per tier in the same session:

| props scene | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|
| fps (mean of 3 rounds) | 2.32 | 2.20 (−5 %) | 2.08 (−10 %) | 2.04 (−12 %) |
| module ms / frame | 0.02 | 0.15–0.26 | 0.19–0.34 | 0.20–0.29 |
| dynamic polygons | 0 | 2 | 4 | 5 |

The module's CPU time stays a fraction of a millisecond, so the rest is fill. A GPU fills a few translucent screen-sized
polygons in well under a millisecond, but no GPU was available to show it. Drawing one core per prop shadow instead of
one per sample was SH3's cut to this overdraw.

#### SH3 finding: a forced layout every frame

`profile_probe.js` ran on the mobile-like profile at LOW, on the same container (`profile/before_sh2.txt` and
`profile/after_sh3.txt`):

| module | its time per frame (mean / p95) | the hottest function |
|---|---|---|
| SH2 (`fb65693`) | 3.39 ms / 6.8 ms | `viewRect` 29.3 ms self over 15 frames: reading `innerWidth` / `innerHeight` forced a synchronous layout |
| SH3 | 0.56 ms / 1.5 ms | none above 2 ms self over 16 frames |

## Tiers

The tiers were reviewed against these numbers and kept, with two changes: LOW samples a lamp's prop shadow twice
(SH2's last change), and every tier draws one core per prop shadow (above).

- **OFF** draws nothing. It is the v23.3.6 look.
- **LOW** is the default on touch devices and small screens. It keeps every kind of shadow: grounding, entity shadows,
  lamp props and penumbrae, and your light's props and penumbrae. It costs the least: on the mobile-like profile the
  module averages 0.26–1.2 ms, and it costs −5 % fps in the worst software-fill scene. It leaves out other players'
  lights.
- **MEDIUM** is the default on desktop. It adds more lamps (5), more samples and wedges, and two other players' lights.
- **HIGH** adds 9 lamps, the most samples and wedges, and four other players' lights.

The per-frame budgets (40 / 300 / 700 dynamic polygons) are safety caps; the busiest scenes used at most 4 / 12 / 19.
The work ceilings in unit test C19 hold on the whole map.

## Debug tooling

The admin-only debug view needs DEBUG MODE, then SHADOW DEBUG. It draws:
- every light's range: yellow lamps, green your light, blue other players;
- the candidate casters (dim dots) and the chosen ones (penumbra wedges, prop boxes);
- every carried-light polygon (pink);
- the AO chunk bounds and the entity-shadow ellipses.

Its panel shows the tier and its caps, the lights, the candidate / active casters, the dynamic polygons against the
budget (props / penumbrae), the primitives, the lamp-cache size, hits, misses and builds (with the slowest build), the
AO chunks, the entity shadows, and the module's mean / max time per frame. `__shadows.stats()` and
`__shadows.snapshot()` give the same numbers to scripts (the bench, the tests). See `../sh2/shots/debug-*.jpg`.

## Validation

| check | result |
|---|---|
| unit tests | **35/35 PASS** (`unit_tests.log`; C19 new) |
| browser checks | **9/9 PASS** (`browser_checks.log`) |
| gameplay freeze | `FREEZE OK` (`freeze_verify.txt`) |
| retained v23.3.6 suites | run in full at SH4 on the final tree (SH4 makes no further module change) |
