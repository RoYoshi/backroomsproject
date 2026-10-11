/* Stage 3D - the death protocol on the wire, against the real server.js over real WebSockets (development only).
 *
 *   node dev/stage-3d/death_net.js [--game DIR] [--out FILE.json]
 *
 * The server runs with a synthetic admin passcode (the same as lib3d.PASS); deaths are started with the admin death preview (the real
 * kill path: ai.js decides, sim.js commits).  Checked:
 *   N1  one death, one event: the victim's snapshot carries the kill record with its death id (de) and the inputs of the death; every other
 *       client gets exactly one replay of it, from the server, with the same id and the same inputs; the victim gets none; the corpse is
 *       made by the server when the death's length has passed, with the same id, once
 *   N2  what a client says about deaths changes nothing: a death replay or a corpse from the victim, from a living player, forged, repeated
 *       or malformed is not relayed and adds no corpse (bodies version unchanged)
 *   N3  the victim disconnects the moment it dies: the replay and the corpse still come, on time
 *   N4  a player who arrives while a death is playing gets the replay with how long it has run (el), then the corpse
 *   N5  a player who arrives later gets the corpse with its age (ag)
 *   N6  an admin revive during the death: everyone else is told to end the replay; no corpse
 *   N7  a world reset during the death: no corpse from the old world appears in the new one
 *   N8  respawning early does not cancel the corpse; dying again replaces it (one corpse per player)
 *   N9  NEW RUN vanish: its light-left-behind record is accepted only from a living player at its own position, once per 5 s
 *   N10 sizes: the replay message and a corpse record stay small; 'bodies' per corpse within D0's + 10 %
 *   N11 400 random malformed death messages: the server keeps running, no corpse appears
 * Exit status 0 only if every check passes. */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || path.join(__dirname, '..', '..')), PASS = 'd3-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const check = (name, ok, note) => { R.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + '\n       ' + note); };
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const DURS = require(path.join(GAME, 'death_srv.js')).DP.DURS;
let PORT = 0;

