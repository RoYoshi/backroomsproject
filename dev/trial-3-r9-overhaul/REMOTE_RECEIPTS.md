# Trial 3 R9–R17 — remote receipts

Each checkpoint was pushed to `trial-3-r9-cognitive-ambush-overhaul` only and read back from GitHub by
`dev/trial-3-r9-overhaul/tools/verify_remote_r9.py` (git ls-remote and the REST commit/branch: tip = local HEAD, tree and parent agree, one
straight line from `f378049`, every changed file's blob equal on GitHub, the protected heads and every other remote head as before the first
push, no new branch). The receipt JSON of each is under `evidence/`. A post-push secret scan of the pushed commit is kept beside it.

| Checkpoint | Commit | Tree | Parent | Receipt | Secret scan (pushed commit) |
|---|---|---|---|---|---|
| R9 | `0c735eaaa63e0eba214fff681631296fa4680580` | `1a8c0d964f9bbbdeffaaf1342cf10f87c6ba9dbf` | `f378049a825e53eafc626a637b8c43397e4072f0` | `evidence/r9/receipt_r9.json` — VERIFIED (7/7 checks, 40 changed files' blobs equal) | `evidence/r9/secret_scan_r9_post.txt` — CLEAN |
| R10 | `d4a0edc65d3b99d96f2a3836d9cb94b0b75c8350` | `805039ae5ff785bf8fea0866277dd44b3ceb66d6` | `0c735eaaa63e0eba214fff681631296fa4680580` | `evidence/r10/receipt_r10.json` — VERIFIED (7/7 checks, 34 changed files' blobs equal) | `evidence/r10/secret_scan_r10_post.txt` — CLEAN |
