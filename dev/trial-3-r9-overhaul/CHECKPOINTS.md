# Trial 3 R9–R17 — checkpoints

Branch `trial-3-r9-cognitive-ambush-overhaul`, from R8 `f378049a825e53eafc626a637b8c43397e4072f0` (owner-disapproved). Every checkpoint is
one logical change group, committed, pushed to this branch only, and read back from GitHub (`tools/verify_remote_r9.py`: the tip, its tree
and parent, every changed file's blob, the protected heads and every other remote head untouched). Each receipt is saved under
`evidence/` and committed with the next checkpoint (the last one in its own receipt commit). Trial 3 is **not owner-approved**.

| Checkpoint | Work | Commit | Receipt |
|---|---|---|---|
| R9 | audit of R8, the owner's exposed ambush reproduced (deterministic, real page), baseline tests / perf / audio / body; `R9_AUDIT.md`; no game change | (this commit) | `evidence/r9/receipt_r9.json` (with R10) |
