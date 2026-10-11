# Stage 3H0: safe architecture — `mp.js` and `server.js` split along proven seams

**What 3H0 is.** A refactor-only stage. It moves code out of the two largest multiplayer files, and only where old and new demonstrably behave the same for the same inputs. No feature work, no behavior change, no protocol change.

**What it did:**
- **Five extractions are GO:**
  - from `mp.js`: the look / light / corpse wire codec and the snapshot interpolation;
  - from `server.js`: the WebSocket framing, the checks on what clients send, and the static file serving.
- **Nine seams are NO-GO,** each explained in `3H0_DEFERRED_FULL_3H.md`: the client transport, admin panel, replays, peers and audio; the server sessions, snapshot builder, admin commands, and movement and aftermath. They cannot move without redesigning who owns what.

**How it was checked.** Before anything moved, the parent's behavior was recorded byte for byte, and the recording was shown to notice small deliberate changes. Every extraction was then compared with the accepted parent at every level: functions, deterministic traces of both programs, the real server and game over the wire, the existing test suites, QA2's own regression probes, and performance.

**What changes for you.** Nothing visible. `mp.js` and `server.js` stay the composition roots, and `node server.js [port]` starts the server exactly as before.

- **Branch:** `stage-3h0`, from the accepted QA2 commit `edd2af9` (tree `108d89f`), which was verified independently at H0-0. `main`, `stage-3c-qa2`, `stage-3c-qa1`, `stage-3c` and every other branch are untouched. Every push was a normal push.
- **The final commit and tree,** and the GitHub check of them, are in `STAGE_3H0_PACKAGE_RECEIPT.txt`.

## Checkpoints

Each was tested, committed, pushed normally, and checked on GitHub before the next began: commit, tree, parent, a straight line from `edd2af9`, every other branch unchanged. The checks are in `dev/stage-3h0/evidence/h0-0/` and `evidence/remote/`.

| Checkpoint | Commit | Tree | What |
|---|---|---|---|
| H0-0 | `e770b73` | `2eedcfc` | the parent verified; audit, protocol inventory, API locks, ownership maps; no production change |
| H0-1 | `f6dc642` | `a9953db` | golden traces, protocol contract, sensitivity, live and performance baselines on the parent; no production change |
| H0-2 | `a232c50` | `39360c1` | the client wire codec moved to `assets/net-wire.js` (GO) |
| H0-3 | `4a09be7` | `9539991` | the client interpolation moved to `assets/net-interp.js` (GO) |
| H0-4a | `eee9596` | `eb43768` | the WebSocket framing moved to `server/ws.js` (GO) |
| H0-4b | `f076092` | `fa7dfdb` | the field checks moved to `server/fields.js` (GO) |
| H0-4c | `44395a2` | `f6c6a01` | the static file serving moved to `server/static.js` (GO) |
| H0-5 | in the receipt | in the receipt | cross-boundary regression and performance on the final tree; the review's corrections; architecture, deferred work, level-authoring seams |
| H0-6 | in the receipt | in the receipt | the gate and quick checks once more on the final tree, the secret scan, the changed-files list; this report, the human-QA checklist, the package |

## What moved

| New file | From | What, verbatim | Bytes |
|---|---|---|---:|
| `assets/net-wire.js` | `mp.js` | `toRec`, `partList`, `partObj`, `parseLook`; plus `lookStr`, the look encoder `mp.js` wrote inline three times | 2,653 |
| `assets/net-interp.js` | `mp.js` | `NET`, `netReset`, `netHist`, `angD2`, `netPose`, with their comments | 4,163 |
| `server/ws.js` | `server.js` | `frame`, and the inbound frame parser as `reader(sock, onMessage)` | 2,170 |
| `server/fields.js` | `server.js` | `num`, `KINDS`, `LEGACY`, `kindOf`, `cleanParts`, `HEX`, `DEFAULT_LOOK`, `cleanLook` | 1,770 |
| `server/static.js` | `server.js` | the `SERVE` allowlist, the MIME table, the gzip cache, the request handler | 3,839 |

**Sizes:** `mp.js` 72,790 → 68,144 bytes; `server.js` 30,485 → 26,506 bytes.

