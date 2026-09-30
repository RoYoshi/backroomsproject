/* Real HTTP/WebSocket transport with a controlled server-side dead-player
 * fixture. This isolates pose transport/validation from nondeterministic AI. */
'use strict';
const { spawn } = require('child_process'), assert = require('assert/strict');
const { harness, ROOT } = require('./physical-harness');
const port = 22000 + process.pid % 8000, url = 'http://127.0.0.1:' + port;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fixture = `const real=require('./sim.js');require.cache[require.resolve('./sim.js')].exports=function(o){const s=real(o),join=s.join;s.join=p=>{join(p);if(p.id===1)p.dead='Hound'};return s};process.argv[2]=${port};require('./server.js');`;
const server = spawn(process.execPath, ['-e', fixture], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
const clients = [];
async function waitFor(fn, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await sleep(30); } throw Error('Timed out: ' + log.slice(-1000)); }
async function client() {
  const ws = new WebSocket(url.replace('http:', 'ws:') + '/ws?room=physical'), msgs = [];
  const c = { ws, msgs, send: m => ws.send(JSON.stringify(m)) }; clients.push(c);
  ws.addEventListener('message', e => msgs.push(JSON.parse(e.data)));
  await waitFor(() => ws.readyState === 1 && msgs.some(m => m.t === 'hi'));
  c.id = msgs.find(m => m.t === 'hi').id; c.send({ t: 'join' }); return c;
}
(async () => {
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(url + '/index.html')).ok) break; } catch {} await sleep(50); }
    assert.equal((await fetch(url + '/death-motion.js')).status, 200);
    assert.equal((await fetch(url + '/server.js')).status, 404);
    console.log('PASS client physics is served; server source stays private');
    const a = await client(), b = await client();
    const h = harness(), d = new h.Death(); d.start('Hound', 0, { x: 200, y: 240 }, -1, null, { v: 'B' });
    const fx = { t: 'fx', k: 'death', c: 'Hound', x: d.victim.x, y: d.victim.y, a: d.victim.angle, sx: d.source.x, sy: d.source.y, v: d.variant, mi: d.motionInitial };
    assert(JSON.stringify(fx).length < 1400); a.send(fx);
    await waitFor(() => b.msgs.some(m => m.t === 'fx'));
    assert.equal(JSON.stringify(b.msgs.find(m => m.t === 'fx').mi), JSON.stringify(d.motionInitial));
    console.log('PASS seeded initial hands/body are relayed intact to another player');
    d.frame(4); const f = new h.Finish(); f.death = d; f.completeDeath(4); const r = h.corpses[0];
    const body = { t: 'b', n: 'PHYSICAL', x: +r.x.toFixed(4), y: +r.y.toFixed(4), a: +r.angle.toFixed(6), sx: 1, sy: 1, c: r.cause, aa: r.attackAngle,
      lk: 'cap|plain|#e6bb76|#ffcc77|canvas', ek: 'flashlight', ec: '#ffe7b2', ep: '', lo: 1, ps: r.pose,
      bl: r.blood.map(p => [Math.round(p.x), Math.round(p.y), p.seed]), dr: [r.dropped.x, r.dropped.y, r.dropped.angle], ht: [r.hat.x, r.hat.y, r.hat.angle] };
    assert(JSON.stringify(body).length < 1400); a.send(body);
    await waitFor(() => b.msgs.some(m => m.t === 'bodies' && m.b.length === 1));
    let rec = b.msgs.findLast(m => m.t === 'bodies').b[0]; assert.equal(JSON.stringify(rec.ps), JSON.stringify(r.pose)); assert.deepEqual(rec.dr, body.dr);
    console.log('PASS finished hands, equipment and beam pose persist in shared corpse state');
    b.send({ ...body, n: 'LIVING SPOOF' }); b.send({ ...fx, mi: d.motionInitial }); await sleep(220);
    assert(!a.msgs.some(m => m.t === 'fx' && m.id === b.id)); assert.equal(b.msgs.findLast(m => m.t === 'bodies').b.length, 1);
    console.log('PASS a living client cannot create a death replay or corpse');
    const c = await client(); await waitFor(() => c.msgs.some(m => m.t === 'bodies' && m.b.length === 1));
    assert.equal(JSON.stringify(c.msgs.findLast(m => m.t === 'bodies').b[0].ps), JSON.stringify(r.pose));
    console.log('PASS a late joiner receives the same settled corpse pose');
    a.send({ ...body, ps: { ...r.pose, h: [[-10000, 0], [0, 0]] } });
    await waitFor(() => b.msgs.findLast(m => m.t === 'bodies')?.b[0]?.ps === null);
    console.log('PASS malformed physical poses are rejected with a legacy-safe fallback');
    a.send(body); await waitFor(() => b.msgs.findLast(m => m.t === 'bodies')?.b[0]?.ps?.v === 1);
    console.log('6 multiplayer transport checks passed; corpse packet ' + JSON.stringify(body).length + '/1400 bytes');
  } finally { clients.forEach(c => c.ws.close()); server.kill(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
