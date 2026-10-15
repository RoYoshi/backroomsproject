#!/bin/bash
# C5d diagnosis (scratch only): two_browser on M8's game and on C5c's, Bob's page slowed by Chromium's CPU throttling (no machine load),
# alternating sides.  Usage: run_diag2.sh <throttle rate> <runs per side>
set -u
SP=/tmp/claude-0/-home-claude-backroomsproject/37ab7551-4b4f-57e9-9075-d4ed7a3d3e56/scratchpad
D=$SP/c5d/diag
RATE="${1:-4}"; N="${2:-3}"
log() { echo "$(date -u +%H:%M:%S) $*" >> "$D/run_diag.log"; }
[ -f "$D/patched2" ] || { python3 -I -B "$SP/c5d/make_diag2.py" "$D/tree" >> "$D/run_diag.log" 2>&1 && touch "$D/patched2"; }
one() {   # <label> <side>
  (cd "$D/tree" && THROTTLE="$RATE" python3 -I -B dev/stage-3e-0/two_browser_diag.py --game "$D/game_$2" --mode bplus --out "$D/$1.json" > "$D/$1.log" 2>&1)
  local x=$?
  log "$1: exit $x $(python3 -I -B -c '
import json, sys, os
f = json.load(open(sys.argv[1] + ".frames.json"))
s = "frames %d, mismatched %d (off %s), gap median %s ms, max %s ms" % (f["frames"], len(f["withAliceMismatch"]), [m["off"] for m in f["withAliceMismatch"]], f["gapMedian"], f["gapMax"])
if os.path.exists(sys.argv[1]):
    j = json.load(open(sys.argv[1])); s += "; ok %s" % j["ok"]
else: s += "; the run ended before its report"
print(s)' "$D/$1.json" 2>&1 | tail -n 1)"
}
log "throttle $RATE: Bob's page alone, $N runs a side"
for i in $(seq 1 "$N"); do one "thr${RATE}_m8_$i" m8; one "thr${RATE}_cand_$i" cand; done
echo done > "$D/DIAG2_DONE_$RATE"
