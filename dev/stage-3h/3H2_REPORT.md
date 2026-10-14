# Stage 3H2 report: the continuous implementation on the accepted B++ game

**STAGE 3H CANDIDATE — HUMAN QA PENDING.** Claude has not accepted it and cannot: acceptance is the user's Human QA
(`3H2_HUMAN_QA.md`). Until then the accepted game is B++ `143b63f`, and the overlay's `REVERT_TO_BPP` restores it byte for byte.

**In one paragraph.** Under the user's continuous-implementation authorization, Stage 3H2 built one gate that compares every
checkpoint with the original B++ (H2-0). It then moved four pieces of code out of `server.js` and `mp.js` into four new files,
each line as it was:
- C-1: NEW RUN's server decision;
- C-2: the death aftermath and the NEW RUN blast;
- C-3: NEW RUN's button and run-menu words;
- C-4: the fluorescent light hum.

Each move was preceded by a golden that pins what it moves, proven line by line, run through the gate against B++, pushed and verified
on GitHub, with its own rollback. Every other seam stays where it is, each for a stated reason (§4). No behaviour was changed, fixed,
tuned or redesigned.

## 1. The candidate

| | |
|---|---|
| Branch | `stage-3h` (no other branch touched; nothing merged; no force push) |
| Game files | those of **C-4 `859cf07cd60333b81b17a83a1e23bbfc3a8ea02b`**, tree `673e444d7d3f3a5c210c735c0731f457cd6be07c`, the last commit that changes a game file |
| Branch head | the commit that adds this report and its receipts (documents only; a commit cannot name its own hash, so its SHA and tree are given in the delivery message) |
| Reference | the accepted B++ `143b63ff42b88c6780c5043e0f61d64100f81f40`, tree `b25c26ec3eedab406a6b93f80a59ba6a1cb7c128`: every comparison is against it, never against the previous checkpoint |
| To play it | the overlay `STAGE3H_HUMAN_QA_OVERLAY.zip` over a B++ folder (§8), or `git checkout stage-3h`; then `ADMIN_PASSCODE=<your passcode> node server.js 8000` |

## 2. Checkpoints on `stage-3h`

Each checkpoint was pushed normally. After each push the remote branch was checked against the local commit and tree, the straight
line from B++, and every other branch (`tools/verify_remote_h1.py`; receipts in `evidence/h2/remote/`).

| Step | Commit | Tree | What | Game change |
|---|---|---|---|---|
| H2-0 | `3559e6539dcddb54ad038ec98ee6b848677f65a7` | `9d869dc7e62571e7b83343c0e1515f03876fa5ae` | one gate against B++; the comparison tools repaired | none |
| C-1 | `91a785f7019c5a01da7ac2916f7b87912de5894e` | `fc6d524d195a64627d192d3b33bce2f87153e9c9` | NEW RUN's decision → `server/newrun.js` | moved, unchanged |
| before C-2 | `122e8f18bb373a2c9b8006ae8276eb253df76427` | `ec1a0cc495472317c855513fb8232c93bc8b3de9` | the aftermath golden (`bpp_aftermath`), 8 mutants | none |
| C-2 | `eb782fda8e99b64e0c0492209fae5b5c958c6d29` | `f0619b6dabe9f373bee4ded7057dbf3376b5c45d` | the death aftermath and the NEW RUN blast → `server/aftermath.js` | moved, unchanged |
| before C-3 | `d24b64e39f1c47f07930fcd0001632e4b020abc3` | `3ef9b2da681fe93a74b4d675705feefb5b4bd49c` | the client NEW RUN golden (2 scenes), 11 mutants | none |
| C-3 | `3e140ef4afd58ae3a134071ab6e4d96d89bbaba9` | `1a39effd40bf40f89b76078c76ba52fca1a4ab06` | NEW RUN's button and run-menu words → `assets/net-newrun.js` | moved, unchanged |
| before C-4 | `d66b891d76b037b6162fc277ac54a127e232806b` | `a80c6295240e08c6c85a47fbba7080d631862bc5` | the hum golden (`hum_fixtures`), 11 more client mutants | none |
| C-4 | `859cf07cd60333b81b17a83a1e23bbfc3a8ea02b` | `673e444d7d3f3a5c210c735c0731f457cd6be07c` | the fluorescent hum → `assets/mp-hum.js` | moved, unchanged |
| final | this commit | — | this report, the Human QA page, the overlay's receipt, the final gate's reports, devlog4dev | none |

