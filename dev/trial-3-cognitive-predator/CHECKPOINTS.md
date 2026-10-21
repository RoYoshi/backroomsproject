# Trial 3 cognitive predator refinement — checkpoints

Branch `trial-3-cognitive-predator-refinement`, created from R8 `f378049a825e53eafc626a637b8c43397e4072f0` (tree
`a6d72690727a58dbab6e770dfda64a1d9dbf70f3`) — the predator refinement the owner rejected in Human QA. Nothing here is owner-approved.
Pushed only fast-forward, never forced. After each push `tools/verify_remote_cp.py` reads the branch back from GitHub (SHA, tree,
parent, one straight line from `f378049`, every protected ref — R8 now among them — and every other branch unchanged) into
`evidence/remote/`; the secret scan runs before and after each push (`evidence/scans/`). A commit cannot name its own hash: each row is
filled in by the next checkpoint.

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| C0 diagnosis, no game change | (this commit: `evidence/remote/c0.json` arrives with C1) | | `f378049` | |

## C0 — diagnosis first (no game change)

Changed: only `dev/trial-3-cognitive-predator/` — `AUDIT.md`, `OWNER_FAILURE_REPRO.md`, this file, `tools/c0_audit.js` (R8's
simulation through the owner's situations, latency and choice measured), `tools/cog_browser.js` (the same in real pages),
`tools/verify_remote_cp.py`, `inventory/remote_heads_before.json`, `evidence/`. The runtime is R8's.

| Run | Result |
|---|---|
| `tools/c0_audit.js` on R8 (`evidence/c0_audit_r8.*`; 12 scenes, 6 seeds) | watched at .45–.55: 0 kills, no purposeful movement in 12 of 18 runs (retreat → 9–10 s blind lure → leave); a cliff to 6 / 6 kills at .8; two people → leave in 0.02–0.42 s; a lost race → 12.7–12.9 s trailing; a close circler faced after 2.2 s (p50). First decisions themselves are fast (0 s), see `AUDIT.md` |
| `tools/cog_browser.js` on R8 (`evidence/c0_browser_r8.*`, `c0_shots/`; three scenes × 2 real-page tries, admin spawn hunger .50–.65) | the watching page never struck in the 4 valid tries (one try took the unaware walker); circle #2 left 83 % of the time; 2 tries were setup misses (the creature never saw the page), kept and labelled |
| R8's decision scores at the quoted moments | `OWNER_FAILURE_REPRO.md` (BD1 retreat 1.29 / leave 1.04 / approach .08; BD2 leave 1.09 at 210 px after a flank) |

**Seven reproducible bad decisions** (`OWNER_FAILURE_REPRO.md`, with seeds) and four honest controls. The architecture for C1–C4 is in
`AUDIT.md` (perception events, interrupts, a small tactical choice for a seen quarry, commitment unchanged; species file only).
