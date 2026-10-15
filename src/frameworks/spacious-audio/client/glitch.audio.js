/** @part public/glitch.js - Spacious Audio: the glitched walls' sound, crackling digital static; a module: glitchAudio
 * A module (continuation C3b, M-024): M8's part inside its factory, glitchAudio. Its parameter is what it takes from the modules made
 * before it, by giver; its return is what later modules take from it. glitch.compose.js makes it. Every line is M8's.
 * imports: -
 * exports: updateSnd
 * provides: glitchAudio
 * uses: -
 * writes: -
 */
  function glitchAudio() {
  /* ---------- audio: crackling digital static, louder and more chaotic as you get close ---------- */
  let snd = null;
  function buildSnd(z) {
    const c = z.context, out = c.createGain(); out.gain.value = 0;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null; if (pan) { out.connect(pan); pan.connect(z.gain); } else out.connect(z.gain);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0);
    let hold = 0, v = 0;
    for (let i = 0; i < d.length; i++) { if (i % 9 === 0) { hold = Math.random() < .5 ? Math.random() * 2 - 1 : 0; } v += (hold - v) * .5; d[i] = v; }      // sample-and-hold crush
    const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = .9;
    const am = c.createGain(); am.gain.value = .5;
    const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 7; const lg = c.createGain(); lg.gain.value = .5; lfo.connect(lg); lg.connect(am.gain);
    ns.connect(bp); bp.connect(am); am.connect(out); ns.start(); lfo.start();
    const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 55; const hg = c.createGain(); hg.gain.value = .08;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; hum.connect(lp); lp.connect(hg); hg.connect(out); hum.start();
    return { c, out, pan, bp, lfo, hum, z, next: 0 };
  }
  function zap(s, big) {                                   // short chirp / stutter
    const c = s.c, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f0 = 200 + Math.random() * 2600;
    o.type = Math.random() < .5 ? 'square' : 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(60, f0 * (Math.random() < .5 ? .15 : 4)), t + .08 + Math.random() * .1);
    g.gain.setValueAtTime(big ? .5 : .16, t); g.gain.exponentialRampToValueAtTime(.001, t + .14);
    o.connect(g); g.connect(s.out); o.start(t); o.stop(t + .16);
  }
  window.__glitchSound = { burst() { const z = window.__api && window.__api.audio && window.__api.audio(); if (!z || !z.context) return; if (!snd || snd.c !== z.context) snd = buildSnd(z); snd.out.gain.cancelScheduledValues(0); snd.out.gain.value = 1.2; for (let i = 0; i < 9; i++) setTimeout(() => zap(snd, true), i * 90); setTimeout(() => { snd.out.gain.value = 0; }, 1100); } };
  function updateSnd(near, panv, t) {
    const z = window.__api && window.__api.audio && window.__api.audio(); if (!z || !z.context || !z.gain) return;
    if (!snd || snd.c !== z.context) snd = buildSnd(z);
    const c = snd.c, now = c.currentTime;
    const lvl = near > 0 ? Math.pow(near, 1.6) * .55 : 0;
    snd.out.gain.setTargetAtTime(lvl, now, .12);
    if (snd.pan) snd.pan.pan.setTargetAtTime(panv, now, .2);
    snd.lfo.frequency.setTargetAtTime(5 + near * 22, now, .2);
    snd.bp.frequency.setTargetAtTime(1200 + near * 3400, now, .2);
    if (near > .1 && now > snd.next) { zap(snd, false); snd.next = now + (.5 - near * .42) * (.4 + Math.random()); }
  }


  return { updateSnd };
  }
