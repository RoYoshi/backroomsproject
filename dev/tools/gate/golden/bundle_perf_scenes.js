/* dev/tools/gate/golden/bundle_perf_scenes.js - the scenes bundle_perf.js times (development only; Stage 3H continuation C5c).
 * Four of bundle_scenes.js's, as they are but without their captures (a capture times the harness, not the game), and with the
 * profiler reset once the run has started (the title and the joining are not timed):
 *   walk      solo_walk: a walk, a sprint, the light toggled, the map, a walk back
 *   lights    gear: the map, the lantern, the headlamp walking, the camcorder raised with night vision, the flashlight again
 *   hound     death_hound: a Hound's capture and its death sequence, RETRY's fall, a second capture, the world's end
 *   blackout  blackout_win: a blackout through to its end, the win panel */
'use strict';
const S = require('./bundle_scenes.js');
const RESET = ['eval', '(__BD.prof = null), "timed from here"'];
function timed(name) {
  const steps = S[name].steps.filter(s => s[0] !== 'shot'), i = steps.findIndex(s => s[0] === 'eval' && /^__api\.started\(\)/.test(s[1]));
  if (i < 0) throw new Error(`bundle_perf_scenes: ${name} has no start of a run to time from`);
  return Object.assign({}, S[name], { steps: [...steps.slice(0, i + 1), RESET, ...steps.slice(i + 1)] });
}
module.exports = { walk: timed('solo_walk'), lights: timed('gear'), hound: timed('death_hound'), blackout: timed('blackout_win') };
