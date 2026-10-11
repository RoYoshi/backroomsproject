#!/bin/bash
# Stage 3H0 H0-1: run every baseline on the accepted parent and store the evidence (development only).
#   bash dev/stage-3h0/golden/collect_h0_1.sh PARENT_EXPORT_DIR
# PARENT_EXPORT_DIR is `git archive edd2af9` unpacked (the live and performance A/A runs serve it beside the working tree, which at H0-1 holds
# the same code).  Each step has its own time limit and log; a failing step is recorded, not hidden.
set -u
cd "$(dirname "$0")/../../.."
BASE="$1"; EV=dev/stage-3h0/evidence/h0-1; mkdir -p "$EV/existing"
G=dev/stage-3h0/golden
step() { local name="$1"; shift; local t0=$(date +%s); timeout "$@" > "$EV/$name.log" 2>&1; local rc=$?; echo "$name exit=$rc seconds=$(( $(date +%s) - t0 ))" | tee -a "$EV/steps.txt"; }
: > "$EV/steps.txt"
step srv_golden 1800 node $G/srv_golden.js --repeat 1 --out $EV --write-baseline
step cli_golden 1800 node $G/cli_golden.js --repeat 1 --out $EV --write-baseline
step srv_mutants 1800 node $G/srv_mutants.js --out $EV/srv_mutants.json
step cli_mutants 2400 node $G/cli_mutants.js --out $EV/cli_mutants.json
step contract_check 600 node $G/contract_check.js --srv $EV/srv_traces --cli $EV/cli_traces --out $EV/contract_check.json
step fn_equiv_wire_aa 600 node $G/fn_equiv.js --target wire --out $EV/fn_equiv_wire_aa.json
step fn_equiv_interp_aa 600 node $G/fn_equiv.js --target interp --out $EV/fn_equiv_interp_aa.json
step live_wire_aa 1200 node $G/live_wire.js --old-dir "$BASE" --out $EV/live_wire_aa.json
step perf_aa 2400 node $G/perf_h0.js --a "$BASE" --b . --rounds 3 --out $EV/perf_aa.json
step existing/interp_test 300 node dev/tests/interp_test.js
step existing/test_3bn 600 node dev/stage-3b-n/test_3bn.js
step existing/live 900 node dev/tests/live.js
step existing/audit_net 900 node dev/tests/audit_net.js
step existing/audit_net2 900 node dev/tests/audit_net2.js
step existing/ir_net 600 node dev/tests/ir_net.js
step existing/npm_test 3600 node dev/tests/run.js
echo done > "$EV/collect.done"
