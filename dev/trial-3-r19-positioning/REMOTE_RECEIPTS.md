# Trial 3 R19, S track - remote receipts

Trial 3 is **not owner-approved**.  Branch `trial-3-r19-prechase-positioning`, every push read back from GitHub with `tools/verify_remote_r19.py` (its JSON kept outside the repository; this table is built from it).  The commit that adds this file is read back the same way after its push and reported in the final response, not here.

| checkpoint | commit | tree | parent(s) | verified (UTC) | ls-remote = GitHub REST = local | the commit's files, blob for blob | protected / other branches | result |
|---|---|---|---|---|---|---|---|---|
| S0 | `71cebb45f532fee97915b6e4c3ed648286f5be49` | `b8672348985e` | `01e5d97` | 2026-10-23T23:31:25Z | yes | 8 all equal | unchanged (41 heads) | VERIFIED |
| S1 | `57271c0217198eaae5ab4b36e8f85406be0fe742` | `3acae6ecc877` | `71cebb4` | 2026-10-23T23:32:33Z | yes | 7 all equal | unchanged (41 heads) | VERIFIED |
| S3-interim | `87165a78d8fe9c11237c22f80f885c03eec9d4f7` | `1758393e2ea9` | `57271c0` | 2026-10-23T23:46:26Z | yes | 8 all equal | unchanged (41 heads) | VERIFIED |
| S3-review | `3c64a41b48636d76192e1db115534093a959b0b0` | `b873c9f0742d` | `87165a7` | 2026-10-24T00:29:29Z | yes | 14 all equal | unchanged (41 heads) | VERIFIED |
| S3-review2 | `f0c95ff3ac66f2b88c802d3e8d990fc88d1fd7d2` | `6907fb158f3a` | `3c64a41` | 2026-10-24T01:37:20Z | yes | 26 all equal | unchanged (41 heads) | VERIFIED |
| S3-review2b | `83a05c195f981844d913c213e72cb9dd50c4457f` | `09205c7c4f94` | `f0c95ff` | 2026-10-24T02:04:55Z | yes | 10 all equal | unchanged (41 heads) | VERIFIED |
| S3-addendum | `c6a6bb9863235f9d2aba4f8a6e298e05dab63e6b` | `0c276f526fe0` | `83a05c1` | 2026-10-24T03:04:49Z | yes | 24 all equal | unchanged (41 heads) | VERIFIED |

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
