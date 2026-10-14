/** @part public/mp.js - core: the per-frame hook the game calls (the network send, the other Wanderers drawn, the dread); the IIFE closes here
 * provides: -
 * uses: EN, N, ac, adm, applyCaught, applyServerState, beatT, burst, cv, cx, dg, drawPeers, dread, exited, fastAck, game, hSlots,
 *       handled, hitFlash, humUpdate, itemsFrame, lastSend, light, lookStr, me, mseq, net, partList, peersN, previewTick, room,
 *       soloGlitches, soloItem, soundOn, thump, ws
 * writes: beatT, hitFlash, lastSend
 */
/* ---------- per-frame hook (called by the game every frame) ---------- */
let k = 0, stingCd = 6;
window.__mp = ({ p, cam, sc, run, started, light: lightOn, G, q, los, t }) => {
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);

  /* the halls do not stop for the pause screen: a kill the server has just made starts OUR death sequence at once.  (It is started from the game's fixed-step loop,
   * which does not run while paused, so without this the death would only begin - late, and with its sound suspended - once you closed the pause menu.) */
  { const A = window.__api; if (N.on && me && mseq > handled && A && !A.G.caught && A.paused && A.paused() && A.unpause) A.unpause(); }
  previewTick();
  if (N.on) { applyServerState(t); applyCaught(); if (EN() && window.__api) EN().entAudio(t, hSlots, window.__api.q); }
  else { if (window.__mv && window.__mv.down) { window.__mv.down = 0; window.__mv.dragTo = null; } if (started && !exited) { soloGlitches(p); if (!(window.__items && window.__items.length) && window.__itemSolo !== true) soloItem(); } }
  if (run && !exited) itemsFrame(p);
  humUpdate();
  if (window.__glitchFrame) window.__glitchFrame({ p, cam, sc, los, W, H, t, run: run && !exited });
  const note = document.getElementById('onlineNote'); if (note) note.hidden = !N.on;

  /* --- network send --- */
  const now = performance.now();
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
    net.textContent = N.on ? 'ONLINE · ROOM ' + room.toUpperCase() + ' · ' + (peersN + 1) + ' WANDERER' + (peersN ? 'S' : '') + ' · SHARED MONSTERS' + (adm.unlocked ? ' · ADMIN' : '')
                           : 'CONNECTING…';
  }
  /* --- other wanderers: real avatars (same look as yours), their own lights, hover name --- */
  drawPeers(p, cam, sc, los, t, W, H);
  /* --- dread: proximity to hound + smilers drives heartbeat, drone, vignette, shake, flicker --- */
  let d = 1e9;
  if (run) { d = Math.hypot(G.x - p.x, G.y - p.y); for (const s of q) d = Math.min(d, Math.hypot(s.x - p.x, s.y - p.y)); }
  const target = run ? Math.max(0, Math.min(1, 1 - d / 620)) : 0;
  k += (target - k) * Math.min(1, t * (target > k ? 3 : .8));
  if (dg && ac) dg.gain.value = soundOn() ? k * k * .16 : 0;
  beatT -= t;
  if (k > .08 && beatT <= 0) { beatT = .95 - .6 * k; thump(.5 * k + .1, 70); setTimeout(() => thump(.35 * k + .06, 58), 140); }
  hitFlash = Math.max(0, hitFlash - t * 1.6);
  const dv = k < .05 ? 0 : Math.min(1, k * 1.15) * (.75 + .25 * Math.sin(now / (140 - 70 * k)));
  dread.style.opacity = Math.max(dv, hitFlash * .95);
  game.style.transform = k > .55 ? `translate(${(Math.random() - .5) * k * 5}px,${(Math.random() - .5) * k * 5}px)` : '';
  light.style.opacity = k > .35 && Math.random() < k * .09 ? .35 + Math.random() * .4 : 1;
  stingCd -= t;
  if (k > .45 && stingCd <= 0) { stingCd = 9 + Math.random() * 10; if (!(window.__sfx && window.__sfx.play('sting', { vol: Math.min(1, .5 + k) }))) burst(.35, .12 * k); }
};
})();
