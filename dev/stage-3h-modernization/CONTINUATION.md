# Stage 3H continuation after M8: the debt ledger and the plan

**Live status: IN PROGRESS. NEEDS WORK** until every row below is DONE or the owner decides otherwise.
- **Authority:** the owner's continuation pack of 2026-10-14 (`THE_FAR_BACKROOMS_STAGE_3H_FINAL_MODERNIZATION_CONTINUATION_MASTER_PACK`,
  checked against its own SHA256SUMS).
- **What it asks:** close the architectural debt that M8 left, then a new Human QA.
- **M8 itself:** the gameplay-parity reference and the rollback point. It is not an accepted end of Stage 3H.

## The anchor (checked at C0, 2026-10-14, before any change)

| | |
|---|---|
| Work branch | `stage-3h-engine-modernization` at M8 `c34f0c22bbacc5ac2813d173bc0591b67af7169f`, tree `dfd11d402f1aed7ff049a3655667f6ae946b9afe`, on GitHub and in the worktree; nothing pushed after M8; the worktree clean |
| Accepted B++ (the oracle) | `143b63ff42b88c6780c5043e0f61d64100f81f40` (`stage-3e-0-bplusplus`), untouched |
| Frozen 3H2 | `22751bbc39c91f3e54e3305638b2ef2c9dd12c68` (`stage-3h`), untouched |
| Production `main` | `7781e1ac34aa09970df57fae3fc107a873fa2731`, untouched |
| M8's full gate (the baseline) | `evidence/m8/gate_full/`: 20 of 20 steps against B++ |

## The ledger: every debt and its target

States: **DONE** · **IN PROGRESS** · **PLANNED** · **BLOCKED** (with what unblocks it). Each row closes only with its evidence.

| Debt | Today (M8) | Target | Wave | State |
|---|---|---|---|---|
| M-017 the v11 toolchain | Never rebuilt here | `npm ci && npm run build` of the recovered v11 project, offline from verified packages, reproduces its `dist/` byte for byte | C1 | **BLOCKED.** The npm registry is denied by this environment's network policy (HTTP 403 through the egress proxy; no direct DNS). No local cache holds the 31 locked packages Linux needs (only TypeScript 6.0.2, which is not the locked 7.0.2). **Unblocks it:** the owner runs `tools/c1_fetch_locked_packages.js` on a machine with internet and hands over the folder; each tarball is checked again against the lockfile's sha512 before use |
| M-001, M-012, M-019, ADR-002: the 40 post-v11 edits | Replayed into minified output (`lineage/`) | Ported to readable, owned TypeScript in a maintained client tree; the bundle built from it; no replay of minified patches | C4 | **BLOCKED by C1.** `inventory/c0_bundle_steps.csv` maps each step to its concern, owner, the v11 modules it changed and its port target. B13, B17 and B18 have no net effect. Heaviest: B02 (Level 0, stamina: 6.5 KB), B14, B10, B11, B07, B28 to B30 |
| M-020 `window.__api` (52 members) | Traced, 16 readers | The same 52 members, or proven adapters, during and after the port | C4, with a contract suite in C5 | PLANNED |
| M-003 Level 0 defined twice | `sim.level0.js` (server) and the bundle (B02) | One canonical level definition read by the server and by the page | C4 | **BLOCKED by C1.** The page's copy lives in the bundle, which cannot be rebuilt here |
| M-023 the session in `server.js` | Upgrade, dispatch, passcode check, lockout, leave: about 75 lines | `server.js` as a thin root; the session under B++, the admin login and lockout under W.A.R.D., each with an explicit contract and the same semantics | C2 | **DONE at C2:** B++'s `session.js` and W.A.R.D.'s `admin_login.js`, every line verbatim; `server.js` 65 lines; B++'s traces on the session scenarios; 15 of 15 session mutants caught |
| M-024 shared closures | 58 part files, 9 outputs; 312 uses and 49 writes across owners (`inventory/c0_parts_coupling.csv`) | Real modules: explicit imports or injected factories, each state with one owner, no writes into another owner's bindings, no global back-channel | C3 | PLANNED. `sim.js` (134 uses, 18 writes across owners) and `mp.js` (147 and 31) are the core of it. `ai.js` has one owner and no cross-owner use; it stays one cohesive module unless a boundary helps |
| M-005 legacy `window` contracts (63 names) | Documented (`CONTRACTS.md`) | Explicit adapters as consumers migrate; same public behaviour | C3 (the classic scripts' side), C4 (the bundle's side) | PLANNED |
| M-021 perf noise | A/A rule, paired runs | A/A controls and paired A/B kept; real hardware in Human QA | C5 | PLANNED |
| M-013 carpet placeholder | Shipped placeholder | **Not debt:** kept, hash unchanged | - | kept |
| M-002, M-014 PixiJS chunks | Named, one not observed loaded | Recorded as a vendor detail; no gameplay "fix" | C4 | PLANNED |
| Eight README-only frameworks | Reserved homes | **Not debt:** left reserved, labelled so | - | kept |
| Security observations | Kept outside this public repository | Not changed by any refactor; any change is a separate security change that the owner approves, before any promotion | - | tracked privately |

## What the session's move must keep (C2)

These are the exact behaviours the move must keep. They are read from the code, not invented:
- the upgrade path and its refusals;
- the room-name cleaning and the room cap;
- the handshake and the identity source;
- the per-connection admin flag;
- the passcode check (constant-time, over a hash);
- the lockout per identity (5 wrong guesses, then 60 s);
- the answers and log lines of each outcome;
- admin commands only from an unlocked connection;
- the ping rate limit;
- the order of everything on leaving.

No value and no security observation is written in this public file.

## The waves

Each wave is small and reversible:
1. the change;
2. focused tests;
3. the fast or full gate;
4. the architecture proof;
5. a commit, pushed normally and verified on GitHub;
6. a row in `CHECKPOINTS.md`.

| Wave | What | Proof |
|---|---|---|
| C0 | This ledger, the inventories (`tools/c0_audit.js`), the owner-side package fetcher (`tools/c1_fetch_locked_packages.js`) | no runtime change; fast gate |
| C1 | The v11 toolchain, offline, from verified packages | the v11 `dist/` rebuilt byte for byte. BLOCKED until the packages arrive |
| C2 | The session out of `server.js` | server traces equal B++'s; ordering traces; scripted negatives for the login and the lockout; live wire |
| C3 | Real modules for `sim.js`, then `mp.js`, `ents.js`, `world.js`, `move.js`, `camcorder.js`, `glitch.js` | the goldens (server and page traces), the mutants, the browsers, the contact lab, perf. A module-boundary audit replaces the parts check. Outputs change bytes, so the byte comparison with 3H2 is kept only for files that are not rebuilt |
| C4 | The client tree, the 40 ports, the 52-member `__api`, one Level 0 | a staging bundle against B++: traces, pixels, two browsers. BLOCKED until C1 |
| C5 | The full gate against B++ and M8, the package, the Human QA page; then stop | the debt matrix row by row: DONE, PARTIAL or BLOCKED |
