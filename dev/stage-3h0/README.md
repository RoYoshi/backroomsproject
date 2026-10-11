# dev/stage-3h0: Stage 3H0 tools and evidence (development only)

Nothing here is served to browsers or loaded by the game. The server's allowlist does not reach `dev/`.

## Checkpoint tools

| File | Purpose |
|---|---|
| `verify_remote_h0.py LABEL --out FILE` | Verifies a pushed checkpoint independently. Checks: <br>- the remote tip via `git ls-remote` and the GitHub REST commit and branch; <br>- the tree and the parent; <br>- a straight line from the accepted QA2 commit `edd2af9`; <br>- every other remote branch is untouched. |
| `record_parent_h0.py PACK_DIR [QA2_ZIP] --out FILE` | H0-0's independent check of the accepted parent. |
| `protocol_contract.json` | The read-only wire contract: every compact key, in wire order, described. Test data only. |

## Golden traces and equivalence (`golden/`, H0-1 onward)

| File | Purpose |
|---|---|
| `srv_harness.js`, `srv_scenarios.js` | Run a `server.js` source in a closed world: <br>- fake clock and timers, seeded randomness and simulation; <br>- fake sockets and HTTP. <br>The scenarios drive it. Each run writes a byte-exact trace. |
| `srv_golden.js` | The parent's `server.js` and the working tree's, on the same inputs, byte for byte. Can also compare against or write the H0-1 baseline. |
| `srv_mutants.js` | Proves the server harness sees small deliberate changes to the parent's file. |
| `cli_env.js`, `cli_stubs.js`, `cli_scenes.js`, `cli_lib.js` | Run `mp.js` in a real Chromium page: <br>- fake clock, WebSocket and audio; <br>- recording stand-ins for the game. <br>The scenes drive it. |
| `cli_golden.js` | The parent's `mp.js` and the working tree's `mp.js` (with its helper scripts), byte for byte. Can also compare against or write the baseline. |
| `cli_mutants.js` | Proves the client harness sees small deliberate changes. |
| `declared_new_globals.json` | Globals an approved extraction adds on purpose. They are reported separately, never hidden. |
| `contract_check.js` | Every traced message against `protocol_contract.json`. |
| `fn_equiv.js` | Function-level equivalence of an extracted helper against the parent's own text, on generated inputs. |
| `fn_mutants.js` | Proves `fn_equiv.js` catches wrong versions of an extracted file. |
| `live_wire.js` | The real server and the real game, two players, every frame recorded. A structural comparison per phase. |
| `perf_det.js` | CPU and time on the deterministic workloads, old against new, interleaved. This is the precise performance gate. |
| `perf_h0.js` | The real stack's server CPU (gated) and bytes and client timings (reported), A/B interleaved. |
| `raw_live.js` | The parent's `server.js` and the working tree's, each started with `node server.js PORT` on the same files, spoken to with raw sockets: the start-up line, 108 HTTP exchanges byte for byte (except `Date`), 25 WebSocket checks. `--aa` runs the parent on both sides. |
| `run_checkpoint.js LABEL` | The gate at every later checkpoint: server and client traces, old against new and against the baseline, plus the contract check. |
| `collect_h0_1.sh PARENT_EXPORT` | Ran every H0-1 baseline. |

## Evidence

| Folder | Contents |
|---|---|
| `evidence/h0-0/` | The remote heads before 3H0, the parent verification, the H0-0 remote verification. |
| `evidence/h0-1/` | The baselines (`srv_traces/`, `cli_traces/`) and the reports of every H0-1 step (`steps.txt` lists them with exit codes). It also keeps the existing suites' logs, and the failing first performance rule with its rescoring. |
| `evidence/h0-1b/` | The client baseline, rebuilt from the parent's code after the H0-2 harness fix. Its `README.md` says why. |
| `evidence/h0-2/` | The wire-codec extraction's receipt: function equivalence and its mutants, the gate (traces, contract), live, performance, serving tests. `attempt1/` keeps the first, failing gate run. |
| `evidence/h0-3/` | The interpolation extraction's receipt: `interp_test.js` before and after the move, function equivalence (with its A/A run) and its mutants (`fn_mutants_interp_attempt1.json` keeps the first run, which missed 2 of 8), the gate, live, performance. |
| `evidence/h0-4a/` | The WebSocket framing extraction's receipt: the checks of the draft before `server.js` was touched, then function equivalence and its mutants, the gate, real sockets (`raw_live_aa_attempt1.json` keeps the first A/A run, which differed), the existing network suites (`existing/`, `steps.txt`), live, performance. |
| `evidence/h0-4b/` | The field-check extraction's receipt: the A/A run and the checks of the draft before `server.js` was touched, then function equivalence and its mutants, the gate, real sockets, the existing network suites, live, performance. |
| `evidence/remote/` | The independent remote verification of each pushed checkpoint (`verify_remote_h0.py`). |
