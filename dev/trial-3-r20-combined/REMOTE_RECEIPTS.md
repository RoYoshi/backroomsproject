# Trial 3 R20 - remote receipts

Trial 3 is **not owner-approved**.  Each branch was read back from GitHub after its last push, by `tools/verify_remote_r20.py`, at
2026-10-24T13:38:37Z:
- `git ls-remote`, and the GitHub REST commit and branch;
- every file the last commit changed, against its blob on GitHub;
- the commit line since the R19 combined receipt `2f11eae`;
- every protected head;
- every other remote branch, against the snapshot taken before the first R20 push (`inventory/remote_heads_before_r20.json`).

| branch | commit | tree | parents | files checked | result |
|---|---|---|---|---|---|
| `trial-3-r20-nani-head-watchdog` | `3dba607502c98a0c49807c7894ef79414a59d015` | `e72719727de79ee79ddda53328fe23f01912f7da` | `12892a1` | 10 | VERIFIED |
| `trial-3-r20-strategic-ambush` | `cc09cea68c096903bc4b6eac6df19dd249920c6b` | `575234b519647abd13b839832acf508430acfc04` | `982b4b7` | 16 | VERIFIED |
| `trial-3-r20-kill-visibility` | `8b7665dc8e1d206351f9d20718299a7daed20182` | `74b8470f461265ff43bf4e28b1a2f99931cbe1e0` | `53542a1` | 6 | VERIFIED |
| `trial-3-r20-combined-humanqa` | `3a0d7418a8b472e211f45b5f440a421c94e4ddae` | `d82631db39cc22a1aeea516f5ffbe001f915fe47` | `0accc41` | 59 | VERIFIED |

**Protected heads, unchanged:** `main`, `stage-3h-engine-modernization`, `stage-3h`, `stage-3e-0-bplusplus`, `post-3h-trials-1-2-4`, `trial-4-rgb-chat-accessibility`, `post-trial4-review-polish`, `post-trial4-chat-voice-polish`, `pre-trial3-final-polish`, `trial-3-skin-stealer`, `trial-3-behavior-refinement`, `trial-3-predator-refinement`, `trial-3-cognitive-predator-refinement`, `trial-3-r9-cognitive-ambush-overhaul`, `trial-3-r19-combined-humanqa`.  `main` is at `7781e1a`, R18's receipt branch at `01e5d97`, and
`trial-3-r19-combined-humanqa` at `2f11eae`.

**Every other remote branch is unchanged** (44 of them).  The only new branches are R20's four, each descending from
`2f11eae`.  Nothing was merged to `main`, nothing was deployed, and nothing was force-pushed.

The combined branch's last commit adds only this file.  It is read back the same way after its push (the final report).
