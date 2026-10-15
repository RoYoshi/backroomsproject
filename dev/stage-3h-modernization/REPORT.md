# Stage 3H engine modernization: the final report

## STAGE 3H — HUMAN QA CANDIDATE (C5d)

**Only the owner can decide: PASS, NEEDS CHANGES or ROLL BACK.** Nothing is merged, deployed or promoted.

This report covers the whole stage. M8 (H3M-0 to H3M-8) was the first Human QA candidate; its milestone report is
`git show c34f0c2:dev/stage-3h-modernization/REPORT.md`. The owner then asked to close the architectural debt M8 had left (the
continuation pack of 2026-10-14): waves C0 to C5. The previous candidate, C5b (`1d2a213`), returned C1 and C4 unfinished because this
environment could not reach the npm registry. On 2026-10-15 the owner supplied the 31 locked packages and asked to finish them from
C5b; that report is `git show 1d2a213:dev/stage-3h-modernization/REPORT.md`. M8 stays the gameplay-parity reference and the rollback
point.

| | |
|---|---|
| Branch | `stage-3h-engine-modernization` (public repository `RoYoshi/backroomsproject`) |
| Final commit | C5d. It adds this report, the Human QA page, the final evidence and the ledgers. It changes no runtime behaviour: a note in `level0.json` and a comment in `contracts.d.ts`, and so the client's build record; the served files are the same bytes. A commit cannot name its own hash, so the delivery message names it |
| Last runtime change | C4c `3a3c12bbf542e5078b028b25d8329190772aaee0` (tree `4cd6faa…`): one Level 0. C4d (`af14818`), C5c (`2830dac`) and C5d added checks, comments and documents only |
| Gameplay-parity reference | M8 `c34f0c22bbacc5ac2813d173bc0591b67af7169f` |
| Behaviour oracle | the accepted B++ `143b63ff42b88c6780c5043e0f61d64100f81f40`, never modified |
| Frozen Stage 3H2 | `22751bbc39c91f3e54e3305638b2ef2c9dd12c68`, never modified |
| Production | `main` (`7781e1a`), never touched |

The rule was: **the engine may change, the experience may not.**
- The compiled client is now built from readable, owned TypeScript: the 40 edits made to its minified file after v11 are source, and
  the page is served that build (C4).
- Level 0's map and the carried lights are one definition, as data, which the server reads and the client is built with (C4c).
- The server's sim, the WebSocket session and six of the page's scripts are modules with explicit boundaries (C2, C3).
- Their behaviour was compared with B++'s, and directly with M8's, instead of their bytes: the same program statement by statement,
  the same frames in the real page, the same traces, the same pixels, the same answers.
- The final full gate against B++, on a fresh clone of C5c: 27 of 28 steps passed at the first run; the 28th, `browsers`, had a
  build of mine running beside it, and passed when run again alone. Against M8 directly, 11 of 11 comparisons are the same (below).

Nothing is returned unfinished. The architectural debt M8 left is closed, or guarded where closing it would be a change for the owner
to approve on its own (the facts written in more than one place, M-028). What no machine check here can judge is Human QA's:
[`HUMAN_QA.md`](HUMAN_QA.md).

## What changed after M8, wave by wave

