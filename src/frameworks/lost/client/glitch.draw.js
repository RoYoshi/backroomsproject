/** @part public/glitch.js - L.O.S.T.: the glitched walls drawn; a module: glitchDraw
 * A module (continuation C3b, M-024): M8's part inside its factory, glitchDraw. Its parameter is what it takes from the modules made
 * before it, by giver; its return is what later modules take from it. glitch.compose.js makes it. Every line is M8's.
 * imports: walls { cv cx fx NEAR rnd }, audio { updateSnd }
 * exports: -
 * provides: glitchDraw
 * uses: -
 * writes: -
 */
  function glitchDraw({ walls: { cv, cx, fx, NEAR, rnd }, audio: { updateSnd } }) {
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
  /* the cartograph lying on the floor: a small device that hums with its own faint light, so it can be spotted in the dark */
  function drawItem(it, p, cam, sc, t, los) {
    const dx = it[0] - p.x, dy = it[1] - p.y, d = Math.hypot(dx, dy);
    if (d > 640) return;
    if (d > 60 && los && los(p.x, p.y, Math.atan2(dy, dx), d) < d - 26) return;
    const sx = W / 2 + (it[0] - cam.x) * sc, sy = H / 2 + (it[1] - cam.y) * sc, a = (1 - d / 640) * .8 + .15, fl = .75 + .25 * Math.sin(t * 9 + it[0]) * Math.sin(t * 3.1);
    cx.save(); cx.translate(sx, sy); cx.scale(sc, sc);
    const gr = cx.createRadialGradient(0, 0, 2, 0, 0, 46); gr.addColorStop(0, `rgba(190,255,220,${.30 * a * fl})`); gr.addColorStop(1, 'rgba(190,255,220,0)'); cx.fillStyle = gr; cx.fillRect(-50, -50, 100, 100);
    cx.rotate(.5);
    cx.fillStyle = `rgba(40,42,32,${.95 * a})`; cx.strokeStyle = `rgba(8,8,6,${a})`; cx.lineWidth = 1.4; cx.beginPath(); cx.roundRect(-8, -11, 16, 22, 3); cx.fill(); cx.stroke();
    cx.fillStyle = `rgba(6,16,10,${a})`; cx.fillRect(-6, -9, 12, 12);
    const j = Math.floor(t * 5), r = k => { const x = Math.sin(k * 12.9 + j * 4.1 + it[1]) * 43758.5; return x - Math.floor(x); };
    cx.strokeStyle = `rgba(220,210,130,${.9 * a * fl})`; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(-5 + r(1), -7); cx.lineTo(1 + r(2), -7 + r(3)); cx.lineTo(1, 0); cx.lineTo(5, r(4)); cx.stroke();
    cx.fillStyle = `rgba(255,80,70,${a * (Math.sin(t * 6) > 0 ? 1 : .25)})`; cx.fillRect(2, 6, 2, 2);
    cx.restore();
    if (Math.random() < .25) { cx.fillStyle = `rgba(140,255,230,${.5 * a})`; cx.fillRect(sx + (Math.random() - .5) * 40 * sc, sy + (Math.random() - .5) * 30 * sc, 3 * sc, 1.5 * sc); }
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
    if (run) for (const it of (window.__items || [])) drawItem(it, p, cam, sc, performance.now() / 1000, los);
    const near = best ? best.near : 0;
    updateSnd(run ? near : 0, best ? Math.max(-.8, Math.min(.8, best.dx / 400)) : 0, t);
    fx.style.opacity = near > .45 ? Math.min(.9, (near - .45) * 1.6) : 0;
  };
  }