**The other changes:**
- `index.html` gains exactly two `<script>` lines;
- `dev/tests/interp_test.js` reads the moved interpolation from its new file. Its output is identical before and after.

Nothing else outside `dev/stage-3h0/` and the stage's documents changed. `dev/stage-3h0/scope_check.py` proves that file by file, and line by line for the moves:
- of the 47 lines removed from `mp.js`, 44 reappear verbatim in the new files, and the other 3 are the inline look encoders that now call `lookStr`;
- of the 65 lines removed from `server.js`, 63 reappear verbatim, and the other 2 are the two function headers that became factory calls.

`3H0_ARCHITECTURE_MAP.md` has the before and after diagrams.

## How equivalence was proven

1. **Golden traces, recorded on the parent before anything moved (H0-1):**
   - **Server.** `server.js` runs in a closed world: a fake clock and timers, seeded randomness, the real simulation wrapped so that every call into it is recorded, and fake sockets and HTTP. Eleven scenarios cover HTTP, upgrades, frames, lifecycle, deaths, admin, the tick schedule, every field and the exit. Every byte out is compared.
   - **Client.** `mp.js` runs in Chromium with a fake clock, WebSocket and game. Nine scenes cover menu, run, interpolation, replays and bodies, the facade, admin, reconnect and audio. Every send, game call, global, DOM and timer change is compared.
2. **The recordings have teeth.** Deliberate small changes to the parent's files are caught: 37 of 37 on the server and 35 of 35 on the client. Two more changes, one on each side, cannot be revealed by any input, because the code they touch has no effect; they are documented and not counted.
3. **Function equivalence, with its own mutants.** Each pure piece was run against the parent's own text on generated inputs. Totals: 140,000 wire calls, 80,000 interpolation steps, 3,000 frames and 1,000 parser streams, 100,000 field checks, all identical. Every set of deliberately wrong versions was caught: wire 8/8, interpolation 8/8, framing 12/12, fields 11/11. The static serving got 12/12 through the server traces.
4. **The protocol contract.** Every traced message (11,554 + 912) matches the frozen key list: 0 violations.
5. **Live.** The real server and the real game, two players, through every phase: boot, menu, entering, NEW RUN twice, END, re-entering, an admin-driven death, respawn, a server restart. Compared structurally, phase by phase, with the parent's checkout: identical at every checkpoint.
6. **Real sockets.** `node server.js` old and new on the same files: the start-up line, 108 raw HTTP exchanges byte for byte except `Date`, and 25 WebSocket checks. Identical.
7. **Tests first.** At each checkpoint the checks were run before the production file changed: on drafts in a scratch copy for the server, and as A/A runs. Every failing first run was kept next to its repair (below).

## Results on the final tree (H0-5)

All gated items hold (`dev/stage-3h0/evidence/h0-5/summary.json`):

- **Existing suites, as at H0-1 on the parent:** `live.js` 17/17, `audit_net.js` 17/17, `audit_net2.js` 11/11, `ir_net.js` 4/4, `test_3bn.js` 7/7, `interp_test.js` passed. `npm test` gives 151/162, with the same 11 historical failures by name. `dev/shadows/test_shadows.js` gives 43/48 on both, with the same failures.
- **QA2's own final checks** (QA2 R3 ran them on the parent):
  - camera fairness 12/12;
  - BR-RoLE 32/32;
  - the theme files;
  - QA2's probes: `probe_b1` 13/13, `probe_b2` 10/10, `probe_b3` 28/28;
  - the regression of the 12 older probes, clean once its three first-run failures were re-run (below).
- **Menu and boot captures** of the parent and the final tree, taken the same day. They differ only by the random room name in the rail, the Customize preview's idle animation and frame timing, as much as the parent differs from its own QA2 captures.
- **The gate** (golden traces and contract): ALL EQUIVALENT, again after the comment-only corrections.
- **Function equivalence** of all four pure pieces: identical on the final tree. Static mutants: 12/12.
- **Scope:** every change is an approved extraction, the adapted test, the stage's tooling or a document.
- **Real sockets:** identical.
- **Live wire:** identical in every phase in the third run. The first two runs differed only in the server-outage phases, each for a reason outside the extracted code; two A/A runs were identical.
- **Performance:** within the rules (below).

