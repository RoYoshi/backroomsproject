// Static file server + WebSocket game server (zero dependencies).  Run: node server.js [port]
// Each ?room=NAME is an independent world with its own server-side Hounds, Smilers (ai.js, driven by sim.js),
// blackout timer and shared evidence.  sim.js and ai.js are never served to browsers.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const zlib = require('zlib');
const createSim = require('./sim.js');

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

const srv = http.createServer(require('./server/static.js')(ROOT));   // Stage 3H0: the static file serving (the SERVE allowlist, MIME types, caching, gzip, /sounds).  fs, path and zlib are still required first, as before, though only server/static.js uses them now

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
/* Stage 3D HQ2: living Wanderers are solid to each other (server/peers.js: D = 36 px, the drawn body).  Solid: in this room (each room
 * has its own clients), in a run, not dead, not out through a glitched wall, not held in a capture (a capture moves its victim; nothing
 * may block or be blocked by that).  A non-solid mover ignores the others; a solid one is checked against every other solid one, from
 * the server's own positions, on every accepted move - after the walls (walls always win); a long hop the walls allow only along a route
 * round them is swept along that route (sim.moveRoute, peers.sweepPath).  Spawns, respawns, admin teleports and the admin world reset
 * land where they always did unless a player stands on or next to that spot (within D + 8): then on the nearest free spot (peers.freeSpot:
 * clear of walls by 20 px and D + 8 from everyone).  A move the others cut short is accepted as far as it may go (peers.resolve); within 8 px of
 * the claim that is silent; the client is told where it really is with a soft correction ({t:'tp', x, y, pc:1}) when its claim is more
 * than 8 px off, or more than 2 px off for 0.3 s, at most every 0.3 s.  In the grace after a server-side placement such a move was sent
 * before it (back towards the old spot) and is ignored, as a refused one is.  The AI keeps hearing only what the server accepted. */
