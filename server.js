// Static file server + WebSocket game server (zero dependencies).  Run: node server.js [port]
// Each ?room=NAME is an independent world with its own server-side Hounds, Smilers (ai.js, driven by sim.js),
// blackout timer and shared evidence.  sim.js and ai.js are never served to browsers.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const zlib = require('zlib');
const createSim = require('./sim.js');
const gz = new Map();

const PORT = +process.argv[2] || process.env.PORT || 8000, ROOT = __dirname, MAX_ROOM = 8;
// Admin passcode. Override on the host with the ADMIN_PASSCODE environment variable (recommended).
const ADMIN_PASS = process.env.ADMIN_PASSCODE || 'smoor';
// How long (seconds) a dead player's body stays in the halls. 0 (default) = until the world resets or that player dies again. Override with the BODY_TTL environment variable.
const BODY_TTL = Math.max(0, +process.env.BODY_TTL || 0);
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const ADMIN_HASH = sha(ADMIN_PASS);
const passOk = s => crypto.timingSafeEqual(sha(s), ADMIN_HASH);
const fails = new Map();                        // ip -> { n, until }  (5 wrong guesses = 60 s lockout)
const TICK_MS = 25, SNAP_EVERY = 2, ADMIN_EVERY = 4;            // simulate ~40 Hz, broadcast ~20 Hz
const SERVE = /^\/(index\.html|world\.js|move\.js|ents\.js|mp\.js|hud\.js|gore\.js|dphys\.js|light\.js|glitch\.js|camcorder\.js|inventory\.js|sfx\.js|assets\/[\w.\-]+)$/;   // never serve server.js / sim.js
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const f = path.join(ROOT, path.normalize(u));
  // drop-in custom sounds: any files in ./sounds are listed and served (see sounds/README.txt)
  const AUDIO = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.webm': 'audio/webm' };
  if (u === '/sounds' || u === '/sounds/') {
    let l = []; try { l = fs.readdirSync(path.join(ROOT, 'sounds')).filter(n => AUDIO[path.extname(n).toLowerCase()]); } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(l));
  }
  if (/^\/sounds\/[\w.\- ]+$/.test(u) && AUDIO[path.extname(u).toLowerCase()] && f.startsWith(path.join(ROOT, 'sounds'))) {
    return fs.readFile(f, (e, b) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': AUDIO[path.extname(f).toLowerCase()], 'Cache-Control': 'public, max-age=300', 'Content-Length': b.length }); res.end(b);
    });
  }
  if (!f.startsWith(ROOT) || !SERVE.test(u)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(f), h = { 'Content-Type': types[ext] || 'application/octet-stream', 'Vary': 'Accept-Encoding' };
    // code is never cached (the bundle keeps the same file name across versions); the big texture may be
    h['Cache-Control'] = ext === '.png' ? 'public, max-age=86400' : 'no-store';
    if (ext !== '.png' && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let z = gz.get(f); if (!z) { z = zlib.gzipSync(b, { level: 9 }); gz.set(f, z); }
      h['Content-Encoding'] = 'gzip'; res.writeHead(200, h); return res.end(z);
    }
    res.writeHead(200, h); res.end(b);
  });
});

const rooms = new Map();
let nextId = 1;

