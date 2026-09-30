/* Part 1 audit remediation: the fixes that live on the wire, checked against the real server.js over real WebSockets.
 *   node dev/tests/audit_net.js            (Node 22+: built-in WebSocket)
 * H  a malformed URL never kills the server
 * R  respawn only from a legal lifecycle state (living: refused; dead: accepted; admin revive: accepted once)
 * M  movement validation: no jumping thousands of px, no walking through walls, no silent sprinting; normal walking / jitter untouched
 * A  admin tools still move people
 * D  a death leaves its aftermath even when the victim disconnects at once; exactly one corpse either way */
'use strict';
const { spawn } = require('child_process');
const http = require('http'), net = require('net'), path = require('path');
const GAME = require('../paths.js');
const createSim = require(path.join(GAME, 'sim.js'));
const PORT = +(process.env.PORT || 9480);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const check = (name, ok, note) => { R.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + '\n       ' + note); };

function get(p) { return new Promise(res => { const q = http.get({ host: 'localhost', port: PORT, path: p }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res({ code: r.statusCode, body: b })); }); q.on('error', e => res({ code: -1, body: String(e.message) })); }); }
function rawGet(p) { return new Promise(res => { const s = net.connect(PORT, 'localhost', () => s.write(`GET ${p} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`)); let b = ''; s.on('data', d => b += d); s.on('end', () => res(b.split('\r\n')[0])); s.on('error', e => res('ERR ' + e.message)); }); }