const PEERS = require('./server/peers.js'), PD = PEERS.D_BODY, NONE = [];
const solidP = p => !!(p.active && !p.dead && !p.exited && !p.caught);
function blockers(room, me) {
  if (!solidP(me.player)) return NONE;
  let out = null; for (const c of room.clients.values()) if (c !== me && solidP(c.player)) (out || (out = [])).push([c.player.x, c.player.y]);
  return out || NONE;
}
function peerCorrect(me, miss, now) {
  const v = me.mv;
  if (miss <= 2) { v.pcSince = 0; return; }
  if (!v.pcSince) v.pcSince = now;
  if ((miss > 8 || now - v.pcSince > 300) && now - (v.pcAt || 0) > 300) { v.pcAt = now; v.pcSince = 0; me.peerCorr = (me.peerCorr | 0) + 1; send(me, { t: 'tp', x: Math.round(me.player.x), y: Math.round(me.player.y), pc: 1 }); }
}
function placeFree(room, me) {                                                  // a server-side placement: where it was put, unless someone stands on or next to it
  const p = me.player, ps = blockers(room, me), need = (PD + 8) * (PD + 8);      // (within D + 8): then the nearest free spot; true if it moved
  if (ps.every(q => (p.x - q[0]) * (p.x - q[0]) + (p.y - q[1]) * (p.y - q[1]) >= need)) return false;
  const f = PEERS.freeSpot(p.x, p.y, ps, (x, y, r) => room.sim.clearAt(x, y, r), PD);
  p.x = f.x; p.y = f.y; return f.moved;
}
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
    let route = null;
    if (d >= 120) { if (now - v.pathT > 1000) { v.pathT = now; v.paths = 0; } ok = ++v.paths <= 3 && (route = room.sim.moveRoute(p.x, p.y, x, y, v.bud + MV.SLACK)) !== null; }      // at most 3 route checks a second
    else ok = room.sim.moveOk(p.x, p.y, x, y, v.bud + MV.SLACK);
    if (ok) {                                                               // Stage 3D HQ2: then the other living players (server/peers.js)
      const ps = blockers(room, me);
      if (ps.length) {
        const r = route && route.length                                     // a long hop allowed only round walls: swept along that route; else along the line
          ? PEERS.sweepPath(p.x, p.y, route.concat([[x, y]]), ps, PD)
          : PEERS.resolve(p.x, p.y, x, y, ps, PD, (ax, ay) => room.sim.moveOk(p.x, p.y, ax, ay, v.bud + MV.SLACK));
        if (r.how !== 'free') {
          if (now < v.grace) { me.mvRefused = (me.mvRefused | 0) + 1; return false; }   // just after a server-side placement: a packet sent before it (back towards the old spot) is ignored, as a refused one is
          me.peerHits = (me.peerHits | 0) + 1;
          v.bud = Math.max(-MV.SLACK, v.bud - Math.hypot(r.x - p.x, r.y - p.y)); v.bad = 0; mvAccept(me, r.x, r.y);
          peerCorrect(me, Math.hypot(x - r.x, y - r.y), now);
          return true;
        }
      }
    }
  }
  if (ok) { v.bud = Math.max(-MV.SLACK, v.bud - d); v.bad = 0; v.pcSince = 0; mvAccept(me, x, y); return true; }       // the slack is a debt, not a free allowance per packet
  me.mvRefused = (me.mvRefused | 0) + 1;
  if (now < v.grace) return false;                                          // packets sent before a server-side move: ignore them
  if (!v.bad) v.badAt = now; v.bad++;
  if (d > MV.SNAP || now - v.badAt > 600) { v.bad = 0; v.grace = now + MV.GRACE; me.mvCorr = (me.mvCorr | 0) + 1; send(me, { t: 'tp', x: Math.round(p.x), y: Math.round(p.y) }); }
  return false;
}
/* a server-side move of a player (spawn, admin tools): set it, tell the client when asked, and restart the movement check from there */
/* Death aftermath (Stage 3D: one event, decided and finished by the server).  When the server commits a death (sim -> onDeath) it opens
 * the event: a death id (de), the kill record completed with what the death needs (the victim's speed and exhaustion, rounded as sent),
 * and the replay message for everyone else (fxFor: the same inputs).  The victim's own client plays the same death from the same record
 * (it reads it in the snapshot's 'mk'), so victim, spectators and the server run one physical death.  Each client gets the replay once
 * (aftSend), with how far it has run if they arrive late.  When the death's length has passed the server makes the corpse itself from
 * that simulation's last frame and places the attacker where the death left it; clients report no corpse, death or light record at all
 * (Stage 3D HQ2: the NEW RUN vanish's light record is gone with it).  An admin revive cancels the event; a world reset drops it.  Bodies
 * stay keyed by player id: never two. */
