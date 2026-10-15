# Stage 3H engine modernization: the milestone report

## STAGE 3H ENGINE MODERNIZATION — HUMAN QA PENDING

**Status: HUMAN QA CANDIDATE.** Only the owner can accept it. Nothing is merged, deployed or promoted.

| | |
|---|---|
| Branch | `stage-3h-engine-modernization` (public repository `RoYoshi/backroomsproject`) |
| Parent | the frozen Stage 3H2 `22751bbc39c91f3e54e3305638b2ef2c9dd12c68`, never modified |
| Behaviour oracle | the accepted B++ `143b63ff42b88c6780c5043e0f61d64100f81f40`, never modified |
| Production | `main` (`7781e1a`), never touched |
| Last runtime checkpoint | M7 `14ac44616ccd20225a7b9ae1ec882ce145f140cc`, tree `b3a7a5644ac8accd3c80821db968427f9ece65f1`, verified on GitHub (`evidence/remote/verify_m7_14ac446.json`) |
| Final commit | M8. It adds this report, the Human QA page, the final evidence and two tools, and corrects details in the documentation. It changes no runtime file. A commit cannot name its own hash, so the delivery message names it |

The rule was: **the engine may change, the experience may not.**
- Every file the browser loads, and the server's built world, is byte-identical to the frozen 3H2's.
- B++'s server and this one, given the same 18 scripted scenarios, send the same bytes.
- The final full gate passed against B++ (below).

What no machine check here can judge is Human QA's: [`HUMAN_QA.md`](HUMAN_QA.md).

## What changed, wave by wave

| Wave | What changed for developers | Checkpoint (commit) | Why players cannot see it |
|---|---|---|---|
| H3M-0 | Preflight, inventories, plans | M0 `fe8f9b4` | nothing outside `dev/` |
| H3M-1 | `public/` is the only web root; the canonical sources live in `src/` by owner; the server's built files are in `generated/`; one zero-dependency build (`npm run build`, `build:check`); the tests and the gate run on the new layout | M1-P `a895c07`, M1 `6356d53` | Every served file is byte-identical. The full gate at M1 passed 16 of 17 steps at once; perf passed when re-run (M-021) |
| Resumption | The recovered original source was authenticated. Every post-original client change was reconciled (bundle 40 steps, stylesheet 8, page 35). The `window.__api` contract (52 members) was recorded | M1-R `589681c` | no runtime file changed |
| H3M-6 | The recovered v11 project is an isolated input (`src/core/client/bundle/original-v11/`). The bundle and its stylesheet are built by replaying the lineage ledger, and the PixiJS chunks are copies of the v11 output | M6a `f2db9d8` | The build writes the same bytes. The snapshot is never served |
| H3M-2 | `server.js` (385 lines) split into five owned factory modules: S.P.A.C.E.'s movement authority, core's rooms and loop, OVERSEER's admin commands, B++'s fresher poses. `server.js` is now the 141-line composition root | M2 `527dc35` | Every moved line is verbatim (move proof). The server traces equal B++'s. Full gate PASS, 18 of 18 steps |
| H3M-3 to H3M-5 | The multi-owner scripts (`sim.js`, `mp.js`, `ai.js`, `ents.js`, `world.js`, `move.js`, `camcorder.js`, `glitch.js`) are built from 58 owned part files with checked interface headers | M3 `2aac0b1` | every built output byte-identical |
| H3M-7 | 129 root files moved to `dev/archive/` (ledger, index); a short README; `docs/` (quickstart, frameworks, flows, build, contracts, parity, ADR-001 to ADR-004); a README in each of the 20 framework folders; generated tables checked by the gate | M7 `14ac446` | no runtime file changed |
| H3M-8 | The final full gate, the clean-checkout build, the package, this report, the Human QA page | M8 (the delivery names it) | no runtime file changed |

Each checkpoint was pushed normally and verified on GitHub, and has a rollback (`CHECKPOINTS.md`, `evidence/remote/`).

