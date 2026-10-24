# Trial 3 R20 - the combined Human QA branch

Trial 3 is **not owner-approved**.  `trial-3-r20-combined-humanqa` is R19 combined (`2f11eae`) with every R20 part merged in for your QA.
Nothing is merged to `main` or deployed.

## The branches

| branch | what it is | its notes |
|---|---|---|
| `trial-3-r20-nani-head-watchdog` (N) | **the open-air STUCK**, at its two causes: W1, the turn-aware stuck timer, and W2, the watchdog's stillness; then **the opt-in head swivel** (W3) and **the corner pin** (W4).  W1 and W4 are the Skin-Stealer's alone since D2/D3 | `dev/trial-3-r20-nani-head-watchdog/` |
| `trial-3-r20-strategic-ambush` (S) | **the strategic hunter**: a shorter run, posts, the measured approach, waiting where it stands, going ahead, a fatigue belief from evidence, a player's ears, and search goals on floor it fits.  Built on N's checkpoint B | `dev/trial-3-r20-strategic-ambush/` |
| `trial-3-r20-kill-visibility` | **your addendum**: a second Skin-Stealer no longer vanishes while the first kills | `dev/trial-3-r20-kill-visibility/` |
| `trial-3-r20-combined-humanqa` | all three, for QA | this folder |

## This folder

| file | what it holds |
|---|---|
| HUMAN_QA.md | your worksheet |
| REGRESSION.md | the combined tree's suites, gate, simulations and real pages |
| PERFORMANCE.md | the 60 Hz step at 4 and 8 players, both orders, with the A/A control |
| REVIEW.md | the independent review and what was done about it |
| REMOTE_RECEIPTS.md | the pushed commits, read back from GitHub |
| `tools/r20_browser.js` | the real-page dark-walk scene |
| `tools/verify_remote_r20.py` | the remote verifier |
| `inventory/remote_heads_before_r20.json` | every remote head before the first R20 push |
