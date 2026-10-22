/** @part public/mp.js - core: the per-frame hook the game calls (the network send, the other Wanderers drawn, the dread); a module: mpFrame
 * A module (continuation C3c, M-024): M8's part in its factory, window.__mp, calling each owner in M8's order. Where its lines changed
 * another owner's state at M8 they now ask that owner: the network send is the session's (sendPose, given this frame's moment and the
 * player), the held state is let go by N.A.N.I. (unhold) and its hit flash faded there (fadeHit), the offline cartograph is dropped by
 * P.O.C.K.E.T. (soloItems), the drone's level is set by Spacious Audio (setDrone) and its online note shown there (onlineNote). It reads
 * the session's kill state (me(), mseq(), handled()), L.O.S.T.'s exit flag (exited()) and N.A.N.I.'s hit flash (hitFlash()). The
 * heartbeat's timer (beatT, Spacious Audio's part declared it at M8) is this hook's, the only code that uses it.
 * Trial 3 R10 (dev/trial-3-r9-overhaul/; not owner-approved): the Skin-Stealer's dread, only while this page SEES one - the Skin-Stealer
 * script's own sight() (window.__skin, skin.sight.js) says how strongly (ks) and when a sighting is new (its sting).  The heartbeat beats on
 * max(k, ks); the drone, the vignette, the shake, the flicker and the Hound/Smiler sting stay k's alone, so with no Skin-Stealer in sight
 * (ks 0) every output here is what it was.  A Skin-Stealer sting within STING_MIX of the k sting is not played (one sting, not two) - nor
 * (R16) the k sting within STING_MIX after a Skin-Stealer's (its timer runs on as before).
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
let kStingAt = -1e9, sStingAt = -1e9;              // (R10) when the k sting last played (performance.now(), ms): the Skin-Stealer's does not double it; (R16) and the other way round
let ksLive = 0;                                     // (R17) the Skin-Stealer's level as of the last frame (the second beat reads it then, as it reads k)
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
  const kb = ks > k ? ks : k; ksLive = ks;          // (R10: the heartbeat follows the stronger of the two; with ks 0 it is k's, as it was)
  // (R17: its second beat, 140 ms on, reads the levels then, as R8's read k then - with no Skin-Stealer in sight it is R8's beat to the
  // last digit; R10's took this frame's value, which the gate's client traces caught)
  if (kb > .08 && beatT <= 0) { beatT = .95 - .6 * kb; thump(.5 * kb + .1, 70); setTimeout(() => thump(.35 * (ksLive > k ? ksLive : k) + .06, 58), 140); }
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
