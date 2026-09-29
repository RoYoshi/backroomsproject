/* Scenario harness: drives the real server simulation (sim.js + ai.js) with scripted puppet players, headless and deterministic. */
'use strict';
const GAME = require('./paths.js');
const createSim = require(GAME + '/sim.js');
const WORLD = require(GAME + '/world.js');
const AI = require(GAME + '/ai.js');
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

  function collide(p, dx, dy, mode) {
    const r = 14, mm = mode === 'crawl' ? 'crawl' : mode === 'crouch' ? 'walk' : 'walk';
    for (const ax of [0, 1]) {
      if (ax === 0) p.x += dx; else p.y += dy;
      for (const t of ad.blockers(p.x, p.y, mm)) {
        const nx = Math.max(t.x, Math.min(p.x, t.x + t.w)), ny = Math.max(t.y, Math.min(p.y, t.y + t.h)), ddx = p.x - nx, ddy = p.y - ny, d = Math.hypot(ddx, ddy);
        if (d < r) { if (d > 0) { p.x += ddx / d * (r - d); p.y += ddy / d * (r - d); } }
      }
    }
  }
  function drive(p) {
    if (p.dead || p.caught) { p.vx = p.vy = 0; if (p.caught) { const cap = p.caught; p.st = cap.phase === 'down' ? 7 : 4; } return; }
    let tgt = p.tx;
    if (p.path && p.path.length) { tgt = p.path[0]; if (Math.hypot(tgt.x - p.x, tgt.y - p.y) < 20) { p.path.shift(); tgt = p.path[0] || null; if (!tgt) { p.mode = 'stand'; } } }
    let mode = p.mode;
    if (mode === 'run' && p.stamina <= 0) mode = 'walk';
    let v = SP[mode] || 0; if (p.ex) v = Math.min(v, 148);
    if (tgt && v > 0) {
      const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy);
      if (d < 4 && !p.path) { p.tx = null; v = 0; }
      else { p.angle = Math.atan2(dy, dx); p.vx = dx / d * v; p.vy = dy / d * v; }
    } else { p.vx = p.vy = 0; v = 0; }
    if (v > 0) collide(p, p.vx * DT, p.vy * DT, mode);
    p.sp = v; p.st = ST[mode] | 0; p.sprinting = mode === 'run' && v > 0;
    if (mode === 'run' && v > 0) p.stamina = Math.max(0, p.stamina - 10.5 * DT); else p.stamina = Math.min(100, p.stamina + (mode === 'stand' ? 24 : mode === 'crouch' || mode === 'walk' ? 9 : 8) * DT);
    if (p.stamina <= 0) p.ex = 1; else if (p.ex && p.stamina > 24) p.ex = 0;
    p.wdist = (p.wdist || 0) + v * DT;
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
