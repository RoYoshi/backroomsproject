// Static file server + WebSocket game server (zero dependencies).  Run: node server.js [port]
// Each ?room=NAME is an independent world with its own server-side Hounds, Smilers (ai.js, driven by sim.js),
// blackout timer and shared evidence.  sim.js and ai.js are never served to browsers.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const zlib = require('zlib');
const createSim = require('./sim.js');
const PROTOCOL = require('./spatial_protocol');
const FLAT_GEOMETRY = require('./world_geometry').compile(require('./levels/level0'), require('./world'));
const newEpoch = () => crypto.randomUUID();
const SpatialAuthority = require('./spatial_authority');
// Explicit host-selected canonical world; never selected by a client claim.
const SPATIAL_WORLD = process.env.TFB_WORLD ? JSON.parse(fs.readFileSync(process.env.TFB_WORLD, 'utf8')) : null;
if (SPATIAL_WORLD && SPATIAL_WORLD.geometryMode !== 'spatial') throw Error('TFB_WORLD must be spatial');
const gz = new Map();

const PORT = +process.argv[2] || process.env.PORT || 8000, ROOT = __dirname, MAX_ROOM = 8;
// Admin passcode. Override on the host with the ADMIN_PASSCODE environment variable (recommended).
function startupBanner(status) {
  let revision = '';
  try {
    const git = require('child_process').execFileSync;
    const read = args => git('git', ['-C', ROOT, 'rev-parse', ...args], { encoding: 'utf8', timeout: 400, maxBuffer: 1024, stdio: ['ignore', 'pipe', 'ignore'] }).trim().replace(/[^a-zA-Z0-9._/\-]/g, '').slice(0, 100);
    revision = ` | ${read(['--abbrev-ref', 'HEAD'])} @ ${read(['--short=12', 'HEAD'])}`;
  } catch (_) { /* source packages need no Git installation or checkout */ }
  console.log(`THE FAR BACKROOMS | ${status} | Node ${process.version} | port ${PORT}${revision}`);
}
startupBanner('BOOTING');
const ADMIN_PASS = process.env.ADMIN_PASSCODE || 'smoor';
// How long (seconds) a dead player's body stays in the halls. 0 (default) = until the world resets or that player dies again. Override with the BODY_TTL environment variable.
const BODY_TTL = Math.max(0, +process.env.BODY_TTL || 0);
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const ADMIN_HASH = sha(ADMIN_PASS);
const passOk = s => crypto.timingSafeEqual(sha(s), ADMIN_HASH);
const fails = new Map();                        // ip -> { n, until }  (5 wrong guesses = 60 s lockout)
const TICK_MS = 25, SNAP_EVERY = 2, ADMIN_EVERY = 4;            // simulate ~40 Hz, broadcast ~20 Hz
const SERVE = /^\/(index\.html|camera_policy\.js|timing_policy\.js|levels\/level0\.js|world_geometry\.js|world_motion\.js|spatial_protocol\.js|spatial_history\.js|world_view\.js|stage_d\.html|world\.js|move\.js|ents\.js|mp\.js|hud\.js|gore\.js|dphys\.js|light\.js|glitch\.js|camcorder\.js|inventory\.js|sfx\.js|assets\/[\w.\-]+)$/;   // never serve server.js / sim.js
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const srv = http.createServer((req, res) => {
  let u;
  try { u = decodeURIComponent(String(req.url || '/').split('?')[0]); }
  catch (e) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }       // malformed %-escapes (e.g. "/%"): refuse, never crash
  if (u.includes('\0')) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }
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
const deathSrv = require('./death_srv.js');

/* Movement validation.  Movement stays client-side; the server only refuses what a body cannot do.  Every player has a distance budget
 * that refills at VMAX px/s (the fastest legal motion - a sprint-slide or a fast vault - plus ~20 %) and holds at most BURST seconds of it,
 * so packets that arrive bunched after a lag spike still fit.  A move must fit the budget and not pass through walls (sim.moveOk).
 * A refused move leaves the server's position where it was; if the client keeps claiming somewhere else it is sent a correction.
 * Held in a capture the budget is small (the drag and a crawl); dead it is zero.  Server-side moves (spawn, respawn, admin tools) reset
 * it, with a short grace in which in-flight packets from before the move are ignored instead of corrected.  Admins are not checked:
 * their debug tools move them from the client. */