function aftStart(room, c) {
  const p = c.player; c.aftSeq = p.dseq;
  room.afts = (room.afts || []).filter(a => a.id !== c.id);
  const de = room.deSeq = (room.deSeq | 0) + 1;
  const info = { name: c.name, look: c.look, ek: p.equipment.kind, ec: HEX.test(c.color) ? c.color : '#ffe7b2', ep: c.lp || '', vx: Math.round(p.vx || 0), vy: Math.round(p.vy || 0), ex: p.ex || (p.stamina != null && p.stamina < 22) ? 1 : 0, light: p.light };
  const lf = info.light ? deathSrv.DP.lightProfile(room.sim.worldSeq, de, info.ek) : null;      // Stage 3D HQ1: how its light fails (a lit light that is not a camcorder)
  if (p.kill) Object.assign(p.kill, { de, vx: info.vx, vy: info.vy, ex: info.ex }, lf ? { lf } : {});   // the victim's copy of the record ('mk')
  const kill = Object.assign({}, p.kill), fx = Object.assign(deathSrv.fxFor(c.id, kill, info), { de, wn: room.sim.worldSeq, lo: info.light ? 1 : 0 }, lf ? { lf } : {});   // (wn: Stage 3D HQ2, the world it happened in; an fx's w is the Hound C wall)
  let run = null; try { run = deathSrv.begin(kill, info, room.sim); } catch (e) { console.error('[death] begin failed', e && e.message); }
  room.afts.push({ id: c.id, seq: p.dseq, de, at: Date.now(), world: room.sim.worldSeq, kill, fx: true, fxMsg: fx, sent: new Set([c.id]), body: false, info, run });
}
const aftOf = (room, id) => (room.afts || []).find(a => a.id === id && !a.body && !a.boom);       // (a death in progress: an admin revive cancels it; a NEW RUN blast it never touches)
/* the replay to every client that has not had it yet (a late joiner gets it with el: the seconds it has already run) */
function aftSend(room) {
  if (!room.afts || !room.afts.length) return;
  const now = Date.now();
  for (const a of room.afts) {
    if (a.body || !a.fxMsg) continue;
    const el = (now - a.at) / 1000;
    for (const c of room.clients.values()) if (!a.sent.has(c.id)) { a.sent.add(c.id); send(c, el > .25 ? Object.assign({}, a.fxMsg, { el: +el.toFixed(2) }) : a.fxMsg); }
  }
}
function aftTick(room) {
  if (!room.afts || !room.afts.length) return;
  const now = Date.now();
  for (const a of room.afts) {
    if (a.body) continue;
    if (room.sim.worldSeq !== a.world) { a.body = true; a.dropped = 'world reset'; continue; }        // the world it died in is gone
    if (now < a.at + deathSrv.durOf(a.kill) * 1000) { if (a.run) try { deathSrv.step(a.run, (now - a.at) / 1000); } catch (e) { a.run = null; } continue; }   // the death plays: its physics advances with it
    a.body = true;
    try {
      const R = a.run ? deathSrv.corpse(a.id, a.kill, a.info, a.run) : a.boom ? deathSrv.corpse(a.id, a.kill, a.info, deathSrv.boomBegin(a.kill, a.info, room.sim)) : deathSrv.bodyFor(a.id, a.kill, a.info, room.sim); a.run = null;
      R.body.de = a.de;
      putBody(room, a.id, R.body, a.at + deathSrv.durOf(a.kill) * 1000);                          // (Stage 3D HQ1: made at the death's end, its own time)
      if (a.kill.k === 'Hound' && room.sim.killerEnd) room.sim.killerEnd(a.id, R.attacker.x, R.attacker.y, R.attacker.angle);    // (Stage 3D HQ2: only a hound has a killer to place; a NEW RUN blast has none)
      console.log(`[death] room=${room.name} #${a.id} de=${a.de}: ${a.kill.k} ${a.kill.v || ''} corpse placed`);
    } catch (e) { console.error('[death] corpse failed', e && e.message); }
  }
  room.afts = room.afts.filter(a => !a.body || now - a.at < 60000);
}
/* Stage 3D HQ2 (H2-4): an admin world reset is a new world epoch for everyone.  In one step: the world's number goes up (sim.resetWorld,
 * which also clears every corpse); every death or NEW RUN blast still playing is dropped at once (no corpse will come of it); every
 * client is told {t:'world', w} - with x, y, where it now stands, if it is in a run - and then an 'end' for each dropped event; every
 * active player is brought back (sim.resetWorld respawns them, the dead included) onto a free spot, and told by tp as before.  A client
 * ends everything of the old world on its screen (mp.js worldNew) and ignores any death, blast or corpse message naming an older world.
 * The reset answers no NEW RUN, explodes nobody and starts nobody's cooldown. */
function worldReset(room) {
  const A = room.sim.admin, w0 = room.sim.worldSeq; A.resetWorld();
  const w = room.sim.worldSeq, ends = [];
  for (const a of room.afts || []) if (!a.body && a.world === w0) { a.body = true; a.dropped = 'world reset'; a.run = null; ends.push({ t: 'fx', k: 'end', id: a.id, de: a.de, wn: w }); }
  for (const c of room.clients.values()) {
    const msg = { t: 'world', w };
    if (c.player.active) { placeFree(room, c); msg.x = Math.round(c.player.x); msg.y = Math.round(c.player.y); }
    send(c, msg); for (const e of ends) send(c, e);
    if (c.player.active) send(c, { t: 'tp', x: msg.x, y: msg.y });
    mvReset(c);
  }
}
/* Stage 3D: when each corpse was made (server time, kept beside the record, never sent), so every client can be told its age ('ag' in
 * 'bodies'): blood that has dried on one screen is dry on a late joiner's too */
