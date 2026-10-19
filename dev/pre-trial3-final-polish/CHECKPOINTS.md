# Pre-Trial 3 final polish — checkpoints

Branch `pre-trial3-final-polish`, from the owner-accepted C5 `63805e98867c3677261307b8cd597f63592b8c45` (tree
`60e4452bb90c3a9650022dcdae9c2a225c356a8d`). Every checkpoint is a normal fast-forward push of this branch only, read back from GitHub by
`tools/verify_remote_p.py` (the commit, its tree and parent; `main`, Stage 3H, B++, the Trials branch, Trial 4, the review branch and C5
unchanged; no other branch moved or new). Receipts are in `evidence/remote/`. A commit cannot name its own hash, so each row's hash is
filled in by the next checkpoint.

**Live status: in progress.** Nothing merged or deployed. Trial 3 not started. Red Rooms untouched.

| # | What | Commit | Tree | Game change | Tests | Rollback |
|---|---|---|---|---|---|---|
| P0 | Baseline readback, the branch, `PLAN.md` (owners and plan), this log, `tools/verify_remote_p.py`, `inventory/remote_heads_before.json` | (next row) | | none | build:check PASS (42), docs PASS (23), `__api` contract CURRENT, all remote heads as the pack says | `git checkout 63805e9` (C5) |
