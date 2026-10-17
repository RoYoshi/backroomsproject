# dev/post-3h-trials: the post-3H integration trials (1, then 2, then 4)

Development only. Nothing here is served or loaded by the game.

## Authority and order

- **The owner's integration pack** of 2026-10-15, `THE_FAR_BACKROOMS_POST_3H_TRIALS_1_2_4_MASTER_PACK.zip` (SHA-256
  `1c95a530f7beb53e682bc7712ea842e12b485e14add1b5d5007102c382454e29`; its own `SHA256SUMS.txt` checked). It is not committed here.
- **The baseline:** the owner accepted Stage 3H at C5d, `4beba2f36deaf17473ad3b955eeefdd6fcfbd90b` (tree
  `677d4ebf95d960e51dc86792bbc0861e3e1eb4c9`), after playing it. That is acceptance of the candidate, not of a merge or a deployment.
- **The original Trials 1–2 branch:** `post-3h-trials-1-2-4`, created from exactly C5d. Trial 4 was instead developed on the isolated `trial-4-rgb-chat-accessibility` branch, forked from `58fcf5b` to preserve the integration branch. Only the separate Trial 4 branch was advanced for this owner-waived closeout. `stage-3h-engine-modernization`
  (C5d), M8 `c34f0c2`, B++ `143b63f`, the frozen 3H2 `22751bb` and `main` are read-only references; every push receipt records them.
- **The order:** Trial 1, then Trial 2 after the owner's PASS on Trial 1, then Trial 4 after the owner's PASS on Trial 2. Each trial
  ends at a verified checkpoint and its own Human QA page, and stops for the owner: PASS / ACCEPT, NEEDS CHANGES or ROLL BACK.
- **Not authorized:** Trial 3 (the Skin-Stealer, or any new entity), a merge, a deployment, a change of production settings, secrets or
  repository visibility. No rate of the server (the 25 ms tick, the snapshots, the poses) changes.

| Trial | What it changes, on purpose | State |
|---|---|---|
| 1 | The main menu's title drifts a few pixels on its own, as well as leaning with the pointer | **ACCEPTED by the owner** (PASS / ACCEPT, 2026-10-16) at T1-B `4a39b53` (`T1_REPORT.md`, `HUMAN_QA_T1.md`) |
| 2 | A global chat on the main menu; nearby speech in a run, as bubbles, sent only to players close enough in the same room | **Functional Human QA APPROVED by owner.** Original complete gate was 30/31; later standalone contact-lab rerun passed 23/23; these are distinct results. Formal T2 publication on the original branch is still separate. |
| 4 | "Spontaneously Combust?" button, RGB sliders, gentler screen effects, nearby-chat indicator and sender-colored bubbles | **CLOSED / COMPLETE BY OWNER WAIVER (2026-10-17)** on `trial-4-rgb-chat-accessibility`. Build check PASS (41 outputs), chat server 83/83 PASS, 13/13 mutants caught. Chromium suite and full gate **not passed/verified**; owner explicitly waived remaining validation. See `T4_REPORT.md` and `HUMAN_QA_T4.md`. |

## What is where

| File | What it is |
|---|---|
| `CHECKPOINTS.md` | Every pushed trial checkpoint: commit, tree, tests, rollback |
| `T1_REPORT.md`, `HUMAN_QA_T1.md` | Trial 1's report and its Human QA page, for the owner |
| `T2_REPORT.md`, `HUMAN_QA_T2.md` | Trial 2's report and its Human QA page (at T2-D); the design, protocol and threat model are `docs/architecture/CHAT.md` |
| `evidence/t1a/`, `evidence/t1/`, `evidence/t2a/`, `evidence/t2b/`, ... | What each checkpoint's commands produced (each `STEPS.txt` says which file is which); `evidence/remote/` holds the push receipts |
| `tools/` | The trials' own tools: `t1_menu_perf.js` (what the drift costs on the idle menu, A/B and A/A; reused for Trial 2's menu), `t1_capture.js` (a capture of the title for the Human QA evidence), `t2_server_perf.js` (what the chat costs the server: CPU, memory, snapshot pace, reconnects), `t2_client_perf.js` (what nearby speech costs a page in a run), `verify_remote_t.py` (a pushed checkpoint read back from GitHub) |
| `inventory/` | Every remote head before the first push (the remote check compares with it) |

The lasting checks live with the others: `dev/tools/checks/menu_drift.js` (the gate's full-tier `menu` step), `dev/tools/checks/chat_server.js`
(the fast-tier `chat` step) and `dev/tools/checks/chat_browser.js` (the full-tier `chat_browser` step).

## How a trial is checked

- **Its own change** has its own positive checks and their mutants, against the accepted C5d.
- **Everything else** stays under the modernization gate (`dev/tools/gate/gate.js`), which still compares every checkpoint with B++;
  the trial's changed files are declared in `dev/tools/gate/declared_changes.json`, so a change nobody declared still fails.
- **The checkpoint** is pushed normally and read back from GitHub (`dev/stage-3h-modernization/tools/verify_remote_m.py`): the commit, its
  tree and parent, and every protected ref unchanged.

## Trial 4 closure exception (2026-10-17)

The owner explicitly requested: **"just override it as complete"** after repeated Codespaces interruptions. This is a recorded scope/QA waiver, **not** a test pass or a substitute for results. Trial 4's implementation is considered complete for planning purposes, but full-browser, performance, full modernization regression, in-game Human QA, and final generated manifest publication remain unverified. Do not infer deployability or safe public release; this closure authorizes no merge, deployment, Trial 3, or changes to other branches. The local Codespaces `generated/BUILD_MANIFEST.json` differs from the remote commit after a successful build and remains unpublished to this branch.