const bodyAt = new WeakMap();
function putBody(room, id, rec, at) { bodyAt.set(rec, at == null ? Date.now() : Math.min(Date.now(), at)); room.sim.setBody(id, rec); }   // at: Stage 3D HQ1, a death's corpse is as old as its death's end
function moveTo(room, me, x, y, tell = true) {                                // (Stage 3D HQ2: onto a free spot near (x, y): never into another player)
  Object.assign(me.player, { x, y }); placeFree(room, me); if (tell) send(me, { t: 'tp', x: Math.round(me.player.x), y: Math.round(me.player.y) }); mvReset(me);
}
/* Stage 3D HQ2: an admin's own moves skip the walls (its debug tools move it from its client), not the other players: a step is resolved
 * like anyone's; a jump (120 px or more: a teleport) is not swept - it lands where it was aimed unless that is inside a player (closer
 * than D), and then on the nearest free spot */
function adminMove(room, me, x, y) {
  const p = me.player, ps = blockers(room, me);
  if (!ps.length) return mvAccept(me, x, y);
  if (Math.hypot(x - p.x, y - p.y) < 120) {
    const r = PEERS.resolve(p.x, p.y, x, y, ps, PD);
    if (r.how !== 'free' && Date.now() < me.mv.grace) return;              // (as mvCheck: a packet sent before its own jump was moved is ignored)
    mvAccept(me, r.x, r.y); if (r.how !== 'free') { me.peerHits = (me.peerHits | 0) + 1; peerCorrect(me, Math.hypot(x - r.x, y - r.y), Date.now()); } return;
  }
  if (ps.every(q => (x - q[0]) * (x - q[0]) + (y - q[1]) * (y - q[1]) >= PD * PD)) return mvAccept(me, x, y);
  const f = PEERS.freeSpot(x, y, ps, (a, b, r) => room.sim.clearAt(a, b, r), PD);
  mvAccept(me, f.x, f.y); if (f.moved) { me.mv.grace = Date.now() + MV.GRACE; send(me, { t: 'tp', x: f.x, y: f.y }); }
}
/* Stage 3D HQ2: NEW RUN is the server's decision, not the client's.  The client sends only its intent, {t:'nr', q: its press number,
 * w: the world it is in}, and changes nothing until the answer: {t:'nra', q, ok:1, de, w} - approved: the player is out of the world at
 * once (sim.newRun: to the menu, so its next join starts the new run) - or {t:'nra', q, ok:0, why, wait?} - refused, nothing changed
 * ('state': not in a run; 'dead'; 'held': in a capture; 'cooldown': wait seconds left of the 30 s; 'epoch': the press was made in a world
 * an admin has since reset).  One answer per press: the same q again gets the same answer (no second event); an older q, a malformed one
 * or an intent within 250 ms of the last gets none (a flood is dropped and counted).  A world reset, a death, END and RESPAWN never come
 * through here, so none of them explodes anyone or starts anyone's cooldown. */
const NR_GAP = 250;
/* Stage 3D HQ2 (H2-2): the approved NEW RUN's explosion, an aftermath like a death's (aftSend / aftTick): one event, decided here, at the
 * position and facing the server holds for the player, its blast seeded from the world and the event id (dphys.boomPlan), its light's
 * failure chosen once (HQ1's lightProfile) when the light was a lit emitter.  Every client gets the replay once - the player's own
 * page too (its short beat shows the blast) - a late joiner with how far it has run; at its end the server places the corpse (cause
 * 'Boom').  It is no attack: nobody else, no entity and no part of the world is touched, and the AI is told nothing. */
