# Trial 3 R19, N track - changelog

Trial 3 is **not owner-approved**.  Branch `trial-3-nani-cornering-qol`, one straight line from the R18 receipt `01e5d97`.  Every
checkpoint pushed and read back (`REMOTE_RECEIPTS.md`).

| checkpoint | commit | files | what |
|---|---|---|---|
| N0 | `667e0f1` | `dev/trial-3-nani-corners/` AUDIT.md, tools (corner_audit.js, corner_plot.py, verify_remote_r19.py), inventory, evidence/N0 | the audit: R18 verified, its tests re-run, the follower measured (640 runs), the stop-pivot-go found; no game change |
| N1 | `94592b0` | `src/frameworks/nani/server/ai.entity.js` (+13 lines, one hunk), `generated/server/ai.js`, `generated/BUILD_MANIFEST.json`; `dev/tests/` s_nanicorner.js (new), r19n_patch.js (new), r19n_c15.js (new), run.js, s_skinpredator.js (PR25), s_wandererlock.js (WL05), s_skinmind.js (C15); DESIGN_DECISIONS.md, evidence/N1 | the fix, its tests, the locks taught the hunk |
| N2 (interim) | `8fd8058` | reports so far, tools/corner_browser.js | the reports while the QA ran (no game change) |
| N2-review | (this commit) | `src/frameworks/nani/server/ai.entity.js` (the hunk narrowed: the inner side of the bend, the body's own look-ahead at its collider + 2 px, the waypoint after the next), `generated/`; `dev/tests/` r19n_patch.js (the hunk as it now is), s_nanicorner.js (NC04's navigation chase), r19n_chase.js and r19n_child.js (new); tools/fresh_seeds.js (the review's probe); DESIGN_DECISIONS.md, REGRESSION.md, AUDIT.md, SECURITY_AND_SCOPE.md, evidence/N2 | the independent review's findings fixed |
| N2-review2 | (the commit after `c1d6fd0`) | the hunk's comment corrected (the side test is of the heading; no code change), `r19n_patch.js` and `generated/` regenerated; `tools/corner_browser.js` (the page revived between tries, the world frozen on arrival, measured up to the arrival); DESIGN_DECISIONS.md, REGRESSION.md, BROWSER_AND_MEDIA.md, HUMAN_QA.md, evidence/N2 | the second review's nits; the real-page corner runs |
| N3 | (a later commit) | PERFORMANCE.md, REMOTE_RECEIPTS.md, evidence/N2 | the final QA receipts |

**Generated files.**  `generated/server/ai.js` is built from the parts by `npm run build` (dev/tools/build/build.js); `npm run
build:check` reports "BUILD CHECK: PASS (44 outputs and the manifest are what src/ builds)" at every checkpoint; the hunk is in the built
file exactly once (r19n_patch.js's `remove()` succeeds on it - C15 and s_nanicorner.js would fail otherwise).