function frame(str) {
  const b = Buffer.from(str), n = b.length;
  const h = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : null;
  return h ? Buffer.concat([h, b]) : null;
}
const send = (c, obj) => { const f = frame(JSON.stringify(obj)); if (f && !c.sock.destroyed) c.sock.write(f); };
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, +v || 0));
const KINDS = ['flashlight', 'headlamp', 'lantern', 'camcorder'], LEGACY = { chestlamp: 'headlamp', torch: 'lantern' };
const kindOf = k => KINDS.includes(k) ? k : (LEGACY[k] || 'flashlight');
const cleanParts = s => { const a = String(s || '').split(','); return a.length >= 3 && a.length <= 5 && a.every(c => /^#[0-9a-f]{6}$/i.test(c)) ? a.join(',') : ''; };
const HEX = /^#[0-9a-f]{6}$/i, DEFAULT_LOOK = 'none|plain|#e6bb76|#ffcc77|none';
function cleanLook(s) {                       // hat|texture|hands|main|backpack, validated
  const [h, t, ha, m, b] = String(s || '').split('|');
  return ['none', 'cap', 'beanie', 'hardhat'].includes(h) && ['plain', 'freckles', 'stripes', 'patched'].includes(t) &&
    HEX.test(ha) && HEX.test(m) && ['none', 'canvas', 'utility'].includes(b) ? [h, t, ha, m, b].join('|') : null;
}

function getRoom(name) {
  let r = rooms.get(name);
  if (!r) { r = { name, clients: new Map(), sim: createSim({ bodyTtl: BODY_TTL }), acc: 0, last: Date.now(), tick: 0, pf: { ms: 0, max: 0, snapB: 0, sense: 0, paths: 0, at: Date.now() } }; rooms.set(name, r); }
  return r;
}

function adminCommand(room, me, m) {
  const sim = room.sim, target = room.clients.get(m.id | 0), A = sim.admin;
  const log = what => console.log(`[admin] room=${room.name} ${me.name}#${me.id}: ${what}`);
  const res = (ok, msg) => send(me, { t: 'ares', ok: !!ok, msg: String(msg).slice(0, 90) });         // a one-line answer for the panel's status bar
  const who = c => String(c.name || 'WANDERER').toUpperCase();
  switch (m.c) {
    case 'kick':
      if (target && target !== me) { log(`kick ${target.name}#${target.id}`); res(true, 'KICKED ' + who(target)); send(target, { t: 'kick' }); setTimeout(() => { try { target.sock.write(Buffer.from([0x88, 0])); target.sock.end(); } catch (e) {} }, 150); }
      break;
    case 'revive': if (target) { log(`revive ${target.name}`); target.player.dead = ''; target.player.safe = 3; A.endPreview(target.player); send(target, { t: 'revive' }); res(true, 'REVIVED ' + who(target)); } break;
    case 'god': if (target) { const on = A.god(target.player); log(`god ${target.name} -> ${on}`); res(true, 'GOD MODE ' + (on ? 'ON' : 'OFF') + ' · ' + who(target)); } break;
    case 'bring': if (target && target !== me) { log(`bring ${target.name}`); const { x, y } = me.player; Object.assign(target.player, { x, y }); send(target, { t: 'tp', x, y }); res(true, 'BROUGHT ' + who(target)); } break;
    case 'goto': if (target && target !== me) { log(`goto ${target.name}`); const { x, y } = target.player; Object.assign(me.player, { x, y }); send(me, { t: 'tp', x, y }); res(true, 'WENT TO ' + who(target)); } break;
    case 'freeze': log(`freeze ${!!m.on}`); A.freeze(m.on); res(true, m.on ? 'WORLD FROZEN' : 'WORLD RUNNING'); break;
    case 'speed': log(`speed ${m.v}`); A.speed(m.v); res(true, 'WORLD SPEED ×' + A.info().sp); break;
    case 'blackout': log(`blackout ${m.mode}`); A.blackout(m.mode); res(true, 'LIGHTS: ' + (m.mode === 'on' ? 'BLACKOUT ON' : m.mode === 'off' ? 'BLACKOUT OFF' : 'AUTO')); break;
    case 'hounds': { log(`hound ${m.mode}`); const add = m.mode === 'add', ok = add ? A.addHound() : A.removeHound(); res(ok, ok ? (add ? 'HOUND ADDED' : 'HOUND REMOVED') : (add ? 'CANNOT ADD: LIMIT OF 3 OR NO SPOT' : 'NO HOUNDS TO REMOVE')); break; }
    case 'smilers': { log(`smiler ${m.mode}`); const add = m.mode === 'add', ok = add ? A.addSmiler() : A.removeSmiler(); res(ok, ok ? (add ? 'SMILER ADDED' : 'SMILER REMOVED') : (add ? 'CANNOT ADD: LIMIT OF 5 OR NO SPOT' : 'NO SMILERS TO REMOVE')); break; }
    case 'glitch':
      log(`glitch ${m.mode}`);
      if (m.mode === 'new') { A.newGlitches(); res(true, 'GLITCHED WALLS MOVED'); }
      else { const g = A.nearestGlitch(me.player.x, me.player.y); if (g) { const x = g.x - g.nx * 96, y = g.y - g.ny * 96; Object.assign(me.player, { x, y }); send(me, { t: 'tp', x, y }); res(true, 'AT THE NEAREST GLITCHED WALL'); } }
      break;
    case 'item':
      log(`item ${m.mode}`);
      if (m.mode === 'new') { A.newItem(); res(true, 'CARTOGRAPH MOVED'); }
      else { const g = A.nearestItem(me.player.x, me.player.y); if (g) { const x = g.x + 70, y = g.y; Object.assign(me.player, { x, y }); send(me, { t: 'tp', x, y }); res(true, 'AT THE CARTOGRAPH'); } else res(false, 'THE CARTOGRAPH HAS BEEN TAKEN'); }
      break;
    case 'monsters': log('reset monsters'); A.resetMonsters(); res(true, 'MONSTERS RESPAWNED'); break;
    case 'debug':
      me.dbg = !!m.on; if (me.dbg) me.dbgSeq = Math.max(0, sim.logSeq - 14); log(`ai debug ${me.dbg}`); break;
    case 'near': { const k = m.k === 'smiler' ? 'smiler' : 'hound', ok = A.addNear(k, me.player.x, me.player.y); log(`spawn ${k} near`); res(ok, ok ? k.toUpperCase() + ' PLACED NEAR YOU' : 'LIMIT REACHED OR NO SPOT NEARBY'); break; }
    case 'summon': { const ok = A.summon(me.player.x, me.player.y, me.player.id); log('summon nearest hound'); res(ok, ok ? 'A HOUND IS COMING FOR YOU' : 'NO FREE HOUND TO SUMMON'); break; }
    case 'preview': {                                                             // DEATHS tab: one chosen death on the admin, through the real kill path
      const k = m.k === 'smiler' ? 'smiler' : 'hound', v = /^[ABCD]$/.test(m.var) ? m.var : 'A', r = A.previewKill(me.player, k, v);
      log(`preview death ${k} ${v}: ${r.ok ? 'ok' : r.why}`); res(r.ok, r.ok ? `PLAYING ${k.toUpperCase()} ${v}` : String(r.why).toUpperCase()); break;
    }
    case 'capmode': { const cm = A.captureMode(m.mode); log(`capture style ${cm}`); res(true, 'CAPTURE STYLE: ' + (cm === 'quick' ? 'ALWAYS QUICK KILLS' : cm === 'play' ? 'ALWAYS PLAY WITH THE VICTIM' : 'AUTO (THE ENTITY DECIDES)')); break; }
    case 'entgoto': { const e = A.entityAt(m.eid), s = e && A.spotNear(e.x, e.y); if (s) { Object.assign(me.player, s); send(me, { t: 'tp', x: s.x, y: s.y }); log(`goto entity ${m.eid}`); res(true, 'WENT TO ENTITY #' + (m.eid | 0)); } else res(false, 'NO SUCH ENTITY'); break; }
    case 'entdel': { const ok = A.removeEntity(m.eid); log(`remove entity ${m.eid}`); res(ok, ok ? 'ENTITY #' + (m.eid | 0) + ' REMOVED' : 'NO SUCH ENTITY'); break; }
    case 'world': log('reset world'); A.resetWorld(); for (const c of room.clients.values()) if (c.player.active) send(c, { t: 'tp', x: c.player.x, y: c.player.y }); res(true, 'NEW RUN FOR EVERYONE'); break;
    case 'msg': { const text = String(m.text || '').slice(0, 140).trim(); if (text) { log(`broadcast "${text}"`); for (const c of room.clients.values()) send(c, { t: 'msg', text, from: me.name }); res(true, 'SENT'); } break; }
  }
}

srv.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws' || !req.headers['sec-websocket-key']) return sock.destroy();
  const name = (url.searchParams.get('room') || 'main').slice(0, 24).replace(/[^\w-]/g, '') || 'main';
  const room = getRoom(name);
  if (room.clients.size >= MAX_ROOM) return sock.destroy();
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
    crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64') + '\r\n\r\n');
  sock.setNoDelay(true);

  const id = nextId++;
  const player = room.sim.addPlayer(id);
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const me = { sock, id, player, exitSent: 0, bv: 0, last: 0, name: 'WANDERER', color: '#ffe7b2', angle: 0, sprint: 0, look: DEFAULT_LOOK, admin: false };
  room.clients.set(id, me);
  send(me, { t: 'hi', id, sim: 1 });

  function onMessage(m) {
    if (m.t === 'p') {
      const now = Date.now();
      if (m.mv) room.sim.hearMove(player, m.mv);            // state / stamina / vault + slide noises: processed even if the position is throttled
      if (now - me.last < 30 || !isFinite(m.x) || !isFinite(m.y)) return;
      me.last = now;
      const p = player;
      if (!p.dead) {                       // a caught player's body stays where it fell
        p.x = num(m.x, 0, 96 * 96); p.y = num(m.y, 0, 72 * 96);
        p.vx = num(m.vx, -500, 500); p.vy = num(m.vy, -500, 500);
      }
      p.angle = +m.a || 0; p.sprinting = !!m.r; p.light = m.l !== 0;
      p.equipment.kind = kindOf(m.k);
      me.name = String(m.n || 'WANDERER').slice(0, 20);
      if (HEX.test(m.c)) me.color = m.c;
      me.look = cleanLook(m.lk) || me.look; me.lp = cleanParts(m.lp);
      me.angle = p.angle; me.sprint = m.r ? 1 : 0; me.fall = m.f >= 0 && m.f <= 1 ? +m.f : -1;
    } else if (m.t === 'join') room.sim.join(player);
    else if (m.t === 'respawn') room.sim.respawn(player);
    else if (m.t === 'leave') room.sim.leave(player);                       // NEW RUN -> END / menu: no longer in the world
    else if (m.t === 'fx') {                                                // replay someone's death / vanishing for everybody else
      const t = Date.now(), k = m.k === 'death' ? 'death' : m.k === 'vanish' ? 'vanish' : '';
      if (!k || !player.active || t - (me.fxAt || 0) < 1500 || (k === 'death' && !player.dead)) return;
      me.fxAt = t; if (k === 'vanish') player.safe = Math.max(player.safe, 4);
      const out = { t: 'fx', k, id, c: m.c === 'Smiler' ? 'Smiler' : 'Hound', x: num(m.x, 0, 9216), y: num(m.y, 0, 6912), a: num(m.a, -20, 20), sx: num(m.sx, 0, 9216), sy: num(m.sy, 0, 6912),
        v: /^[ABCD]$/.test(m.v) ? m.v : 'A', w: Array.isArray(m.w) && m.w.length === 3 ? [num(m.w[0], 0, 9216), num(m.w[1], 0, 6912), num(m.w[2], -20, 20)] : 0,
        lk: cleanLook(m.lk) || me.look, ek: kindOf(m.ek), ec: HEX.test(m.ec) ? m.ec : '#ffe7b2', ep: cleanParts(m.ep), vx: num(m.vx, -900, 900), vy: num(m.vy, -900, 900), ex: m.ex ? 1 : 0 };
      for (const c of room.clients.values()) if (c !== me) send(c, out);
    }
    else if (m.t === 'pick') { if (player.active && !player.dead) { const it = room.sim.takeItem(player); if (it) send(me, { t: 'got', item: it }); } }
    else if (m.t === 'admin') {
      const now = Date.now(), f = fails.get(ip) || { n: 0, until: 0 };
      if (now < f.until) return send(me, { t: 'admin', ok: false, wait: Math.ceil((f.until - now) / 1000) });
      if (passOk(m.pass)) { me.admin = true; fails.delete(ip); console.log(`[admin] ${me.name}#${id} unlocked admin (room ${name})`); send(me, { t: 'admin', ok: true }); }
      else { if (++f.n >= 5) { f.until = now + 60000; f.n = 0; } fails.set(ip, f); console.log(`[admin] ${me.name}#${id} wrong admin passcode (room ${name})`); send(me, { t: 'admin', ok: false, wait: f.until > now ? 60 : 0 }); }
    }
    else if (m.t === 'a') { if (me.admin) adminCommand(room, me, m); }
    else if (m.t === 'ping') { const t = Date.now(); if (t - (me.pingAt || 0) > 400) { me.pingAt = t; send(me, { t: 'pong', ts: +m.ts || 0 }); } }
    else if (m.t === 'b') {                 // the finished corpse of a player we already know was caught; one per player
      if (!player.dead && m.c !== 'Vanish') return;
      const n3 = a => [num(a && a[0], 0, 9216), num(a && a[1], 0, 6912), num(a && a[2], -20, 20)];
      room.sim.setBody(id, { k: id, n: String(m.n || me.name).slice(0, 20), x: num(m.x, 0, 9216), y: num(m.y, 0, 6912), a: num(m.a, -20, 20),
        sx: num(m.sx, .5, 1.6), sy: num(m.sy, .5, 1.6), c: m.c === 'Smiler' ? 'Smiler' : m.c === 'Vanish' ? 'Vanish' : 'Hound', aa: num(m.aa, -20, 20),
        lk: cleanLook(m.lk) || me.look, eq: { kind: kindOf(m.ek), color: HEX.test(m.ec) ? m.ec : '#ffe7b2', parts: cleanParts(m.ep) },
        bl: (Array.isArray(m.bl) ? m.bl : []).slice(0, 6).map(b => [num(b && b[0], 0, 9216), num(b && b[1], 0, 6912), (b && b[2] | 0) % 1000]), dr: n3(m.dr), ht: n3(m.ht), lo: m.lo ? 1 : 0,
        ph: m.ph && Array.isArray(m.hd) && m.hd.length === 4 ? 1 : 0, hd: Array.isArray(m.hd) && m.hd.length === 4 ? m.hd.map(v => num(v, -80, 80)) : 0, ho: m.ho ? 1 : 0,
        tr: (Array.isArray(m.tr) ? m.tr : []).slice(0, 24).map(q => [num(q && q[0], 0, 9216), num(q && q[1], 0, 6912)]) });
    }
  }

  let buf = Buffer.alloc(0);
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const op = buf[0] & 15; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) return sock.destroy();
      if (buf.length < off + 4 + len) return;
      const mask = buf.slice(off, off + 4), pl = Buffer.from(buf.slice(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) pl[i] ^= mask[i & 3];
      buf = buf.slice(off + 4 + len);
      if (op === 8) return sock.end();
      if (op === 9) { sock.write(Buffer.from([0x8a, 0])); continue; }       // ping -> pong
      if (op === 1 && len < 1400) { try { onMessage(JSON.parse(pl)); } catch (e) { /* ignore bad input */ } }
    }
  });
  const bye = () => {
    if (!room.clients.delete(id)) return;
    room.sim.removePlayer(player);
    if (!room.clients.size) rooms.delete(name);       // empty world is thrown away
  };
  sock.on('close', bye); sock.on('error', bye);
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const dt = Math.min(0.25, (now - room.last) / 1000); room.last = now;
    room.acc += dt;
    let n = 0; const h0 = process.hrtime.bigint();
    while (room.acc >= 1 / 60 && n++ < 15) { room.sim.step(1 / 60); room.acc -= 1 / 60; }
    if (n) { const per = Number(process.hrtime.bigint() - h0) / 1e6 / n; room.pf.ms += (per - room.pf.ms) * .05; room.pf.max = Math.max(per, room.pf.max * .995); }      // milliseconds per 60 Hz step (average / recent worst)
    if (++room.tick % SNAP_EVERY) continue;

    const ent = room.sim.entities();
    const peers = [];
    for (const c of room.clients.values()) {
      if (!c.player.active) continue;
      peers.push({ id: c.id, x: Math.round(c.player.x), y: Math.round(c.player.y), a: +c.angle.toFixed(2),
        n: c.name, c: c.color, d: c.player.dead ? 1 : 0, r: c.sprint,
        k: c.player.equipment.kind, l: c.player.light ? 1 : 0, lk: c.look, lp: c.lp || '', f: c.fall === undefined ? -1 : c.fall,
        mv: [c.player.st | 0, Math.round(c.player.sp || 0), Math.round(c.player.stamina == null ? 100 : c.player.stamina), c.player.ex | 0] });
    }
    const sendAd = room.tick % (SNAP_EVERY * ADMIN_EVERY) === 0;
    const wantDbg = room.tick % (SNAP_EVERY * 3) === 0 && [...room.clients.values()].some(c => c.admin && c.dbg);
    const dbgList = wantDbg ? room.sim.debugInfo() : null;
    let dbgPerf = null;
    if (wantDbg) {
      const st = room.sim.engStats, nowT = Date.now(), dtp = Math.max(.2, (nowT - room.pf.at) / 1000);
      room.pf.snapB = JSON.stringify({ p: peers, e: ent }).length;
      dbgPerf = { ms: +room.pf.ms.toFixed(3), mx: +room.pf.max.toFixed(2), kb: +(room.pf.snapB / 1024).toFixed(2), se: Math.round((st.sense - room.pf.sense) / dtp), pa: Math.round((st.paths - room.pf.paths) / dtp), pl: peers.length };
      room.pf.sense = st.sense; room.pf.paths = st.paths; room.pf.at = nowT;
    }
    let ad = null;
    if (sendAd) ad = Object.assign(room.sim.admin.info(), { pl: [...room.clients.values()].map(c => ({ id: c.id, n: c.name, a: c.player.active ? 1 : 0, d: c.player.dead, g: c.player.god ? 1 : 0, ad: c.admin ? 1 : 0, st: c.player.st | 0, x: Math.round(c.player.x), y: Math.round(c.player.y) })) });
    const bodyMsg = () => ({ t: 'bodies', v: room.sim.bodyVer, b: [...room.sim.bodies.values()] });
    let bm = null;
    for (const c of room.clients.values()) {
      if (c.player.exitSeq > c.exitSent) { c.exitSent = c.player.exitSeq; send(c, { t: 'exit', secs: Math.round(c.player.exitT || 0) }); }
      if (c.bv !== room.sim.bodyVer) { c.bv = room.sim.bodyVer; send(c, bm || (bm = bodyMsg())); }
      const msg = { t: 's', p: peers.filter(p => p.id !== c.id), e: ent, me: c.player.dead, ms: c.player.dseq, cp: room.sim.capInfo(c.player) };
      if (c.player.dead && c.player.kill) msg.mk = c.player.kill;
      if (c.admin && ad) { msg.ad = ad; msg.you = c.id; }
      if (c.admin && c.dbg && dbgList) {
        msg.dbg = dbgList;
        const lg = room.sim.logSince(c.dbgSeq | 0); if (lg.length) { c.dbgSeq = lg[lg.length - 1].s; }
        msg.dx = { lg: lg.map(l => [l.s, l.t, l.x]), pf: dbgPerf };                    // event log (only what is new) + server timings
      }
      send(c, msg);
    }
  }
}, TICK_MS);

srv.listen(PORT, () => console.log(`The Far Backrooms → http://localhost:${PORT}  (share  ?room=NAME  to group up)`));
