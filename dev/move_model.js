/* The player's real movement code (move.js, the file the browser runs) executed headless, one copy per scripted player.
 *
 * Tests used to move their puppets with a hand-written copy of the movement rules (instant velocity, fixed speeds, their own stamina
 * formula, a 14 px body).  That copy drifted from the game.  Now every scripted player is moved by move.js itself: acceleration and the
 * slower acceleration when exhausted, the deep-carpet slowdown and extra drain, stamina and recovery (recoverAt), crouch / crawl in
 * low geometry, vaults, slides, the 15 px body and the game's own collision (the server's copy of the level: Bc / WORLD props).
 *
 * What is still NOT the real client (documented, not hidden):
 *  - input is a bot's: it steers straight at its next waypoint (a person swerves, hesitates, overshoots corners);
 *  - the crouch key is set as a state (crouch on / off) instead of pressed, so a bot never slides unless a test asks (slide());
 *  - the facing (mouse) follows the movement direction;
 *  - capture: the server's hold (down / crawl / drag point) is fed in exactly as mp.js does, but nothing is rendered;
 *  - timing is a fixed 1/60 s step with no frame-rate jitter and no network delay (live_chase.js covers the network path).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = require('./paths.js');
const SRC = new vm.Script(fs.readFileSync(path.join(GAME, 'move.js'), 'utf8'), { filename: 'move.js' });

/* sim: a sim.js instance (for the level geometry).  Returns a mover for one player. */
function makeMover(sim, WORLD, clock) {
  const H = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, distance: 0, stamina: 100, sprinting: false, exhausted: false, equipment: { kind: 'flashlight' } };
  const keys = new Set();
  const api = { H, keys, Bc: (x, y) => sim.blockersAt(x, y), Oc: sim.adapter.rooms };
  const win = { WORLD, __api: api };
  const ctx = vm.createContext({ window: win, performance: { now: () => clock() * 1000 }, Math, console, document: { getElementById: () => null } });
  SRC.runInContext(ctx);
  const mv = win.__mv;
  return {
    H, mv,
    /* one fixed step: ix, iy = input direction (any length), run = the run key, crouch = crouched (true / false); slide = press the slide key now */
    step(ix, iy, run, crouch, dt, slide) {
      if (slide) { keys.add('KeyC'); }
      else if (!!crouch !== mv.crouch && !mv.zone) mv.crouch = !!crouch;      // under a table you cannot stand: move.js keeps you down
      mv.step(ix, iy, run, dt);
      keys.delete('KeyC'); mv.prevC = false;
    },
    net: () => mv.net(),
    hold(cp) { mv.down = cp && cp.ph !== 'release' ? (cp.ph === 'crawl' ? 'crawl' : 'down') : 0; mv.dragTo = mv.down && cp.d ? cp.d : null; },   // the same as mp.js applyCaught
    reset() { mv.reset(); },
  };
}
module.exports = { makeMover };
