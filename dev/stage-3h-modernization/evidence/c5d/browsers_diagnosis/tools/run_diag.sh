#!/bin/bash
# C5d diagnosis (scratch only): two_browser on M8's game and on C5c's, quiet and with two CPU-bound processes beside it (as the final
# gate's run had the compiled client's build beside it).  Usage: run_diag.sh <nice level for the load: 10 or 0> <runs per side under load>
set -u
SP=/tmp/claude-0/-home-claude-backroomsproject/37ab7551-4b4f-57e9-9075-d4ed7a3d3e56/scratchpad
WT=/home/claude/backrooms-modern
D=$SP/c5d/diag
NICE="${1:-10}"; N="${2:-2}"
mkdir -p "$D"
log() { echo "$(date -u +%H:%M:%S) $*" >> "$D/run_diag.log"; }
if [ ! -d "$D/tree" ]; then
  git clone --quiet --no-hardlinks "$WT" "$D/tree" && git -C "$D/tree" checkout --quiet --detach 2830dacc2ca102d5e7b235d6d30bebcef281a6c2
  python3 -I -B "$SP/c5d/make_diag.py" "$D/tree" >> "$D/run_diag.log" 2>&1
  for s in m8:c34f0c22bbacc5ac2813d173bc0591b67af7169f cand:2830dacc2ca102d5e7b235d6d30bebcef281a6c2; do
    n=${s%%:*}; r=${s#*:}; mkdir -p "$D/game_$n"
    git -C "$WT" archive "$r" -- . ':(exclude)dev' | tar -x -C "$D/game_$n"
  done
  log "tree $(git -C "$D/tree" rev-parse HEAD); games m8, cand"
fi
one() {   # one run: <label> <side>
  (cd "$D/tree" && python3 -I -B dev/stage-3e-0/two_browser_diag.py --game "$D/game_$2" --mode bplus --out "$D/$1.json" > "$D/$1.log" 2>&1)
  log "$1: exit $? $(python3 -I -B -c 'import json,sys; j=json.load(open(sys.argv[1])); c=j["checks"]; print("ok", j["ok"], "frames", c["framesWithAlice"], "drawn", c["avatarIsDrawnPose"], "worst", c["worst"]["av"], "bobMs", round(j["bobFrameMsMedian"] or 0, 1), "diag", len(j.get("diag") or []))' "$D/$1.json" 2>&1)"
}
log "quiet"
one quiet_m8 m8; one quiet_cand cand
log "load: two busy processes at nice $NICE"
P=()
for k in 1 2; do (nice -n "$NICE" node -e 'for(;;){}' &> /dev/null & echo $! > "$D/busy_$k.pid"); done
sleep 2; for k in 1 2; do P+=("$(cat "$D/busy_$k.pid")"); done
log "busy pids: ${P[*]}"
for i in $(seq 1 "$N"); do one "load${NICE}_m8_$i" m8; one "load${NICE}_cand_$i" cand; done
for p in "${P[@]}"; do kill "$p"; done
log "busy stopped"
echo done > "$D/DIAG_DONE_$NICE"