## Where each part of the engine stands

| Area | Label | Detail |
|---|---|---|
| Layout: web root, sources by owner, generated files | DONE | ADR-001. `server.js`, `src/`, `generated/`, `dev/` and `docs/` answer 404 |
| Build and reproducibility | DONE | `npm run build` and `build:check`, with Node only. A fresh clone of M7 rebuilt 41 of 41 files byte for byte, and `git status` stayed clean (`evidence/m8/clean_checkout.*`) |
| Server decomposition | DONE, with one PARTIAL | Five factory modules join the seven that existed (ADR-003): `death_srv.js` and `peers.js`, written as modules before Stage 3H; `static.js`, `ws.js` and `fields.js`, moved out by 3H0; `newrun.js` and `aftermath.js`, moved out by 3H2. **PARTIAL:** the WebSocket session, which holds the passcode check and its lockout, stays in `server.js` until the owner decides (M-023) |
| Classic scripts | DONE, as parts | Owned parts with checked headers (ADR-004). They still share their script's closure (M-024). Five single-owner scripts stay whole (M-025) |
| Compiled client bundle | COMPATIBILITY ISLAND WITH COMPLETE LINEAGE | Built from the recovered v11 TypeScript output plus 40 recorded steps. Every byte is traced to a step, its date, its source and its owner (ADR-002). **PLANNED, not started:** the TypeScript port of those steps (P0 to P4) |
| Fresh `npm ci && npm run build` of the v11 project | NOT TESTED | No package registry access here (M-017). The recovery's receipt and the byte identity of its `dist/` are the evidence |
| Root and archive | DONE | 141 root entries became 13. 129 files moved byte for byte; reference audit PASS (M-026) |
| Documentation | DONE | `docs/` and 20 framework READMEs. The tables are generated, and the gate's `docs` step checks them |
| Frameworks | 12 with code; 8 reserved | P.U.L.S.E., E.C.H.O., CASHIER, LogicZ, A.T.L.A.S., S.T.A.G.E., V.A.U.L.T. and H.A.N.D.S. are names with a README: reserved, not implemented |
| The gate | DONE | `npm run gate` (13 steps) and `npm run gate:full` (20 steps), always against B++ |
| Human QA | PENDING | the owner's |

## Parity

- **Bytes.** Every file under `public/` (48: 36 built, 12 static) and the server's four built files are byte-identical to the frozen
  3H2's (`tools/m8_served_identity.js`, `evidence/m8/served_identity.*`). They differ from B++ in exactly the four files Stage 3H2
  changed or added on purpose: `index.html`, `mp.js`, `assets/net-newrun.js` and `assets/mp-hum.js`.
- **The final full gate,** on a fresh clone of M7, against B++: **PASS, 20 of 20 steps, in 34.8 minutes**
  (`evidence/m8/gate_full/`):

  | Step | Cases |
  |---|---|
  | build | 40 |
  | lineage | 83 |
  | parts | 64 |
  | docs | 23 |
  | scope | 198 |
  | srv_golden | 11 |
  | bpp_golden | 7 |
  | cli_golden | 12 |
  | protocol | 52,740 messages |
  | mutants | 18 |
  | static | 4 |
  | raw_live | 173 |
  | quick_suites | 23 |
  | cli_mutants | 22 |
  | live_wire | 65 |
  | bpp_checks | 36 |
  | browsers | 123 |
  | contact_lab | 23 images, identical pixel for pixel |
  | suites | 293 |
  | perf | 9 |

  The server traces equal B++'s stored traces, except for 10 lines of `http_base`: the responses that carry `index.html` and `mp.js`,
  the two served files 3H2 changed. Their bodies are checked against the files themselves.
