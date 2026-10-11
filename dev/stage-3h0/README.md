# dev/stage-3h0: Stage 3H0 tools and evidence (development only)

Nothing here is served to browsers or loaded by the game. The server's allowlist does not reach `dev/`.

| File | Purpose |
|---|---|
| `verify_remote_h0.py LABEL --out FILE` | Verifies a pushed checkpoint, independently of the local repository's word for it: <br>- the remote tip via `git ls-remote` and the GitHub REST commit and branch; <br>- the tree and the parent; <br>- a straight line from the accepted QA2 commit `edd2af9`; <br>- that every other remote branch is untouched. |
| `record_parent_h0.py PACK_DIR [QA2_ZIP] --out FILE` | H0-0's independent check of the accepted parent: <br>- the remote three ways, plus a fetch; <br>- the master pack's checksums; <br>- the pack's read-only snapshots against Git. |
| `evidence/h0-0/` | The remote heads before 3H0, the parent verification, and the checkpoint's remote verification. |

Later checkpoints add the golden-trace harnesses and their evidence (`evidence/h0-1/` onward).
