/** @part public/camcorder.js - Spacious Audio: the camcorder's synthesised sound
 * provides: snd, whine
 * uses: S
 * writes: -
 */
  /* ---------------------------------------------------------------- audio (synthesised) */
  const A = () => { const z = window.__api && window.__api.audio && window.__api.audio(); return z && z.context && z.gain ? z : null; };
  function tone(o) {
    const z = A(); if (!z) return; const c = z.context, t = c.currentTime + (o.at || 0);
    const osc = c.createOscillator(), g = c.createGain(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t); if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.d);
    const v = o.v == null ? .1 : o.v; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.a || .006)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    let n = osc; if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); n = f; }
    n.connect(g); g.connect(z.gain); osc.start(t); osc.stop(t + o.d + .05);
  }
  function noise(o) {
    const z = A(); if (!z) return; const c = z.context, t = c.currentTime + (o.at || 0), len = Math.max(64, c.sampleRate * o.d | 0);
    const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = o.type || 'bandpass'; f.frequency.value = o.f || 2400; f.Q.value = o.q || 1;
    g.gain.value = o.v == null ? .1 : o.v; s.connect(f); f.connect(g); g.connect(z.gain); s.start(t);
  }
  const snd = {
    click(on) { noise({ d: .018, f: on ? 3400 : 2600, q: 3, v: .16 }); tone({ f0: on ? 1900 : 1400, d: .012, v: .03, type: 'square', at: .004 }); },
    soft(on) { noise({ d: .03, f: 1800, q: 1.2, v: .1 }); tone({ f0: on ? 700 : 520, d: .05, v: .03, type: 'triangle' }); },
    thunk(on) { tone({ f0: on ? 180 : 130, f1: 70, d: .11, v: .16, type: 'triangle', lp: 700 }); noise({ d: .04, f: 900, q: .8, v: .09 }); },
    raise() { tone({ f0: 240, f1: 620, d: .3, v: .05, type: 'sawtooth', lp: 900 }); noise({ d: .28, f: 1300, q: .7, v: .04 }); noise({ d: .02, f: 3000, q: 3, v: .12, at: .3 }); },
    lower() { tone({ f0: 620, f1: 220, d: .26, v: .05, type: 'sawtooth', lp: 900 }); noise({ d: .24, f: 1100, q: .7, v: .04 }); noise({ d: .02, f: 2200, q: 3, v: .12, at: .26 }); },
    nvOn() { tone({ f0: 900, f1: 2700, d: .18, v: .07, type: 'sine' }); tone({ f0: 5400, d: .05, v: .012, at: .15 }); noise({ d: .12, f: 5000, q: .6, v: .025 }); },
    nvOff() { tone({ f0: 1900, f1: 520, d: .14, v: .06 }); },
    zoom() { tone({ f0: 340, f1: 470, d: .16, v: .035, type: 'sawtooth', lp: 800 }); },
    shutdown() { tone({ f0: 1200, f1: 50, d: .55, v: .1, type: 'sawtooth', lp: 1800 }); noise({ d: .5, f: 1500, q: .5, v: .12 }); tone({ f0: 90, d: .35, v: .09, type: 'square', at: .1, lp: 300 }); },
    deny() { tone({ f0: 300, d: .09, v: .06, type: 'square', lp: 700 }); tone({ f0: 240, d: .1, v: .06, type: 'square', at: .11, lp: 700 }); },
    ready() { tone({ f0: 1300, d: .07, v: .06 }); tone({ f0: 1950, d: .1, v: .06, at: .09 }); },
    warn() { tone({ f0: 2400, d: .05, v: .03 }); },
  };
  // continuous, quiet instability whine that rises with heat (only past the "noisy" stage)
  function whine(level) {
    const z = A(); if (!z) return;
    if (!S.whine || S.whine.c !== z.context) {
      if (level <= 0) return;
      const c = z.context, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sine'; o.frequency.value = 3600; g.gain.value = 0; lfo.frequency.value = 9; lg.gain.value = 140; lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(z.gain); o.start(); lfo.start(); S.whine = { c, o, g, lfo };
    }
    const w = S.whine, t = w.c.currentTime; w.g.gain.setTargetAtTime(level * .028, t, .12); w.o.frequency.setTargetAtTime(3200 + level * 1400, t, .2);
  }

