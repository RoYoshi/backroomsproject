/** @part public/mp.js - B++: the session: the WebSocket, window.__net (what the game bundle calls), NEW RUN, the world epoch, the other players' poses; a module: bppSession
 * A module (continuation C3c, M-024): M8's three B++ parts in their order - mp.net.js (window.__net), mp.newrun.js (NEW RUN's state and
 * the server's answers) and mp.transport.js (sending, connecting, every message the server sends) - in one factory, with the state they
 * share as plain variables: the connection, the snapshot and the B+ counters that M8 declared in core's mp.js; B+'s fresher poses
 * (peerPoses, window.__peerNet) and the world epoch (oldWorld, worldNew, window.__epochDebug) that sat in S.P.A.C.E.'s mp.peers.js;
 * the status line's element (core's at M8), and the network send of the per-frame hook (sendPose, core's mp.frame.js at M8).
 * Every message is handled in M8's order, line for line; where a line changed another owner's state it now calls that owner's function
 * (the narrow contract): L.O.S.T.'s exit and walls, P.O.C.K.E.T.'s cartograph, N.A.N.I.'s kill record, slots and held state,
 * S.P.A.C.E.'s solid peers and soft correction, BR-R's avatars, G.I.B.'s replays, bodies, lights and corpse hiding, OVERSEER's admin
 * panel (its state, adm, is OVERSEER's now; the session never reads the passcode). Those modules are made after this one and use it,
 * so the composition hands them over once, through wire(), when every module is made and before the page runs anything (late).
 * What it gives: the facade N, tx, the peers map, and a reader for each value of the session that others use (me() ...).
 * imports: core { lookStr netHist netReset nrButton partList PEER_MODE PEER_SNAP room runMenuWords }
 * late: glitch { doExit noGlitches resetExit soloOff }, cartograph { giveItem noItems },
 *       monsters { announceKill clearKill clearKiller clearSlots entitySignals markKiller noFails unhold },
 *       space { blendTick resolid softCount softTp solidCount solidOff solidPeers stopBlend }, wanderers { dropAvatar },
 *       deaths { applyBodies endAllFx flushSt forgetOwnDeath fxMsg hideCorpse killNoted noPeerLights oldLights showCorpse startFx takeBodies },
 *       admin { adminData adminOffline aresAnswer debugData debugGone kickedShow loginAnswer nrfAnswer pong relogin showMsg unlocked }
 * exports: connected, cpNow, graceUntil, handled, me, mseq, myId, N, nrBusy, nrLast, peers, sendPose, snap, tellId, tx, wire
 * provides: bppSession
 * uses: -
 * writes: -
 */
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
