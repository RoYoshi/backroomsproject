#!/bin/sh
# concatenates the AI engine parts into the single UMD file the server loads
set -e
# the game folder: ../g in the working tree, .. in the shipped package (dev/paths.js decides)
GAME=$(cd "$(dirname "$0")" && node -e "process.stdout.write(require('./paths.js'))")
cd "$(dirname "$0")/ai_src"
cat 00_head.js 10_geo.js 20_senses.js 25_light.js 30_entity.js 40_capture.js 50_hound.js 60_smiler.js 90_engine.js > "$GAME/ai.js"
node --check "$GAME/ai.js"
wc -c "$GAME/ai.js"
