/** @part public/move.js - Spacious Audio: footsteps by state and surface, slides, vaults, breathing; a module: moveSound
 * A module (continuation C3b, M-024): M8's part inside its factory, moveSound. Its parameter is what it takes from the modules made
 * before it, by giver; its return is what later modules take from it. move.compose.js makes it. Every line is M8's except 2 listed edits
 * (dev/stage-3h-modernization/tools/c3_client_modules.js): the sound module names its sounds (still registered on window, as before); and
 * hands them to the movement module the moment they are registered.
 * imports: move { A clamp mv SURF useSound }
 * exports: -
 * provides: moveSound
 * uses: -
 * writes: -
 */
function moveSound({ move: { A, clamp, mv, SURF, useSound } }) {
/* ---------------------------------------------------------------- sound: footsteps by state and surface, slides, vaults, breathing */
let ctx = null, out = null, noiseBuf = null;
function audio() {
  const a = A(); if (!a || !a.audio) return null; const Z = a.audio(); if (!Z || !Z.context || !Z.gain) return null;
  if (ctx !== Z.context) { ctx = Z.context; out = Z.gain; noiseBuf = null; }
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return Z;
}
const soundOn = () => !(document.getElementById('sound') && /OFF/.test(document.getElementById('sound').textContent));
function noise(dur, type, f, q, vol, atk = .01, pan = 0, when = 0, f2) {
  if (!audio() || !soundOn()) return;
  const t0 = ctx.currentTime + when, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur); fl.Q.value = q;
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + atk); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(fl); fl.connect(g); if (pn) { pn.pan.value = pan; g.connect(pn); pn.connect(out); } else g.connect(out);
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + .05);
}
function thump(f0, f1, dur, vol, when = 0) {
  if (!audio() || !soundOn()) return;
  const t0 = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + .006); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + .02);
}
const mvSfx = window.__mvSfx = {
  slideStart(surf, v) {
    const vol = .05 + .06 * clamp(v / 285, 0, 1), dur = (SURF[surf].slide < 1 ? 1.6 : SURF[surf].slide < 2 ? .9 : .55);
    if (surf === 'wet') { noise(dur, 'bandpass', 1900, .7, vol * 1.5, .03, 0, 0, 900); noise(dur * .8, 'highpass', 3200, .5, vol * .55, .04); }
    else if (surf === 'concrete') { noise(dur, 'bandpass', 1100, 1.1, vol * 1.3, .02, 0, 0, 480); noise(dur * .6, 'lowpass', 520, .7, vol * .6, .02); }
    else { noise(dur, 'lowpass', 760, .6, vol * 1.1, .02, 0, 0, 260); noise(dur * .7, 'bandpass', 2200, .8, vol * .32, .04); }   // cloth on carpet
    thump(70, 42, .12, .06);
  },
  slideEnd() { noise(.16, 'lowpass', 500, .7, .035, .01); },
  vaultStart(q) { noise(.12 + (q === 0 ? .12 : 0), 'bandpass', 900, .9, q === 2 ? .07 : .045, .01); },
  vaultLand(q) { thump(q === 2 ? 95 : 78, 40, .14, q === 2 ? .14 : q === 1 ? .09 : .04); noise(.09, 'lowpass', 700, .8, q === 2 ? .1 : .05, .004); if (q === 2) noise(.14, 'bandpass', 1600, 1, .04, .002, 0, .02); },
  crouchStep(vol, surf) { noise(.09, 'lowpass', surf === 'wet' ? 520 : 300, .7, .035 * vol, .008, (Math.random() - .5) * .2); },
  crawlStep(vol) { noise(.22, 'bandpass', 620, .8, .028 * vol, .05, (Math.random() - .5) * .3, 0, 380); },
  breath(deficit) {
    if (!audio() || !soundOn()) return;
    const d = clamp(deficit, 0, 1), v = .022 + .07 * d, dur = .5 + .35 * (1 - d);
    noise(dur, 'bandpass', 1500 - 500 * d, .6, v, dur * .45, -.05 + Math.random() * .1, 0, 700);                 // inhale
    noise(dur * .9, 'bandpass', 800, .7, v * .8, dur * .25, -.05 + Math.random() * .1, dur * 1.05, 380);       // exhale
  },
};
useSound(mvSfx);                        // (C3b) hands them to the movement module, right after registering them
let lastBreath = 0, stepDist = 0, lastStepPos = null;
/* called every frame in place of Z.footstep */
mv.foot = (Z, surface) => {
  const a = A(), H = a.H, now = performance.now() / 1000, s = mv.s, dist = H.distance;
  if (lastStepPos === null || dist < lastStepPos) lastStepPos = dist;
  const sp = Math.hypot(H.vx, H.vy);
  const wet = mv.surf === 'wet' ? 'wet' : mv.surf === 'concrete' ? 'hollow' : 'carpet';
  if (s === 'walk' || s === 'run') Z.footstep(dist, sp, wet);
  else if (s === 'crouch' && sp > 20 && dist - lastStepPos > 46) { lastStepPos = dist; window.__mvSfx.crouchStep(1, mv.surf); }
  else if (s === 'crawl' && sp > 12 && dist - lastStepPos > 30) { lastStepPos = dist; window.__mvSfx.crawlStep(1); }
  else if (s !== 'walk' && s !== 'run' && s !== 'crouch' && s !== 'crawl') lastStepPos = dist;
  /* breathing: you notice your own stamina long before you read a number */
  const def = clamp(1 - H.stamina / 100, 0, 1), recentRun = now - mv.lastRun < 9;
  const need = H.exhausted ? 1 : (recentRun && H.stamina < 55 ? .35 + (55 - H.stamina) / 90 : 0);
  if (need > 0 && now - lastBreath > 1.55 - .75 * need) { lastBreath = now; window.__mvSfx.breath(need); }
};
}
