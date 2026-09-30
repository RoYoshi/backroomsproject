/* Hound scenarios (Part XVIII).  Each returns { ok, note, ... } for one seed; the runner repeats over seeds. */
'use strict';
const { World, stateNames } = require('./harness.js');
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const LONG = { y: 3504, x0: 3024, x1: 8784 };                 // the longest straight corridor in the level

/* how far away does a resting hound notice a player approaching head-on in a given way? */
function notice(seed, mode, light) {
  const w = World(seed);
  const h = w.hound(7000, LONG.y); h.state = 'ROAMING'; h.act = 'rest'; h.rest = 1e9; h.ang = Math.PI;      // resting, facing west (toward the player)
  const p = w.player(5200, LONG.y, { light, angle: 0 });
  p.go(6900, LONG.y, mode);
  let at = -1;
  w.run(30, () => { if (h.state !== 'ROAMING' || h.act !== 'rest') { at = dist(h, p); return false; } if (dist(h, p) < 70) return false; }, 2);
  return { ok: true, d: at, mode, light };
}

/* chase down the long corridor; who wins, how does it end */
function chase(seed, mode, gap, opts = {}) {
  const w = World(seed);
  const p = w.player(4200, LONG.y, { light: opts.light !== false });
  const h = w.hound(4200 - gap, LONG.y); h.ang = 0;
  p.go(8600, LONG.y, mode);
  if (opts.exhausted) p.exhaust();
  let out = null, lunged = 0, missed = 0;
  w.run(40, (ww, t) => {
    if (p.caught || p.dead) return false;
    if (h.lunge && !out) { lunged = 1; }
    if (opts.dodge && h.lunge && h.lunge.t > h.lunge.wind * .55 && h.lunge.t < h.lunge.wind + .05 && !p.dodging) { p.dodging = t; const a = Math.atan2(h.lunge.dir ? Math.sin(h.lunge.dir) : 0, 1); p.go(p.x, p.y + 220, 'run'); }
    if (p.dodging && t - p.dodging > .5) { p.dodging = 0; p.go(8600, LONG.y, mode); }
  }, 1);
  return { ok: true, caught: !!p.caught || !!p.dead, t: +w.t.toFixed(1), kills: w.kills.map(k => k.variant), mode: p.caught ? p.caught.mode : (w.kills[0] ? 'quick' : ''), missed: h.lungesMissed || 0, lunged, state: stateNames(h), stam: Math.round(p.stamina), dist: Math.round(dist(h, p)) };
}

/* the player breaks line of sight and goes to ground; how does the hound search? */
function loseHound(seed, hideMode) {
  const w = World(seed);
  // west end of the long corridor: a turn north at x=3216 (vertical run) - run east then take the side passage
  const p = w.player(5400, LONG.y, {});
  const h = w.hound(4700, LONG.y); h.ang = 0;
  const route = [{ x: 6200, y: LONG.y }, { x: 6200, y: 2600 }];
  const back = w.eng.geo.path(6200, LONG.y, 5616, 2500, { CAN_VAULT: false });
  p.pathTo(5616, 800, 'run');
  let firstSeenLost = -1, searchStart = -1, goals = [], lastGoal = '';
  let seenOnce = false;
  w.run(70, (ww, t) => {
    const r = h.mem.p.get(p.id);
    if (r && r.seen) seenOnce = true;
    if (seenOnce && firstSeenLost < 0 && r && !r.seen) firstSeenLost = t;
    if (h.state === 'SEARCHING' && searchStart < 0) searchStart = t;
    if (h.search && h.search.goal) { const k = Math.round(h.search.goal.x) + ',' + Math.round(h.search.goal.y); if (k !== lastGoal) { lastGoal = k; goals.push({ t: +t.toFixed(1), x: Math.round(h.search.goal.x), y: Math.round(h.search.goal.y), d: Math.round(dist(h.search.goal, p)) }); } }
    if (t > 8 && p.mode !== hideMode && !p.hid) { p.hid = true; p.stop(hideMode); }
    if (p.caught || p.dead) return false;
  }, 2);
  return { ok: true, lost: firstSeenLost, search: searchStart, goals: goals.slice(0, 5), caught: !!p.dead || !!p.caught, end: stateNames(h), pdist: Math.round(dist(h, p)) };
}

module.exports = { notice, chase, loseHound, LONG };