| Wave | What changed for developers | Checkpoint | Why players cannot see it |
|---|---|---|---|
| C0 | The post-M8 audit: the debt ledger (`CONTINUATION.md`), the inventories (`inventory/c0_*`: the bundle's 40 steps and their port targets; 312 uses and 49 writes across owners in the parts), the owner-side package fetcher | `8041b61` | no runtime file changed |
| C2 | The WebSocket session to B++'s `src/frameworks/bpp/server/session.js`, the admin login and lockout to W.A.R.D.'s `admin_login.js`, every line verbatim, with the owner's approval to move them (M-023). `server.js` is 65 lines of configuration and wiring | `8abf81a` | The server traces and three new session scenarios (the login over time, the lockout per identity and its source, one connection's life) equal B++'s; 15 session mutants caught |
| C3a | The sim: ten modules and a composition (`src/core/server/sim.js`), each a factory given what it uses. The 18 writes across owners became calls of the owner's functions | `2bc4569` | B++'s `sim.js` and the modules give the same results to 20,050 calls; 15 seam mutants caught |
| C3b | The page's `world.js`, `move.js`, `camcorder.js`, `glitch.js` and `ents.js`: a factory per owner's part and a composition per script. Three hidden couplings made explicit | `7eb6d6a` | Every function of `world.js`, and the four others in the same closed Chromium page (1.25 million trace lines), equal to B++'s; 12 seam mutants caught |
| C3c | `mp.js`: 11 modules, one per owner, and a composition. Every write across owners is a call of the owner's function, every read of a changing value a reader; the session gets the modules made after it once, through its `wire()` | `722113f` | All 18 client scenes equal to B++'s, running every one of `mp.js`'s 232 functions; 35 seam mutants caught; every line M8's unless listed with its reason |
| C5a, C5b | The final verification's proofs (the `window.__api` contract checked by the gate, a developer round trip, browser contracts, the comparisons with M8) and the C5b candidate, with C1 and C4 returned unfinished | `da1fb88`, `1d2a213` | no runtime file changed |
| C1 | The v11 toolchain reproduced offline from the owner's 31 packages, each checked against the lockfile's SHA-512 (its own 9 cases as expected, 7 of them refusals): `npm ci --offline` and v11's own `npm run build`, 17 of 17 `dist/` files byte-identical (M-017) | `00b0c7f` | no runtime file changed |
| C4a | The 40 post-v11 edits ported into readable, owned TypeScript and CSS (`src/core/client/game/`, `PORT_LEDGER.md`), built offline by `dev/tools/build/client.js`; the `port` and `bundle` gate steps | `323f292` | no runtime file changed: proven before it was served (below) |
| C4b | The page is served that build (`client.js --write`, its record `generated/CLIENT_BUILD.json`); the lineage's two chains kept as history | `5e11af2` | The same program, statement by statement (195 of 197 top-level statements directly, the other 2 through every read and write of them); the same frames in nine scenes; the same 52-member facade; the full gate |
| C4c | One Level 0: `src/frameworks/lost/shared/level0.json` and `src/frameworks/pocket/shared/lights.json`, read by the server, built into the client (M-003) | `3a3c12b` | The server's level gives the same answers to 198,648 questions; the bundle differs from C4b's by one token, the same double; the full gate |
| C4d | Two checks in a new gate step: the client's `window` contract (M-005) and the facts written in more than one place (M-028) | `af14818` | no runtime behaviour changed (two comments) |
| C5c | The compiled client's frame time measured against B++'s bundle (A/A and A/B); the package tool brought up to date | `2830dac` | no runtime file changed |
| C5d | The final full gate on a fresh clone of C5c, the comparisons with M8, the clean-checkout build, an independent review of the documents, this report, the Human QA page and the package | this commit | no runtime behaviour changed: a note in `level0.json` and a comment in `contracts.d.ts`, so the client's build record; the served files are C4c's bytes |

`dev/tools/checks/modules.js` checks every module boundary from the code on each gate run (ADR-005): a write into another owner's
state, a hidden closure, a global back-channel, a late binding used too early. It refuses each of 38 deliberate breaks, six of them
couplings M8 had, put back. Each checkpoint was pushed normally and its push verified on GitHub, with a receipt in `evidence/remote/`
(M8's push is confirmed by C0's receipt, whose parent it is); `CHECKPOINTS.md` has each one's gate and its rollback.

## How the compiled client was ported, and proven the same program (C1, C4)

- **The toolchain (C1).** Each of the owner's 31 tarballs was checked against the recovered v11 lockfile (SHA-512, by the package.json
  inside it), installed with `npm ci --offline --ignore-scripts` from a private cache, and v11's own build reproduced its `dist/` byte
  for byte (TypeScript 7.0.2, Vite 8.3.1, PixiJS 8.21.0; Node 22.22.2). The packages are never committed.
