# Stage 3H recommendations

**What this is.** Improvements suggested by Stage 3H's findings (`3H_FINDINGS.md`). **None is authorized by Stage 3H1, and none was done.**

**What may happen where:**
- **Development-only items** may be done inside Stage 3H once the user authorizes the step.
- **Anything that changes what players see, hear or do** is not a refactor. It needs its own authorization, a playable build and the user's Human QA, outside the behaviour-preserving 3H steps.

**Classes:**

| Class | Meaning |
|---|---|
| **DEV** | Changes only `dev/`; cannot affect the game |
| **REFACTOR** | Changes runtime files with identical behaviour; a 3H checkpoint |
| **CHANGE** | Changes behaviour; a separate, authorized stage |
| **USER** | The user's decision (assets, security, publication) |

| ID | Recommendation | Class | From | Suggested home |
|---|---|---|---|---|
| R-001 | H2-0: one development gate for B++ | DEV | F-001, F-003, F-021, F-030 | Stage 3H, first |
| R-002 | A B++ protocol contract (v2), written on purpose | DEV | F-003 | H2-0 |
| R-003 | Working B++ copies of the live harnesses that fail loudly | DEV | F-021 | H2-0 |
| R-004 | Serve `.wav` as audio, without on-request gzip | CHANGE (delivery) | F-013, F-015 | optimisation or delivery stage |
| R-005 | Put the dread drone, thumps and burst under the master volume | CHANGE (audio) | F-008 | Stage 3F |
| R-006 | Decide on the duplicate `sting copy.mp3` | USER | F-014 | the user |
| R-007 | Guard an admin's own placements as other placements are | CHANGE (B++) | F-019 | B++ correction, if wanted |
| R-008 | Tie the placement guard to an acknowledgement, not a time window | CHANGE (B++ protocol) | F-020 | B++ correction, only if the wider QA shows it |
| R-009 | Bound the admin's debug snapshot, and count dropped messages | CHANGE (admin) | F-009 | OVERSEER or B++ stage |
| R-010 | Fix the death lab's glitched-wall test (`g[0]`, `g[1]`) | CHANGE (admin) | F-016 | OVERSEER stage |
| R-011 | A player-facing frame-rate / network display, opt-in and off by default | CHANGE (feature) | F-028 | a later feature milestone |
| R-012 | Per-floor-material blood, and audio follow-ups | CHANGE (visual, audio) | F-022 | Stage 3F or a later G.I.B. stage |
| R-013 | Rename the lagging version labels | CHANGE (visible string) | F-024 | with the next authorized visible change |
| R-014 | Retire `assets/shadows-2d.js` from the tree, with its test | USER + CHANGE (served set) | F-004 | release hygiene |
| R-015 | One source for the Level 0 map | CHANGE (both sides) | F-002, F-007 | a L.O.S.T. stage |
| R-016 | Test hygiene: passcodes from the environment; stale expectations decided | DEV + USER | F-017, F-025 | H2-0 or a test-hygiene step |
| R-017 | Move old root reports into `dev/devlog4dev/` only by a hash-preserving, reversible migration | DEV | pack file 07 | H5, after a path-consumer audit |
| R-018 | Decide the private security items; then a bounded security stage | USER | F-027 | the user |
| R-019 | Remove dead lines only inside a step that already touches them | REFACTOR | F-011, F-012, F-018, F-029 | any authorized 3H step |

## Details

### R-001: H2-0, one development gate for B++ (DEV)

**What.** A single command under `dev/stage-3h/` that a runtime checkpoint must pass. It runs:
- `srv_golden` and `cli_golden` against the B++ baselines in `dev/stage-3h/evidence/h1/golden/`;
- the five B++ goldens and their mutants (`bpp_golden.js`, `bpp_mutants.js`);
- the B++ contract v2 (R-002);
- `h1_build_check.js` and `h1_scope_check.py`;
- the static check;
- `perf_det` A/B with the A/A rule of `3H_PERFORMANCE_BASELINE.md`.

**Why.** The comparison tools exist, but today a person must know which ones still work on B++ (F-021), which contract is current (F-003) and which scenes are noisy (F-030). One gate makes each runtime step's evidence the same and repeatable.

**Risk.** None for the game.

### R-002: a B++ protocol contract (v2) (DEV)

Write it from `evidence/h1/wire_keys.json` and the code, as a new file under `dev/stage-3h/`, with a checker that reads the same traces. 3H0's contract stays as its own historical record.

### R-003: working B++ copies of the live harnesses (DEV)

**`raw_live.js`.** Its copy of the tree must include `server/`, and it must exit non-zero when a side fails to start.

**`live_wire.js`.** It needs HQ2's NEW RUN flow instead of the END button, and a time limit on every step. Put both as 3H copies; 3H0's tools stay as they were.

### R-004: serve `.wav` as audio, without on-request gzip (CHANGE: delivery)

**What.** Add `audio/wav` for `.wav` in `server/static.js`, and leave WAVs out of the gzip path, which saves only 2 to 3 % (F-013).

**Why.** It removes a 0.26 s and a 0.43 s pause of every room after each restart, and about 22 MB of server memory.

**Not a refactor.** It changes the bytes and headers on the wire, though not the files. So it needs its own authorization and a check that the menu theme still loads and plays exactly as before (`assets/ui.js` checks sizes and stalls).

### R-005: put mp.js's dread audio under the master volume (CHANGE: audio)