async function client(room, name, admin) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws?room=${room}`), c = { ws, id: 0, snaps: [], tps: [], fx: [], bodies: null, ares: [], last: null };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === 'hi') c.id = m.id; else if (m.t === 's') { c.last = m; } else if (m.t === 'tp') c.tps.push(m); else if (m.t === 'fx') c.fx.push(m); else if (m.t === 'bodies') c.bodies = m.b; else if (m.t === 'ares') c.ares.push(m); };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.tx = o => ws.readyState === 1 && ws.send(JSON.stringify(o));
  c.pos = (x, y, mv, extra) => c.tx(Object.assign({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: name, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: mv || { s: 0, st: 100, ex: 0, sp: 0, ev: [] } }, extra || {}));
  c.peer = id => c.last && (c.last.p || []).find(q => q.id === id);
  await sleep(150); c.tx({ t: 'join' }); await sleep(250);
  if (admin) { c.tx({ t: 'admin', pass: process.env.ADMIN_PASSCODE || 'smoor' }); await sleep(200); }
  return c;
}
/* walk a client along a straight line at a speed, sending positions at 20 Hz (optionally bunched, as after a lag spike) */
async function walk(c, x0, y0, x1, y1, speed, o = {}) {
  const d = Math.hypot(x1 - x0, y1 - y0), T = d / speed, n = Math.ceil(T / .05); let pend = [];
  for (let k = 1; k <= n; k++) {
    const u = Math.min(1, k / n), x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, mv = { s: speed > 200 ? 2 : 1, st: 100, ex: 0, sp: Math.round(speed), ev: [] };
    if (o.bunch && k % o.bunch !== 0) pend.push([x, y, mv]); else { for (const q of pend) { c.pos(q[0], q[1], q[2]); await sleep(31); } pend = []; c.pos(x, y, mv); }
    await sleep(o.bunch ? (k % o.bunch === 0 ? 50 : 50) : 50);
  }
  for (const q of pend) { c.pos(q[0], q[1], q[2]); await sleep(31); }
}

(async () => {
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  let exited = null; srv.on('exit', c => exited = c);
  await sleep(1200);
  try {
    /* H: malformed percent-encoding */
    const bad = [];
    for (const p of ['/%', '/%E0%A4%A', '/%zz', '/world.js%', '/%C0%AF', '/..%2f..%2fserver.js', '/sounds/%']) bad.push([p, await rawGet(p)]);
    const ok1 = await get('/'), ok2 = await get('/world.js'), hidden = await get('/server.js');
    check('H1 malformed URLs get a 4xx and the server keeps serving', exited === null && bad.every(([, s]) => / 4\d\d /.test(s)) && ok1.code === 200 && ok2.code === 200 && hidden.code === 404 && !/URIError|\/home|at /.test(bad.map(b => b[1]).join()),
      bad.map(([p, s]) => `${p} -> ${s.replace('HTTP/1.1 ', '')}`).join(' · ') + ` · then / -> ${ok1.code}, /world.js -> ${ok2.code}, /server.js -> ${hidden.code} · server process ${exited === null ? 'alive' : 'EXITED ' + exited}`);

    /* geometry for the movement checks, from the same level code the server runs */
    const S = createSim({ seed: 1 }), Ic = S.debug.Ic, LY = 3504;
    let wallPair = null;                                                     // two open spots with a wall between them and no way round shorter than ~900 px
    for (let y = 600; y < 6600 && !wallPair; y += 96) for (let x = 600; x < 8900 && !wallPair; x += 96) for (const [dx, dy] of [[0, -1], [1, 0]]) { if (wallPair) break; for (let k = 110; k <= 250 && !wallPair; k += 20) { const x2 = x + dx * k, y2 = y + dy * k; if (S.clearAt(x, y, 22) && S.clearAt(x2, y2, 22) && !S.moveOk(x, y, x2, y2, 700)) wallPair = [x, y, x2, y2]; } }

    /* A + M: an admin brings a player to the long corridor; the player walks, runs, lags, then tries to cheat */
    const room = 'audit' + Date.now() % 1e5;
    const adm = await client(room, 'ADMIN', true), a = await client(room, 'A', false), obs = await client(room, 'OBS', false);
    for (let k = 0; k < 4; k++) adm.tx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let k = 0; k < 6; k++) adm.tx({ t: 'a', c: 'smilers', mode: 'remove' });
    adm.tx({ t: 'a', c: 'god', id: a.id }); adm.tx({ t: 'a', c: 'god', id: obs.id }); adm.tx({ t: 'a', c: 'god', id: adm.id });
    adm.pos(4000, LY); await sleep(200); adm.pos(4000, LY); await sleep(150);
    adm.tx({ t: 'a', c: 'bring', id: a.id }); await sleep(300);
    const brought = a.tps.find(t => Math.abs(t.x - 4000) < 2);
    a.pos(4000, LY); await sleep(300); const seen0 = obs.peer(a.id);
    check('A1 admin tools still move people (bring) and the moved player carries on from there', brought && seen0 && Math.hypot(seen0.x - 4000, seen0.y - LY) < 3, `A told to go to ${brought ? brought.x + ',' + brought.y : 'nowhere'}; observer sees A at ${seen0 ? seen0.x + ',' + seen0.y : '-'}`);

    const gw = () => (obs.last && obs.last.e && obs.last.e.gw) || [], farFromGlitch = (x0, x1) => gw().every(g => Math.abs(g[1] - LY) > 300 || g[0] < Math.min(x0, x1) - 300 || g[0] > Math.max(x0, x1) + 300);
    adm.tx({ t: 'a', c: 'glitch', mode: 'new' }); for (let k = 0; k < 20 && !farFromGlitch(3100, 8700); k++) { adm.tx({ t: 'a', c: 'glitch', mode: 'new' }); await sleep(150); }   // touching a glitched wall ends the run: keep them off the corridor
    const tp0 = a.tps.length;
    await walk(a, 4000, LY, 4600, LY, 172); await walk(a, 4600, LY, 5400, LY, 285); await walk(a, 5400, LY, 6200, LY, 285, { bunch: 8 }); await sleep(250);
    const s1 = obs.peer(a.id);
    check('M1 normal walking, running and a lag burst (8 packets held back, then sent together) are all accepted, no corrections', s1 && Math.abs(s1.x - 6200) < 4 && a.tps.length === tp0, `observer sees A at x ${s1 && s1.x} (sent 6200); corrections sent to A: ${a.tps.length - tp0}`);

    const tp1 = a.tps.length; a.pos(6200 + 2600, LY - 1400); await sleep(120); a.pos(6200 + 2600, LY - 1400); await sleep(400); const s2 = obs.peer(a.id);
    a.pos(6200 - 3000, LY); await sleep(700); const s3 = obs.peer(a.id);
    check('M2 an ordinary client cannot jump thousands of px in one update (it is corrected back)', s2 && Math.hypot(s2.x - 6200, s2.y - LY) < 30 && s3 && Math.hypot(s3.x - 6200, s3.y - LY) < 30 && a.tps.length > tp1, `claimed +2600,-1400 then -3000 px: observer still sees A at ${s2 && s2.x},${s2 && s2.y} / ${s3 && s3.x},${s3 && s3.y}; corrections ${a.tps.length - tp1} (last to ${a.tps.length ? a.tps[a.tps.length - 1].x + ',' + a.tps[a.tps.length - 1].y : '-'})`);

    // speed hack: 3x run speed, sustained, in small steps
    await sleep(1000); a.pos(6200, LY); await sleep(200);
    const tp2 = a.tps.length; let x = 6200; const t0 = Date.now(); while (Date.now() - t0 < 2500) { x += 900 * .05; a.pos(x, LY, { s: 2, st: 100, ex: 0, sp: 285, ev: [] }); await sleep(50); }
    await sleep(200); const s4 = obs.peer(a.id), gained = s4 ? s4.x - 6200 : 0;
    check('M3 a sustained speed hack (3x a sprint) is held to what a body can do', gained < 1300 && a.tps.length > tp2, `claimed ${Math.round(x - 6200)} px in 2.5 s; the server accepted ${Math.round(gained)} px (a sprint is ~710); corrections ${a.tps.length - tp2}`);

    // through a wall
    await sleep(1000); if (wallPair) { adm.pos(wallPair[0], wallPair[1]); await sleep(150); adm.tx({ t: 'a', c: 'bring', id: a.id }); await sleep(300); a.pos(wallPair[0], wallPair[1]); await sleep(1100); }
    const tp3 = a.tps.length; if (wallPair) { a.pos(wallPair[2], wallPair[3]); await sleep(100); a.pos(wallPair[2], wallPair[3]); await sleep(400); }
    const s5 = obs.peer(a.id);
    check('M4 a short hop through a wall is refused', wallPair && s5 && Math.hypot(s5.x - wallPair[0], s5.y - wallPair[1]) < 4, wallPair ? `from ${wallPair[0]},${wallPair[1]} to ${wallPair[2]},${wallPair[3]} (${wallPair[1] - wallPair[3]} px, a wall between): observer sees A at ${s5 && s5.x},${s5 && s5.y}; corrections ${a.tps.length - tp3}` : 'no wall pair found');

    // noise claims: running while claiming to stand still
    await sleep(1000); adm.pos(4000, LY); await sleep(150); adm.tx({ t: 'a', c: 'bring', id: a.id }); await sleep(300); a.pos(4000, LY); await sleep(1100);
    let xx = 4000; const claims = []; for (let k = 0; k < 30; k++) { xx += 280 * .05; a.pos(xx, LY, { s: 0, st: 100, ex: 0, sp: 0, ev: [] }); await sleep(50); const q = obs.peer(a.id); if (q && k > 12) claims.push(q.mv[0] + '/' + q.mv[1]); }
    const heardAs = claims.filter(c => c.startsWith('2/')).length;
    check('M5 a client cannot claim to stand still (silent) while it runs', heardAs >= claims.length * .7, `claimed "standing, speed 0" while moving 280 px/s: the server heard ${claims.slice(-6).join(' ')} (state/speed; 2 = running) - running in ${heardAs}/${claims.length} snapshots`);

    /* R: respawn from a living state */
    await sleep(800); a.pos(xx, LY); await sleep(300);
    const before = obs.peer(a.id), tp4 = a.tps.length; a.tx({ t: 'respawn' }); await sleep(400); const after = obs.peer(a.id);
    check('R1 a living player cannot respawn (no free teleport home)', before && after && Math.hypot(after.x - before.x, after.y - before.y) < 30 && Math.hypot(after.x - Ic.x, after.y - Ic.y) > 500 && a.tps.length > tp4,
      `A at ${before && before.x},${before && before.y} sent respawn: still at ${after && after.x},${after && after.y} (spawn is ${Ic.x},${Ic.y}); A was told to stay (${a.tps.length - tp4} correction)`);

    /* D + R2: a death, the victim disconnects at once; the observer still gets the replay and the corpse */
    const v = await client(room, 'VICTIM', true); await sleep(200); v.tx({ t: 'a', c: 'god', id: v.id }); await sleep(100);
    v.pos(5000, LY); await sleep(150); v.pos(5000, LY); await sleep(200);
    const fx0 = obs.fx.length; v.tx({ t: 'a', c: 'preview', k: 'hound', var: 'B' }); await sleep(60); v.ws.close();       // gone before it could send its replay or corpse
    const tD = Date.now(); let body = null, fxS = null;
    while (Date.now() - tD < 9000 && !body) { await sleep(200); fxS = obs.fx.slice(fx0).find(f => f.id === v.id); body = (obs.bodies || []).find(b => b.k === v.id); }
    const nb = (obs.bodies || []).filter(b => b.k === v.id).length;
    check('D1 victim disconnects right after the server commits its death: the observer still sees the death and gets one corpse with its dropped light', fxS && body && nb === 1 && body.c === 'Hound' && body.eq && body.eq.kind && Array.isArray(body.dr) && body.hd && body.hd.length === 4,
      `replay to the observer: ${fxS ? 'yes (variant ' + fxS.v + ', from the server)' : 'NO'}; corpse after ${body ? ((Date.now() - tD) / 1000).toFixed(1) + ' s' : '-'}: ${body ? `at ${body.x},${body.y}, light "${body.eq.kind}" dropped at ${body.dr.join(',')}, hands ${body.hd.length / 2}` : 'NONE'}; corpses for that player ${nb}`);
    await sleep(3000); const nb2 = (obs.bodies || []).filter(b => b.k === v.id).length, late = await client(room, 'LATE', false); await sleep(500);
    check('D2 the aftermath persists: still one corpse later, and a player who joins afterwards gets it too', nb2 === 1 && (late.bodies || []).filter(b => b.k === v.id).length === 1, `observer ${nb2}, late joiner ${(late.bodies || []).filter(b => b.k === v.id).length}`);

    /* R2 / D3: a normal death - the victim's own client reports replay + corpse; the server adds nothing; then respawn works */
    const w2 = await client(room, 'W2', true); await sleep(200); w2.pos(5600, LY); await sleep(150); w2.pos(5600, LY); await sleep(200);
    const fxN = obs.fx.length; w2.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await sleep(300);
    w2.tx({ t: 'fx', k: 'death', c: 'Hound', x: 5600, y: LY, a: 0, sx: 5560, sy: LY, v: 'A', w: 0, lk: 'none|plain|#e6bb76|#ffcc77|none', ek: 'lantern', ec: '#ffe7b2', ep: '', vx: 0, vy: 0, ex: 0 });
    await sleep(1500);
    w2.tx({ t: 'b', n: 'W2', x: 5640, y: LY + 4, a: 1, sx: 1, sy: 1, c: 'Hound', aa: 0, lk: 'none|plain|#e6bb76|#ffcc77|none', ek: 'lantern', ec: '#ffe7b2', ep: '', bl: [], dr: [5650, LY, 0], ht: [5630, LY, 0], hd: [1, 2, 3, 4], ph: 1, ho: 0, tr: [] });
    await sleep(6000);
    const b2 = (obs.bodies || []).filter(b => b.k === w2.id), fx2 = obs.fx.slice(fxN).filter(f => f.id === w2.id);
    check('D3 a normal death: the victim\'s own replay and corpse are used - one replay, one corpse, nothing added by the server', fx2.length === 1 && !fx2[0].srv && b2.length === 1 && !b2[0].srv && b2[0].eq.kind === 'lantern', `replays ${fx2.length} (${fx2.map(f => f.srv ? 'server' : 'client').join(',')}), corpses ${b2.length} (${b2.map(b => b.srv ? 'server' : 'client').join(',')})`);
    const tpR = w2.tps.length; w2.tx({ t: 'respawn' }); await sleep(400);
    const w2s = obs.peer(w2.id);
    check('R2 a dead player can respawn (back at the spawn point, alive)', w2s && w2s.d === 0 && Math.hypot(w2s.x - Ic.x, w2s.y - Ic.y) < 40 && w2.tps.length === tpR, `after respawn the observer sees W2 at ${w2s && w2s.x},${w2s && w2s.y} (spawn ${Ic.x},${Ic.y}), dead flag ${w2s && w2s.d}`);
    w2.tx({ t: 'respawn' }); await sleep(300); const w2b = obs.peer(w2.id); w2.pos(5000, LY); await sleep(200);
    check('R3 ...but only once: a second respawn right after (now alive) is refused', w2.tps.length > tpR, `second respawn: correction sent ${w2.tps.length - tpR}, W2 at ${w2b && w2b.x},${w2b && w2b.y}`);

    /* R4: admin revive leaves a one-time permit (the client's revive handler respawns) */
    w2.pos(Ic.x, Ic.y); await sleep(200); w2.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await sleep(400);
    adm.tx({ t: 'a', c: 'revive', id: w2.id }); await sleep(200); const tpV = w2.tps.length; w2.tx({ t: 'respawn' }); await sleep(300);
    const w2c = obs.peer(w2.id);
    check('R4 an admin revive still works (the revived player\'s respawn is accepted)', w2c && w2c.d === 0 && w2.tps.length === tpV, `W2 dead flag ${w2c && w2c.d}, corrections ${w2.tps.length - tpV}`);
    /* S: the client chooses its own spawn (the bundle picks open floor away from the monsters); the server accepts such a spot, not any spot */
    const j = await client(room, 'J', false); const tpJ = j.tps.length;     // (client() has just sent 'join')
    j.pos(3300, LY); await sleep(400); const js = obs.peer(j.id);
    check('S1 a new run / respawn: the client\'s own spawn choice (open floor, no monster near) is accepted as it always was', js && Math.hypot(js.x - 3300, js.y - LY) < 3 && j.tps.length === tpJ, `J chose 3300,${LY}: observer sees ${js && js.x},${js && js.y}; corrections ${j.tps.length - tpJ}`);
    adm.pos(7000, LY); await sleep(150); adm.pos(7000, LY); await sleep(150); adm.tx({ t: 'a', c: 'near', k: 'hound' }); await sleep(400);
    const hd = ((obs.last && obs.last.e && obs.last.e.h) || []).find(q => Math.hypot(q.x - Ic.x, q.y - Ic.y) > 2000);      // the one placed out by the corridor, far from the spawn point
    j.tx({ t: 'join' }); await sleep(100); const tpJ2 = j.tps.length; if (hd) j.pos(hd.x + 60, hd.y); await sleep(500); const js2 = obs.peer(j.id);
    check('S2 ...but a "spawn" right next to a hound is refused (join is not a teleport)', hd && js2 && Math.hypot(js2.x - hd.x, js2.y - hd.y) > 500 && j.tps.length > tpJ2, `hound at ${hd && Math.round(hd.x)},${hd && Math.round(hd.y)}; J claimed a spawn 60 px from it; observer sees J at ${js2 && js2.x},${js2 && js2.y}; corrections ${j.tps.length - tpJ2}`);
    for (const c of [adm, a, obs, late, w2, j]) try { c.ws.close(); } catch { }
    await sleep(200);
    check('H2 no server errors during all of the above', exited === null && !/Error|TypeError|ReferenceError/.test(log.replace(/fallback failed/, 'X')), exited === null ? 'server alive; log: ' + (log.split('\n').filter(l => /death|Error/.test(l)).slice(0, 3).join(' | ') || 'clean') : 'server EXITED');
  } finally { srv.kill(); }
  const f = R.filter(r => !r.ok); console.log(`\n${R.length - f.length}/${R.length} passed` + (f.length ? '\nFAILED: ' + f.map(r => r.name).join('; ') : '')); process.exitCode = f.length ? 1 : 0;
})();
