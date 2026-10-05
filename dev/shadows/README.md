# 2D Lighting & Shadows — stage tooling

Stage: **THE FAR BACKROOMS — 2D LIGHTING & SHADOWS VISUAL PASS ONLY**, branch `lighting-shadows-2d`,
immutable gameplay parent `f2805bb904c158df17c5c75c3d0d4681049bc246` (tree `8cc77595fe6e88c425e2f8abd243f3463af44a18`, v23.3.6).

Everything in this folder is development tooling and evidence. None of it is served to browsers, and the
server does not load any of it.

| file | what it does |
|---|---|
| `freeze.py` | `write`: hash manifest of every tracked file of the parent (git mode, blob id, SHA-256, size, protection class). `verify`: compares a revision or an extracted folder against it and fails if any protected/frozen file changed or an unexpected file was added. |
| `run_retained.py` | Runs the retained v23.3.6 suites serially with one log per suite (`run`); recomputes counts from saved logs (`reparse`); compares a candidate run with the baseline run suite by suite: verdict, counts and the set of failing assertion names (`compare`). |
| `scene_bench.js` | Starts the shipped `node server.js`, drives the real client in Chromium (SwiftShader software GL), freezes the halls through the real admin panel and measures representative scenes: frame intervals, main-thread time inside rAF callbacks, WebGL draw calls, 2D-canvas calls, CDP task/script time, the shadow module's own counters, plus a screenshot per scene. The same script runs against the parent (tier `baseline`) and the candidate (tiers `off/low/medium/high`). |
| `evidence/sh0/` | SH0 freeze: parent manifest, baseline retained-suite logs and summary, baseline scene captures. |

Reproduce the SH0 baseline from a pristine export of the parent:

```
git archive f2805bb904c158df17c5c75c3d0d4681049bc246 | tar -x -C /tmp/parent
python3 dev/shadows/freeze.py verify --manifest dev/shadows/evidence/sh0/parent_manifest.json --dir /tmp/parent
python3 dev/shadows/run_retained.py run --game /tmp/parent --out /tmp/retained-parent
node dev/shadows/scene_bench.js --game /tmp/parent --out /tmp/bench-parent
```

Software rendering on a small container is evidence, never hardware certification.
