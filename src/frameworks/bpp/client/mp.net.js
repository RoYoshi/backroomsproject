/** @part public/mp.js - B++: window.__net, what the game bundle calls (the fixed-step tick, join, respawn, leave, NEW RUN's press)
 * OVERSEER's admin state (adm) and the peers map are declared here too, just before window.__net, as they always were.
 * provides: N, adm, peers
 * uses: applyBodies, blend, blendStep, exited, graceUntil, hMap, handled, me, mseq, myId, nrBusy, nrBusyAt, nrButton, nrQ, nrSent,
 *       nrWaitT, runMenuWords, startFx, tx, worldW, ws
 * writes: exited, graceUntil, handled, nrBusy, nrBusyAt, nrQ, nrWaitT
 */
const adm = { unlocked: false, pass: null, open: false, data: null, you: null, err: '', dbg: false, nf: 0 };   // (Stage 3D HQ3: nf - our own UNLIMITED NEW RUN as the SERVER last said it is: never set from a click)
const peers = new Map();
const N = window.__net = {
  on: false,
  tick() {                                          // called by the game's fixed-step loop while online
    const A = window.__api;
    if (blend && A) blendStep(A);
    if (A && me && mseq > handled && !A.G.caught) {
      handled = mseq; A.G.caught = true; A.G.caughtBy = me;
      if (myId) window.__hideBodies.add('r' + myId);         // Stage 3D: the server's copy of our corpse is not shown while we are still dying (ours replaces it)
      const K = window.__kill; let b = -1;
      if (K && K.slot >= 0) b = K.slot; else { let bd = 1e18; for (const o of hMap.values()) { const d = Math.hypot(o.x - A.H.x, o.y - A.H.y); if (d < bd) { bd = d; b = o.slot; } } }
      window.__killer = me === 'Hound' ? b : -1;             // that hound's own model is replaced by the attack animation
    }
  },
  join() { nrBusy = 0; runMenuWords(false); exited = false; graceUntil = performance.now() / 1000 + 4; window.__kill = null; window.__hideBodies.delete('r' + myId); window.__glitchSolo = false; if (!N.on) { window.__glitches = []; window.__items = []; } tx({ t: 'join' }); setTimeout(applyBodies, 80); },
  respawn() { handled = Math.max(handled, mseq); graceUntil = performance.now() / 1000 + 4; window.__kill = null; window.__hideBodies.delete('r' + myId); tx({ t: 'respawn' }); },
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