Each step's folder under `evidence/h2/` holds a `STEPS.txt` (what ran, in order, with the result) and, for C-1 to C-4, a
`ROLLBACK.md`.

## 3. Every production change

Outside `dev/`, exactly seven files differ from B++: three replaced and four new. The other 186 of B++'s 189 production files are
byte-identical, the media, the bundle `assets/index-DKbV5Nv9.js` and `favicon.ico` included. The 7,267 files under `dev/` outside
Stage 3H's two folders are also unchanged (the gate's `scope` step; `3H2_CHANGED_FILES.txt` lists every file 3H2 added or modified).

| File | Step | What | B++ lines | SHA-256 at the candidate |
|---|---|---|---|---|
| `server/newrun.js` (new) | C-1 | NEW RUN's decision: `NR_GAP`, `nrIntent` | `server.js` 204–211, 227–244 | `356c9e1f4d45d5de26be9510fdcf8df0a574a97f7dcb7206e5be0002195fb53e` |
| `server/aftermath.js` (new) | C-2 | the death aftermath (`aftStart`, `aftOf`, `aftSend`, `aftTick`), corpse ages (`bodyAt`, `putBody`), the NEW RUN blast (`boomStart`) | `server.js` 116–163, 182–185, 212–226 | `dd9f4555237dd0a1da696fb03bdf433b607ca2eddce767de4a04bb68e27b4586` |
| `server.js` | C-1, C-2 | the moved lines gone; two requires and two notes; one stray comment (3H1 F-029) moved back above `moveTo` | 469 → 385 lines | `dbabc050ebc2222f97ac073d931a40030809ad9567cce20a8165c664d19edefe` (B++ `0424cbc1…fb2d`) |
| `assets/net-newrun.js` (new) | C-3 | `nrButton` with its timer, `runMenuWords` | `mp.js` 85–90, 98–103 | `6775d5a18ae489f518c42a7eb3a698c152d1333da1e463044ae2bdbea23619a4` |
| `assets/mp-hum.js` (new) | C-4 | the fluorescent hum: `buildHum`, its crackle, thunk and strike sounds, its state, `humUpdate` | `mp.js` 887–984 | `7b5ae65f0370bcd39c42c9b7b24a6ffc8a9f82959ab0236fb54f68679906e791` |
| `mp.js` | C-3, C-4 | the moved lines gone; two lines read the helpers; `nrTold` left line 83; two notes | 1,044 → 940 lines | `9243aafb1e17a66d9ca03936c3e10b70341ec99732fafec588a44b0fe3075be4` (B++ `b338e5aa…4653`) |
| `index.html` | C-3, C-4 | two `<script>` tags right after `glitch.js` | 227 → 229 lines | `ca02fd163bee6c2f9460f7f4e2af0c9cfa90b01f28c2a3d2db5f427913c428cf` (B++ `ea756260…b5db6`) |

**How the moves were made.** Each move was made by a script that found every block by its B++ text and asserted it before cutting.
`tools/h2_move_proof.js` then proved each move against B++ line by line:

| File | Proof, cumulative since B++ |
|---|---|
| `server.js` | 26 + 67 lines moved verbatim, each range one unbroken block in its module; line 115 found exactly once, now above `moveTo`; every other line kept in order; 9 inserted |
| `mp.js` | 12 + 98 lines moved verbatim; line 83 edited (only `nrTold = 0, ` gone); every other line kept in order; 7 inserted |

**How the new files are built.**
- **The server modules** are factories, given what they use (`send`, `HEX`, `deathSrv`, `boomStart`) and requiring nothing. Loading
  one changes nothing a golden trace records: 3H0's harness lists the new requires apart.
