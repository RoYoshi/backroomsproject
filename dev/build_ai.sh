#!/bin/sh
# concatenates the AI engine parts into the single UMD file the server loads
set -e
cd "$(dirname "$0")/ai_src"
cat 00_head.js 10_geo.js 20_senses.js 30_entity.js 40_capture.js 50_hound.js 60_smiler.js 90_engine.js > ../../g/ai.js
node --check ../../g/ai.js
wc -c ../../g/ai.js
