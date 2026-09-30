
/* ---------------------------------------------------------------- entity sound (procedural, positional, muffled through walls) */
let actx = null, aout = null, nbuf = null, lastZ = null;
function Zc() {
  const a = API(); if (!a || !a.audio) return null; const Z = a.audio(); if (!Z || !Z.context || !Z.gain) return null;
  if (actx !== Z.context) { actx = Z.context; aout = Z.gain; nbuf = null; }
  if (!nbuf) { nbuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return Z;
}
const soundOn = () => !(document.getElementById('sound') && /OFF/.test(document.getElementById('sound').textContent));
/* where a sound at (x,y) lands: distance falloff, stereo pan, and a low-pass when there is a wall in between */
function place(x, y, near = 120, far = 1500) {
  const a = API(), H = a.H, dx = x - H.x, dy = y - H.y, d = Math.hypot(dx, dy);
  let g = Math.pow(1 - sm(near, far, d), 1.5), lp = 9000;
  if (d > 60 && a.Uc) { const r = a.Uc(H.x, H.y, Math.atan2(dy, dx), d + 1); if (r < d - 30) { g *= .5; lp = 700; } }
  return { d, g, pan: clamp(dx / 520, -1, 1) * .85, lp };
}
function node(dur, o) {
  const c = actx, t0 = c.currentTime + (o.when || 0), g = c.createGain(), pn = c.createStereoPanner ? c.createStereoPanner() : null, lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = o.lp || 9000; g.gain.value = 1;
  const tail = pn ? (pn.pan.value = o.pan || 0, g.connect(lp), lp.connect(pn), pn) : (g.connect(lp), lp);
  tail.connect(aout); return { c, t0, g, out: g, dur, stop: t0 + dur + .08 };
}
function env(g, t0, atk, hold, dur, v) { g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + atk); g.gain.setValueAtTime(v, t0 + atk + hold); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); }
/* a tremble in series with a layer: its level swings between (1 - d) and 1 at f Hz, so the layer's own envelope still fades it all the way out */
function tremble(n, mod) {
  const c = n.c, tg = c.createGain(), l = c.createOscillator(), lg = c.createGain(); tg.gain.value = 1 - mod.d * .5; lg.gain.value = mod.d * .5;
  l.frequency.value = mod.f; l.connect(lg); lg.connect(tg.gain); l.start(n.t0); l.stop(n.stop); return tg;
}
function noiseLayer(n, type, f, q, vol, atk, hold, f2, mod) {
  const c = n.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = nbuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, n.t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, n.t0 + n.dur); fl.Q.value = q;
  env(g, n.t0, atk, hold, n.dur, vol);
  s.connect(fl); let last = fl; if (mod) { const tg = tremble(n, mod); fl.connect(tg); last = tg; }
  last.connect(g); g.connect(n.out); s.start(n.t0, Math.random() * 1.5); s.stop(n.stop);
}
function toneLayer(n, type, f, f2, vol, atk, hold, mod, filt) {
  const c = n.c, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, n.t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, n.t0 + n.dur); env(g, n.t0, atk, hold, n.dur, vol);
  let last = o; if (filt) { const fl = c.createBiquadFilter(); fl.type = filt.type; fl.frequency.value = filt.f; fl.Q.value = filt.q || 1; o.connect(fl); last = fl; }
  if (mod) { const tg = tremble(n, mod); last.connect(tg); last = tg; }
  last.connect(g); g.connect(n.out); o.start(n.t0); o.stop(n.stop);
}
const play = (x, y, vol, dur, build, opt) => {
  if (!soundOn() || !Zc()) return; const p = place(x, y, opt && opt.near, opt && opt.far); if (p.g < .01) return;
  const n = node(dur, { pan: p.pan, lp: Math.min(p.lp, opt && opt.lp || 9000) }); const v = vol * p.g; build(n, v, p);
};