const MV = { VMAX: 360, VHELD: 130, BURST: 1.5, SLACK: 28, SNAP: 220, GRACE: 900 };
function mvReset(me, grace = true) { const p = me.player; me.mv = { t: Date.now(), bud: MV.VMAX * MV.BURST, grace: grace ? Date.now() + MV.GRACE : 0, bad: 0, badAt: 0, paths: 0, pathT: 0, hist: [[Date.now(), p.x, p.y]] }; p.obsV = 0; }
function mvAccept(me, x, y) {
  const p = me.player, v = me.mv, now = Date.now();
  v.hist.push([now, x, y]); while (v.hist.length > 2 && now - v.hist[1][0] >= 500) v.hist.shift();       // keeps the newest sample that is at least 0.5 s old as the base
  const h0 = v.hist[0], el = (now - h0[0]) / 1000;
  if (el >= .5) p.obsV = Math.hypot(x - h0[1], y - h0[2]) / el;            // what the server saw it do over at least 0.5 s (packets bunched by lag average out instead of spiking)
  p.x = x; p.y = y;
}
function mvCheck(room, me, x, y) {
  const p = me.player; if (!me.mv) mvReset(me, false);
  const v = me.mv, now = Date.now(), dt = Math.min(MV.BURST, Math.max(0, (now - v.t) / 1000)); v.t = now;
  const cap = p.dead ? 0 : p.caught ? MV.VHELD : MV.VMAX;
  v.bud = Math.min(cap * MV.BURST, v.bud + cap * dt);
  const d = Math.hypot(x - p.x, y - p.y);
  let ok = d <= v.bud + MV.SLACK;
  if (ok && d > 0) {                                                        // every accepted move keeps collision legality, however small (tiny steps must not add up through a wall)
    if (d >= 120) { if (now - v.pathT > 1000) { v.pathT = now; v.paths = 0; } ok = ++v.paths <= 3 && room.sim.moveOk(p.x, p.y, x, y, v.bud + MV.SLACK); }      // at most 3 route checks a second
    else ok = room.sim.moveOk(p.x, p.y, x, y, v.bud + MV.SLACK);
  }
  if (ok) { v.bud = Math.max(-MV.SLACK, v.bud - d); v.bad = 0; mvAccept(me, x, y); return true; }       // the slack is a debt, not a free allowance per packet
  me.mvRefused = (me.mvRefused | 0) + 1;
  if (now < v.grace) return false;                                          // packets sent before a server-side move: ignore them
  if (!v.bad) v.badAt = now; v.bad++;
  if (d > MV.SNAP || now - v.badAt > 600) { v.bad = 0; v.grace = now + MV.GRACE; me.mvCorr = (me.mvCorr | 0) + 1; send(me, { t: 'tp', x: Math.round(p.x), y: Math.round(p.y) }); }
  return false;
}
/* a server-side move of a player (spawn, admin tools): set it, tell the client when asked, and restart the movement check from there */
/* Death aftermath.  When the server commits a death it keeps the event (kill record + the victim's look and gear) until the corpse exists.
 * The victim's client normally sends the replay ('fx') and then the corpse ('b').  If it has not sent the replay 1.5 s after the kill -
 * or has disconnected - the server sends the same replay itself; if the corpse has not come when the death would have finished
 * (plus 8 s of slack while the victim is still connected, 0.6 s once it is gone), the server makes it from the same physical simulation
 * (death_srv.js).  Bodies are keyed by player id, so a late client corpse simply replaces the server's: never two. */
