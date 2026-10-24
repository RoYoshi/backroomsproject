# Trial 3 R19, S track - changelog

Trial 3 is **not owner-approved**.  Branch `trial-3-r19-prechase-positioning`, one straight line from the R18 receipt `01e5d97`.  Every
checkpoint pushed and read back (`REMOTE_RECEIPTS.md`).

| checkpoint | commit | files | what |
|---|---|---|---|
| S0 | `71cebb4` | `dev/trial-3-r19-positioning/` AUDIT.md, tools (prechase_sim.js, scene_r19.js, verify_remote_r19.py), inventory, evidence/S0 (R18's test runs) | the audit: R18 verified, its tests re-run, its positioning reproduced; no game change |
| S1-S2 | `57271c0` | `src/frameworks/nani/server/ai.skinstealer.js` (+81/-7), `src/frameworks/nani/server/ai.skin.move.js` (+12/-7: skWayOut factored out), `generated/server/ai.js`, `generated/BUILD_MANIFEST.json`; `dev/tests/s_skinr19.js` (new), `dev/tests/run.js`; DESIGN_DECISIONS.md | the positioning (skFlankWorth, flankStale, the moved-on rule, skContest), the vault carried through, the admin record; SR01-SR05 |
| S3 (interim) | `87165a7` | reports so far, evidence/S0 (R18's scenes), evidence/S3 (this branch's scenes) | the reports while the QA ran (no game change) |
| S3-review | (this commit) | `src/frameworks/nani/server/ai.skinstealer.js` (skFlankWorth: a mover's way round refused outright, its current speeds; the refusal remembered for the place; records only when the plan changes; no bait for somebody going their own way on the next thinks; the contest point only where it keeps them in sight; the unreachable moved-on rule withdrawn), `generated/`; `dev/tests/s_skinr19.js` (SR01 towards it, SR05 where it reckons, SR06 new), `dev/tests/run.js`; DESIGN_DECISIONS.md, DEFERRED.md, HUMAN_QA.md, SECURITY_AND_SCOPE.md, README.md | the independent review's findings fixed |
| S3-review2 | (the commit after `3c64a41`) | `src/frameworks/nani/server/ai.skinstealer.js` (the refusal's think gated for walkers coming on; a way round given up because they run off counts as stale for the no-bait rule and is remembered; a kept contest point re-checked from where it is), `generated/`; `dev/tests/s_skinr19.js` (SR01: no bait within 2.5 s of a dropped way round); `tools/r19_browser.js` (new); DESIGN_DECISIONS.md, REGRESSION.md, DEFERRED.md, HUMAN_QA.md, README.md, SECURITY_AND_SCOPE.md, evidence/S0 (R18's simulations), evidence/S3 (this branch's tests, scenes, simulations) | the second review's findings |
| S3-review2b | (the commit after `f0c95ff`) | `src/frameworks/nani/server/ai.skinstealer.js` (the kept contest point's re-check reaches `SK.contestFrom` + 200 px, not directOk's default 420: the second reviewer's follow-up), `generated/`; DESIGN_DECISIONS.md, DEFERRED.md, evidence/S3 (the full suite, the scenes and the simulations again: identical but for timings) | the follow-up |
| S3-addendum | (the commit after `83a05c1`) | evidence/S3/outcomes (the N branch's pursuit tool on R18 and S), evidence/S0/browser and S3/browser (the S scenes, the owner's thirteen scenes and the focused scenes on R18 and S); REGRESSION.md ("Never weaker"), HUMAN_QA.md (S-J), DESIGN_DECISIONS.md | the owner's addendum: the Skin-Stealer not weaker anywhere measured |
| S4 | (a later commit) | BROWSER_AND_MEDIA.md, PERFORMANCE.md, REMOTE_RECEIPTS.md, evidence/S3 | the final QA receipts |

**Generated files.**  `generated/server/ai.js` is built from the parts by `npm run build`; `npm run build:check` reports "BUILD CHECK:
PASS (44 outputs and the manifest are what src/ builds)" at every checkpoint, and `dev/tools/checks/parts.js` "PARTS CHECK: PASS".
