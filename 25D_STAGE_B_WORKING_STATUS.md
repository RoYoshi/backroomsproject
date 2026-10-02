# Stage B working recovery checkpoint

Status: IMPLEMENTATION RECONSTRUCTED — FINAL VALIDATION PENDING.
This is a working recovery artifact, not the final Stage B release.

## Completed
- Verified Stage A ZIP SHA-256 `43611c0282f387748b8f6782268c101d7022380986288ee40c781a19a19696e0`.
- Verified locked architecture SHA-256 `f2bd15d6091505128516572db84a463cb8d4dcece946eb92433a614d05f6976d`.
- Canonical Level 0 definition, shared geometry validator/compiler and flat adapter.
- Deterministic content/material identity and explicit unsupported spatial APIs.
- Narrow client integration and maintained-source server simulation generation.
- B-01 intentionally fixed without altering camera/timing policy values.
- Stage C has NOT started. No gameplay Z, gravity, support solver or vertical renderer.

## Evidence already passed in this reconstruction
- Stage A embedded manifest, contracts, negative diff control and all 46 reference traces reproduced.
- Preflight Hound 18/18, HQA 6/6, FPS equality, camera 12/12; three builds byte-reproducible.
- Preflight real HTTP B-01 broken baseline reproduced (200/200/404/404).
- Stage B 24 geometry/identity/validation groups pass.
- Frozen map/props/rooms/lamps/crawl/material/navigation/query/seed export byte-identical.
- All 46 gameplay trace record arrays match exactly: 35,098 records.
- Only metadata delta: network-lifecycle sourceSha256 from changed dev/sim_glue.js.
- 336 original Stage A files unchanged; only seven original files modified.
- Actual HTTP: eight packaged resources return 200 with exact bytes; 11 malformed/internal/traversal
  checks return safe 400/404 and valid request immediately afterward succeeds.
- Actual served policy scripts reach literal application timing/resize/world bindings in VM;
  12 viewport/DPR cases stay within the established envelope. This is not browser rendering QA.

## Checks still required before final Stage B claim
- Full aggregate/shared/AI/HQA/FPS/camera/death/interpolation/navigation regressions after migration.
- Real network audit_net, audit_net2, live and IR suites.
- Existing Hound/shared/Smiler/light performance gates.
- Fresh path-with-spaces build and Stage B checks; browser capability probe and honest blocker recording.
- Final reports, inherited failure classifications, human-QA checklist and bounded final archive verification.

## Failures and limits
Initial verifier invocation from the workspace root used the wrong path and failed before execution.
First sandboxed child-process verification hit EPERM; rerun with permitted subprocess/socket access passed.
Neither is a product failure. No Stage B gameplay divergence observed. The full migrated legacy suite has
NOT run yet; historical 151/162 and P08 UNKNOWN/L5c timing sensitivity remain documented in Stage A evidence.
Human QA remains pending. Previous lost-run success claims are not used as evidence.

## Exact next step
After this recovery ZIP is safely preserved externally, run the remaining existing regression commands
listed in dev/stage_b/STAGE_B_INSTRUCTION.txt Phase 10, saving per-command raw output and exit status.
Do not repeat successful preflight or overwrite reference traces. Do not start Stage C.

## Modified original files
- `assets/index-DKbV5Nv9.js`
- `dev/sim_glue.js`
- `dev/sim_head.js`
- `index.html`
- `server.js`
- `sim.js`
- `world.js`

## New implementation/evidence files
- `dev/contracts/world_definition_stage_b.d.ts`
- `dev/stage_b/README.md`
- `dev/stage_b/STAGE_B_INSTRUCTION.txt`
- `dev/stage_b/content_identity.js`
- `dev/stage_b/export_world.js`
- `dev/stage_b/level0-baseline.json.gz`
- `dev/stage_b/planar-kernel-provenance.json`
- `dev/stage_b/results/bundle-edits.json`
- `dev/stage_b/results/core-parity.json`
- `dev/stage_b/results/preflight-0.log`
- `dev/stage_b/results/preflight-1.log`
- `dev/stage_b/results/preflight-2.log`
- `dev/stage_b/results/preflight-3.log`
- `dev/stage_b/results/preflight-4.log`
- `dev/stage_b/results/preflight-5.log`
- `dev/stage_b/results/preflight-6.log`
- `dev/stage_b/results/preflight-7.log`
- `dev/stage_b/results/preflight-8.log`
- `dev/stage_b/results/preflight-http.json`
- `dev/stage_b/results/preflight-traces.log`
- `dev/stage_b/results/preflight.json`
- `dev/stage_b/results/served-package.json`
- `dev/stage_b/served_package.js`
- `dev/stage_b/stageA-manifest.json`
- `dev/stage_b/test_geometry.js`
- `dev/stage_b/verify.js`
- `levels/level0.js`
- `world_geometry.js`
- `25D_STAGE_B_WORKING_STATUS.md` (this report)
