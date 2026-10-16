#!/bin/bash
# Post-3H Trial 1: the verification of commit $1, one heavy run after another (never two at once).
set -u
REF="$1"
NSP=/tmp/claude-0/-home-claude/37ab7551-4b4f-57e9-9075-d4ed7a3d3e56/scratchpad
PKG=/tmp/claude-0/-home-claude-backroomsproject/37ab7551-4b4f-57e9-9075-d4ed7a3d3e56/scratchpad/c1/pkgs/tfb-v11-packages
WT=/home/claude/backrooms-modern
D=$NSP/t1/final
mkdir -p "$D" "$D/tmp"
export TMPDIR="$D/tmp"                      # (the tools' temporary copies stay in the scratchpad)
log() { echo "$(date -u +%H:%M:%S) $*" >> "$D/run.log"; }
log "start: $REF"
# 1. a fresh clone, the commit checked out
rm -rf "${D:?}/tree"
git clone --quiet --no-hardlinks "$WT" "$D/tree" && git -C "$D/tree" checkout --quiet --detach "$REF"
log "clone: $(git -C "$D/tree" rev-parse HEAD) tree $(git -C "$D/tree" rev-parse HEAD^{tree}); status: $(git -C "$D/tree" status --porcelain | wc -l) changes"
# 2. the full gate, in the clone
(cd "$D/tree" && node dev/tools/gate/gate.js --tier full --packages "$PKG" --out "$D/gate_full" > "$D/gate_full.log" 2>&1)
log "gate: exit $? - $(tail -n 1 "$D/gate_full.log" | cut -c1-90)"
# 3. the build from a clean checkout of the commit, the compiled client from nothing too
rm -rf "${D:?}/clean_work"
(cd "$D/tree" && node dev/stage-3h-modernization/tools/m7_clean_rebuild.js --work "$D/clean_work" --ref "$REF" --packages "$PKG" --out "$D/clean_checkout.json" > "$D/clean_checkout.txt" 2>&1)
log "clean rebuild: exit $? - $(tail -n 1 "$D/clean_checkout.txt" | cut -c1-90)"
# 4. what the drift costs on the idle menu: C5d against this commit (A/B), and C5d against itself (A/A)
rm -rf "${D:?}/g_c5d" "${D:?}/g_t1"; mkdir -p "$D/g_c5d" "$D/g_t1"
git -C "$WT" archive 4beba2f36deaf17473ad3b955eeefdd6fcfbd90b -- . ':(exclude)dev' | tar -x -C "$D/g_c5d"
git -C "$WT" archive "$REF" -- . ':(exclude)dev' | tar -x -C "$D/g_t1"
(cd "$D/tree" && node dev/post-3h-trials/tools/t1_menu_perf.js --old-dir "$D/g_c5d" --new-dir "$D/g_t1" --rounds 6 --out "$D/perf_ab.json" > "$D/perf_ab.log" 2>&1)
log "perf A/B: exit $?"
(cd "$D/tree" && node dev/post-3h-trials/tools/t1_menu_perf.js --old-dir "$D/g_c5d" --new-dir "$D/g_c5d" --aa 1 --rounds 6 --out "$D/perf_aa.json" > "$D/perf_aa.log" 2>&1)
log "perf A/A: exit $?"
log "done"
echo done > "$D/DONE"