function aftStart(room, c) {
  const p = c.player; c.aftSeq = p.dseq;
  room.afts = (room.afts || []).filter(a => a.id !== c.id);
  room.afts.push({ id: c.id, seq: p.dseq, at: Date.now(), kill: Object.assign({}, p.kill), fx: false, body: false,
    info: { name: c.name, look: c.look, ek: p.equipment.kind, ec: HEX.test(c.color) ? c.color : '#ffe7b2', ep: c.lp || '', vx: p.vx, vy: p.vy, ex: p.ex || (p.stamina != null && p.stamina < 22) ? 1 : 0, light: p.light } });
}
const aftOf = (room, id) => (room.afts || []).find(a => a.id === id && !a.body);
function aftTick(room) {
  if (!room.afts || !room.afts.length) return;
  const now = Date.now();
  for (const a of room.afts) {
    const victim = room.clients.get(a.id), gone = !victim || victim.player.dseq !== a.seq && !victim.player.dead;
    if (!a.fx && (gone || now - a.at > 1500)) {
      a.fx = true; a.fxSrv = true; const out = deathSrv.fxFor(a.id, a.kill, a.info);
      for (const c of room.clients.values()) if (c.id !== a.id) send(c, out);
    }
    if (!a.body && now > a.at + (deathSrv.durOf(a.kill) + (gone ? .6 : 8)) * 1000) {
      a.body = true;
      try {
        const R = deathSrv.bodyFor(a.id, a.kill, a.info, room.sim);
        room.sim.setBody(a.id, R.body); a.srvBody = true;
        if (a.kill.k !== 'Smiler' && room.sim.killerEnd) room.sim.killerEnd(a.id, R.attacker.x, R.attacker.y, R.attacker.angle);
        console.log(`[death] room=${room.name} #${a.id}: the victim's client never reported its corpse - the server made it`);
      } catch (e) { console.error('[death] fallback failed', e && e.message); }
    }
  }
  room.afts = room.afts.filter(a => !a.body || now - a.at < 60000);
}
function moveTo(me, x, y, tell = true) { Object.assign(me.player, { x, y }); if (tell) send(me, { t: 'tp', x, y }); mvReset(me); }

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
  if (!r) { const room = r = { name, worldEpoch: newEpoch(), simTick: 0, clients: new Map(), sim: createSim({ world: SPATIAL_WORLD, bodyTtl: BODY_TTL, onDeath: p => { const c = room.clients.get(p.id); if (c) aftStart(room, c); } }), acc: 0, last: Date.now(), tick: 0, pf: { ms: 0, max: 0, snapB: 0, sense: 0, paths: 0, at: Date.now() } }; if (SPATIAL_WORLD) { room.authority = new SpatialAuthority(room, send); room.worldGeneration = room.sim.worldGeneration; } rooms.set(name, r); }
  return r;
}

