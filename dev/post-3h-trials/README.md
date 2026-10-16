# dev/post-3h-trials: the post-3H integration trials (1, then 2, then 4)

Development only. Nothing here is served or loaded by the game.

## Authority and order

- **The owner's integration pack** of 2026-10-15, `THE_FAR_BACKROOMS_POST_3H_TRIALS_1_2_4_MASTER_PACK.zip` (SHA-256
  `1c95a530f7beb53e682bc7712ea842e12b485e14add1b5d5007102c382454e29`; its own `SHA256SUMS.txt` checked). It is not committed here.
- **The baseline:** the owner accepted Stage 3H at C5d, `4beba2f36deaf17473ad3b955eeefdd6fcfbd90b` (tree
  `677d4ebf95d960e51dc86792bbc0861e3e1eb4c9`), after playing it. That is acceptance of the candidate, not of a merge or a deployment.
- **The branch:** `post-3h-trials-1-2-4`, created from exactly C5d. Only this branch is pushed, fast-forward. `stage-3h-engine-modernization`
  (C5d), M8 `c34f0c2`, B++ `143b63f`, the frozen 3H2 `22751bb` and `main` are read-only references; every push receipt records them.
- **The order:** Trial 1, then Trial 2 after the owner's PASS on Trial 1, then Trial 4 after the owner's PASS on Trial 2. Each trial
  ends at a verified checkpoint and its own Human QA page, and stops for the owner: PASS / ACCEPT, NEEDS CHANGES or ROLL BACK.
- **Not authorized:** Trial 3 (the Skin-Stealer, or any new entity), a merge, a deployment, a change of production settings, secrets or
  repository visibility. No rate of the server (the 25 ms tick, the snapshots, the poses) changes.

| Trial | What it changes, on purpose | State |
|---|---|---|
| 1 | The main menu's title drifts a few pixels on its own, as well as leaning with the pointer | **ACCEPTED by the owner** (PASS / ACCEPT, 2026-10-16) at T1-B `4a39b53` (`T1_REPORT.md`, `HUMAN_QA_T1.md`) |
| 2 | A global chat on the main menu; nearby speech in a run, as bubbles, sent only to players close enough in the same room | **in progress** (authorized 2026-10-16): `T2_DESIGN.md` |
| 4 | NEW RUN's button reads "Spontaneously Combust?"; red, green and blue sliders for the wanderer's colours; no rapid full-screen flashing | not started: waits for the owner's PASS on Trial 2 |

## What is where

| File | What it is |
|---|---|
| `CHECKPOINTS.md` | Every pushed trial checkpoint: commit, tree, tests, rollback |
| `T1_REPORT.md`, `HUMAN_QA_T1.md` | Trial 1's report and its Human QA page, for the owner |
| `evidence/t1a/`, `evidence/t1/` | What Trial 1's commands produced, by checkpoint (each `STEPS.txt` says which file is which); `evidence/remote/` holds the push receipts |
| `tools/` | The trials' own tools: `t1_menu_perf.js` (what the drift costs on the idle menu, A/B and A/A), `t1_capture.js` (a capture of the title for the Human QA evidence), `verify_remote_t.py` (a pushed checkpoint read back from GitHub) |
| `inventory/` | Every remote head before the first push (the remote check compares with it) |

The lasting checks live with the others: `dev/tools/checks/menu_drift.js` (the gate's full-tier `menu` step).

## How a trial is checked

- **Its own change** has its own positive checks and their mutants, against the accepted C5d.
- **Everything else** stays under the modernization gate (`dev/tools/gate/gate.js`), which still compares every checkpoint with B++;
  the trial's changed files are declared in `dev/tools/gate/declared_changes.json`, so a change nobody declared still fails.
- **The checkpoint** is pushed normally and read back from GitHub (`dev/stage-3h-modernization/tools/verify_remote_m.py`): the commit, its
  tree and parent, and every protected ref unchanged.
