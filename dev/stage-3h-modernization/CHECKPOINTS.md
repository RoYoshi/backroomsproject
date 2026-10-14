# Stage 3H engine modernization: checkpoints

Every checkpoint is a normal (fast-forward) push to `stage-3h-engine-modernization`. Each is verified on GitHub with
`tools/verify_remote_m.py`, and the receipt is kept in `evidence/remote/`. A commit cannot name its own hash, so each row's commit
is filled in by the next checkpoint's commit; the latest one is in the delivery message.

**Live stage status: PRESERVATION HOLD** (see `PRESERVATION_HOLD.md`). Not accepted: HUMAN QA PENDING; only the owner can accept.

| # | Wave / seam | Commit | Tree | Game change | Tests | Rollback |
|---|---|---|---|---|---|---|
| — | parent: frozen Stage 3H2 | `22751bbc39c91f3e54e3305638b2ef2c9dd12c68` | `d44c4bafa3c1a78e2d910187ecbe1cc2ec18f3c9` | — | 3H2 fast gate at the parent on this machine: every step passes except `scope` (this stage's own new files) (`evidence/m0/`) | — |
| M0 | H3M-0 preflight, inventories, plans | `fe8f9b4a065b0046355c5427889aaaffd07e8dd4` | `a92f5474c71a78be8d64436bcd2322b13403bffa` | none (dev only) | inventory and gate run only; push verified (`evidence/remote/verify_m0_fe8f9b4.json`) | `git checkout 22751bb` |
| M1-P | H3M-1 layout, preserved mid-wave (owner's hold) | this commit | — | files moved; 27 built outputs byte-identical to the parent's files; four path edits | `build:check` PASS; 27 of 27 outputs and 25 of 25 static files identical to `22751bb`; HTTP probe (16 × 200, 19 × 404 for server/src/dev/generated/traversal); one WebSocket client; gameplay smoke on two real pages OK, 0 page errors. **Not run (tests not yet adapted to the layout): the goldens, the suites, the gate** | `git checkout fe8f9b4` (M0) or `22751bb` |
