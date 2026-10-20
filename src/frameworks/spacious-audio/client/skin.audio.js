/** @part public/assets/skinstealer.js - Spacious Audio: the Skin-Stealer's sounds (procedural, through the game's own audio); a module: skinAudio
 * Trial 3 (T4).  No sound files: everything is synthesised, through the game's own audio (window.__api.audio(): its context and its
 * master gain, so the master volume and SOUND OFF hold), placed like every other entity sound (distance, pan, a low-pass through a wall).
 *   deathSound(O)              a Skin-Stealer's death, as sfx.js hands it on: our own (no O) or a spectator's (O: the hits, gain, pan and
 *                              low-pass the bundle worked out for the listener) - the grab or the landing, the victim's breath cut short,
 *                              the bites (C); returns true when it played (sfx.js then plays nothing else).
 *   deathEvent(q, jl, S, place) the physics' own snap (dphys.js 'snap'), placed where it happened: a short dry crack.
 * imports: head { API clamp K }
 * exports: -
 * provides: skinAudio
 * uses: -
 * writes: -
 */
function skinAudio({ head: { API, clamp, K } }) {
let ctx = null, out = null, nb = null;
function Z() {
  const A = API(), z = A && A.audio && A.audio(); if (!z || !z.context || !z.gain) return null;
  if (ctx !== z.context) { ctx = z.context; out = z.gain; nb = null; }
  if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return z;
}
const soundOn = () => !(document.getElementById('sound') && /OFF/.test(document.getElementById('sound').textContent));
/* one bus per sound: level, a low-pass (a wall between), pan; disconnected when it has played */
function bus(gain, pan, lp, len) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  g.gain.value = gain; f.type = 'lowpass'; f.frequency.value = lp || 12000; g.connect(f); if (p) { p.pan.value = clamp(pan || 0, -1, 1); f.connect(p); p.connect(out); } else f.connect(out);
  setTimeout(() => { try { g.disconnect(); f.disconnect(); p && p.disconnect(); } catch (e) { } }, (len + .6) * 1000);
  return g;
}
function noise(dst, at, dur, type, f0, f1, q, vol, atk) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = ctx.currentTime + at;
  s.buffer = nb; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f0, t0); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur); fl.Q.value = q;
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + (atk || .004)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(dst); s.start(t0, Math.random() * .5); s.stop(t0 + dur + .05);
}
function tone(dst, at, dur, type, f0, f1, vol, atk) {
  const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + (atk || .004)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g); g.connect(dst); o.start(t0); o.stop(t0 + dur + .05);
}
/* which of its deaths: ours from the death itself; a spectator's from its blows' times (dphys.js PLAN) */
function variantOf(O) {
  const A = API(), D = A && A.death && A.death();
  if (!O && D && D.active && D.kind === 'SkinStealer') return D.variant || 'A';
  const P = window.__dphys && window.__dphys.PLAN, h = O && O.hits;
  if (P && Array.isArray(h)) for (const v of ['A', 'B', 'C']) { const q = P('SkinStealer', v, 40).hits; if (q && q.length === h.length && q.every((x, i) => Math.abs(x - h[i]) < 1e-6)) return v; }
  return 'A';
}
function deathSound(O) {
  if (!soundOn()) return true;                                  // (silence is its sound when the sound is off: nothing else plays)
  if (!Z()) return false;
  const v = variantOf(O), b = bus(O && O.gain != null ? O.gain : 1, O && O.pan || 0, O && O.lp || 12000, 3.6), P = window.__dphys && window.__dphys.PLAN, hits = (O && O.hits) || (P ? P('SkinStealer', v, 40).hits : [.58]);
  if (v === 'B') { tone(b, .12, .22, 'sine', 78, 38, .85, .005); noise(b, .12, .28, 'lowpass', 900, 220, .7, .55, .004); noise(b, .16, .4, 'bandpass', 1600, 700, 1.2, .12, .02); }   // the landing: a body hits the floor
  else { noise(b, .06, .16, 'bandpass', 2200, 1400, 1.4, .22, .006); noise(b, .1, .05, 'highpass', 3000, 0, .7, .18, .002); }                                      // the grab: cloth, skin
  noise(b, .2, .32, 'bandpass', 950, 650, 1.1, .2, .03); noise(b, .55, .2, 'bandpass', 800, 500, 1.3, .1, .02);                                                    // their breath, cut short
  if (v === 'C') for (const t of hits) { noise(b, t, .18, 'bandpass', 700, 260, 1.6, .5, .003); noise(b, t + .02, .1, 'highpass', 2600, 0, .8, .14, .002); tone(b, t, .1, 'sine', 120, 70, .25, .003); }   // the bites: wet, deep
  noise(b, 1.5, .9, 'lowpass', 340, 160, .6, .12, .25);                                                                                                            // its own slow breath out
  return true;
}
/* the snap itself, where the physics says it happened (ents.js's place: distance, pan, a wall between) */
function deathEvent(q, jl, S, place) {
  if (!q || q.k !== 'snap' || !soundOn() || !Z()) return;
  const p = place ? place(q.x, q.y, 140, 1400) : { g: 1, pan: 0, lp: 12000 }; if (p.g < .02) return;
  const b = bus(p.g, p.pan, p.lp, .4);
  noise(b, 0, .025, 'highpass', 3600, 0, .8, .95, .001); noise(b, .004, .07, 'bandpass', 1300, 800, 2.2, .5, .002); tone(b, 0, .09, 'sine', 150, 60, .45, .002);
}
K.deathSound = deathSound;
K.deathEvent = deathEvent;
}