- **The page helpers** are classic scripts registering one frozen object each on `window.__mpLib`, the namespace Stage 3H0's helpers
  already declared: no new global. They do nothing at load but define their functions.

`server/static.js`'s allowlist already serves `assets/*`, so the helpers are served, and it never serves `server/`. No other file was
needed.

## 4. Framework boundaries: extracted, and still conceptual

**Extracted in 3H2** (each a file with one owner and a stated interface):

| File | Framework | Owns | Interface | Read by |
|---|---|---|---|---|
| `server/newrun.js` | B++ (networking) | whether a NEW RUN press is approved | `nrIntent(room, me, m)`, `NR_GAP` | `server.js` (the `nr` message) |
| `server/aftermath.js` | G.I.B. (death, bodies) | each death's replay on the wire, late joiners' catch-up, corpse ages, the NEW RUN blast | `aftStart`, `aftOf`, `aftSend`, `aftTick`, `bodyAt`, `putBody`, `boomStart` | `server.js` (tick, revive, world reset), `server/newrun.js` (`boomStart`) |
| `assets/net-newrun.js` | F.R.O.N.T. (UI words) | what the NEW RUN button and the run menu say | `__mpLib.newrun`: `nrButton`, `runMenuWords` | `mp.js` |
| `assets/mp-hum.js` | Spacious Audio | the fluorescent light hum and its state | `__mpLib.hum`: `buildHum`, `humUpdate` | `mp.js` (the per-frame hook; `__net.testHum`) |

Stage 3H0 had already extracted five: `server/ws.js`, `server/fields.js`, `server/static.js` (B++), `assets/net-wire.js` and
`assets/net-interp.js` (B++).

**Still conceptual.** BR-R, L.O.S.T., P.U.L.S.E., OVERSEER, CASHIER, E.C.H.O. and the proposed names stay labels over code that is
shared, as in `3H1_FRAMEWORK_REGISTRY.md`. BR-RoLE and N.A.N.I. were already modules and were not touched.

**Left where they are, with the reason** (`../devlog4dev/3H_DEFERRED_WORK.md` §6):

