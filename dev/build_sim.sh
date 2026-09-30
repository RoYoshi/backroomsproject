#!/bin/sh
# sim.js = kept level/collision/light code (sim_head.js) + the multiplayer glue that drives the AI engine (sim_glue.js)
set -e
# the game folder: ../g in the working tree, .. in the shipped package (dev/paths.js decides)
GAME=$(cd "$(dirname "$0")" && node -e "process.stdout.write(require('./paths.js'))")
cd "$(dirname "$0")"
{ printf '%s\n' "/* sim.js - server-side Level 0 simulation.
 * The map, collision, ray-cast and light code below is the game's own (extracted from the production bundle assets/index-*.js).
 * The hounds and smilers are driven by ai.js (v16); the 'multiplayer glue' section connects players, bodies, glitched walls and the admin tools. */
'use strict';"; sed -e "1,/^'use strict';/d" sim_head.js; cat sim_glue.js; } > "$GAME/sim.js"
node --check "$GAME/sim.js"
wc -c "$GAME/sim.js"
