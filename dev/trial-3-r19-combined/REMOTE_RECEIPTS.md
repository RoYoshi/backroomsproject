# Trial 3 R19, the combined QA branch - remote receipts

Trial 3 is **not owner-approved**.  Branch `trial-3-r19-combined-humanqa`, every push read back from GitHub with `dev/trial-3-r19-positioning/tools/verify_remote_r19.py` (its check for this branch: every commit since 01e5d97 descends from it, and its merges join only S and N commits) (its JSON kept outside the repository; this table is built from it).  The commit that adds this file is read back the same way after its push and reported in the final response, not here.

| checkpoint | commit | tree | parent(s) | verified (UTC) | ls-remote = GitHub REST = local | the commit's files, blob for blob | protected / other branches | result |
|---|---|---|---|---|---|---|---|---|
| C1 | `c6d21d34e67e9d9c35767affa3329ead9a321c68` | `afcf065d46a9` | `9c7e3de` | 2026-10-24T01:46:07Z | yes | 5 all equal | unchanged (41 heads) | VERIFIED |
| C2 | `fe723fc841c46db8d9ec2de0ca863a7c4aa988af` | `f708d2ef50aa` | `a456230` | 2026-10-24T02:13:40Z | yes | 3 all equal | unchanged (41 heads) | VERIFIED |

Each row: `tools/verify_remote_r19.py LABEL --branch BRANCH` run after the push - the remote head by `git ls-remote` and by the GitHub
REST API (commit, tree, parents, the branch head), every file the commit changed compared blob for blob, main and every protected head
as R18's verifier pinned them, R18's own branch still at `01e5d97`, every other remote head where the pre-R19 snapshot
(`inventory/remote_heads_before_r19.json`, 41 heads, 2026-10-23T22:19:48Z) found it, and no new branch but R19's own.  Checks of the last row:

- remote tip is local HEAD: yes
- tree and parents agree: yes
- descends from the R18 receipt 01e5d97 (merges only of R19 commits): yes
- every changed file has the same blob on GitHub: yes
- protected branches unchanged (R18 at its receipt): yes
- every other branch unchanged: yes
- no new branch but R19's own, each from R18: yes