| Seam | Why it stays |
|---|---|
| NEW RUN's client state (`worldW`, `nrBusy`, `nrSent`) | its readers include the world epoch and `solidNow` (solidity, locked): moving it means rewriting readers, not moving lines |
| Dread audio | it registers listeners at load; moving it changes the page's listener order; F-008 lives there (Stage 3F) |
| Movement and the placement guard | locked; the wider B++ QA is still pending |
| Sessions, the snapshot tick | locked (pose freshness, B+'s `q`, timing) |
| Admin commands and panel | security (the private items first); tests read their text |
| Client transport, peers, B+ | locked |
| Replays, dying lights, wall stains | coupled to the transport's state |
| The cartograph, glitched walls; `worldReset` | items are locked; `worldReset` is built on the movement code |

**A NO-GO seam that moved.** 3H1 classed the hum and dread audio as NO-GO ("audio is locked until 3F"). C-4 moved the hum under the
authorization's rule for such seams: proof first.
- A golden scene was added that reaches its flicker rule and crackle cadence (`hum_fixtures`). Two hum mutants that 3H0's scene missed
  are caught there; 11 hum mutants are caught in all.
- The move proof was run.
- An offline spectrum check was run in a real page: equal to B++ at 60, 120 and 240 Hz.

Nothing in the hum was retuned. **No one has listened to it.** Human QA step 6 is the first listening check.

## 5. Parity against the original B++

**The gate** (`gate/h2_gate.js`; how it works: `gate/README.md`) compares with B++ at every checkpoint. A step that compared nothing
fails.

**The final full gate on the candidate** (`evidence/h2/final/`; 37 minutes on a 2-CPU machine):

| Step | Compared | Result |
|---|---|---|
| build | `ai.js`, `ents.js`, `sim.js` rebuilt from their sources | byte-identical |
| scope | B++'s 189 production files | 186 identical; the 3 replaced and 4 added files all declared; the 7,267 `dev/` files outside 3H unchanged |
| srv_golden | 3H0's 11 server scenarios | identical to B++ run beside them and to the stored baseline |
| bpp_golden | 7 B++ scenarios | identical to the stored baseline |
| cli_golden | 9 + 3 client scenes | identical to B++ and to the stored baselines |
| protocol | 52,740 messages | every one matches the B++ contract v2; the checker's selftest passes |
| mutants | 18 server mutants | all caught; 11 of them now found in `server/newrun.js` or `server/aftermath.js` |
| static | 4 HTTP checks | as B++ |
| raw_live | 141 HTTP and WebSocket cases | identical; only the bytes of `index.html` and `mp.js` differ, as declared |
| quick_suites | 23 cases | only the known B++ failures |
| cli_mutants | 22 client mutants | all caught (3 in `assets/net-newrun.js`, 11 in `assets/mp-hum.js`) |
| live_wire | 65 phases, two real Chromium players | structurally identical to B++ |
| bpp_checks | 36 cases | **one case failed** (below); the step re-run alone: PASS, 36 as on B++ |
| browsers | 113 checks | two_browser, both collision cases and the gameplay smoke: ok |
| contact_lab | 23 images | identical in pixels |
| suites | 293 cases in 10 suites | only the known B++ failures |
| perf | 9 workloads | inside the tolerance (§7) |

**The one failure, explained (F-036).** One of `place_replay.js`'s 22 cases came out "not kept". It sent no stale pose, got no
correction and was never sent back: the server simply stopped listing the mover 0.5 s into its walk. The cause was found and
reproduced (`tools/h2_glitch_on_path.js`, `evidence/h2/final/f036/`):
- every room's world draws three glitched walls at random, and about 0.4 % of draws put one on that case's walk;
- touching it takes the mover out of the level;
- drawn there on purpose, the same case fails the same way on B++ and on the candidate.

No server file changed after C-2, whose run of this step passed, and the check runs no page code. Re-run alone, the step passed.

**Earlier checkpoints.** Each passed the fast tier against B++, then the live steps for what it touched:
- C-1: `live_wire`;
- C-2: `live_wire` and `bpp_checks`;
- C-3: `live_wire` and `browsers`;
- C-4: `cli_mutants`, `browsers`, and the offline hum check on a real page.

**Before each move, coverage first.** Three gaps were closed on B++'s own code before the code they pin was moved (F-033):
- NEW RUN's client words: no 3H0 client page had the NEW RUN button or the run menu;
- the hum's flicker rule and crackle cadence;
- most aftermath phases: a late joiner, a revive mid-death, a death dropped by a new world, one aftermath replacing another.

The golden baselines are locked by SHA-256. Each was recorded on B++'s own code (the B++ export, or B++'s files read from Git),
never on a moved version.

| What the goldens pin | Baseline | Mutants caught (every one) |
|---|---|---|
| 3H0's 11 server scenarios: every socket byte, HTTP response, timer, console line and sim call, closed world | `evidence/h1/golden/srv_traces` | — |
| 7 B++ scenarios: caps / `q`, the placement guard and its caveats, NEW RUN, NEW RUN while held, the aftermath in every phase | `evidence/h2/golden/bpp_traces` | 18 server mutants, found in whichever file now holds their text |
| 3H0's 9 client scenes and 3H2's 3 (NEW RUN ×2, the hum): every send, DOM change and draw call, fake clock | `evidence/h1/golden/cli_traces`, `evidence/h2/golden/cli_traces` | 22 client mutants (3 in `assets/net-newrun.js`, 11 in `assets/mp-hum.js`) |

## 6. Protocol and gameplay smoke