/* hound voice: never a dog.  a wet, low, human-throated rasp with a slow tremble */
E.houndVoice = function (x, y, type, I) {
  I = I === undefined ? .7 : I;
  if (type === 'growl' || type === 'guard') play(x, y, .5 * I + .12, type === 'guard' ? 1.5 : 1.0, (n, v) => {
    toneLayer(n, 'sawtooth', 92, 58, v * .5, .08, .25, { f: 23, d: .55 }, { type: 'lowpass', f: 380, q: 3 });
    toneLayer(n, 'sawtooth', 138, 84, v * .18, .1, .2, { f: 31, d: .6 }, { type: 'bandpass', f: 640, q: 4 });
    noiseLayer(n, 'bandpass', 380, 1.4, v * .55, .05, .3, 200, { f: 19, d: .7 });
  });
  else if (type === 'snarl') play(x, y, .42 * I + .1, .55, (n, v) => {
    noiseLayer(n, 'bandpass', 900, 2.2, v * .8, .02, .12, 380, { f: 27, d: .8 });
    toneLayer(n, 'sawtooth', 120, 70, v * .32, .03, .1, { f: 34, d: .6 }, { type: 'lowpass', f: 520, q: 2 });
  });
  else if (type === 'lungecue') play(x, y, .62 * I + .1, .5, (n, v) => {
    noiseLayer(n, 'bandpass', 500, 1.1, v * .6, .015, .05, 1800);                                        // the sharp intake / hiss
    toneLayer(n, 'sawtooth', 70, 150, v * .5, .04, .16, { f: 26, d: .5 }, { type: 'lowpass', f: 700, q: 2 });
  }, { far: 1700 });
  else if (type === 'kill') play(x, y, .8, 1.3, (n, v) => {
    toneLayer(n, 'sawtooth', 82, 46, v * .55, .05, .5, { f: 21, d: .7 }, { type: 'lowpass', f: 420, q: 3 });
    noiseLayer(n, 'bandpass', 620, 1.2, v * .5, .04, .5, 220, { f: 14, d: .9 });
    noiseLayer(n, 'lowpass', 900, .7, v * .35, .2, .3, 250);
  }, { far: 1900 });
};
/* footfalls: hands and feet landing on damp carpet - a soft thud and a drag */
E.houndStep = function (x, y, spd, limb) {
  const v = clamp(.12 + spd / 420, .1, .62);
  play(x, y, v, .16, (n, vv) => {
    toneLayer(n, 'sine', 78 + Math.random() * 14, 44, vv * .9, .004, .012, null);
    noiseLayer(n, 'bandpass', 1400 + Math.random() * 500, .9, vv * .35, .004, .02, 500);
  }, { far: 1000 });
};
E.houndBreath = function (x, y, hard) {
  play(x, y, .14 + .14 * hard, .55 - .2 * hard, (n, v) => {
    noiseLayer(n, 'bandpass', 460, .8, v, .12, .08, 1100);
    toneLayer(n, 'sawtooth', 58 + hard * 20, 44, v * .12, .1, .1, { f: 18, d: .6 }, { type: 'lowpass', f: 260, q: 2 });
  }, { far: 900 });
};
E.houndScrape = function (x, y) { play(x, y, .3, .5, (n, v) => noiseLayer(n, 'bandpass', 1600, 1.4, v, .05, .2, 700, { f: 9, d: .6 }), { far: 800 }); };

/* smiler: restraint.  almost nothing - a very low swell when the face forms, a wet click, a tone that rises during a rush */
E.smilerVoice = function (x, y, type) {
  if (type === 'form') play(x, y, .3, 1.6, (n, v) => {
    toneLayer(n, 'sine', 58, 49, v * .75, .6, .5, { f: 3, d: .25 });                    // felt more than heard: a swell low enough to sit under everything
    toneLayer(n, 'triangle', 116, 98, v * .2, .7, .4, { f: 3, d: .3 });                  // ... with a thin overtone so small speakers carry it too
    noiseLayer(n, 'bandpass', 3200, 6, v * .08, .5, .3, 2800);
  }, { far: 1100 });
  else if (type === 'click') play(x, y, .18, .09, (n, v) => noiseLayer(n, 'bandpass', 2400, 8, v, .002, .01, 1400), { far: 700 });
  else if (type === 'rush') play(x, y, .5, 1.4, (n, v) => {
    toneLayer(n, 'sawtooth', 55, 165, v * .3, .2, .5, { f: 9, d: .5 }, { type: 'lowpass', f: 500, q: 3 });
    noiseLayer(n, 'bandpass', 900, 2, v * .2, .3, .5, 2600);
  }, { far: 1500 });
  else if (type === 'blackout') play(x, y, .4, .5, (n, v) => {                          // a lamp dying: the ballast's snap and a low thunk
    toneLayer(n, 'sine', 120, 46, v, .004, .07);
    noiseLayer(n, 'bandpass', 2600, 4, v * .5, .002, .012, 700);
  });
};

