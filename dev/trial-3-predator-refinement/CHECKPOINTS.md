# Trial 3 predator refinement — checkpoints

Branch `trial-3-predator-refinement`, created from the unapproved behaviour-refinement head `4518f93dff82e5ee8bfc8abb67dc0ecb4f77959a`
(tree `28815b06019ed38aff8c083e93b1ba7056da3d67`). Pushed only fast-forward, never forced. After each push `tools/verify_remote_pr.py`
reads the branch back from GitHub (SHA, tree, parent, one straight line from `4518f93`, every protected ref and every other branch
unchanged) into `evidence/remote/`; the secret scan runs before and after each push (`evidence/scans/`). A commit cannot name its own
hash: each row is filled in by the next checkpoint (the last by a receipt commit).

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| R0 audit, plan, reproduction, baseline | (this commit: `evidence/remote/r0.json` arrives with R1) | | `4518f93` | |

## R0 — audit and plan, no game change

Changed: only `dev/trial-3-predator-refinement/` (`AUDIT.md`, `PLAN.md`, this file, `BALANCE_TABLE.md`, `tools/repro_r0.js`,
`tools/scale_browser.js`, `tools/verify_remote_pr.py`, `inventory/remote_heads_before.json`, `evidence/`). The runtime is `4518f93`'s.

| Run (on `4518f93`) | Result |
|---|---|
| `tools/repro_r0.js` (8 seeds per row) | the owner's report reproduced (`AUDIT.md` §2): watched at hunger ≥ .75 it backs off, waits and leaves in 8 / 8 (13–18 s), 0 kills in 120 s of a starving one being watched; at ≤ .5 it leaves even an unaware person in light; after losing sight of a runner it ignores the footsteps it hears; a lost race ends in a departure in 8 / 8 (`evidence/r0_repro_baseline.*`) |
| `tools/scale_browser.js` (real server, Chromium) | undisguised Skin-Stealer drawn 49.6 × 61.5 world px (a 25 px torso), a Wanderer 39.5 × 59.4 (a solid ~38 px body), a Hound 86.2 × 162.5; no scale factor in the renderer (`evidence/r0_scale_before.*`, `r0_shots/`) |
| `npm test` | 202 / 215; the 13 failures are the inherited P9 ones, name for name as at B0 (`evidence/r0_npm_test.txt`, `r0_inherited_failures.txt`); SK 34 / 34, BR 19 / 19 |
| `npm run test:humanqa` | 5 / 6; X03 as on P9 (`evidence/r0_humanqa.txt`) |
