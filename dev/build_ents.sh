#!/bin/sh
set -e
cd "$(dirname "$0")/ents_src"
cat 00_head.js 10_hound.js 20_smiler.js 25_death.js 30_audio.js 40_debug.js > ../../g/ents.js
node --check ../../g/ents.js
wc -c ../../g/ents.js