function boomStart(room, c, de) {
  const p = c.player, w = room.sim.worldSeq, plan = deathSrv.DP.boomPlan(w, de);
  const info = { name: c.name, look: c.look, ek: p.equipment.kind, ec: HEX.test(c.color) ? c.color : '#ffe7b2', ep: c.lp || '', vx: Math.round(p.vx || 0), vy: Math.round(p.vy || 0), ex: 0, light: p.light };
  const lf = info.light ? deathSrv.DP.lightProfile(w, de, info.ek) : null;
  const B = Object.assign({ k: 'Boom', x: Math.round(p.x), y: Math.round(p.y), a: +(+p.angle || 0).toFixed(3), d: plan.d, s: plan.s }, lf ? { lf } : {});
  const fx = Object.assign(deathSrv.boomFx(c.id, B, info), { de, wn: w, lo: info.light ? 1 : 0 }, lf ? { lf } : {});
  let run = null; try { run = deathSrv.boomBegin(B, info, room.sim); } catch (e) { console.error('[newrun] begin failed', e && e.message); }
  room.afts = (room.afts || []).filter(a => a.id !== c.id || a.body);
  room.afts.push({ id: c.id, seq: -1, de, at: Date.now(), world: w, kill: B, fx: true, fxMsg: fx, sent: new Set(), body: false, info, run, boom: true });
}
function nrIntent(room, me, m) {
  const now = Date.now(); if (now - (me.nrT || 0) < NR_GAP) { me.nrDropped = (me.nrDropped | 0) + 1; return; }
  const q = Number.isSafeInteger(m.q) && m.q > 0 && m.q < 2147483648 ? m.q : 0; if (!q) return;
  me.nrT = now;
  if (me.nr) { if (q === me.nr.q) return send(me, me.nr.ans); if (q < me.nr.q) return; }
  const sim = room.sim, p = me.player, t = now / 1000;
  let why = m.w !== sim.worldSeq ? 'epoch' : sim.nrWhy(p, t), ans;
  if (!why) why = sim.newRun(p, t);
  if (why) { ans = { t: 'nra', q, ok: 0, why }; if (why === 'cooldown') ans.wait = Math.ceil(sim.nrWait(p, t) * 10) / 10; }
  else {
    const de = room.deSeq = (room.deSeq | 0) + 1;
    ans = { t: 'nra', q, ok: 1, de, w: sim.worldSeq };
    me.spawnNext = false;
    boomStart(room, me, de);                                                    // H2-2: the one explosion of this decision
    console.log(`[newrun] room=${room.name} #${me.id} de=${de}: approved`);
  }
  me.nr = { q, ans }; send(me, ans);
}

const { frame, reader } = require('./server/ws.js');   // Stage 3H0: the WebSocket framing (frame: what send() writes; reader: each socket's 'data' handler)
const send = (c, obj) => { const f = frame(JSON.stringify(obj)); if (f && !c.sock.destroyed) c.sock.write(f); };
const { num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook } = require('./server/fields.js');   // Stage 3H0: the checks applied to what clients send

