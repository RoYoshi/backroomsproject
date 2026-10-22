/* Network + dread layer.
 * - Talks to server.js over a WebSocket. When connected, the server owns the Hounds, Smilers,
 *   blackouts, glitched walls and dead bodies; this file mirrors them into the game's own objects every frame.
 * - Falls back to the game's built-in single-player AI when there is no server.
 * - Also draws other wanderers and adds the proximity scare effects. */
(() => {
function mpCore() {
const { lookStr, partList, partObj, parseLook, toRec } = window.__mpLib.wire;   // Stage 3H0: the look / light / corpse wire codec (assets/net-wire.js, loaded before this file)
const { NET, netReset, netHist, netPose } = window.__mpLib.interp;   // Stage 3H0: the snapshot interpolation (assets/net-interp.js, loaded just before this file)
const { nrButton, runMenuWords } = window.__mpLib.newrun;   // Stage 3H2 (C-3): NEW RUN's button and run-menu words (assets/net-newrun.js, loaded before this file)
const { buildHum, humUpdate } = window.__mpLib.hum;   // Stage 3H2 (C-4): the fluorescent hum (assets/mp-hum.js, loaded before this file)
const cv = document.getElementById('mp'), cx = cv.getContext('2d'), dread = document.getElementById('dread'),
  game = document.getElementById('game'), light = document.getElementById('light');
const room = new URLSearchParams(location.search).get('room') || 'main';
/* Stage 3E-0: how the other Wanderers are shown.
 *   'bplus' (the default): B, and the server's fresher accepted poses between its full snapshots ('q', asked for with 'caps' and used
 *           only once the server answers yes: an older server sends no 'q' and we stay at 50 ms), our own pose every ~33 ms (60 Hz screen)
 *   'b'     the snapshots alone, as HQ5; the drawn pose eased toward the newest one by ELAPSED TIME (.3 / .35 of the way per 1/60 s) -
 *           HQ5's own easing never ran: each snapshot set the drawn position outright, so they moved in 20 Hz steps
 *   'a'     Stage 3D HQ5 exactly.
 * DEV comparison only: ?peers=a or ?peers=b changes this page alone, never the server or anyone else */
const PEER_MODE = (() => { const v = new URLSearchParams(location.search).get('peers'); return v === 'a' || v === 'b' ? v : 'bplus'; })();
const PEER_SNAP = 96;                             // B / B+: a jump of more than this between where one is drawn and its new pose is shown at once (a teleport, a spawn)
const EN = () => window.__ents;
if (EN()) EN().onFail = f => EN().smilerVoice(f.x, f.y, 'blackout');      // a lamp going out has a sound of its own
return { buildHum, cv, cx, dread, EN, game, humUpdate, light, lookStr, NET, netHist, netPose, netReset, nrButton, parseLook, partList, partObj, PEER_MODE, PEER_SNAP, room, runMenuWords, toRec };
}
function bppSession({ core: { lookStr, netHist, netReset, nrButton, partList, PEER_MODE, PEER_SNAP, room, runMenuWords } }) {
/* (C3c) given late: the functions this module calls of the modules made after it, each its owner's own (they change that owner's state);
 * the composition hands them over once with wire(), when every module is made and before anything runs, so none is called before */
let doExit, noGlitches, resetExit, soloOff;                                                                     // L.O.S.T.
let giveItem, noItems;                                                                                          // P.O.C.K.E.T.
let announceKill, clearKill, clearKiller, clearSlots, entitySignals, markKiller, noFails, unhold;              // N.A.N.I.
let blendTick, resolid, softCount, softTp, solidCount, solidOff, solidPeers, stopBlend;                        // S.P.A.C.E.
let dropAvatar;                                                                                                 // BR-R
let applyBodies, endAllFx, flushSt, forgetOwnDeath, fxMsg, hideCorpse, killNoted, noPeerLights, oldLights, showCorpse, startFx, takeBodies;   // G.I.B.
let adminData, adminOffline, aresAnswer, debugData, debugGone, kickedShow, loginAnswer, nrfAnswer, pong, relogin, showMsg, unlocked;       // OVERSEER
function wire({ glitch, cartograph, monsters, space, wanderers, deaths, admin }) {
  ({ doExit, noGlitches, resetExit, soloOff } = glitch);
  ({ giveItem, noItems } = cartograph);
  ({ announceKill, clearKill, clearKiller, clearSlots, entitySignals, markKiller, noFails, unhold } = monsters);
  ({ blendTick, resolid, softCount, softTp, solidCount, solidOff, solidPeers, stopBlend } = space);
  ({ dropAvatar } = wanderers);
  ({ applyBodies, endAllFx, flushSt, forgetOwnDeath, fxMsg, hideCorpse, killNoted, noPeerLights, oldLights, showCorpse, startFx, takeBodies } = deaths);
  ({ adminData, adminOffline, aresAnswer, debugData, debugGone, kickedShow, loginAnswer, nrfAnswer, pong, relogin, showMsg, unlocked } = admin);
}
const net = Object.assign(document.createElement('div'), { id: 'net', textContent: 'SOLO' });   // (C3c) the status line (core's at M8): the session writes it
document.body.appendChild(net);
let fastAck = false, lastK = -1;                   // B+: the server said yes to 'caps'; the newest server tick seen ('s' or 'q')
const PN = { s: 0, q: 0, qApplied: 0, qStale: 0, qUnknown: 0 };   // B+ DEV counters (window.__peerNet)

let ws, retry = 0, myId = null, lastSend = 0, everConnected = false;
let snap = null, me = '', mseq = 0, handled = 0, peersN = 0, kicked = false;
let cpNow = 0, killSeq = -1, graceUntil = 0;      // what the server says is holding us / which death we already announced / the spawn grace
const peers = new Map();
const N = window.__net = {
  on: false,
  tick() {                                          // called by the game's fixed-step loop while online
    const A = window.__api;
    blendTick(A);
    if (A && me && mseq > handled && !A.G.caught) {
      handled = mseq; A.G.caught = true; A.G.caughtBy = me;
      if (myId) hideCorpse(myId);                            // Stage 3D: the server's copy of our corpse is not shown while we are still dying (ours replaces it)
      markKiller(A, me);                                     // that hound's own model is replaced by the attack animation
    }
  },
  join() { nrBusy = 0; runMenuWords(false); resetExit(); graceUntil = performance.now() / 1000 + 4; clearKill(); showCorpse(myId); soloOff(); if (!N.on) { noGlitches(); noItems(); } tx({ t: 'join' }); setTimeout(applyBodies, 80); },
  respawn() { handled = Math.max(handled, mseq); graceUntil = performance.now() / 1000 + 4; clearKill(); showCorpse(myId); tx({ t: 'respawn' }); },
  leave() { tx({ t: 'leave' }); },
  testAuth(pass) { N._auth = pass; tx({ t: 'admin', pass, quiet: 1 }); },     // automated tests: admin authority (for their debug teleports) without opening the admin panel
  fx: m => startFx(m),
  deathStart() { },                                // Stage 3D: everyone else's replay of our death is sent by the server, from its own kill record
  vanish() { },                                    // Stage 3D HQ2: the offline NEW RUN fade sends nothing (online, NEW RUN is nr below)
  bodyMade() { },                                  // Stage 3D HQ2: nothing either for the offline fade's local light record: corpses and their lights are the server's
  /* Stage 3D HQ2: the NEW RUN button (the bundle's Xnr).  Online, it is only an intent: {t:'nr', q, w}; nothing changes here until the
   * server answers (nra).  Approved: ok(m) - the bundle's short beat, then its run menu.  Refused: the button says why for a moment and
   * nothing else happens.  Returns false when offline (the bundle's own local fade then, which shares nothing).  While a press waits for
   * its answer, or after an approval until the next run, further presses do nothing. */
  nr(ok) {
    if (!(N.on && ws && ws.readyState === 1)) return false;
    const t = performance.now();
    if (nrBusy === 2 || (nrBusy === 1 && t - nrBusyAt < 2500) || t - nrBusyAt < 300) return true;   // approved already / waiting / a double press (the server drops intents 250 ms apart)
    nrBusy = 1; nrBusyAt = t; const q = ++nrQ; nrSent.set(q, ok); if (nrSent.size > 8) nrSent.delete(nrSent.keys().next().value);
    nrButton('…'); tx({ t: 'nr', q, w: worldW });
    clearTimeout(nrWaitT); nrWaitT = setTimeout(() => { if (nrBusy === 1) { nrBusy = 0; nrButton(''); } }, 2500);   // no answer (a dropped connection): the button comes back
    return true;
  },
};
/* Stage 3D HQ2: NEW RUN's state on this page: the world epoch the server last named (s.w), the press numbers sent and their callbacks,
 * whether a press is waiting or approved (busy), the last answer (for tests: window.__nrDebug) */
let worldW = null, nrQ = 0, nrBusy = 0, nrBusyAt = 0, nrLast = null, nrWaitT = 0;   // nrBusy: 1 a press waits for its answer, 2 approved (until the next run)
const nrSent = new Map();
/* Stage 3H2 (C-3): nrButton (what the pause dialog's NEW RUN button says) and runMenuWords (the run menu's words after a blast) are
 * assets/net-newrun.js's, with nrButton's own timer; mp.js reads them at start-up (above). */
function nrAnswer(m) {
  const ok = nrSent.get(m.q); nrSent.delete(m.q);
  nrLast = { q: m.q, ok: m.ok ? 1 : 0, why: m.why || '', wait: m.wait, de: m.de, at: Date.now() / 1000 };
  if (m.ok) { nrBusy = 2; nrButton(''); runMenuWords(true); if (ok) ok(m); }      // the server has taken us out of the world: the bundle's beat, then its run menu
  else { nrBusy = 0; nrButton(m.why === 'cooldown' ? 'WAIT ' + Math.ceil(+m.wait || 0) + ' S' : 'NOT NOW'); }
}
window.__nrDebug = () => ({ q: nrQ, busy: nrBusy, w: worldW, last: nrLast });
/* Stage 3E-0 (B+): a 'q' - the newer accepted poses of players the last snapshot listed, between two snapshots.  Only this world's (w), only
 * newer than every snapshot and 'q' already seen (k), only players we know and who are alive: never a new or a dead one.  It moves their
 * targets (drawPeers eases toward them) and the bodies we steer round (the server's own positions, never the drawn ones) */
function peerPoses(m) {
  PN.q++;
  if (PEER_MODE !== 'bplus' || m.w == null || m.w !== worldW || !(m.k > lastK) || !Array.isArray(m.p)) { PN.qStale++; return; }
  lastK = m.k;
  for (const q of m.p) {
    const o = Array.isArray(q) ? peers.get(q[0]) : null;
    if (!o || o.d || !Number.isFinite(q[1] + q[2] + q[3])) { PN.qUnknown++; continue; }
    if (Math.hypot(q[1] - o.x, q[2] - o.y) > PEER_SNAP) { o.x = q[1]; o.y = q[2]; }
    o.tx = q[1]; o.ty = q[2]; o.a = q[3]; PN.qApplied++;
  }
  resolid();                                                                         // (C3c) S.P.A.C.E.: the bodies we steer round, from the newer poses
}
/* post-3H Trial 2: F.R.O.N.T.'s chat.js (loaded before this script) is handed the one way to speak nearby, {t:'say'} on this socket; the
 * server decides who hears it.  window.__net itself is unchanged.  Without chat.js nothing happens. */
if (window.__chat && window.__chat.link) window.__chat.link({ say: (text, c, v) => tx({ t: 'say', text: String(text), c: String(c || ''), v: v && typeof v === 'object' ? { p: String(v.p), h: +v.h, s: +v.s } : undefined }) });   // (post-Trial 4 chat polish C4: v, the speaker's voice; the server checks it)
window.__peerNet = () => ({ mode: PEER_MODE, fast: fastAck, sendMs: fastAck ? 25 : 50, lastK, counts: Object.assign({}, PN),   // DEV only (tests): what B+ did
  peers: [...peers.values()].map(o => ({ id: o.id, x: +o.x.toFixed(2), y: +o.y.toFixed(2), tx: o.tx, ty: o.ty, a: o.a, ang: o.ang === undefined ? null : +o.ang.toFixed(4), d: o.d })) });
/* the world epoch: an admin world reset ({t:'world', w, x, y}), or the first snapshot of a world a lone player's new run started.
 * Everything of the old world ends on this screen at once - every replay, our own death (the server has already brought us back, at x, y:
 * no new spawn, no respawn message), our own local corpse - and with them their wall stains and dying lights; a death, blast or corpse
 * message naming an older world is ignored from then on (oldWorld). */
let worldEnds = 0, oldDropped = 0;
function oldWorld(w) { if (w != null && worldW != null && w < worldW) { oldDropped++; return true; } return false; }
function worldNew(w, x, y) {
  if (w == null || (worldW != null && w <= worldW)) return; worldW = w; worldEnds++;
  endAllFx();
  const A = window.__api;
  if (A && A.worldEnd && A.G && A.G.caught) A.worldEnd(Number.isFinite(x) ? x : A.H.x, Number.isFinite(y) ? y : A.H.y);
  handled = mseq; forgetOwnDeath(); clearKill(); clearKiller(); if (myId) showCorpse(myId);
  unhold();
  oldLights();                                                                       // (C3c) G.I.B.: the old world's dying lights and wall stains: gone now, not at the next frame
  stopBlend(); worldAt = Date.now() / 1000;
}
let worldAt = null;
window.__epochDebug = () => ({ w: worldW, ends: worldEnds, at: worldAt, oldDropped, softTp: softCount(), peers: solidCount() });
const tx = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function connect() {
  if (location.protocol === 'file:') return;
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + encodeURIComponent(room)); } catch { return; }
  ws.onopen = () => {
    netReset();                                                                // a connection is a new server timeline
    fastAck = false; lastK = -1; if (PEER_MODE === 'bplus') tx({ t: 'caps', fp: 1 });   // Stage 3E-0 (B+): ask for the fresher player poses
    retry = 0; handled = 0; mseq = 0; me = ''; everConnected = true;
    const A = window.__api; if (A && A.started()) tx({ t: 'join' });      // re-enter the world after a reconnect
    relogin();                                                                 // (C3c) OVERSEER: stay unlocked across reconnects (the panel keeps the passcode, in memory only)
    if (N._auth) tx({ t: 'admin', pass: N._auth, quiet: 1 });
  };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'hi') { if (myId && myId !== m.id) showCorpse(myId); myId = m.id; const A = window.__api; if (A) A.H.id = myId; }   // Stage 3D: a new connection is a new owner
    else if (m.t === 'admin' && m.q) { /* a test's quiet unlock: nothing to show */ }
    else if (m.t === 'admin') loginAnswer(m);                                 // (C3c) OVERSEER's: the login's answer
    else if (m.t === 'tp') { const A = window.__api; if (A) { if (m.pc && softTp(A, m.x, m.y)) { } else { stopBlend(); A.tp(m.x, m.y); } } }   // (Stage 3D HQ2: pc - a soft peer correction, blended)
    else if (m.t === 'caps') fastAck = PEER_MODE === 'bplus' && m.fp === 1;   // Stage 3E-0 (B+): the server does it
    else if (m.t === 'q') peerPoses(m);                                        // Stage 3E-0 (B+): fresher poses of players already known
    else if (m.t === 'world') worldNew(m.w, m.x, m.y);                         // Stage 3D HQ2 (H2-4): an admin world reset - a new world epoch
    else if (m.t === 'revive') { const A = window.__api; A && A.revive(); }
    else if (m.t === 'msg') showMsg(m.text, m.from);
    else if (m.t === 'nrf') nrfAnswer(m);                                      // Stage 3D HQ3: the server's answer to UNLIMITED NEW RUN ON / OFF (OVERSEER's)
    else if (m.t === 'ares') aresAnswer(m);                                    // the server's one-line answer to an admin command (OVERSEER's)
    else if (m.t === 'pong') pong(m);
    else if (m.t === 'kick') { kicked = true; kickedShow(); }
    else if (m.t === 'bodies') { if (oldWorld(m.w)) return; takeBodies(m.b); }   // (G.I.B.'s: the corpses, and when each one's light was let go)
    else if (m.t === 'fx') { if ((m.k === 'death' || m.k === 'boom') && oldWorld(m.wn)) return; fxMsg(m); }   // (G.I.B.'s: the replay, and when the death began)
    else if (m.t === 'exit') doExit(m.secs);
    else if (m.t === 'nra') nrAnswer(m);                                       // Stage 3D HQ2: the server's NEW RUN decision
    else if (m.t === 'got') giveItem(m.item);
    else if (m.t === 'heard' || m.t === 'said' || m.t === 'eheard') { if (window.__chat) window.__chat.net(m, m.t === 'eheard' ? null : peers.get(m.id) || null); }   // (Trial 3: eheard, an entity's line - no peer record: it is nobody's)   // post-3H Trial 2: nearby speech, for F.R.O.N.T.'s chat.js (with the speaker's peer record: its name)
    else if (m.t === 's') {
      const now = performance.now(), seen = new Set(); PN.s++; if (m.k != null) lastK = m.k;
      for (const p of m.p) {
        seen.add(p.id);
        const o = peers.get(p.id) || { x: p.x, y: p.y };
        if (Math.hypot(p.x - o.x, p.y - o.y) > 400) { o.x = p.x; o.y = p.y; }      // respawned somewhere else: don't glide across the map
        if (PEER_MODE === 'a') Object.assign(o, p, { tx: p.x, ty: p.y, seen: now });   // HQ5: the drawn position is set to it outright
        else { const dx = o.x, dy = o.y; Object.assign(o, p, { tx: p.x, ty: p.y, seen: now }); o.x = dx; o.y = dy; if (Math.hypot(p.x - o.x, p.y - o.y) > PEER_SNAP) { o.x = p.x; o.y = p.y; } }   // B: only the target; drawPeers eases toward it
        peers.set(p.id, o);
      }
      for (const [id, o] of peers) if (!seen.has(id)) { dropAvatar(o); peers.delete(id); }
      peersN = m.p.length; me = m.me || ''; mseq = m.ms | 0; cpNow = m.cp || 0;
      if (m.w != null) { if (worldW == null) worldW = m.w; else if (m.w > worldW) worldNew(m.w); }   // (Stage 3D HQ2: the first snapshot of a new world also says so: a lone player's new run)
      solidPeers(m);
      if (m.mk && m.ms !== killSeq && !oldWorld(m.w)) { killSeq = m.ms; killNoted(m); announceKill(m.mk); }   // who killed us, how, and where the wall is (HQ1: and when, on the server's clock: G.I.B.'s)
      if (m.e) { snap = m.e; N.on = true; entitySignals(m.e); netHist(m.e, now); }
      if (m.e && typeof m.e.st === 'number') flushSt(m.e.st);                   // (HQ1: a replay or corpse that came just before this snapshot was sent in its pass: G.I.B.'s)
      if (m.dbg) debugData(m);                                                  // (OVERSEER's: the debug overlay's data)
      if (m.ad) adminData(m);                                                   // (OVERSEER's: the admin panel's data; nf: Stage 3D HQ3, every admin snapshot says it again)
    }
  };
  ws.onclose = () => {
    nrSent.clear(); nrBusy = 0; worldW = null; clearTimeout(nrWaitT); nrButton('');   // Stage 3D HQ2: a press without its answer is gone with the connection
    fastAck = false; lastK = -1; solidOff();                                     // Stage 3E-0: a new connection asks again (and nobody to bump into offline: S.P.A.C.E.'s)
    netReset(); if (myId) showCorpse(myId);                                      // Stage 3D: the old connection's corpse is no longer ours to hide
    endAllFx(); N.on = false; snap = null; cpNow = 0; clearKill(); soloOff(); noGlitches(); noItems(); for (const o of peers.values()) dropAvatar(o); peers.clear(); noPeerLights(); clearSlots();
    debugGone(); noFails();
    unhold();
    net.textContent = everConnected ? 'SOLO · RECONNECTING' : 'SOLO';
    adminOffline();                                                              // (Stage 3D HQ3: UNLIMITED NEW RUN is gone with the connection: a new one starts OFF on the server too)
    if (!kicked) setTimeout(connect, Math.min(8000, 1000 * ++retry));
  };
}
/* ---------- the network send (C3c: the per-frame hook's, core's mp.frame.js at M8; it hands over this frame's moment and the player) ---------- */
function sendPose(now, p, started, lightOn) {
  if (ws && ws.readyState === 1 && now - lastSend > (started ? (fastAck ? 25 : 50) : 250)) {   // (Stage 3E-0: 25 once the server takes fresher poses: every 2nd frame at 60 Hz)
    lastSend = now;
    ws.send(JSON.stringify({
      t: 'p', x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy),
      a: +p.angle.toFixed(2), r: p.sprinting ? 1 : 0, l: lightOn ? 1 : 0, ir: window.__cam ? window.__cam.irNet : 0, k: p.equipment?.kind, lp: partList(p.equipment),
      n: (document.getElementById('nameplate')?.textContent || 'WANDERER').slice(0, 20), c: p.equipment?.color,
      f: window.__api && window.__api.fall ? +window.__api.fall().toFixed(2) : -1,
      lk: window.__api ? lookStr(window.__api.look) : undefined,
      mv: started && window.__mv ? window.__mv.net() : undefined,           // how we move: state, speed, stamina, vault / slide noises - the entities hear these
    }));
    net.textContent = N.on ? 'ONLINE · ROOM ' + room.toUpperCase() + ' · ' + (peersN + 1) + ' WANDERER' + (peersN ? 'S' : '') + ' · SHARED MONSTERS' + (unlocked() ? ' · ADMIN' : '')
                           : 'CONNECTING…';
  }
}
/* (C3c) the game's player record learns its network id (the hello's answer does it too): G.I.B. asks before handing the game the bodies */
function tellId() { const A = window.__api; if (A && myId) A.H.id = myId; }
connect();
return { connected: () => ws && ws.readyState === 1, cpNow: () => cpNow, graceUntil: () => graceUntil, handled: () => handled, me: () => me, mseq: () => mseq, myId: () => myId,
  N, nrBusy: () => nrBusy, nrLast: () => nrLast, peers, sendPose, snap: () => snap, tellId, tx, wire };
}
function lostGlitch({ session: { N } }) {
/* ---------- glitched walls: touching one takes you out of Level 0 ---------- */
let exited = false;                                   // (C3c) out through a glitched wall (core's at M8; the session's join puts it back)
function doExit(secs) {
  const A = window.__api; if (!A || exited) return; exited = true;
  const box = document.getElementById('wonStats'); if (box) box.textContent = 'Time in Level 0 · ' + Math.floor((secs || 0) / 60) + ':' + String((secs || 0) % 60).padStart(2, '0');
  document.body.classList.add('gl-out');
  if (window.__glitchSound) window.__glitchSound.burst();
  setTimeout(() => { A.win(); document.body.classList.remove('gl-out'); }, 950);
}
N.exitLocal = () => doExit(Math.round(performance.now() / 1000 - (N.t0 || 0)));
/* offline fallback (no server): pick three glitched walls locally and let the player leave through them */
function soloGlitches(p) {
  const A = window.__api; if (!A || !A.zc) return;
  if (window.__glitchSolo !== true) {
    const out = [], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]; N.t0 = performance.now() / 1000;
    for (let t = 0; t < 8000 && out.length < 3; t++) {
      const tx = Math.random() * 96 | 0, ty = Math.random() * 72 | 0; if (!A.zc(tx, ty)) continue;
      const d = dirs[Math.random() * 4 | 0], nx = tx + d[0], ny = ty + d[1]; if (nx < 1 || ny < 1 || nx > 94 || ny > 70 || !A.Hc(nx, ny)) continue;
      const cx = (tx + .5) * 96, cy = (ty + .5) * 96; if (!A.sl(cx, cy)) continue;
      const x = cx + d[0] * 48, y = cy + d[1] * 48;
      if (Math.hypot(x - A.Ic.x, y - A.Ic.y) < 2600 || out.some(o => Math.hypot(o[0] - x, o[1] - y) < 2600)) continue;
      out.push([Math.round(x), Math.round(y), d[0], d[1]]);
    }
    window.__glitches = out; window.__glitchSolo = true;
  }
  for (const g of window.__glitches) if (Math.hypot(p.x - g[0], p.y - g[1]) < 54) { N.exitLocal(); break; }
}
/* (C3c) the walls' state is this module's: the others read it and ask for its changes */
const resetExit = () => { exited = false; };
const soloOff = () => { window.__glitchSolo = false; };
const noGlitches = () => { window.__glitches = []; };
const glitchesFrom = gw => { window.__glitches = gw || []; };          // the server's walls, from each snapshot (N.A.N.I.'s mirror)
return { doExit, exited: () => exited, glitches: () => window.__glitches, glitchesFrom, noGlitches, resetExit, soloGlitches, soloOff };
}
function pocketCartograph({ session: { N, tx } }) {
/* ---------- the cartograph: one rare item per world, lying on the floor until somebody walks over it ---------- */
let lastPick = 0;
function giveItem(id) { if (window.__inv) window.__inv.give(id, true); }
function itemsFrame(p) {
  const list = window.__items || [], A = window.__api;
  if (!list.length || !A) return;
  const now = performance.now();
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (Math.hypot(p.x - it[0], p.y - it[1]) > 46) continue;
    if (window.__inv && window.__inv.has(it[2])) continue;               // you already carry one
    if (N.on) { if (now - lastPick > 700) { lastPick = now; tx({ t: 'pick' }); } }
    else { list.splice(i, 1); giveItem(it[2]); }
    return;
  }
}
function soloItem() {                                                    // offline: drop one somewhere far from the start
  const A = window.__api; if (!A || !A.zc || window.__itemSolo === true) return; window.__itemSolo = true;
  for (let t = 0; t < 8000; t++) {
    const tx0 = Math.random() * 96 | 0, ty0 = Math.random() * 72 | 0; if (!A.zc(tx0, ty0)) continue;
    const x = (tx0 + .5) * 96, y = (ty0 + .5) * 96; if (!A.sl(x, y) || Math.hypot(x - A.Ic.x, y - A.Ic.y) < 1800) continue;
    window.__items = [[Math.round(x), Math.round(y), 'cartograph']]; return;
  }
}
/* (C3c) the items' state is this module's: the others ask for its changes */
function soloItems() { if (!(window.__items && window.__items.length) && window.__itemSolo !== true) soloItem(); }   // offline, when there is none (the per-frame hook's test at M8)
const noItems = () => { window.__items = []; };
const itemsFrom = it => { window.__items = it || []; };              // the server's items, from each snapshot (N.A.N.I.'s mirror)
return { giveItem, itemsFrame, itemsFrom, noItems, soloItems };
}
function naniMonsters({ core: { EN, NET, netPose }, session: { cpNow, graceUntil, N, snap }, glitch: { glitchesFrom }, cartograph: { itemsFrom } }) {
/* ---------- mirror the server's monsters into the game ---------- */
const CLIENT_ENTITY_SLOTS = 64;                 // stress/admin ceiling; ordinary director population is still 3 Hounds / <=5 Smilers
const hMap = new Map(), hSlots = Array(CLIENT_ENTITY_SLOTS).fill(null);
const sSlot = Array(CLIENT_ENTITY_SLOTS).fill(null); // entity id living in each preallocated Smiler render object
window.__hounds = hSlots;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
/* the kill the server just made: which entity, which variant (A-D), where the wall is.  The death sequence in the bundle reads this. */
function announceKill(k) {
  const K = window.__kill = Object.assign({}, k, { at: performance.now(), slot: -1 });
  if (K.k === 'Hound') { const o = hMap.get(K.e); K.slot = o ? o.slot : -1; } else K.slot = sSlot.indexOf(K.e);
}
/* sounds the entities make (positional, voiced by ents.js) and lamps the smilers are killing */
function entitySignals(e) {
  const E = EN(); if (!E) return;
  for (const q of e.sn || []) if (Array.isArray(q) && ['growl', 'snarl', 'lungecue', 'guard', 'kill'].includes(q[0])) E.houndVoice(q[1], q[2], q[0], q[3]);
  E.setFails(e.lf || []);
}
window.__netPose = netPose; window.__NET = NET;
NET.onEpoch = () => { hMap.clear(); hSlots.fill(null); sSlot.fill(null); if (window.__skin) window.__skin.clear(); };   // entity slots belong to the old world too (Trial 3: the Skin-Stealers' too)
function applyServerState(dt) {
  const A = window.__api, s = snap(), E = EN();
  if (!A || !s || !E) return;
  /* hounds: every hound has its own client-side copy in a fixed slot; the game's own hound object (G) mirrors the nearest one */
  const ids = new Set();
  for (const t of s.h) {
    ids.add(t.i);
    let o = hMap.get(t.i);
    if (!o) { const sl = hSlots.indexOf(null); if (sl < 0) continue; o = { x: t.x, y: t.y, angle: t.a, state: 'ROAMING', ls: 'patrol', act: '', distance: 0, slot: sl, id: t.i }; hMap.set(t.i, o); hSlots[sl] = o; }
    E.slotH(o, t, dt, netPose('h' + t.i));
  }
  for (const [id, o] of hMap) if (!ids.has(id)) { hSlots[o.slot] = null; hMap.delete(id); }
  let best = null, bd = 1e18;
  for (const o of hMap.values()) { const d = Math.hypot(o.x - A.H.x, o.y - A.H.y); if (d < bd) { bd = d; best = o; } }
  const G = A.G, grace = Math.max(0, graceUntil() - performance.now() / 1000);
  if (best) { G.x = best.x; G.y = best.y; G.angle = best.angle; G.state = best.ls; G.distance = best.distance; }
  else { G.x = G.y = -9e4; G.state = 'patrol'; }
  G.grace = grace; G.pressure = s.p || 0;
  /* smilers: one fixed render slot per server entity (stress ceiling 64); unused slots are parked far away and hidden */
  const sid = new Set();
  for (const t of s.m) {
    sid.add(t.i);
    let i = sSlot.indexOf(t.i);
    if (i < 0) { i = sSlot.indexOf(null); if (i < 0) continue; sSlot[i] = t.i; const o = A.q[i]; o.x = t.x; o.y = t.y; o.angle = t.a; o.distance = 0; }
    A.q[i].off = false; E.slotS(A.q[i], t, dt, netPose('m' + t.i));
  }
  A.q.forEach((sm, i) => {
    if (sSlot[i] !== null && !sid.has(sSlot[i])) sSlot[i] = null;
    if (sSlot[i] === null) { sm.off = true; sm.x = sm.y = -9e4; sm.state = 'lurk'; sm.ls = 'lurk'; sm.face = 0; }
  });
  /* Trial 3: the Skin-Stealers (s.ss, sent only while there is one) are mirrored and drawn by their own script, skinstealer.js */
  if (window.__skin) { window.__skin.mirror(s.ss, dt); window.__skin.draw(dt); }
  A.V.blackout = !!s.b;
  glitchesFrom(s.gw); itemsFrom(s.it);                                                 // (C3c) the walls are L.O.S.T.'s, the items P.O.C.K.E.T.'s
}
/* held by something: the server says down / crawl / (dragged toward a point).  move.js does the rest, this adds the sounds and the flash */
let cpPrev = '', hitFlash = 0;
function applyCaught() {
  const A = window.__api, mv = window.__mv, E = EN(); if (!A || !mv) return;
  const cp = N.on && !A.G.caught ? cpNow() : 0, ph = cp ? cp.ph : '';
  mv.down = cp && ph !== 'release' ? (ph === 'crawl' ? 'crawl' : 'down') : 0;
  mv.dragTo = mv.down && cp.d ? cp.d : null;
  if (ph !== cpPrev) {
    if (E && ph === 'down' && !cpPrev) { E.sfxKnock(); hitFlash = 1; }
    else if (E && ph === 'crawl') E.sfxGasp();
    else if (E && !ph && cpPrev) E.sfxRelease();
    cpPrev = ph;
  }
}
/* (C3c) the monsters' state is this module's: the session, the world epoch and the per-frame hook ask for its changes */
function markKiller(A, by) {                          // our death has begun (the session's tick): which hound slot made the kill
  const K = window.__kill; let b = -1;
  if (K && K.slot >= 0) b = K.slot; else { let bd = 1e18; for (const o of hMap.values()) { const d = Math.hypot(o.x - A.H.x, o.y - A.H.y); if (d < bd) { bd = d; b = o.slot; } } }
  window.__killer = by === 'Hound' ? b : -1;             // that hound's own model is replaced by the attack animation
}
const clearKill = () => { window.__kill = null; };
const clearKiller = () => { window.__killer = -1; };
const clearSlots = () => { hMap.clear(); hSlots.fill(null); sSlot.fill(null); if (window.__skin) window.__skin.clear(); };
function unhold() { if (window.__mv) { window.__mv.down = 0; window.__mv.dragTo = null; } }
const noFails = () => { if (EN()) EN().setFails([]); };
const fadeHit = t => { hitFlash = Math.max(0, hitFlash - t * 1.6); };
return { angDiff, announceKill, applyCaught, applyServerState, clearKill, clearKiller, clearSlots, entitySignals, fadeHit, hitFlash: () => hitFlash, hMap, hSlots, markKiller, noFails, unhold };
}
function spacePeers({ session: { cpNow, me, nrBusy, peers }, glitch: { exited } }) {
/* Stage 3D HQ2 (H2-4): the other living Wanderers are solid.  window.__peerBodies is what move.js steers round: the latest server
 * positions (the snapshot's own, not the smoothed drawing) of every other player in the world who is alive and not held in a capture
 * (an entity's cp names its victim).  Empty offline, and while we are not solid ourselves: not in a run, dead, held, out through a glitch,
 * or out of the world after an approved NEW RUN. */
window.__peerBodies = [];
let solidHeld = null;                                // (Stage 3E-0: the last snapshot's held players, for the fresher poses)
const solidNow = A => !(!A || !A.started || !A.started() || me() || cpNow() || nrBusy() === 2 || exited() || (A.G && A.G.caught));
function solidPeers(m) {
  const pb = window.__peerBodies, A = window.__api; pb.length = 0; solidHeld = null;
  if (!solidNow(A)) return;
  const held = new Set(); if (m.e) for (const k of ['h', 'm']) for (const e of m.e[k] || []) if (e && e.cp) held.add(e.cp);
  for (const p of m.p) if (!p.d && !held.has(p.id)) pb.push([p.x, p.y]);
  solidHeld = held;
}
/* (C3c) after B+'s fresher poses (the session's peerPoses) moved the players' targets: the bodies we steer round, from them */
function resolid() {
  const pb = window.__peerBodies, A = window.__api;
  if (solidHeld && solidNow(A)) { pb.length = 0; for (const [id, o] of peers) if (!o.d && !solidHeld.has(id)) pb.push([o.tx, o.ty]); }   // (as solidPeers, from the newer poses)
}
/* the soft correction ({t:'tp', x, y, pc:1}: the server stopped us short of another player): blended in over 120 ms instead of a jump -
 * the offset is added a little each fixed step, and the part of our velocity that runs back against it (into the body the server would
 * not let us into) is dropped, the sideways part kept.  Further than 96 px is no longer a nudge: a jump, as an ordinary tp */
let blend = null;
let softN = 0;                                       // (C3c) how many soft corrections (window.__epochDebug's softTp, the session's)
function softTp(A, x, y) {
  const dx = x - A.H.x, dy = y - A.H.y, d = Math.hypot(dx, dy); if (!(d <= 600)) return false;   // (H2-5: every correction the server can send - one packet's budget is 568 px - is blended, as D3 says; H2-4 jumped above 96 px, which a 200-300 ms link reaches)
  blend = { dx, dy, t0: performance.now(), done: 0 }; softN++; return true;
}
function blendStep(A) {
  const b = blend, k = Math.min(1, (performance.now() - b.t0) / 120), s = k - b.done; b.done = k;
  A.H.x += b.dx * s; A.H.y += b.dy * s;
  const L = Math.hypot(b.dx, b.dy); if (L > 0) { const ux = b.dx / L, uy = b.dy / L, vn = A.H.vx * ux + A.H.vy * uy; if (vn < 0) { A.H.vx -= vn * ux; A.H.vy -= vn * uy; } }
  if (k >= 1) blend = null;
}
/* (C3c) what the session asks of this module's state: the fixed-step blend, its end (a plain tp, a new world), nothing solid offline */
const blendTick = A => { if (blend && A) blendStep(A); };
const stopBlend = () => { blend = null; };
function solidOff() { solidHeld = null; window.__peerBodies.length = 0; blend = null; }
return { blendTick, resolid, softCount: () => softN, softTp, solidCount: () => window.__peerBodies.length, solidOff, solidPeers, stopBlend };
}
function audioDread() {
/* ---------- audio ---------- */
let ac, drone, dg;
const soundOn = () => /ON/.test(document.getElementById('sound')?.textContent || 'ON');
function initAudio() {
  if (ac) return;
  try {
    ac = new AudioContext();
    drone = ac.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 43;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
    dg = ac.createGain(); dg.gain.value = 0;
    drone.connect(f).connect(dg).connect(ac.destination); drone.start();
  } catch {}
}
addEventListener('pointerdown', initAudio); addEventListener('keydown', initAudio);
function thump(v, f) {
  if (!ac || !soundOn()) return;
  const o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime;
  o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(38, n + .16);
  g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + .2);
  o.connect(g).connect(ac.destination); o.start(n); o.stop(n + .22);
}
function burst(len, v) {
  if (!ac || !soundOn()) return;
  const b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 1.5;
  const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = v; s.buffer = b; s.connect(g).connect(ac.destination); s.start();
}
let capturedWas = false;                                      // (pre-Trial 3 polish P1: the burst once per capture, when `captured` arrives -
new MutationObserver(() => {                                  // not again on every later change of the body's classes while caught)
  const c = document.body.classList.contains('captured');
  if (c && !capturedWas) burst(1.1, .9);
  capturedWas = c;
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

/* online note on the pause screen */
const pauseNote = document.querySelector('#dialog .lore-credit');
if (pauseNote) {
  const n = document.createElement('p'); n.className = 'lore-credit'; n.id = 'onlineNote'; n.hidden = true;
  n.textContent = 'Online: pausing does not stop the halls. The monsters keep moving.';
  pauseNote.before(n);
}
/* (C3c) the drone's level from the dread (k, 0..1: the per-frame hook's), and the online note, shown while online */
function setDrone(k) { if (dg && ac) dg.gain.value = soundOn() ? k * k * .16 : 0; }
const onlineNote = on => { const note = document.getElementById('onlineNote'); if (note) note.hidden = !on; };
return { burst, onlineNote, setDrone, thump };
}
function brrWanderers({ session: { peers } }) {
/* ---------- other wanderers ---------- */
const tip = Object.assign(document.createElement('div'), { id: 'peerTip' });
document.body.appendChild(tip);
let mx = -1e3, my = -1e3;
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; } });
function dropAvatar(o) { if (o.av) { o.av.parent && o.av.parent.removeChild(o.av); o.av.destroy({ children: true }); o.av = null; } }
setInterval(() => { for (const [id, o] of [...peers]) if (!peers.has(id)) dropAvatar(o); }, 2000);
/* (C3c) the hover name: the wanderer the drawing found under the mouse (in line of sight), or none */
function hoverTip(hover, sc) {
  if (hover) {
    tip.textContent = (hover.o.n || 'WANDERER') + (hover.o.d ? ' · DEAD' : '');
    tip.style.left = hover.sx + 'px'; tip.style.top = (hover.sy - 26 * sc) + 'px'; tip.style.display = 'block';
  } else tip.style.display = 'none';
}
return { dropAvatar, hoverTip, mx: () => mx, my: () => my };
}
function gibDeaths({ core: { cx, EN, NET, parseLook, partObj, PEER_MODE, toRec }, session: { myId, N, peers, tellId }, monsters: { angDiff, hMap }, wanderers: { hoverTip, mx, my } }) {
/* where the kill animation left the attacker (its world position and heading), so the server's hound carries on from there instead of popping back */
/* Stage 3D: our own death starts from the server's kill record (the bundle's death class asks for it): the position, facing, speed and
 * exhaustion the server decided the death with, as it sent them - so our death, every spectator's replay and the server's corpse are one
 * physical run.  Only a record that came with a death id; anything else (offline play) uses the player as before. */
let ownDeath = null, mkAt = null;                    // Stage 3D HQ1: our own latest death (its id, when it began here - when its kill record arrived; offline: a local key; the light's profile) - wall stains, its light
window.__dvic = K => { const A = window.__api; ownDeath = { de: K && K.de != null ? K.de : 'L' + Math.round(performance.now()), t0: K && K.de != null && mkAt && mkAt.de === K.de ? mkAt.t : performance.now() / 1000, lf: K && Array.isArray(K.lf) ? K.lf : null, srv: !!(K && K.de != null), rel: null };
  if (!K || K.de == null || !A || !Number.isFinite(K.x) || !Number.isFinite(K.y)) return null;
  return { x: K.x, y: K.y, angle: +K.a || 0, vx: K.vx || 0, vy: K.vy || 0, exhausted: !!K.ex, stamina: undefined, equipment: A.H.equipment }; };
/* ---------- everyone's bodies (one per player) ---------- */
let bodiesList = [];                              // corpses from the server (everyone's, one per player)
const hasBody = id => bodiesList.some(b => b.k === id);
function applyBodies() { tellId(); const A = window.__api; if (A && A.bodies) A.bodies(bodiesList.map(toRec)); }   // (C3c: the session tells the game our network id first, as this line did)

/* ---------- other players' deaths and vanishings, replayed for everybody in line of sight ---------- */
const fxs = window.__fxs = [];
const fxActive = id => fxs.some(f => f.id === id && !f.gone);
window.__hideBodies = new Set(); window.__fxKill = new Set(); window.__fxKillS = new Set();
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function killFx(f) {
  f.gone = true;
  for (const x of [f.av, f.jl && f.jl.blood, f.jl && f.jl.foreground, f.jl && f.jl.debris, f.att, f.gib]) { if (!x) continue; try { x.parent && x.parent.removeChild(x); x.destroy({ children: true }); } catch { } }
  window.__hideBodies.delete('r' + f.id);
}
function startFx(m) {
  const A = window.__api, layer = A && A.layer && A.layer(); if (!A || !layer || !A.mkAvatar || !A.Jl || (m.id === myId() && m.k !== 'boom')) return;   // (Stage 3D HQ2: our own NEW RUN blast plays here too: our short beat shows it)
  if (m.k === 'end') { for (const f of fxs) if (f.id === m.id && (m.de == null || f.de === m.de)) f.end = true; return; }   // Stage 3D: an admin revive undid it
  if (m.de != null && fxs.some(f => f.de === m.de && !f.gone)) return;           // Stage 3D: one death plays once
  for (const f of fxs) if (f.id === m.id) f.end = true;                          // a newer event for the same player replaces the older one
  const look = parseLook(m.lk), gear = { kind: m.ek || 'flashlight', color: m.ec || '#ffe7b2', parts: {} }; gear.parts[gear.kind] = partObj(gear.kind, m.ep);
  const now = performance.now() / 1000 - Math.max(0, Math.min(10, +m.el || 0)), av = A.mkAvatar(look, gear); av.__key = m.id; av.__cause = m.c; layer.addChild(av);   // el: a late joiner sees it from where it is
  const pe = peers.get(m.id), f = { id: m.id, de: m.de, k: m.k, t0: now, av, look, gear, src: { x: m.x, y: m.y, angle: m.a, vx: 0, vy: 0, distance: 0 }, old: bodiesList.find(b => b.k === m.id), lf: Array.isArray(m.lf) ? m.lf : null,
    lo: m.lo != null ? !!m.lo : !!(pe && pe.l) };                              // was their light on when they died (the server says so since 3D; else their last snapshot)
  if (m.k === 'death') {
    const jl = new A.Jl(); jl.start(m.c === 'Smiler' || m.c === 'SkinStealer' ? m.c : 'Hound', now, { x: m.sx, y: m.sy }, -1, { x: m.x, y: m.y, angle: m.a, equipment: gear, hat: look.hat, vx: m.vx || 0, vy: m.vy || 0, ex: m.ex ? 1 : 0 }, { v: m.v, w: m.w });
    f.jl = jl; A.floor().addChild(jl.blood); layer.addChild(jl.foreground, jl.debris);
    if (!(+m.el > .3) && EN() && EN().deathVoice) EN().deathVoice(m.c, m.x, m.y, jl.ph && jl.ph.ctx ? jl.ph.ctx.hits.slice() : null);   // Stage 3D: heard where it happens
    f.att = m.c === 'Smiler' ? new A.Gl({ x: m.sx, y: m.sy, angle: 0, state: 'ATTACKING', off: false, side: 0 }) : m.c === 'SkinStealer' && window.__skin ? window.__skin.attacker() : new A.Wl(); layer.addChild(f.att);   // (Trial 3: the Skin-Stealer's own attacker, which poses itself in attackPose)
    f.cause = m.c; f.kill = { h: -1, s: -1 };                                    // hide the real monster that made the kill while its attack replays
    let bd = 240; for (const o of hMap.values()) { const d = Math.hypot(o.x - m.sx, o.y - m.sy); if (d < bd) { bd = d; f.kill.h = o.slot; } }
    bd = 240; (A.q || []).forEach((s, i) => { const d = Math.hypot(s.x - m.sx, s.y - m.sy); if (!s.off && d < bd) { bd = d; f.kill.s = i; } });
    if (m.c !== 'Hound') f.kill.h = -1; if (m.c !== 'Smiler') f.kill.s = -1;          // (Trial 3: a Skin-Stealer's kill hides neither; skinstealer.js hides its own killer)
    window.__hideBodies.add('r' + m.id);
  } else if (m.k === 'boom') {                                                     // Stage 3D HQ2: a NEW RUN blast - the server's event, its seed and direction; no attacker
    const d = +m.d || 0, jl = new A.Jl(); jl.start('Boom', now, { x: m.x - Math.cos(d), y: m.y - Math.sin(d) }, -1, { x: m.x, y: m.y, angle: m.a, equipment: gear, hat: look.hat, vx: m.vx || 0, vy: m.vy || 0, ex: 0 }, { v: 'A', s: m.s, d });
    if (!jl.ph) { killFx(f); return; }                                             // (the blast is physics only: never the scripted fallback)
    f.gib = jl.ph.gib && window.__gore && window.__gore.gibs ? new (jl.foreground.constructor)() : null;   // Stage 3D HQ3: the pieces and the hands, drawn from the physics every frame (the whole avatar is never shown)
    f.jl = jl; A.floor().addChild(jl.blood); layer.addChild(jl.foreground); if (f.gib) { layer.addChild(f.gib); av.visible = false; } layer.addChild(jl.debris);
    if (!(+m.el > .3) && EN() && EN().boomVoice) EN().boomVoice(m.x, m.y);        // heard once, where it happens (a late joiner does not hear it)
    f.cause = 'Boom'; f.att = null; f.kill = { h: -1, s: -1 };
    window.__hideBodies.add('r' + m.id);
  }
  fxs.push(f);
}
/* Stage 3D HQ3: a NEW RUN's gibs on this screen - the replay's own physics (the server's seed: the same pieces everywhere), drawn by
 * gore.js; redrawn only while something moves (once all is at rest the picture is left as it is), darkened toward a corpse's colour
 * over the blast so the corpse that takes over looks the same */
function gibFrame(f, jl) {
  const S = jl.ph, G = window.__gore; if (!S || !S.gib || !G) return;
  const shapes = f.gibShapes || (f.gibShapes = S.rendShapes || window.__dphys.gibShapes(S.ctx.seed)), dead = sm(.5, 2.6, jl.elapsed);   // (R15: a rend's own two halves)
  const key = (S.state === 'SLEEPING' ? 'rest' : S.stepN) + ':' + Math.round(dead * 20); if (f.gibKey === key) return; f.gibKey = key;
  f.gib.clear();
  G.gibs(f.gib, S.gib.map((g, i) => ({ x: g.x, y: g.y, rot: g.rot, z: g.z, poly: shapes[i].poly, core: shapes[i].core })), S.h.map(h => ({ x: h.x, y: h.y, rot: h.rot, z: h.z })), f.look, { dead, eqKind: f.gear && f.gear.kind });
}
function updateFx(now) {
  const A = window.__api; window.__fxKill.clear(); window.__fxKillS.clear();
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i], t = now - f.t0;
    if (f.end || !A) { killFx(f); fxs.splice(i, 1); continue; }
    if (f.k === 'vanish') {
      f.av.update(now, false, false, f.src); f.av.gear.visible = false;
      const v = Math.min(1, t / 2.7), s = sm(.22, .95, v), fl = Math.sin(now * 47) > .55 && v > .35 && v < .9 ? .35 : 0;
      f.av.alpha = Math.max(0, 1 - s - fl * (1 - s)); f.av.scale.set(1 - .06 * s); f.av.x += Math.sin(now * 61) * (1 - s) * s * 4;
      if (t > 2.8) { killFx(f); fxs.splice(i, 1); }
      continue;
    }
    const jl = f.jl, done = jl.frame(now), b = jl.body;
    if (!f.gib && jl.ph && jl.ph.rent && window.__gore && window.__gore.gibs && f.av && f.av.parent) { f.gib = new (jl.foreground.constructor)(); f.av.parent.addChildAt(f.gib, f.av.parent.getChildIndex(f.av)); }   // R15: the Rend - from its moment, two halves where the body was
    if (f.gib) { f.av.visible = false; gibFrame(f, jl); }                          // Stage 3D HQ3: a gibbed NEW RUN: no whole body from the first frame on
    else {
    f.av.update(now, false, false, f.src);
    f.av.position.set(b.x, b.y); f.av.rotation = b.angle; f.av.scale.set(b.scaleX, b.scaleY); f.av.alpha = b.alpha; f.av.deathPose(jl.injury, jl.impact, jl.elapsed > .24, jl);
    }
    if (f.att) {                                                                   // (a NEW RUN blast has no attacker)
      f.att.visible = !done; f.att.position.set(jl.attacker.x, jl.attacker.y); f.att.rotation = jl.attacker.angle + Math.PI / 2; f.att.alpha = 1;
      if (f.cause === 'Smiler') { f.att.scale.set(1 + sm(.3, 1.7, jl.elapsed) * .9); if (EN()) EN().attackSmiler(f.att, now, 1 / 60); } else f.att.attackPose(jl.grip, jl.impact, jl.variant, jl);
    }
    if (!done) { if (f.kill.h >= 0) window.__fxKill.add(f.kill.h); if (f.kill.s >= 0) window.__fxKillS.add(f.kill.s); }
    else { f.doneAt = f.doneAt || now; const nb = bodiesList.find(x => x.k === f.id); if ((nb && (f.de != null && nb.de != null ? nb.de === f.de : (!f.old || nb.x !== f.old.x || nb.y !== f.old.y || nb.a !== f.old.a))) || now - f.doneAt > 8) { killFx(f); fxs.splice(i, 1); } }   // Stage 3D: the corpse of this very death takes over
  }
}

