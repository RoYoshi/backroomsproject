# Parity: what proves the game is unchanged

Stage 3H's rule: **the engine may change, the experience may not.** This page says, for each part of the experience, which machine
check shows it is unchanged, and what no machine check here can judge. The second list is Human QA's.

The references are the accepted B++ head `143b63ff42b88c6780c5043e0f61d64100f81f40` and the frozen Stage 3H2 `22751bbc39c91f3e54e3305638b2ef2c9dd12c68`.
Every step that compares behaviour (the traces, the protocol, the mutants, HTTP, the live wire, the browsers, the pixels, the suites,
performance) compares against B++, never against the previous checkpoint. Byte identity is checked against 3H2.

## Two facts carry most of the weight

1. **The browser gets the same bytes.**
   - Every file under `public/` is byte-identical to the frozen 3H2's file at the same URL: 48 files, 36 built and 12 static. So are
     the server's four built files (`node dev/stage-3h-modernization/tools/m8_served_identity.js`).
   - Four of those files differ from B++'s, all because of 3H2: it moved code out of `mp.js` into `assets/net-newrun.js` and
     `assets/mp-hum.js`, and `index.html` loads them. The page traces, the page mutants and the real-browser checks below cover that
     change.
   - Everything else is B++'s own bytes: the compiled bundle, its stylesheet, the images and the sounds.
2. **The server gives the same answers.**
   - The world it runs is byte-identical to 3H2's (above).
   - `server.js` was split into modules with every moved line verbatim (the M2 move proof).
   - In 18 scripted scenarios, B++'s `server.js` and this one, run on the same files, send the same bytes. Both equal B++'s stored
     traces, except for 10 lines of `http_base`: the responses that carry `index.html` and `mp.js`, the two served files 3H2 changed.
     Those responses' bodies are checked against the files themselves.

So for players, the code can only behave differently through what the server sends and when: those are the traces and the
performance step. Or it can differ through what no check here reaches: a real network, other browsers, phones, ears and eyes.

## The proofs

| Proof | What it compares | Gate step |
|---|---|---|
| Built bytes | Every output is what `src/` builds. Every served file and the server's built files are compared with 3H2's: by `m1_relocate.js --verify` at M1-P, M1-R, M3 and M7, and by `m8_served_identity.js` at M8. Those two run at checkpoints, not in the gate | `build` |
| Lineage | The bundle, its stylesheet and `index.html` replay from the recovered v11 build through every recorded step, checked by SHA-256 | `lineage` |
| Parts | Every part's header (provides, uses, writes) agrees with the code, by TypeScript's checker | `parts` |
| Scope | Every file outside `dev/` is B++'s, moved; or a declared change; or a source, an output or a document. The deploy workflow and the passcode line are compared by hash | `scope` |
| Server traces | B++'s `server.js` and this one, on the same runtime files, with a fake clock, fake sockets and seeded randomness. Every byte sent is compared, both to each other and to the stored baselines (the one allowed difference from the baselines: `http_base`'s 10 lines about the two files 3H2 changed). 3H0's 11 scenarios: `boot`, `http_base`, `http_h0`, `ws_upgrade`, `ws_frames`, `lifecycle`, `deaths`, `admin`, `schedule`, `p_fields`, `exit_glitch`. 3H's 7: `bpp_caps_q`, `bpp_place_guard`, `bpp_world_guard`, `bpp_known_limits`, `bpp_new_run`, `bpp_new_run_held`, `bpp_aftermath` | `srv_golden`, `bpp_golden` |
| Page traces | `mp.js` and its helpers in a real Chromium with a fake clock and seeded randomness: B++'s against this one, and both against the baselines. Recorded: every message sent, every Web Audio node and parameter change, every listener, and every call `mp.js` makes into the other scripts and the bundle (recording stand-ins). 3H0's 9 scenes: `load`, `menu_online`, `run_online`, `interp`, `fx_bodies`, `facade`, `admin`, `reconnect_solo`, `hum_dread`. 3H2's 3: `nr_answers`, `nr_reconnect`, `hum_fixtures` | `cli_golden` |
| Protocol | Every message in those traces against the B++ protocol contract v2 (52,740 messages) | `protocol` |
| Mutants | 18 one-line server changes and 22 page changes, each applied where the code now lives. Each must change a golden, which proves the goldens still see that code | `mutants`, `cli_mutants` |
| HTTP | Real HTTP and raw TCP against B++'s server: every response, the allowlist, blocked paths, gzip, caching, WebSocket checks. The new folders (`/src/`, `/generated/`, `/public/`, `/docs/`, `/dev/tools/`) must answer 404, as on B++ | `static`, `raw_live` |
| Live wire | Two real Chromium players in one room, through the game's own buttons, on B++ and on this tree. Every WebSocket frame is recorded and compared by structure per phase | `live_wire` |
| B++'s own checks | `proto_check.js`, `place_replay.js` (22 placements), `place_guard_check.js` | `bpp_checks` |
| Real browsers | Ordinary players, real keyboards, the server checking every step. `two_browser.py`: what one page shows of another player who walks into it, sprints, turns, crouches, slides, reloads, and of a world reset, with B+'s 40 Hz poses. `col_browser.py`: two players meeting head-on and side by side. `gameplay_smoke.py`: walking, turning, the light, frame intervals, NEW RUN | `browsers` |
| Pixels | BR-RoLE's contact lab on B++ and on this tree: 23 images of the geometry, lights and peers scenes, identical pixel for pixel | `contact_lab` |
| Suites | The existing scenario suites, with every failure checked against B++'s own record: `npm test` (14 files: perception, Hound, Smiler, capture, system, admin, commit, navigation, chase, audit, evidence, IR, Hound 2E, shared), `s_humanqa_hotfix`, `test_shadows`, `test_br_role`, `interp_test`, `test_3bn`, `audit_net`, `audit_net2`, `ir_net` | `quick_suites`, `suites` |
| Performance | B++'s code against this one, interleaved, 7 rounds, with 3H0's A/A rule. Server: CPU time of the `lifecycle`, `deaths`, `admin` and `schedule` scenarios; the tolerance is the larger of the old side's spread and 5 % of its median. Page: `mp.js`'s frame hook and message handler in 5 scenes (`menu_online`, `run_online`, `interp`, `fx_bodies`, `hum_dread`), with a 10 % floor | `perf` |

