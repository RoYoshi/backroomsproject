# Stage 3H engine modernization: checkpoints

Every checkpoint is a normal (fast-forward) push to `stage-3h-engine-modernization`. Each is verified on GitHub with
`tools/verify_remote_m.py`, and the receipt is kept in `evidence/remote/`. A commit cannot name its own hash, so each row's commit
is filled in by the next checkpoint's commit; the latest one is in the delivery message.

**Live stage status: RESUMED (2026-10-14), in progress.** The source recovery's intake and the revised plan are in
`SOURCE_RECOVERY_INTAKE.md`, `PLAN.md` §6 and ADR-002. Not accepted: HUMAN QA PENDING; only the owner can accept.

| # | Wave / seam | Commit | Tree | Game change | Tests | Rollback |
|---|---|---|---|---|---|---|
| — | parent: frozen Stage 3H2 | `22751bbc39c91f3e54e3305638b2ef2c9dd12c68` | `d44c4bafa3c1a78e2d910187ecbe1cc2ec18f3c9` | — | 3H2 fast gate at the parent on this machine: every step passes except `scope` (this stage's own new files) (`evidence/m0/`) | — |
| M0 | H3M-0 preflight, inventories, plans | `fe8f9b4a065b0046355c5427889aaaffd07e8dd4` | `a92f5474c71a78be8d64436bcd2322b13403bffa` | none (dev only) | inventory and gate run only; push verified (`evidence/remote/verify_m0_fe8f9b4.json`) | `git checkout 22751bb` |
| M1-P | H3M-1 layout, preserved mid-wave (owner's hold) | `a895c072b9079f9100547b3d62901103b458f4d3` | `36c03822154554728b7976dae71bdb3935531f26` | files moved; 27 built outputs byte-identical to the parent's files; four path edits | `build:check` PASS; 27 of 27 outputs and 25 of 25 static files identical to `22751bb`; HTTP probe (16 × 200, 19 × 404 for server/src/dev/generated/traversal); one WebSocket client; gameplay smoke on two real pages OK, 0 page errors. **Not run (tests not yet adapted to the layout): the goldens, the suites, the gate**; push verified (`evidence/remote/verify_m1p_a895c07.json`) | `git checkout fe8f9b4` (M0) or `22751bb` |
| M1-R | Resumption: the recovered original source authenticated; the lineage of every post-original client change (bundle 40 steps, stylesheet 8, page 35); the `__api` contract; the revised plan (PLAN.md §6, ADR-001, ADR-002) | this commit | — | none (no runtime file changed; `src/core/client/bundle/` is a record the game does not load) | `recovery_verify.py` VERIFIED (archive, 532 payload hashes, history fsck, 11 snapshots = 434 Git blobs, v11 output = receipt); `lineage.js verify` PASS (all three chains replay byte for byte to the files in `public/`); `build.js --check` PASS; `m1_relocate.js --verify` 27/27 + 25/25 identical to `22751bb`; scope: 107 paths, all under `dev/stage-3h-modernization/`, `dev/tools/lineage/`, `docs/`, `src/core/client/bundle/`; secret scan clean (`evidence/m1-resume/`). Fresh npm rebuild of v11: NOT RUN (no registry access) | `git checkout a895c07` (M1-P) |