async function client(room, name, admin) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws?room=${room}`), c = { ws, name, id: 0, last: null, mks: [], fx: [], bodies: null, bodyMsgs: [], tps: [], ares: [], bytes: {} };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; }
    c.bytes[m.t] = Math.max(c.bytes[m.t] || 0, Buffer.byteLength(ev.data));
    if (m.t === 'hi') c.id = m.id; else if (m.t === 's') { c.last = m; if (m.mk) c.mks.push({ at: Date.now(), mk: m.mk, ms: m.ms }); } else if (m.t === 'tp') c.tps.push(m);
    else if (m.t === 'fx') c.fx.push(Object.assign({ at: Date.now(), bytes: Buffer.byteLength(ev.data) }, m)); else if (m.t === 'bodies') { c.bodies = m.b; c.bodyMsgs.push({ at: Date.now(), v: m.v, b: m.b, bytes: Buffer.byteLength(ev.data) }); } else if (m.t === 'ares') c.ares.push(m); };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.tx = o => ws.readyState === 1 && ws.send(typeof o === 'string' ? o : JSON.stringify(o));
  c.pos = (x, y) => c.tx({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: name, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 0, st: 100, ex: 0, sp: 0, ev: [] } });
  c.peer = id => c.last && (c.last.p || []).find(q => q.id === id);
  c.body = id => (c.bodies || []).filter(b => b.k === id);
  await sleep(150); c.tx({ t: 'join' }); await sleep(250);
  if (admin) { c.tx({ t: 'admin', pass: PASS }); await sleep(200); }
  return c;
}
const LY = 3504;
async function place(c, x) { c.pos(x, LY); await sleep(150); c.pos(x, LY); await sleep(250); }
async function untilMk(c, n0, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (c.mks.length > n0) return c.mks[c.mks.length - 1]; await sleep(30); } return null; }
async function until(f, ms = 9000) { const t = Date.now(); while (Date.now() - t < ms) { const v = f(); if (v) return v; await sleep(40); } return null; }
const durOf = mk => (DURS[mk.k === 'Smiler' ? 'Smiler' : 'Hound'] || {})[mk.v] || 4.4;

(async () => {
  PORT = await freePort();
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  let exited = null; srv.on('exit', c => exited = c);
  await sleep(1200);
  const out = { tool: 'dev/stage-3d/death_net.js', game: GAME, checks: R, sizes: {} };
  try {
    const room = 'dn' + PORT;
    const O = await client(room, 'OBS', true); O.tx({ t: 'a', c: 'god', id: O.id }); await place(O, 4700);
    // N1 ------------------------------------------------------------------------------------------------
    const V = await client(room, 'VIC', true); V.tx({ t: 'a', c: 'god', id: V.id }); await place(V, 5000);
    let n0 = V.mks.length, fx0 = O.fx.length, b0 = O.bodyMsgs.length; V.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' });
    const k1 = await untilMk(V, n0), mk = k1 && k1.mk;
    // the victim's client plays it; meanwhile it (an old or a hostile client) reports a replay and a corpse of its own - ignored
    V.tx({ t: 'fx', k: 'death', c: 'Hound', x: 100, y: 100, a: 0, sx: 50, sy: 100, v: 'C', w: [0, 0, 0] });
    V.tx({ t: 'b', c: 'Hound', n: 'VIC', x: 200, y: 200, a: 1, sx: 1, sy: 1, aa: 0, bl: [[1, 1, 1]], dr: [1, 1, 0], ht: [1, 1, 0], hd: [1, 2, 3, 4], ph: 1, ka: [10, 10, 0] });
    const body1 = await until(() => O.body(V.id).find(b => mk && b.de === mk.de), (mk ? durOf(mk) : 5) * 1000 + 2500);
    const tBody = body1 ? (O.bodyMsgs.find(m => m.b.some(b => b.k === V.id && b.de === mk.de)).at - k1.at) / 1000 : null;
    await sleep(600);
    const fxs1 = O.fx.slice(fx0).filter(f => f.id === V.id && f.k === 'death');
    check('N1a the kill record reaches the victim with a death id and the death\'s inputs', mk && mk.de >= 1 && Number.isFinite(mk.vx) && Number.isFinite(mk.vy) && mk.ex != null && /^[ABCD]$/.test(mk.v), JSON.stringify(mk));
    check('N1b every other client gets exactly one replay, from the server, with the same id and the same inputs; the victim gets none',
      fxs1.length === 1 && fxs1[0].de === mk.de && fxs1[0].x === mk.x && fxs1[0].y === mk.y && fxs1[0].a === mk.a && fxs1[0].sx === mk.ax && fxs1[0].sy === mk.ay && fxs1[0].v === mk.v && fxs1[0].vx === mk.vx && fxs1[0].ex === mk.ex && !V.fx.some(f => f.id === V.id),
      `replays to the observer: ${fxs1.length} ${JSON.stringify(fxs1[0] || {}).slice(0, 200)}; to the victim: ${V.fx.filter(f => f.id === V.id).length}`);
    check('N1c the server makes the corpse itself when the death\'s length has passed: same id, once, where the death left it (not where the client said)',
      body1 && O.body(V.id).length === 1 && Math.abs(tBody - durOf(mk)) < .45 && Math.hypot(body1.x - mk.x, body1.y - mk.y) < 200 && body1.x !== 200,
      `corpse ${body1 ? `de ${body1.de} at ${body1.x},${body1.y} after ${tBody.toFixed(2)} s (death length ${durOf(mk)} s)` : 'NONE'}; corpses for the victim: ${O.body(V.id).length}`);
    check('N2a the victim\'s own replay and corpse reports are not relayed and add no corpse', fxs1.length === 1 && O.bodyMsgs.slice(b0).filter(m => m.b.some(b => b.k === V.id)).every(m => m.b.filter(b => b.k === V.id).every(b => b.de === mk.de)),
      `bodies messages since the death: ${O.bodyMsgs.length - b0}`);
    out.sizes.fx = fxs1[0] ? fxs1[0].bytes : null; out.sizes.corpse = body1 ? Buffer.byteLength(JSON.stringify(body1)) : null;
    V.tx({ t: 'respawn' }); await sleep(500);
    // N2b: a living player's claims, forged, repeated, malformed
    const bv0 = O.bodyMsgs.length ? O.bodyMsgs[O.bodyMsgs.length - 1].v : 0, ofx0 = O.fx.length;
    for (let i = 0; i < 5; i++) {
      V.tx({ t: 'fx', k: 'death', c: 'Hound', x: 5000, y: LY, v: 'A' }); V.tx({ t: 'b', c: 'Hound', x: 5000, y: LY, n: 'VIC' }); V.tx({ t: 'b', c: 'Smiler', x: 1e9, y: -5, bl: Array(500).fill([1, 2, 3]) });
      V.tx({ t: 'b', c: 'Vanish', x: 100, y: 100, dr: [100, 100, 0] });                          // a NEW RUN light far from where it stands
    }
    await sleep(700);
    const bv1 = O.bodyMsgs.length ? O.bodyMsgs[O.bodyMsgs.length - 1].v : 0;
    check('N2b a living player cannot claim a death replay or a corpse, forged, repeated or far away (bodies version unchanged)', bv1 === bv0 && O.fx.length === ofx0, `bodies version ${bv0} -> ${bv1}; replays ${O.fx.length - ofx0}`);
    // N9: a NEW RUN vanish at its own position: once per 5 s
    const vp = O.peer(V.id) || { x: 5000, y: LY }, va0 = O.bodyMsgs.length;                // where the server has it (respawn moved it)
    V.tx({ t: 'b', c: 'Vanish', n: 'VIC', x: vp.x, y: vp.y, dr: [vp.x + 12, vp.y + 8, 1], ek: 'flashlight', ec: '#ffe7b2', lo: 1 }); await sleep(400);
    V.tx({ t: 'b', c: 'Vanish', n: 'VIC', x: vp.x, y: vp.y, dr: [vp.x + 12, vp.y + 8, 1], ek: 'flashlight', ec: '#ffe7b2', lo: 1 }); await sleep(400);
    const vb = O.body(V.id);
    check('N9 a NEW RUN light-left-behind record is accepted from a living player at its own position, once per 5 s (replacing its corpse: one per player)', vb.length === 1 && vb[0].c === 'Vanish' && O.bodyMsgs.length - va0 === 1, `records ${vb.length} (${vb.map(b => b.c)}), bodies messages ${O.bodyMsgs.length - va0}`);
    // N8: respawn early, then die again
    await place(V, 5000); n0 = V.mks.length; V.tx({ t: 'a', c: 'preview', k: 'smiler', var: 'A' }); const k2 = await untilMk(V, n0); await sleep(900); V.tx({ t: 'respawn' });
    const body2 = await until(() => k2 && O.body(V.id).find(b => b.de === k2.mk.de), 9000);
    check('N8a respawning one second into the death does not cancel its corpse', !!body2 && O.body(V.id).length === 1 && body2.c === 'Smiler', body2 ? `corpse de ${body2.de} (${body2.c})` : 'NONE');
    n0 = V.mks.length; await sleep(1500); V.tx({ t: 'a', c: 'preview', k: 'hound', var: 'D' }); const k3 = await untilMk(V, n0);
    const body3 = await until(() => k3 && O.body(V.id).find(b => b.de === k3.mk.de), 9000);
    check('N8b dying again replaces the corpse: one per player', !!body3 && O.body(V.id).length === 1 && body3.de !== (body2 && body2.de), `now ${O.body(V.id).length} corpse(s), de ${body3 && body3.de}`);
    V.tx({ t: 'respawn' }); await sleep(500);
    // N3: disconnect at once
    const W = await client(room, 'GONE', true); W.tx({ t: 'a', c: 'god', id: W.id }); await place(W, 5300);
    const fxW0 = O.fx.length; n0 = W.mks.length; W.tx({ t: 'a', c: 'preview', k: 'hound', var: 'B' }); const k4 = await untilMk(W, n0, 6000); W.ws.close();
    const body4 = await until(() => k4 && O.body(W.id).find(b => b.de === k4.mk.de), 10000);
    const fxW = O.fx.slice(fxW0).filter(f => f.id === W.id);
    check('N3 the victim disconnects as it dies: everyone still gets the replay and, on time, the corpse with its light', fxW.length === 1 && body4 && Array.isArray(body4.dr) && body4.eq && Math.abs((Date.now() - k4.at) / 1000 - durOf(k4.mk)) < 1.5 + 2,
      `replays ${fxW.length}; corpse ${body4 ? `de ${body4.de}, light ${body4.eq.kind} at ${body4.dr}` : 'NONE'}`);
    // N4 / N5: late joiners
    const V2 = await client(room, 'VIC2', true); V2.tx({ t: 'a', c: 'god', id: V2.id }); await place(V2, 5600);
    n0 = V2.mks.length; V2.tx({ t: 'a', c: 'preview', k: 'smiler', var: 'D' }); const k5 = await untilMk(V2, n0); await sleep(1500);
    const L1 = await client(room, 'LATE1', false); const lfx = await until(() => L1.fx.find(f => f.id === V2.id && f.k === 'death'), 3000);
    const lbody = await until(() => k5 && L1.body(V2.id).find(b => b.de === k5.mk.de), 9000);
    check('N4 a player arriving during a death gets the replay with how far it has run, then the same corpse', lfx && lfx.de === k5.mk.de && lfx.el >= 1 && lfx.el < 3.5 && !!lbody, `replay el ${lfx && lfx.el}, de ${lfx && lfx.de}; corpse ${lbody ? 'de ' + lbody.de : 'NONE'}`);
    await sleep(2500);
    const L2 = await client(room, 'LATE2', false); await sleep(600);
    const ag = (L2.bodies || []).find(b => b.k === V2.id);
    check('N5 a player arriving later gets the corpse with its age (ag)', ag && ag.ag >= 2 && ag.de === k5.mk.de, ag ? `ag ${ag.ag} s` : 'NONE');
    V2.tx({ t: 'respawn' }); await sleep(400);
    // N6: admin revive mid-death
    const fxE0 = O.fx.length; n0 = V2.mks.length; V2.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); const k6 = await untilMk(V2, n0); await sleep(1200);
    O.tx({ t: 'a', c: 'revive', id: V2.id }); await sleep((durOf(k6.mk) + 1) * 1000);
    const endMsg = O.fx.slice(fxE0).find(f => f.k === 'end' && f.id === V2.id);
    check('N6 an admin revive during the death: the others are told to end the replay; no corpse', endMsg && endMsg.de === k6.mk.de && !O.body(V2.id).some(b => b.de === k6.mk.de), `end ${JSON.stringify(endMsg || null)}; corpse for that death: ${O.body(V2.id).some(b => b.de === k6.mk.de)}`);
    V2.tx({ t: 'respawn' }); await sleep(400);
    // N7: world reset mid-death
    await place(V2, 5600); n0 = V2.mks.length; V2.tx({ t: 'a', c: 'preview', k: 'hound', var: 'D' }); const k7 = await untilMk(V2, n0); await sleep(800);
    O.tx({ t: 'a', c: 'world' }); await sleep((durOf(k7.mk) + 1.2) * 1000);
    check('N7 a world reset during the death: no corpse from the old world in the new one', !(O.bodies || []).some(b => b.de === k7.mk.de), `corpses now ${JSON.stringify((O.bodies || []).map(b => [b.k, b.de]))}`);
    // N10: sizes
    const bm = O.bodyMsgs[O.bodyMsgs.length - 1];
    out.sizes.bodiesMsg = bm ? { bytes: bm.bytes, corpses: bm.b.length } : null;
    const per = out.sizes.corpse;
    check('N10 sizes: the replay message under 400 bytes; a corpse record within D0\'s 359 bytes + 10 %', out.sizes.fx > 0 && out.sizes.fx < 400 && per > 0 && per <= 395, `replay ${out.sizes.fx} B; corpse ${per} B`);
    // N11: fuzz
    const F = await client(room, 'FUZZ', false); const fb0 = O.bodyMsgs.length, ffx0 = O.fx.length;
    const rnd = () => { const r = Math.random(); return r < .2 ? null : r < .4 ? Math.random() * 1e12 - 5e11 : r < .55 ? 'x'.repeat(Math.random() * 300 | 0) : r < .7 ? [1, 'a', null, { q: 1 }] : r < .85 ? NaN : { __proto__: { k: 1 }, toString: 1 }; };
    for (let i = 0; i < 400; i++) {
      const m = { t: i % 3 ? 'b' : 'fx', k: ['death', 'vanish', 'end', rnd()][i % 4], c: ['Hound', 'Smiler', 'Vanish', rnd()][i % 4], x: rnd(), y: rnd(), a: rnd(), v: rnd(), w: rnd(), bl: rnd(), dr: rnd(), ht: rnd(), hd: rnd(), tr: rnd(), de: rnd(), el: rnd(), ka: rnd() };
      F.tx(i % 17 === 0 ? '{"t":"b",' : JSON.stringify(m));
    }
    await sleep(1200);
    const alive = await client(room, 'AFTER', false);
    const fzd = O.fx.slice(ffx0).filter(f => f.k !== 'vanish');                // (a NEW RUN vanish replay is a living player's right: one may pass its own checks)
    check('N11 400 random malformed death messages: the server keeps running and no corpse or death replay appears', exited === null && alive.id > 0 && fzd.length === 0 && !O.bodyMsgs.slice(fb0).some(m => m.b.some(b => b.k === F.id && b.c !== 'Vanish')),
      `server ${exited === null ? 'alive' : 'EXITED'}; death replays ${fzd.length} (vanish replays ${O.fx.length - ffx0 - fzd.length}); bodies messages ${O.bodyMsgs.length - fb0}`);
    check('N12 no server errors', !/Error|TypeError|\[death\] corpse failed/.test(log), log.split('\n').filter(l => /Error|failed/.test(l)).slice(0, 3).join(' | ') || 'none');
  } catch (e) { check('the test itself ran', false, String(e && e.stack || e)); }
  srv.kill();
  out.serverLog = log.split('\n').filter(l => /\[death\]/.test(l)).slice(0, 40);
  out.ok = R.every(r => r.ok);
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  console.log(`\n${R.filter(r => r.ok).length}/${R.length} passed`); if (!out.ok) console.log('FAILED: ' + R.filter(r => !r.ok).map(r => r.name).join('; '));
  process.exit(out.ok ? 0 : 1);
})();