The fast tier takes about 2 minutes: built bytes, lineage, parts, the documentation's tables, scope, the server and page traces, protocol, the server mutants, HTTP
and the quick suites. The full tier adds the page mutants, the live wire, B++'s own checks, the real browsers, the pixels, all the
suites and performance (about 35 minutes on 2 CPUs). `dev/tools/gate/README.md` has the details.

## The matrix

The "Same bytes" column compares with the frozen 3H2's files: the page's scripts and assets, the built server world and the server
modules. "Moved" means the code now lives in another file with its lines unchanged (the M2 move proof).

| Area | Where it runs now | Same bytes | Server traces | Page traces | Real browsers, pixels, suites | Left for a person |
|---|---|---|---|---|---|---|
| Moving: walk, run, crouch, crawl, slide, vault, stamina; walls and props | page `move.js`, `world.js`; server `movement.js` (`mvCheck`), `sim.movement.js` | page scripts and `world.js` yes; `mvCheck` moved | `lifecycle` (accepted, cut short, corrected), `p_fields` (movement reports), `bpp_known_limits`; mutants `guard_off`, `grace_1000` | `run_online` (`tp`) | `browsers` (walking, sprinting, sliding, collisions); `npm test` | the feel with your own keys, mouse and touch |
| Placement: join, respawn, world reset | server: the world's `join` and `respawn` (`sim.players.js`), then `placeFree` and the placement guard (`movement.js`) | sim yes; `placeFree` and the guard moved | `lifecycle`, `bpp_place_guard`, `bpp_world_guard` | `run_online` | `place_replay`, `place_guard` as on B++ | — |
| NEW RUN: the request, the server's decision, the 30 s wait, UNLIMITED, the blast, the run menu | page `mp.net.js`, `mp.newrun.js`, `assets/net-newrun.js`; server `newrun.js`, `sim.players.js` (`nrWhy`), `aftermath.js` (`boomStart`) | yes (`newrun.js` and `aftermath.js` as in 3H2) | `bpp_new_run`, `bpp_new_run_held`, `lifecycle`; mutants `nr_gap_200`, `nr_wait_round`, `nr_no_memory`, `nr_free_off`, `nr_held_free` | `nr_answers`, `nr_reconnect`; 11 page mutants (3 of them in `assets/net-newrun.js`) | `live_wire`: approved, refused with its words, UNLIMITED, END; gameplay smoke | the beat and the blast as seen |
| Deaths: the kill, the victim's death, the spectators' replays | server `ai.capture.js`, `rooms.js` (`onDeath`), `aftermath.js`; page `mp.owndeath.js`, `mp.replays.js`, `ents.death.js`, the bundle | yes; `onDeath` moved | `deaths`, `bpp_aftermath` | `run_online` (the server's kill), `fx_bodies`, `facade` | `npm test` (capture, system) | how each of the eight deaths looks |
| Gibs, blood, corpses, `BODY_TTL` | `dphys.js` (the same file on both sides), `death_srv.js`, `gore.js`, `sim.bodies.js`, `mp.bodies.js` | yes, but `death_srv.js`'s path to `dphys.js` (M1) | `deaths`, `bpp_aftermath` (a late joiner's bodies, with their ages) | `fx_bodies` | `perf` `deaths` | blood and decals on walls and floors |
| Hounds and Smilers: senses, memory, decisions, movement, captures | server `ai.js` (10 N.A.N.I. parts), `sim.ai.js`, `sim.feed.js`, `sim.step.js`; page `ents.js` (drawing), `mp.monsters.js` | yes | `lifecycle` and `admin` (the entities in every snapshot, the AI's debug data, the navigation commands), `deaths` (the real kill path), `bpp_new_run_held` (a Hound's capture) | `run_online` (entities, capture phases) | `npm test` (perception, Hound, Smiler, navigation, chase, evidence) | whether a chase feels as it did |
| Lighting and shadows: BR-RoLE, flashlight, lamps, corner receivers, NV and IR | page `br-role.js`, `light.js`, `camcorder.js`, the bundle (lineage B10, B11, B28 to B30), `level0_visuals.js`, `l0-remaster.js` | yes | `p_fields` (light kinds, infrared) | `menu_online`, `run_online` (other players' lights) | `contact_lab` 23 images; gameplay smoke (the light); `test_shadows`, `test_br_role`, `s_ir`, `ir_net` | scenes beyond the lab's: night vision, blackouts, many lights |
| Light timing: blackouts, flickering fixtures, ballast dips, dying lights | server sim (the world's events); page `world.lamps.js`, `level0_visuals.js`, `mp-hum.js`, `dphys.js` | yes | `schedule` | `run_online` (blackout), `hum_dread`, `hum_fixtures`; 11 page mutants in `mp-hum.js` | — | the rhythm as seen and heard |
| Sound: the hum, the dread, entities, deaths, the menu's music | page: Spacious Audio's 7 files; `public/sounds/`, `public/assets/*.wav` | yes, code and sound files | — | `hum_dread`, `hum_fixtures`, `run_online` (every Web Audio call, on a fake audio context) | — | **the sound as heard**: no check here listens |
| Other players: poses, interpolation, looks, gear, the 40 Hz fresher poses | page `mp.peers.js`, `mp.wanderers.js`, `assets/net-interp.js`, `assets/net-wire.js`; server `poses.js`, the snapshot | page yes; `poses.js` moved | `bpp_caps_q`; mutant `q_self` | `interp`, `menu_online`, `run_online` | `two_browser`; `live_wire` (who saw whom); `interp_test` | smoothness over a real network |
| Protocol and authority: messages, fields, frames, the room cap | `server.js` (the session), `ws.js`, `fields.js`, `rooms.js` | the session's lines unchanged; `ws.js`, `fields.js` as in 3H2; `rooms.js` moved | `ws_upgrade`, `ws_frames`, `p_fields`, and every message checked by `protocol` | every frame sent and received | `raw_live` (WebSocket checks); `proto_check`; `audit_net`, `audit_net2` | real latency and loss |
| Timing: the 25 ms tick, 60 Hz steps, snapshots every 50 ms, admin data 5 times a second | `loop.js`, `sim.step.js` | `loop.js` moved | `schedule` (regular wakes, stalls, the 0.25 s cap, the 15-step limit, every cadence), `boot` | `interp` (a server clock that steps back or leaps) | `perf` | — |
| Camera: how much of the world each screen shows | page `camera_policy.js`, `timing_policy.js`, the bundle | yes | — | — | `test_3bn` (both policies served byte for byte, read by the bundle, never more than the 1536 × 864 world) | other screen sizes and ratios |
| Menus, HUD, settings, inventory, the cartograph | page `ui.js`, `hud.js`, `index.html`, `ui.css`, `inventory.js`, `mp.cartograph.js`, `credits_data.js` | yes | `lifecycle`, `admin` (`pick`) | `run_online` (items, pickup), `reconnect_solo` (the offline cartograph) | `live_wire` (the game's own buttons) | settings kept after a reload; the credits; **the mobile thumbstick and the installed app**: no check here runs a phone |
| Admin: passcode, lockout, commands, the panel, the death lab, debug | `server.js` (passcode, check, lockout: unchanged), `admin.js`, `sim.admin.js`; page `mp.admin.js`, `mp.deathlab.js`, `ents.debug.js` | yes; commands moved | `admin` (authentication and every command); `exit_glitch` | `admin` (every tab and button, the death lab, debug) | `scope` (the passcode line, by hash); `npm test` (admin) | — |
| What is served: the allowlist, gzip, caching, the 404s | `static.js`, `public/` | the files yes; `static.js` differs by one comment; the web root is `public/` since M1 | `http_base` (every route, gzip, traversal, malformed escapes), `http_h0` | `load` | `static`, `raw_live` | the deployed host: production pulls `main` (not exercised here) |
| Performance | the server's steps and sends; the page's frames | page yes | `perf`: 4 scenarios | `perf`: 5 scenes | — | the frame rate on your machines and phones, with the GPU's drawing (not timed here); many players at once |

## Each modernization change, and its proof

| Checkpoint | What changed for developers | Why players cannot see it |
|---|---|---|
| M1-P, M1 (H3M-1) | Files moved: `public/` is the web root, sources under `src/`, built server files under `generated/`. Four kinds of path edit in 10 lines (the web root; the require of the built world; the server modules' requires; `death_srv.js`'s path to `dphys.js`), and one comment in `static.js`. Tests read files through `dev/tools/layout.js` | Every served file is byte-identical to 3H2's. HTTP and WebSocket answer as on B++ (`static`, `raw_live`, `http_base`). Full gate at M1: 16 of 17 steps passed at once; perf passed on its re-run (M-021) |
| M1-R, M6a (H3M-6) | The recovered v11 project is an input; the bundle and stylesheet are built by replaying the ledger | The build writes the same bytes (`build`, `lineage`); the snapshot is never served (404) |
| M2 (H3M-2) | `server.js` split into five modules | Every moved line is verbatim (move proof); server traces equal the B++ baselines; mutants applied in the modules are seen; full gate PASS, 18 of 18 steps |
| M3 (H3M-3 to H3M-5) | Multi-owner scripts split into owned parts with checked headers | Every built output is byte-identical (`build`, `parts`, `m1_relocate.js --verify`); fast gate and the real-browser step PASS |
| M7 (H3M-7) | Reports moved from the root to `dev/archive/`; documentation; the `docs` gate step | No runtime file changed (`scope`); fast gate PASS (`evidence/m7/`) |
| M8 (H3M-8) | The final gate, the package, the report, the Human QA page | No runtime file changed. The final full gate, on a clean clone of M7, passed 20 of 20 steps (`evidence/m8/`) |

The evidence for each checkpoint is in `dev/stage-3h-modernization/evidence/<checkpoint>/`, with the remote receipts in
`evidence/remote/`. `CHECKPOINTS.md` has one row per checkpoint, with its gate results and its rollback.

## Inherited, pinned, not fixed

The rule forbids fixing inherited bugs during modernization, so these stay as they are on B++. The gate checks that they stay that
way:
- **Suites that fail on B++ too.** The gate checks that only those cases fail: `npm test` 13, `s_humanqa_hotfix` X03, `test_shadows`
  5, `test_br_role` 3, `audit_net` 4, `audit_net2` 3.
- **The two caveats in B++'s report** (findings F-019 and F-020), pinned byte for byte by `bpp_known_limits`:
  - an admin's own GOTO followed by stale poses;
  - a BRING whose stale pose arrives after the grace.
- **`place_replay.js` can fail one case by chance** (F-036).
- **`perf` can fail by chance on a small machine** (M-021). The gate's README says how to tell noise from a slowdown.
- **The level is defined twice:** in `sim.level0.js` and in the bundle (M-003).
- **The carpet texture is the HAR recovery's placeholder** (M-013).

## Re-running the proof

```text
npm run build:check                                              # the built files are what src/ builds
node dev/tools/gate/gate.js --tier fast --out <scratch>/gate     # every deterministic comparison against B++
node dev/tools/gate/gate.js --tier full --out <scratch>/gate     # the final candidate's gate (needs Python 3 with playwright, pillow, numpy)
node dev/stage-3h-modernization/tools/m1_relocate.js --verify    # every served file against the frozen 3H2
```

The requirements are in [`docs/development/QUICKSTART.md`](../development/QUICKSTART.md).
