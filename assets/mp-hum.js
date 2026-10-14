/* mp-hum.js - the fluorescent light hum of the multiplayer layer (mp.js): a synthesized magnetic ballast on the game's own audio context.
 *
 * Stage 3H2 (C-4): moved out of mp.js without a change (B++ mp.js lines 887-984, as they were):
 *   humUpdate()          called by mp.js's per-frame hook: builds the hum on the game's audio context the first time (again if that
 *                        context changes), then sets its level, pan, flicker, dips, crackles, blackout drop-out and strike-back from
 *                        the player's distance to the nearest fixture; a user-supplied hum file (window.__sfx) replaces it
 *   buildHum(ctx, dest)  the hum's graph on any audio context (mp.js's __net.testHum renders it offline for the tests)
 * Its state - the hum, the blackout it last saw, the next crackle and dip, the flicker's phase - is its own, as it was; it reads
 * window.__api and window.__sfx when it is called, exactly as it did inside mp.js, and draws Math.random in the same order.  Nothing
 * happens at load but defining these.
 * Loaded by index.html after net-newrun.js, before net-wire.js and net-interp.js, as a classic script; its only global is
 * window.__mpLib.hum, which mp.js reads once at start-up.  Never loaded by the server. */
(() => {
/* ---------- fluorescent light hum ---------- */
/* Modelled on an old magnetic ballast: a 60 Hz mains buzz that is strongest at 120 Hz with a long tail of
 * harmonics, two slightly detuned copies beating slowly, a band of arc hiss chopped at 120 Hz, and a very
 * faint high whine. It is loudest near ceiling fixtures (and pans toward the nearest one), stutters with the
 * flickering fixtures, pops and crackles at random, and drops out with a thunk when a blackout hits and
 * comes back with a ballast-strike stutter. All levels are pre-master (the game's master gain is 0.14). */
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function buildHum(ctx, dest) {
  const out = ctx.createGain(); out.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) { out.connect(pan); pan.connect(dest); } else out.connect(dest);
  const src = [];
  const amps = [0, .42, 1, .5, .62, .24, .34, .12, .18, .07];              // harmonics 1..9 of 60 Hz
  const wave = ctx.createPeriodicWave(new Float32Array(amps.length), Float32Array.from(amps));
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = .4;
  const buzz = ctx.createGain(); buzz.gain.value = .2; lp.connect(buzz); buzz.connect(out);
  for (const f of [60.0, 60.42]) {                                          // slow beating between the two
    const o = ctx.createOscillator(); o.setPeriodicWave(wave); o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = .5; o.connect(g); g.connect(lp); src.push(o);
  }
  const lfo = ctx.createOscillator(); lfo.frequency.value = .23;            // the buzz slowly breathes
  const lfoG = ctx.createGain(); lfoG.gain.value = .02; lfo.connect(lfoG); lfoG.connect(buzz.gain); src.push(lfo);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;      // arc hiss, chopped at 120 Hz
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3100; bp.Q.value = .8;
  const hiss = ctx.createGain(); hiss.gain.value = .05;
  const am = ctx.createOscillator(); am.frequency.value = 120; const amG = ctx.createGain(); amG.gain.value = .05;
  am.connect(amG); amG.connect(hiss.gain); ns.connect(bp); bp.connect(hiss); hiss.connect(out); src.push(am);
  const wh = ctx.createOscillator(); wh.frequency.value = 9300;             // faint ballast whine, drifting
  const whG = ctx.createGain(); whG.gain.value = .0022; wh.connect(whG); whG.connect(out);
  const dr = ctx.createOscillator(); dr.frequency.value = .07; const drG = ctx.createGain(); drG.gain.value = 40;
  dr.connect(drG); drG.connect(wh.frequency); src.push(wh, dr);
  src.forEach(o => o.start()); ns.start();
  return { ctx, dest, out, pan, buzz, hiss };
}
function humPop(h, vol, when) {                                              // tiny electrical crackle
  const c = h.ctx, len = Math.floor(c.sampleRate * (.006 + Math.random() * .02));
  const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * .25));
  const s = c.createBufferSource(); s.buffer = b;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900 + Math.random() * 1400;
  const g = c.createGain(); g.gain.value = vol; s.connect(hp); hp.connect(g); g.connect(h.out); s.start(when ?? c.currentTime);
}
function humThunk(h, when) {                                                 // relay / ballast dropping out
  const c = h.ctx, o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(95, when); o.frequency.exponentialRampToValueAtTime(30, when + .35);
  g.gain.setValueAtTime(.55, when); g.gain.exponentialRampToValueAtTime(.001, when + .4);
  o.connect(g); g.connect(h.dest); o.start(when); o.stop(when + .42);
}
function humTink(h, when) {                                                  // starter strike: click + short ring
  const c = h.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(1350, when); o.frequency.exponentialRampToValueAtTime(900, when + .05);
  g.gain.setValueAtTime(.09, when); g.gain.exponentialRampToValueAtTime(.001, when + .07);
  o.connect(g); g.connect(h.dest); o.start(when); o.stop(when + .08);
  humPop(h, .9, when);
}
let hum = null, prevBo = false, holdUntil = 0, nextPopT = 0, nextDip = 8, dipEnd = 0, lastFlick = 1;
function humUpdate() {
  const A = window.__api; if (!A || !A.audio || !A.lamps) return;
  const Z = A.audio(); if (!Z || !Z.context || !Z.gain) return;
  if (!hum || hum.ctx !== Z.context) hum = buildHum(Z.context, Z.gain);
  const c = hum.ctx, now = c.currentTime, tt = performance.now() / 1000, bo = !!A.V.blackout, P = A.H;
  let d = 1e9, li = -1;
  for (let i = 0; i < A.lamps.length; i++) { const dd = Math.hypot(A.lamps[i].x - P.x, A.lamps[i].y - P.y); if (dd < d) { d = dd; li = i; } }
  let level = bo ? .025 : .34 + .66 * (1 - smooth(70, 640, d));             // whole level hums; near a fixture it roars
  const near = !bo && li >= 0 && li % 13 === 0 && d < 520;                   // the game's flickering fixtures
  if (near) {
    const sn = Math.sin(tt * 11 + li); level *= .5 + .5 * Math.max(0, sn);
    if ((sn > .02) !== (lastFlick > .02)) humPop(hum, .7, now);
    lastFlick = sn;
  }
  if (!bo && tt > nextDip) { nextDip = tt + 9 + Math.random() * 18; dipEnd = tt + .06 + Math.random() * .12; }   // ballast struggling
  if (tt < dipEnd) level *= .3;
  const F = window.__sfx;
  if (F && F.has('hum')) {                                                   // user-supplied hum replaces the synthesized one
    hum.out.gain.setTargetAtTime(0, now, .05);
    if (bo !== prevBo) { prevBo = bo; if (F.has('blackout')) F.play('blackout'); }
    F.loop('hum', bo ? .03 : Math.min(1, level), bo || li < 0 ? 0 : Math.max(-.7, Math.min(.7, (A.lamps[li].x - P.x) / 450)));
    return;
  }
  if (bo !== prevBo) {
    prevBo = bo; const g = hum.out.gain; g.cancelScheduledValues(now);
    if (bo) { g.setTargetAtTime(.02, now, .04); humThunk(hum, now); humPop(hum, .8, now); holdUntil = now + .4; }
    else {
      const L = .34 + .66 * (1 - smooth(70, 640, d)); g.setValueAtTime(.02, now);
      for (const [t, v] of [[.05, .7], [.09, .05], [.15, .9], [.2, .12], [.3, 1.15], [.6, 1]]) g.linearRampToValueAtTime(Math.min(1.2, v * L), now + t);
      humTink(hum, now + .05); humTink(hum, now + .15); humPop(hum, .6, now + .3); holdUntil = now + .65;
    }
  }
  if (now >= holdUntil) hum.out.gain.setTargetAtTime(level, now, .06);
  if (hum.pan) hum.pan.pan.setTargetAtTime(bo || li < 0 ? 0 : Math.max(-.7, Math.min(.7, (A.lamps[li].x - P.x) / 450)), now, .15);
  if (now >= nextPopT) {
    humPop(hum, (bo ? .15 : .5) * (.5 + Math.random()), now);
    if (Math.random() < .25) humPop(hum, .3 * Math.random(), now + .03 + Math.random() * .06);
    nextPopT = now + (bo ? 3 + Math.random() * 6 : near ? .18 + Math.random() * .5 : 1.4 + Math.random() * 5.5);
  }
}
(window.__mpLib = window.__mpLib || {}).hum = Object.freeze({ buildHum, humUpdate });
})();