**Four first-run differences were each investigated before going on.** The evidence is kept, and `3H0_EQUIVALENCE_REPORT.md` (H0-5) has the detail:
1. Two QA2 probe checks that depend on the AI and on a random spawn. The summon sequence is byte-identical old against new for 30 of 30 seeded worlds, and a fresh 24-round replication on the real server shows no difference (p = 0.28).
2. The live wire's outage phases: a late reconnect on the parent's side, and an ignored death replay from the final tree's offline game.
3. The real-stack CPU: a 3-round +22.9 % became −8.8 % over 6 rounds.
4. A slow warm boot on the parent's side.

**H0-6 ran the quick checks once more** before the final commit, with the production files unchanged since H0-5 (`dev/stage-3h0/evidence/h0-6/`). All held:
- the gate: ALL EQUIVALENT;
- function equivalence of the four pure pieces;
- the static mutants, 12/12;
- `interp_test.js`;
- real sockets: identical;
- the scope check;
- the secret scan: nothing found.

## Failing evidence kept, and what it taught

- **H0-1:** the first performance rule failed on identical code (`perf_aa.json`). It was recalibrated before any extraction.
- **H0-2:** the first gate failed on a harness artifact: the page-state record hashed `<script>` tags (`evidence/h0-2/attempt1/`). The harness was fixed, and the client baseline rebuilt from the parent's code (`evidence/h0-1b/`).
- **H0-3:** the interpolation check first caught 6 of 8 wrong versions. Its generator was sharpened, and it then caught 8 of 8.
- **H0-4a:** the first A/A run of the real-socket check differed: it read too early, and it did not normalize a second `Date` header. Fixed; then identical.
- **H0-4c:** `dev/tests/live.js` failed once. Its L5b check gives an AI kill 70 s, and none came. 46 repeats, including a rotated three-arm run, showed the parent with the same long kill times. It is a property of the test, not of the move.

All kept under `dev/stage-3h0/evidence/`, with the explanations in `3H0_EQUIVALENCE_REPORT.md`.

## Performance