Route the drone, thumps and capture burst through the game's master level (`0.14 × __vol`), or through the same `__vol`, so the volume setting affects them like every other sound (F-008).

This changes what players hear, so it belongs to Stage 3F, which owns atmosphere and audio.

### R-006: the duplicate `sting copy.mp3` (USER)

It is a user-supplied asset. If it is not wanted, removing it saves a 113 KB download and decode per load, with no audible change (F-014).

### R-007: guard an admin's own placements (CHANGE: B++)

Apply B++-0's stale-pose rule to an admin's own server-side placements (GOTO and the other self-moves) as well, so other players do not see the admin flick back (F-019).

**Risk.** The death lab moves the admin from its own page (`A.tp`), so the rule must not refuse those. Only if the user wants it, as a B++ correction with its own QA.

### R-008: a placement acknowledgement instead of a time window (CHANGE: B++ protocol)

**What.** Number each placement (`tp`), have the client echo the number it has applied, and ignore poses that predate it, however late they arrive (F-020).

**When.** It is a protocol change with old-client compatibility to keep. Consider it only if the wider B++ QA shows snap-backs on lagging connections.

### R-009: bound the admin's debug snapshot (CHANGE: admin)

**What.** Cap or page the `dbg` list, or send it in its own message, and count messages `send` drops for size.

**Why.** Today a frame of 64 KiB or more disappears without a trace, and the debug snapshot is at half that with 21 entities (F-009).

### R-010: the death lab's glitched-wall test (CHANGE: admin)

**What.** In `findSpot`, read the glitched wall as `g[0]`, `g[1]` (F-016).

**Effect.** Admin-only, but visible: the lab would stop placing admins next to glitched walls.

### R-011: a player-facing frame-rate / network display (CHANGE: feature)

**Rules for it:**
- opt-in and off by default, so the default game is unchanged;
- its own setting saved with the others (`fb_settings_v1`);
- its own Human QA.

It is a new UI feature, not a refactor (pack file 03; F-028). P.U.L.S.E.'s existing counters (`room.pf`, `__peerNet`, `ping` / `pong`) are its data.

### R-012: per-floor-material blood, and audio follow-ups (CHANGE: visual, audio)

**Blood.** Floor blood could follow the floor (carpet, damp, concrete) as footsteps already do (F-022).

**Audio.** Any material-dependent audio for falls, deaths or blood belongs with Stage 3F.

### R-013: rename the lagging version labels (CHANGE: visible string)

`br-role 1.2-candidate` → `br-role 1.2`, and `assets/ui.js`'s `stage-3c-qa2`, with the next authorized visible change. Update `test_br_role.js` U01 with it (F-024).

### R-014: retire `assets/shadows-2d.js` (USER + CHANGE: served set)

If the user agrees, remove the unused file and update `test_shadows.js` S16, which still expects it (F-004).

### R-015: one source for the Level 0 map (CHANGE: both sides)

A level format (L.O.S.T.) would generate the bundle's and `sim.js`'s copies from one file.

**Not in Stage 3H:**
- the bundle cannot be rebuilt (F-002);
- any byte change touches both the server and the client (F-007).

### R-016: test hygiene (DEV + USER)

**Passcodes.** Read the admin passcode only from the environment in the 25 development scripts listed in F-025, so none depends on the server's built-in default.

**Stale expectations.** Decide with the user whether each historical failure is a stale expectation to update or a real gap to keep visible (F-017). Example: `test_br_role` U26 still expects the hands in the cast that HQ4 removed.

### R-017: old root reports into `dev/devlog4dev/` (DEV)

Some root reports are cited by path and hash in earlier checkpoints. Move them only after an audit of who reads each path, with a reversible, hash-preserving migration (pack file 07). New findings already go to `dev/devlog4dev/`.

### R-018: the private security items (USER)

The user decides on the items reported privately (F-027). Any change to authentication, admission or what is served belongs to a bounded security stage with its own review. It is never a side effect of a refactor.

### R-019: dead lines, only in passing (REFACTOR)

**Which lines:**
- the 400 px snap (`mp.js` line 214);
- the 90-character cut (`server.js` line 259);
- the unreachable `__net.collected` (bundle);
- `TOUCH` (`glitch.js` line 10);
- the misplaced comment (`server.js` line 115).

**How.** They cost nothing today. Remove or move one only inside an authorized step that already changes those lines, so no accepted file changes for this alone (F-011, F-012, F-018, F-029).

## Stage 3H2 status

| Recommendation | Status after 3H2 |
|---|---|
| R-001 (one development gate) | done: `dev/stage-3h/gate/h2_gate.js`, against the original B++ at every checkpoint. On this 2-CPU machine the fast tier takes about 2 minutes and the full tier about 37 (the final run). One B++ check inside it can fail by chance (F-036) |
| R-002 (protocol contract v2) | done: `gate/protocol_v2.js`, `gate/protocol_bpp.json` (derived from the B++ traces, both directions) |
| R-003 (working live harnesses) | done: `golden/raw_live_h2.js`, `golden/live_wire_h2.js`, each proven by broken copies |
| R-016 (test hygiene) | in part: the suites' known B++ failures are a classification (`gate/known_failures_bpp.json`); the text-reading tests are run in the fast tier; stale expectations still the user's decision |
| R-019 (dead lines and stray comments only inside a step that touches them) | F-029's comment moved back above `moveTo` in C-2; F-011, F-012, F-018 untouched (no 3H2 step touched those lines) |
| all others | unchanged |
