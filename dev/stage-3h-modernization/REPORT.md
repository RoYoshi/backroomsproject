# Stage 3H engine modernization: the final report

## STAGE 3H — HUMAN QA CANDIDATE, WITH UNFINISHED ITEMS (NEEDS WORK)

**Only the owner can decide: PASS, NEEDS CHANGES or ROLL BACK.** Nothing is merged, deployed or promoted.

This report covers the whole stage. M8 (H3M-0 to H3M-8) was the first Human QA candidate; its milestone report is
`git show c34f0c2:dev/stage-3h-modernization/REPORT.md`. The owner then asked to close the architectural debt M8 had left (the
continuation pack of 2026-10-14): waves C0 to C5. M8 stays the gameplay-parity reference and the rollback point.

| | |
|---|---|
| Branch | `stage-3h-engine-modernization` (public repository `RoYoshi/backroomsproject`) |
| Final commit | C5b. It adds this report, the Human QA page, the final evidence and the ledgers; it changes no runtime file. A commit cannot name its own hash, so the delivery message names it |
| Last runtime change | C3c `722113ff533c315effd6a15b9fafd019a53e0703` (tree `000fdc4…`): `mp.js` made of modules. C5a `da1fb887a472c8a5bd95b269d84ae0f815b69d0c` (tree `8e6f340…`) added proofs only |
| Gameplay-parity reference | M8 `c34f0c22bbacc5ac2813d173bc0591b67af7169f` |
| Behaviour oracle | the accepted B++ `143b63ff42b88c6780c5043e0f61d64100f81f40`, never modified |
| Frozen Stage 3H2 | `22751bbc39c91f3e54e3305638b2ef2c9dd12c68`, never modified |
| Production | `main` (`7781e1a`), never touched |

The rule was: **the engine may change, the experience may not.**
- The server's sim, the WebSocket session and six of the page's scripts are now modules with explicit boundaries.
- Their behaviour was compared with B++'s, and directly with M8's, instead of their bytes: the same traces, the same pixels, the same
  answers.
- Every other file the browser loads is byte-identical to M8's.
- The final full gate passed against B++ on a fresh clone (below).

**Unfinished, and returned as Stage 3H work (NEEDS WORK).** These are blocked by one thing: this environment cannot reach the npm
registry, so the recovered v11 toolchain cannot be installed.
- **C1** (M-017): the v11 Vite/TypeScript build, rebuilt from its locked packages.
- **C4** (M-001, M-012, M-019, ADR-002): the bundle's 40 post-v11 edits as readable, owned TypeScript.
- **C4** (M-003): one Level 0 definition instead of two.
- The bundle's side of the `window` contracts (M-005).

`tools/c1_fetch_locked_packages.js` lets the owner fetch the 31 locked packages on a machine with internet access. Each tarball is
checked against the lockfile before use, and C1 and C4 can then go ahead. What no machine check here can judge is Human QA's:
[`HUMAN_QA.md`](HUMAN_QA.md).

## What changed after M8, wave by wave

| Wave | What changed for developers | Checkpoint | Why players cannot see it |
|---|---|---|---|
| C0 | The post-M8 audit: the debt ledger (`CONTINUATION.md`), the inventories (`inventory/c0_*`: the bundle's 40 steps and their port targets; 312 uses and 49 writes across owners in the parts), the owner-side package fetcher. C1 found BLOCKED | `8041b61` | no runtime file changed |
| C2 | The WebSocket session to B++'s `src/frameworks/bpp/server/session.js`, the admin login and lockout to W.A.R.D.'s `admin_login.js`, every line verbatim, with the owner's approval to move them (M-023). `server.js` is 65 lines of configuration and wiring | `8abf81a` | The server traces and three new session scenarios (the login over time, the lockout per identity and its source, one connection's life) equal B++'s; 15 session mutants caught |
| C3a | The sim: ten modules and a composition (`src/core/server/sim.js`), each a factory given what it uses. The 18 writes across owners became calls of the owner's functions | `2bc4569` | B++'s `sim.js` and the modules give the same results to 20,050 calls; 15 seam mutants caught |
| C3b | The page's `world.js`, `move.js`, `camcorder.js`, `glitch.js` and `ents.js`: a factory per owner's part and a composition per script. Three hidden couplings made explicit | `7eb6d6a` | Every function of `world.js`, and the four others in the same closed Chromium page (1.25 million trace lines), equal to B++'s; 12 seam mutants caught |
| C3c | `mp.js`: 11 modules, one per owner, and a composition. Every write across owners is a call of the owner's function, every read of a changing value a reader; the session gets the modules made after it once, through its `wire()` | `722113f` | All 18 client scenes equal to B++'s, running every one of `mp.js`'s 232 functions; 35 seam mutants caught; every line M8's unless listed with its reason |
| C5a | The final verification's new proofs: the `window.__api` contract checked by the gate; a developer round trip and three browser contracts in a new gate step; the comparison tools read M8 as an old side | `da1fb88` | no runtime file changed |
| C5b | The final full gate on a fresh clone, the clean-checkout build, the package, this report and the Human QA page | this commit | no runtime file changed |