/* how another wanderer moves, from what the server relays: [state, speed, stamina, exhausted] -> the pose data the avatar code reads */
const SNAMES = (window.WORLD && window.WORLD.SN) || ['stand', 'walk', 'run', 'crouch', 'crawl', 'slide', 'vault', 'down'];
function peerMv(o, now) {
  const a = o.mv; if (!Array.isArray(a)) return undefined;
  const s = SNAMES[a[0]] || 'stand';
  if (o.mvS !== s) { o.mvS = s; o.mvT0 = now; }
  const t = now - (o.mvT0 || now);
  return { s, t, sp: a[1] || 0, st: a[2] === undefined ? 100 : a[2], ex: a[3] ? 1 : 0, vp: s === 'vault' ? Math.min(1, t / .55) : 0, lean: o.mvLean || 1, tw: s === 'down' && (a[1] || 0) > 4 ? 1 : 0 };
}
/* what a fallen wanderer left behind can still shine: a flashlight lying on its side keeps its beam, a lantern keeps lighting the floor.
 * Stage 3D: a physical corpse's light shines from the lens of the dropped light (as it did for the victim while the death played), not
 * from the middle of the object */
function bodyLights(p, out) {
  const A = window.__api; if (!A || !A.bodyList) return;
  const LEN = (window.__dphys && window.__dphys.LEN) || {}, d = A.death && A.death(), hide = window.__hideBodies;
  for (const b of A.bodyList()) {
    if (!b.lo || b.cause === 'Vanish' || !b.equipment || b.equipment.kind === 'camcorder' || !b.dropped) continue;
    if (hide && hide.has(b.ownerId)) continue;                                  // Stage 3D HQ1: its death is still playing here (a replay, or ours): that light is this light
    if (d && d.active && b.id === d.corpseId) continue;                         // Stage 3D HQ1: our own corpse while our death is still on screen - the death's own light is it
    if (Math.hypot(b.dropped.x - p.x, b.dropped.y - p.y) > 950) continue;
    const pw = corpsePower(b); if (!(pw > 0)) continue;                         // Stage 3D HQ1: failed for good: no light at all
    const a = b.hands ? b.dropped.angle - Math.PI / 2 : b.dropped.angle, L = b.hands ? LEN[b.equipment.kind] || 0 : 0;
    out.push({ x: b.dropped.x + Math.cos(a) * L, y: b.dropped.y + Math.sin(a) * L, angle: a, kind: b.equipment.kind, color: b.equipment.color, on: true, dead: false, pw });
  }
}
/* Stage 3D HQ1: a dead wanderer's light holds for its death's chosen 3-7 s after it was let go, flickers and dims for 1-2 s, then is off
 * for good (dphys.lightPower; the profile is the server's, sent with the death).  One timeline per death id: the moment its light was
 * let go, on this page's clock, from every piece of the server's timing this page gets - our own kill record's arrival + the physics'
 * release, a replay's arrival (late joiners' el included) + the replay physics' release, each corpse record's arrival - its age ag +
 * the release relative to its making - and the EARLIEST of them is kept: a message can arrive late (a busy page handles it a frame or
 * more after it came), never early, so the earliest is the nearest to the server's own moment.  The same moments are also read on the
 * server's own clock: the snapshot that carries the kill record, or the first snapshot after a replay or corpse message (the server
 * sends them in one pass), gives its clock 'st'; with the snapshot clock offset the page already keeps from its fastest packets
 * (net-interp.js NET.off) that is this page's time without the page's own delay in handling messages.  It can only move earlier, never
 * later: a replay, a corpse, a reconnect or a reload never starts the light again.  The Death Lab slows what one screen shows, not this
 * clock. */
