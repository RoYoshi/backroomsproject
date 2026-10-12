# D7: the package

- `CHECKPOINTS.md`: every checkpoint's commit and tree, with its GitHub verification (`remote_d1.json` … `remote_d6.json`; D0's is in `../d1/`).
- The human-QA ZIP is made by `dev/stage-3d/package_3d.py` from the pushed D7 commit and verified from the extracted ZIP. Its SHA-256 file and `STAGE_3D_PACKAGE_RECEIPT.txt` are delivered with it, not stored here: they name this commit.

**One correction at D7.** `summarize_d6.py`'s first line read a field that `golden3d.js` does not write (`followOns`). So it printed "follow-ons: none", where `golden3d_d6.json` reports the one documented follow-on (`deaths`: identical up to the first killer hand-back at 5,900 ms, then diverging from 6,150 ms). The line now reads each scenario and fails on a follow-on anywhere but `deaths`. `summary.json` was regenerated from the same D6 results; nothing was re-run.
