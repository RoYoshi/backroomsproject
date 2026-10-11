/* Stage 3H0 - server golden-trace scenarios (development only).  Each scenario drives server.js through srv_harness.js's closed world.
 * Inputs only: every scenario sends the same bytes at the same fake times whatever server.js does, except where it reads the server's own
 * answers to aim the next input (the player's id, the positions of glitched walls and items in a snapshot), which is how a real client
 * behaves too.  Coordinates are found with the real sim's pure geometry (clearAt), never by draining its state. */
'use strict';
const LOOK = 'cap|freckles|#e6bb76|#3a6ea5|none', LOOK2 = 'none|plain|#e6bb76|#ffcc77|none';
const P = (x, y, o = {}) => Object.assign({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l: 1, ir: 0, k: 'flashlight', lp: '#ffe7b2,#333333,#888888', n: 'QA', c: '#ffe7b2', f: -1, lk: LOOK2 }, o);
const MV = (s = 1, sp = 150, st = 100, ex = 0, ev) => Object.assign({ s, sp, st, ex }, ev ? { ev } : {});
const PASS = 'h0-synthetic-admin';

function coverage(H, clients) {
  const o = {};
  for (const c of clients) { const k = {}; for (const m of c.rx) { const t = m.t || ('op' + m.__op); k[t] = (k[t] || 0) + 1; } o[c.cid] = k; }
  H.out('coverage', o);
}
/* a straight walk from (x, y) along angle a while the floor is clear, one packet per dt ms */
function walk(H, c, sim, x, y, a, n, step = 8, dt = 50, extra = {}) {
  for (let i = 0; i < n; i++) {
    const nx = Math.round(x + Math.cos(a) * step), ny = Math.round(y + Math.sin(a) * step);
    if (!sim.clearAt(nx, ny, 22)) { H.note('walk blocked at ' + nx + ',' + ny); break; }
    x = nx; y = ny; H.advance(dt);
    c.send(P(x, y, Object.assign({ vx: Math.round(Math.cos(a) * step * 1000 / dt), vy: Math.round(Math.sin(a) * step * 1000 / dt), a: +a.toFixed(2), mv: MV(1, step * 1000 / dt) }, extra)));
  }
  return { x, y };
}
/* the first open direction from (x, y) (the real sim's floor test) */
function openDir(sim, x, y, len = 400) {
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; let ok = true; for (let s = 8; s <= len; s += 8) if (!sim.clearAt(x + Math.cos(a) * s, y + Math.sin(a) * s, 22)) { ok = false; break; } if (ok) return a; }
  return 0;
}

