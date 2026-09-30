/* Live chase (Part 1C): the real server and its real 40 Hz loop, a scripted player over the real WebSocket protocol sending positions at the client's
 * rate (20 Hz) - the path a human's chase actually takes, minus the human.  Compare with escape_bench.js (the headless world) to see whether anything
 * about the live path (stale positions, tick rate, message handling) makes escaping easier than the simulation says.
 *   node tests/live_chase.js [strategy] [runs] [port]       strategies: straight | break-walk | break-hide    (light off after the start, like escape_bench) */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const GAME = require('../paths.js');
const { World, geo } = require('./lib.js');
const TAU = Math.PI * 2, M = { walk: 172, run: 285, crouch: 92, ex: 148, drain: 10.5 };
const strategy = process.argv[2] || 'straight', N = +(process.argv[3] || 6), PORT = +(process.argv[4] || 9470);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function one(i, srv) {
  const room = 'chase' + i + '_' + Date.now() % 1e6, ws = new WebSocket(`ws://localhost:${PORT}/ws?room=${room}`);
  const st = { snap: null, me: null, dead: false, caught: false, id: null };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.t === 'hello' || m.t === 'welcome') st.id = m.id; if (m.t === 's') { st.snap = m.e; if (m.me) st.dead = true; if (m.cp) st.caught = true; } };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const tx = o => ws.readyState === 1 && ws.send(JSON.stringify(o));
  tx({ t: 'join' }); await sleep(400); tx({ t: 'admin', pass: 'smoor' }); await sleep(200);
  for (let k = 0; k < 4; k++) tx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let k = 0; k < 6; k++) tx({ t: 'a', c: 'smilers', mode: 'remove' });
  // a start spot and a far goal from the shared level data
  const G = geo(), P = G.cells.filter((_, k) => k % 7 === 0).map(c => ({ x: G.g.cx(c), y: G.g.cy(c) })).filter(q => G.ad.clear(q.x, q.y, 26, 'walk'));
  const a = P[(i * 7919 + 13) % P.length]; const me = { x: a.x, y: a.y, vx: 0, vy: 0, stamina: 100, ex: 0, mode: 'run', ang: 0, route: [] };
  const send = (mv) => tx({ t: 'p', x: Math.round(me.x), y: Math.round(me.y), vx: Math.round(me.vx), vy: Math.round(me.vy), a: +me.ang.toFixed(2), r: me.mode === 'run' ? 1 : 0, l: me.light ? 1 : 0, k: 'flashlight', n: 'BOT', mv });
  me.light = true; for (let k = 0; k < 6; k++) { send({ s: 0, st: 100, ex: 0, sp: 0, ev: [] }); await sleep(60); }
  tx({ t: 'a', c: 'near', k: 'hound' }); await sleep(700);
  const h0 = st.snap && st.snap.h && st.snap.h[0]; if (!h0) { ws.close(); return null; }
  me.ang = Math.atan2(me.y - h0.y, me.x - h0.x);
  tx({ t: 'a', c: 'nav', eid: h0.i, cmd: 'hunt' }); await sleep(100); me.light = false;
  // flee: the farthest reachable floor away from the hound, the route planned on the shared level
  let best = null, bs = -1; for (let k = 0; k < 60; k++) { const q = P[(i * 131 + k * 977) % P.length], d = Math.hypot(q.x - me.x, q.y - me.y), away = Math.hypot(q.x - h0.x, q.y - h0.y) - d; if (d > 1800 && d < 3600 && away > bs && G.g.path(me.x, me.y, q.x, q.y, { CAN_VAULT: false })) { bs = away; best = q; } }
  me.route = G.g.path(me.x, me.y, best.x, best.y, { CAN_VAULT: false }) || [];
  const t0 = Date.now(); let last = t0, lastSend = 0, broke = -1, hid = false, lostFor = 0, lost = false;
  while (Date.now() - t0 < 60000) {
    await sleep(16); const now = Date.now(), dt = Math.min(.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000;
    const h = st.snap && st.snap.h && st.snap.h[0];
    if (st.dead || st.caught) break;
    if (process.env.TRACE && Math.floor(t * 2) !== Math.floor((t - dt) * 2) && h) console.log('t', t.toFixed(1), 'hound', ['DORMANT','ROAMING','CURIOUS','ALERT','WATCHING','STALKING','HUNTING','SEARCHING','CAUTIOUS','FRUSTRATED','EXCITED','FEEDING','PLAYING','RETREATING'][h.s], 'ac', h.ac, 'v', h.v, 'd', Math.round(Math.hypot(h.x - me.x, h.y - me.y)), 'me', Math.round(me.x), Math.round(me.y), 'st', Math.round(me.stamina));
    if (h) { const vis = G.g.los(h.x, h.y, me.x, me.y) && Math.hypot(h.x - me.x, h.y - me.y) < 900; if (!vis && broke < 0 && t > .5) broke = t; const eng = ['HUNTING', 'STALKING'].includes(['DORMANT', 'ROAMING', 'CURIOUS', 'ALERT', 'WATCHING', 'STALKING', 'HUNTING'][h.s] || ''); lostFor = eng ? 0 : lostFor + dt; if (lostFor > 20 && Math.hypot(h.x - me.x, h.y - me.y) > 700) { lost = true; break; } }
    if (strategy === 'break-walk' && broke >= 0) me.mode = 'walk';
    if (strategy === 'break-hide' && broke >= 0 && !hid) { hid = true; me.mode = 'crouch'; me.route = []; }
    // movement: the same rules as the headless harness (instant velocity, stamina drain / regen, exhausted walk)
    let mode = me.mode; if (mode === 'run' && (me.ex || me.stamina <= 0)) mode = 'walk';
    let v = hid ? 0 : mode === 'run' ? M.run : mode === 'crouch' ? M.crouch : M.walk; if (me.ex) v = Math.min(v, M.ex);
    while (me.route.length && Math.hypot(me.route[0].x - me.x, me.route[0].y - me.y) < 20) me.route.shift();
    if (!me.route.length) v = 0;
    if (v > 0) { const w = me.route[0], d = Math.hypot(w.x - me.x, w.y - me.y); me.vx = (w.x - me.x) / d * v; me.vy = (w.y - me.y) / d * v; me.ang = Math.atan2(me.vy, me.vx); me.x += me.vx * dt; me.y += me.vy * dt; } else { me.vx = me.vy = 0; }
    if (mode === 'run' && v > 0) me.stamina = Math.max(0, me.stamina - M.drain * dt); else me.stamina = Math.min(100, me.stamina + (v === 0 ? 24 : mode === 'crouch' ? 10 : 9) * (me.ex ? .7 : 1) * dt);
    if (me.stamina <= 0) me.ex = 1; else if (me.ex && me.stamina > 24) me.ex = 0;
    if (now - lastSend >= 50) { lastSend = now; send({ s: v === 0 ? (hid ? 3 : 0) : mode === 'run' ? 2 : mode === 'crouch' ? 3 : 1, st: Math.round(me.stamina), ex: me.ex, sp: Math.round(v), ev: [] }); }
  }
  const t = (Date.now() - t0) / 1000; ws.close();
  return { caught: st.dead || st.caught, lost, t: +t.toFixed(1), broke };
}
(async () => {
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' }); await sleep(1200);
  const rs = [];
  try { for (let i = 0; i < N; i++) { const r = await one(i, srv); if (r) rs.push(r); console.log(JSON.stringify(r)); } }
  finally { srv.kill(); }
  const c = rs.filter(r => r.caught);
  console.log(JSON.stringify({ live: strategy, n: rs.length, caught: +(c.length / rs.length).toFixed(2), escaped: +(rs.filter(r => r.lost).length / rs.length).toFixed(2), catchTime: c.length ? +(c.reduce((a, r) => a + r.t, 0) / c.length).toFixed(1) : null }));
})();
