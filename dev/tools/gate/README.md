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
| docs | `dev/tools/docs/docs.js --check` | New at H3M-7: the documentation's generated tables (outputs, frameworks, each framework's files, the window globals) are what the repository gives today |
| scope | `scope_m.js` + `declared_changes.json` | It asks about content, not paths. Each file outside `dev/` must be one of: B++'s file, moved where the layout says; a declared change, with its reason; or a source, a build output or documentation. The deployment workflow and the passcode line are compared by hash. A declared change that did not happen fails |
| srv_golden, bpp_golden | `golden/srv_golden.js`, `golden/bpp_golden.js` (with `golden/srv_harness.js`) | **Old side:** B++'s `server.js` runs against the working tree's runtime written under its old names into a scratch folder (`dev/tools/layout.js` `projectOld`, with the layout's own path edit in `death_srv.js` undone). **New side:** the working tree's `server.js` runs in the working tree. As in 3H0, only `server.js`'s text differs. The harness records a require that resolves to the sim or the death module under its old name, so traces do not depend on where files live |
| session | `golden/bpp_golden.js --scenarios golden/srv_scenarios_session.js`, `golden/bpp_mutants.js --mutants golden/session_mutants.js` | New at continuation C2: the WebSocket session and the admin login (the login over time, the lockout per client identity, the identity's source, the connection's life, the room cap). B++'s `server.js` and this one give the same traces, both equal to the B++ traces stored at C2; 15 one-line session mutants are each caught |
| cli_golden | `golden/cli_golden.js`, `golden/cli_golden_h2.js` (with `cli_lib.js`, `cli_lib_h2.js`) | Each side's files are read from its web root (`public/`) |
| protocol | `dev/stage-3h/gate/protocol_v2.js` | unchanged |
| mutants | `golden/bpp_mutants.js` | It mutates the server-side runtime where it now lives (`generated/server/sim.js`, `src/frameworks/.../newrun.js`), never the parts it is built from |
| static | `dev/stage-3e-0/static_check.js` | unchanged (it only talks HTTP) |
| raw_live | `golden/raw_live.js` | It reads a response's file from that side's web root. It also asks for the modern folders (`/src/`, `/generated/`, `/public/`, `/docs/`, `/dev/tools/`), each of which must answer as on B++ (404) |
| quick_suites, suites | `dev/stage-3h/gate/suites.js` | unchanged. The suites themselves now read runtime files through `dev/tools/layout.js` |
| cli_mutants | `golden/cli_golden_h2.js --mutants` | the layout-aware page runner |
| live_wire | `dev/stage-3h/golden/live_wire_h2.js` | unchanged (two complete game folders) |
| bpp_checks | `checks/proto_check.js`, `dev/stage-3e-0-bpp/place_replay.js`, `place_guard_check.js` | `proto_check` loads its own copy of the sim where the layout puts it |
| browsers, contact_lab | 3E-0, 3D-HQ2, HQ4 and HQ5 browser tools | They are given the candidate's `assets/` files where its layout keeps them |
| perf | `golden/perf_det.js` | the old and new sides as in srv_golden |

Every copy begins with a note that says what it changed from its original.

**The copies match the originals on the frozen layout.** Each copy was run on the frozen parent `22751bb`, and its trace is identical to
the original tool's. On this tree, the traces are identical to the stored B++ baselines (`dev/stage-3h-modernization/evidence/`).

## What it cannot see

Stage 3H2's limits still apply (`dev/stage-3h/gate/README.md`, "What the gate cannot see"):
- real-browser timing beyond structure;
- pixels outside the contact lab's frozen scenes;
- sound heard rather than traced.

B++'s `place_replay.js` can fail one case by chance, in about 7 % of runs (3H finding F-036): a glitched wall drawn on its walk takes
its mover out of the level. A failing case that sent no stale pose, got no correction and whose track stops early is that case; run
the step again (`dev/stage-3h/gate/README.md`, "What the gate cannot see").

The perf step can also fail by chance on a small machine (M-021). With seven rounds, the tolerance can fall to its 5 % floor while
the two sides' medians differ by more than that, with nothing changed. Do not relax the rule. Measure first:
`node dev/stage-3h-modernization/tools/m1_perf_paired.js --work <empty scratch folder> --scenario <the failing one>`. It runs 30
interleaved rounds on four sides and reports the paired change. Then re-run the step (`--only perf`), and report both runs.