const lnow = () => window.__deathLightNow ? window.__deathLightNow() : performance.now() / 1000;   // (__deathLightNow: a test's frozen clock, development only)
const relAt = new Map(), DLOG = [], srvSt = new Map(), eqOf = new Map(), pendSt = [];   // srvSt: death id -> { k: when it began, r: when its light was let go } on the server's clock; eqOf: its physics' release
function relOf(de, cand) { if (de == null || cand == null) return cand; let v = relAt.get(de); if (v === undefined || cand < v) { if (v === undefined && relAt.size >= 64) relAt.delete(relAt.keys().next().value); relAt.set(de, v = cand); } return v; }
const capMap = M => { if (M.size > 64) M.delete(M.keys().next().value); };
function stNote(de, k, v) { if (de == null || !Number.isFinite(v)) return; let o = srvSt.get(de); if (!o || o.ep !== NET.epoch) { srvSt.set(de, o = { ep: NET.epoch }); capMap(srvSt); } if (o[k] === undefined || v < o[k]) o[k] = v; }
function eqKnown(de, r) { if (de == null || r == null || eqOf.has(de)) return; eqOf.set(de, r); capMap(eqOf); }
function srvAnchors() { if (NET.off == null) return; for (const [de, o] of srvSt) { if (o.ep !== NET.epoch) continue; if (o.r !== undefined) relOf(de, o.r - NET.off); const r = eqOf.get(de); if (o.k !== undefined && r !== undefined) relOf(de, o.k + r - NET.off); } }
const relRun = S => !S ? null : window.__dphys && window.__dphys.releaseOf ? window.__dphys.releaseOf(S) : S.ctx && S.ctx.eqKind === 'headlamp' ? 0 : (S.eqAt >= 0 ? S.eqAt : null);   // seconds into the death when the light is let go (dphys.releaseOf: known from the death's first frame, whatever the screen shows); a headlamp: its start
function powerAt(src, de, lf, rel, kind) {
  const D = window.__dphys, now = lnow(), pw = rel == null ? 1 : D && D.lightPower ? D.lightPower(lf, now - rel) : 1;
  if (DLOG.length < 32) DLOG.push({ src, de, kind, lf: lf || null, rel: rel == null ? null : +rel.toFixed(4), now: +now.toFixed(4), pw: +pw.toFixed(4) });
  return pw;
}
function corpsePower(b) {
  if (b.remote) { const lf = b.lf || null, rr = lf ? lf[3] : 0, key = b.de != null ? b.de : 'b:' + b.id; return powerAt('corpse', b.de, lf, relOf(key, (b.born != null ? b.born : performance.now() / 1000) + rr), b.equipment.kind); }
  if (!localDe.has(b.id) && ownDeath) localDe.set(b.id, ownDeath.de);
  const de = localDe.get(b.id), mineNow = ownDeath && ownDeath.de === de;
  if (mineNow && ownDeath.srv && !ownDeath.lf) return 0;                       // the server's record says this light was not a lit emitter when we died
  const cand = mineNow && ownDeath.rel != null ? ownDeath.t0 + ownDeath.rel : (b.createdAt != null ? b.createdAt : performance.now() / 1000);
  return powerAt('own corpse', de, mineNow ? ownDeath.lf : null, relOf(de != null ? de : 'l:' + b.id, cand), b.equipment.kind);
}
function ownPower() {
  const A = window.__api, d = A && A.death && A.death(); if (!d || !d.active || !ownDeath) return 1;
  if (ownDeath.srv && !ownDeath.lf) return 0;                                  // the server's record says our light was not a lit emitter (off, or a camcorder)
  const r = relRun(d.ph); if (r == null) return 1;
  ownDeath.rel = r; eqKnown(ownDeath.de, r); return powerAt('own death', ownDeath.de, ownDeath.lf, relOf(ownDeath.de, ownDeath.t0 + r), A.H && A.H.equipment && A.H.equipment.kind);
}
window.__deathLight = { own: ownPower,
  debug: () => ({ epoch: Date.now() / 1000 - performance.now() / 1000, frame: DLOG.slice(), anchors: [...relAt].map(([k, v]) => [k, +v.toFixed(4)]), off: NET.off, srv: [...srvSt].map(([k, o]) => [k, o.k ?? null, o.r ?? null]), own: ownDeath ? { de: ownDeath.de, t0: +ownDeath.t0.toFixed(4), lf: ownDeath.lf, rel: ownDeath.rel } : null }) };