- **Protocol.** 52,740 messages from the golden traces, in both directions, match the B++ contract v2 exactly: JSON paths, value
  kinds and key orders for each message type (`gate/protocol_bpp.json`, derived from B++'s own traces).
- **Two real players, live** (`live_wire`). The players used the game's own buttons:
  - they joined;
  - NEW RUN was approved, then refused (`NEW RUN · WAIT N S`), then approved again with admin UNLIMITED;
  - END, a death and RESPAWN;
  - a server restart.

  Every phase was structurally identical to B++: the same message types and key sets, and the same counts of scripted events.
- **B++'s own real-server checks.** `proto_check` (8 checks, a death and a disconnect included), `place_replay` (22 placements; F-036)
  and `place_guard_check` (6), each judged against what it measured on B++ in 3H1.
- **Browsers** (SwiftShader).
  - `two_browser`: 98 checks of B+'s fresher poses on real pages.
  - The two collision cases: 5 and 5.
  - The gameplay smoke on two pages: a walk, a full turn, the light on and off, NEW RUN approved with its run menu, the other page
    seeing the six pieces and the hands, then a walk after SPAWN. No page error.
- **The overlay's own run** (§8). Two real pages on a B++ folder with the overlay copied in:
  - no page error;
  - the helpers registered and frozen;
  - the hum's offline spectrum equal to a B++ page's;
  - B+'s fresher poses;
  - the 545 px placement kept (B++-0);
  - NEW RUN approved and then refused, through the buttons.
- **Pixels.** The contact lab's 23 frozen scenes (geometry, lights, other players) are identical images.

## 7. Performance

**How it was measured** (`perf_det`, Stage 3H0's rule, fixed before any extraction): the same deterministic workloads run on B++'s
code and on the candidate's, alternating, 7 rounds each. A change passes when the candidate's median stays within the old side's own
spread between rounds (at least 5 % of its median on the server, 10 % on the client). All 9 passed.

**Server CPU per scenario** (ms, median of 7):

| Scenario | B++ | Candidate | Change | Tolerance |
|---|---|---|---|---|
| lifecycle | 1,336.0 | 1,306.0 | −2.25 % | 289.2 |
| deaths | 1,589.2 | 1,517.5 | −4.51 % | 100.0 |
| admin | 1,560.1 | 1,580.0 | +1.28 % | 203.5 |
| schedule | 443.5 | 456.1 | +2.85 % | 117.4 |

**Client time in `mp.js`'s per-frame hook and message handler**, summed over each scene (ms, median of 7):

| Scene | Hook, B++ → candidate | Handler, B++ → candidate |
|---|---|---|
| menu_online | 21.5 → 23.1 (+7.4 %) | 2.1 → 2.5 (+19 %) |
| run_online | 63.0 → 61.6 (−2.2 %) | 7.4 → 6.1 (−17.6 %) |
| interp | 75.5 → 72.7 (−3.7 %) | 6.3 → 6.4 (+1.6 %) |
| fx_bodies | 117.7 → 115.4 (−2.0 %) | 11.0 → 11.1 (+0.9 %) |
| hum_dread | 43.9 → 45.2 (+3.0 %) | 0.4 → 0.4 (0 %) |

**Reading.** Every difference is inside B++'s own spread between rounds. For example, B++'s seven rounds of menu_online's handler
ranged from 1.8 to 3.2 ms. The moved functions are the same code, now called through a name bound once at start-up, so the moves add
no work per frame. **No change is measurable, and none is claimed in either direction.** The client figures are time spent inside
`mp.js` in the harness page, not frame rates; no GPU was involved.

**Sizes and loads.**

| Side | B++ | Candidate | Difference |
|---|---|---|---|
| Page JavaScript (`mp.js`, plus the two helpers on the candidate) | 96,283 bytes | 99,812 bytes | +3,529 bytes (+3.7 %): the helpers' headers and the notes; the code is the same |
| `index.html` | — | — | +90 bytes |
| Requests per page load | — | — | two more, served `no-store` like every script |
| Server source read at start-up | 41,751 bytes | 46,658 bytes | two more `require`s; nothing per tick |

## 8. The overlay, rollback and SHA-256

**The overlay** is `STAGE3H_HUMAN_QA_OVERLAY.zip`: 137,405 bytes, SHA-256
`265c1e1842d2170a0301e114da7d7789d8aee3338a162e7ab1869f25b6d63265`. Its receipt is in `evidence/h2/final/overlay/`. It holds:
- `STAGE3H_OVERLAY/`: the candidate's seven game files, to copy over a B++ game folder;
- `REVERT_TO_BPP/`: B++'s `server.js`, `mp.js` and `index.html`. Copy them back and delete the four new files named in
  `WHERE_TO_COPY.txt`, and the folder is B++ byte for byte;
- `WHERE_TO_COPY.txt`;
- `HUMAN_QA.md`, which is `3H2_HUMAN_QA.md`;
- `OVERLAY_RECEIPT.txt`;
- `STAGE3H_SOURCE.diff`: `git diff 143b63f 859cf07` of the seven files.

**Validated from the ZIP itself**, on clean folders (`tools/h2_overlay.py`, OVERLAY CHECK: PASS):
1. the ZIP's CRCs and entries are good, and its game files are byte-identical to Git;
2. B++'s 55 runtime files are byte-identical to those of `d501afe`, the commit the delivered B++ overlay was built from (its receipt
   proved a folder made with it equal to `d501afe`). So a B++ folder made with that overlay is the B++ this one was tested over;
3. copied over a clean export of B++, 59 runtime files are byte-identical to the candidate's, and only the seven changed;
4. `REVERT_TO_BPP` copied back and the four new files deleted give B++ byte for byte. Before the deletions, only those four files
   differed, and nothing loads them;
5. the overlaid folder runs, as in §6.

| File in the ZIP | SHA-256 |
|---|---|
| `STAGE3H_OVERLAY/server.js` | `dbabc050ebc2222f97ac073d931a40030809ad9567cce20a8165c664d19edefe` |
| `STAGE3H_OVERLAY/server/newrun.js` | `356c9e1f4d45d5de26be9510fdcf8df0a574a97f7dcb7206e5be0002195fb53e` |
| `STAGE3H_OVERLAY/server/aftermath.js` | `dd9f4555237dd0a1da696fb03bdf433b607ca2eddce767de4a04bb68e27b4586` |
| `STAGE3H_OVERLAY/mp.js` | `9243aafb1e17a66d9ca03936c3e10b70341ec99732fafec588a44b0fe3075be4` |
| `STAGE3H_OVERLAY/index.html` | `ca02fd163bee6c2f9460f7f4e2af0c9cfa90b01f28c2a3d2db5f427913c428cf` |
| `STAGE3H_OVERLAY/assets/net-newrun.js` | `6775d5a18ae489f518c42a7eb3a698c152d1333da1e463044ae2bdbea23619a4` |
| `STAGE3H_OVERLAY/assets/mp-hum.js` | `7b5ae65f0370bcd39c42c9b7b24a6ffc8a9f82959ab0236fb54f68679906e791` |
| `REVERT_TO_BPP/server.js` | `0424cbc1942a301a3bca01f681f0618a090479815e131bb2e1ee2ea569d8fb2d` |
| `REVERT_TO_BPP/mp.js` | `b338e5aa87f37bd3a436d584233a6b9e0b554f118d8d99e316dfe7bee0494653` |
| `REVERT_TO_BPP/index.html` | `ea756260589054f9fd787c8c1037fb1a8123c174059ae660c100f8c5c76b5db6` |

**Or without the overlay:** `git checkout stage-3h`. Every later commit than `859cf07` adds documents only.

**Rollback, one step or all.** Each step's `ROLLBACK.md` (`evidence/h2/c1/` to `c4/`) gives the `git revert` of its commit, the files
to restore by hand and the SHA-256 to check afterwards.
- **The order of undo.** C-4 and C-3 are client-only and C-1 and C-2 server-only, so the two sides can be undone apart. Within a side,
  undo the later step first.
- **Keep files together.** `mp.js` must not run with an `index.html` that does not load its helpers, and `server.js` must not run
  without its modules (F-032).

| File | B++ | C-1 | C-2 | C-3 | C-4 (candidate) |
|---|---|---|---|---|---|
| `server.js` | `0424cbc1…fb2d` | `a7349908…fa11b` | `dbabc050…edefe` | = C-2 | = C-2 |
| `mp.js` | `b338e5aa…4653` | = B++ | = B++ | `5288f3e2…691e` | `9243aafb…75be4` |
| `index.html` | `ea756260…b5db6` | = B++ | = B++ | `5a14ab49…125b` | `ca02fd16…428cf` |

## 9. What the automated checks cannot see (QA limitations)

- **No real GPU.** Every browser ran headless Chromium with SwiftShader. BR-RoLE's pixels are compared only in the contact lab's frozen
  scenes (3H1 F-030); BR-RoLE's code is byte-identical to B++.
- **No audio was heard.** The hum and the dread layer were checked as code and as an offline rendered spectrum, not through speakers.
- **No real network.** Everything ran on one machine over loopback; no latency, loss, phone or second computer.
- **Live timing is compared by structure.** The two-browser comparison knows three timing races of B+ (F-031). Pose freshness and
  smoothing are pinned by the deterministic goldens and B++'s own checks, not by live timing.
- **A 2-CPU machine.** Under load, live phases slow down; the gate retries a live run once only on a tool error, never on a difference.
- **No long sessions.** No run lasted more than a few minutes; memory over hours was not measured.
- **The wider B++ QA.** The user's broader B++ multiplayer QA was still pending when 3H2 ran. No regression was reported during the
  run. A confirmed one would be fixed on B++'s own checkpoint, not inside 3H.

## 10. Findings and deferred risks

Recorded in `../devlog4dev/3H_FINDINGS.md`. **None was fixed:** F-008, F-013, F-019, F-020 and every other logged behaviour are exactly
as in B++.

**New in 3H2:**

| ID | Finding | Label |
|---|---|---|
| F-031 | The live two-browser comparison meets three B+ timing races; the tool knows them as rules | Limitation (tooling) |
| F-032 | A page needs `index.html`, `mp.js` and its helpers from one build | Limitation |
| F-033 | Three things no golden saw before 3H2: NEW RUN's client words, the hum's flicker rule and crackles, most aftermath phases. Closed before the code they pin moved | Limitation (closed) |
| F-034 | A corpse's age rule is invisible to the closed-world goldens | Limitation (tooling) |
| F-035 | The page accepts a NEW RUN answer for a press it has forgotten; the server never sends one | Confirmed (harness) |
| F-036 | B++'s placement replay can fail by chance when a glitched wall lies on its walk | Confirmed (reproduced) |

**Earlier findings that 3H2 acted on:**
- F-003: the protocol contract v2;
- F-021: the live harnesses repaired;
- F-023: the coverage gaps narrowed;
- F-029: the stray comment moved back, inside C-2;
- F-030: the contact lab keeps to its stable scenes.

**Security.** Nothing about admin authentication or its defaults changed. The private items stay with the user (F-027).

**Deferred.** See `../devlog4dev/3H_DEFERRED_WORK.md` (§5 the 3H2 steps, §6 the seams left) and the "Stage 3H2 status" in
`../devlog4dev/3H_RECOMMENDATIONS.md`. The risks to watch in Human QA:
1. **The hum** (C-4) is the one move inside a seam 3H1 called NO-GO. It is proven as code, but no one has listened to it.
2. **Mixed builds** (F-032). A page that loads a new `mp.js` with an old `index.html`, or a server copied without `server/`, would
   fail to start its multiplayer layer. Copy the overlay's seven files together.
3. **The live checks' blind spots.** The live comparison treats three B+ timing races as rules (F-031), and B++'s placement replay can
   fail by chance (F-036). A real regression in exactly those races would show only in the deterministic goldens, which pin them.

## 11. STOP

Stage 3H2 ends here. It made no change beyond the four verbatim moves, their goldens and the tooling. It touched no entity art, audio
tuning, items, balance, network design or level content.

**HUMAN QA PENDING:** the user decides with `3H2_HUMAN_QA.md`.
