/** @part public/mp.js - L.O.S.T.: the glitched walls: touching one takes you out of Level 0
 * provides: doExit, soloGlitches
 * uses: N, exited
 * writes: exited
 */
/* ---------- glitched walls: touching one takes you out of Level 0 ---------- */
function doExit(secs) {
  const A = window.__api; if (!A || exited) return; exited = true;
  const box = document.getElementById('wonStats'); if (box) box.textContent = 'Time in Level 0 · ' + Math.floor((secs || 0) / 60) + ':' + String((secs || 0) % 60).padStart(2, '0');
  document.body.classList.add('gl-out');
  if (window.__glitchSound) window.__glitchSound.burst();
  setTimeout(() => { A.win(); document.body.classList.remove('gl-out'); }, 950);
}
N.exitLocal = () => doExit(Math.round(performance.now() / 1000 - (N.t0 || 0)));
/* offline fallback (no server): pick three glitched walls locally and let the player leave through them */
function soloGlitches(p) {
  const A = window.__api; if (!A || !A.zc) return;
  if (window.__glitchSolo !== true) {
    const out = [], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]; N.t0 = performance.now() / 1000;
    for (let t = 0; t < 8000 && out.length < 3; t++) {
      const tx = Math.random() * 96 | 0, ty = Math.random() * 72 | 0; if (!A.zc(tx, ty)) continue;
      const d = dirs[Math.random() * 4 | 0], nx = tx + d[0], ny = ty + d[1]; if (nx < 1 || ny < 1 || nx > 94 || ny > 70 || !A.Hc(nx, ny)) continue;
      const cx = (tx + .5) * 96, cy = (ty + .5) * 96; if (!A.sl(cx, cy)) continue;
      const x = cx + d[0] * 48, y = cy + d[1] * 48;
      if (Math.hypot(x - A.Ic.x, y - A.Ic.y) < 2600 || out.some(o => Math.hypot(o[0] - x, o[1] - y) < 2600)) continue;
      out.push([Math.round(x), Math.round(y), d[0], d[1]]);
    }
    window.__glitches = out; window.__glitchSolo = true;
  }
  for (const g of window.__glitches) if (Math.hypot(p.x - g[0], p.y - g[1]) < 54) { N.exitLocal(); break; }
}

