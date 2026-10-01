/* Scenario harness: drives the real server simulation (sim.js + ai.js) with scripted players, headless and deterministic.
 * Players move with the game's own move.js (see move_model.js for what is and is not the real client). */
'use strict';
const GAME = require('./paths.js');
const createSim = require(GAME + '/sim.js');
const WORLD = require(GAME + '/world.js');
const AI = require(GAME + '/ai.js');
const { makeMover } = require('./move_model.js');
const DT = 1 / 60;
const SP = { stand: 0, walk: 172, run: 285, crouch: 92, crawl: 54, slide: 230 }, ST = { stand: 0, walk: 1, run: 2, crouch: 3, crawl: 4, slide: 5, vault: 6, down: 7 };

function World(seed = 1, opts = {}) {
  const sim = createSim({ seed, director: opts.director === true }), eng = sim.engine, ad = sim.adapter;      // no automatic spawning in scenarios: the only monsters are the ones the scenario places
  const w = { sim, eng, ad, t: 0, log: [], players: [], kills: [], caughtLog: [], evLog: [] };
  const first = sim.addPlayer(9999); sim.join(first); first.safe = 0; first.active = false;   // joining resets the world; then we clear it
  eng.clear(); sim.removePlayer(first);
  sim.admin.blackout('off');
  w.frozenSpawns = true;
  eng.now = 60; eng.geo.now = 60;                        // a live server has been running for a while: nothing is 'fresh from boot' (sound throttles etc.)
  sim.debug.V.blackout = false;

  w.player = function (x, y, o = {}) {
    const p = sim.addPlayer(100 + w.players.length); p.active = true; p.safe = 0; p.x = x; p.y = y; p.angle = o.angle || 0;
    p.light = o.light !== false; p.equipment.kind = o.kind || 'flashlight'; p.stamina = 100;
    p.mode = 'stand'; p.tx = null; p.path = null; p.god = false;
    p.go = (tx, ty, mode = 'walk') => { p.path = null; p.tx = { x: tx, y: ty }; p.mode = mode; };
    p.route = (pts, mode = 'walk') => { p.path = pts.slice(); p.mode = mode; p.tx = null; };
    p.stop = (mode = 'stand') => { p.tx = null; p.path = null; p.mode = mode; };
    p.pathTo = (tx, ty, mode = 'walk') => { const r = eng.geo.path(p.x, p.y, tx, ty, { CAN_VAULT: false }); if (r) p.route(r.map(q => ({ x: q.x, y: q.y })), mode); return !!r; };
    p.exhaust = () => { p.stamina = 0; p.ex = 1; };
    p.slide = () => { p.slideNow = true; };                                            // press the slide key (while running)
    w.players.push(p); return p;
  };
  w.hound = (x, y, o) => { const e = eng.spawn('hound', x, y, o); e.tier = 'near'; return e; };
  w.smiler = (x, y, o) => { const e = eng.spawn('smiler', x, y, o); e.tier = 'near'; return e; };
  w.lamp = () => null;
  /* straight, clear stretches of floor (both axes): [{x0,y0,x1,y1,len}] sorted longest first */
  w.runs = function (minLen = 1200, r = 26) {
    const out = [];
    for (const axis of ['x', 'y']) {
      const lines = axis === 'x' ? 72 : 96;
      for (let l = 0; l < lines; l++) {
        const c = (l + .5) * 96; let start = -1, last = -1;
        const max = axis === 'x' ? 9216 : 6912;
        for (let v = 0; v <= max; v += 24) {
          const x = axis === 'x' ? v : c, y = axis === 'x' ? c : v, ok = v < max && ad.clear(x, y, r, 'walk');
          if (ok) { if (start < 0) start = v; last = v; }
          else { if (start >= 0 && last - start >= minLen) out.push(axis === 'x' ? { x0: start, y0: c, x1: last, y1: c, len: last - start } : { x0: c, y0: start, x1: c, y1: last, len: last - start }); start = -1; }
        }
      }
    }
    return out.sort((a, b) => b.len - a.len);
  };

  /* every scripted player is moved by the game's own move.js (move_model.js): the same acceleration, stamina, exhaustion, deep carpet,
   * crouch / crawl, vaults and collision as the browser.  The bot only chooses a direction, whether to run and whether to crouch. */
  function drive(p) {
    const M = p.mover || (p.mover = makeMover(sim, WORLD, () => w.t)), H = M.H;
    if (Math.hypot(H.x - p.x, H.y - p.y) > .5) { H.x = p.x; H.y = p.y; H.vx = H.vy = 0; }        // a test put the player somewhere: start from rest there
    H.stamina = p.stamina; H.exhausted = !!p.ex;
    if (p.dead) { p.vx = p.vy = 0; H.vx = H.vy = 0; return; }
    M.hold(p.caught ? sim.capInfo(p) : 0);
    let tgt = p.tx;
    if (p.path && p.path.length) { tgt = p.path[0]; if (Math.hypot(tgt.x - p.x, tgt.y - p.y) < 20) { p.path.shift(); tgt = p.path[0] || null; if (!tgt) { p.mode = p.mode === 'crouch' || p.mode === 'crawl' ? p.mode : 'stand'; } } }
    const mode = p.mode; let ix = 0, iy = 0;
    if (tgt && mode !== 'stand') {
      const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy), sp0 = Math.hypot(H.vx, H.vy);
      if (!p.path && d < Math.max(5, sp0 / 14)) { if (sp0 < 20 || d < 3) p.tx = null; }      // arriving: let go of the keys and coast to a stop, as a player does
      else { ix = dx; iy = dy; } }
    M.step(ix, iy, mode === 'run', mode === 'crouch' || mode === 'crawl', DT, p.slideNow); p.slideNow = false;
    const sp = Math.hypot(H.vx, H.vy);
    if (p.look !== undefined && p.look !== null) p.angle = typeof p.look === 'function' ? p.look() : p.look;   // where the player looks (mouse aim), independent of where it walks
    else if (ix || iy) p.angle = Math.atan2(iy, ix);
    H.angle = p.angle;
    p.x = H.x; p.y = H.y; p.vx = H.vx; p.vy = H.vy; p.stamina = H.stamina; p.ex = H.exhausted ? 1 : 0; p.sprinting = !!H.sprinting;
    sim.hearMove(p, M.net()); p.stamina = H.stamina;                      // exactly what the client sends (state, speed, stamina, exhaustion, vault / slide noises); the exact stamina stays with the body
    p.wdist = (p.wdist || 0) + sp * DT;
  }
  w.step = function () {
    for (const p of w.players) if (p.active) drive(p);
    sim.step(DT); w.t += DT;
    for (const ev of eng._lastEvents || []) { }
  };
  w.run = function (secs, fn, every = 1) {
    const n = Math.round(secs / DT);
    for (let i = 0; i < n; i++) {
      if (fn && i % every === 0) { const r = fn(w, i * DT); if (r === false) return false; }
      w.step();
    }
    return true;
  };
  /* wait until fn is true or the time runs out; returns seconds taken or -1 */
  w.until = function (secs, fn) { const t0 = w.t; const ok = w.run(secs, (ww) => fn(ww) ? false : true); return ok ? -1 : +(w.t - t0).toFixed(2); };
  w.kills = [];
  const oldDrain = eng.drainEvents.bind(eng);
  eng.drainEvents = function () { const ev = oldDrain(); for (const e of ev) { if (e.t === 'kill') w.kills.push(Object.assign({ at: w.t }, e)); w.evLog.push(Object.assign({ at: +w.t.toFixed(2) }, e)); } return ev; };
  return w;
}
const stateNames = e => e.state + (e.act ? '/' + e.act : '');
module.exports = { World, DT, SP, ST, WORLD, AI, stateNames };
