# dev/tools/gate: the modernization gate

One command decides whether a checkpoint is still the accepted B++ game, on the modern layout:

```text
node dev/tools/gate/gate.js --tier fast --out <scratch>/gate        # a few minutes: every deterministic comparison
node dev/tools/gate/gate.js --tier full --out <scratch>/gate_full   # the final candidate: about 35 minutes on 2 CPUs
```

## How it decides

- **The reference is always the accepted B++ head** `143b63ff42b88c6780c5043e0f61d64100f81f40`, never the previous checkpoint.
- **The traces are compared with Stage 3H's stored B++ baselines,** byte for byte:
  - `dev/stage-3h/evidence/h1/golden/srv_traces` and `cli_traces`;
  - `dev/stage-3h/evidence/h2/golden/bpp_traces` and `cli_traces`.
- **A step passes only on its own positive evidence.** A step that compared nothing is a FAIL.

## What it is

It is Stage 3H2's gate (`dev/stage-3h/gate/h2_gate.js`), carried onto the new layout. The 3H2 gate and its tools are left as they are,
for the frozen layout.

| Step | Tool | What changed from 3H2 |
|---|---|---|
| build | `dev/tools/build/build.js --check` | It replaces the three `.sh` builds: every built output (`public/`, `generated/`) is what `src/` builds |
| lineage | `dev/tools/lineage/lineage.js verify` and `tree-id` | New at H3M-6: the client lineage replays (bundle, stylesheet, page), `blame.json` is current, and `src/core/client/bundle/original-v11/` is the recovered v11 snapshot |
| parts | `dev/tools/checks/parts.js` | New at H3M-3: every part of a built output declares what it provides, uses and writes in the shared closure, and TypeScript's checker agrees |
| modules | `dev/tools/checks/modules.js` | New at continuation C3: the module boundaries, proven from the code with TypeScript's checker. Every name a server file uses is its own, given to its factory, or the host's or the language's; no file reaches the global object; a factory never assigns a name it was given, and uses every one; a module of the sim keeps no state outside its factory (each room's world has its own); the sim's composition makes each module from modules made before it, and every name a module imports is one its giver returns. `dev/stage-3h-modernization/tools/c3_modules_mutants.js` proves it refuses each broken boundary Since C3b the page's module scripts too, as the build assembles them: nothing in a script's wrapper but the factories and the composition; no factory uses another's names; the composition's order and wiring; the headers' `imports` and `exports`; no write into another owner's state except through its function; one writer per entry of a public object; no call of a function a third module put on another's object; no global back-channel inside a script. `dev/stage-3h-modernization/tools/c3_modules_mutants.js` shows each of 20 breaks refused |
| docs | `dev/tools/docs/docs.js --check` | New at H3M-7: the documentation's generated tables (outputs, frameworks, each framework's files, the window globals) are what the repository gives today |
| scope | `scope_m.js` + `declared_changes.json` | It asks about content, not paths. Each file outside `dev/` must be one of: B++'s file, moved where the layout says; a declared change, with its reason; or a source, a build output or documentation. The deployment workflow and the passcode line are compared by hash. A declared change that did not happen fails |
| srv_golden, bpp_golden | `golden/srv_golden.js`, `golden/bpp_golden.js` (with `golden/srv_harness.js`) | **Old side:** B++'s `server.js` runs against the working tree's runtime written under its old names into a scratch folder (`dev/tools/layout.js` `projectOld`, with the layout's own path edit in `death_srv.js` undone). **New side:** the working tree's `server.js` runs in the working tree. As in 3H0, only `server.js`'s text differs. The harness records a require that resolves to the sim or the death module under its old name, so traces do not depend on where files live |
| session | `golden/bpp_golden.js --scenarios golden/srv_scenarios_session.js`, `golden/bpp_mutants.js --mutants golden/session_mutants.js` | New at continuation C2: the WebSocket session and the admin login (the login over time, the lockout per client identity, the identity's source, the connection's life, the room cap). B++'s `server.js` and this one give the same traces, both equal to the B++ traces stored at C2; 15 one-line session mutants are each caught |
| sim | `golden/sim_diff.js`, `golden/bpp_mutants.js --scenarios dev/stage-3h0/golden/srv_scenarios.js --mutants golden/sim_mutants.js`, `golden/sim_diff.js --mutants` | New at continuation C3a: the sim is modules. `sim_diff.js` gives this tree's sim (where the layout puts it) and B++'s `sim.js` the same calls, five seeds of 4,000 each (steps, moves, pick-ups, bodies, the lifecycle, every admin tool), and every result must be equal. Each of the seam mutants (an owner's control ignored, a getter read once, the reset's order, the roster copied ...) must be caught by Stage 3H0's server scenarios or by that differential run |
| page | `golden/world_diff.js`, `golden/page_scripts.js` (with `golden/page_env.js`, `golden/page_scenes.js`), `golden/page_scripts.js --mutants golden/page_mutants.js` | New at continuation C3b: `world.js`, `move.js`, `camcorder.js`, `glitch.js` and `ents.js` are modules, so their bytes changed on purpose and their behaviour is compared with B++'s. `world_diff.js` loads B++'s `world.js` and this tree's (the page's; the server's copy must be the same bytes) and gives every function the same arguments, Level 0 built with each. `page_scripts.js` loads B++'s and this tree's `move.js`, `camcorder.js`, `glitch.js`, `ents.js` into the same closed Chromium page (3H0's `cli_env.js`: a fake clock and timers, seeded randomness, a recording Web Audio; `page_env.js`: recording 2D canvases and Graphics, Level 0; B++'s `world.js` and `dphys.js`; the AI debug overlay's records made by B++'s own sim) and drives each the way the bundle and `mp.js` do (`page_scenes.js`): the traces (compared by digests of 2,000-line chunks), the page's elements and the errors must be equal, and V8's coverage must show the scene running every function of B++'s script but a listed few (dead code, a rare event), and as many of this tree's. Each of the 12 seam mutants (a module not made, the wrong giver, a late binding missed, a copy returned) must make one of them fail |
| cli_golden | `golden/cli_golden.js`, `golden/cli_golden_h2.js` (with `cli_lib.js`, `cli_lib_h2.js`) | Each side's files are read from its web root (`public/`) |
| protocol | `dev/stage-3h/gate/protocol_v2.js` | unchanged |
| mutants | `golden/bpp_mutants.js` | It mutates the server-side runtime where it now lives (the sim's modules, `src/frameworks/.../sim.*.js` since C3; `src/frameworks/.../newrun.js`), never the parts a built file is made from |
| static | `dev/stage-3e-0/static_check.js` | unchanged (it only talks HTTP) |
| raw_live | `golden/raw_live.js` | It reads a response's file from that side's web root. It also asks for the modern folders (`/src/`, `/generated/`, `/public/`, `/docs/`, `/dev/tools/`), each of which must answer as on B++ (404) |
| quick_suites, suites | `dev/stage-3h/gate/suites.js` | unchanged. The suites themselves now read runtime files through `dev/tools/layout.js` |
| cli_mutants | `golden/cli_golden_h2.js --mutants` | the layout-aware page runner |
| live_wire | `dev/stage-3h/golden/live_wire_h2.js` | unchanged (two complete game folders) |
| bpp_checks | `checks/proto_check.js`, `dev/stage-3e-0-bpp/place_replay.js`, `place_guard_check.js` | `proto_check` loads its own copy of the sim where the layout puts it |
| browsers, contact_lab | 3E-0, 3D-HQ2, HQ4 and HQ5 browser tools | They are given the candidate's `assets/` files where its layout keeps them. Since continuation C3b, `gameplay_smoke` is run once more when its server's log shows a death before the check's admin removed the monsters: its world is random, so a monster can kill the player first (seen once at C3a and once at C3b, on full gates; 10 of 10 runs OK on each tree otherwise), and such a run proves nothing either way. The step's note says when it happened; a second failure fails the step. Its walk after SPAWN can meet a wall next to the random spawn spot (seen once at C3b); that failure is not re-run: run the step again |
| perf | `golden/perf_det.js` | the old and new sides as in srv_golden |

Every copy begins with a note that says what it changed from its original.

**The copies match the originals on the frozen layout.** Each copy was run on the frozen parent `22751bb`, and its trace is identical to
the original tool's. On this tree, the traces are identical to the stored B++ baselines (`dev/stage-3h-modernization/evidence/`).

## What it cannot see

Stage 3H2's limits still apply (`dev/stage-3h/gate/README.md`, "What the gate cannot see"):
- real-browser timing beyond structure;
- pixels outside the contact lab's frozen scenes;
- sound heard rather than traced.

The `page` step's canvases and Graphics record every call; they draw nothing that is looked at. Two scripts that make the same calls
draw the same picture, but what that picture looks like is the contact lab's (for its scenes) and Human QA's.

B++'s `place_replay.js` can fail one case by chance, in about 7 % of runs (3H finding F-036): a glitched wall drawn on its walk takes
its mover out of the level. A failing case that sent no stale pose, got no correction and whose track stops early is that case; run
the step again (`dev/stage-3h/gate/README.md`, "What the gate cannot see").

The perf step can also fail by chance on a small machine (M-021). With seven rounds, the tolerance can fall to its 5 % floor while
the two sides' medians differ by more than that, with nothing changed. Do not relax the rule. Measure first:
`node dev/stage-3h-modernization/tools/m1_perf_paired.js --work <empty scratch folder> --scenario <the failing one>`. It runs 30
interleaved rounds on four sides and reports the paired change. Then re-run the step (`--only perf`), and report both runs.