function syncEpoch(room) {
  if (!room.authority || room.worldGeneration === room.sim.worldGeneration) return;
  room.worldGeneration = room.sim.worldGeneration; room.worldEpoch = newEpoch(); room.simTick = 0;
  for (const c of room.clients.values()) { c.protocolReady = false; c.spatial = null; send(c, {t:'world', protocol:PROTOCOL.manifest(room.sim.geometry, room.worldEpoch, 0)}); }
}
function adminCommand(room, me, m) {
  const sim = room.sim, target = room.clients.get(m.id | 0), A = sim.admin;
  const log = what => console.log(`[admin] room=${room.name} ${me.name}#${me.id}: ${what}`);
  const res = (ok, msg) => send(me, { t: 'ares', ok: !!ok, msg: String(msg).slice(0, 90) });         // a one-line answer for the panel's status bar
  const who = c => String(c.name || 'WANDERER').toUpperCase();
  if (room.authority && m.c === 'speed' && m.v !== 1) return res(false, 'SPATIAL FIXED-TICK SPEED IS 1');
  if (room.authority && ['bring','goto','glitch','item','entgoto','summon','near','nav'].includes(m.c)) return res(false, 'SPATIAL TOOL REQUIRES COMPLETE POSE');
  if (room.authority && m.c === 'spatial-entity') {
    const q=m.pose,kind=m.kind;if(!['hound','smiler'].includes(kind)||!q||!['x','y','z'].every(k=>PROTOCOL.finite(q[k])))return res(false,'INVALID ENTITY POSE');
    if(room.sim.engine.count(kind)>=64)return res(false,'ENTITY LIMIT');
    try { const e=room.sim.engine.spawn(kind,q.x,q.y,{z:q.z,supportId:q.support});res(true,'SPATIAL ENTITY '+e.id); } catch { res(false,'INVALID ENTITY CLEARANCE'); } return;
  }
  if (room.authority && m.c === 'spatial-tp') {
    const c = target || me, q = m.pose;
    if (!q || !['x','y','z'].every(k => PROTOCOL.finite(q[k]))) return res(false, 'INVALID SPATIAL DESTINATION');
    try { const b = room.sim.spatialMotion.initialize({...q, vx:0, vy:0, vz:0}); if (!b.supportId || q.support !== b.supportId) return res(false, 'INVALID SUPPORT'); Object.assign(c.player, b, {trav:null}); room.authority.reset(c, 'authorized-teleport'); res(true, 'MOVED TO SPATIAL POSE'); } catch { res(false, 'INVALID CLEARANCE'); }
    return;
  }
  switch (m.c) {
    case 'kick':
      if (target && target !== me) { log(`kick ${target.name}#${target.id}`); res(true, 'KICKED ' + who(target)); send(target, { t: 'kick' }); setTimeout(() => { try { target.sock.write(Buffer.from([0x88, 0])); target.sock.end(); } catch (e) {} }, 150); }
      break;
    case 'revive': if (target) { log(`revive ${target.name}`); target.player.dead = ''; target.player.reviveOk = true; target.player.safe = 3; A.endPreview(target.player); if (room.authority) room.authority.reset(target, 'revive'); send(target, { t: 'revive' }); res(true, 'REVIVED ' + who(target)); } break;
    case 'god': if (target) { const on = A.god(target.player); log(`god ${target.name} -> ${on}`); res(true, 'GOD MODE ' + (on ? 'ON' : 'OFF') + ' · ' + who(target)); } break;
    case 'bring': if (target && target !== me) { log(`bring ${target.name}`); const { x, y } = me.player; moveTo(target, x, y); res(true, 'BROUGHT ' + who(target)); } break;
    case 'goto': if (target && target !== me) { log(`goto ${target.name}`); const { x, y } = target.player; moveTo(me, x, y); res(true, 'WENT TO ' + who(target)); } break;
    case 'freeze': log(`freeze ${!!m.on}`); A.freeze(m.on); res(true, m.on ? 'WORLD FROZEN' : 'WORLD RUNNING'); break;
    case 'speed': log(`speed ${m.v}`); A.speed(m.v); res(true, 'WORLD SPEED ×' + A.info().sp); break;
    case 'blackout': log(`blackout ${m.mode}`); A.blackout(m.mode); res(true, 'LIGHTS: ' + (m.mode === 'on' ? 'BLACKOUT ON' : m.mode === 'off' ? 'BLACKOUT OFF' : 'AUTO')); break;
    case 'hounds': {
      const add = m.mode !== 'remove', want = Math.max(1, Math.min(10, m.n | 0 || 1)); let done = 0;
      for (; done < want; done++) if (!(add ? A.addHound() : A.removeHound())) break;
      const inf = A.info(); log(`hound ${add ? 'add' : 'remove'} x${want} -> ${done}`);
      res(done > 0, done ? `${done} HOUND${done === 1 ? '' : 'S'} ${add ? 'ADDED' : 'REMOVED'} · ${inf.hn}/${inf.mh}` : (add ? `CANNOT ADD: LIMIT ${inf.mh} OR NO SPAWN SPOT` : 'NO HOUNDS TO REMOVE')); break;
    }
    case 'smilers': {
      const add = m.mode !== 'remove', want = Math.max(1, Math.min(10, m.n | 0 || 1)); let done = 0;
      for (; done < want; done++) if (!(add ? A.addSmiler() : A.removeSmiler())) break;
      const inf = A.info(); log(`smiler ${add ? 'add' : 'remove'} x${want} -> ${done}`);
      res(done > 0, done ? `${done} SMILER${done === 1 ? '' : 'S'} ${add ? 'ADDED' : 'REMOVED'} · ${inf.sn}/${inf.ms}` : (add ? `CANNOT ADD: LIMIT ${inf.ms} OR NO SPAWN SPOT` : 'NO SMILERS TO REMOVE')); break;
    }
    case 'glitch':
      log(`glitch ${m.mode}`);
      if (m.mode === 'new') { A.newGlitches(); res(true, 'GLITCHED WALLS MOVED'); }
      else { const g = A.nearestGlitch(me.player.x, me.player.y); if (g) { const x = g.x - g.nx * 96, y = g.y - g.ny * 96; moveTo(me, x, y); res(true, 'AT THE NEAREST GLITCHED WALL'); } }
      break;
    case 'item':
      log(`item ${m.mode}`);
      if (m.mode === 'new') { A.newItem(); res(true, 'CARTOGRAPH MOVED'); }
      else { const g = A.nearestItem(me.player.x, me.player.y); if (g) { const x = g.x + 70, y = g.y; moveTo(me, x, y); res(true, 'AT THE CARTOGRAPH'); } else res(false, 'THE CARTOGRAPH HAS BEEN TAKEN'); }
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
    case 'entgoto': { const e = A.entityAt(m.eid), s = e && A.spotNear(e.x, e.y); if (s) { moveTo(me, s.x, s.y); log(`goto entity ${m.eid}`); res(true, 'WENT TO ENTITY #' + (m.eid | 0)); } else res(false, 'NO SUCH ENTITY'); break; }
    case 'nav': { const r = room.sim.navCmd(m.eid | 0, String(m.cmd || ''), me.player); log(`nav ${m.cmd} #${m.eid}`); res(!!r, r ? 'ENTITY #' + (m.eid | 0) + ': ' + r : 'NO SUCH ENTITY'); break; }
    case 'entdel': { const ok = A.removeEntity(m.eid); log(`remove entity ${m.eid}`); res(ok, ok ? 'ENTITY #' + (m.eid | 0) + ' REMOVED' : 'NO SUCH ENTITY'); break; }
    case 'world': log('reset world'); A.resetWorld(); syncEpoch(room); for (const c of room.clients.values()) { if (c.player.active && !room.authority) send(c, { t: 'tp', x: c.player.x, y: c.player.y }); mvReset(c); } res(true, 'NEW RUN FOR EVERYONE'); break;
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
  send(me, { t: 'hi', id, sim: 1, protocol: PROTOCOL.manifest(room.sim.geometry, room.worldEpoch, room.simTick) });

  function onMessage(m) {
    if (m.t === 'hello') { const why = PROTOCOL.compatible(m.protocol, PROTOCOL.manifest(room.sim.geometry, room.worldEpoch, room.simTick)); if (why) { send(me, { t: 'incompatible', reason: why }); return; } if (room.authority && m.protocol.worldEpoch !== room.worldEpoch) return; if (me.protocolReady) return; me.protocolReady = true; if (room.authority) room.authority.reset(me, 'handshake'); return; }
    if (room.authority && m.t !== 'admin' && m.t !== 'ping' && !me.protocolReady) { send(me, { t: 'incompatible', reason: 'spatial-handshake-required' }); return; }
    if (room.authority && !['hello','admin','ping','sp'].includes(m.t) && (m.worldEpoch !== room.worldEpoch || m.life !== (player.life || 0) || m.ack !== me.spatial?.discontinuity)) { room.authority.reject(me, 'action-identity'); return; }
    if (room.authority && m.t === 'resync') { if (room.simTick - (me.resyncAt ?? -90) >= 30) { me.resyncAt=room.simTick; room.authority.correct(me, 'client-resync'); } return; }
    if (room.authority && m.t === 'sp') { room.authority.enqueue(me, m); return; }
    if (room.authority && m.t === 'p') { room.authority.reject(me, 'legacy-movement'); return; }
    if (m.t === 'p') {
      const now = Date.now();
      if (m.mv && room.sim.hearMove(player, m.mv)) me.mvAt = now;           // state / stamina / vault + slide noises: processed even if the position is throttled
      if (now - me.last < 30 || !isFinite(m.x) || !isFinite(m.y)) { room.sim.gaitFloor(player, now - (me.mvAt || 0) < 500); return; }
      me.last = now;
      const p = player;
      if (!p.dead) {                       // a caught player's body stays where it fell
        const x = num(m.x, 0, 96 * 96), y = num(m.y, 0, 72 * 96);
        let ok = true;
        if (me.admin) { if (!me.mv) mvReset(me, false); mvAccept(me, x, y); me.mv.bud = MV.VMAX * MV.BURST; }     // admin debug tools move the admin from its own client
        else if (!p.active) { p.x = x; p.y = y; }                              // in the menu: not in the world, nothing to check
        else if (me.spawnNext) {                                              // the first position after a join / respawn: where the client chose to spawn
          me.spawnNext = false;
          if (room.sim.spawnOk(x, y)) { p.x = x; p.y = y; mvReset(me, false); }
          else { me.mv.grace = 0; ok = mvCheck(room, me, x, y); }               // not a spawn spot: an ordinary move from the server's spawn point (corrected at once if it is not one)
        }
        else ok = mvCheck(room, me, x, y);                                     // refused: the position stays; the rest of the packet still counts
        if (ok) { p.vx = num(m.vx, -500, 500); p.vy = num(m.vy, -500, 500); }
      }
      room.sim.gaitFloor(p, now - (me.mvAt || 0) < 500);                     // what the AI hears can never be quieter than the accepted movement, report or not
      p.angle = +m.a || 0; p.sprinting = !!m.r; me.raised = m.l !== 0; p.light = me.raised; me.ir = me.raised && kindOf(m.k) === 'camcorder' ? Math.max(0, Math.min(2, m.ir | 0)) : 0;   // infrared lives on the CONNECTION, never on the player the simulation / AI sees (Part 2 2C-IR)      // light: what the AI may perceive (sim.js keeps only VISIBLE light); raised: presentation for the other players
      p.equipment.kind = kindOf(m.k);
      me.name = String(m.n || 'WANDERER').slice(0, 20);
      if (HEX.test(m.c)) me.color = m.c;
      me.look = cleanLook(m.lk) || me.look; me.lp = cleanParts(m.lp);
      me.angle = p.angle; me.sprint = m.r ? 1 : 0; me.fall = m.f >= 0 && m.f <= 1 ? +m.f : -1;
    } else if (m.t === 'join') { if (room.sim.join(player, Date.now() / 1000)) { mvReset(me); me.spawnNext = !room.authority; if (room.authority) { syncEpoch(room); if (me.protocolReady) room.authority.reset(me, 'spawn'); } } else send(me, { t: 'tp', x: Math.round(player.x), y: Math.round(player.y) }); }
    else if (m.t === 'respawn') {                                          // only from a death (or an admin revive): see sim.respawn
      if (room.sim.respawn(player)) { mvReset(me); me.spawnNext = !room.authority; if (room.authority) { syncEpoch(room); if (me.protocolReady) room.authority.reset(me, 'spawn'); } }
      else { me.respawnRefused = (me.respawnRefused | 0) + 1; send(me, { t: 'tp', x: Math.round(player.x), y: Math.round(player.y) }); }
    }
    else if (m.t === 'leave') { if (!room.sim.leave(player, Date.now() / 1000)) me.leaveRefused = (me.leaveRefused | 0) + 1; }      // to the menu: only from death or at the end of a new-run vanish, never while held (sim.js lifecycle)
    else if (m.t === 'fx') {                                                // replay someone's death / vanishing for everybody else
      const t = Date.now(), k = m.k === 'death' ? 'death' : m.k === 'vanish' ? 'vanish' : '';
      if (!k || !player.active || t - (me.fxAt || 0) < 1500 || (k === 'death' && !player.dead)) return;
      if (k === 'vanish' && !room.sim.vanish(player, t / 1000)) return;       // the new-run sequence: only while alive and free, once every 30 s (it protects for 4 s)
      me.fxAt = t;
      if (k === 'death') { const a = aftOf(room, id); if (a) { if (a.fx) return; a.fx = true; } }        // the server already replayed it for this victim: not twice
      const out = { t: 'fx', k, id, c: m.c === 'Smiler' ? 'Smiler' : 'Hound', x: num(m.x, 0, 9216), y: num(m.y, 0, 6912), a: num(m.a, -20, 20), sx: num(m.sx, 0, 9216), sy: num(m.sy, 0, 6912),
        v: /^[ABCD]$/.test(m.v) ? m.v : 'A', w: Array.isArray(m.w) && m.w.length === 3 ? [num(m.w[0], 0, 9216), num(m.w[1], 0, 6912), num(m.w[2], -20, 20)] : 0,
        lk: cleanLook(m.lk) || me.look, ek: kindOf(m.ek), ec: HEX.test(m.ec) ? m.ec : '#ffe7b2', ep: cleanParts(m.ep), vx: num(m.vx, -900, 900), vy: num(m.vy, -900, 900), ex: m.ex ? 1 : 0 };
      for (const c of room.clients.values()) if (c !== me) send(c, out);
    }
    else if (m.t === 'pick') { if (player.active && !player.dead) { const it = room.sim.takeItem(player); if (it) send(me, { t: 'got', item: it }); } }
    else if (m.t === 'admin') {
      const now = Date.now(), f = fails.get(ip) || { n: 0, until: 0 };
      if (now < f.until) return send(me, { t: 'admin', ok: false, wait: Math.ceil((f.until - now) / 1000) });
      if (passOk(m.pass)) { me.admin = true; fails.delete(ip); console.log(`[admin] ${me.name}#${id} unlocked admin (room ${name})`); send(me, { t: 'admin', ok: true, q: m.quiet ? 1 : 0 }); }
      else { if (++f.n >= 5) { f.until = now + 60000; f.n = 0; } fails.set(ip, f); console.log(`[admin] ${me.name}#${id} wrong admin passcode (room ${name})`); send(me, { t: 'admin', ok: false, wait: f.until > now ? 60 : 0 }); }
    }
    else if (m.t === 'a') { if (me.admin) adminCommand(room, me, m); }
    else if (m.t === 'ping') { const t = Date.now(); if (t - (me.pingAt || 0) > 400) { me.pingAt = t; send(me, { t: 'pong', ts: +m.ts || 0 }); } }
    else if (m.t === 'b') {                 // the finished corpse of a player we already know was caught; one per player
      if (!player.dead && m.c !== 'Vanish') return;
      const n3 = a => [num(a && a[0], 0, 9216), num(a && a[1], 0, 6912), num(a && a[2], -20, 20)];
      if (m.c === 'Hound' && Array.isArray(m.ka) && room.sim.killerEnd) room.sim.killerEnd(id, num(m.ka[0], 0, 9216), num(m.ka[1], 0, 6912), num(m.ka[2], -20, 20));   // where the kill animation left the hound
      { const a = aftOf(room, id); if (a) a.body = true; }                 // the victim's own corpse: the server's fallback is not needed
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
      if (op === 1 && len < (room.authority ? 16384 : 1400)) { try { onMessage(JSON.parse(pl)); } catch (e) { /* ignore bad input */ } }
    }
  });
  const bye = () => {
    if (!room.clients.has(id)) return;
    if (player.caught && !player.dead) room.sim.forfeit(player);          // walking out of a capture is a death (its aftermath is recorded before we go), not an escape
    room.clients.delete(id);
    room.sim.removePlayer(player);
    if (!room.clients.size) rooms.delete(name);       // empty world is thrown away
  };
  sock.on('close', bye); sock.on('error', bye);
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    syncEpoch(room);
    const dt = Math.min(0.25, (now - room.last) / 1000); room.last = now;
    room.acc += dt;
    if (room.authority) room.authority.beginWake();
    let n = 0; const h0 = process.hrtime.bigint();
    while (room.acc >= 1 / 60 && n++ < 15) { room.simTick++; if (room.authority) room.authority.step(); room.sim.step(1 / 60); if (room.authority) room.authority.afterSim(); room.acc -= 1 / 60; }
    if (n) { const per = Number(process.hrtime.bigint() - h0) / 1e6 / n; room.pf.ms += (per - room.pf.ms) * .05; room.pf.max = Math.max(per, room.pf.max * .995); }      // milliseconds per 60 Hz step (average / recent worst)
    if (++room.tick % SNAP_EVERY) continue;

    for (const c of room.clients.values()) if (c.player.dead && c.player.kill && c.aftSeq !== c.player.dseq) aftStart(room, c);
    aftTick(room);
    const ent = room.sim.entities();
    const peers = [];
    for (const c of room.clients.values()) {
      if (!c.player.active) continue;
      peers.push({ id: c.id, x: Math.round(c.player.x), y: Math.round(c.player.y), a: +c.angle.toFixed(2),
        n: c.name, c: c.color, d: c.player.dead ? 1 : 0, r: c.sprint,
        k: c.player.equipment.kind, l: c.raised ?? c.player.light ? 1 : 0, ir: c.ir | 0, lk: c.look, lp: c.lp || '', f: c.fall === undefined ? -1 : c.fall,
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
      if (room.authority && c.protocolReady) { msg.protocol = { worldEpoch: room.worldEpoch, simTick: room.simTick }; msg.pose = room.authority.pose(c); msg.spatial = room.sim.engine.entities.map(e => PROTOCOL.pose(e, { worldEpoch: room.worldEpoch, entityId: (e.kind === 'hound' ? 'h' : 'm') + e.id, generation: room.sim.worldGeneration, tick: room.simTick, seq: room.simTick, discontinuity: 0 }, room.sim.geometry)); msg.spatial.push(...[...room.clients.values()].filter(o => o.player.active && o !== c).map(o => room.authority.pose(o))); if (c.admin) msg.spatialStats = room.authority.stats; }
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

srv.listen(PORT, () => { startupBanner('ONLINE'); console.log(`The Far Backrooms → http://localhost:${PORT}  (share  ?room=NAME  to group up)`); });
