/** @part public/assets/skinstealer.js - Spacious Audio: the Skin-Stealer's sounds (procedural, through the game's own audio); a module: skinAudio
 * Trial 3 (T4).  No sound files: everything is synthesised, through the game's own audio (window.__api.audio(): its context and its
 * master gain, so the master volume and SOUND OFF hold), placed like every other entity sound (distance, pan, a low-pass through a wall).
 *   deathSound(O)              a Skin-Stealer's death, as sfx.js hands it on: our own (no O) or a spectator's (O: the hits, gain, pan and
 *                              low-pass the bundle worked out for the listener) - the grab or the landing, the victim's breath cut short,
 *                              the bites (C); returns true when it played (sfx.js then plays nothing else).
 *   deathEvent(q, jl, S, place) the physics' own snap (dphys.js 'snap'), placed where it happened: a short dry crack.
 *   (T5) its living sounds, once a frame (lent to the body's draw): soft long footfalls when it moves (quieter and heard less far
 *                              while it stalks: creep, approach), the wind-up's dry clicks and breath (the tell), the leap, the skid
 *                              of a miss, its eating; a breath while it stands still, only close and at most every 25-45 s - never a
 *                              proximity radar.
 * imports: head { API clamp K lend }
 * exports: -
 * provides: skinAudio
 * uses: -
 * writes: -
 */
