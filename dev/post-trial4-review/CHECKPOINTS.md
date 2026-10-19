# Post-Trial 4 review — checkpoints

Branch `post-trial4-review-polish`, created from Trial 4's closed head `518b99021b601963cfe0ee79e9bfd2cccd2f3748` (tree
`72e60eb7b68a8dc3d2f735599d8ab828fc21691e`). Every checkpoint is a normal fast-forward push of this branch only, read back from GitHub by
`tools/verify_remote_r.py` (the commit, its tree and parent; `main`, Stage 3H, B++, the Trials 1–2 branch and the closed Trial 4 branch
unchanged; no other branch moved or new). Receipts are in `evidence/remote/`. A commit cannot name its own hash, so each row's hash is
filled in by the next checkpoint.

**Live status: review in progress.** Nothing merged or deployed. Trial 3 not started.

| # | What | Commit | Tree | Game change | Tests | Rollback |
|---|---|---|---|---|---|---|
| R1 | RGB sliders follow their colour (rgb.js); their Customize and Settings layout (ui.css); the chat hook's per-frame cost (chat.js); the stale build manifest, docs blocks and change declarations; `menu_drift.js` told Trial 4's page edits; new `dev/tools/checks/rgb_browser.js` and the gate's full-tier `rgb` step; this folder | `0542327e04f6a83b403073667a3a373920083c0c` | `7dd48e6b1053db489f307dd9cf8a12e552120299` | the RGB sliders show and edit the real colour; the Customize sliders are drawn compactly; the Enter hint has no `aria-label` | `evidence/r1/STEPS.txt`: build:check, docs, scope PASS; rgb_browser 14 of 14, mutants 6 of 6; on 518b990 the fast gate fails build, docs and scope and the menu step fails on index.html. Push verified (`evidence/remote/verify_r1_0542327.json`); the pushed commit scanned clean (`evidence/r1/secret_scan/`) | `git checkout 518b990` (Trial 4's closed head) |
| R2 | `docs/architecture/CHAT.md` describes Trial 4's `c` (the speaker's colour) in `say` and `heard`, old pages, the Enter hint and the bubble accent; R1's receipts | this commit | — | none (documents) | docs check PASS; the final verification on a fresh clone of this commit: next checkpoint | `git checkout 0542327` (R1) |
