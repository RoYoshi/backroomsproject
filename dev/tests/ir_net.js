/* PART 2 / 2C-IR on the wire (real server.js, real WebSockets): infrared is presentation shared between players, nothing more.
 *   node dev/tests/ir_net.js
 * N1 a raised camcorder's emitter level reaches the other players (they draw it only through their own night vision - ir_test.py R7)
 * N2 only a raised camcorder can carry infrared: a torch claiming it, or a lowered camcorder, is relayed as 0; values are clamped to 0..2
 * N3 the raised camcorder still shows as raised to the others (l: 1) - but the AI never treats it as a light (s_ir.js I3)
 * N4 no server errors */
'use strict';
const { spawn } = require('child_process');
const GAME = require('../paths.js');
const PORT = +(process.env.PORT || 9486);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const check = (name, ok, note) => { R.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + '\n       ' + note); };
async function client(room, name) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws?room=${room}`), c = { ws, id: 0, last: null };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.t === 'hi') c.id = m.id; else if (m.t === 's') c.last = m; };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.tx = o => ws.readyState === 1 && ws.send(JSON.stringify(o));
  c.pos = (x, y, k, l, ir) => c.tx({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l, ir, k, n: name, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 0, st: 100, ex: 0, sp: 0, ev: [] } });
  c.peer = id => c.last && (c.last.p || []).find(q => q.id === id);
  await sleep(150); c.tx({ t: 'join' }); await sleep(250); return c;
}
(async () => {
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  await sleep(1200);
  try {
    const room = 'irn' + Date.now() % 1e5, A = await client(room, 'CAM'), B = await client(room, 'TORCH'), C = await client(room, 'OBS');
    const keep = (who, k, l, ir) => setInterval(() => who.pos(960, 3264, k, l, ir), 60);
    let ta = keep(A, 'camcorder', 1, 2), tb = keep(B, 'flashlight', 1, 2), tc = keep(C, 'flashlight', 0, 0);
    await sleep(700);
    const a1 = C.peer(A.id), b1 = C.peer(B.id);
    check('N1 a raised camcorder\'s infrared level reaches the other players', a1 && a1.ir === 2, `observer sees the camcorder with ir ${a1 && a1.ir}`);
    clearInterval(ta); ta = keep(A, 'camcorder', 0, 2); clearInterval(tb); tb = keep(B, 'flashlight', 1, 7); await sleep(700);
    const a2 = C.peer(A.id), b2 = C.peer(B.id);
    clearInterval(ta); ta = keep(A, 'camcorder', 1, 9); await sleep(700); const a3 = C.peer(A.id);
    check('N2 only a raised camcorder carries infrared (a torch claiming it, or a lowered camcorder, relays 0; values clamp to 0..2)', b1 && b1.ir === 0 && b2 && b2.ir === 0 && a2 && a2.ir === 0 && a3 && a3.ir === 2, `torch claiming 2 -> ${b1 && b1.ir}, claiming 7 -> ${b2 && b2.ir}; lowered camcorder claiming 2 -> ${a2 && a2.ir}; raised camcorder claiming 9 -> ${a3 && a3.ir}`);
    check('N3 the raised camcorder is still shown as raised to the others', a3 && a3.l === 1 && a2 && a2.l === 0, `raised l=${a3 && a3.l}, lowered l=${a2 && a2.l}`);
    clearInterval(ta); clearInterval(tb); clearInterval(tc);
    check('N4 no server errors', !/Error|TypeError|at .*server\.js/.test(log), log.split('\n').filter(l => /rror/.test(l)).slice(0, 3).join(' | ') || 'clean');
    for (const c of [A, B, C]) c.ws.close();
  } catch (e) { check('ir_net crashed', false, e.stack); }
  srv.kill();
  console.log(`\n${R.filter(Boolean).length}/${R.length} passed`); process.exit(R.every(Boolean) ? 0 : 1);
})();
