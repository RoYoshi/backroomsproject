# 2D Lighting & Shadows — stage tooling

Stage: **THE FAR BACKROOMS — 2D LIGHTING & SHADOWS VISUAL PASS ONLY**, branch `lighting-shadows-2d`,
immutable gameplay parent `f2805bb904c158df17c5c75c3d0d4681049bc246` (tree `8cc77595fe6e88c425e2f8abd243f3463af44a18`, v23.3.6).

Everything in this folder is development tooling and evidence. None of it is served to browsers, and the
server does not load any of it.

| file | what it does |
|---|---|
| `freeze.py` | `write`: hash manifest of every tracked file of the parent (git mode, blob id, SHA-256, size, protection class). `verify`: compares a revision or an extracted folder against it and fails if any protected/frozen file changed or an unexpected file was added. |
| `run_retained.py` | Runs the retained v23.3.6 suites serially with one log per suite (`run`; `--timeout-scale` multiplies the runner's own safety deadlines on a slower machine and records the factor); recomputes counts from saved logs (`reparse`); compares a candidate run with the baseline run suite by suite: verdict, counts, the set of failing assertion names and the error messages (`compare`). |
| `log_identity.py` | For two retained runs, how closely each suite log matches: byte-identical, identical except per-test durations, the same PASS / FAIL lines, or different (supporting evidence; `compare` decides). |
| `scene_bench.js` | Starts the shipped `node server.js`, drives the real client in Chromium (SwiftShader software GL), stages the world through `harness_lib` and measures representative scenes (normal, props, dense, flashlight sweep, multi-player lights, blackout, flicker, entities) on three profiles (16:9, 4K hi-DPR, mobile-like: 390×844 DPR 3 touch with the main thread slowed 4×): frame intervals, main-thread time inside rAF callbacks, WebGL draw calls, 2D-canvas calls, CDP task/script time, the shadow module's own time and counters, plus a screenshot per scene. Settling and measuring windows are counted in frames. The same script runs against the parent (tier `baseline`) and the candidate (tiers `off/low/medium/high`). |
| `profile_probe.js` | A 20 s CPU profile of the module in the real client on the mobile-like profile: the module's own per-frame time and the self time per function. |
| `build_probe.js` | One-time build costs in the real client: tours the whole map lamp by lamp until every lamp's cached shadow has been built, and records the grounding build, each lamp build (count, mean, slowest) and the module's worst frame, on the 16:9 and mobile-like profiles. |
| `canvas_calls_probe.js` | Counts every 2D-canvas call per canvas and per method over 10 frames, for the parent or for each quality tier: the module never draws on a 2D canvas, so the darkness overlay's calls are the parent's. |
| `summarize.py` | Markdown tables from the machine-readable evidence: `retained`, `bench`, and `compare` (the parent next to every quality tier). |
| `harness_lib.js` | Shared browser-harness helpers: joins a room with the test admin authority, stages the world with explicit admin messages over the page's own WebSocket (frozen halls, no monsters, god mode, lights confirmed from snapshots), places and aims the wanderer, and provides a test-only clock that can freeze the frame. |
| `test_shadows.js` | Unit tests for `assets/shadows-2d.js` in a VM with the real level geometry / ray query / light model extracted verbatim from the shipped bundle, the real `light.js` and `world.js`, and a recording mock of the Pixi classes (it keeps polygon arrays by reference and canvas pixels, as Pixi does, so the tests can integrate texture-weighted shadows). |
| `browser_shadows.js` | Browser checks against the real client: attach, darkness-overlay identity at every quality, untouched entity views, unchanged network messages, settings persistence, admin-only debug view, Smiler concealment, no page errors, light-weighted cast shadows really drawn by WebGL. |
| `shots.js` | Visual QA captures: the same frozen instant at several qualities, side-by-side crops, the overlay's hash and mean alpha per capture (`--debug 1` adds the admin debug view). Before each capture the frozen clock runs 2/3 s forward and is rewound to the same instant, so fades have settled and every tier shows the identical moment (SH5: without it, caster fade-ins were caught part-way). |
| `visibility_metrics.js` | How visible the shadows are in a `shots.js` folder: per scene and tier, the darkening of lit pixels against the OFF capture of the same instant (p90 / p99, share of lit pixels darkened ≥ 10 % / 25 %, strongest pixel, pixels made brighter), plus unamplified heat images; flags a scene whose darkness overlay changed between captures. Diagnostics, never a substitute for human QA. |
| `evidence/sh0/` | SH0 freeze: parent manifest, baseline retained-suite logs and summary, baseline scene captures. |
| `evidence/sh1/` | SH1 grounding: unit / browser / retained results, freeze verification, OFF-vs-MEDIUM captures. |
| `evidence/sh2/` | SH2 cast shadows: unit / browser / retained results, freeze verification, OFF/LOW/(MEDIUM)/HIGH captures and difference images, debug-view capture. |
| `evidence/sh3/` | SH3 performance: parent and candidate benches (JSON, logs, screenshots), the comparison tables, the profile before/after the layout fix, unit / browser / freeze results. |
| `evidence/sh4/` | SH4 final tree: unit / browser results, the full retained regression and its same-machine diagnosis, one-time build costs, freeze verification (`SH4_FINAL.md`). |
| `evidence/sh5/` | SH5 human-QA visibility correction: the SH4 verdict, the correction pack's identity, before (SH4) / after captures and measurements at OFF / LOW / MEDIUM / HIGH, unit / browser / freeze results, the repeated LOW phone-sized measurement. |
| `report/` | Generators of the root `2D_SHADOWS_*` reports from the evidence (`mk_test_summary.py`, `mk_performance.py`, `mk_changed_files.py`, `mk_diag.py`) and of the final package and its receipt (`package.py`); `mk_visibility.js` builds the SH5 before / after comparison images and table. |

Reproduce the SH0 baseline from a pristine export of the parent:

```
git archive f2805bb904c158df17c5c75c3d0d4681049bc246 | tar -x -C /tmp/parent
python3 dev/shadows/freeze.py verify --manifest dev/shadows/evidence/sh0/parent_manifest.json --dir /tmp/parent
python3 dev/shadows/run_retained.py run --game /tmp/parent --out /tmp/retained-parent
node dev/shadows/scene_bench.js --game /tmp/parent --out /tmp/bench-parent
```

Software rendering on a small container is evidence, never hardware certification.