- **Suites: no delta.** Each suite is checked against B++'s own record:

  | Suite | B++ (recorded) | Candidate |
  |---|---|---|
  | `npm test` | 149 of 162 | 149 of 162 |
  | `s_humanqa_hotfix` | 5 of 6 | 5 of 6 |
  | `s_ir` | 3 of 3 | 3 of 3 |
  | `test_shadows` | 43 of 48 | 43 of 48 |
  | `test_br_role` | 29 of 32 | 29 of 32 |
  | `interp_test` | 3 | 3 |
  | `test_3bn` | 7 of 7 | 7 of 7 |
  | `audit_net` | 13 of 17 | 13 of 17 |
  | `audit_net2` | 8 of 11 (LC1 can fail by chance) | 8 of 11 |
  | `ir_net` | 4 of 4 | 4 of 4 |

  Only the cases that fail on B++ fail. They are inherited and were not fixed, as the rules require.
- **Performance.** B++ against this build, interleaved, 7 rounds, with 3H0's rule.
  - **Server** (median change, within tolerance): `lifecycle` −2.19 %, `deaths` +2.10 %, `admin` +5.36 % (tolerance 9.97 %, the old
    side's spread), `schedule` −1.44 %.
  - **Page** (`mp.js`'s frame hook and message handler in 5 scenes): all within tolerance. The largest change is `menu_online`'s hook,
    +8.5 %, against a tolerance of 25 %, the old side's own spread.
  - The changes go both ways and stay within the rule. On this 2-CPU machine, the rule's own noise floor is several per cent (M-021).
- **What the checks cannot see:**
  - the sound as heard;
  - real-browser timing and feel;
  - pixels outside the 23 contact-lab images;
  - phones, and real networks.

  `docs/architecture/PARITY_MATRIX.md` maps each area of the game to its proofs and to what is left for a person.
- **Findings of this stage:** `FINDINGS.md`, M-001 to M-026. None changes the game. These need a decision or remain debt:
  - M-023: the session;
  - M-024: shared closures;
  - M-017: the v11 rebuild, not tested;
  - M-013: the carpet placeholder;
  - M-003: Level 0, defined twice;
  - M-021: the perf step's noise on a small machine.

## What will still be hard to maintain

- **The bundle's post-v11 code is minified.** It is about 44 KB in 40 steps. Changing it means recording a new lineage step, until
  the TypeScript port. Examples:
  - B02: the 96×72 Level 0 and stamina;
  - B07: the capture sounds;
  - B10 and B11: the light gear;
  - B12: NEW RUN's fall;
  - B28 to B30: BR-RoLE's corner receivers.
- **Level 0 is defined twice:** in `sim.level0.js` for the server, and in the bundle for the page.
- **Parts are not modules.** For example, `mp.js`'s transport uses 59 names of the other parts and writes 20. The headers make this
  visible and checked; they do not make it small.
- **The session and the passcode check are still in `server.js`.**
- **The gate needs more than Node:**
  - Git with full history;
  - TypeScript;
  - Playwright with Chromium;
  - for the full tier, Python with Playwright, Pillow and NumPy.

  A full run takes about 35 minutes on 2 CPUs.

## Rollback

- **One step back on this branch:** each row of `CHECKPOINTS.md` names its commit.
- **Back to before this modernization:** the frozen 3H2 `22751bb`.
- **Back to the accepted game:** B++ `143b63f`.
- Both of those are untouched, and every remote receipt records them. `main` was never touched, so production has nothing to roll
  back.

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
- the server started from that copy: every served file compared, the forbidden paths refused, a WebSocket greeted.

The ZIP's SHA-256 is in the delivery message, because a commit cannot hold the hash of its own archive. The whole tree, with its
history and the gate, is the branch.

## Security

- No change was made to the admin passcode's default, the authentication, the lockout, the CORS/Origin handling or credentials.
- The gate compares the passcode line with B++'s by hash on every run.
- From M1-R on, each checkpoint's changes passed the secret scan before the commit (`evidence/<checkpoint>/secret_scan.*`). M7's
  committed revision was scanned again after its commit (`evidence/m8/secret_scan_m7_after_commit.txt`).
- Security observations go to the owner privately, never into this public repository.
