/* The compiled client's build-time data (Stage 3H continuation C4c, M-003): the canonical definitions outside this folder that the client
 * is built with, and the constants the build makes of them.
 *
 * Level 0 and the carried lights are defined once, for the server and the page: L.O.S.T.'s src/frameworks/lost/shared/level0.json and
 * P.O.C.K.E.T.'s src/frameworks/pocket/shared/lights.json (the server's src/core/server/sim.js reads the same files).  vite.config.ts
 * defines each constant below as its value (Vite's `define`): every use in the source becomes the value itself, as it was written there
 * before C4c, so the built bundle is what it was, but for one token: the lantern's spread, written Math.PI*2 in the source, is the JSON
 * number 6.283185307179586, the same double.  shared/level-data.d.ts gives their types.
 *   INPUTS              the files, by their path in the repository: dev/tools/build/client.js copies them into its work folder, at the
 *                       same place relative to this folder, and records them with the sources (generated/CLIENT_BUILD.json)
 *   constants(read)     read(path) -> the parsed file; returns { NAME: value }: the same names and values
 *                       dev/stage-3h-modernization/tools/c4_alpha_all.mjs puts in place of the names when it compares the port with
 *                       the shipped bundle */
'use strict';
const INPUTS = ['src/frameworks/lost/shared/level0.json', 'src/frameworks/pocket/shared/lights.json'];
function constants(read) {
  const L = read(INPUTS[0]), G = read(INPUTS[1]);
  return {
    LEVEL0_COLS: L.cols, LEVEL0_ROWS: L.rows,
    LEVEL0_ROOMS: L.rooms, LEVEL0_CORRIDORS: L.corridors, LEVEL0_PARTITIONS: L.partitions, LEVEL0_DOORWAYS: L.doorways, LEVEL0_PITS: L.pits,
    LEVEL0_PILLAR_COLUMNS: L.pillars.columns, LEVEL0_PILLAR_ROWS: L.pillars.rows, LEVEL0_PILLAR_HALF: L.pillars.half, LEVEL0_PILLAR_SIZE: L.pillars.size,
    LEVEL0_SPAWN_X: L.spawn.x, LEVEL0_SPAWN_Y: L.spawn.y,
    LEVEL0_BLACKOUT_FIRST: L.blackouts.first, LEVEL0_BLACKOUT_LENGTH: L.blackouts.length, LEVEL0_BLACKOUT_LENGTH_CYCLE: L.blackouts.lengthCycle,
    LEVEL0_BLACKOUT_GAP: L.blackouts.gap, LEVEL0_BLACKOUT_GAP_CYCLE: L.blackouts.gapCycle, LEVEL0_BLACKOUT_GAP_STEP: L.blackouts.gapStep,
    LIGHT_KINDS: G.kinds,
  };
}
module.exports = { INPUTS, constants };
