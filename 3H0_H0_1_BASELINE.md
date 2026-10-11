# Stage 3H0, checkpoint H0-1: golden traces and baselines (before any extraction)

**What this checkpoint is.** Everything below was built and run against the accepted parent `edd2af9` before a single production line moved. At this point the working tree's `mp.js` and `server.js` are the parent's, byte for byte.

**How later checkpoints use it.** Every later checkpoint re-runs the same tools on old code (the parent, taken from Git) and new code (the working tree), with the same inputs. The single command is `node dev/stage-3h0/golden/run_checkpoint.js LABEL`.

**Where things are:**
- Tools: `dev/stage-3h0/golden/`.
- The read-only protocol contract: `dev/stage-3h0/protocol_contract.json`.
- Evidence: `dev/stage-3h0/evidence/h0-1/`.

## 1. Results at a glance

| Layer | What it compares | Result on the parent |
|---|---|---|
| Server golden traces | `server.js` in a closed world: fake clock, timers, sockets and HTTP; seeded randomness and simulation. 10 scenarios, byte for byte | deterministic: 3 separate processes per scenario, identical |
| Client golden traces | `mp.js` in a real Chromium page with a fake clock, fake WebSocket, fake audio and recording game stubs. 9 scenes, byte for byte | deterministic: 3 runs per scene, identical |
| Harness sensitivity | deliberate one-line changes ("mutants") to the parent's files | server: 37 of 37 caught; client: 35 of 35 caught (plus one change per side that no input can reveal, listed in 6.3) |
| Protocol contract | every message in the traces against `protocol_contract.json` | 11,554 server messages (all 13 types) and 912 client messages (all 10 types); 0 violations |
| Function equivalence | an extracted helper against the parent's text, on generated inputs | A/A run on the parent: identical (wire codec 7 × 20,000 cases; interpolation 16,000 steps) |
| Live wire | the real `server.js` and the real game, two players, played through the game's buttons | A/A: structurally identical in every phase, 0 page errors |
| Performance | the parent against itself (A/A), interleaved | deterministic workloads A/A: within the rule (server ±5 %, client ±11 %); real stack: calibrated (see 6.2) |
| Existing suites | the repository's own tests | network and serving suites all pass (live 17/17, audit_net 17/17, audit_net2 11/11, ir_net 4/4, test_3bn 7/7, interp 3/3); simulation suite 151/162 (11 historical failures, sim untouched) |

## 2. The server harness (`srv_harness.js`, `srv_scenarios.js`, `srv_golden.js`)

