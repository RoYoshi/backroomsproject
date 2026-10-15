/** @part public/mp.js - L.O.S.T.: the glitched walls: touching one takes you out of Level 0; a module: lostGlitch
 * A module (continuation C3c, M-024): M8's part in its factory, with the walls' state made its own: the exit flag (exited, core's at
 * M8: the session's join now calls resetExit) and every write of the walls' globals (window.__glitches, window.__glitchSolo), which the
 * session (join, a closed connection) and N.A.N.I.'s mirror of the server's state made themselves at M8 and now ask for (noGlitches,
 * soloOff, glitchesFrom). OVERSEER's place-finder reads the walls through glitches(). It still adds N.exitLocal to the session's
 * window.__net, at the same moment as before.
 * imports: session { N }
 * exports: doExit, exited, glitches, glitchesFrom, noGlitches, resetExit, soloGlitches, soloOff
 * provides: lostGlitch
 * uses: -
 * writes: -
 */
function lostGlitch({ session: { N } }) {
/* ---------- glitched walls: touching one takes you out of Level 0 ---------- */
let exited = false;                                   // (C3c) out through a glitched wall (core's at M8; the session's join puts it back)
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
/* (C3c) the walls' state is this module's: the others read it and ask for its changes */
const resetExit = () => { exited = false; };
const soloOff = () => { window.__glitchSolo = false; };
const noGlitches = () => { window.__glitches = []; };
const glitchesFrom = gw => { window.__glitches = gw || []; };          // the server's walls, from each snapshot (N.A.N.I.'s mirror)
return { doExit, exited: () => exited, glitches: () => window.__glitches, glitchesFrom, noGlitches, resetExit, soloGlitches, soloOff };
}
