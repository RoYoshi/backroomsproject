# Stage A baseline tooling

Run from the extracted project root with Node (recorded v24.19.0), Python 3, Bash and a system zip reader. No npm dependencies are needed for these headless tools. Existing browser tools separately require Python Playwright and its browser installation.

```sh
node dev/stage_a/verify_stage_a.js
node dev/stage_a/verify_stage_a.js --regenerate
node dev/stage_a/contracts_test.js
node dev/stage_a/served_package.js . /tmp/stage-a-served.json
python3 dev/stage_a/run_baseline.py --out /tmp/tfb-baseline-results
```

The baseline runner records failures in JSON/logs and deliberately completes with exit 0 after gathering suites; its process exit is NOT an aggregate test pass. Read each result/exitCode/count. `--only live` selects one suite. A safety deadline is BLOCKED, never a pass. The verification tool's default mode validates immutable files, schemas, placeholder refusal, syntax, trace hashes and the diff negative control. `--regenerate` also runs all five capture tools in fresh processes and requires byte-identical traces. It checks child spawn errors separately from exit status. Local socket and subprocess-pipe restrictions may require execution in a permitted environment; missing capability is BLOCKED.

The served-package tool starts/stops the actual server on a free local port. Its exit 0 means **B-01 reproduced**, not a functioning hosted camera policy. It checks the four locked HTTP responses, malformed path 400, and immediate valid request 200. Stage B must deliberately update the expected policy-route responses when it fixes B-01.

Capture tools accept an optional output directory; omit it only when deliberately regenerating reviewed reference files:

```sh
node dev/stage_a/capture_motor.js /tmp/new-traces
node dev/stage_a/capture_ai.js /tmp/new-traces
node dev/stage_a/capture_death.js /tmp/new-traces
node dev/stage_a/capture_navigation.js /tmp/new-traces
node dev/stage_a/capture_network.js /tmp/new-traces
node dev/stage_a/diff_traces.js dev/stage_a/traces/motor-walk.json.gz /tmp/new-traces/motor-walk.json.gz
```

Same runtime/seed/input: tolerance 0 and byte-identical full trace are required. For a justified cross-engine short-fixture comparison, the diff tool accepts final argument `0.00001` (world-unit numeric tolerance); discrete state and event order still must agree. The generic numeric option also applies to other numeric fields, so do not use it to excuse tick/generation/state differences. Metadata differences are printed separately; they cannot justify overwriting reference records without review. Network quantization/presentation traces are explicitly distinct from full precision physics references. Trace indices carry compressed and uncompressed SHA-256.

Future entry points `s_world25d`, `s_nav25d`, `s_perception25d`, `physics25d`, `network25d`, `view25d`, `perf_world25d` live under dev/tests, exit 2 standalone, and report `ok:false` through the legacy runner. They are deliberately absent from the unchanged legacy default runner. This is NOT 32 passing tests.

Builds are unchanged:

```sh
bash dev/build_ai.sh
bash dev/build_sim.sh
bash dev/build_ents.sh
node server.js
```

`node redirect.js` remains the separate Render compatibility entry point. Never substitute it for the normal game server.
