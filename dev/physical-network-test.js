/* Real HTTP/WebSocket transport. Only the kill fixture is controlled; map,
 * physical replay, validation, clocks and corpse storage use shipped code. */
'use strict';
const { spawn } = require('child_process'), assert = require('assert/strict');
const { harness, ROOT, Container } = require('./physical-harness');
const { hash } = require('../death-motion');
const port = 22000 + process.pid % 8000, url = 'http://127.0.0.1:' + port;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fixture = `const real=require('./sim.js');require.cache[require.resolve('./sim.js')].exports=function(o){const s=real(o),join=s.join;s.admin.freeze(true);s.join=p=>{join(p);if(p.id===1){Object.assign(p,{x:1056,y:3264,dead:'Hound',dseq:1,kill:{k:'Hound',v:'B',e:'fixture',ax:976,ay:3264,aa:0,w:0,x:1056,y:3264,a:0}})}if(p.id===4)p.dead='Hound'};return s};process.argv[2]=${port};require('./server.js');`;
const server = spawn(process.execPath, ['-e', fixture], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', checks = 0; server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
const clients = [];
const pass = label => { checks++; console.log('PASS ' + label); };
async function waitFor(fn, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await sleep(30); } throw Error('Timed out: ' + log.slice(-1000)); }
async function client() {
  const ws = new WebSocket(url.replace('http:', 'ws:') + '/ws?room=physical'), msgs = [];
  const c = { ws, msgs, send: m => ws.send(JSON.stringify(m)) }; clients.push(c);
  ws.addEventListener('message', e => msgs.push(JSON.parse(e.data)));
  await waitFor(() => ws.readyState === 1 && msgs.some(m => m.t === 'hi'));
  c.id = msgs.find(m => m.t === 'hi').id; c.send({ t: 'join' }); return c;
}
const latest = c => c.msgs.findLast(m => m.t === 'bodies')?.b || [];
(async () => {
  try {
    await waitFor(() => log.includes('http://localhost:'));
    for (const p of ['/death-motion.js', '/death-lab.js', '/death-lab.css']) assert.equal((await fetch(url + p)).status, 200);
    assert.equal((await fetch(url + '/server.js')).status, 404);
    pass('client physics/lab are served; server source stays private');
    const a = await client(), b = await client();
    assert(Math.abs(a.msgs.find(m => m.t === 'hi').ts - Date.now()) < 1500); pass('handshake provides a clock for timestamped remote events');
    const sim = require('../sim')({ seed: 7, director: false }), ad = sim.adapter, h = harness((x, y) => ad.blockers(x, y, 'crawl'));
    h.win.WORLD = require('../world'); h.win.__api.Oc = ad.rooms;
    Object.assign(h.H, { id: a.id, x: 1056, y: 3264 }); h.av.update(0, true, false, h.H);
    const d = new h.Death(); d.start('Hound', 0, { x: 976, y: 3264 }, -1, null, { v: 'B', e: 'fixture', seq: 1, aa: 0 });
    const fx = { t: 'fx', k: 'death', c: 'Smiler', x: d.victim.x, y: d.victim.y, a: d.victim.angle, sx: 1, sy: 1, v: 'D', mi: { ...d.motionInitial, seed: 123 }, lk: 'cap|plain|#e6bb76|#ffcc77|canvas', ek: 'flashlight', age: .03 };
    assert(JSON.stringify(fx).length < 1400); a.send(fx);
    await waitFor(() => b.msgs.some(m => m.t === 'fx'));
    const event = b.msgs.find(m => m.t === 'fx');
    assert.equal(event.c, 'Hound'); assert.equal(event.v, 'B'); assert.equal(event.sx, 976); assert.equal(event.sy, 3264);
    assert.equal(event.mi.seed, hash([a.id, 1, 'fixture', 'Hound', 'B'].join('|')));
    assert.equal(JSON.stringify(event.mi), JSON.stringify(d.motionInitial)); assert(Math.abs(Date.now() - event.at) < 600);
    pass('server owns attacker, variant, seed and timestamp; compact live pose is relayed');
    d.frame(6); h.av.position.set(d.body.x, d.body.y); h.av.rotation = d.body.angle; h.av.deathPose(d.injury, d.impact, true, d.physicalPose);
    const f = new h.Finish(); f.death = d; f.person = h.av; f.creatures = new Container(); f.completeDeath(6); const r = h.corpses[0];
    const body = { t: 'b', n: 'PHYSICAL', x: +r.x.toFixed(4), y: +r.y.toFixed(4), a: +r.angle.toFixed(6), sx: 1, sy: 1, c: r.cause, aa: r.attackAngle,
      lk: fx.lk, ek: 'flashlight', ec: '#ffe7b2', ep: '', lo: 1, ps: r.pose,
      bl: r.blood.map(p => [+p.x.toFixed(4), +p.y.toFixed(4), p.seed, p.at, p.angle]), dr: [r.dropped.x, r.dropped.y, r.dropped.angle], ht: [r.hat.x, r.hat.y, r.hat.angle] };
    const bytes = Buffer.byteLength(JSON.stringify(body)); assert(bytes < 1400, 'corpse exceeds transport limit: ' + bytes);
    a.send(body); await sleep(200); assert.equal(latest(b).length, 0); pass('early corpse publication is rejected while the physical event is active');
    await waitFor(() => Date.now() > event.at + d.duration * 1000 + 40, 6000);
    a.send({ ...body, x: 5000, y: 5000, a: 10, dr: [5000, 5000, 8] });
    await waitFor(() => latest(b).length === 1);
    const rec = latest(b)[0]; assert.equal(JSON.stringify(rec.ps), JSON.stringify(r.pose));
    assert(Math.hypot(rec.x - r.x, rec.y - r.y) < .00001); assert.equal(rec.a, r.angle);
    assert.deepEqual(rec.dr, [r.dropped.x, r.dropped.y, r.dropped.angle]);
    assert(ad.clear(rec.x, rec.y, 17.99, 'crawl')); pass('server derives the exact collision-aware endpoint and ignores spoofed body/light transforms');
    b.send({ ...body, n: 'LIVING SPOOF' }); b.send({ ...fx }); await sleep(180);
    assert(!a.msgs.some(m => m.t === 'fx' && m.id === b.id)); assert.equal(latest(b).length, 1); pass('a living client cannot create a death replay or corpse');
    const c = await client(); await waitFor(() => latest(c).length === 1);
    assert.equal(JSON.stringify(latest(c)[0]), JSON.stringify(rec)); pass('late joiner receives the same settled corpse, equipment and decals');
    a.send({ ...body, x: 5000, ps: { ...r.pose, h: [[-10000, 0], [0, 0]] } }); await sleep(180);
    assert.equal(JSON.stringify(latest(b)[0].ps), JSON.stringify(rec.ps)); assert.equal(latest(b)[0].x, rec.x);
    pass('malformed pose cannot bypass an authoritative physical event');
    const legacy = await client(), oldInitial = { seed: 21, h: [[-13, -13], [13, -13]], b: [1, 1, 0], gv: [13, -13, 0] };
    legacy.send({ ...fx, c: 'Hound', v: 'B', mi: oldInitial }); await waitFor(() => b.msgs.some(m => m.t === 'fx' && m.id === legacy.id));
    assert.equal(b.msgs.findLast(m => m.t === 'fx' && m.id === legacy.id).mi.v, 1);
    legacy.send({ ...body, ps: { v: 1, seed: 21, h: r.pose.h, b: r.pose.b, g: r.pose.g, gd: 1, hd: 0 }, n: 'LEGACY' }); await waitFor(() => latest(b).length === 2);
    assert.equal(latest(b).find(r => r.k === legacy.id).ps.v, 1);
    legacy.send({ ...body, ps: null, n: 'LEGACY' }); await waitFor(() => latest(b).find(r => r.k === legacy.id)?.ps === null);
    pass('older physical events and clients without pose data retain their original corpse timing');
    console.log(checks + ' multiplayer transport checks passed; corpse packet ' + bytes + '/1400 bytes');
  } finally { clients.forEach(c => c.ws.close()); server.kill(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
