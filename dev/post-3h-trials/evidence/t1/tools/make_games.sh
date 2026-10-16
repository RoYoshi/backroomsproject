#!/bin/bash
# T1: game folders for the checks: C5d (git archive of the accepted commit, without dev/) and the candidate (the working tree's
# tracked and new files, without dev/).  Usage: make_games.sh <out folder>
set -eu
WT=/home/claude/backrooms-modern
OUT="$1"
rm -rf "${OUT:?}/game_c5d" "${OUT:?}/game_cand"; mkdir -p "$OUT/game_c5d" "$OUT/game_cand"
git -C "$WT" archive 4beba2f36deaf17473ad3b955eeefdd6fcfbd90b -- . ':(exclude)dev' | tar -x -C "$OUT/game_c5d"
(cd "$WT" && git ls-files -z --cached --others --exclude-standard | grep -zv '^dev/' | xargs -0 -I{} sh -c 'mkdir -p "$1/$(dirname "$2")" && cp -p "$2" "$1/$2"' sh "$OUT/game_cand" {})
echo "c5d: $(find "$OUT/game_c5d" -type f | wc -l) files; candidate: $(find "$OUT/game_cand" -type f | wc -l) files"
