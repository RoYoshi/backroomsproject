/* net-interp.js - the snapshot interpolation of the multiplayer layer (mp.js).
 *
 * Stage 3H0: moved out of mp.js without a change, so the interpolation policy (the server clock offset, the per-entity pose histories, the
 * ~100 ms delayed drawing, the 150 ms extrapolation limit, the 300 px jump rule and the new-timeline reset) lives in one small file.
 * NET is the single state object; mp.js still publishes it as window.__NET and netPose as window.__netPose at the same moment as before, and
 * sets NET.onEpoch (its entity slots belong to the old timeline too).  netPose reads performance.now() when it is called, as before.
 * Loaded by index.html after net-wire.js and immediately before mp.js, as a classic script; its only global is window.__mpLib.interp, which
 * mp.js reads once at start-up.  Never loaded by the server. */
(() => {
/* SNAPSHOT INTERPOLATION (Part 1B).  The server sends ~20 snapshots a second with its own clock (st).  Each entity keeps a short history of them and is
 * drawn ~100 ms in the past, interpolated between the two samples around that moment (shortest-arc facing), so motion is even whatever the packet
 * timing - instead of chasing the newest snapshot (which surged after each packet and stalled when one was late).  If packets stop it extrapolates
 * for at most 150 ms, then holds.  A jump of more than 300 px between samples (respawn / admin move) is never smoothed across. */
const NET = { off: null, hist: new Map(), DELAY: .1, lastSt: null, epoch: 0, onEpoch: null };
/* a new server timeline: a new connection, or a server clock that went backwards (a room thrown away and made again starts its clock at 0 and
 * reuses entity ids).  Everything tied to the old timeline goes: the pose histories (so an id cannot inherit an old pose) and the clock offset. */
function netReset() { NET.off = null; NET.hist.clear(); NET.lastSt = null; NET.epoch++; if (NET.onEpoch) NET.onEpoch(); }
function netHist(e, nowMs) {
  if (typeof e.st !== 'number') return;
  // snapshots arrive in order (one TCP stream) and the clock only moves forward within a world: a step back of more than 0.25 s - or a leap of
  // more than 30 s - is a different world.  Ordinary jitter never does that (it changes arrival times, not the server's clock).
  if (NET.lastSt !== null && (e.st < NET.lastSt - .25 || e.st > NET.lastSt + 30)) netReset();
  NET.lastSt = e.st;
  const arr = nowMs / 1000, smp = e.st - arr;                                // server clock minus our clock, plus this packet's latency
  NET.off = NET.off === null || smp > NET.off ? smp : NET.off - Math.min(.02, NET.off - smp) * .05;    // follow the fastest packets; drift down slowly
  const put = (k, t) => { let h = NET.hist.get(k); if (!h) NET.hist.set(k, h = []); if (h.length && h[h.length - 1].t >= e.st) return; h.push({ t: e.st, x: t.x, y: t.y, a: t.a }); if (h.length > 8) h.shift(); h.seen = e.st; };
  for (const t of e.h || []) put('h' + t.i, t);
  for (const t of e.m || []) put('m' + t.i, t);
  for (const [k, h] of NET.hist) if (e.st - h.seen > 5) NET.hist.delete(k);
}
const angD2 = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return d; };
function netPose(key) {
  const h = NET.hist.get(key); if (!h || !h.length || NET.off === null) return null;
  const rt = performance.now() / 1000 + NET.off - NET.DELAY;
  if (rt <= h[0].t) return h[0];
  for (let i = h.length - 1; i > 0; i--) {
    const a = h[i - 1], b = h[i]; if (rt < a.t) continue;
    if (Math.hypot(b.x - a.x, b.y - a.y) > 300) return rt >= b.t ? b : a;
    if (rt <= b.t) { const u = (rt - a.t) / Math.max(1e-3, b.t - a.t); return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, a: a.a + angD2(b.a, a.a) * u }; }
    const ex = Math.min(rt - b.t, .15), u = ex / Math.max(1e-3, b.t - a.t);                      // past the newest sample: carry on briefly
    return { x: b.x + (b.x - a.x) * u, y: b.y + (b.y - a.y) * u, a: b.a + angD2(b.a, a.a) * Math.min(u, 1) };
  }
  return h[h.length - 1];
}
(window.__mpLib = window.__mpLib || {}).interp = Object.freeze({ NET, netReset, netHist, netPose });
})();
