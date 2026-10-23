# Trial 3 R19, N track - changelog

Trial 3 is **not owner-approved**.  Branch `trial-3-nani-cornering-qol`, one straight line from the R18 receipt `01e5d97`.  Every
checkpoint pushed and read back (`REMOTE_RECEIPTS.md`).

| checkpoint | commit | files | what |
|---|---|---|---|
| N0 | `667e0f1` | `dev/trial-3-nani-corners/` AUDIT.md, tools (corner_audit.js, corner_plot.py, verify_remote_r19.py), inventory, evidence/N0 | the audit: R18 verified, its tests re-run, the follower measured (640 runs), the stop-pivot-go found; no game change |
| N1 | `94592b0` | `src/frameworks/nani/server/ai.entity.js` (+13 lines, one hunk), `generated/server/ai.js`, `generated/BUILD_MANIFEST.json`; `dev/tests/` s_nanicorner.js (new), r19n_patch.js (new), r19n_c15.js (new), run.js, s_skinpredator.js (PR25), s_wandererlock.js (WL05), s_skinmind.js (C15); DESIGN_DECISIONS.md, evidence/N1 | the fix, its tests, the locks taught the hunk |
| N2 | (this commit's successor) | reports, evidence/N2 (browser, simulation, performance) | the adversarial QA |

**Generated files.**  `generated/server/ai.js` is built from the parts by `npm run build` (dev/tools/build/build.js); `npm run
build:check` reports "BUILD CHECK: PASS (44 outputs and the manifest are what src/ builds)" at every checkpoint; the hunk is in the built
file exactly once (r19n_patch.js's `remove()` succeeds on it - C15 and s_nanicorner.js would fail otherwise).
