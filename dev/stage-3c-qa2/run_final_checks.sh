#!/usr/bin/env bash
# Stage 3C QA2, QA2-4 - every check on the final tree, one after another (development only; never served).
#
#   bash dev/stage-3c-qa2/run_final_checks.sh            (from the repository root; about two and a half hours under software rendering)
#
# Writes dev/stage-3c-qa2/evidence/q4/: the QA2 probes (b1 boot gate, b2 logo + black field, b3 menu + music), the older probes re-run
# on QA2 (regress/), the camera, camera-fairness, BR-RoLE and theme-file checks, the menu captures at twelve sizes, the start
# captures, and QA1 vs QA2 performance (QA1 = commit 5f30e28, exported to a temporary folder). Each step's exit code is in the log.
set -u
cd "$(dirname "$0")/../.."
E=dev/stage-3c-qa2/evidence/q4; mkdir -p "$E"
QA1=$(mktemp -d); git archive 5f30e28532200bca52b57a112c6691498a263e92 | tar -x -C "$QA1"
step() { local name=$1; shift; echo "== $name  $(date -u +%H:%M:%S)"; "$@" > "$E/$name.log" 2>&1; local c=$?; echo "EXIT $c" >> "$E/$name.log"; echo "   exit $c"; }
step probe_b1 node dev/stage-3c-qa2/probe_b1.js --out "$E/probe_b1.json" --shots "$E/b1"
step probe_b2 node dev/stage-3c-qa2/probe_b2.js --out "$E/probe_b2.json" --shots "$E/b2"
step probe_b3 node dev/stage-3c-qa2/probe_b3.js --out "$E/probe_b3.json" --shots "$E/b3"
step regress node dev/stage-3c-qa2/regress/run.js --out "$E/regress"
step camera_3bn node dev/stage-3b-n/test_3bn.js
step camera_fairness node dev/tests/s_camera_fairness.js
step br_role node dev/br-role/test_br_role.js
step theme_assets python3 dev/stage-3c-qa1/theme_assets_check.py --out "$E/theme_assets.json"
step capture_menu node dev/stage-3c-qa2/capture_menu.js --out "$E/captures" --tag q4
step capture_boot node dev/stage-3c-qa2/capture_boot.js --out "$E/boot"
step perf_ab node dev/stage-3c-qa2/perf_ab_qa2.js --qa1 "$QA1" --rounds 2 --secs 4 --out "$E/perf_ab.json"
step perf_start node dev/stage-3c-qa2/perf_start_qa2.js --qa1 "$QA1" --rounds 3 --secs 4 --out "$E/perf_start.json"
rm -rf "$QA1"
echo "== done  $(date -u +%H:%M:%S)"
