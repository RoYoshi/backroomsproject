# Trial 3 R9–R17 — changed files

Every file this branch changes against R8 (`f378049`), by checkpoint, with why. Built outputs are listed with the source they are built
from (`npm run build`; `npm run build:check` proves them). Development files (`dev/`) are listed by folder.

## R9 — audit (no game change)
- `dev/trial-3-r9-overhaul/` (new): `R9_AUDIT.md`, `CHECKPOINTS.md`, `inventory/remote_heads_before.json`, `evidence/r9/`, tools
  (`repro_r9.js`, `diag_route_r9.js`, `qa_sight.js` test-only, `r9_browser.js`, `qa_server.js` test-only, `verify_remote_r9.py`).
- `dev/tests/s_skinr9.js` (new): R9-01, the reproducer (fails on R8 by design; not in `run.js`'s default list until it passes).

## R10 — the Skin-Stealer's dread only in sight (client)
| File | Kind | Change |
|---|---|---|
| `src/frameworks/spacious-audio/client/skin.sight.js` | new part of `public/assets/skinstealer.js` | the page's own sight of each undisguised Skin-Stealer (on screen, sight mask by `__api.Uc`, readable by `__api.Ul` ≥ .25), its envelope `ks`, the sting's arming and gap, `sightLog` |
| `src/frameworks/br-r/client/skin.compose.js` | source | composes the new module (`skinSight({ head, mirror })`) |
| `src/core/client/mp.frame.js` | source | asks `window.__skin.sight()` once a frame; heartbeat on `max(k, ks)`; the Skin-Stealer's sting (not within 1.2 s of the `k` sting); every `k` output unchanged |
| `src/build-recipes.json` | build | the new part, before `skin.compose.js` |
| `public/assets/skinstealer.js`, `public/mp.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `docs/architecture/BUILD_PIPELINE.md`, `docs/architecture/FRAMEWORKS.md`, `src/frameworks/spacious-audio/README.md` | generated doc tables | `node dev/tools/docs/docs.js` (the new part listed) |
| `dev/tests/s_skinsight.js` | new suite, in `run.js`'s default list | V01–V06, V08, V09, V11 (the built script in a VM), V12 (R8's `mp.frame.js` against this one, frame by frame) |
| `dev/tests/run.js` | test list | `s_skinsight.js` added |
| `dev/trial-3-r9-overhaul/fixtures/mp.frame.f378049.js` | test fixture | R8's `mp.frame.js` byte for byte (git blob `d478c2b`, checked by V12) |
| `dev/trial-3-r9-overhaul/tools/r9_browser.js`, `qa_server.js` | dev tools | the two-page `sight` scene (each page in its own browser), the test-only disguise placement |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md` | doc | R10-1 … R10-7 |