**How it runs `server.js`.** The source is run as if it were `GAME_DIR/server.js`, so the parent's text and the working tree's text see exactly the same `sim.js`, `death_srv.js` and assets. Around it:
- **Time:** `Date.now` is a fake clock; `process.hrtime.bigint` advances 1 ms per call.
- **Timers:** `setTimeout` / `setInterval` fire in due order, ties in creation order. Like Node, an overdue interval fires once, late, after a stall.
- **Randomness:** `Math.random` is seeded; `crypto.randomBytes` (the simulation's seed) is a fixed sequence.
- **Network:**
  - HTTP requests and upgrades use fake request, response and socket objects;
  - a socket ended or destroyed is closed (with an `error` first if it was written after its end), the way Node's network layer would.
- **The simulation:** the real `sim.js`, wrapped so that every call `server.js` makes into it, and into `sim.admin`, is recorded with its arguments and result. Steps are counted per wake.

**What the trace records:**
- every socket write, decoded into frames;
- HTTP status, header list (in order) and body SHA-256;
- console lines;
- timers;
- simulation calls;
- the order of the pre-existing `require()`s.

Requires of modules that did not exist at the parent are recorded on the side, so an extraction shows there without changing the behavior trace.

**Scenarios and coverage.** All 13 server→client message types, all 10 client→server types, and all 4 HTTP status paths are exercised.

| Scenario | Covers | Lines |
|---|---|---:|
| `boot` | requires, server creation, the 25 ms interval, listen, the start-up line | 19 |
| `http_base` | 85 requests: every allowlisted file, with and without gzip (also `GZIP`, `x-gzip`); 404s for server code, `dev/`, `.git`, dot-files and future server modules; traversal (`..`, `%2e%2e`, `%2f`); the sounds folder (a list, files with spaces, non-audio files); 400s (`%`, broken UTF-8, NUL); HEAD / POST / DELETE | 267 |
| `ws_upgrade` | bad paths, missing key, room-name cleaning (empty, long, emoji, traversal-looking, dots), an existing room joined through a cleaned name, the 8-socket cap (the 9th destroyed, then accepted after one leaves), a room thrown away and made again | 624 |
| `ws_frames` | a frame delivered byte by byte, three frames in one chunk, 16-bit lengths, 1,399 vs 1,400 bytes, ping with and without payload, pong / binary / continuation (ignored), a non-final frame, bad JSON / `null` / arrays / strings / numbers, a zero mask, unmasked frames, a 64-bit length (destroyed), a close frame followed by data, a 65,535-byte frame in two parts with another client's frame in between | 1,120 |
| `lifecycle` | menu packets (inactive), join, the spawn packet, walking, a 2,000 px jump and its correction, throttled packets, refused respawn and leave, a burst move at the budget's edge, NEW RUN (vanish), its 30 s cooldown, the Vanish corpse, leave after a finished vanish, join again, a refused join, pick, disconnects, an empty room thrown away | 11,113 |
| `deaths` | real kills through the admin death preview: the server's own replay and corpse (victim silent), the victim's own replay and corpse (relayed, no fallback), revive by another admin, malformed corpse reports, a death right after a vanish (replay inside the fx cooldown), a victim who disconnects at once; two real Hound kills of bystanders | 51,957 |
| `admin` | wrong passcodes, the lockout and its expiry, quiet unlock, all 24 commands with valid and invalid arguments, debug data, ping / pong throttling, broadcast (trim, cut, empty), kick (message, close frame after 150 ms, socket end), non-admin commands ignored | 17,264 |
| `schedule` | regular wakes, stalls of 400 ms and 1 s (the 0.25 s cap and the 15-step limit), 30 ms / 13 ms / 7 ms stalls; snapshot, admin and debug cadence | 1,165 |
| `p_fields` | every `p` field valid and invalid: null / text / huge numbers, legacy light kinds, infrared on and off the camcorder, a missing light flag, looks, parts, colours, names, fall values, movement reports, angles, packets 29 / 30 / 31 ms apart; fx from the menu | 1,026 |
| `exit_glitch` | an admin steps onto a glitched wall: `exit` at the next snapshot tick, its rounding | 703 |

**Determinism.** Every scenario ran on the parent's text and on the working tree's text (identical at H0-1), plus a repeat, each in its own process. All three were identical for all 10 scenarios.

**The baseline.** The traces are stored gzipped with their SHA-256 in `evidence/h0-1/srv_traces/` (about 1 MB).

## 3. The client harness (`cli_env.js`, `cli_stubs.js`, `cli_scenes.js`, `cli_lib.js`, `cli_golden.js`)

**How it runs `mp.js`.** `mp.js` runs in a real Chromium page (Playwright), in the order `index.html` uses: the environment, the stubs, `world.js`, any helper scripts the tree's `index.html` loads between `glitch.js` and `mp.js`, then `mp.js`. Around it:
- **Time:** `performance.now`, `Date` and timers are fake.
- **Randomness:** `Math.random` is seeded.
- **Network:** WebSocket is a recorder that the scene opens, feeds and closes.
- **Audio:** AudioContext records every node, connection, parameter change and start/stop.
- **The game around it:** `window.__api` (installed by each scene, as the bundle does after mp.js), `__ents`, `__mv`, `__cam`, `__sfx`, `__inv` and the glitch hooks are deterministic recorders.
- **The page:** every `addEventListener` and `MutationObserver.observe` is recorded.

**What the trace records:**
- every send, every call into the game and ents stubs, every change mp.js makes to game objects;
- the DOM effects every frame (dread, shake, flicker, badge, tooltip, note);
- a digest of mp.js's shared globals whenever it changes (`__kill`, `__killer`, glitches, items, peer lights, hidden bodies, replays, Hound slots, `__dlab`, capture state, admin panel, kick box, banner);
- the page state after load and at the end (globals, `__net` members, DOM, localStorage, `__NET`, timers).

Scenes drive mp.js only through what reaches it in the game: WebSocket events, the `__net` facade, the per-frame hook, keyboard and pointer events, clicks on its own admin panel.

| Scene | Covers | Entries |
|---|---|---:|
| `load` | what mp.js does by itself: DOM, listeners, observer, three intervals, the WebSocket URL (with an encoded room name), then 2.6 s of its own timers | 20 |
| `menu_online` | `p` every 250 ms without movement reports, the badge singular and plural, peers (looks, gear, parts, falling in, a peer with no look, a 420 px jump), entities, entity sounds (valid and malformed), failing lamps, hover by mouse and not by touch | 1,785 |
| `run_online` | join (and the replayed join on open), `p` every 50 ms with movement reports, entities and the `G` mirror, blackout, glitched walls, the cartograph just outside and inside reach, `pick`, `got`, `tp`, `revive`, banner, `pong`, capture phases down / crawl / release, the server's kill (`mk`), `tick()`, respawn, `exit`, the dread layer near monsters | 7,137 |
| `interp` | exact arrival times with jitter, a late packet, a repeat and a reordered snapshot, a gap (extrapolation then hold), 299.5 / 300.5 / 514 px steps, clock steps back of 0.3 s and 1 s, a 40 s leap, entities that leave and are pruned 5 s later, snapshots without a clock, close and reopen | 11,481 |
| `fx_bodies` | replays (Hound with a wall, a repeat with `srv`, Smiler, vanish, our own id ignored), their end, corpse records with and without hands, 3- and 5-value hands, invalid and 3-digit colours, a camcorder corpse, older clients' backpacks, lights left by corpses, dead / falling / camcorder / unknown-kind peers | 22,761 |
| `facade` | `deathStart` (with and without a wall, exhausted at 21.5 stamina), `vanish`, `bodyMade` (hands, trail, killer end, NaN killer, no death record, Vanish), `respawn`, `leave`, `testAuth` and its replay, `fx`, `peerScreen`, `tick` (Hound and Smiler kills, paused), `exitLocal`; calls before the game API exists | 1,176 |
| `admin` | Backquote, wrong / locked / correct passcodes (button and Enter), every tab and every command button (112 presses), confirmations, the death lab, place, navigation selection, debug mode with its ping, copy report, broadcast (button and Enter), dock, preview with auto-revive and return, replay, Escape, kick (no reconnect after) | 1,328 |
| `reconnect_solo` | never connected (SOLO), back-off 1 / 2 / 3 s, the offline glitched walls drawn 12 times, the offline cartograph and exit, admin passcode kept and test passcode replayed, a dropped connection (cleanup, RECONNECTING), reconnect into a running game | 737 |
| `hum_dread` | the synthesized hum (ordinary, a flickering fixture, ballast dips, blackout drop-out and strike, a user-supplied hum), the dread drone, heartbeat, shake, flicker, sting (sound file or noise), the capture burst, sound switched off | 4,875 |

**Determinism and the baseline.** Three runs per scene were identical. The baseline is stored gzipped in `evidence/h0-1/cli_traces/` (about 0.45 MB).

**Globals added on purpose.** These are listed in `golden/declared_new_globals.json` (empty at H0-1). They are kept out of the strict trace and reported separately. Any other new or missing global fails.

## 4. Protocol contract (`protocol_contract.json`, `contract_check.js`)

**What it is.** A read-only JSON file mapping every compact key to a description, in wire order, with optional fields marked. Neither the game nor the server reads it.

**How it is checked.** `contract_check.js` reads every message the server sent and every message mp.js sent in the traces. For each one it checks:
- the type is listed;
- every required field is there;
- there are no unknown fields;
- the order matches;
- the snapshot peer and entity blocks match too.

**The result.** 11,554 server→client messages and 912 client→server messages were checked, covering all 23 types, with 0 violations.

## 5. Function equivalence (`fn_equiv.js`)

**How the old and new sides are made:**
- **Old:** the helper's functions, cut out of the parent's `mp.js` by their own text, as `dev/tests/interp_test.js` already does.
- **New:** the extracted file, evaluated against the same `window` and `performance`.

**The inputs.** Generated, and fed to both sides: valid, malformed, missing, wrong types, a missing or partial game API.

**The comparison.** A canonical form that distinguishes key order, `undefined`, `null`, `NaN`, `-0` and prototypes, with exceptions compared by type and message.

**What it covers:**
- **The wire codec:**
  - `parseLook`, `partObj`, `partList`, `toRec`;
  - the look encoder at all three of its inline call sites;
  - 20,000 cases each.
- **Interpolation:** 40 streams of 400 operations each (snapshots with jumps, steps back and leaps, missing clocks, pose queries, resets). After every operation it compares every pose, `NET`'s whole state and the epoch callback count.

The A/A run on the parent is identical, which shows the tool is deterministic. It becomes the per-extraction receipt at H0-2 and H0-3.

## 6. Live wire, performance, existing suites

### 6.1 Live wire (`live_wire.js`)

**The session.** The real `node server.js` and the real game in Chromium (software rendering), two players in one room, played through the game's own buttons:
1. menu;
2. setup (the admin removes monsters and makes both players gods, so no unscripted kill can differ between runs);
3. B enters, A enters;
4. NEW RUN, SPAWN;
5. a second NEW RUN inside the 30 s cooldown;
6. END, then A enters again;
7. an admin death preview, then RESPAWN;
8. the server goes down and comes back.

Every WebSocket frame on both pages is recorded through CDP.

**Comparison rules, fixed here before any extraction:**
- **Exact counts:** the session messages (`join`, `leave`, `respawn`, `admin`, `a`, `kick`, `revive`, `exit`) must match in number.
- **Presence only:** other event types.
- **Key sets ignore fields whose presence is a timing race:** `s.mk`, `s.ad`, `s.you`, `s.dbg` and `s.dx` (which wake a snapshot lands on), and `fx.srv` (whether the victim's own replay beat the server's 1.5 s fallback under software rendering).
- **Not compared:** `tp` counts.
- **Who sees whom** in peer lists is compared per phase, with each phase's own ids.

**A/A result (parent against itself).** The parent served from a `git archive` export against the working tree (identical code at H0-1): **structurally identical in every phase**, with 7,092 and 7,239 frames on the two runs and no page error on either. Two earlier A/A attempts are what fixed the rules above: one let a real Hound kill the observer in one run only, and one labelled peers with the wrong ids across the server restart. Neither was a code difference.

**What it shows as current behavior** (recorded, not changed):
- the menu visitor is never in anyone's peer list;
- exactly one `join` per ENTER or SPAWN;
- NEW RUN sends the Vanish corpse, the `vanish` fx and, 2.7 s later, `leave`.

**The known, deferred NEW RUN mismatch.** When the second NEW RUN comes inside the 30 s cooldown:
1. the server refuses the vanish, so nothing is relayed;
2. it then refuses the `leave`;
3. the player keeps standing in the world as a peer for the others while their own screen is in the menu;
4. their next ENTER is refused with a `tp`.

### 6.2 Performance (`perf_h0.js`)

**Server measurements.** The server is driven by Node WebSocket clients walking near the spawn point:
- `play8`: 8 players in one room, 20 s;
- `debug4`: 4 players plus an admin with AI debug on, 15 s.

Measured: the server process's CPU time per second and the snapshot bytes and count per client per second.

**Client measurements.** The real game: the time per call of mp.js's per-frame hook and of its WebSocket message handler, in the menu (5 s) and in a run (6 s). They are read by a wrapper installed before mp.js, which changes nothing in mp.js.

**The pass rule, fixed here before any extraction:**
- **Rounds:** A and B alternate (A, B, A, B, …), 3 rounds.
- **Tolerance:** max(A's own spread across rounds, a floor). The floor is 5 % of A's median for server CPU and 10 % for client timings (software rendering is noisy).
- **Pass:** B passes when its median is at most A's median plus the tolerance.
- **Bytes:** compared both ways, with a 2 % floor.

**A/A result (parent against itself).** **The first rule fails on identical code.** With identical code on both sides, the first rule above (a 5 % floor for server CPU) **failed**: `debug4` measured +7.8 % (A 51.3, B 55.3 ms of CPU per second), and `play8` +10.1 % sat just inside its spread. The snapshot bytes differed by up to 9 %, because they follow the AI's state, which real timing changes. The client's per-call means, at 15-25 frames a phase under software rendering, differed by up to 40 %.
- That failing run is kept as evidence (`perf_aa.json`).

**The rule this calibration fixed, before any extraction:**
- **Real stack (`perf_h0.js`):** server CPU is gated with a 15 % floor; bytes and the client timings are reported only. Re-scored, the A/A passes (`perf_aa_rescored.json`).
- **The precise gate is a new tool, `perf_det.js`:** the deterministic workloads, timed with the real clock. On the server, CPU time around the `lifecycle`, `deaths`, `admin` and `schedule` scenarios. On the client, the real time inside mp.js's per-frame hook and message handler during `menu_online`, `run_online`, `interp`, `fx_bodies` and `hum_dread`.
  - Its rounds alternate old and new, 7 rounds.
  - Its tolerance is max(old's spread, 5 % of old's median) on the server, and 10 % on the client.
  - Its A/A passes: server within ±4.6 %, client hook within ±11 %. The handler figures are small totals (0.3-12 ms per scene) measured in 0.1 ms steps.

### 6.3 Changes no input can reveal (found while proving the harnesses can see changes)

**`server.js`: the 90-character cut on admin answers.** It never takes effect: the longest answer any command can produce is under 50 characters.

**`mp.js`: the 400 px "snap instead of glide" test for peers.** It has no effect. The very next statement, `Object.assign(o, p, …)`, copies the peer's `x` and `y` anyway.
- So the drawn peer is placed exactly at its snapshot position, and the per-frame glide toward `tx` / `ty` never moves it.
- Peers therefore move in 50 ms steps between snapshots, without smoothing. Entities are interpolated; peers are not.

Both are recorded as findings. Neither is changed.

### 6.4 Existing suites, run on the parent

| Suite | What it covers | Result |
|---|---|---|
| `dev/tests/interp_test.js` | the snapshot interpolation, cut from mp.js by its text | 3/3 |
| `dev/stage-3b-n/test_3bn.js` | every script `index.html` loads is served; server and dev files never are; camera and timing policies | 7/7 |
| `dev/tests/live.js` | the real server over WebSockets: what the browser may fetch, shared entities, fake entities, deaths, bodies and admin refused, the kill flow, `BODY_TTL`, no AI internals on the wire | 17/17 |
| `dev/tests/audit_net.js` | malformed URLs, the respawn lifecycle, movement validation, admin moves, death aftermath on disconnect | 17/17 |
| `dev/tests/audit_net2.js` | the lifecycle exploits (a capture cannot be escaped), sub-pixel wall steps, noise reports, deaths recorded at commit | 11/11 |
| `dev/tests/ir_net.js` | infrared on the wire: relayed only for a raised camcorder, clamped, never a light to the AI | 4/4 |
| `npm test` (`dev/tests/run.js`, 14 simulation files) | sim.js and ai.js (not touched by 3H0) | 151/162; the 11 failures are historical gates documented since Stage 2F (P01, P08, H07, NV09, C1, C3, C4, C5, C9/C10, C18, 2F F22). The same 11 are expected at H0-5, because the simulation is not touched. |

**Browser regression on this exact code.** The QA2 regression harness, camera fairness and BR-RoLE ran on this same code at QA2 R3 (`dev/stage-3c-qa2/evidence/r3/`). They are re-run on the candidate at H0-5 and compared with those results.

## 7. What these layers do not cover (limitations)

- **The harnesses see behavior at their boundaries.**
  - The server harness does not exercise Node's own socket and HTTP serialization; a separate raw-HTTP comparison is done at H0-4, when serving moves.
  - The client harness replaces the game bundle, Pixi, `ents.js` and the other scripts with recorders. It proves mp.js asks the same things of them, not that they draw the same.
- **The simulation is seeded and stepped on a fake clock.** Real-time effects (packet timing, event-loop jitter) are covered only by the live layer, structurally.
- **The live layer is one scripted session on software rendering.** It is a smoke test of the real stack, not a statistical study.
- **Performance figures** come from this 2-CPU machine with SwiftShader, and are comparisons only.
- **Not exercised:** real GPUs, real networks, other browsers, phones (touch is in the H0-5 regression, through the QA2 probes).
