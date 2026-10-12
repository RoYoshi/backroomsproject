# Stage 3D HQ1 checkpoints

Every commit on `stage-3d-hq1` after the D7 parent, oldest first, as GitHub reported it after each push (`dev/stage-3d-hq1/verify_remote_hq1.py`). A straight line: each commit's parent is the one above it; the first one's is D7.

| Checkpoint | Commit | Tree | Parent | Remote check (after its push) |
|---|---|---|---|---|
| D7 (parent) | `ffe2b53c2e5c6aa76a8db8bd222fd1910c1b0e57` | `b226afe5cd0461d49947565d7f046d69f560cb9e` | `8d6e66a…` | the HQ1-0 audit (`STAGE_3D_HQ1_AUDIT.md` §1) |
| HQ1-0 | `dcf9f8425b002d925be49660fc5a803e1b22a2b2` | `a79f7e273130154baf82ae0ec68a7a1faa1c31ea` | `ffe2b53` | `evidence/hq1-1/remote_hq1-0.json`: verified at 2026-10-12T05:41:32Z; other branches untouched: yes |
| HQ1-1 | `241d7da37350f3b831caaf5e1056b4a2da995027` | `2d8bfba2b4a68d4f5ca480370989ec8dfb40762d` | `dcf9f84` | `evidence/hq1-2/remote_hq1-1.json`: verified at 2026-10-12T07:54:55Z; other branches untouched: yes |
| HQ1-2 | `1c8e7883cdff95b429b1ee22371f3280b0019dda` | `a60d98af5d1d86af7c7e4bb09ce6e91d46f8eeaa` | `241d7da` | `evidence/hq1-3/remote_hq1-2.json`: verified at 2026-10-12T12:44:00Z; other branches untouched: yes |
| HQ1-3a | `a1d9cb98f7677cd5439bf731432c5b226e7d4d35` | `07c83d1ab93f00973f5e5cf4f45768cb91891b9d` | `1c8e788` | `evidence/hq1-3/remote_hq1-3a.json`: verified at 2026-10-12T12:52:34Z; other branches untouched: yes |
| HQ1-3 | `bf4894c3e9b6ff39ea8cc00013d7430b5ebdc1fa` | `033c34c48a5cda812c8c38603914549a07c3421e` | `a1d9cb9` | `evidence/hq1-4/remote_hq1-3.json`: verified at 2026-10-12T18:39:32Z; other branches untouched: yes |
| HQ1-4 | in `STAGE_3D_HQ1_PACKAGE_RECEIPT.txt` | | `bf4894c` | the receipt, verified from the ZIP after its push (a commit cannot hold its own hash) |

Subjects:
- HQ1-0: Stage 3D HQ1-0: audit, RED evidence and gates for wall blood and dying lights
- HQ1-1: Stage 3D HQ1-1: blood on the wallpaper where a body struck a wall
- HQ1-2: Stage 3D HQ1-2: dying lights hold 3-7 s, flicker and dim 1-2 s, then go out for good
- HQ1-3a: Stage 3D HQ1-3a: keep BR-RoLE's seam verbatim; the victim's dying light read inside the hook
- HQ1-3: Stage 3D HQ1-3: full regression and performance on a1d9cb9
- HQ1-4: the report, the documents, the visual evidence, the package
