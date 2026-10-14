# Stage 3D HQ2 — source parent and checkpoints

## The accepted parent

| | |
|---|---|
| Repository | `RoYoshi/backroomsproject` |
| Parent branch | `stage-3d-hq1` (HQ1, accepted by the user's human QA) |
| Parent commit | `ebb3bd603e8a2bb4ef00cc40aa6b415bccab9763` |
| Parent tree | `d0aaf5c47fcdeec1a449392093cf45cb4f6b8d16` |
| HQ2 branch | `stage-3d-hq2`, created from the parent, pushed normally only |

The parent was checked live before any HQ2 work (`dev/stage-3d-hq2/preflight_hq2.py` → `dev/stage-3d-hq2/evidence/h2-0/preflight.json`):
- `git ls-remote` and the GitHub REST branch and commit;
- the local tree;
- the HQ1 package receipt's own `commit` and `tree` lines;
- the ancestry: D7 `ffe2b53` and Stage 3H0 `06949a8` are ancestors; D7 is not the parent.

`stage-3d-hq2` did not exist on GitHub before H2-0.

## Protected branches

The 23 remote branches as they were before HQ2 are in `dev/stage-3d-hq2/evidence/h2-0/remote_heads_before_hq2.json`. They include `main` `7781e1a`, `stage-3d` `ffe2b53`, `stage-3d-hq1` `ebb3bd6`, `stage-3h0` `06949a8` and every Stage 3B/3C and older branch.

After every HQ2 push, `dev/stage-3d-hq2/verify_remote_hq2.py` checks:
- that every one of those branches is still exactly there;
- that the HQ2 commits since the parent form one straight line (no merges) starting at `ebb3bd6`;
- that GitHub reports the pushed commit, tree and parent.

Nothing in HQ2 force-pushes, rebases, merges or writes to any other branch.

Local work found before H2-0, and kept: `stash@{0}`, "SH8 WIP" on `lighting-shadows-2d`, older than Stage 3D. It is untouched.

## Checkpoints

A commit cannot name its own hash. Each checkpoint is therefore listed, with its remote verification, by the next one. The last one is recorded in the final package receipt.

| Checkpoint | What it holds | Commit / tree / remote check |
|---|---|---|
| H2-0 | audit, RED baselines, frozen gates and allowlist; no production change | `94900014889df9c955c962370f1106acde0f4aa4` / tree `727a7ada2ab4cca19210b726f28725356946e2d0`, parent `ebb3bd6`; pushed normally; `git ls-remote`, REST commit and branch agree; all 23 other branches unchanged, no new branch (`dev/stage-3d-hq2/evidence/h2-1/remote_h2-0.json`) |
| H2-1 | NEW RUN as the server's decision (intent → one answer), the 30 s cooldown without a phantom, the old vanish channels removed; no explosion yet | `d27a2af9d220ae42f5a0ca0b8aa88422a7337f5e` / tree `cd44ce9e54041aa5ebf84a8b85a9289132803135`, parent `9490001`; pushed normally; `git ls-remote`, REST commit and branch agree; all 23 other branches unchanged, no new branch (`dev/stage-3d-hq2/evidence/h2-2/remote_h2-1.json`) |
| H2-2 | the explosion: one server-made, seeded, physical blast with its corpse, wall stains and HQ1 dying light; the eight deaths unchanged | `14cf47ac242eb09ee7f307a54257706911b8842b` / tree `5a34ed8d177193766df5aceb2198acd736e1a189`, parent `d27a2af`; pushed normally; `git ls-remote`, REST commit and branch agree; all 23 other branches unchanged, no new branch (`dev/stage-3d-hq2/evidence/h2-3/remote_h2-2.json`) |
| H2-3 | living players solid to each other on the server: the swept peer check after the walls, free-spot placement, soft corrections; no client prediction yet | `c61469de8d429eeae533c873cdad597575881fdc` / tree `4cef611dbece5f2b6ab4482c76812516fa1b50e9`, parent `14cf47a`; pushed normally; `git ls-remote`, REST commit and branch agree; all 23 other branches unchanged, no new branch (`dev/stage-3d-hq2/evidence/h2-4/remote_h2-3.json`) |
| H2-4 | the browser predicts the other players (move.js), blends the soft corrections (mp.js); the world epoch: an admin world reset ends every old-world death, blast, corpse, stain and dying light on every screen | `99e15931793b6f8b7f434321d050fc6a2ff7155d` / tree `e80b3eb2c4e9173c731acd75ee1de0f955e5de56`, parent `c61469d`; pushed normally; `git ls-remote`, REST commit and branch agree; all 23 other branches unchanged, no new branch (`dev/stage-3d-hq2/evidence/h2-5/remote_h2-4.json`) |
| H2-5 | the full regression against HQ1, the performance gates, the films; two repairs it found (a death replay's wall field, the soft-correction blend) | `65a130984243e6d5badd188c599d576b79b464c8` / tree `2bcb8ce1e2a4d9db228896e6e17a12eb46964bc0`, parent `99e1593`; pushed normally; `git ls-remote`, REST commit and branch agree; all 23 other branches unchanged, no new branch (`dev/stage-3d-hq2/evidence/h2-6/remote_h2-5.json`) |
| H2-6 | the final package: the report, the changed-file list, the human-QA steps, the last two lifecycle cases of the gate matrix measured (E03 on a blast through focus loss, a dropped connection and a reload; R03 with the Death Lab paused and slowed), E06 at every render rate, the summary of every test; no production change | in `STAGE_3D_HQ2_PACKAGE_RECEIPT.txt`, delivered next to the ZIP and verified from it (a commit cannot hold its own hash) |