/* Stage 3D HQ1: the wall contacts this screen shows now - our own death while it plays, every replay, every corpse (ours by our own death
 * id) - handed to gore.js, which keeps one wallpaper stain per impact (a few times a second; the physics' own dphys.marks, the corpse
 * record's wall marks) */
let stainAt = 0; const localDe = new Map();             // our own local corpse record -> the death it came from (the latest when it first appears)
function wallStains(now) {
  const G = window.__gore, D = window.__dphys, A = window.__api; if (!G || !G.wallStains || !D || !D.marks || !A || !A.bodyList) return;
  if (now - stainAt < .12 && now >= stainAt) return; stainAt = now;
  const want = [], add = (de, x, y, nx, ny) => want.push({ de, x, y, nx, ny });
  const d = A.death && A.death();
  if (d && d.active && d.ph && ownDeath) for (const m of D.marks(d.ph)) add(ownDeath.de, m.x, m.y, m.nx, m.ny);
  for (const f of fxs) if ((f.k === 'death' || f.k === 'boom') && f.jl && f.jl.ph && !f.gone && f.de != null) for (const m of D.marks(f.jl.ph)) add(f.de, m.x, m.y, m.nx, m.ny);
  for (const b of A.bodyList()) {
    if (b.cause === 'Vanish' || !b.blood) continue;
    let de = b.remote ? b.de : null;
    if (!b.remote && ownDeath) { if (!localDe.has(b.id)) { localDe.set(b.id, ownDeath.de); if (localDe.size > 8) localDe.delete(localDe.keys().next().value); } de = localDe.get(b.id); }
    if (de == null) continue;
    for (const q of b.blood) if (q.seed >= 512 && q.seed < 544) { const a = (q.seed - 512) / 32 * Math.PI * 2; add(de, q.x, q.y, Math.cos(a), Math.sin(a)); }
  }
  G.wallStains.sync(want);
}
/* Stage 3D: while someone's death is replayed, their light is where the replay's light is - tumbling out of the hand, sliding, coming to
 * rest - as it is on the victim's own screen (it was dark for everyone else until the corpse appeared).  Not the camcorder: its IR view
 * is the camcorder's own (camcorder.js), and corpses never carry one either. */