module.exports = {
  /* start-up only: requires, timers, the listen line, a few empty wakes */
  async boot(H) { H.advance(100); },

  /* HTTP: every route, allowlisted or not, with and without gzip; traversal and malformed escapes; the sounds folder */
  async http_base(H) {
    const GZ = { 'accept-encoding': 'gzip, deflate, br' };
    const reqs = [
      ['/', GZ], ['/index.html', {}], ['/index.html?room=x&y=1', GZ], ['/index.html', { 'accept-encoding': 'deflate, br' }], ['/index.html', { 'accept-encoding': 'GZIP' }],
      ['/index.html', { 'accept-encoding': 'x-gzip' }], ['/mp.js', GZ], ['/mp.js', {}], ['/dphys.js', GZ], ['/camera_policy.js', {}], ['/timing_policy.js', GZ],
      ['/world.js', GZ], ['/move.js', {}], ['/ents.js', GZ], ['/hud.js', {}], ['/gore.js', GZ], ['/light.js', {}], ['/glitch.js', GZ], ['/camcorder.js', {}], ['/inventory.js', GZ], ['/sfx.js', {}],
      ['/assets/ui.css', GZ], ['/assets/ui.js', {}], ['/assets/credits_data.js', GZ], ['/assets/carpet.png', GZ], ['/assets/MAIN_MENU_LOGO_USER_SUPPLIED.png', {}],
      ['/assets/manifest.webmanifest', GZ], ['/assets/MainTheme_MenuIntro.wav', GZ], ['/assets/MainTheme_MenuLoop.wav', {}], ['/assets/index-DKbV5Nv9.js', GZ], ['/assets/index-DKbV5Nv9.js', GZ],
      ['/assets/index-D7hdwmUU.css', {}], ['/assets/br-role.js', GZ], ['/assets/nonexistent.js', GZ], ['/assets/sub/dir.js', {}], ['/assets/', {}], ['/assets', {}],
      ['/server.js', GZ], ['/sim.js', {}], ['/ai.js', {}], ['/death_srv.js', {}], ['/package.json', {}], ['/redirect.js', {}], ['/README.md', {}], ['/run_linux.sh', {}],
      ['/dev/tests/run.js', {}], ['/dev/stage-3h0/golden/srv_harness.js', {}], ['/dev/', {}], ['/.git/config', {}], ['/.github/workflows/deploy-bloom.yml', {}],
      ['/../server.js', {}], ['/%2e%2e/server.js', {}], ['/assets/../server.js', {}], ['/assets/%2e%2e/server.js', {}], ['/assets/..%2fserver.js', {}], ['/assets/%2e%2e%2fsim.js', {}],
      ['/server/ws.js', {}], ['/server/static.js', {}], ['/server/fields.js', {}], ['/server/', {}], ['/server', {}], ['/srv/ws.js', {}], ['/assets/../server/ws.js', {}],
      ['/sounds', {}], ['/sounds/', {}], ['/sounds/sting.mp3', GZ], ['/sounds/sting%20copy.mp3', {}], ['/sounds/README.txt', {}], ['/sounds/missing.mp3', {}],
      ['/sounds/../server.js', {}], ['/sounds/%2e%2e%2fserver.js', {}], ['/sounds/a/b.mp3', {}],
      ['/%', {}], ['/%E0%A4%A', {}], ['/a%00b', {}], ['/index.html%00', {}], ['/INDEX.HTML', {}], ['/index.html/', {}], ['//index.html', {}], ['/index.htm', {}], ['/mp.js.map', {}],
    ];
    for (const [u, h] of reqs) await H.http(u, { headers: h });
    await H.http('/index.html', { method: 'HEAD', headers: GZ });
    await H.http('/mp.js', { method: 'POST', headers: {} });
    await H.http('/server.js', { method: 'DELETE', headers: {} });
  },

  /* upgrades: bad paths, no key, room-name cleaning, the 8-socket room cap, ids, a room thrown away and made again */
  async ws_upgrade(H) {
    H.connect('/ws2?room=a'); H.connect('/ws', { key: null }); H.connect('/WS?room=a'); H.connect('/ws/?room=a'); H.connect('/ws?room=a', { key: null });
    const etc = H.connect('/ws?room=etc');
    const named = ['/ws', '/ws?room=', '/ws?room=Alpha_1-x', '/ws?room=a%20b!c', '/ws?room=' + 'x'.repeat(30) + '!', '/ws?room=%F0%9F%98%80', '/ws?room=..%2F..%2Fetc', '/ws?room=main&room=other', '/ws?room=e.t.c'];
    const cs = [etc].concat(named.map(u => H.connect(u)));
    for (const c of cs) c.send({ t: 'admin', pass: PASS });
    H.advance(120);
    const cap = []; for (let i = 0; i < 9; i++) cap.push(H.connect('/ws?room=cap', { ip: '203.0.113.' + (20 + i) }));
    H.note('ninth open: ' + cap[8].open);
    H.advance(60);
    cap[3].close(); H.advance(30);
    const again = H.connect('/ws?room=cap'); H.note('retry open: ' + again.open);
    H.advance(60);
    for (const c of cap.concat([again])) c.close();
    H.advance(60);
    const fresh = H.connect('/ws?room=cap'); H.advance(110);
    for (const c of cs.concat([fresh])) c.close();
    H.advance(60);
    coverage(H, cs.concat(cap, [again, fresh]));
  },

  /* the raw frame parser: split and coalesced delivery, 16-bit lengths, the 1,400-byte limit, control frames, FIN / mask oddities, bad JSON,
   * a handler exception, the 64-bit length, a close frame with more data behind it */
  async ws_frames(H) {
    const a = H.connect('/ws?room=fr');
    a.send({ t: 'ping', ts: 11 });
    H.advance(450);
    const b1 = H.cframe({ t: 'ping', ts: 22 });
    for (let i = 0; i < b1.length; i++) a.raw(b1.slice(i, i + 1), 'byte ' + i);
    H.advance(450);
    a.raw(Buffer.concat([H.cframe({ t: 'ping', ts: 33 }), H.cframe({ t: 'ping', ts: 34 }), H.cframe(JSON.stringify({ t: 'p', x: 960, y: 3264 }))]), 'three frames');
    H.advance(450);
    const pad = n => { const base = JSON.stringify({ t: 'ping', ts: 44, pad: '' }); return JSON.stringify({ t: 'ping', ts: 44, pad: 'x'.repeat(n - base.length) }); };
    a.send(pad(300), { len16: true }); H.advance(450);
    a.send(pad(1399)); H.advance(450);
    a.send(pad(1400)); H.advance(450);
    a.send(pad(125)); a.send(pad(126)); H.advance(450);
    const half = H.cframe({ t: 'ping', ts: 55 }); a.raw(half.slice(0, 1), 'one byte'); H.advance(30); a.raw(half.slice(1, 3), 'two more'); H.advance(30); a.raw(half.slice(3), 'rest');
    H.advance(450);
    a.send('hi', { op: 9 }); a.send('', { op: 9 }); a.send('pong?', { op: 10 }); a.send(Buffer.from([1, 2, 3]), { op: 2 }); a.send('{"t":"ping","ts":66}', { op: 0 });
    H.advance(450);
    a.send('{"t":"ping","ts":77}', { fin: false }); H.advance(450);
    a.send('{"t":'); a.send('null'); a.send('[]'); a.send('"str"'); a.send('42'); a.send('{"t":"nope"}'); a.send('{"t":"ping","ts":"abc"}');
    H.advance(450);
    a.send({ t: 'ping', ts: 88 }, { key: [0, 0, 0, 0] });
    H.advance(450);
    const u = H.connect('/ws?room=fr', { label: 'unmasked' });
    u.send({ t: 'ping', ts: 99 }, { mask: false }); H.advance(30); u.send({ t: 'ping', ts: 100 }, { mask: false }); H.advance(450);
    const l64 = H.connect('/ws?room=fr', { label: 'len64' });
    l64.send({ t: 'ping', ts: 1 }, { len64: true }); H.advance(60);
    const cl = H.connect('/ws?room=fr', { label: 'closer' });
    cl.raw(Buffer.concat([H.cframe('', { op: 8 }), H.cframe({ t: 'ping', ts: 2 })]), 'close then ping'); H.advance(60);
    const big = H.connect('/ws?room=fr', { label: 'bigframe' });
    const bigPayload = Buffer.from(JSON.stringify({ t: 'ping', ts: 3, pad: 'y'.repeat(70000) }));
    const bf = H.cframe(bigPayload.slice(0, 65535), { len16: true }); big.raw(bf.slice(0, 4000), 'first 4000 of a 65535-byte frame'); H.advance(60);
    a.send({ t: 'ping', ts: 5 }); H.advance(60);
    big.raw(bf.slice(4000), 'the rest'); H.advance(60);
    a.send({ t: 'ping', ts: 4 }); H.advance(120);
    for (const c of [a, u, l64, cl, big]) c.close();
    H.advance(60);
    coverage(H, [a, u, l64, cl, big]);
  },

  /* the life of an ordinary player beside an observer and an admin with debug on: menu packets, join, spawn, walking, a refused jump and its
   * correction, refused respawn / leave, the NEW RUN vanish and its 30 s cooldown, leave after a finished vanish, join again, disconnects,
   * the empty room thrown away, a new room */
  async lifecycle(H) {
    const A = H.connect('/ws?room=life', { ip: '203.0.113.31' }), B = H.connect('/ws?room=life', { ip: '203.0.113.32' }), C = H.connect('/ws?room=life', { ip: '203.0.113.33' });
    const sim = H.sims[H.sims.length - 1], Ic = sim.debug.Ic;
    C.send({ t: 'admin', pass: PASS }); C.send({ t: 'a', c: 'debug', on: 1 });
    for (let i = 0; i < 8; i++) { H.advance(250); A.send(P(Ic.x + i, Ic.y, { n: 'MENU-A', lk: LOOK, k: 'camcorder', l: 1, ir: 2 })); B.send(P(Ic.x, Ic.y + 40, { n: 'OBS-B' })); }
    H.note('A joins');
    A.send({ t: 'join' }); H.advance(60);
    A.send(P(Ic.x, Ic.y, { n: 'RUN-A', lk: LOOK, mv: MV(0, 0) })); H.advance(60);
    const a0 = openDir(sim, Ic.x, Ic.y);
    let pos = walk(H, A, sim, Ic.x, Ic.y, a0, 30, 8, 50, { n: 'RUN-A', lk: LOOK });
    H.note('jump of 2000 px');
    for (let i = 0; i < 16; i++) { H.advance(50); A.send(P(pos.x + 2000, pos.y, { n: 'RUN-A', mv: MV(2, 285) })); }
    H.advance(200);
    H.note('throttled packets (under 30 ms apart)');
    for (let i = 0; i < 4; i++) { H.advance(10); A.send(P(pos.x, pos.y, { n: 'RUN-A', mv: MV(0, 0, 90, 0, [[1, 40]]) })); }
    H.advance(300);
    A.send({ t: 'respawn' }); A.send({ t: 'leave' }); H.advance(100);
    H.note('stand 2 s, then single moves at the edge of the burst budget');
    for (let i = 0; i < 8; i++) { H.advance(250); A.send(P(pos.x, pos.y, { n: 'RUN-A', mv: MV(0, 0) })); }
    { const b = openDir(sim, pos.x, pos.y, 600), d = 525; const nx = Math.round(pos.x + Math.cos(b) * d), ny = Math.round(pos.y + Math.sin(b) * d);
      H.advance(60); A.send(P(nx, ny, { n: 'RUN-A', mv: MV(2, 285) })); H.advance(60); A.send(P(nx, ny, { n: 'RUN-A' })); H.advance(700); A.send(P(nx, ny, { n: 'RUN-A' })); H.advance(300);
      const tp = A.last('tp'); if (tp) pos = { x: Math.round(tp.x), y: Math.round(tp.y) }; else pos = { x: nx, y: ny }; }
    pos = walk(H, A, sim, pos.x, pos.y, a0 + Math.PI, 10, 6, 50, { n: 'RUN-A' });
    H.note('NEW RUN vanish');
    A.send({ t: 'fx', k: 'vanish', x: pos.x, y: pos.y, a: 0.5, lk: LOOK, ek: 'flashlight', ec: '#ffe7b2', ep: '#ffe7b2,#333333,#888888' }); H.advance(500);
    A.send({ t: 'fx', k: 'vanish', x: pos.x, y: pos.y, a: 0.5 }); H.advance(1600);
    A.send({ t: 'fx', k: 'vanish', x: pos.x, y: pos.y, a: 0.5 }); H.advance(1000);
    A.send({ t: 'b', c: 'Vanish', n: 'RUN-A', x: pos.x, y: pos.y, a: 0, sx: 1, sy: 1, aa: 0, lk: LOOK, ek: 'flashlight', ec: '#ffe7b2', ep: '', bl: [], dr: [pos.x, pos.y, 0], ht: [pos.x, pos.y, 0], hd: 0, tr: 0, ho: 0, ph: 0, ka: 0 });
    A.send({ t: 'leave' }); H.advance(200);
    A.send(P(pos.x, pos.y, { n: 'MENU-A' })); H.advance(300);
    A.send({ t: 'join' }); H.advance(60); A.send(P(Ic.x + 3000, Ic.y, { n: 'RUN-A2' })); H.advance(60);
    A.send({ t: 'join' }); H.advance(60);
    A.send({ t: 'pick' }); H.advance(300);
    H.advance(31000);
    A.send({ t: 'fx', k: 'vanish', x: Ic.x, y: Ic.y, a: 0 }); H.advance(2500); A.send({ t: 'leave' }); H.advance(200);
    B.send({ t: 'join' }); H.advance(60); B.send(P(Ic.x, Ic.y, { n: 'OBS-B' })); H.advance(500);
    H.note('A goes; then C; then B: the room is thrown away');
    A.close(); H.advance(200); C.close(); H.advance(200); B.close(); H.advance(200);
    const D = H.connect('/ws?room=life'); H.advance(300); D.close(); H.advance(100);
    coverage(H, [A, B, C, D]);
  },

  /* deaths and their aftermath, through the real kill path (the admin death preview): the server replays and builds the corpse when the victim
   * does not; the victim's own replay and corpse; a victim that disconnects at once; revive by another admin; malformed corpse reports */
  async deaths(H) {
    const A = H.connect('/ws?room=death', { ip: '203.0.113.41' }), B = H.connect('/ws?room=death', { ip: '203.0.113.42' }), C = H.connect('/ws?room=death', { ip: '203.0.113.43' });
    const sim = H.sims[H.sims.length - 1], Ic = sim.debug.Ic;
    for (const c of [A, C]) c.send({ t: 'admin', pass: PASS });
    A.send({ t: 'a', c: 'debug', on: 1 });
    for (const c of [A, B, C]) { c.send({ t: 'join' }); H.advance(60); c.send(P(Ic.x, Ic.y, { n: 'D-' + c.cid })); H.advance(60); }
    for (let i = 0; i < 10; i++) { H.advance(100); for (const c of [A, B, C]) c.send(P(Ic.x, Ic.y, { n: 'D-' + c.cid, mv: MV(0, 0) })); }
    H.note('1: A dies (preview hound A) and sends nothing: server replay, server corpse');
    A.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' });
    for (let i = 0; i < 260; i++) { H.advance(50); if (i % 2 === 0) for (const c of [B, C]) c.send(P(Ic.x, Ic.y, { n: 'D-' + c.cid, mv: MV(0, 0) })); }
    A.send({ t: 'respawn' }); H.advance(60); A.send(P(Ic.x, Ic.y, { n: 'D-A' })); H.advance(200);
    H.note('2: A dies (preview smiler B) and reports its own replay and corpse');
    A.send({ t: 'a', c: 'preview', k: 'smiler', var: 'B' }); H.advance(300);
    const mk = (A.last('s') || {}).mk || { x: Ic.x, y: Ic.y, a: 0, ax: Ic.x + 50, ay: Ic.y, v: 'B' };
    A.send({ lk: LOOK, ek: 'lantern', ec: '#ffaa66', ep: '#ffaa66,#222222,#999999,#444444', t: 'fx', k: 'death', c: 'Smiler', x: mk.x, y: mk.y, a: mk.a || 0, sx: mk.ax, sy: mk.ay, vx: 3, vy: -4, ex: 0, v: mk.v || 'B', w: 0 });
    H.advance(100);
    A.send({ lk: LOOK, t: 'fx', k: 'death', c: 'Smiler', x: mk.x, y: mk.y });
    H.advance(4000);
    A.send({ t: 'b', n: 'D-A', x: mk.x + 10, y: mk.y + 5, a: 1.234, sx: 1.05, sy: .95, c: 'Smiler', aa: .5, lk: LOOK, ek: 'lantern', ec: '#ffaa66', ep: '#ffaa66,#222222,#999999,#444444', lo: 1,
      bl: [[mk.x, mk.y, 12], [mk.x + 5, mk.y, 1013]], dr: [mk.x + 20, mk.y, .3], ht: [mk.x - 10, mk.y, 0], hd: [1, 2, 3, 4], tr: [[mk.x, mk.y], [mk.x + 1, mk.y + 1]], ho: 1, ph: 1, ka: 0 });
    H.advance(10000);
    H.note('3: C revives A');
    C.send({ t: 'a', c: 'revive', id: A.id }); H.advance(200); A.send({ t: 'respawn' }); H.advance(60); A.send(P(Ic.x, Ic.y, { n: 'D-A' })); H.advance(300);
    H.note('4: malformed corpse reports while alive, then while dead');
    A.send({ t: 'b', c: 'Hound', x: 1, y: 2 }); H.advance(60);
    A.send({ t: 'a', c: 'preview', k: 'hound', var: 'D' }); H.advance(400);
    A.send({ t: 'b', n: 'x'.repeat(40), x: -5, y: 1e9, a: 99, sx: 9, sy: 0, c: 'Thing', aa: -99, lk: 'bad', ek: 'torch', ec: 'red', ep: '#1,#2', lo: 'yes',
      bl: Array.from({ length: 9 }, (_, i) => [i * 10, 'q', i * 1001]), dr: 'no', ht: [1], hd: [1, 2, 3], tr: Array.from({ length: 30 }, (_, i) => [i, -i]), ho: 0, ph: 1, ka: [5, 6, 7] });
    H.advance(12000);
    H.note('6: a vanish, then a death; the death replay 1.45 s after the vanish');
    A.send({ t: 'respawn' }); H.advance(60); A.send(P(Ic.x, Ic.y, { n: 'D-A' })); H.advance(3000);
    A.send({ t: 'fx', k: 'vanish', x: Ic.x, y: Ic.y, a: 0 }); H.advance(100);
    A.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); H.advance(1350);
    A.send({ lk: LOOK, ek: 'flashlight', ec: '#ffe7b2', ep: '', t: 'fx', k: 'death', c: 'Hound', x: Ic.x, y: Ic.y, a: 0, sx: Ic.x + 40, sy: Ic.y, vx: 0, vy: 0, ex: 0, v: 'A', w: 0 });
    H.advance(3000);
    H.note('5: A dies and disconnects at once');
    A.send({ t: 'respawn' }); H.advance(60); A.send(P(Ic.x, Ic.y, { n: 'D-A' })); H.advance(300);
    A.send({ t: 'a', c: 'preview', k: 'hound', var: 'B' }); H.advance(120);
    A.close();
    for (let i = 0; i < 160; i++) { H.advance(50); if (i % 2 === 0) for (const c of [B, C]) c.send(P(Ic.x, Ic.y, { n: 'D-' + c.cid, mv: MV(0, 0) })); }
    B.close(); C.close(); H.advance(100);
    coverage(H, [A, B, C]);
  },

  /* admin authentication and every command, with debug data, ping / pong, broadcast, kick */
  async admin(H) {
    const A = H.connect('/ws?room=adm', { ip: '203.0.113.51' }), B = H.connect('/ws?room=adm', { ip: '203.0.113.52' }), Q = H.connect('/ws?room=adm', { ip: '203.0.113.53' });
    const sim = H.sims[H.sims.length - 1], Ic = sim.debug.Ic;
    for (const c of [A, B]) { c.send({ t: 'join' }); H.advance(60); c.send(P(Ic.x + (c === B ? 200 : 0), Ic.y, { n: 'ADM-' + c.cid })); H.advance(60); }
    A.send({ t: 'a', c: 'freeze', on: 1 }); A.send({ t: 'ping', ts: 5 }); H.advance(100);
    for (let i = 0; i < 6; i++) { A.send({ t: 'admin', pass: 'wrong-' + i }); H.advance(100); }
    A.send({ t: 'admin', pass: PASS }); H.advance(30000); A.send({ t: 'admin', pass: PASS }); H.advance(31000);
    A.send({ t: 'admin', pass: PASS }); H.advance(100);
    Q.send({ t: 'admin', pass: PASS, quiet: 1 }); Q.send({ t: 'admin', pass: 'nope', quiet: 1 }); H.advance(100);
    const cmd = (o, wait = 120) => { A.send(Object.assign({ t: 'a' }, o)); H.advance(wait); };
    cmd({ c: 'debug', on: 1 }, 400);
    for (let i = 0; i < 4; i++) { A.send({ t: 'ping', ts: 1000 + i }); H.advance(250); }
    cmd({ c: 'god', id: B.id }); cmd({ c: 'god', id: B.id }); cmd({ c: 'god', id: 9999 });
    cmd({ c: 'bring', id: B.id }); cmd({ c: 'goto', id: B.id }); cmd({ c: 'bring', id: A.id });
    cmd({ c: 'freeze', on: 1 }); cmd({ c: 'freeze', on: 0 });
    for (const v of [.25, 3, 7, 'x']) cmd({ c: 'speed', v });
    for (const mode of ['on', 'off', 'auto', 'weird']) cmd({ c: 'blackout', mode });
    cmd({ c: 'hounds', mode: 'add', n: 3 }, 300); cmd({ c: 'hounds', mode: 'remove', n: 1 }); cmd({ c: 'hounds', mode: 'add', n: 99 }, 300); cmd({ c: 'hounds', n: 0 });
    cmd({ c: 'smilers', mode: 'add', n: 2 }, 300); cmd({ c: 'smilers', mode: 'remove', n: 1 });
    cmd({ c: 'glitch', mode: 'new' }); cmd({ c: 'glitch', mode: 'tp' });
    cmd({ c: 'item', mode: 'new' }); cmd({ c: 'item', mode: 'tp' }, 300);
    const it = ((A.last('s') || {}).e || {}).it || [];
    if (it.length) { A.send(P(it[0][0], it[0][1], { n: 'ADM-A' })); H.advance(100); A.send({ t: 'pick' }); H.advance(200); A.send({ t: 'pick' }); H.advance(100); }
    cmd({ c: 'item', mode: 'tp' });
    cmd({ c: 'monsters' }, 300);
    cmd({ c: 'near', k: 'hound' }, 300); cmd({ c: 'near', k: 'smiler' }, 300); cmd({ c: 'summon' }, 300);
    for (const mode of ['quick', 'play', 'auto', 'zzz']) cmd({ c: 'capmode', mode });
    const withAd = A.rx.filter(m => m.t === 's' && m.ad), es = (withAd.length ? withAd[withAd.length - 1].ad.es : null) || [];
    const eid = es.length ? es[0][0] : 1;
    cmd({ c: 'entgoto', eid }); cmd({ c: 'entgoto', eid: 99999 });
    for (const c of ['follow', 'come', 'hunt', 'clear', 'repath', 'noroute', 'unstuck', 'bogus']) cmd({ c: 'nav', eid, cmd: c }, 200);
    cmd({ c: 'nav', eid: 99999, cmd: 'come' });
    cmd({ c: 'entdel', eid }); cmd({ c: 'entdel', eid: 99999 });
    cmd({ c: 'preview', k: 'smiler', var: 'Z' }, 400);
    cmd({ c: 'world' }, 400);
    cmd({ c: 'msg', text: '  hello halls  ' }); cmd({ c: 'msg', text: '   ' }); cmd({ c: 'msg', text: 'm'.repeat(200) }); cmd({ c: 'unknown' });
    cmd({ c: 'debug', on: 0 }, 400);
    B.send({ t: 'a', c: 'world' }); B.send({ t: 'a', c: 'kick', id: A.id }); H.advance(200);
    cmd({ c: 'kick', id: A.id }); cmd({ c: 'kick', id: B.id }, 400);
    B.send({ t: 'ping', ts: 1 }); H.advance(400);
    A.close(); Q.close(); H.advance(100);
    coverage(H, [A, B, Q]);
  },

  /* the scheduler: regular wakes, stalls (the 0.25 s cap and the 15-step limit), a sub-step stall; snapshot, admin and debug cadence */
  async schedule(H) {
    const A = H.connect('/ws?room=sch', { ip: '203.0.113.61' }), D = H.connect('/ws?room=sch', { ip: '203.0.113.62' });
    const sim = H.sims[H.sims.length - 1], Ic = sim.debug.Ic;
    D.send({ t: 'admin', pass: PASS }); D.send({ t: 'a', c: 'debug', on: 1 });
    A.send({ t: 'join' }); H.advance(60); A.send(P(Ic.x, Ic.y, { n: 'SCH' }));
    H.advance(2000);
    H.stall(400); H.advance(100);
    H.stall(1000); H.advance(100);
    H.stall(30); H.advance(100);
    H.stall(13); H.advance(13); H.stall(7); H.advance(50);
    H.advance(3000);
    A.close(); D.close(); H.advance(500);
  },

  /* what the position packet carries, valid and not: null / text / huge coordinates, legacy light kinds, infrared on and off the camcorder,
   * a missing light flag, looks, light parts, colours, names, fall values, movement reports, the menu (inactive) path */
  async p_fields(H) {
    const A = H.connect('/ws?room=pf', { ip: '203.0.113.71' }), B = H.connect('/ws?room=pf', { ip: '203.0.113.72' });
    const sim = H.sims[H.sims.length - 1], Ic = sim.debug.Ic;
    B.send({ t: 'admin', pass: PASS }); H.advance(60);
    A.send({ t: 'join' }); H.advance(60); A.send(P(Ic.x, Ic.y)); H.advance(100);
    const v = [
      { x: null }, { x: 'abc' }, { x: Ic.x + 3, y: Ic.y, vx: 99999, vy: -99999, a: 'turn' }, { k: 'chestlamp' }, { k: 'torch' }, { k: 'rocket' }, { k: 'camcorder', l: 1, ir: 5 },
      { k: 'camcorder', l: 0, ir: 2 }, { k: 'flashlight', l: 1, ir: 2 }, { l: undefined }, { lk: 'beanie|stripes|#112233|#445566|canvas' }, { lk: 'crown|plain|#112233|#445566|none' },
      { lp: '#111111,#222222' }, { lp: '#111111,#222222,#333333,#444444,#555555,#666666' }, { lp: '#11111g,#222222,#333333' }, { c: 'red' }, { c: '#ABCDEF' },
      { n: 'N'.repeat(40) }, { n: '' }, { f: 2 }, { f: 0.5 }, { f: -0.1 }, { r: 1, mv: MV(2, 285, 40, 1, [[1, 60], [2, 80]]) }, { mv: 'bad' }, { mv: [1, 2] }, { mv: MV(9, 999, 500, 1) },
      { a: 1.2345 }, { a: -2.718 }, { a: 31.4159 },
    ];
    for (const o of v) { H.advance(60); const p = P(Ic.x + 3, Ic.y, o); for (const k of Object.keys(o)) if (o[k] === undefined) delete p[k]; A.send(p); H.advance(60); }
    H.note('packets exactly 30 ms and 29 ms apart');
    for (const [i, gap] of [[0, 90], [1, 30], [2, 30], [3, 29], [4, 30], [5, 31]].map(x => x)) { H.advance(gap); A.send(P(Ic.x + 3 + i, Ic.y, { a: i / 7, mv: MV(1, 60) })); }
    H.advance(500);
    A.send({ t: 'leave' }); H.advance(60);
    A.send({ t: 'fx', k: 'death', c: 'Hound', x: 1, y: 1 }); A.send({ t: 'fx', k: 'other' }); H.advance(100);
    A.close(); B.close(); H.advance(100);
  },

  /* a glitched wall: an admin (whose moves the server does not check) steps onto one: the exit at the next snapshot tick */
  async exit_glitch(H) {
    const A = H.connect('/ws?room=gx', { ip: '203.0.113.81' }), B = H.connect('/ws?room=gx', { ip: '203.0.113.82' });
    const sim = H.sims[H.sims.length - 1], Ic = sim.debug.Ic;
    A.send({ t: 'admin', pass: PASS }); A.send({ t: 'join' }); B.send({ t: 'join' }); H.advance(60);
    A.send(P(Ic.x, Ic.y)); B.send(P(Ic.x, Ic.y)); H.advance(1900);
    const gw = ((A.last('s') || {}).e || {}).gw || [];
    if (gw.length) { A.send(P(gw[0][0], gw[0][1], { n: 'EXIT-A' })); }
    H.advance(1000);
    A.send(P(Ic.x, Ic.y)); A.send({ t: 'join' }); H.advance(500);
    A.close(); B.close(); H.advance(100);
    coverage(H, [A, B]);
  },
};