function skinAudio({ head: { API, clamp, K, lend } }) {
let ctx = null, out = null, nb = null;
function Z() {
  const A = API(), z = A && A.audio && A.audio(); if (!z || !z.context || !z.gain) return null;
  if (ctx !== z.context) { ctx = z.context; out = z.gain; nb = null; }
  if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); let x = 0x5bd1e995; for (let i = 0; i < d.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d[i] = ((x >>> 0) / 4294967296) * 2 - 1; } }   // (T8: its own fixed noise: the page's Math.random is never drawn on)
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
/* which of its deaths: ours from the death itself; a spectator's from its blows' times (dphys.js PLAN; R15: D's own, never taken for A's) */
function variantOf(O) {
  const A = API(), D = A && A.death && A.death();
  if (!O && D && D.active && D.kind === 'SkinStealer') return D.variant || 'A';
  const P = window.__dphys && window.__dphys.PLAN, h = O && O.hits;
  if (P && Array.isArray(h)) for (const v of ['A', 'B', 'C', 'D']) { const q = P('SkinStealer', v, 40).hits; if (q && q.length === h.length && q.every((x, i) => Math.abs(x - h[i]) < 1e-6)) return v; }
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
/* where a sound at (x, y) lands for this listener: distance falloff, pan, a low-pass through a wall (as ents.js places the others) */
function place(x, y, near, far) {
  const A = API(), H = A && A.H; if (!H) return { g: 0, pan: 0, lp: 9000, d: 1e9 };
  const dx = x - H.x, dy = y - H.y, d = Math.hypot(dx, dy), k = clamp((d - near) / (far - near), 0, 1), s = k * k * (3 - 2 * k);
  let g = Math.pow(1 - s, 1.5), lp = 9000;
  if (d > 60 && A.Uc) { const r = A.Uc(H.x, H.y, Math.atan2(dy, dx), d + 1); if (r < d - 30) { g *= .5; lp = 700; } }
  return { d, g, pan: clamp(dx / 520, -1, 1) * .85, lp };
}
/* its sounds while it lives, from what the server says it is doing (act, the ground it covers): never a radar - it is heard when it
 * moves, when it springs, when it eats, and (rarely, close) when it stands still and breathes */
const VO = new Map();                                        // entity id -> { dist, acc, act, br, fd }
function voice(dt, list) {
  if (!list.length) { if (VO.size) VO.clear(); return; }      // (T8) no Skin-Stealer: nothing at all is done (the page's audio and its random stream untouched)
  if (!soundOn() || !Z()) return;
  const seen = new Set();
  for (const o of list) {
    seen.add(o.id);
    let s = VO.get(o.id); if (!s) { s = { dist: o.distance, acc: 0, act: o.act, br: 20 + Math.random() * 20, fd: .5 }; VO.set(o.id, s); }
    const dd = Math.abs(o.distance - s.dist) > 300 ? 0 : o.distance - s.dist; s.dist = o.distance;
    const sp = dd / Math.max(dt, .001), stride = sp > 220 ? 150 : sp > 120 ? 118 : 96;
    // footfalls: a long, padded, bare step - each half stride, heard whether or not it can be seen; placed with care when it stalks
    // (creep, approach): quieter and heard less far, never silent
    const soft = o.act === 'creep' || o.act === 'approach' || !!o.dg;                // (T6: and in a borrowed skin)
    s.acc += dd; while (s.acc >= stride / 2) { s.acc -= stride / 2; if (sp > 25) step(o.x, o.y, sp, soft); }
    if (o.act !== s.act) {
      if (o.act === 'wind') cue(o.x, o.y, 'wind');           // the tell: a dry click in the throat, a sharp breath in
      else if (o.act === 'pounce') cue(o.x, o.y, 'leap');
      else if (o.act === 'recover') cue(o.x, o.y, 'skid');
      s.act = o.act;
    }
    if (o.act === 'feed' && (s.fd -= dt) <= 0) { s.fd = .8 + Math.random() * .7; cue(o.x, o.y, 'feed'); }
    const still = o.act === 'watch' || o.act === 'lure' || o.act === 'wait' || o.act === 'listen';
    s.br -= dt; if (s.br <= 0) { s.br = 25 + Math.random() * 20; if (still) cue(o.x, o.y, 'breath'); }   // at most every 25-45 s, and only close (place: 260 px)
  }
  for (const id of [...VO.keys()]) if (!seen.has(id)) VO.delete(id);
}
function step(x, y, sp, soft) {
  const p = place(x, y, soft ? 80 : 120, soft ? 520 : 950); if (p.g < .02) return;
  const run = clamp((sp - 120) / 150, 0, 1), b = bus(p.g * (.22 + .25 * run) * (soft ? .45 : 1), p.pan, p.lp, .2);
  noise(b, 0, .07 + .03 * run, 'lowpass', 300 + 150 * run, 140, .8, .7, .004); noise(b, .01, .03, 'bandpass', 1800, 1200, 1.4, .12, .002);
}
function cue(x, y, k) {
  const far = { wind: 700, leap: 800, skid: 700, feed: 520, breath: 260 }[k], p = place(x, y, 90, far); if (p.g < .02) return;
  if (k === 'wind') { const b = bus(p.g * .7, p.pan, p.lp, .4); for (let i = 0; i < 3; i++) noise(b, i * .045, .018, 'bandpass', 2600 - i * 200, 0, 6, .55, .001); noise(b, .1, .16, 'bandpass', 1400, 2600, 1.2, .25, .03); }
  else if (k === 'leap') { const b = bus(p.g * .6, p.pan, p.lp, .5); noise(b, 0, .3, 'bandpass', 600, 1800, .9, .35, .02); }
  else if (k === 'skid') { const b = bus(p.g * .5, p.pan, p.lp, .6); noise(b, 0, .45, 'bandpass', 900, 400, 1.6, .3, .02); }
  else if (k === 'feed') { const b = bus(p.g * .4, p.pan, p.lp, .4); noise(b, 0, .16, 'bandpass', 650, 300, 1.8, .45, .01); noise(b, .05, .06, 'highpass', 2400, 0, .9, .1, .003); }
  else if (k === 'breath') { const b = bus(p.g * .35, p.pan, p.lp, 1.6); noise(b, 0, .7, 'bandpass', 500, 350, 1.1, .2, .3); noise(b, .8, .8, 'bandpass', 420, 300, 1.1, .16, .35); }
}
/* R15: the Rend - a wet tearing pull, a heavy split and the halves landing, where the physics tore the body (ents.js's place rules) */
function rend(x, y) {
  if (!soundOn() || !Z()) return;
  const p = place(x, y, 140, 1400); if (p.g < .02) return;
  const b = bus(p.g, p.pan, p.lp, 1.2);
  noise(b, 0, .3, 'bandpass', 500, 1500, 1.2, .55, .03); noise(b, .05, .22, 'bandpass', 1800, 900, 1.6, .3, .02);   // the tearing pull
  tone(b, .16, .18, 'sine', 90, 42, .6, .004); noise(b, .16, .14, 'lowpass', 700, 200, .8, .55, .003);               // the split
  noise(b, .42, .12, 'lowpass', 600, 180, .7, .35, .004); noise(b, .55, .12, 'lowpass', 520, 160, .7, .3, .004);    // the halves come down
}
lend('rend', rend);
lend('audio', voice);
K.deathSound = deathSound;
K.deathEvent = deathEvent;
}