function replayLights(p, out) {
  for (const f of fxs) {
    if ((f.k !== 'death' && f.k !== 'boom') || !f.jl || f.gone || !f.lo || f.gear.kind === 'camcorder') continue;
    const T = f.jl.torch; if (!T || Math.hypot(T.x - p.x, T.y - p.y) > 950) continue;
    const r = relRun(f.jl.ph); if (r != null) eqKnown(f.de, r); const pw = powerAt('replay', f.de, f.lf, r == null ? null : relOf(f.de, f.t0 + r), f.gear.kind); if (!(pw > 0)) continue;   // Stage 3D HQ1
    out.push({ x: T.x, y: T.y, angle: T.angle, kind: f.gear.kind, color: f.gear.color, on: true, dead: false, pw });
  }
}
let view = null;                                  // (C3c) where the other players were last drawn (BR-R's mp.wanderers.js declared it; only this module uses it)
function drawPeers(p, cam, sc, los, dt, W, H) {
  const A = window.__api; const lights = []; let hover = null, best = 1e9;
  const layer = A && A.layer && A.layer();
  const now = performance.now() / 1000;
  updateFx(now);
  view = { cam, sc, W, H };
  for (const o of peers.values()) {
    const px = o.x, py = o.y;
    /* Stage 3E-0 (B): eased by the time that passed (dt: the game's frame time, 0..0.25 s), .3 / .35 of the way per 1/60 s as HQ5 did per frame */
    const ft = Number.isFinite(dt) ? Math.min(.25, Math.max(0, dt)) : 0, aP = PEER_MODE === 'a' ? .3 : 1 - Math.pow(.7, 60 * ft), aR = PEER_MODE === 'a' ? .35 : 1 - Math.pow(.65, 60 * ft);
    o.x += (o.tx - o.x) * aP; o.y += (o.ty - o.y) * aP;
    const step = Math.hypot(o.x - px, o.y - py), inv = 1 / Math.max(dt, .001);
    o.vx = (o.vx || 0) + (((o.x - px) * inv) - (o.vx || 0)) * .25;
    o.vy = (o.vy || 0) + (((o.y - py) * inv) - (o.vy || 0)) * .25;
    o.dist = (o.dist || 0) + step;
    o.ang = o.ang === undefined ? o.a : o.ang + angDiff(o.a, o.ang) * aR;
    if (A && A.mkAvatar && layer) {
      if (!o.av) { o.look = parseLook(o.lk); o.gear = { kind: o.k || 'flashlight', color: o.c || '#ffe7b2', parts: {} }; o.av = A.mkAvatar(o.look, o.gear); layer.addChild(o.av); }
      Object.assign(o.look, parseLook(o.lk)); o.gear.kind = o.k || 'flashlight'; o.gear.color = o.c || '#ffe7b2'; o.gear.parts[o.gear.kind] = partObj(o.gear.kind, o.lp);
      o.src = Object.assign(o.src || {}, { x: o.x, y: o.y, angle: o.ang, vx: o.vx, vy: o.vy, distance: o.dist, mv: peerMv(o, now) });
      o.av.update(now, !!o.l && !o.d, false, o.src);
      if (o.d) { o.av.__key = o.id; o.av.deathPose(1, 0, false); if (o.dAt === undefined) o.dAt = now; } else o.dAt = undefined;
      if (o.f >= 0 && o.f < 1 && !o.d) {                          // they are still falling in
        const k = .62, p2 = o.f;
        if (p2 < k) { const h = p2 / k, hs = h * h * (3 - 2 * h), z = 1 + (1 - hs) * (1 - hs) * 1.25; o.av.scale.set(z, z); o.av.alpha = Math.min(1, p2 / .22); o.av.rotation += (1 - hs) * 1.7; }
        else { const u = (p2 - k) / (1 - k), b = Math.exp(-u * 5) * Math.sin(u * 22); o.av.scale.set(1 + .11 * b, 1 - .11 * b); o.av.alpha = 1; }
      } else if (!o.d) { o.av.scale.set(1, 1); o.av.alpha = 1; }
      o.av.visible = !(fxActive(o.id) || (o.d && (hasBody(o.id) || now - o.dAt < .6)));     // their replayed death / finished corpse takes over
    }
    const dx = o.x - p.x, dy = o.y - p.y, dist = Math.hypot(dx, dy);
    const bm = o.av && o.av.beam; if (dist < 950) lights.push({ x: bm ? bm.x : o.x, y: bm ? bm.y : o.y, angle: bm ? bm.angle : o.ang, kind: o.k || 'flashlight', color: o.c || '#ffe7b2', on: !!o.l, ir: o.k === 'camcorder' && o.l ? (o.ir | 0) : 0, dead: !!o.d });
    /* hover: only for wanderers you can actually see (in line of sight and lit) */
    const sx = W / 2 + (o.x - cam.x) * sc, sy = H / 2 + (o.y - cam.y) * sc;
    const dm = Math.hypot(mx() - sx, my() - sy);
    if (dm < 30 * sc && dm < best && dist < 800 && (dist < 30 || !los || los(p.x, p.y, Math.atan2(dy, dx), dist) >= dist - 20)) {
      best = dm; hover = { o, sx, sy };          // hover requires actual line of sight; emitted-light state is handled separately
    }
  }
  DLOG.length = 0; if (window.__api && window.__api.death && window.__api.death() && window.__api.death().active) ownPower();   // (our own death's release is noted every frame)
  srvAnchors();
  replayLights(p, lights); bodyLights(p, lights);
  window.__peerLights = lights;
  wallStains(now);
  if (EN() && N.on) EN().drawDebug(cx, view);                                 // admin-only overlay (the server only sends its data to unlocked admins who switched it on)
  hoverTip(hover, sc);                                                        // (C3c) BR-R shows the hover name (or hides it)
}
N.peerScreen = () => peers.size && view ? [...peers.values()].map(o => ({ n: o.n, look: o.lk, kind: o.k, color: o.c, lp: o.lp, lightOn: o.l, hasAvatar: !!o.av,
  sx: view.W / 2 + (o.x - view.cam.x) * view.sc, sy: view.H / 2 + (o.y - view.cam.y) * view.sc })) : [];
