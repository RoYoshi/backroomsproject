# Trial 3 behaviour refinement — checkpoints

Branch `trial-3-behavior-refinement`, created from the unapproved Trial 3 head `020b5b533a3ab1e8edaaa7dd6a02bf29070421fc` (tree
`26234cdcd68b59727c68bbd21662b980d8d28bbe`). Pushed only fast-forward, never forced. After each push `tools/verify_remote_br.py` reads
the branch back from GitHub (SHA, tree, parent, one straight line from `020b5b5`, every protected ref and every other branch unchanged)
into `evidence/remote/`; the secret scan runs before and after each push (`evidence/scans/`). A commit cannot name its own hash: each
row is filled in by the next checkpoint (the last by a receipt commit).

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| B0 audit, plan, reproduction, baseline | (this commit: `evidence/remote/b0.json` arrives with B1) | | `020b5b5` | |

## B0 — audit and plan, no game change

Changed: only `dev/trial-3-behavior-refinement/` (this file, `AUDIT.md`, `PLAN.md`, `BALANCE_TABLE.md`, `tools/repro_b0.js`,
`tools/verify_remote_br.py`, `inventory/remote_heads_before.json`, `evidence/`). The runtime is Trial 3's, byte for byte.

| Run (on `020b5b5`) | Result |
|---|---|
| `tools/repro_b0.js` (6 seeds) | the owner's report reproduced: seen close while leaving 40–307 times (10 Hz samples) per run, it never stopped to face them; one departure goal; seen close while roaming with them on the cooldown list 3–140 times; at hunger 0, a person in arm's reach about 13 s: no response. Blind controls: behind wall A, never seen or heard, identical to the run without them in 6 / 6 seeds (`evidence/b0_repro_trial3.txt`, `.json`; `AUDIT.md` §3–4) |
| `npm test` | 183 / 196 in 6 min 4 s. The 13 failures, by name, are the inherited P9 ones (`evidence/b0_inherited_failures.txt`): P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18, L9, 2F F13, 2F F22. Every Skin-Stealer scenario SK01–SK44 passes (34 / 34) (`evidence/b0_npm_test.txt`) |
| `npm run test:humanqa` | 5 / 6; X03 fails as on P9 (`evidence/b0_humanqa.txt`) |

Every later checkpoint compares its `npm test` failures with these 13 names exactly.
