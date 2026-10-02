# Stage D tools and isolated prototype

From the package root, run `node server.js`, then open `/stage_d.html` on that server. `/` is the unchanged Level 0 game. Scene choices are deterministic render placements in the unchanged Stage C fixture, not migrated game actors. Cutaway and quality controls affect presentation only. Two views share the same frozen world/snapshot with independent local state. Add `?manual=1` for deterministic harness control through `window.stageD`.

Node runtime has no new production dependencies. Rebuild generated prototype assets with `node dev/stage_d/build_prototype.js`. This pins the existing production bundle hash, extracts its exact Pixi runtime and original static avatar class, and removes only the browser extension's production-bootstrap side-effect import in its isolated generated copy. Do not hand-edit generated assets. The original bundle and chunks stay unchanged. The extracted avatar's constructor/rebuild are used with explicit arguments; its game-bound animation/death methods are not invoked or migrated.

Commands (all package-relative):

```sh
node dev/stage_d/test_view.js
node dev/stage_d/test_independence.js
node dev/stage_d/verify_scope.js
python3 dev/stage_d/run_validation.py --group spatial
python3 dev/stage_d/run_inherited.py --out dev/stage_d/evidence/inherited
```

The inherited runner preserves the original commands/assertions and commits complete captured output after each process exits. Its known nonzero results are recorded; the runner itself does not bless failing tests.

Browser tooling additionally needs Playwright and a Chromium executable. In a development copy, one conventional setup is `npm install --no-save --package-lock=false playwright`, followed by `npx playwright install chromium`. The implementation run used Playwright 1.62.1 and Chromium headless shell 151.0.7922.34. `TFB_BROWSER_EXECUTABLE` optionally selects an independently installed executable. The runtime's `CODEX_PRIMARY_RUNTIME_NODE_MODULES` is an optional test-runner fallback, not a game asset dependency. No browser binary or machine-specific asset path is shipped.

```sh
node dev/stage_d/browser_core.js
node dev/stage_d/browser_extended.js
node dev/stage_d/browser_performance.js
node dev/stage_d/browser_flat.js . /path/to/pristine-stage-c
```

The tools accept optional root/output paths; quote paths containing spaces. `browser_flat.js` requires the pristine Stage C tree as its second argument and takes an optional output directory third. `run_validation.py --group browser --parent /path/to/pristine-stage-c` orchestrates all browser groups. Browser tests deliberately select SwiftShader for reproducibility and record the exposed GPU; these are not hardware-reference benchmarks. `browser_performance.js` drains actual GPU work with synchronous pixel readback. The historical enqueue-only measurements under `evidence/development/` are explicitly superseded.

`browser_core.js` performs bounded actual-HTTP and WebGL pixel acceptance and saves screenshots. `browser_extended.js` checks the required viewport/DPR cases, reduced quality, elevated XY candidate culling and fade/edge stability. Pure Node/VM/HTTP checks are never labeled browser rendering.

Capacity is intentionally bounded to this early feasibility stage: at most 64 validated convex solids, at most 8 planes each; the fixture has 32. Unsupported capacity throws instead of dropping occluders. Targets cap at 4,194,304 pixels per view. The 16.7 ms reference hardware budget and subjective human QA remain unverified. The current software GPU misses that budget.

Stage E navigation/sensors, Stage F protocol, Stage G aftermath elevation, Stage H broad effects/UI integration, production picking/aim and full gameplay lighting are not implemented here.
