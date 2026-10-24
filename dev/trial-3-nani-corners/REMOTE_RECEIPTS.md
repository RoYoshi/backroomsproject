# Trial 3 R19, N track - remote receipts

Trial 3 is **not owner-approved**.  Branch `trial-3-nani-cornering-qol`, every push read back from GitHub with `tools/verify_remote_r19.py` (its JSON kept outside the repository; this table is built from it).  The commit that adds this file is read back the same way after its push and reported in the final response, not here.

| checkpoint | commit | tree | parent(s) | verified (UTC) | ls-remote = GitHub REST = local | the commit's files, blob for blob | protected / other branches | result |
|---|---|---|---|---|---|---|---|---|
| N0 | `667e0f1bf89448eab0ff2b331a207732b09e689f` | `54196fde1dbc` | `01e5d97` | 2026-10-23T23:33:47Z | yes | 13 all equal | unchanged (41 heads) | VERIFIED |
| N1 | `94592b02ee5c51d97ee4c841f4531a264bce08b2` | `7484cd9ef51c` | `667e0f1` | 2026-10-23T23:37:24Z | yes | 16 all equal | unchanged (41 heads) | VERIFIED |
| N2-interim | `8fd805805a5034af2cfa40dabaeec44fcb4e7e50` | `89d810c7ed42` | `94592b0` | 2026-10-23T23:46:51Z | yes | 7 all equal | unchanged (41 heads) | VERIFIED |
| N2-review | `c1d6fd0c967bd86ee6242782d63cf43e124c7884` | `5df65c9d39d4` | `8fd8058` | 2026-10-24T00:29:58Z | yes | 18 all equal | unchanged (41 heads) | VERIFIED |
| N2-review2 | `451f1d6326e9fe84b3b4a767c97db4eb5c9fe080` | `8bbb3f748214` | `c1d6fd0` | 2026-10-24T01:24:07Z | yes | 23 all equal | unchanged (41 heads) | VERIFIED |
| N2-addendum | `516eab17ce592a68a55ed0dd5d100d720013be25` | `718ca4236a2d` | `451f1d6` | 2026-10-24T03:04:22Z | yes | 29 all equal | unchanged (41 heads) | VERIFIED |

Each row: `tools/verify_remote_r19.py LABEL --branch BRANCH` run after the push - the remote head by `git ls-remote` and by the GitHub
REST API (commit, tree, parents, the branch head), every file the commit changed compared blob for blob, main and every protected head
as R18's verifier pinned them, R18's own branch still at `01e5d97`, every other remote head where the pre-R19 snapshot
(`inventory/remote_heads_before_r19.json`, 41 heads, 2026-10-23T22:19:48Z) found it, and no new branch but R19's own.  Checks of the last row:

- remote tip is local HEAD: yes
- tree and parents agree: yes
- descends from the R18 receipt 01e5d97 in one straight line: yes
- every changed file has the same blob on GitHub: yes
- protected branches unchanged (R18 at its receipt): yes
- every other branch unchanged: yes
- no new branch but R19's own, each from R18: yes
