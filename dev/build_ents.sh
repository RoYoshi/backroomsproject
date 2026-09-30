#!/bin/sh
set -e
# the game folder: ../g in the working tree, .. in the shipped package (dev/paths.js decides)
GAME=$(cd "$(dirname "$0")" && node -e "process.stdout.write(require('./paths.js'))")
cd "$(dirname "$0")/ents_src"
cat 00_head.js 10_hound.js 20_smiler.js 25_death.js 30_audio.js 40_debug.js > "$GAME/ents.js"
node --check "$GAME/ents.js"
wc -c "$GAME/ents.js"
