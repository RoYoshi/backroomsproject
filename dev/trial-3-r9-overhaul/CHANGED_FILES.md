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

## R11 — its mind: attention, events, opportunism, belief (server)
| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skin.mind.js` | new part of `generated/server/ai.js` | `skExposedTo` / `skLegible` (could a person see it, by the client's sight-mask and legibility rules on the server's level), `skObsOf` (an observer as it knows them: seen, or a belief), the per-think events with their answers (`skMindTick`, `skMindKept`), the evidence log (`skMindLog`), `skMindDbg` |
| `src/frameworks/nani/server/ai.skinstealer.js` | source | `e.mind` (made at spawn, cleared with it); the mind ticks first on each think; R11 constants (`watchHungry`, `gazeFar`, `ackEyes`, `ackCome`, `ackLook`, `ackOver`, `ackHead`); a hungry look is shorter; the lit-and-watched leave weight follows `hm`; first-sight acknowledgement (`skAttend`) and the salience gaze / look over the shoulder (`skGaze`); decisions that keep their plan answer their events; the hunt's evidence log; `mi` and `ht.log` in its debug |
| `src/frameworks/overseer/client/ents.debug.js` | source (admin overlay, debug mode only) | the `MIND` lines: who could see it, its events and answers, (selected) its evidence |
| `src/build-recipes.json` | build | the new part, before `ai.skinstealer.js` |
| `generated/server/ai.js`, `public/ents.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `docs/architecture/BUILD_PIPELINE.md`, `docs/architecture/FRAMEWORKS.md`, `src/frameworks/nani/README.md` | generated doc tables | `node dev/tools/docs/docs.js` (the new part listed) |
| `dev/tests/s_skinmind.js` | new suite, in `run.js`'s default list | C01–C15 |
| `dev/tests/run.js` | test list | `s_skinmind.js` added |
| `dev/trial-3-r9-overhaul/tools/c15_hashes.js`, `fixtures/c15_r8.json` | dev tool, test fixture | C15: per-second snapshot hashes, no Skin-Stealer, three seeds; the fixture made on R8 `f378049` |
| `dev/trial-3-r9-overhaul/tools/trace_r11.js` | dev tool | the state traces with reasons (`evidence/r11/trace_r11.txt`): plan, act, why, head, who could see it, events and their answers, evidence |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `evidence/r10/` (receipt, scans), `evidence/r11/` | docs, evidence | R11-1 … R11-7; R10's receipt |