/* (C3c) G.I.B.'s state is this module's: the session asks for its changes - on each message, on the world epoch, when the connection closes */
const endAllFx = () => { for (const f of fxs.splice(0)) killFx(f); };
const forgetOwnDeath = () => { ownDeath = null; mkAt = null; };
const hideCorpse = id => { window.__hideBodies.add('r' + id); };
const showCorpse = id => { window.__hideBodies.delete('r' + id); };
const noPeerLights = () => { window.__peerLights = []; };
function oldLights() {                                                           // the world epoch: the old world's dying lights and wall stains
  window.__peerLights = (window.__peerLights || []).filter(l => l.pw == null);   // (the old world's dying lights: gone now, not at the next frame)
  const G = window.__gore; if (G && G.wallStains && G.wallStains.clear) G.wallStains.clear();   // (its wall stains too)
  stainAt = 0;
}
function killNoted(m) { mkAt = { de: m.mk.de, t: performance.now() / 1000 }; if (m.mk.de != null && m.e && typeof m.e.st === 'number') stNote(m.mk.de, 'k', m.e.st); }   // our kill record arrived (HQ1: and when, on the server's clock)
function takeBodies(list) { bodiesList = list || []; const tb = performance.now() / 1000; for (const b of bodiesList) if (b && b.de != null && Array.isArray(b.lf) && b.lf.length === 4 && Number.isFinite(b.ag + b.lf[3])) { relOf(b.de, tb - b.ag + b.lf[3]); pendSt.push(['r', b.de, b.ag, b.lf[3]]); } applyBodies(); }   // (HQ1: when each corpse's light was let go)
function fxMsg(m) { if (((m.k === 'death' && m.id !== myId()) || m.k === 'boom') && m.de != null) pendSt.push(['k', m.de, Math.max(0, +m.el || 0)]); startFx(m); }   // (HQ1: when the death began, on the server's clock; HQ2: a NEW RUN blast too)
function flushSt(st) { if (pendSt.length) { for (const q of pendSt) stNote(q[1], q[0], q[0] === 'k' ? st - q[2] : st - q[2] + q[3]); pendSt.length = 0; } }   // (HQ1: a replay or corpse that came just before this snapshot was sent in its pass)
return { applyBodies, drawPeers, endAllFx, flushSt, forgetOwnDeath, fxMsg, hideCorpse, killNoted, noPeerLights, oldLights, showCorpse, startFx, takeBodies };
}
function overseerAdmin({ core: { buildHum, EN, room }, session: { connected, myId, N, nrLast, tx }, glitch: { glitches }, cartograph: { giveItem } }) {
/* ---------- admin menu (press ` ) ----------
 * Tabs: PLAYERS · MONSTERS · DEATHS (preview any death on yourself, choose the capture style; Stage 3D HQ3: your own NEW RUN - the instant
 * gib - and UNLIMITED NEW RUN for yourself) · WORLD · DEBUG (debug mode with the AI overlay).
 * Everything the panel does is a command to the server; the server answers each one with a one-line status (ares).  A toggle shows the
 * state the server says it is in (UNLIMITED NEW RUN: nf in every admin snapshot, nrf after a change), never the state a click hoped for. */
/* (C3c) the panel's state, made here (B++'s mp.net.js declared it at M8, just before window.__net) */
const adm = { unlocked: false, pass: null, open: false, data: null, you: null, err: '', dbg: false, nf: 0, skin: false };   // (Stage 3D HQ3: nf - our own UNLIMITED NEW RUN as the SERVER last said it is: never set from a click)
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k, d) { try { const v = localStorage.getItem('adm.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('adm.' + k, JSON.stringify(v)); } catch { } } };
const TABS = [['players', 'PLAYERS'], ['monsters', 'MONSTERS'], ['deaths', 'DEATHS'], ['world', 'WORLD'], ['debug', 'DEBUG']];
adm.tab = LS.get('tab', 'players'); if (!TABS.some(t => t[0] === adm.tab)) adm.tab = 'players';
adm.side = LS.get('side', 'left') === 'right' ? 'right' : 'left';
adm.lay = Object.assign({ ai: true, you: true, srv: true, log: true, compact: false, nav: false, col: false, grid: false, links: false, search: false, crawl: false, evid: false }, LS.get('lay', {})); adm.sel = 0;
adm.opts = Object.assign({ close: true, auto: true, back: true }, LS.get('opts', {}));
adm.sig = ''; adm.res = null; adm.rv = null;
document.head.appendChild(Object.assign(document.createElement('style'), { id: 'admStyle2', textContent: `
#adminPanel{width:364px}#adminPanel.right{left:auto;right:38px}
.adm-tabs{display:flex;gap:1px;margin:-4px -6px 10px;border-bottom:1px solid #75807555}
.adm-tab{flex:1;padding:8px 0 7px;font:600 10px IBM Plex Mono,monospace;letter-spacing:1.3px;color:#8d9e94;background:none;border:0;border-bottom:2px solid transparent;cursor:pointer;margin-bottom:-1px}
.adm-tab:hover{color:#cfd8cb}.adm-tab.on{color:#eef4da;border-bottom-color:#b9cb91}
.adm-status{min-height:15px;margin-top:12px;padding-top:9px;border-top:1px solid #75807533;font-size:10px;letter-spacing:1.4px;color:#9dff9d}.adm-status.bad{color:#ffb0a0}
.adm-sub{color:#8d9e94;font-size:10px;margin:1px 0 7px;letter-spacing:.6px}
.adm-help{color:#8d9e94;font-size:10px;line-height:1.5;letter-spacing:.5px;margin:8px 0 0}
.adm-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
button.adm.adm-pv{display:block;white-space:normal;text-align:left;padding:8px 9px;line-height:1.35}button.adm.adm-pv b{color:#b9cb91;margin-right:5px;font-size:12px}button.adm.adm-pv small{display:block;color:#8d9e94;font-size:9px;letter-spacing:.4px;margin-top:2px}
button.adm.adm-big{width:100%;padding:11px 8px;font-size:12px;letter-spacing:2px}
.adm-ent{display:flex;align-items:center;gap:6px;padding:6px 0;border-top:1px solid #75807522}.adm-ent .k{width:34px;font-weight:600}.adm-ent .k.h{color:#ff9a5c}.adm-ent .k.s{color:#9fe8ff}.adm-ent .k.k{color:#d8c7ff}.adm-ent .st{flex:1;color:#aab6ac;font-size:10px;letter-spacing:.4px}
` }));
const panel = document.createElement('div'); panel.id = 'adminPanel'; panel.hidden = true;
panel.innerHTML = `<div class="adm-head"><b>ADMIN</b><span id="admWho"></span><button class="adm" data-a="dock" title="Move the panel to the other side of the screen" aria-label="Move the panel">⇄</button><button class="adm" data-a="close" aria-label="Close admin">✕</button></div>
<div id="admLogin"><label for="admPass">PASSCODE</label><div class="adm-row"><input id="admPass" type="password" autocomplete="off" maxlength="40"><button class="adm" data-a="unlock">UNLOCK</button></div><p class="adm-note" id="admErr"></p></div>
<div id="admMain" hidden><div class="adm-tabs" id="admTabs"></div><div id="admBody"></div>
<div id="admBroadcast"><div class="adm-sec">BROADCAST</div><div class="adm-row"><input id="admText" maxlength="140" placeholder="Message to everyone" autocomplete="off"><button class="adm" data-a="msg">SEND</button></div></div>
<div class="adm-status" id="admStatus"></div></div>`;
document.body.appendChild(panel);
const banner = Object.assign(document.createElement('div'), { id: 'adminMsg', hidden: true }); document.body.appendChild(banner);
const kickedBox = Object.assign(document.createElement('div'), { id: 'kicked', hidden: true, innerHTML: '<div><h2>Removed by an admin.</h2><p>Reload the page to rejoin.</p></div>' }); document.body.appendChild(kickedBox);
let msgTimer = 0;
function showMsg(text, from) {
  banner.textContent = (from ? from + ': ' : '') + text; banner.hidden = false;
  clearTimeout(msgTimer); msgTimer = setTimeout(() => { banner.hidden = true; }, 8000);
}
const $a = id => document.getElementById(id);
const SNM = (window.WORLD && window.WORLD.SN) || ['stand', 'walk', 'run', 'crouch', 'crawl', 'slide', 'vault', 'down'];
const btn = (label, attrs, on, cls) => `<button class="adm${on ? ' on' : ''}${cls ? ' ' + cls : ''}" ${attrs}>${label}</button>`;
let liveMap = {};                                                     // text that changes every update (positions, states): patched in place so buttons are never rebuilt under the mouse
const live = (key, text) => { liveMap[key] = String(text); return `<span data-live="${key}">${esc(text)}</span>`; };
const rowW = h => `<div class="adm-row wrap">${h}</div>`;
const sec = t => `<div class="adm-sec">${t}</div>`;

function bodyPlayers(d) {
  const mine = d.pl.find(p => p.id === adm.you);
  return sec('WANDERERS · ' + d.pl.length) + d.pl.map(pl => {
    const you = pl.id === adm.you, tags = [you ? 'YOU' : '', pl.ad ? 'ADMIN' : '', !pl.a ? 'MENU' : '', pl.d ? 'DEAD' : '', pl.g ? 'GOD' : ''].filter(Boolean).join(' · ');
    const line = (SNM[pl.st] || 'stand') + ' · ' + pl.x + ',' + pl.y + (!you && mine ? ' · ' + Math.round(Math.hypot(pl.x - mine.x, pl.y - mine.y)) + ' px away' : '');
    return `<div class="adm-player"><div><b>${esc(pl.n || 'WANDERER')}</b> <i>${tags}</i></div><div class="adm-sub">${live('p' + pl.id, line)}</div><div class="adm-row wrap">` +
      (you ? '' : btn('BRING', `data-c="bring" data-id="${pl.id}"`) + btn('GO TO', `data-c="goto" data-id="${pl.id}"`)) +
      (pl.d ? btn('REVIVE', `data-c="revive" data-id="${pl.id}"`) : '') + btn('GOD', `data-c="god" data-id="${pl.id}"`, pl.g) +
      (you ? '' : btn('KICK', `data-c="kick" data-id="${pl.id}" data-confirm="Kick ${esc(pl.n)}?"`)) + '</div></div>';
  }).join('') + '<p class="adm-help">Living wanderers are solid to each other: BRING and GO TO put a player on the nearest free spot beside the other, not on top. MENU = not in the halls (never joined, or after their NEW RUN until SPAWN). Corpses and the dead never block anyone.</p>';
}
function bodyMonsters(d) {
  const mine = d.pl.find(p => p.id === adm.you), sp = v => btn(v + '×', `data-c="speed" data-v="${v}"`, d.sp === v);
  const ents = (d.es || []).slice().sort((a, b) => a[0] - b[0]);
  const mh = d.mh || 64, ms = d.ms || 64;
  return sec(`MONSTERS · ${d.hn} HOUND${d.hn === 1 ? '' : 'S'} (ADMIN MAX ${mh})${d.pk ? ' · PACK' : ''} · ${d.sn} SMILER${d.sn === 1 ? '' : 'S'} (ADMIN MAX ${ms})`) +
    rowW(btn(d.fz ? 'FROZEN' : 'FREEZE', `data-c="freeze" data-on="${d.fz ? 0 : 1}"`, d.fz) + btn('SUMMON HOUND TO ME', 'data-c="summon"') + btn('RESPAWN ALL', 'data-c="monsters"')) +
    `<div class="adm-row wrap" style="margin-top:6px">` + btn('+ HOUND', 'data-c="hounds" data-mode="add" data-n="1"') + btn('+10 HOUNDS', 'data-c="hounds" data-mode="add" data-n="10"') + btn('− HOUND', 'data-c="hounds" data-mode="remove" data-n="1"') + btn('+ SMILER', 'data-c="smilers" data-mode="add" data-n="1"') + btn('+10 SMILERS', 'data-c="smilers" data-mode="add" data-n="10"') + btn('− SMILER', 'data-c="smilers" data-mode="remove" data-n="1"') + '</div>' +
    sec('PUT ONE NEAR ME') + rowW(btn('+ HOUND NEAR', 'data-c="near" data-k="hound"') + btn('+ SMILER NEAR', 'data-c="near" data-k="smiler"')) +
    sec('WORLD SPEED') + rowW(sp(0.25) + sp(0.5) + sp(1) + sp(2) + sp(3)) +
    sec('ENTITIES · ' + ents.length) + (ents.length ? ents.map(e => {
      const dist = mine ? ' · ' + Math.round(Math.hypot(e[3] - mine.x, e[4] - mine.y)) + ' px' : '';
      return `<div class="adm-ent"><span class="k ${e[1] === 2 ? 'k' : e[1] ? 's' : 'h'}">${e[1] === 2 ? 'K' : e[1] ? 'S' : 'H'}#${e[0]}</span><span class="st">${live('e' + e[0], e[2] + ' · ' + ({ n: 'near', m: 'mid', f: 'far' }[e[5]] || e[5]) + (e[6] ? ' · HOLDING SOMEONE' : '') + dist)}</span>` + btn('GO TO', `data-c="entgoto" data-eid="${e[0]}"`) + btn('REMOVE', `data-c="entdel" data-eid="${e[0]}"`) + '</div>';
    }).join('') : '<p class="adm-help">No entities right now.</p>');
}
/* ---- the death lab: the clock, the x-ray and the overlay are client-side (window.__dlab, read by dphys.js and the debug renderer); placing is a teleport ---- */
const DL = () => window.__dlab || (window.__dlab = { on: false, paused: false, speed: 1, step: 0, xray: false, viz: false });
function labSet(k, v) {
  const L = DL();
  if (k === 'speed') L.speed = +v; else if (k === 'pause') L.paused = !L.paused; else if (k === 'step') { L.paused = true; L.step = (L.step | 0) + (+v || 1); }
  else if (k === 'xray') L.xray = !L.xray; else if (k === 'viz') L.viz = !L.viz; else if (k === 'reset') { L.speed = 1; L.paused = false; L.step = 0; }
  L.on = L.speed !== 1 || L.paused;
}
function findSpot(kind) {
  const A = window.__api; if (!A || !A.sl || !A.Uc) return null; const H = A.H, gl = glitches() || [], lamps = A.lamps || [], TAU2 = Math.PI * 2;
  const ok = (x, y) => A.sl(x, y, 24) && !gl.some(g => Math.hypot(g.x - x, g.y - y) < 260) && !lamps.some(l => Math.hypot(l.x - x, l.y - y) < 230);
  const ray = (x, y, a) => A.Uc(x, y, a, 260);
  if (kind === 'crawl') { const W0 = window.WORLD; let b = null, bd = 1e9; for (const c of (W0 && W0.CRAWL) || []) for (const x of c.exits) { const d = Math.hypot(x.x - H.x, x.y - H.y); if (d < bd && A.sl(x.x + x.nx * 30, x.y + x.ny * 30, 22)) { bd = d; b = { x: x.x + x.nx * 30, y: x.y + x.ny * 30, a: Math.atan2(-x.ny, -x.nx), n: 'OUTSIDE CRAWLSPACE ' + c.id + ' (' + x.face + ' side) - CROUCH + CRAWL IN' }; } } return b; }
  for (let R = 0; R < 3200; R += 64) {
    const n = Math.max(1, Math.round(R / 40)) * 4;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU2, x = H.x + Math.cos(a0) * R, y = H.y + Math.sin(a0) * R; if (!ok(x, y)) continue;
      if (kind === 'door') { for (const [ax, px] of [[0, Math.PI / 2], [Math.PI / 2, 0]]) { const w = ray(x, y, px) + ray(x, y, px + Math.PI); if (w < 200 && w > 70 && ray(x, y, ax) > 250 && ray(x, y, ax + Math.PI) > 250) { const sx = x + Math.cos(ax + Math.PI) * 170, sy = y + Math.sin(ax + Math.PI) * 170; if (ok(sx, sy)) return { x: sx, y: sy, a: ax, n: 'BEFORE A DOORWAY' }; } } continue; }
      if (kind === 'pillar') { let hit = 0, nearA = 0; for (let k = 0; k < 16; k++) { const d = ray(x, y, k / 16 * TAU2); if (d < 130) { hit++; nearA = k / 16 * TAU2; } } if (hit >= 2 && hit <= 5 && ray(x, y, nearA + Math.PI) > 240) { const gx = x + Math.cos(nearA) * 200, gy = y + Math.sin(nearA) * 200; if (!A.sl(gx, gy, 10) && ok(x, y)) return { x, y, a: nearA, n: 'BY A PILLAR / WALL END' }; } continue; }
      if (kind === 'open') { let good = true; for (let k = 0; k < 8; k++) if (ray(x, y, k / 8 * TAU2) < 210) { good = false; break; } if (good) return { x, y, a: 0, n: 'OPEN ROOM' }; }
      else for (let k = 0; k < 16; k++) {
        const a = k / 16 * TAU2;
        if (kind === 'wall') { const dd = ray(x, y, a); if (dd > 72 && dd < 108 && ray(x, y, a + .5) > 60 && ray(x, y, a - .5) > 60 && ray(x, y, a + Math.PI) > 150) return { x, y, a: a + Math.PI, n: 'NEAR A WALL' }; }
        else { const d1 = ray(x, y, a), d2 = ray(x, y, a + Math.PI / 2); if (d1 > 60 && d1 < 115 && d2 > 60 && d2 < 115 && ray(x, y, a + Math.PI) > 150 && ray(x, y, a + Math.PI * 1.5) > 150) return { x, y, a: a + Math.PI * 1.25, n: 'IN A CORNER' }; }
      }
    }
  }
  return null;
}
function bodyDeaths(d) {
  const cm = d.cm || 'auto', cb = (m, l) => btn(l, `data-c="capmode" data-mode="${m}"`, cm === m);
  const pv = (k, v, t, sub) => `<button class="adm adm-pv" data-c="preview" data-k="${k}" data-var="${v}"><b>${v}</b>${t}<small>${sub}</small></button>`;
  const tg = (o, l) => btn(l, `data-a="opt" data-o="${o}"`, adm.opts[o]);
  const L = DL(), sp = v => btn(v + '×', `data-a="dl" data-k="speed" data-v="${v}"`, L.speed === v), dl = (k, t, on, v) => btn(t, `data-a="dl" data-k="${k}"${v !== undefined ? ` data-v="${v}"` : ''}`, on);
  const lab = sec('DEATH LAB · WATCH IT SLOWLY') + rowW(sp(1) + sp(.5) + sp(.25) + dl('pause', L.paused ? '▶ PLAY' : '❚❚ PAUSE', L.paused) + dl('step', 'STEP 1 FRAME', false, 1) + dl('step', 'STEP 6', false, 6)) +
    rowW(dl('xray', 'X-RAY ATTACKER', L.xray) + dl('viz', 'SHOW PATHS · FORCES', L.viz) + btn('REPLAY LAST', 'data-a="replay"') + dl('reset', 'RESET CLOCK', false)) +
    sec('PLACE ME FIRST') + rowW(btn('OPEN ROOM', 'data-a="place" data-w="open"') + btn('NEAR A WALL', 'data-a="place" data-w="wall"') + btn('IN A CORNER', 'data-a="place" data-w="corner"')) +
    '<p class="adm-help">The clock, x-ray and overlay only change what YOU see. Set the speed or pause before you press a death button; the panel stays open if CLOSE THE PANEL is off. Green: body path · white: velocity · purple: spin · orange/blue: hands (ring = where the spring wants it, dot = where it is) · yellow: the light · red dashed: attacker · red x: wall hits.</p>';
  const nf = adm.nf, last = nrLast(), lastTxt = !last ? 'NOT PRESSED YET ON THIS CONNECTION' : last.ok ? 'APPROVED (EVENT ' + last.de + ')' : last.why === 'cooldown' ? 'REFUSED · WAIT ' + Math.ceil(+last.wait || 0) + ' S' : 'REFUSED · ' + ({ state: 'NOT IN A RUN (SPAWN FIRST)', dead: 'DEAD', held: 'HELD BY AN ENTITY', epoch: 'THE WORLD WAS JUST RESET' }[last.why] || String(last.why).toUpperCase());
  const mine = sec('YOUR NEW RUN · INSTANT GIB') + rowW(btn(nf ? '● UNLIMITED NEW RUN ON' : '○ UNLIMITED NEW RUN OFF', `data-c="nrfree" data-on="${nf ? 0 : 1}"`, nf)) +
    `<div class="adm-sub">SERVER SAYS: ${nf ? 'ON' : 'OFF'} · LAST NEW RUN: ${live('nrlast', lastTxt)}</div>` +
    '<p class="adm-help">NEW RUN (Esc, then NEW RUN) blows YOUR wanderer into pieces at once: the server decides, everyone sees the same pieces, and they stay as your corpse until your next death or NEW RUN. Normally once every 30 s. UNLIMITED NEW RUN skips that wait for you alone, on this connection only (OFF again after a reconnect); you still have to be alive, free and back in a run (SPAWN) first. WORLD → NEW RUN FOR EVERYONE is a different thing: it resets the whole room and never blows anybody up.</p>';
  return mine + lab + sec('CAPTURE STYLE (FOR REAL CATCHES)') + rowW(cb('auto', 'AUTO') + cb('quick', 'ALWAYS QUICK') + cb('play', 'ALWAYS PLAY')) +
    '<p class="adm-help">AUTO: each entity decides. QUICK: every catch is an instant kill. PLAY: every catch is a held victim (down, crawl, dragged, maybe let go) for 5-15 s before the kill. Set PLAY, then SUMMON A HOUND, to watch the long version.</p>' +
    sec('PLAY A DEATH ON ME · HOUND') + `<div class="adm-grid">${pv('hound', 'A', 'THROAT', 'lunge from the front, held down')}${pv('hound', 'B', 'DRAGGED', 'pulled down and dragged away')}${pv('hound', 'C', 'WALL SLAM', 'needs a wall 1-2 body lengths off')}${pv('hound', 'D', 'EXHAUSTED', 'goes down in a heap')}</div>` +
    sec('PLAY A DEATH ON ME · SMILER') + `<div class="adm-grid">${pv('smiler', 'A', 'RUSH', 'out of the dark, arms reaching')}${pv('smiler', 'B', 'CORNERED', 'it closes in, everything goes black')}${pv('smiler', 'C', 'LIGHT FAILURE', 'the lamps die, one last dark')}${pv('smiler', 'D', 'PLAYED WITH', 'knocked back, dragged, slow')}</div>` +
    sec('AFTER IT PLAYS') + rowW(tg('close', 'CLOSE THE PANEL') + tg('auto', 'AUTO-REVIVE') + tg('back', 'BACK TO THIS SPOT')) +
    '<p class="adm-help">This runs the real kill on you: everyone in the room sees it and your body stays. It works through god mode and spawn protection, uses the nearest free hound or smiler, and tells you here if it cannot be done.</p>';
}
function bodyWorld(d) {
  return sec('LIGHTS') + rowW(['auto', 'on', 'off'].map(m => btn(m === 'auto' ? 'AUTO' : 'BLACKOUT ' + m.toUpperCase(), `data-c="blackout" data-mode="${m}"`, d.bo === m)).join('')) +
    sec(`GLITCHED WALLS · ${d.gw}`) + rowW(btn('GO TO NEAREST', 'data-c="glitch" data-mode="tp"') + btn('MOVE THEM', 'data-c="glitch" data-mode="new"')) +
    sec(`CARTOGRAPH · ${d.it ? 'ON THE FLOOR' : 'TAKEN'}`) + rowW(btn('GO TO IT', 'data-c="item" data-mode="tp"') + btn('MOVE IT', 'data-c="item" data-mode="new"') + btn('GIVE ME ONE', 'data-a="give"')) +
    sec('RUN · THE WHOLE ROOM') + rowW(btn('NEW RUN FOR EVERYONE', 'data-c="world" data-confirm="Reset the whole world for everyone? Every corpse, blood stain and dying light goes; everyone in a run starts again. Nobody is blown up."')) +
    '<p class="adm-help">A world reset, not anyone\'s own NEW RUN: nobody is blown up and no NEW RUN cooldown starts. Every death, gib, corpse, wall stain and dying light of the old world goes on every screen. Your own instant-gib NEW RUN is in the DEATHS tab.</p>';
}
function bodyDebug(d) {
  const L = (k, t) => btn(t, `data-a="lay" data-l="${k}"`, adm.lay[k]);
  return sec('DEBUG MODE') + `<button class="adm adm-big${adm.dbg ? ' on' : ''}" data-a="dbg">${adm.dbg ? '● DEBUG MODE ON' : '○ DEBUG MODE OFF'}</button>` +
    '<p class="adm-help">An overlay for admins only. The server sends its data to you alone, and only while this is on.</p>' +
    sec('LAYERS') + rowW(L('ai', 'AI ENTITIES') + L('you', 'YOU + HEARING') + L('srv', 'SERVER') + L('log', 'AI EVENTS')) +
    sec('ENTITY LABELS') + rowW(btn('FULL', 'data-a="lab" data-v="0"', !adm.lay.compact) + btn('COMPACT', 'data-a="lab" data-v="1"', adm.lay.compact)) +
    sec('NAVIGATION') + rowW(L('nav', 'ROUTES') + L('col', 'COLLISION') + L('grid', 'WALKABLE') + L('links', 'VAULT LINKS')) +
    rowW(btn('SELECT NEAREST', 'data-a="navsel" data-v="near"') + btn('NEXT ENTITY', 'data-a="navsel" data-v="next"') + btn(adm.sel ? 'SELECTED #' + adm.sel + ' ✕' : 'NONE SELECTED', 'data-a="navsel" data-v="none"', !!adm.sel)) +
    rowW(btn('FOLLOW ME', 'data-c="nav" data-cmd="follow"') + btn('COME HERE', 'data-c="nav" data-cmd="come"') + btn('HUNT ME (AI)', 'data-c="nav" data-cmd="hunt"') + btn('CLEAR TARGET', 'data-c="nav" data-cmd="clear"')) +
    rowW(btn('FORCE REPATH', 'data-c="nav" data-cmd="repath"') + btn('DROP ROUTE', 'data-c="nav" data-cmd="noroute"') + btn('RESET STUCK', 'data-c="nav" data-cmd="unstuck"') + btn('GO TO IT', 'data-a="navgo"')) +
    rowW(btn('ME → DOORWAY', 'data-a="place" data-w="door"') + btn('ME → PILLAR', 'data-a="place" data-w="pillar"') + btn('ME → CORNER', 'data-a="place" data-w="corner"') + btn('ME → OPEN ROOM', 'data-a="place" data-w="open"')) +
    sec('EVIDENCE · LIGHT') + rowW(L('evid', 'EVIDENCE + LEADS')) +
    '<p class="adm-help">EVIDENCE + LEADS: dashed rings are anonymous leads (white = a light source it saw, yellow = a beam, orange = a lit wall, brown = a lit floor; ring size = how unsure). A lead names nobody. Diamonds are evidence on the record it holds (red = seen, violet = heard, yellow = light it later pinned on that person). The label adds DECIDE (state and its reason), any retarget, the last light it noticed, and EYE CONTACT. The selected entity shows all of it plus its traits.</p>' +
    sec('CHASE · SEARCH · HIDING') + rowW(L('search', 'SEARCH + MEMORY') + L('crawl', 'CRAWLSPACES') + btn('ME → CRAWLSPACE', 'data-a="place" data-w="crawl"') + btn('HUNT ME (AI)', 'data-c="nav" data-cmd="hunt"')) +
    '<p class="adm-help">SEARCH + MEMORY (every hound, full detail on the selected one): amber square = where it last had you, amber arrow = the way it saw you going, dashed ring = how unsure it is where you are now (the estimate at its centre), violet = the last sound it heard from you, blue cross = where it is searching and why (continue = down the way you went, exit = a crawlspace exit, enter = going in, sound = a noise). The label shows the search phase, legs searched, time left, memory age and the reason it gave up. CRAWLSPACES: cyan = the space inside, dashed = what covers it from above (table top / wall), dots = the ways in and out, and whether the selected entity can use it (green) or must go round (red).</p>' +
    '<p class="adm-help">ROUTES: green = the route (orange = a vault, violet = crawl), white cross = the aim point it steers at, blue arrow = the heading it wants, white arrow = how it actually moves, dashed yellow = running straight at the goal. The selected entity also shows why it last re-planned, its stuck timer and counters (routes / wall touches / hard hits / stuck / recoveries / emergencies). COLLISION: its collision circle and the wall blocks around it. WALKABLE: floor near you, brighter = more room. FOLLOW / COME are navigation only; HUNT ME runs the real AI.</p>' +
    sec('TOOLS') + rowW(btn('COPY REPORT', 'data-a="copy"') + btn(d.fz ? 'UNFREEZE' : 'FREEZE THE HALLS', `data-c="freeze" data-on="${d.fz ? 0 : 1}"`, d.fz) + btn('SLOW MOTION 0.25×', 'data-c="speed" data-v="0.25"', d.sp === .25) + btn('NORMAL SPEED', 'data-c="speed" data-v="1"', d.sp === 1)) +
    '<p class="adm-help">AI ENTITIES: dashed ring = how far it can see; red line = last known position of its target (yellow: only heard or remembered); purple = last sound it heard; blue cross = where it is searching; green = its path; the label shows state, target, mood, capture. YOU: your state, stamina and the dashed ring of how far you are heard right now. COPY REPORT puts the room, players, entities, recent events and timings on the clipboard, ready to paste into a bug report.</p>';
}
/* Trial 3: the Skin-Stealer's admin-only tools, on their own tab (the other tabs stay as they were).  The world never spawns one: only
 * this tab (and the debug tools) put one in the halls, at most ADMIN_MAX_SKINSTEALERS. */
function bodySkin(d) {
  const kn = d.kn | 0, mk = d.mk || 4;                                // (kn / mk come only while a Skin-Stealer exists; 4 = sim.ai.js ADMIN_MAX_SKINSTEALERS)
  const ks = (d.es || []).filter(e => e[1] === 2);
  return sec(`SKIN-STEALER · ${kn} IN THE HALLS (ADMIN MAX ${mk}) · ADMIN ONLY`) +
    rowW(btn('+ SKIN-STEALER', 'data-c="skinstealers" data-mode="add" data-n="1"') + btn('+ NEAR ME', 'data-c="near" data-k="skinstealer"') + btn('− SKIN-STEALER', 'data-c="skinstealers" data-mode="remove" data-n="1"')) +
    (ks.length ? ks.map(e => `<div class="adm-ent"><span class="k k">K#${e[0]}</span><span class="st">${live('k' + e[0], e[2] + ' · ' + ({ n: 'near', m: 'mid', f: 'far' }[e[5]] || e[5]) + (e[6] ? ' · HOLDING SOMEONE' : ''))}</span>` + btn('GO TO', `data-c="entgoto" data-eid="${e[0]}"`) + btn('REMOVE', `data-c="entdel" data-eid="${e[0]}"`) + '</div>').join('') : '<p class="adm-help">None in the halls. The world never makes one: only this tab does.</p>') +
    sec('ITS DEATHS · PLAYED ON YOU') + rowW('<button class="adm adm-pv" data-c="preview" data-k="skinstealer" data-var="A"><b>A</b>NECK BREAK<small>a grip from close by</small></button>' +
      '<button class="adm adm-pv" data-c="preview" data-k="skinstealer" data-var="B"><b>B</b>POUNCE<small>carried down, then the neck</small></button>' +
      '<button class="adm adm-pv" data-c="preview" data-k="skinstealer" data-var="C"><b>C</b>NECK BITE<small>held, bitten</small></button>' +
      '<button class="adm adm-pv" data-c="preview" data-k="skinstealer" data-var="D"><b>D</b>THE REND<small>torn in two</small></button>') +
    '<p class="adm-help">Each plays that death on you through the real kill path (a Skin-Stealer is set down a step in front of you, or the nearest side with room): the server records it as the killer, every screen replays it, the server makes the corpse, and it then stays on its kill and feeds. Revive yourself from PLAYERS. The DEATHS tab\'s death lab (slow, pause, x-ray) works for these too.</p>' +
    '<p class="adm-help">A patient, deceptive predator (Trial 3, admin QA only). + SKIN-STEALER puts one far from everyone, in the dark; + NEAR ME a few hundred px away, out of sight if possible. Its state, hunger, stamina and plan are on the DEBUG overlay (AI ENTITIES).</p>';
}
const BODIES = { players: bodyPlayers, monsters: bodyMonsters, deaths: bodyDeaths, world: bodyWorld, debug: bodyDebug, skin: bodySkin };
/* (Trial 3) the SKIN tab joins the five after K is pressed with the panel open, while a Skin-Stealer exists, or while it is the open tab
 * (the panel is otherwise as it was) */
function renderTabs() { $a('admTabs').innerHTML = (adm.skin || adm.tab === 'skin' || (adm.data && adm.data.kn) ? TABS.concat([['skin', 'SKIN']]) : TABS).map(([k, n]) => `<button class="adm-tab${adm.tab === k ? ' on' : ''}" data-a="tab" data-t="${k}">${n}</button>`).join(''); }
function renderStatus() {
  const el = $a('admStatus'); if (!el) return;
  const r = adm.res, fresh = r && performance.now() - r.at < 6000;
  el.textContent = fresh ? r.msg : ''; el.classList.toggle('bad', !!(fresh && !r.ok));
}
function renderAdmin() {
  panel.hidden = !adm.open; panel.classList.toggle('right', adm.side === 'right');
  $a('admLogin').hidden = adm.unlocked; $a('admMain').hidden = !adm.unlocked;
  $a('admErr').textContent = connected() ? adm.err : 'Admin needs the online server (not available in solo mode).';
  $a('admWho').textContent = adm.unlocked ? ' · ROOM ' + room.toUpperCase() : '';
  if (adm.open && !adm.unlocked) setTimeout(() => $a('admPass').focus(), 0);
  if (adm.unlocked) { renderTabs(); adm.sig = ''; renderAdminData(); renderStatus(); }
}
function renderAdminData() {
  const d = adm.data; if (!adm.open || !adm.unlocked || !d) return;
  liveMap = {};
  const html = (BODIES[adm.tab] || bodyPlayers)(d), sig = adm.tab + '|' + html.replace(/(<span data-live="[^"]+">)[^<]*(<\/span>)/g, '$1$2'), body = $a('admBody');
  if (sig !== adm.sig) { body.innerHTML = html; adm.sig = sig; }
  else for (const el of body.querySelectorAll('[data-live]')) { const t = liveMap[el.dataset.live]; if (t !== undefined && el.textContent !== t) el.textContent = t; }
  $a('admBroadcast').hidden = adm.tab !== 'players';
}
function toggleAdmin() { adm.open = !adm.open; renderAdmin(); }
function unlock() { const v = $a('admPass').value; if (!v) return; adm.pass = v; adm.err = ''; tx({ t: 'admin', pass: v }); $a('admPass').value = ''; }
function sendMsg() { const el = $a('admText'), text = el.value.trim(); if (text) { tx({ t: 'a', c: 'msg', text }); el.value = ''; } }
/* debug mode: the master switch tells the server to start (or stop) sending its data; the layers only decide what is drawn here */
function applyDbg() {
  const E = EN(); if (E) { Object.assign(E.dbgCfg, adm.lay, { on: adm.dbg, side: adm.side === 'left' ? 'right' : 'left' }); if (!adm.dbg) E.clearDebug(); }
  LS.set('lay', adm.lay);
}
function copyText(text) {
  const fallback = () => { const ta = Object.assign(document.createElement('textarea'), { value: text }); ta.style.cssText = 'position:fixed;left:-999px;top:0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { } ta.remove(); return ok; };
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => fallback());
  return Promise.resolve(fallback());
}
function report() {
  const A = window.__api, E = EN(), d = adm.data || {}, mv = window.__mv || {};
  return JSON.stringify({
    when: new Date().toISOString(), room, you: adm.you, at: A ? { x: Math.round(A.H.x), y: Math.round(A.H.y), stamina: Math.round(A.H.stamina) } : null, move: { state: mv.s, speed: Math.round(mv.speed || 0), surface: mv.surf },
    world: { frozen: d.fz, speed: d.sp, blackout: d.bo, hounds: d.hn, smilers: d.sn, capture: d.cm }, players: d.pl, entities: d.es, ai: E && E.dbg, log: E && E.dbgX.lg.map(l => '[' + l.t + '] ' + l.x), server: E && E.dbgX.pf, ping: E && E.dbgX.ping, fps: E && Math.round(E.fps), agent: navigator.userAgent,
  }, null, 1);
}
/* after "play a death on me": wait for the death to run, revive (optional), and put the admin back where the preview was (optional) - so the next preview is one click away */
function previewTick() {
  const A = window.__api, r = adm.rv; if (!r || !A) return;
  const now = performance.now();
  if (now - r.t0 > 60000 || !adm.unlocked) { adm.rv = null; return; }
  if (r.stage === 0) { if (A.G.caught) r.stage = 1; else if (now - r.t0 > 8000) adm.rv = null; }
  else if (r.stage === 1) { if (A.G.caught && A.death && A.death().finished) { r.stage = 2; r.t1 = now; } }
  else if (r.stage === 2) {
    if (adm.opts.auto && !r.sent && now - r.t1 > 1300) { r.sent = true; tx({ t: 'a', c: 'revive', id: myId() }); }
    if (!A.G.caught) r.stage = 3;
  } else if (r.stage === 3 && A.fall && A.fall() < 0) { if (adm.opts.back) { A.tp(r.pos.x, r.pos.y); A.H.angle = r.pos.a; } adm.rv = null; }
}
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'close') { adm.open = false; renderAdmin(); return; }
  if (a === 'unlock') return unlock();
  if (a === 'msg') return sendMsg();
  if (a === 'give') { giveItem('cartograph'); return; }
  if (a === 'dock') { adm.side = adm.side === 'left' ? 'right' : 'left'; LS.set('side', adm.side); applyDbg(); renderAdmin(); return; }
  if (a === 'tab') { adm.tab = b.dataset.t; LS.set('tab', adm.tab); renderAdmin(); return; }
  if (a === 'dbg') { adm.dbg = !adm.dbg; applyDbg(); tx({ t: 'a', c: 'debug', on: adm.dbg ? 1 : 0 }); adm.sig = ''; renderAdminData(); return; }
  if (a === 'lay') { adm.lay[b.dataset.l] = !adm.lay[b.dataset.l]; applyDbg(); adm.sig = ''; renderAdminData(); return; }
  if (a === 'lab') { adm.lay.compact = b.dataset.v === '1'; applyDbg(); adm.sig = ''; renderAdminData(); return; }
  if (a === 'dl') { labSet(b.dataset.k, b.dataset.v); adm.sig = ''; renderAdminData(); return; }
  if (a === 'navsel') {
    const L = (EN() && EN().dbg) || [], A = window.__api; if (b.dataset.v === 'none') adm.sel = 0;
    else if (!L.length) adm.res = { ok: false, msg: 'TURN DEBUG MODE ON FIRST (the list comes from the server)', at: performance.now() };
    else if (b.dataset.v === 'near' && A) { let bd = 1e18; for (const d of L) { const dd = Math.hypot(d.x - A.H.x, d.y - A.H.y); if (dd < bd) { bd = dd; adm.sel = d.i; } } }
    else { const ids = L.map(d => d.i).sort((x, y) => x - y), k = ids.indexOf(adm.sel); adm.sel = ids[(k + 1) % ids.length]; }
    if (EN()) EN().navSel = adm.sel; renderAdminData(); return;
  }
  if (a === 'navgo') { const d = ((EN() && EN().dbg) || []).find(q => q.i === adm.sel); if (d) tx({ t: 'a', c: 'entgoto', eid: d.i }); else { adm.res = { ok: false, msg: 'SELECT AN ENTITY FIRST', at: performance.now() }; renderStatus(); } return; }
  if (a === 'place') { const sp = findSpot(b.dataset.w), A = window.__api; adm.res = sp && A ? (A.tp(sp.x, sp.y), A.H.angle = sp.a, { ok: true, msg: 'MOVED YOU: ' + sp.n, at: performance.now() }) : { ok: false, msg: 'NO SUCH SPOT NEARBY - WALK SOMEWHERE ELSE FIRST', at: performance.now() }; renderStatus(); return; }
  if (a === 'replay') { const r = adm.lastPv; if (!r) { adm.res = { ok: false, msg: 'NOTHING TO REPLAY YET', at: performance.now() }; renderStatus(); return; } const A = window.__api; adm.rv = A ? { stage: 0, t0: performance.now(), pos: { x: A.H.x, y: A.H.y, a: A.H.angle } } : null; tx({ t: 'a', c: 'preview', k: r.k, var: r.var }); return; }
  if (a === 'opt') { adm.opts[b.dataset.o] = !adm.opts[b.dataset.o]; LS.set('opts', adm.opts); adm.sig = ''; renderAdminData(); return; }
  if (a === 'copy') { copyText(report()).then(ok => { adm.res = { ok, msg: ok ? 'REPORT COPIED TO THE CLIPBOARD' : 'COULD NOT COPY: CLIPBOARD BLOCKED', at: performance.now() }; renderStatus(); }); return; }
  if (!b.dataset.c) return;
  if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
  const o = { t: 'a', c: b.dataset.c };
  if (b.dataset.id) o.id = +b.dataset.id;
  if (b.dataset.eid) o.eid = +b.dataset.eid;
  if (b.dataset.v) o.v = +b.dataset.v;
  if (b.dataset.mode) o.mode = b.dataset.mode;
  if (b.dataset.k) o.k = b.dataset.k;
  if (b.dataset.var) o.var = b.dataset.var;
  if (b.dataset.on !== undefined) o.on = +b.dataset.on;
  if (b.dataset.n) o.n = +b.dataset.n;
  if (b.dataset.cmd) o.cmd = b.dataset.cmd;
  if (o.c === 'nav') { if (!adm.sel) { adm.res = { ok: false, msg: 'SELECT AN ENTITY FIRST', at: performance.now() }; renderStatus(); return; } o.eid = adm.sel; }
  if (o.c === 'preview') { adm.lastPv = { k: o.k, var: o.var }; const A = window.__api; adm.rv = A ? { stage: 0, t0: performance.now(), pos: { x: A.H.x, y: A.H.y, a: A.H.angle } } : null; }
  tx(o);
});
panel.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { if (e.target.id === 'admPass') unlock(); else if (e.target.id === 'admText') sendMsg(); } if (e.key === 'Escape') { adm.open = false; renderAdmin(); } });
addEventListener('keydown', e => { if (e.code === 'Backquote' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggleAdmin(); }
  else if (e.code === 'KeyK' && adm.open && adm.unlocked && !(e.target instanceof HTMLInputElement)) { adm.skin = !adm.skin; if (!adm.skin && adm.tab === 'skin') adm.tab = 'players'; renderAdmin(); } });   // (Trial 3: K shows / hides the SKIN tab)