`dev/tools/checks/modules.js` checks every module boundary from the code on each gate run (ADR-005): a write into another owner's
state, a hidden closure, a global back-channel, a late binding used too early. It refuses each of 38 deliberate breaks, six of them
couplings M8 had, put back. Each checkpoint was pushed normally and verified on GitHub (`evidence/remote/`); `CHECKPOINTS.md` has each one's gate and its
rollback.

## The definition of done, item by item

| The owner's item | State | Evidence |
|---|---|---|
| The 40 post-v11 ledger concerns owned by readable source, with no replay of minified patches | **BLOCKED (C1, C4)** | Each step is traced byte for byte (`src/core/client/bundle/lineage/`) and mapped to its concern, owner and port target (`inventory/c0_bundle_steps.csv`). The port needs the toolchain |
| The 52-member `window.__api` still works | **DONE** | The bundle that makes it is B++'s, byte for byte. The contract (who reads each member) is counted from the code and checked by the gate's `lineage` step; it is M8's but for two reads moved behind a parameter (M-027). In a real Chromium the facade is the same on B++ and on this tree (`workflow` step) |
| Every cross-framework closure dependency an explicit module boundary; no shared cross-owner mutable lexical state | **DONE** for the server and the classic scripts (M-024) | `modules.js` on every gate run. One shared data model is documented, not hidden: the session's peer records, whose fields each owner writes (CONTRACTS.md). The bundle is one minified closure until C4 |
| The WebSocket session moved, its authenticated semantics proven | **DONE** (C2) | B++'s traces on the session scenarios and on 3H0's server scenarios; no auth behaviour changed |
| The duplicated Level 0 eliminated | **BLOCKED (C1, C4)** | The page's copy is inside the bundle. The audit also found eleven other facts written on both sides (M-028, `evidence/c5/duplicated_definitions.txt`); each is B++'s and pinned by the goldens |
| The full reproducible build | **PARTIAL** | The project's build (Node only, zero dependencies) gives back every output byte for byte from a clean checkout (`evidence/c5b/clean_checkout.*`). The v11 project's own `npm ci && npm run build` is BLOCKED (C1, M-017) |
| Documentation, findings and the parity matrix truthful | **DONE** | Updated at every wave. A separate agent, which had not written them, checked the final documents' claims against the repository and the evidence; its findings were corrected (`evidence/c5b/STEPS.txt`) |
| Behavioural and performance parity with B++ and M8 | **DONE** | Below |
| Blockers closed or returned as unfinished Stage 3H items | **DONE** | This report; `CONTINUATION.md`'s debt matrix |
| A complete source ZIP, checksums, receipts, the commit and tree, rollback, a targeted Human QA page | **DONE at delivery** | `HUMAN_QA.md` and the rollback are here. The package is made from this commit and checked by `tools/m8_package.js` (below). A commit cannot hold its own archive, so the ZIP, its receipts and SHA-256, and this commit's hash and tree come with the delivery message |

## Parity

**Against B++: the final full gate, on a fresh clone of C5a: PASS, 25 of 25 steps at the first run, in 46.2 minutes**
(`evidence/c5b/gate_full/`). These are M8's 20 steps and five the continuation added: `session` (C2), `modules` and `sim` (C3a), `page`
(C3b), `workflow` (C5).

