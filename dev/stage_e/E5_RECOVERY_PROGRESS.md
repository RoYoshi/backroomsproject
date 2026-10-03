# E5 recovery progress

Recovered from verified remote `bca4bb1ca183e7c2cb83a676d4f3c3e3167f954f` on `stage-e`.
All E0–E5 milestones are ancestors and the prior workspace tree matches exactly.
The accepted Stage D ZIP SHA-256 and CRC were verified; its 585 files were extracted separately.
Node v25.9.0 is used. No main-branch operation or Stage F work occurred.

The interrupted run left completed but uncommitted regression logs. These are retained verbatim in `evidence/recovered-candidate/`. They reveal a genuine candidate regression: `coarseMove` referenced an undeclared `geo` after the spatial early-return, crashing the flat far-LOD branch. The fix restores the original XY distance expression in that flat-only branch and regenerates `ai.js` from maintained sources.

Unchanged retained H14/H13 tests reproduce the exception before the fix and pass afterward; C07 and C9/C10 also pass. Focused Stage E core 8, motion 16, sensors 16, real entities 25 all pass after the fix. Before/after logs and recovery verification are in `evidence/recovery/`.

Long regressions, precise inherited-failure comparison, frozen trace capture/comparison, named future-gate activation, bounded spatial workload, real browser checks, package/build portability and final reports remain to be completed. No final engineering acceptance or human QA is claimed at this checkpoint.

## Retained regression and gate activation checkpoint

Remote repair checkpoint: `7f9afe23b00180cfacef699591cf795fd6ac62ce` (local `215840973c1da7d2c17bac699dfb31ed821f3f4f`, exact tree equality). All 18 retained suites completed on the repaired flat branch: aggregate 151/162 with the exact inherited failure sequence, Hound 18/18, shared 22/23 (F22), all network/IR and existing performance suites pass. Raw results are in `evidence/final-inherited/`.

Named Z10–Z17 wrappers now execute the existing 65 real-system groups; all eight named gates pass. Frozen matrix authority remains untouched. Additive spatial-only route reuse/refresh counters distinguish committed-route reuse from physical-edge proof caching without changing route decisions. A bounded eight-entity/four-surface run passes physical finite-state and evidence-cap checks, with timing/counters in `evidence/activation/`. AI output was regenerated after adding those counters; the remaining final suites will use that exact generated source. The preceding retained suites cover the identical flat branches.

Package-relative final verification and supplemental browser-error tools are added. Frozen record comparison, Stage C/D/browser regression and packaging remain outstanding.
