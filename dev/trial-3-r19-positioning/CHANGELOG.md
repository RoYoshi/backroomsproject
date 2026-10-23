# Trial 3 R19, S track - changelog

Trial 3 is **not owner-approved**.  Branch `trial-3-r19-prechase-positioning`, one straight line from the R18 receipt `01e5d97`.  Every
checkpoint pushed and read back (`REMOTE_RECEIPTS.md`).

| checkpoint | commit | files | what |
|---|---|---|---|
| S0 | `71cebb4` | `dev/trial-3-r19-positioning/` AUDIT.md, tools (prechase_sim.js, scene_r19.js, verify_remote_r19.py), inventory, evidence/S0 (R18's test runs) | the audit: R18 verified, its tests re-run, its positioning reproduced; no game change |
| S1-S2 | `57271c0` | `src/frameworks/nani/server/ai.skinstealer.js` (+81/-7), `src/frameworks/nani/server/ai.skin.move.js` (+12/-7: skWayOut factored out), `generated/server/ai.js`, `generated/BUILD_MANIFEST.json`; `dev/tests/s_skinr19.js` (new), `dev/tests/run.js`; DESIGN_DECISIONS.md | the positioning (skFlankWorth, flankStale, the moved-on rule, skContest), the vault carried through, the admin record; SR01-SR05 |
| S3 | (this commit's successor) | reports, evidence/S0 (R18's simulations and scenes), evidence/S3 (this branch's, the browser, performance) | the adversarial QA |

**Generated files.**  `generated/server/ai.js` is built from the parts by `npm run build`; `npm run build:check` reports "BUILD CHECK:
PASS (44 outputs and the manifest are what src/ builds)" at every checkpoint, and `dev/tools/checks/parts.js` "PARTS CHECK: PASS".
