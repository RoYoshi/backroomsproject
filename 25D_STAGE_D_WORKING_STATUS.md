# Stage D working recovery checkpoint

CORE PROTOTYPE VERIFIED — LONG VALIDATION PENDING

Parent: locked Stage C ZIP SHA-256 `0ded2b248867be592c25585de89a45217cbf989f4257c1a94301ffbaa89c585b`. Stage D only. Stage E has not begun.

Implemented: isolated Pixi/WebGL2 prototype, real XYZ depth, exact bounded physical ray visibility over all 32 original solids, local eligible-group cutaway, original player art, canonical camera culling, last-drawn masked annotations, two independent views. Physics and production rendering remain unchanged.

Verified before this checkpoint: parent preflight; 10 focused view groups; 8 actual Chromium browser groups including hidden cross-floor and overlay pixel equality, opening visibility, partial occlusion, draw-order invariance and shared immutable world. Browser is Chromium 151.0.7922.34 / SwiftShader, not a hardware reference profile.

Next exact step: run retained regression suites serially, add and execute extended browser fairness/performance and flat-parent pixel comparison, run simulation-independence and path-with-spaces checks, inspect screenshots, write final reports, create final ZIP once and run bounded extraction acceptance. Human gameplay QA remains pending.

Prototype URL: `/stage_d.html`; start with `node server.js`. Unit: `node dev/stage_d/test_view.js`. Browser: `node dev/stage_d/browser_core.js` with externally installed Playwright and optional `TFB_BROWSER_EXECUTABLE`. No bundled browser dependency.

Known development defects already corrected: inherited Pixi upload premultiplication corrupted floating point plane data; own-surface expansion caused distant receiver self-shadow. Browser tests cover the corrected paths. Narrow-wall art legitimately protrudes at its sides; full physical occlusion is tested separately.

Modified original: server.js (public prototype allowlist only). Deleted originals: 0.

New files at checkpoint creation:

- `assets/stageD-browser.js`
- `assets/stageD-pixi.js`
- `assets/stageD-prototype.js`
- `assets/stageD-world.json`
- `dev/stage_d/STAGE_D_MASTER_PROMPT.txt`
- `dev/stage_d/browser_core.js`
- `dev/stage_d/browser_support.js`
- `dev/stage_d/build_prototype.js`
- `dev/stage_d/evidence/browser-core.json`
- `dev/stage_d/evidence/browser-installed.json`
- `dev/stage_d/evidence/browser-launch.json`
- `dev/stage_d/evidence/core-balcony.png`
- `dev/stage_d/evidence/core-crawl.png`
- `dev/stage_d/evidence/core-lower.png`
- `dev/stage_d/evidence/core-ramp.png`
- `dev/stage_d/evidence/core-stairs.png`
- `dev/stage_d/evidence/core-two-views.png`
- `dev/stage_d/evidence/core-upper.png`
- `dev/stage_d/evidence/core-wall.png`
- `dev/stage_d/evidence/preflight-http.json`
- `dev/stage_d/evidence/preflight-parity.json`
- `dev/stage_d/evidence/preflight.json`
- `dev/stage_d/evidence/view.json`
- `dev/stage_d/modified-original-allowlist.json`
- `dev/stage_d/parent-stage-c-manifest.json`
- `dev/stage_d/runtime-provenance.json`
- `dev/stage_d/test_view.js`
- `stage_d.html`
- `world_view.js`
- `25D_STAGE_D_WORKING_STATUS.md`
