# Stage 3H continuation after M8: the debt ledger and the plan

**Live status (C1): IN PROGRESS.** C5b was the Human QA candidate with C1 and C4 BLOCKED on the npm registry. On 2026-10-15 the owner
supplied the 31 locked packages (`TFB_V11_LINUX_X64_PACKAGES.zip`) and asked to finish C1 and C4 from C5b `1d2a213`. **C1 is DONE:**
every package verified against the snapshot's lockfile, and the v11 build reproduced offline byte for byte (M-017). C4 (the maintained
client tree, the 40 ports, one Level 0) is next. Every row below has its state and its evidence; `REPORT.md` and `HUMAN_QA.md` are still
C5b's until the new candidate replaces them.
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

States: **DONE** · **PARTIAL** (what is done, and what waits) · **IN PROGRESS** · **PLANNED** · **BLOCKED** (with what unblocks it) · **recorded** (documented, no change due) · **kept** (not debt) · **tracked privately** (security). Each row closes only with its evidence.

| Debt | Today (M8) | Target | Wave | State |
|---|---|---|---|---|
| M-017 the v11 toolchain | Never rebuilt here | `npm ci && npm run build` of the recovered v11 project, offline from verified packages, reproduces its `dist/` byte for byte | C1 | **DONE at C1.** The owner's 31 tarballs: each one's SHA-512 equals the snapshot lockfile's integrity, read by the package.json inside it; none missing, none extra (`tools/c1_verify_packages.js`; its refusals: `tools/c1_packages_mutants.js`, 9 of 9). `tools/c1_rebuild_v11.js` installs them offline (`npm ci --offline --ignore-scripts`, a private cache, an empty npmrc) and runs the project's own `npm run build` in a copy: 17 of 17 `dist/` files byte-identical (Node 22.22.2, npm 10.9.7, TypeScript 7.0.2, Vite 8.3.1). Evidence: `evidence/c1/`. The packages are not committed; the tools take their folder |
| M-001, M-012, M-019, ADR-002: the 40 post-v11 edits | Replayed into minified output (`lineage/`) | Ported to readable, owned TypeScript in a maintained client tree; the bundle built from it; no replay of minified patches | C4 | **PLANNED (C4, unblocked by C1).** `inventory/c0_bundle_steps.csv` maps each step to its concern, owner, the v11 modules it changed and its port target. B13, B17 and B18 have no net effect. Heaviest: B02 (Level 0, stamina: 6.5 KB), B14, B10, B11, B07, B28 to B30 |
| M-020 `window.__api` (52 members) | Traced, 16 readers | The same 52 members, or proven adapters, during and after the port | C4, with a contract suite in C5 | **DONE for this candidate (C5); the port's adapters wait with C4.** The bundle that makes `window.__api` is B++'s, byte for byte, so its 52 members are. The contract (`src/core/client/bundle/api_contract.json`: each member, what it is, who reads it) is counted from the code again since C5 (the tool follows a module script's imports, so C3's modules are read like M8's parts) and the gate's `lineage` step fails if it is not current; against M8 it differs only where C3c moved two reads of `H` behind a parameter (`evidence/c5/api/`). In a real Chromium the facade's 52 members, their types, arity and keys are the same on B++ and on this tree, at the menu and in a run (`dev/tools/gate/checks/browser_contracts.js`, the gate's `workflow` step) |
| M-003 Level 0 defined twice | `sim.level0.js` (server) and the bundle (B02) | One canonical level definition read by the server and by the page | C4 | **PLANNED (C4, unblocked by C1).** The page's copy lives in the bundle, which C4 rebuilds from source |
| M-023 the session in `server.js` | Upgrade, dispatch, passcode check, lockout, leave: about 75 lines | `server.js` as a thin root; the session under B++, the admin login and lockout under W.A.R.D., each with an explicit contract and the same semantics | C2 | **DONE at C2:** B++'s `session.js` and W.A.R.D.'s `admin_login.js`, every line verbatim; `server.js` 65 lines; B++'s traces on the session scenarios; 15 of 15 session mutants caught |
| M-024 shared closures | 58 part files, 9 outputs; 312 uses and 49 writes across owners (`inventory/c0_parts_coupling.csv`) | Real modules: explicit imports or injected factories, each state with one owner, no writes into another owner's bindings, no global back-channel | C3 | **DONE (C3a, C3b, C3c).** **The sim: DONE at C3a.** It is ten modules and a composition (`src/core/server/sim.js`), each a factory given what it uses. Its 18 cross-owner writes became calls to the owner's functions. There is no state outside a factory, and nothing is built (ADR-005). Proofs: `dev/tools/checks/modules.js`, and the gate's `sim` step against B++'s `sim.js` (20,050 calls equal; 15 seam mutants caught). **The page's five multi-owner scripts: DONE at C3b.** `world.js`, `move.js`, `camcorder.js`, `glitch.js` and `ents.js` are a factory per part and a composition per script (CONTRACTS section 4). Three couplings across owners that M8 hid are explicit: `move.js`'s global back-channel (`window.__mvSfx`) became a hand-over (`useSound`), `ents.js`'s call through its public object (`E.drawSmiler`) an import, the camcorder sound's write into BR-R's state (`S.whine`) a call of BR-R's `setWhine`. Proofs: the page rules of `modules.js` (20 breaks refused) and the gate's `page` step (B++'s scripts and these: `world.js` every function, the other four in the same closed Chromium page, every trace equal; 12 seam mutants caught). **`mp.js`: DONE at C3c.** Its 16 parts are 11 modules and a composition, one per owner (B++'s three parts one session; G.I.B.'s three one module; OVERSEER's two one). Each owner's state is its own: the 147 uses and 31 writes across owners at C0 are now imports, readers (`me()`, `snap()` ...) and calls of the owner's functions (`clearKill`, `takeBodies`, `loginAnswer` ...); the session, which handles every message the server sends, is given the modules made after it once through its `wire()` (the late wiring: `modules.js` rule 12). Proofs: `tools/c3c_mp_provenance.js` (863 of M8's 921 lines as they were; every other line listed with its reason), `modules.js` (38 breaks refused), the gate's `cli_golden` step (all 18 client scenes, 6 of them new, byte for byte against B++'s `mp.js`, running every one of its 232 functions; 35 seam mutants caught in `cli_mutants`). `ai.js` has one owner and no cross-owner use, so it stays one cohesive file. **M-024: DONE** |
| M-005 legacy `window` contracts (63 names) | Documented (`CONTRACTS.md`) | Explicit adapters as consumers migrate; same public behaviour | C3 (the classic scripts' side), C4 (the bundle's side) | **PARTIAL: the classic scripts' side DONE (C3); the bundle's side PLANNED with C4.** At C3b no module reads, through `window`, what another module of its own script put there (`modules.js` checks it); every `window.__name` between scripts is kept as it was, registered at the same moment. At C3c `mp.js` too, and more: each name it puts on `window` has one module that puts it there (`window.__kill`, `__glitches`, `__items`, `__peerLights` had two to four writers in `mp.js` at M8), and what it writes through `window` one module that writes it (`window.__mv`'s held state: N.A.N.I.'s `unhold`). The contracts between scripts stay as they were, the bundle's side at C4 |
| M-021 perf noise | A/A rule, paired runs | A/A controls and paired A/B kept; real hardware in Human QA | C5 | **DONE as far as this machine goes (C5).** Every gate keeps the A/A rule and the interleaved A/B against B++ (server: 4 scenarios; page: `mp.js`'s hook and handler in 5 scenes); C5 adds the page's A/B against M8 (`tools/c5_vs_m8.js`). The one-off failures and their re-runs are each recorded (`CHECKPOINTS.md`). Real hardware (a physical GPU, a phone): Human QA |
| M-013 carpet placeholder | Shipped placeholder | **Not debt:** kept, hash unchanged | - | kept |
| M-002, M-014 PixiJS chunks | Named, one not observed loaded | Recorded as a vendor detail; no gameplay "fix" | C4 | **Recorded (M-014): DONE as a record.** The chunk is PixiJS's Web Worker entry, which a page never requests; a rebuild's chunk names are C4's |
| Eight README-only frameworks | Reserved homes | **Not debt:** left reserved, labelled so | - | kept |
| M-028 game facts written on both sides | Eleven besides Level 0 (`evidence/c5/duplicated_definitions.txt`), two in disagreement, all B++'s | One source per fact, read by both sides | after C4 for the bundle's copies; each one its own owner-approved change | **Recorded (C5).** Not changed: each unification changes code the gate compares with B++; the server's sides are module constants of their owners since C3, so a shared table built for both sides (as `world.js` is) is the next mechanical step |
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
| C1 | The v11 toolchain, offline, from verified packages (done) | every package against the lockfile (31 of 31; 9 refusals proven); the v11 `dist/` rebuilt byte for byte (17 of 17) |
| C2 | The session out of `server.js` | server traces equal B++'s; ordering traces; scripted negatives for the login and the lockout; live wire |
| C3a | Real modules for the server's sim (done) | the server goldens and the session traces equal B++'s; the `sim` step (the same calls on B++'s `sim.js` and this one; seam mutants); the `modules` step (the boundaries, from the code); the full gate |
| C3b | Real modules for the page's `world.js`, `move.js`, `camcorder.js`, `glitch.js`, `ents.js` (done) | the `page` step (`world.js` every function; the four others in the same closed Chromium page; seam mutants); the module audit extended to the page; the browsers, the contact lab, the suites, perf. The five outputs changed bytes, so the byte comparison with 3H2 is kept for every other file |
| C3c | Real modules for `mp.js` (done) | `cli_golden` (all 18 client scenes in one page against B++'s `mp.js`, 6 new ones reaching what the others left unrun: every function runs; the C3c scenes' stored traces); 35 seam mutants (`cli_mutants`); the module audit extended (in-place changes, one writer per global name, the late wiring; 38 breaks refused); the line provenance (`c3c_mp_provenance.js`); the browsers, the contact lab, the suites, perf |
| C4 | The client tree, the 40 ports, the 52-member `__api`, one Level 0 | a staging bundle against B++: traces, pixels, two browsers |
| C5 | The full gate against B++ and M8, the package, the Human QA page; then stop (done: C5a the new proofs; C5b the final gate, the report, the Human QA page; the package at delivery) | the debt matrix row by row: DONE, PARTIAL or BLOCKED; the final full gate on a fresh clone; this tree against M8 directly (11 comparisons: 10 equal, the time within its rule); the browser contracts; the developer round trip; the audit for other duplicated definitions (M-028) |
