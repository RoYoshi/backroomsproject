# dev/stage-3h0: Stage 3H0 tools and evidence (development only)

Nothing here is served to browsers or loaded by the game. The server's allowlist does not reach `dev/`.

## Checkpoint tools

| File | Purpose |
|---|---|
| `verify_remote_h0.py LABEL --out FILE` | Verifies a pushed checkpoint independently. Checks: <br>- the remote tip via `git ls-remote` and the GitHub REST commit and branch; <br>- the tree and the parent; <br>- a straight line from the accepted QA2 commit `edd2af9`; <br>- every other remote branch is untouched. |
| `record_parent_h0.py PACK_DIR [QA2_ZIP] --out FILE` | H0-0's independent check of the accepted parent. |
| `protocol_contract.json` | The read-only wire contract: every compact key, in wire order, described. Test data only. |
| `scope_check.py [--out FILE]` | Every file changed since the parent is an approved extraction file, the one adapted test, the stage's tooling or a stage document; every line removed from `mp.js` / `server.js` reappears verbatim in the new files (five lines changed by design are listed); `index.html` gains exactly two lines. |
| `summarize_h05.py` | The final regression (H0-5) in one summary, each result next to what it is compared with (`evidence/h0-5/summary.json`). |
| `changed_files_h0.py [REV]` | Writes `STAGE_3H0_CHANGED_FILES.txt`. |
| `package_h0.py REPO COMMIT OUTDIR REMOTE_JSON NAME` | The human-QA ZIP of the final commit, its SHA-256 and the package receipt, checked from the extracted ZIP. |
| `secret_scan_h0.py [--rev REV] [--extra FILE] [--out FILE]` | Scans every file added or changed since the parent for secrets. Checks: <br>- the server's default admin passcode (read at run time, never written) and its hash; <br>- literal strings from a file kept outside the repository; <br>- credential shapes, e-mail addresses, public IP addresses, personal home folders; <br>- a file named private. <br>Every match is masked in the output. A self-test first plants 21 items in memory, and each must be found. |
| `doc_sizes_h0.py [--rev REV]` | Checks the file sizes the stage documents give (the architecture map, the report, the changed-files list, the ownership maps) against the files, and those at the parent. Added at H0-6b. |

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
| `static_mutants.js` | Proves the start-up and HTTP scenarios notice small deliberate changes to `server/static.js`. A control run must not differ. With `--server-src` it checks a draft `server.js` before the real one is edited. |
| `compare_captures.py OLD NEW --out FILE [--sheet FILE] [--strip-prefix]` | Compares two folders of QA2-tool screenshots image by image, and draws an old / new / difference sheet. Reports; does not decide. |
| `summon_probe.js` | The real server, old against new code: the admin summons a Hound at the spawn point; the closest monster in 10 s, over many rounds (H0-5). |
| `srv_scenarios_summon.js`, `summon_seeds.js` | The same summon sequence in the closed world, for many seeds, old against new byte for byte (H0-5). `srv_harness.js` takes `--seed N` and `--scenarios FILE` for this; without them it behaves as before. |
| `live_kill_times.py` | Reads repeated `dev/tests/live.js` logs and compares how long its L5 check waited for the kill, per version (H0-4c). |
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
| `evidence/h0-4c/` | The static-serving extraction's receipt: the draft's check and mutants before `server.js` was touched, then the mutants, the gate, real sockets (A/A and old against new), the existing network suites, live, performance. `existing/live.log` keeps the one failed `live.js` run; `live_repeat/` and `live_ab3/` hold the 46 repeats that show its cause, summarized in `live_kill_times.json`. |
| `evidence/h0-5/` | The final regression on the final tree: the gate, the scope check, the existing suites (`existing/`), QA2's own final checks and the older probes' regression (`qa2/`), the menu and boot captures of the parent and the final tree with their comparison, live wire, real sockets and performance; `steps.txt` lists every step with its exit code, `summary.json` sums it up. `final_tree/` holds the checks re-run after the comment-only corrections. `qa2/rerun/`, `live_rerun/`, `summon/`, `summon_probe.json` and `perf_h0_server_r6.json` hold the investigations of the four first-run differences (`3H0_EQUIVALENCE_REPORT.md`, H0-5). |
| `evidence/h0-6/` | The checks made before the H0-6 commit, on the final tree (the production files have not changed since H0-5). They are: <br>- the gate; <br>- function equivalence of the four pure pieces and the static mutants; <br>- `interp_test.js`; <br>- real sockets; <br>- the scope check; <br>- the secret scan (`secret_scan.json`); <br>- the changed-files list. <br>`steps.txt` lists each with its exit code. The list and the scan ran three times and the scope check twice: the last runs came after H0-6's last document edits. |
| `evidence/h0-6b/` | The documents-only corrections made before packaging. It holds: <br>- `review_findings.md`: each point of the second independent review, and what was done about it; <br>- the check that the production files are unchanged since H0-5; <br>- the sizes the documents give, checked against the files (`doc_sizes.log`). `doc_sizes_at_h0-6.log` keeps the failing check of the H0-6 commit; <br>- the scope check; <br>- the secret scan; <br>- the changed-files list. <br>The list and the scan each ran twice, so that the second scan read the finished list. In both H0-6 folders, `production_unchanged_since_h0-5.log` is empty because `git diff` found no difference; its exit code, 0, is in `steps.txt`. |
| `evidence/remote/` | The independent remote verification of each pushed checkpoint (`verify_remote_h0.py`), H0-1 to H0-6. H0-0's is in `evidence/h0-0/`. H0-6b's can only be made after the final push, so it is in the package receipt. |