/* the player being held: the thud of the knock-down, gasps, dragging */
E.sfxKnock = function () {
  if (!soundOn() || !Zc()) return; const n = node(.8, { pan: 0, lp: 3000 });
  toneLayer(n, 'sine', 90, 34, .9, .004, .06); noiseLayer(n, 'lowpass', 700, .8, .6, .004, .05, 180); noiseLayer(n, 'bandpass', 1500, 1, .2, .01, .04, 500);
};
E.sfxGasp = function () { if (!soundOn() || !Zc()) return; const n = node(.6, { pan: 0, lp: 5000 }); noiseLayer(n, 'bandpass', 800, .9, .3, .12, .1, 1900); };
E.sfxRelease = function () { if (!soundOn() || !Zc()) return; const n = node(.7, { pan: 0, lp: 2500 }); toneLayer(n, 'sine', 60, 40, .4, .01, .1); noiseLayer(n, 'bandpass', 500, 1, .22, .06, .1, 900); };

/* per-frame voice of every entity that is near: breathing, footfalls, the smiler's face forming */
const AS = { hb: [0, 0, 0], sb: [], sf: [0, 0, 0, 0, 0], ss: new Map() };
E.entAudio = function (dt, hounds, smilers) {
  const a = API(); if (!a || !soundOn() || !Zc()) return; const H = a.H;
  hounds.forEach((o, i) => {
    if (!o || o.x < -1e4) return; const g = o.__ga || (o.__ga = { br: rnd(0, 1), sc: 0, ph: [0, 0, 0, 0] });
    const d = Math.hypot(o.x - H.x, o.y - H.y);
    // footfalls follow the ground covered (heard whether or not it can be seen): a hand or foot lands every half stride
    const dd = g.dist === undefined || Math.abs(o.distance - g.dist) > 300 ? 0 : o.distance - g.dist; g.dist = o.distance;
    const spd = dd / Math.max(dt, .001), stride = lerp(56, 104, sm(60, 320, spd)) / 2;
    g.acc = (g.acc || 0) + dd; while (g.acc >= stride) { g.acc -= stride; if (d < 1100 && spd > 25) E.houndStep(o.x, o.y, spd, 0); }
    if (d > 1200) return;
    const act = o.act, hunting = o.state === 'HUNTING';
    g.br -= dt; if (g.br <= 0) { g.br = hunting ? rnd(.32, .5) : rnd(1.2, 2.3); E.houndBreath(o.x, o.y, hunting ? 1 : 0); }
    if ((act === 'recover' || act === 'drag') && (g.sc -= dt) <= 0) { g.sc = rnd(.35, .6); E.houndScrape(o.x, o.y); }
  });
  smilers.forEach((s, i) => {
    if (!s || s.off) return; const st = AS.ss.get(s) || (AS.ss.set(s, { f: 0, rush: false, click: 0 }), AS.ss.get(s));
    const f = s.face === undefined ? 0 : s.face, d = Math.hypot(s.x - H.x, s.y - H.y);
    if (d < 1300) {
      if (f > .55 && st.f <= .55) { E.smilerVoice(s.x, s.y, 'form'); E.smilerVoice(s.x, s.y, 'click'); }
      const rush = s.act === 'rush' || s.state === 'PROVOKED'; if (rush && !st.rush) E.smilerVoice(s.x, s.y, 'rush'); st.rush = rush;
    }
    st.f = f;
  });
};
/* touchdowns reported by the gait code */
E.footfall = function (o, spd, limb) { const d = Math.hypot(o.x - API().H.x, o.y - API().H.y); if (d < 1100 && spd > 25) E.houndStep(o.x, o.y, spd, limb); };