function getRoom(name) {
  let r = rooms.get(name);
  if (!r) { const room = r = { name, clients: new Map(), sim: createSim({ bodyTtl: BODY_TTL, onDeath: p => { const c = room.clients.get(p.id); if (c) aftStart(room, c); } }), acc: 0, last: Date.now(), tick: 0, pf: { ms: 0, max: 0, snapB: 0, sense: 0, paths: 0, at: Date.now() } }; rooms.set(name, r); }
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
    case 'revive': if (target) {
      { const a = aftOf(room, target.id); if (a) { a.body = true; a.dropped = 'revived'; for (const c of room.clients.values()) if (c !== target) send(c, { t: 'fx', k: 'end', id: target.id, de: a.de }); } }   // Stage 3D: undone, so no corpse
      log(`revive ${target.name}`); target.player.dead = ''; target.player.reviveOk = true; target.player.safe = 3; A.endPreview(target.player); send(target, { t: 'revive' }); res(true, 'REVIVED ' + who(target)); } break;
    case 'god': if (target) { const on = A.god(target.player); log(`god ${target.name} -> ${on}`); res(true, 'GOD MODE ' + (on ? 'ON' : 'OFF') + ' · ' + who(target)); } break;
    case 'bring': if (target && target !== me) { log(`bring ${target.name}`); const { x, y } = me.player; moveTo(room, target, x, y); res(true, 'BROUGHT ' + who(target)); } break;
    case 'goto': if (target && target !== me) { log(`goto ${target.name}`); const { x, y } = target.player; moveTo(room, me, x, y); res(true, 'WENT TO ' + who(target)); } break;
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
      else { const g = A.nearestGlitch(me.player.x, me.player.y); if (g) { const x = g.x - g.nx * 96, y = g.y - g.ny * 96; moveTo(room, me, x, y); res(true, 'AT THE NEAREST GLITCHED WALL'); } }
      break;
    case 'item':
      log(`item ${m.mode}`);
      if (m.mode === 'new') { A.newItem(); res(true, 'CARTOGRAPH MOVED'); }
      else { const g = A.nearestItem(me.player.x, me.player.y); if (g) { const x = g.x + 70, y = g.y; moveTo(room, me, x, y); res(true, 'AT THE CARTOGRAPH'); } else res(false, 'THE CARTOGRAPH HAS BEEN TAKEN'); }
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
    case 'entgoto': { const e = A.entityAt(m.eid), s = e && A.spotNear(e.x, e.y); if (s) { moveTo(room, me, s.x, s.y); log(`goto entity ${m.eid}`); res(true, 'WENT TO ENTITY #' + (m.eid | 0)); } else res(false, 'NO SUCH ENTITY'); break; }
    case 'nav': { const r = room.sim.navCmd(m.eid | 0, String(m.cmd || ''), me.player); log(`nav ${m.cmd} #${m.eid}`); res(!!r, r ? 'ENTITY #' + (m.eid | 0) + ': ' + r : 'NO SUCH ENTITY'); break; }
    case 'entdel': { const ok = A.removeEntity(m.eid); log(`remove entity ${m.eid}`); res(ok, ok ? 'ENTITY #' + (m.eid | 0) + ' REMOVED' : 'NO SUCH ENTITY'); break; }
    case 'world': {                                                             // (Stage 3D HQ2: the world epoch - see worldReset)
      log('reset world'); worldReset(room); res(true, 'NEW RUN FOR EVERYONE'); break;
    }
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
      if (m.mv && room.sim.hearMove(player, m.mv)) me.mvAt = now;           // state / stamina / vault + slide noises: processed even if the position is throttled
      if (now - me.last < 30 || !isFinite(m.x) || !isFinite(m.y)) { room.sim.gaitFloor(player, now - (me.mvAt || 0) < 500); return; }
      me.last = now;
      const p = player;
      if (!p.dead) {                       // a caught player's body stays where it fell
        const x = num(m.x, 0, 96 * 96), y = num(m.y, 0, 72 * 96);
        let ok = true;
        if (me.admin) { if (!me.mv) mvReset(me, false); adminMove(room, me, x, y); me.mv.bud = MV.VMAX * MV.BURST; }     // admin debug tools move the admin from its own client (Stage 3D HQ2: never into another player)
        else if (!p.active) { p.x = x; p.y = y; }                              // in the menu: not in the world, nothing to check
        else if (me.spawnNext) {                                              // the first position after a join / respawn: where the client chose to spawn
          me.spawnNext = false;
          const f = room.sim.spawnOk(x, y) ? PEERS.freeSpot(x, y, blockers(room, me), (a, b) => room.sim.spawnOk(a, b), PD) : null;   // (Stage 3D HQ2: that spot if nobody is within D + 8 of it, else the nearest free spawn spot around it)
          if (f && !f.crowded) { p.x = f.x; p.y = f.y; mvReset(me, f.moved); if (f.moved) { me.spawnMoved = (me.spawnMoved | 0) + 1; send(me, { t: 'tp', x: f.x, y: f.y }); } }
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
    } else if (m.t === 'join') { if (room.sim.join(player)) { placeFree(room, me); mvReset(me); me.spawnNext = true; } else send(me, { t: 'tp', x: Math.round(player.x), y: Math.round(player.y) }); }
    else if (m.t === 'respawn') {                                          // only from a death (or an admin revive): see sim.respawn
      if (room.sim.respawn(player)) { placeFree(room, me); mvReset(me); me.spawnNext = true; }
      else { me.respawnRefused = (me.respawnRefused | 0) + 1; send(me, { t: 'tp', x: Math.round(player.x), y: Math.round(player.y) }); }
    }
    else if (m.t === 'leave') { if (!room.sim.leave(player)) me.leaveRefused = (me.leaveRefused | 0) + 1; }      // to the menu: only from death, never while alive or held (sim.js lifecycle)
    else if (m.t === 'nr') nrIntent(room, me, m);                            // Stage 3D HQ2: NEW RUN, the server's decision (nrIntent)
    // (Stage 3D HQ2: a client's 'fx' - the old NEW RUN vanish, or a death - is no longer read at all: every replay is the server's own)
    else if (m.t === 'pick') { if (player.active && !player.dead) { const it = room.sim.takeItem(player); if (it) send(me, { t: 'got', item: it }); } }
    else if (m.t === 'admin') {
      const now = Date.now(), f = fails.get(ip) || { n: 0, until: 0 };
      if (now < f.until) return send(me, { t: 'admin', ok: false, wait: Math.ceil((f.until - now) / 1000) });
      if (passOk(m.pass)) { me.admin = true; fails.delete(ip); console.log(`[admin] ${me.name}#${id} unlocked admin (room ${name})`); send(me, { t: 'admin', ok: true, q: m.quiet ? 1 : 0 }); }
      else { if (++f.n >= 5) { f.until = now + 60000; f.n = 0; } fails.set(ip, f); console.log(`[admin] ${me.name}#${id} wrong admin passcode (room ${name})`); send(me, { t: 'admin', ok: false, wait: f.until > now ? 60 : 0 }); }
    }
    else if (m.t === 'a') { if (me.admin) adminCommand(room, me, m); }
    else if (m.t === 'ping') { const t = Date.now(); if (t - (me.pingAt || 0) > 400) { me.pingAt = t; send(me, { t: 'pong', ts: +m.ts || 0 }); } }
    // (Stage 3D HQ2: a client's 'b' - the old NEW RUN vanish's light record - is no longer read: corpses and their lights are the server's)
  }

  sock.on('data', reader(sock, onMessage));                                // Stage 3H0: server/ws.js (frames in, pong, close; text under 1,400 bytes to onMessage)
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
    const dt = Math.min(0.25, (now - room.last) / 1000); room.last = now;
    room.acc += dt;
    let n = 0; const h0 = process.hrtime.bigint();
    while (room.acc >= 1 / 60 && n++ < 15) { room.sim.step(1 / 60); room.acc -= 1 / 60; }
    if (n) { const per = Number(process.hrtime.bigint() - h0) / 1e6 / n; room.pf.ms += (per - room.pf.ms) * .05; room.pf.max = Math.max(per, room.pf.max * .995); }      // milliseconds per 60 Hz step (average / recent worst)
    if (++room.tick % SNAP_EVERY) continue;

    for (const c of room.clients.values()) if (c.player.dead && c.player.kill && c.aftSeq !== c.player.dseq) aftStart(room, c);
    aftSend(room); aftTick(room);
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
    const bodyMsg = () => ({ t: 'bodies', v: room.sim.bodyVer, w: room.sim.worldSeq, b: [...room.sim.bodies.values()].map(r => bodyAt.has(r) ? Object.assign({}, r, { ag: Math.min(999, Math.round((now - bodyAt.get(r)) / 100) / 10) }) : r) });
    let bm = null;
    for (const c of room.clients.values()) {
      if (c.player.exitSeq > c.exitSent) { c.exitSent = c.player.exitSeq; send(c, { t: 'exit', secs: Math.round(c.player.exitT || 0) }); }
      if (c.bv !== room.sim.bodyVer) { c.bv = room.sim.bodyVer; send(c, bm || (bm = bodyMsg())); }
      const msg = { t: 's', p: peers.filter(p => p.id !== c.id), e: ent, me: c.player.dead, ms: c.player.dseq, cp: room.sim.capInfo(c.player), w: room.sim.worldSeq };   // (w: Stage 3D HQ2, the world epoch)
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
