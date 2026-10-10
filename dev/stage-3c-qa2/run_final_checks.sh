#!/usr/bin/env bash
# Stage 3C QA2, R3 - the one bounded final validation pass on the final tree (development only; never served).
#
#   bash dev/stage-3c-qa2/run_final_checks.sh            (from the repository root; every step has its own time limit)
#
# R1 already ran probe_b1, probe_b2 and probe_b3 on this source tree (evidence/r1/), and R2 the adapted logo-layout probe (QA1's
# probe_q1) and the phone-overflow probe (the first candidate's probe_c1) (evidence/r2/, seeded into evidence/r3/regress/). This
# pass runs, once each, with explicit timeouts: the rest of the older probes (regress/run.js --only ..., merged into the same
# regression.json), the camera, camera-fairness, BR-RoLE and theme-file checks, the menu captures at twelve sizes, the start
# captures, and QA1 vs QA2 performance (QA1 = commit 5f30e28, exported to a temporary folder). A step that runs out of time is
# recorded as such (exit 124) and the pass goes on. Writes dev/stage-3c-qa2/evidence/r3/.
set -u
cd "$(dirname "$0")/../.."
E=dev/stage-3c-qa2/evidence/r3; mkdir -p "$E"
QA1=$(mktemp -d); git archive 5f30e28532200bca52b57a112c6691498a263e92 | tar -x -C "$QA1"
step() { local name=$1 secs=$2; shift 2; echo "== $name  $(date -u +%H:%M:%S)  (limit ${secs} s)"; timeout --kill-after=30 "$secs" "$@" > "$E/$name.log" 2>&1; local c=$?; echo "EXIT $c" >> "$E/$name.log"; echo "   exit $c"; }
step regress 4200 node dev/stage-3c-qa2/regress/run.js --out "$E/regress" --only probe_q2,probe_q3,probe_q4,probe_q5,lifecycle,probe_c2,probe_c3,probe_c4,probe_c5,lifecycle_mp
step camera_3bn 600 node dev/stage-3b-n/test_3bn.js
step camera_fairness 600 node dev/tests/s_camera_fairness.js
step br_role 600 node dev/br-role/test_br_role.js
step theme_assets 600 python3 dev/stage-3c-qa1/theme_assets_check.py --out "$E/theme_assets.json"
step capture_menu 1500 node dev/stage-3c-qa2/capture_menu.js --out "$E/captures" --tag r3
step capture_boot 1200 node dev/stage-3c-qa2/capture_boot.js --out "$E/boot"
step perf_ab 2400 node dev/stage-3c-qa2/perf_ab_qa2.js --qa1 "$QA1" --rounds 2 --secs 4 --out "$E/perf_ab.json"
step perf_start 1500 node dev/stage-3c-qa2/perf_start_qa2.js --qa1 "$QA1" --rounds 2 --secs 4 --out "$E/perf_start.json"
rm -rf "$QA1"
echo "== done  $(date -u +%H:%M:%S)"