setInterval(() => { if (adm.dbg && adm.unlocked) tx({ t: 'ping', ts: performance.now() }); }, 1000);
setInterval(renderStatus, 1000);

/* Stage 3H2 (C-4): the fluorescent light hum - buildHum, humUpdate, its crackles, thunk and strike-back, and its state - is
 * assets/mp-hum.js's; mp.js reads it at start-up (above), calls humUpdate() every frame and keeps the offline check below. */
/* offline spectrum check (used by tests): energy at chosen frequencies, in dB relative to full scale */
N.testHum = async freqs => {
  const oc = new OfflineAudioContext(1, 44100 * 3, 44100), h = buildHum(oc, oc.destination); h.out.gain.value = 1;
  const buf = await oc.startRendering(), x = buf.getChannelData(0).subarray(44100), out = {};
  for (const f of freqs) { let re = 0, im = 0; for (let i = 0; i < x.length; i++) { const w = 2 * Math.PI * f * i / 44100; re += x[i] * Math.cos(w); im += x[i] * Math.sin(w); } out[f] = +(20 * Math.log10(Math.hypot(re, im) * 2 / x.length + 1e-9)).toFixed(1); }
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); out.peak = +pk.toFixed(3); return out;
};
/* (C3c) the session hands the server's admin messages to the panel: each changes the panel's own state, as the transport's lines did at M8 */
function loginAnswer(m) {                                                        // the login's answer (not a test's quiet one)
  adm.unlocked = !!m.ok; adm.err = m.ok ? '' : (m.wait ? 'TOO MANY TRIES · WAIT ' + m.wait + 'S' : 'WRONG PASSCODE');
  if (!m.ok) adm.pass = null;
  renderAdmin();
}
const relogin = () => { if (adm.pass) tx({ t: 'admin', pass: adm.pass }); };   // a new connection: stay unlocked across reconnects (kept in memory only)
function nrfAnswer(m) { adm.nf = m.on ? 1 : 0; adm.sig = ''; renderAdminData(); }   // Stage 3D HQ3: the server's answer to UNLIMITED NEW RUN ON / OFF
function aresAnswer(m) {                                                         // the server's one-line answer to an admin command
  adm.res = { ok: !!m.ok, msg: String(m.msg || ''), at: performance.now() }; renderStatus();
  if (adm.rv && adm.rv.stage === 0) { if (!m.ok) adm.rv = null; else if (adm.opts.close && /^PLAYING/.test(adm.res.msg)) { adm.open = false; renderAdmin(); } }
}
function pong(m) { const E = EN(); if (E) { const r = performance.now() - (+m.ts || 0); E.dbgX.ping = E.dbgX.ping < 0 ? r : E.dbgX.ping + (r - E.dbgX.ping) * .3; } }
const kickedShow = () => { document.getElementById('kicked').hidden = false; };
function debugData(m) { if (EN()) { EN().setDebug(m.dbg); if (m.dx) EN().setDebugX(m.dx); } }
function adminData(m) { adm.data = m.ad; adm.you = m.you; adm.nf = m.nf ? 1 : 0; renderAdminData(); }   // (nf: Stage 3D HQ3, every admin snapshot says it again)
function debugGone() { if (EN()) { EN().clearDebug(); EN().dbgCfg.on = false; EN().drawDebug(); } }   // the connection closed: the overlay goes
function adminOffline() { adm.unlocked = false; adm.dbg = false; adm.nf = 0; renderAdmin(); }   // (Stage 3D HQ3: UNLIMITED NEW RUN is gone with the connection: a new one starts OFF on the server too)
return { adminData, adminOffline, aresAnswer, debugData, debugGone, kickedShow, loginAnswer, nrfAnswer, pong, previewTick, relogin, showMsg, unlocked: () => adm.unlocked };
}
function mpFrame({ core: { cv, cx, dread, EN, game, humUpdate, light }, session: { handled, me, mseq, N, sendPose }, glitch: { exited, soloGlitches }, cartograph: { itemsFrame, soloItems },
  monsters: { applyCaught, applyServerState, fadeHit, hitFlash, hSlots, unhold }, audio: { burst, onlineNote, setDrone, thump }, deaths: { drawPeers }, admin: { previewTick } }) {
/* ---------- per-frame hook (called by the game every frame) ---------- */
let k = 0, stingCd = 6;
let beatT = 0;                                      // (C3c) the heartbeat's timer (Spacious Audio's part declared it at M8; only this hook uses it)
let kStingAt = -1e9, sStingAt = -1e9;              // (R10) when the k sting last played (performance.now(), ms): the Skin-Stealer's does not double it; (R16) and the other way round
const STING_MIX = 1200;
window.__mp = ({ p, cam, sc, run, started, light: lightOn, G, q, los, t }) => {
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);

  /* the halls do not stop for the pause screen: a kill the server has just made starts OUR death sequence at once.  (It is started from the game's fixed-step loop,
   * which does not run while paused, so without this the death would only begin - late, and with its sound suspended - once you closed the pause menu.) */
  { const A = window.__api; if (N.on && me() && mseq() > handled() && A && !A.G.caught && A.paused && A.paused() && A.unpause) A.unpause(); }
  previewTick();
  if (N.on) { applyServerState(t); applyCaught(); if (EN() && window.__api) EN().entAudio(t, hSlots, window.__api.q); }
  else { if (window.__mv && window.__mv.down) unhold(); if (started && !exited()) { soloGlitches(p); soloItems(); } }
  if (run && !exited()) itemsFrame(p);
  humUpdate();
  if (window.__glitchFrame) window.__glitchFrame({ p, cam, sc, los, W, H, t, run: run && !exited() });
  onlineNote(N.on);

  /* --- network send --- */
  const now = performance.now();
  sendPose(now, p, started, lightOn);                                     // (C3c) the session's: our pose every 25 / 50 ms, every 250 ms in the menu
  /* --- other wanderers: real avatars (same look as yours), their own lights, hover name --- */
  drawPeers(p, cam, sc, los, t, W, H);
  if (window.__chatFrame) window.__chatFrame({ p, cam, sc, W, H, run: run && !exited() });   // post-3H Trial 2: F.R.O.N.T.'s speech bubbles, placed with this frame's camera
  /* --- (R10) the Skin-Stealer: only while this page sees one (its own script decides: on screen, in the sight mask, readable) --- */
  const SK = window.__skin && window.__skin.sight ? window.__skin.sight(t, { cam, sc, W, H, run }) : null, ks = SK ? SK.k : 0;
  /* --- dread: proximity to hound + smilers drives heartbeat, drone, vignette, shake, flicker --- */
  let d = 1e9;
  if (run) { d = Math.hypot(G.x - p.x, G.y - p.y); for (const s of q) d = Math.min(d, Math.hypot(s.x - p.x, s.y - p.y)); }
  const target = run ? Math.max(0, Math.min(1, 1 - d / 620)) : 0;
  k += (target - k) * Math.min(1, t * (target > k ? 3 : .8));
  setDrone(k);
  beatT -= t;
  const kb = ks > k ? ks : k;                       // (R10: the heartbeat follows the stronger of the two; with ks 0 it is k's, as it was)
  if (kb > .08 && beatT <= 0) { beatT = .95 - .6 * kb; thump(.5 * kb + .1, 70); setTimeout(() => thump(.35 * kb + .06, 58), 140); }
  fadeHit(t);
  const dv = k < .05 ? 0 : Math.min(1, k * 1.15) * (.75 + .25 * Math.sin(now / (140 - 70 * k)));
  dread.style.opacity = Math.max(dv, hitFlash() * .95);
  game.style.transform = k > .55 ? `translate(${(Math.random() - .5) * k * 5}px,${(Math.random() - .5) * k * 5}px)` : '';
  light.style.opacity = k > .35 && Math.random() < k * .09 ? .35 + Math.random() * .4 : 1;
  stingCd -= t;
  if (k > .45 && stingCd <= 0) { stingCd = 9 + Math.random() * 10; kStingAt = now; if (now - sStingAt > STING_MIX && !(window.__sfx && window.__sfx.play('sting', { vol: Math.min(1, .5 + k) }))) burst(.35, .12 * k); }
  if (SK && SK.sting && now - kStingAt > STING_MIX) { sStingAt = now; if (!(window.__sfx && window.__sfx.play('sting', { vol: Math.min(1, .5 + ks) }))) burst(.35, .12 * ks); }   // (R10) a new sighting of a Skin-Stealer
};
}
/* (C3c) the modules */
const core = mpCore();
const session = bppSession({ core });
const glitch = lostGlitch({ session });
const cartograph = pocketCartograph({ session });
const monsters = naniMonsters({ core, session, glitch, cartograph });
const space = spacePeers({ session, glitch });
const audio = audioDread();
const wanderers = brrWanderers({ session });
const deaths = gibDeaths({ core, session, monsters, wanderers });
const admin = overseerAdmin({ core, session, glitch, cartograph });
mpFrame({ core, session, glitch, cartograph, monsters, audio, deaths, admin });
session.wire({ glitch, cartograph, monsters, space, wanderers, deaths, admin });
})();
