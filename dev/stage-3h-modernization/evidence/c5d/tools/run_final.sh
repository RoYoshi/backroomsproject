#!/bin/bash
# C5d: the final verification of commit $1 (C5c), one step after another (never two heavy runs at once).
set -u
REF="$1"
SP=/tmp/claude-0/-home-claude-backroomsproject/37ab7551-4b4f-57e9-9075-d4ed7a3d3e56/scratchpad
PKG=$SP/c1/pkgs/tfb-v11-packages
WT=/home/claude/backrooms-modern
D=$SP/c5d
mkdir -p "$D"
log() { echo "$(date -u +%H:%M:%S) $*" >> "$D/run_final.log"; }
log "start: $REF"
# 1. a fresh clone, the commit checked out (B++ and M8 are its ancestors)
rm -rf "${D:?}/final_tree"
git clone --quiet --no-hardlinks "$WT" "$D/final_tree" && git -C "$D/final_tree" checkout --quiet --detach "$REF"
log "clone: $(git -C "$D/final_tree" rev-parse HEAD) tree $(git -C "$D/final_tree" rev-parse HEAD^{tree}); status: $(git -C "$D/final_tree" status --porcelain | wc -l) changes"
# 2. the final full gate, in the clone
(cd "$D/final_tree" && node dev/tools/gate/gate.js --tier full --packages "$PKG" --out "$D/gate_full_final" > "$D/gate_full_final.log" 2>&1)
log "gate: exit $? - $(tail -n 1 "$D/gate_full_final.log" | cut -c1-80)"
# 3. this tree against M8 directly, in the clone
(cd "$D/final_tree" && node dev/stage-3h-modernization/tools/c5_vs_m8.js --out "$D/vs_m8" > "$D/vs_m8.log" 2>&1)
log "vs_m8: exit $? - $(tail -n 1 "$D/vs_m8.log" | cut -c1-80)"
# 4. the build from a clean checkout of the commit, the compiled client from nothing too
rm -rf "${D:?}/clean_checkout_work"
(cd "$WT" && node dev/stage-3h-modernization/tools/m7_clean_rebuild.js --work "$D/clean_checkout_work" --ref "$REF" --packages "$PKG" --out "$D/clean_checkout.json" > "$D/clean_checkout.txt" 2>&1)
log "clean rebuild: exit $? - $(tail -n 1 "$D/clean_checkout.txt" | cut -c1-80)"
# 5. every file the game runs, against 3H2 and B++ (in the clone)
(cd "$D/final_tree" && node dev/stage-3h-modernization/tools/m8_served_identity.js --out "$D/served_identity.json" > "$D/served_identity.txt" 2>&1)
log "served identity: exit $? - $(tail -n 1 "$D/served_identity.txt" | cut -c1-80)"
log "done"
echo done > "$D/FINAL_DONE"
