/* Glitched walls: the way out of Level 0.
   Draws each glitched wall on its own canvas ABOVE the darkness (so it glows through the dark, but only while it is
   in line of sight), adds a static-y audio cue that swells as you approach, and a screen tear when you get close.
   Positions come from mp.js (window.__glitches = [[x, y, nx, ny], ...] where (nx, ny) points into the wall). */
(() => {
  const cv = Object.assign(document.createElement('canvas'), { id: 'glitchFx' }), cx = cv.getContext('2d');
  document.body.appendChild(cv);
  const fx = Object.assign(document.createElement('div'), { id: 'glitchTear' }); document.body.appendChild(fx);
  const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const NEAR = 620, TOUCH = 54;

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

  /* ---------- drawing ---------- */
  let W = 0, H = 0, dpr = 1;
  function drawWall(g, p, cam, sc, t, los) {
    const [wx, wy, nx, ny] = g, dx = wx - p.x, dy = wy - p.y, d = Math.hypot(dx, dy);
    if (d > NEAR + 300) return 0;
    if (d > 60 && los && los(p.x, p.y, Math.atan2(dy, dx), d) < d - 26) return 0;          // needs a line of sight
    const near = Math.max(0, Math.min(1, 1 - (d - 90) / NEAR));                              // 0 far .. 1 touching
    const sx = W / 2 + (wx - cam.x) * sc, sy = H / 2 + (wy - cam.y) * sc, tx = -ny, ty = nx;  // tangent along the wall
    const step = Math.floor(t * 12), R = rnd(step * 7919 + (wx | 0) * 31 + (wy | 0)), R2 = rnd(step * 104729 + 17);
    const len = 96 * sc, depth = 26 * sc, a = .35 + near * .65;
    cx.save(); cx.translate(sx, sy);
    cx.globalCompositeOperation = 'source-over';
    // dark, torn base into the wall
    cx.fillStyle = `rgba(4,8,10,${.55 * a})`;
    cx.beginPath(); cx.moveTo(tx * len / 2, ty * len / 2); cx.lineTo(-tx * len / 2, -ty * len / 2); cx.lineTo(-tx * len / 2 + nx * depth, -ty * len / 2 + ny * depth); cx.lineTo(tx * len / 2 + nx * depth, ty * len / 2 + ny * depth); cx.closePath(); cx.fill();
    cx.globalCompositeOperation = 'lighter';
    const N = 16;
    for (let i = 0; i < N; i++) {                          // displaced slices, RGB-split
      const u = (i / N - .5) * len, w = len / N * (.6 + R() * .9), depthI = depth * (.25 + R() * .85), off = (R() - .5) * 20 * sc * (R() < .3 ? 2.2 : 1);
      const col = R();
      const rgb = col < .34 ? '255,60,90' : col < .68 ? '60,240,255' : '235,255,250';
      const ax = tx * (u + off), ay = ty * (u + off);
      cx.fillStyle = `rgba(${rgb},${(.10 + R() * .38) * a})`;
      cx.save(); cx.translate(ax, ay); cx.transform(tx, ty, nx, ny, 0, 0); cx.fillRect(0, 0, w, depthI); cx.restore();
      if (R() < .35) { cx.strokeStyle = `rgba(${rgb},${.6 * a})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(ax + nx * depthI * .5, ay + ny * depthI * .5); cx.lineTo(ax + nx * depthI * .5 + tx * w * 2.4, ay + ny * depthI * .5 + ty * w * 2.4); cx.stroke(); }
    }
    for (let i = 0; i < 9; i++) {                          // pixels leaking out of the wall into the room
      const u = (R() - .5) * len, out = (R() * 26 + ((t * 30 + i * 13) % 26)) * sc, s = (2 + R() * 4) * sc;
      cx.fillStyle = `rgba(${R() < .5 ? '90,250,255' : '255,90,150'},${(.25 + R() * .5) * a})`;
      cx.fillRect(tx * u - nx * out - s / 2, ty * u - ny * out - s / 2, s, s);
    }
    if (R2() < .16 + near * .3) {                          // a bright horizontal tear
      cx.fillStyle = `rgba(255,255,255,${.35 * a})`; const u = (R2() - .5) * len; cx.save(); cx.translate(tx * u, ty * u); cx.transform(tx, ty, nx, ny, 0, 0); cx.fillRect(-len * .2, R2() * depth, len * .5, 2 * sc); cx.restore();
    }
    // soft glow spilling into the room so it reads from a distance
    const gr = cx.createRadialGradient(-nx * 30 * sc, -ny * 30 * sc, 2, -nx * 30 * sc, -ny * 30 * sc, 150 * sc);
    gr.addColorStop(0, `rgba(80,240,255,${.22 * a})`); gr.addColorStop(.6, `rgba(255,60,140,${.06 * a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = gr; cx.fillRect(-160 * sc, -160 * sc, 320 * sc, 320 * sc);
    cx.restore();
    return { near, d, dx, dy };
  }
  window.__glitchFrame = ({ p, cam, sc, los, W: w, H: h, t, run }) => {
    dpr = devicePixelRatio || 1; W = w; H = h;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    const list = window.__glitches || [];
    let best = null;
    if (run || document.body.classList.contains('gl-out')) {
      const time = performance.now() / 1000;
      for (const g of list) { const r = drawWall(g, p, cam, sc, time, los); if (r && (!best || r.near > best.near)) best = r; }
    }
    const near = best ? best.near : 0;
    updateSnd(run ? near : 0, best ? Math.max(-.8, Math.min(.8, best.dx / 400)) : 0, t);
    fx.style.opacity = near > .45 ? Math.min(.9, (near - .45) * 1.6) : 0;
  };
})();
