# Post-3H integration trials: checkpoints

Every checkpoint is a normal (fast-forward) push to `post-3h-trials-1-2-4`, read back from GitHub with
`dev/stage-3h-modernization/tools/verify_remote_m.py` (the commit, its tree and parent, and every protected ref unchanged); the receipt
is kept in `evidence/remote/`. A commit cannot name its own hash, so each row's commit is filled in by the next checkpoint's commit.

**Live status: Trial 1 IN PROGRESS.** Not accepted; nothing merged or deployed.

| # | What | Commit | Tree | Game change | Tests | Rollback |
|---|---|---|---|---|---|---|
| — | base: the owner-accepted Stage 3H C5d | `4beba2f36deaf17473ad3b955eeefdd6fcfbd90b` | `677d4ebf95d960e51dc86792bbc0861e3e1eb4c9` | — | C5d's own (`dev/stage-3h-modernization/CHECKPOINTS.md`) | — |
| T1-A | Trial 1 in source: the main menu's title drift (F.R.O.N.T.'s `ui.js`, `ui.css`), its check (`dev/tools/checks/menu_drift.js`) and the gate's full-tier `menu` step. A **preservation** checkpoint, pushed after the machine restarted mid-verification | this commit | — | the main menu's title drifts a few pixels (deliberate, Trial 1) | the drift check's candidate checks and its comparison with C5d passed; build, docs and client record checks pass; NOT yet run: its mutants, the gate, performance, the package (`evidence/t1a/STEPS.txt`) | `git checkout 4beba2f` (C5d) |