**The rules were fixed at H0-1, before any extraction:**
- **Deterministic workloads** (`perf_det.js`): server CPU within max(old's spread, 5 %); client hook and handler times within max(spread, 10 %).
- **The real stack** (`perf_h0.js`): server CPU within 15 %; bytes and client timings reported.

**Results.** Every checkpoint was within those rules, and so is the final tree: server CPU on the deterministic workloads −1.7 % to +2.2 % (tolerances 18-23 %); client hook and handler timings within their tolerances; the real-stack server CPU −8.8 % (`play8`) and +0.6 % (`debug4`) over 6 rounds; QA2's frame-time tool −8.2 % to +8.5 % across 12 states, in both directions. `STAGE_3H0_PERFORMANCE.md` has every number.

**No new per-frame work.** The moved functions are called as often as before.

## Scope: what did not change

- **Untouched files:**
  - the game bundle;
  - `sim.js`, `ai.js`, `world.js`;
  - movement, collision, lighting (BR-RoLE), camera and timing policies;
  - gore and death physics;
  - the QA2 menu, boot, theme, HUD, keybinds, touch layout and PWA files;
  - `package.json` and the start scripts;
  - deployment (`.github/`);
  - every earlier stage's tests and evidence.

  The package receipt checks each one against the parent.
- **The protocol and `window.__net`** are unchanged. The two new globals' namespace, `window.__mpLib`, is the only addition, and it is declared.
- **Security behavior** is unchanged:
  - the HTTP allowlist is the same regular expression, character for character;
  - admin authentication and the lockout, and raw WebSocket acceptance (the whole upgrade), stay in `server.js` untouched.
- **The new `server/` folder is never served.** Its URLs and traversal variants are tested at 404.

## Findings (recorded, not changed)

**From the audit and the tests** (`3H0_DEFERRED_FULL_3H.md` section 3):
- `__net.collected` is undefined but unreachable;
- outbound messages of 64 KiB or more are dropped silently;
- two pieces of code no input can reveal;
- the admin spot finder's glitched-wall check never matches;
- an unused constant in `glitch.js`;
- the Level 0 map existing twice (server and bundle);
- the known NEW RUN ghost peer;
- the `live.js` 70 s limit.

**A second test that reads moved code by its text: `dev/shadows/test_shadows.js` S16.** The independent review found it at H0-5.
- It reads `const SERVE` from `server.js`, which is now in `server/static.js`.
- S16 was already failing at the parent: it expects `index.html` to load the retired `shadows-2d.js`. So its result is unchanged, and only its message differs.
- It was not adapted. The suite gives 43/48 on both the parent and the final tree, with the same five failures (`evidence/h0-5/final_tree/test_shadows_*.log`).

**Security.** Pre-existing weaknesses were found at H0-0 and H0-4. They are reported to you privately, in a file delivered with this package and kept out of the repository, which is public. 3H0 changes no security behavior, and no fix was made without your approval.

## Known gaps and caveats

- **Software rendering only.** Every browser run used SwiftShader in headless Chromium, so no frame rate here is a GPU frame rate. Your real-GPU check is part of the human QA.
- **Fonts.** Screenshots use fallback fonts: the test machine cannot reach Google Fonts.
- **Deployment.** `node server.js` now needs the `server/` folder next to it.
  - The Bloom host pulls `main`, which would bring the folder, but 3H0 does not touch `main`.
  - When this is merged, check on the first deploy that the server starts. A missing folder fails loudly, at start-up.
- **Local paths in the evidence.** Some evidence files record the build machine's folders and session scratch paths, as earlier stages' evidence does. They contain no secrets.
- **The secret scan.** Before the final commit, `dev/stage-3h0/secret_scan_h0.py` read every file 3H0 added or changed. It looked for:
  - the server's default admin passcode and its hash;
  - credential shapes;
  - e-mail addresses;
  - public IP addresses;
  - personal home folders.

  It found nothing (`evidence/h0-6/secret_scan.json`). Its self-test plants 21 such items in memory and finds all 21. The tools and evidence use only synthetic passcodes, the loopback address and the documentation address ranges.
- **The independent review's other notes were corrected at H0-5:**
  - stale comments in `assets/net-wire.js`, `mp.js` and `server/static.js` (comment-only; the gate was re-run);
  - the static module's factory being called `createStatic` in the documents, though it is anonymous in the code.

## Deliverables

**The package:**
- `THE_FAR_BACKROOMS_STAGE_3H0_SAFE_ARCHITECTURE_HUMAN_QA.zip`, with its `.sha256`;
- `STAGE_3H0_PACKAGE_RECEIPT.txt`: the ZIP's CRCs, a file-by-file Git match, the commit, tree and checkpoints, the GitHub check and the scope.

**In the repository and the ZIP:**
- `STAGE_3H0_REPORT.md` (this file), `STAGE_3H0_HUMAN_QA.md`, `STAGE_3H0_PERFORMANCE.md`, `STAGE_3H0_CHANGED_FILES.txt`;
- `3H0_Q0_AUDIT.md`, `3H0_MP_OWNERSHIP_MAP.md`, `3H0_SERVER_OWNERSHIP_MAP.md`, `3H0_MP_API_LOCK.md`, `3H0_SERVER_API_LOCK.md`, `3H0_PROTOCOL_INVENTORY.md`;
- `3H0_H0_1_BASELINE.md`, `3H0_EQUIVALENCE_REPORT.md`, `3H0_ARCHITECTURE_MAP.md`, `3H0_DEFERRED_FULL_3H.md`, `3H0_FUTURE_LEVEL_AUTHORING_SEAMS.md`;
- `dev/stage-3h0/`: every tool, the golden-trace runner and fixtures, the baselines and the evidence of every checkpoint. Its `README.md` is the index.

**Outside the repository:** `3H0_PRIVATE_SECURITY_FINDINGS.md`, for you only.

STAGE 3H0 SAFE ARCHITECTURE HUMAN-QA CANDIDATE — WAITING FOR USER
