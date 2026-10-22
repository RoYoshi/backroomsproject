/** @part public/mp.js - core: the per-frame hook the game calls (the network send, the other Wanderers drawn, the dread); a module: mpFrame
 * A module (continuation C3c, M-024): M8's part in its factory, window.__mp, calling each owner in M8's order. Where its lines changed
 * another owner's state at M8 they now ask that owner: the network send is the session's (sendPose, given this frame's moment and the
 * player), the held state is let go by N.A.N.I. (unhold) and its hit flash faded there (fadeHit), the offline cartograph is dropped by
 * P.O.C.K.E.T. (soloItems), the drone's level is set by Spacious Audio (setDrone) and its online note shown there (onlineNote). It reads
 * the session's kill state (me(), mseq(), handled()), L.O.S.T.'s exit flag (exited()) and N.A.N.I.'s hit flash (hitFlash()). The
 * heartbeat's timer (beatT, Spacious Audio's part declared it at M8) is this hook's, the only code that uses it.
 * imports: core { cv cx dread EN game humUpdate light }, session { handled me mseq N sendPose }, glitch { exited soloGlitches },
 *          cartograph { itemsFrame soloItems }, monsters { applyCaught applyServerState fadeHit hitFlash hSlots unhold },
 *          audio { burst onlineNote setDrone thump }, deaths { drawPeers }, admin { previewTick }
 * exports: -
 * provides: mpFrame
 * uses: -
 * writes: -
 */
function mpFrame({ core: { cv, cx, dread, EN, game, humUpdate, light }, session: { handled, me, mseq, N, sendPose }, glitch: { exited, soloGlitches }, cartograph: { itemsFrame, soloItems },
  monsters: { applyCaught, applyServerState, fadeHit, hitFlash, hSlots, unhold }, audio: { burst, onlineNote, setDrone, thump }, deaths: { drawPeers }, admin: { previewTick } }) {
/* ---------- per-frame hook (called by the game every frame) ---------- */
let k = 0, stingCd = 6;
let beatT = 0;                                      // (C3c) the heartbeat's timer (Spacious Audio's part declared it at M8; only this hook uses it)
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
  /* --- dread: proximity to hound + smilers drives heartbeat, drone, vignette, shake, flicker --- */
  let d = 1e9;
  if (run) { d = Math.hypot(G.x - p.x, G.y - p.y); for (const s of q) d = Math.min(d, Math.hypot(s.x - p.x, s.y - p.y)); }
  const target = run ? Math.max(0, Math.min(1, 1 - d / 620)) : 0;
  k += (target - k) * Math.min(1, t * (target > k ? 3 : .8));
  setDrone(k);
  beatT -= t;
  if (k > .08 && beatT <= 0) { beatT = .95 - .6 * k; thump(.5 * k + .1, 70); setTimeout(() => thump(.35 * k + .06, 58), 140); }
  fadeHit(t);
  const dv = k < .05 ? 0 : Math.min(1, k * 1.15) * (.75 + .25 * Math.sin(now / (140 - 70 * k)));
  dread.style.opacity = Math.max(dv, hitFlash() * .95);
  game.style.transform = k > .55 ? `translate(${(Math.random() - .5) * k * 5}px,${(Math.random() - .5) * k * 5}px)` : '';
  light.style.opacity = k > .35 && Math.random() < k * .09 ? .35 + Math.random() * .4 : 1;
  stingCd -= t;
  if (k > .45 && stingCd <= 0) { stingCd = 9 + Math.random() * 10; if (!(window.__sfx && window.__sfx.play('sting', { vol: Math.min(1, .5 + k) }))) burst(.35, .12 * k); }
};
}
