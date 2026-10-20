# Pre-Trial 3 final polish — checkpoints

Branch `pre-trial3-final-polish`, from the owner-accepted C5 `63805e98867c3677261307b8cd597f63592b8c45` (tree
`60e4452bb90c3a9650022dcdae9c2a225c356a8d`). Every checkpoint is a normal fast-forward push of this branch only, read back from GitHub by
`tools/verify_remote_p.py` (the commit, its tree and parent; `main`, Stage 3H, B++, the Trials branch, Trial 4, the review branch and C5
unchanged; no other branch moved or new). Receipts are in `evidence/remote/`. A commit cannot name its own hash, so each row's hash is
filled in by the next checkpoint.

**Live status: in progress.** Nothing merged or deployed. Trial 3 not started. Red Rooms untouched.

| # | What | Commit | Tree | Game change | Tests | Rollback |
|---|---|---|---|---|---|---|
| P0 | Baseline readback, the branch, `PLAN.md` (owners and plan), this log, `tools/verify_remote_p.py`, `inventory/remote_heads_before.json` | `7dbeda83d79d08617695f8ec6f268c32325daaa6` | `a4381694abe4ce302c052b8e041b5f6a426c1631` | none | build:check PASS (42), docs PASS (23), `__api` contract CURRENT, all remote heads as the pack says. Push verified (`evidence/remote/verify_p0_7dbeda8.json`); scanned clean after the push | `git checkout 63805e9` (C5) |
| P1 | Danger and death effects: `ui.css` holds `#light` (the darkness overlay) at full opacity over the dread hook's random inline flicker, and gives the capture one red impact (`#dread::after`, once; calmer under reduced motion); `mp.dread.js` plays the capture burst once per capture; `tools/vfx_probe.js` | (next row) | | near a monster the screen no longer flashes bright (the darkness was being lifted off the whole scene); a capture shows one red impact, then Trial 4's dim vignette; the capture sound plays once | `evidence/p1/STEPS.txt`: probe on C5 FAIL 9 of 17 (the defects), on P1 PASS 17 of 17; cli_golden PASS (B++'s core untouched; a first try inside core failed it and was dropped); fast tier 21 of 21 | `git checkout 7dbeda8` (P0) |
