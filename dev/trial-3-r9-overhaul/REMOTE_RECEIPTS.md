# Trial 3 R9–R17 — remote receipts

Each checkpoint was pushed to `trial-3-r9-cognitive-ambush-overhaul` only and read back from GitHub by
`dev/trial-3-r9-overhaul/tools/verify_remote_r9.py` (git ls-remote and the REST commit/branch: tip = local HEAD, tree and parent agree, one
straight line from `f378049`, every changed file's blob equal on GitHub, the protected heads and every other remote head as before the first
push, no new branch). The receipt JSON of each is under `evidence/`. A post-push secret scan of the pushed commit is kept beside it.

| Checkpoint | Commit | Tree | Parent | Receipt | Secret scan (pushed commit) |
|---|---|---|---|---|---|
| R9 | `0c735eaaa63e0eba214fff681631296fa4680580` | `1a8c0d964f9bbbdeffaaf1342cf10f87c6ba9dbf` | `f378049a825e53eafc626a637b8c43397e4072f0` | `evidence/r9/receipt_r9.json` — VERIFIED (7/7 checks, 40 changed files' blobs equal) | `evidence/r9/secret_scan_r9_post.txt` — CLEAN |
| R10 | `d4a0edc65d3b99d96f2a3836d9cb94b0b75c8350` | `805039ae5ff785bf8fea0866277dd44b3ceb66d6` | `0c735eaaa63e0eba214fff681631296fa4680580` | `evidence/r10/receipt_r10.json` — VERIFIED (7/7 checks, 34 changed files' blobs equal) | `evidence/r10/secret_scan_r10_post.txt` — CLEAN |
| R11 | `a002a2d02378d006ee47cdf4c7629e58e53e954d` | `bcf215c87616a99ff6069bd943cf0310601ab425` | `d4a0edc65d3b99d96f2a3836d9cb94b0b75c8350` | `evidence/r11/receipt_r11.json` — VERIFIED (7/7 checks, 36 changed files' blobs equal) | `evidence/r11/secret_scan_r11_post.txt` — CLEAN |
| R12 | `61f4128c0db969b2fd9367a922d00c79bc3ecc31` | `f0890e03a22b2023e12eeb4aaa5eec9b9d31e417` | `a002a2d02378d006ee47cdf4c7629e58e53e954d` | `evidence/r12/receipt_r12.json` — VERIFIED (7/7 checks, 38 changed files' blobs equal) | `evidence/r12/secret_scan_r12_post.txt` — CLEAN |
| R13 | `14203ac075f4e04ab649d415915dc37c1ec3bc52` | `6da6cd33e469916e6f78b223d923c65502141df6` | `61f4128c0db969b2fd9367a922d00c79bc3ecc31` | `evidence/r13/receipt_r13.json` — VERIFIED (7/7 checks, 49 changed files' blobs equal) | `evidence/r13/secret_scan_r13_post.txt` — CLEAN |
