/** @part public/mp.js - B++: the WebSocket: sending (tx), connecting, and every message the server sends
 * provides: tx
 * uses: EN, N, PEER_MODE, PEER_SNAP, PN, adm, announceKill, applyBodies, blend, bodiesList, cpNow, doExit, dropAvatar, entitySignals,
 *       everConnected, fastAck, fxs, giveItem, hMap, hSlots, handled, kicked, killFx, killSeq, lastK, me, mkAt, mseq, myId, net, netHist,
 *       netReset, nrAnswer, nrBusy, nrButton, nrSent, nrWaitT, oldWorld, peerPoses, peers, peersN, pendSt, relOf, renderAdmin,
 *       renderAdminData, renderStatus, retry, room, sSlot, showMsg, snap, softTp, solidHeld, solidPeers, stNote, startFx, worldNew,
 *       worldW, ws
 * writes: blend, bodiesList, cpNow, everConnected, fastAck, handled, kicked, killSeq, lastK, me, mkAt, mseq, myId, nrBusy, peersN, retry,
 *         snap, solidHeld, worldW, ws
 */
const tx = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function connect() {
  if (location.protocol === 'file:') return;
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + encodeURIComponent(room)); } catch { return; }
  ws.onopen = () => {
    netReset();                                                                // a connection is a new server timeline
    fastAck = false; lastK = -1; if (PEER_MODE === 'bplus') tx({ t: 'caps', fp: 1 });   // Stage 3E-0 (B+): ask for the fresher player poses
    retry = 0; handled = 0; mseq = 0; me = ''; everConnected = true;
    const A = window.__api; if (A && A.started()) tx({ t: 'join' });      // re-enter the world after a reconnect
    if (adm.pass) tx({ t: 'admin', pass: adm.pass });                         // stay unlocked across reconnects (kept in memory only)
    if (N._auth) tx({ t: 'admin', pass: N._auth, quiet: 1 });
  };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'hi') { if (myId && myId !== m.id) window.__hideBodies.delete('r' + myId); myId = m.id; const A = window.__api; if (A) A.H.id = myId; }   // Stage 3D: a new connection is a new owner
    else if (m.t === 'admin' && m.q) { /* a test's quiet unlock: nothing to show */ }
    else if (m.t === 'admin') {
      adm.unlocked = !!m.ok; adm.err = m.ok ? '' : (m.wait ? 'TOO MANY TRIES · WAIT ' + m.wait + 'S' : 'WRONG PASSCODE');
      if (!m.ok) adm.pass = null;
      renderAdmin();
    }
    else if (m.t === 'tp') { const A = window.__api; if (A) { if (m.pc && softTp(A, m.x, m.y)) { } else { blend = null; A.tp(m.x, m.y); } } }   // (Stage 3D HQ2: pc - a soft peer correction, blended)
    else if (m.t === 'caps') fastAck = PEER_MODE === 'bplus' && m.fp === 1;   // Stage 3E-0 (B+): the server does it
    else if (m.t === 'q') peerPoses(m);                                        // Stage 3E-0 (B+): fresher poses of players already known
    else if (m.t === 'world') worldNew(m.w, m.x, m.y);                         // Stage 3D HQ2 (H2-4): an admin world reset - a new world epoch
    else if (m.t === 'revive') { const A = window.__api; A && A.revive(); }
    else if (m.t === 'msg') showMsg(m.text, m.from);
    else if (m.t === 'nrf') { adm.nf = m.on ? 1 : 0; adm.sig = ''; renderAdminData(); }   // Stage 3D HQ3: the server's answer to UNLIMITED NEW RUN ON / OFF
    else if (m.t === 'ares') {                                                // the server's one-line answer to an admin command
      adm.res = { ok: !!m.ok, msg: String(m.msg || ''), at: performance.now() }; renderStatus();
      if (adm.rv && adm.rv.stage === 0) { if (!m.ok) adm.rv = null; else if (adm.opts.close && /^PLAYING/.test(adm.res.msg)) { adm.open = false; renderAdmin(); } }
    }
    else if (m.t === 'pong') { const E = EN(); if (E) { const r = performance.now() - (+m.ts || 0); E.dbgX.ping = E.dbgX.ping < 0 ? r : E.dbgX.ping + (r - E.dbgX.ping) * .3; } }
    else if (m.t === 'kick') { kicked = true; document.getElementById('kicked').hidden = false; }
    else if (m.t === 'bodies') { if (oldWorld(m.w)) return; bodiesList = m.b || []; const tb = performance.now() / 1000; for (const b of bodiesList) if (b && b.de != null && Array.isArray(b.lf) && b.lf.length === 4 && Number.isFinite(b.ag + b.lf[3])) { relOf(b.de, tb - b.ag + b.lf[3]); pendSt.push(['r', b.de, b.ag, b.lf[3]]); } applyBodies(); }   // (HQ1: when each corpse's light was let go)
    else if (m.t === 'fx') { if ((m.k === 'death' || m.k === 'boom') && oldWorld(m.wn)) return; if (((m.k === 'death' && m.id !== myId) || m.k === 'boom') && m.de != null) pendSt.push(['k', m.de, Math.max(0, +m.el || 0)]); startFx(m); }   // (HQ1: when the death began, on the server's clock; HQ2: a NEW RUN blast too)
    else if (m.t === 'exit') doExit(m.secs);
    else if (m.t === 'nra') nrAnswer(m);                                       // Stage 3D HQ2: the server's NEW RUN decision
    else if (m.t === 'got') giveItem(m.item);
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
      if (m.mk && m.ms !== killSeq && !oldWorld(m.w)) { killSeq = m.ms; mkAt = { de: m.mk.de, t: performance.now() / 1000 }; if (m.mk.de != null && m.e && typeof m.e.st === 'number') stNote(m.mk.de, 'k', m.e.st); announceKill(m.mk); }   // who killed us, how, and where the wall is (HQ1: and when, on the server's clock)
      if (m.e) { snap = m.e; N.on = true; entitySignals(m.e); netHist(m.e, now); }
      if (m.e && typeof m.e.st === 'number' && pendSt.length) { for (const q of pendSt) stNote(q[1], q[0], q[0] === 'k' ? m.e.st - q[2] : m.e.st - q[2] + q[3]); pendSt.length = 0; }   // (HQ1: a replay or corpse that came just before this snapshot was sent in its pass)
      if (m.dbg && EN()) { EN().setDebug(m.dbg); if (m.dx) EN().setDebugX(m.dx); }
      if (m.ad) { adm.data = m.ad; adm.you = m.you; adm.nf = m.nf ? 1 : 0; renderAdminData(); }   // (nf: Stage 3D HQ3, every admin snapshot says it again)
    }
  };
  ws.onclose = () => {
    nrSent.clear(); nrBusy = 0; worldW = null; clearTimeout(nrWaitT); nrButton('');   // Stage 3D HQ2: a press without its answer is gone with the connection
    fastAck = false; lastK = -1; solidHeld = null;                               // Stage 3E-0: a new connection asks again
    window.__peerBodies.length = 0; blend = null;                                  // (and nobody to bump into offline)
    netReset(); if (myId) window.__hideBodies.delete('r' + myId);                  // Stage 3D: the old connection's corpse is no longer ours to hide
    for (const f of fxs.splice(0)) killFx(f); N.on = false; snap = null; cpNow = 0; window.__kill = null; window.__glitchSolo = false; window.__glitches = []; window.__items = []; for (const o of peers.values()) dropAvatar(o); peers.clear(); window.__peerLights = []; hMap.clear(); hSlots.fill(null); sSlot.fill(null);
    if (EN()) { EN().clearDebug(); EN().dbgCfg.on = false; EN().drawDebug(); EN().setFails([]); }
    if (window.__mv) { window.__mv.down = 0; window.__mv.dragTo = null; }
    net.textContent = everConnected ? 'SOLO · RECONNECTING' : 'SOLO';
    adm.unlocked = false; adm.dbg = false; adm.nf = 0; renderAdmin();          // (Stage 3D HQ3: UNLIMITED NEW RUN is gone with the connection: a new one starts OFF on the server too)
    if (!kicked) setTimeout(connect, Math.min(8000, 1000 * ++retry));
  };
}
connect();