| Step | Cases | Step | Cases |
|---|---|---|---|
| build | 39 | raw_live | 173 |
| lineage | 83 (the replayed steps; the `__api` contract checked too) | quick_suites | 23 |
| parts | 55 | cli_mutants | 57 (22 and 35 seams) |
| modules | 58 | live_wire | 65 |
| docs | 23 | bpp_checks | 36 |
| scope | 210 | browsers | 104 |
| srv_golden | 11 | workflow | 23 (15 round-trip steps, 8 browser checks) |
| bpp_golden | 7 | contact_lab | 23 images, identical pixel for pixel |
| session | 18 | suites | 293 |
| sim | 20,065 | perf | 9 |
| page | 1,255,007 | | |
| cli_golden | 30 (18 scenes, every one of `mp.js`'s 232 functions run) | | |
| protocol | 52,740 messages | | |
| mutants | 18 | | |
| static | 4 | | |

The server traces equal B++'s stored traces, with one allowed difference: `http_base`'s lines about the files changed on purpose (3H2's
`index.html` and `mp.js`, and the five page scripts rebuilt at C3b). Their bodies are checked against the files.

**Against M8, directly** (`tools/c5_vs_m8.js`; `evidence/c5/vs_m8/`, `evidence/c5b/vs_m8_more/`). M8 was the old side wherever a tool
can read M8's layout.
- The page traces: 3H0's 9 scenes, 3H2's 3, and all 18 in one page. M8's `mp.js` runs 159 of its 159 functions there, this tree's
  232 of 232.
- `world.js`: 2,295 comparisons.
- The four page scripts: 1,252,700 trace lines.
- The sim: 20,050 calls.
- Real HTTP and raw TCP: 173 exchanges. `mp.js`'s body differs, as declared.
- Two real players: 65 phases, by structure.
- The browser contracts: 8 checks, and the sides agree.
- The contact lab: 23 images, pixel for pixel.
- `mp.js`'s time.

All eleven pass: the ten comparisons are equal, and the time is within its rule.

The server traces have no M8 side to run. M8's and this tree's each equal the same stored B++ baselines, except for `http_base`'s lines
about the files changed on purpose (2 files at M8, 7 here). Those responses' bodies are checked against the files.

**Bytes.** 44 of the 51 files the game serves or builds (48 under `public/`, the server's 3 built files) are byte-identical to M8's and
3H2's.
- The 7 others were rebuilt as modules, and their behaviour is compared instead: `mp.js`, `world.js` (page and server), `move.js`,
  `camcorder.js`, `glitch.js`, `ents.js`.
- The bundle, its stylesheet, the PixiJS chunks, `index.html` and every asset are untouched.

**Suites: no delta.** Only the cases that fail on B++ fail:
- `npm test` 13;
- `s_humanqa_hotfix` X03;
- `test_shadows` 5;
- `test_br_role` 3;
- `audit_net` 4;
- `audit_net2` 3.

They are inherited, and were not fixed, as the rules require.

**Performance.** Each gate interleaves B++'s code with this tree's, 7 rounds, under 3H0's A/A rule.
- In the final gate:
  - the server's four scenarios moved from −6.5 % to +0.7 %;
  - the page's hooks moved from −10 % to +31 %, in a noisy run (the old side's own spread up to 58 ms a scene);
  - all within the rule.
- Over 21 rounds, on a quiet machine (`evidence/c5/perf/`):
  - against B++: from −11.2 % to +12.4 % by scene;
  - against M8: from −5.4 % to +7.6 %, with no scene distinguishable from the noise of the same code against itself.
- Across all five timings of this code (C3c's gate, the final gate, and the three comparisons with M8 and B++):
  - `hum_dread`'s hook was slower every time, by +0.8 % to +22.7 %;
  - `menu_online`'s hook was slower four times out of five, from −10.0 % to +12.4 %;
  - the other three scenes went both ways.
  - In the 21-round runs, the largest median difference is about 24 µs per call, against a 60 Hz frame's 16,700 µs.
- The server's own A/B against M8 cannot run: the tool runs an old `server.js` over this tree's files.
- This machine has 2 CPUs and no physical GPU. Real hardware is Human QA's.

**How the browser checks ran.** They are real Chromium pages with real input: keys, clicks, touch through Chromium's touch events.
They ran headless, drawing with SwiftShader, a software renderer, so no physical GPU and no real phone was involved. The client traces
are recorded in a closed page with a fake clock; they are traces, not a player's view.

**What the checks cannot see:**
- the sound as heard;
- real-hardware timing and feel;
- pixels outside the 23 contact-lab images;
- phones and real networks.

`docs/architecture/PARITY_MATRIX.md` maps each area of the game to its proofs, and to what is left for a person.

## The debt matrix

`CONTINUATION.md` holds it row by row. In short:
- **DONE:**
  - M-020: the `__api` contract and facade, for this candidate;
  - M-021: perf, as far as this machine goes;
  - M-023: the session;
  - M-024: shared closures.
- **PARTIAL:** M-005, the `window` contracts. The classic scripts' side is done; the bundle's side waits for C4.
- **BLOCKED** (all on the npm registry, C1):
  - M-017: the v11 toolchain;
  - M-001, M-012, M-019: the 40 ports;
  - M-003: one Level 0.
- **Kept, not debt:**
  - M-013: the carpet placeholder;
  - the eight reserved, README-only frameworks.
- **Recorded:**
  - M-002 and M-014: the PixiJS chunks;
  - M-028: the facts written on both sides.

Findings M-001 to M-028 are in `FINDINGS.md`. None changes the game.

## What will still be hard to maintain

- **The bundle's post-v11 code is minified:** about 44 KB in 40 steps. Changing it means recording a new lineage step, until C4.
  Examples:
  - B02: the 96×72 Level 0 and stamina;
  - B07: the capture sounds;
  - B10 and B11: the light gear;
  - B12: NEW RUN's fall;
  - B28 to B30: BR-RoLE's corner receivers.
- **Level 0 is defined twice,** and eleven smaller facts are too (M-003, M-028). A change to one copy alone breaks the game silently.
- **The classic scripts still talk through `window`** (63 names, documented in CONTRACTS.md). Inside each script the modules are
  explicit; between scripts and the bundle the contracts are as they were.
- **The gate needs more than Node:**
  - Git with full history;
  - TypeScript;
  - Playwright with Chromium;
  - for the full tier, Python with Playwright, Pillow and NumPy.

  The full tier takes about 50 minutes on 2 CPUs.

## Rollback

- **One step back:** each row of `CHECKPOINTS.md` names its commit. C5a and C5b change no runtime file, so the game of this candidate
  is C3c's.
- **The gameplay-parity reference:** M8 `c34f0c2`.
- **Before the modernization:** the frozen 3H2 `22751bb`.
- **The accepted game:** B++ `143b63f`.
- Those three are untouched, and every remote receipt since M8 records them (the earlier ones record B++, 3H2 and `main`). `main` was never touched, so production has nothing to roll back.

## The package

`THE_FAR_BACKROOMS_STAGE_3H_ENGINE_MODERNIZATION_HUMAN_QA.zip` is made by `tools/m8_package.js` from the final commit. It holds what
plays and builds:
- `server.js`, `public/`, `generated/`, `src/`, `docs/`;
- the build and check tools;
- this report and the Human QA page.

It comes with `SOURCE_MANIFEST.json`, `BUILD_RECEIPT.json`, `PACKAGE_RECEIPT.json` and `SHA256SUMS.txt`.

The tool checks:
- every CRC, and that the ZIP holds exactly the commit's files;
- the build, the lineage, the documentation tables and the parts, on the extracted copy;
- a server started from that copy: every served file compared, the forbidden paths refused, a WebSocket greeted.

The ZIP's SHA-256 is in the delivery message. The whole tree, with its history, the tests, the gate and the evidence, is the branch.

## Security

- No change was made to the admin passcode's default, the authentication, the lockout, the client identity it counts by, CORS/Origin
  handling, credentials, deployment or the repository's visibility.
- The session and the login moved verbatim (C2), with the owner's approval to move them, not to change them.
- The gate compares the passcode line and the deploy workflow with B++'s by hash on every run.
- The new browser checks use a synthetic passcode of their own. They show that refusals still hold: a visitor's admin command is
  ignored, a wrong passcode is refused, and the lockout refuses even the right passcode.
- Each checkpoint's changes passed the secret scan before the commit (`evidence/<checkpoint>/secret_scan.*`). Each committed revision
  was scanned again after its commit; that scan is filed with the next checkpoint (`secret_scan_<checkpoint>_after_commit.txt`).
- Security observations go to the owner privately, never into this public repository.