- **The port (C4a).** `src/core/client/game/` is the v11 project with the 40 later edits written into its TypeScript and CSS, each
  change commented with its lineage step and owner; `PORT_LEDGER.md` (generated from the lineage's blame) says where each step's text
  is now. Three modules are new (`client/arrival.ts`: NEW RUN's fall and vanish; `client/gear-art.ts`: the carried lights;
  `client/contracts.d.ts`: what the page's other scripts publish on `window`).
- **The same program.** `tools/c4_alpha_all.mjs` rebuilds the shipped bundle in memory from the lineage (every step checked by its
  SHA-256) and compares every top-level statement of its app code with the port, modulo the names of bindings and a stated normal form:
  195 of 197 statements compared directly; the other 2, the declarations of NEW RUN's fall and vanish state, are an object's fields in
  the port, and every read and write of them is compared through a declared rewrite; SAME. `c4_css_check.mjs`:
  the built stylesheet is v11's part byte for byte, then the same 177 later statements. Their own mutants: 25 of 25 one-place edits
  caught (a number, a comparison, `&&` for `||`, two statements swapped, a statement dropped, another variable, two arguments swapped, a
  property's name, `==` for `===`, a CSS selector..., and, since C4c, edits of the level's definition).
- **The same behaviour, in the real page.** `dev/tools/gate/golden/bundle_diff.js` runs B++'s recorded client and the build side by
  side in Chromium, each page deterministic (a virtual clock and frames, seeded randomness, I/O at frame boundaries, a fake socket, a
  recording Web Audio), and compares after every batch of frames: the randomness, the game state, the document, every 2D canvas and
  audio call, every call through the shared window objects, the socket, the WebGL pixels; at checkpoints a PNG and every element's
  computed style. Nine scenes (4,239 frames, 26 captures: the title, walks, a Hound's and a Smiler's capture with RETRY and the world's
  end, NEW RUN's vanish and fall, the map and the four lights, a blackout and the win panel, customize): identical. Its own 5 mutants
  are caught, each in the record it shows in.
- **Kept exactly, on purpose:** a B02 test that never fires (FINDINGS M-029) and two no-op clauses (M-032), because the port is the
  shipped program; the build's CSS minifier is not applied to the later rules, because it would drop a blur (M-031).
- **The window contracts (C4d).** `window.__api`, the facade the classic scripts read, has the same 52 members in the same order on the
  built bundle (`api_contract.json`'s `builtBundle`). The other direction is typed: every window member the client uses is declared in
  `contracts.d.ts` with the script that defines it, and `dev/tools/checks/window_contract.js` holds the declarations to the client's
  source, the served scripts and the built bundle (it found one writer the declarations did not name: M-035).

## The definition of done, item by item

| The owner's item | State | Evidence |
|---|---|---|
| The 40 post-v11 ledger concerns owned by readable source, with no replay of minified patches | **DONE** (C4a, C4b) | `src/core/client/game/` and `PORT_LEDGER.md`; the build is what the page is served (`build:check` against `generated/CLIENT_BUILD.json`); the lineage is history (it still replays). Proofs above |
| The 52-member `window.__api` still works | **DONE** | The built bundle publishes the same 52 members in the same order and reads the same ones (`lineage` step); in a real Chromium the facade is the same on B++ and on this tree, at the menu and in a run (`workflow` step) |
| Every cross-framework closure dependency an explicit module boundary; no shared cross-owner mutable lexical state | **DONE** | `modules.js` on every gate run (the server, the sim, the page's six module scripts). The compiled client is TypeScript modules since C4; its window contract is checked (C4d). One shared data model is documented, not hidden: the session's peer records, whose fields each owner writes (CONTRACTS.md) |
| The WebSocket session moved, its authenticated semantics proven | **DONE** (C2) | B++'s traces on the session scenarios and on 3H0's server scenarios; no auth behaviour changed |
| The duplicated Level 0 eliminated | **DONE** (C4c) | One definition, as data, read by the server and built into the client; the server's level before and after: 198,648 comparisons equal (`c4c_level0_check.js`). The other facts written twice are guarded (M-028, C4d) |
| The full reproducible build | **DONE** | From a clean checkout of C5c, the project's build gives back every output byte for byte, and the compiled client, deleted, is rebuilt from its TypeScript, offline, byte for byte (`evidence/c5d/clean_checkout.*`); the v11 toolchain reproduces v11's `dist/` (C1) |
| Documentation, findings and the parity matrix truthful | **DONE** | Updated at every wave. A separate agent, which had not written them, checked the final documents' claims against the repository and the evidence; its findings were corrected (`evidence/c5d/STEPS.txt`) |
| Behavioural and performance parity with B++ and M8 | **DONE** | Below |
| Blockers closed or returned as unfinished Stage 3H items | **DONE** | None returned: C1 and C4 were completed |
| A complete source ZIP, checksums, receipts, the commit and tree, rollback, a targeted Human QA page | **DONE at delivery** | `HUMAN_QA.md` and the rollback are here. The package is made from this commit and checked by `tools/m8_package.js` (below). A commit cannot hold its own archive, so the ZIP, its receipts and SHA-256, and this commit's hash and tree come with the delivery message |

## Parity

**Against B++: the final full gate, on a fresh clone of C5c** (`2830dac`, this commit's parent; `evidence/c5d/gate_full_final/`).
**27 of 28 steps passed at the first run, in 69.5 minutes. The 28th, `browsers`, failed at its first run, which I had slowed by
running a build beside it, and passed when run again alone** (`evidence/c5d/gate_browsers_rerun/`; below). The 28 steps are M8's 20 and eight the
continuation added: `session` (C2), `modules` and `sim` (C3a), `page` (C3b), `port` and `bundle` (C4), `contracts` (C4d), `workflow`
(C5).

| Step | Cases | Step | Cases |
|---|---|---|---|
| build | 39 | quick_suites | 23 |
| port | 410 (the client built offline, its record the shipped one byte for byte; 195 of 197 statements directly, the other 2 through their uses; 25 of 25 mutants) | bundle | 4,265 (9 scenes, 4,239 frames, 26 captures, identical; 5 of 5 mutants) |
| lineage | 83 (the replayed steps; the `__api` contract checked too) | cli_mutants | 57 (22, and 35 seams) |
| parts | 55 | live_wire | 65 |
| modules | 58 | bpp_checks | 36 |
| contracts | 381 (the window contract: 35 members, 8 of 8 breaks refused; 41 facts, 169 copies, each changed alone caught) | browsers | 94 at the first run (FAIL); 127 run again alone (PASS) |
| docs | 23 | workflow | 30 (22 round-trip steps, 8 browser checks) |
| scope | 212 | contact_lab | 23 images, identical pixel for pixel |
| srv_golden | 11 | suites | 293 |
| bpp_golden | 7 | perf | 9 |
| session | 18 | | |
| sim | 20,065 | | |
| page | 1,255,007 | | |
| cli_golden | 30 (18 scenes, every one of `mp.js`'s 232 functions run) | | |
| protocol | 52,740 messages | | |
| mutants | 18 | | |
| static | 4 | | |
| raw_live | 173 | | |

The server traces equal B++'s stored traces, with one allowed difference: `http_base`'s lines about the files changed on purpose (3H2's
`index.html` and `mp.js`, the five page scripts rebuilt at C3b, and since C4b the compiled client's bundle and stylesheet). Their
bodies are checked against the files.

**The `browsers` step's first run** (FINDINGS M-037; `evidence/c5d/STEPS.txt`, item 2).
- `two_browser.py` checks that, in every frame Bob's page draws, his drawing of Alice is exactly where `mp.js` draws her. In 3 of 79
  frames it was one frame behind, by up to 128 px. Every other check of the step held.
- While it ran, I built the compiled client beside it on the same 2 CPUs, against this stage's own rule. Bob's frames took 234 ms
  (median), against 132 to 197 ms in the check's 15 earlier runs.
- The check samples inside BR-RoLE's draw, which the compiled client calls before `mp.js`'s per-frame hook moves the avatar to the
  drawn pose. Between frames, `mp.js`'s message handler moves the drawn pose at once when a newer pose is more than 96 px away
  (B++'s `PEER_SNAP`). A sprint carries a pose that far only when frames are long; then the check sees the drawn pose moved and the
  avatar where the last frame put it.
- Run again alone: 112 of 112 frames, and the whole step passed.
- M8's game fails the check the same way. With Bob's page alone slowed eight times by Chromium's own CPU throttling, M8's game failed
  it in 2 of 2 runs and this tree's in 2 of 2 (100 to 113 px, in sprints and runs, the drawn pose on the newest one). Slowed four
  times, both passed.

**This commit's own tree.** C5d changed a note in `level0.json` and a comment in `contracts.d.ts`. Both are inputs of the client's
build, so its record was written again; the bundle and the stylesheet are the same bytes. It also changed documents and evidence.
The fast gate on this commit's tree passed, 20 of 20 steps, in 9.5 minutes (`evidence/c5d/gate_fast_c5d/`): every deterministic
comparison above, with the client built again from its TypeScript and two of the `bundle` step's scenes.

**Against M8, directly** (`tools/c5_vs_m8.js`; `evidence/c5d/vs_m8/`). M8 was the old side wherever a tool can read M8's layout.
**SAME: 11 of 11 comparisons,** on the same clone of C5c.
- The page traces: 3H0's 9 scenes, 3H2's 3, and all 18 in one page. M8's `mp.js` runs 159 of its 159 functions there, this tree's
  232 of 232.
- `world.js`: 2,295 comparisons.
- The four page scripts: 1,252,700 trace lines.
- The sim: 20,050 calls.
- Real HTTP and raw TCP: 173 exchanges. The bodies of `mp.js` and of the compiled client's bundle differ, as declared.
- Two real players: 65 phases, by structure.
- The browser contracts: 8 checks, and the sides agree.
- The contact lab: 23 images, pixel for pixel.
- `mp.js`'s time: within its rule.

The server traces have no M8 side to run. M8's and this tree's each equal the same stored B++ baselines, except for `http_base`'s lines
about the files changed on purpose (2 files at M8, 9 here). Those responses' bodies are checked against the files.

**The compiled client against M8's.** M8's and B++'s compiled client are the same bytes, so the `bundle` step (nine scenes,
frame by frame) is also this client against M8's.

**Bytes.** 42 of the 51 files the game serves or builds (48 under `public/`, the server's 3 built files) are byte-identical
to M8's and 3H2's (`evidence/c5d/served_identity.*`).
- 7 were rebuilt as modules, and their behaviour is compared instead: `mp.js`, `world.js` (page and server), `move.js`,
  `camcorder.js`, `glitch.js`, `ents.js`.
- 2 are built from the port, and their program and behaviour are compared instead: the bundle and its stylesheet.
- The PixiJS chunks, `index.html` and every asset are untouched.
- From a clean checkout of C5c, the build gives back its 40 outputs and its manifest byte for byte, with `git status` clean. The
  compiled client, deleted, is built again from its TypeScript and the 31 packages, byte for byte (`evidence/c5d/clean_checkout.*`).

**Suites: no delta.** Only the cases that fail on B++ fail:
- `npm test` 13;
- `s_humanqa_hotfix` X03;
- `test_shadows` 5;
- `test_br_role` 3;
- `audit_net` 4;
- `audit_net2` 3.

They are inherited, and were not fixed, as the rules require. Six tests read the compiled client's minified text; since C4b they read
it as the lineage records it, B++'s bytes, so each still tests what it tested (M-033).

**Performance.** Each gate interleaves B++'s code with this tree's, 7 rounds, under 3H0's A/A rule.
- In the final gate, all within the rule:
  - the server's four scenarios moved from −6.0 % to −0.1 %;
  - `mp.js`'s hooks from +0.4 % to +21.5 % (`hum_dread` +21.5 %, `menu_online` +12.4 %).
- Against M8, 7 rounds: the hooks from −0.2 % to +12.6 %, within the rule.
- Across the nine timings of this `mp.js` against B++ or M8 since C3c:
  - `hum_dread`'s hook was slower every time, by +0.8 % to +22.7 %;
  - `menu_online`'s was slower eight times out of nine, from −10.0 % to +21.1 %;
  - the other three scenes went both ways.
  - Over 21 rounds on a quiet machine (C5, `evidence/c5/perf/`), the largest median difference was about 24 µs per call against
    B++ and 13 µs against M8, against a 60 Hz frame's 16,700 µs.
- The compiled client's own frame time (C5c, `bundle_perf.js`, in the real page):
  - against B++'s bundle, +0.15 % on a walk and +0.26 % on a Hound's captures;
  - the same bundle against itself: −2.91 % and −0.14 %, and up to 5.8 % in one round;
  - on this machine, the recompiled client's frame time cannot be told from the shipped one's.
- The server's own A/B against M8 cannot run: the tool runs an old `server.js` over this tree's files.
- This machine has 2 CPUs and no physical GPU. Real hardware is Human QA's.

**How the browser checks ran.** They are real Chromium pages with real input: keys, clicks, touch through Chromium's touch events.
They ran headless, drawing with SwiftShader, a software renderer, so no physical GPU and no real phone was involved. The client traces
and the compiled client's frames are recorded in closed pages with a virtual clock; they are traces, not a player's view.

**What the checks cannot see:**
- the sound as heard;
- real-hardware timing and feel, a real GPU's drawing;
- pixels outside the 23 contact-lab images and the bundle step's 26 captures;
- phones and real networks.

`docs/architecture/PARITY_MATRIX.md` maps each area of the game to its proofs, and to what is left for a person.

## The debt matrix

`CONTINUATION.md` holds it row by row. In short:
- **DONE:**
  - M-017: the v11 toolchain (C1);
  - M-001, M-012, M-019: the 40 ports, served (C4a, C4b);
  - M-003: one Level 0 (C4c);
  - M-005: the `window` contracts (the classic scripts' side at C3, the client's at C4d);
  - M-020: the `__api` contract and facade;
  - M-021: perf, as far as this machine goes;
  - M-023: the session;
  - M-024: shared closures.
- **GUARDED:** M-028, the facts written in more than one place: 41 facts, 169 copies, checked by the gate; one source for each is a
  change for the owner to approve, fact by fact.
- **Kept, not debt:**
  - M-013: the carpet placeholder;
  - the eight reserved, README-only frameworks.
- **Recorded:**
  - M-002 and M-014: the PixiJS chunks (the web-worker entry is built and, as before, not shipped).

Findings M-001 to M-037 are in `FINDINGS.md`. None changes the game.

## What will still be hard to maintain

- **The level's code exists twice.** Its data is one file since C4c, but its code (collision, ray cast, routes, light) is the client's
  TypeScript and, on the server, the bundle's own minified code extracted (`sim.level0.js`, M-025). Each side is compared with B++'s;
  serving the server from the client's TypeScript would change code the gate pins, and is the owner's to approve.
- **Some facts are written in more than one file** (M-028): the entity codes, the light kinds, a lamp's reach, the fixed step, the
  world's size and others, on the server and on the page. A change to one copy alone now fails the gate (`facts.js`); making each one
  source is still a change on both sides.
- **The classic scripts still talk through `window`** (63 names, documented in CONTRACTS.md). Inside each script the modules are
  explicit, and the compiled client's side is typed and checked; between scripts the contracts are as they were.
- **Building the compiled client needs the 31 locked packages**, which are not in the repository; the gate's `port` step and
  `client.js` take their folder. Checking the served client against its sources needs none.
- **The gate needs more than Node:**
  - Git with full history;
  - TypeScript;
  - Playwright with Chromium;
  - the 31 packages for the `port` and `bundle` steps;
  - for the full tier, Python with Playwright, Pillow and NumPy.

  The full tier takes about 70 to 75 minutes on 2 CPUs.

## Rollback

- **One step back:** each row of `CHECKPOINTS.md` names its commit. C4d, C5c and C5d change no runtime behaviour, so the game of this
  candidate is C4c's. C4a is the last checkpoint whose page was served B++'s compiled client; C3c is the last that changed the game
  before it.
- **The gameplay-parity reference:** M8 `c34f0c2`.
- **Before the modernization:** the frozen 3H2 `22751bb`.
- **The accepted game:** B++ `143b63f`.
- Those three are untouched, and every remote receipt since M8 records them (the earlier ones record B++, 3H2 and `main`). `main` was
  never touched, so production has nothing to roll back.

## The package

`THE_FAR_BACKROOMS_STAGE_3H_ENGINE_MODERNIZATION_HUMAN_QA.zip` is made by `tools/m8_package.js` from the final commit. It holds what
plays and builds:
- `server.js`, `public/`, `generated/`, `src/` (with the compiled client's TypeScript and its lockfile), `docs/`;
- the build and check tools;
- this report and the Human QA page.

It does not hold the 31 npm packages (the owner's `TFB_V11_LINUX_X64_PACKAGES.zip`); they are needed only to build the compiled client
again. It comes with `SOURCE_MANIFEST.json`, `BUILD_RECEIPT.json`, `PACKAGE_RECEIPT.json` and `SHA256SUMS.txt`.

The tool checks:
- every CRC, and that the ZIP holds exactly the commit's files under the listed paths;
- on the extracted copy: the build, the compiled client's record, the lineage, the documentation tables, the parts, the facts and the
  client's window contract;
- a server started from that copy: every served file compared, the forbidden paths refused, a WebSocket greeted.

The ZIP's SHA-256 is in the delivery message. The whole tree, with its history, the tests, the gate and the evidence, is the branch.

## Security

- No change was made to the admin passcode's default, the authentication, the lockout, the client identity it counts by, CORS/Origin
  handling, credentials, deployment or the repository's visibility.
- The session and the login moved verbatim (C2), with the owner's approval to move them, not to change them.
- The gate compares the passcode line and the deploy workflow with B++'s by hash on every run.
- The browser checks use a synthetic passcode of their own. They show that refusals still hold: a visitor's admin command is
  ignored, a wrong passcode is refused, and the lockout refuses even the right passcode.
- The npm packages were treated as untrusted input: each checked against the lockfile before use, installed with scripts disabled from a
  private cache, never committed.
- From M1-R on, each checkpoint's changes passed the secret scan before its commit (`evidence/<checkpoint>/secret_scan.*`; C5a's in
  `evidence/c5/`). From C0 on (and at M7), each committed revision was scanned again after its commit; that scan is filed with the next
  checkpoint (`secret_scan_<checkpoint>_after_commit.txt`). C5d's own comes with the delivery.
