/* Stage 3B pillar LOS - the pillar's hidden wedge as the real client draws it, while circling and strafing past a PILLAR
 * HALL pillar (development only; never served).
 *
 *   node dev/stage-3b-pillar-los/look_los.js [--game PATH] [--port 9491] [--out DIR] [--quality medium]
 *        [--orbit DEG0] [--strafe X0] [--sets orbit,strafe,close,diag]
 *
 * 1920x1080 (the accepted 1.25 camera), ceiling lamps on, monsters removed, the clock frozen per shot, the player put at
 * exact positions (no nearest-clear-floor search, so it can stand close to the pillar).  Per shot:
 *   - the screenshot, UI hidden, cropped around the pillar (<set>_<k>.png) and the same with annotations (<set>_<k>_a.png):
 *     the darkness clip actually used that frame (magenta: outside it the screen is black), and the exact silhouette
 *     lines from the player through the pillar's extreme corners (cyan: where the hidden wedge really begins);
 *   - the darkness clip itself, read from the light canvas as it is drawn (a read-only hook on the canvas calls: the first
 *     clip after each frame's clear is the renderer's scenePoints), back in world px, compared with this bundle's own
 *     Hl(x, y, 700, 24) run in node at the same position: the page draws exactly the polygon the node audit measures.
 * Run on the parent and on the correction; contact_los.js lays the two runs side by side. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9491), OUT = path.resolve(opt('out') || '/tmp/looklos'), Q = opt('quality') || 'medium';
const SETS = (opt('sets') || 'orbit,strafe,close,diag').split(','), ORB0 = +(opt('orbit') || 200), STR0 = +(opt('strafe') || 8530);
fs.mkdirSync(OUT, { recursive: true });
const L = require('./los_lib.js').load(GAME);
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const UI = 'header,.location,.coordinates,#hud,#net,#encounterHint,#blackoutHint,#l0vTag,#dread,.grain,#mp,#tip,#brRoleDebug';
/* read-only: record the light canvas's path at its first clip after each clear (the renderer's darkness clip) */
const CLIPTAP = `(() => { const P = CanvasRenderingContext2D.prototype, mt = P.moveTo, lt = P.lineTo, cl = P.clip, bp = P.beginPath, cr = P.clearRect;
  let path = null; const L = c => c.canvas && c.canvas.id === 'light';
  P.beginPath = function () { if (L(this)) path = []; return bp.apply(this, arguments); };
  P.moveTo = function (x, y) { if (path && L(this)) path.push(x, y); return mt.apply(this, arguments); };
  P.lineTo = function (x, y) { if (path && L(this)) path.push(x, y); return lt.apply(this, arguments); };
  P.clearRect = function () { if (L(this)) this.__first = true; return cr.apply(this, arguments); };
  P.clip = function () { if (L(this) && this.__first) { this.__first = false; window.__sceneClip = path ? path.slice() : null; } return cl.apply(this, arguments); };
})();`;
const PIL = L.Pc.find(p => p.x === 8564 && p.y === 1364), cx = PIL.x + PIL.w / 2, cy = PIL.y + PIL.h / 2, D2R = Math.PI / 180;
const SHOTS = [];
if (SETS.includes('orbit')) for (let k = 0; k < 8; k++) { const a = (ORB0 + k) * D2R; SHOTS.push(['orbit', k, cx + Math.cos(a) * 90, cy + Math.sin(a) * 90, `orbit r90 ${ORB0 + k} deg`]); }
if (SETS.includes('strafe')) for (let k = 0; k < 8; k++) SHOTS.push(['strafe', k, STR0 + k * 2, PIL.y + PIL.h + 200, `strafe y+200 x ${STR0 + k * 2}`]);
if (SETS.includes('close')) [[cx, PIL.y - 22, 'N face'], [PIL.x + PIL.w + 22, cy, 'E face'], [cx, PIL.y + PIL.h + 22, 'S face'], [PIL.x - 22, cy, 'W face'],
  [PIL.x - 18, PIL.y - 18, 'NW corner'], [PIL.x + PIL.w + 18, PIL.y - 18, 'NE corner'], [PIL.x + PIL.w + 18, PIL.y + PIL.h + 18, 'SE corner'], [PIL.x - 18, PIL.y + PIL.h + 18, 'SW corner']]
  .forEach(([x, y, l], k) => SHOTS.push(['close', k, x, y, 'close ' + l]));
if (SETS.includes('diag')) for (let k = 0; k < 4; k++) { const t = .18 + k * .2; SHOTS.push(['diag', k, 7560 + t * 1100, 972 + t * 1100, `diagonal t ${t.toFixed(2)}`]); }
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { game: GAME, quality: Q, shots: [] };
  try {
    const J = await H.join(browser, PORT, 'plos' + Date.now() % 1e5, 'PLOS', { viewport: { width: 1920, height: 1080 }, query: '&lighting=' + Q, init: CLIPTAP }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    await H.place(P, 8400, 1600, 0, { light: false });                      // installs the aim hook; PILLAR HALL
    await P.evaluate(() => window.__clock.thaw());
    for (let k = 0; k < 200; k++) { await frames(P, 4); const ok = await P.evaluate(() => { const B = window.__brRole; if (!B || !B.dev || !B.dev.farReady) return true; const s = B.stats(); return B.dev.farReady() && s.lamps.pending === 0 && (!B.dev.mapReady || B.dev.mapReady()); }); if (ok) break; }
    for (const [set, k, x, y, label] of SHOTS) {
      const aim = Math.atan2(cy - y, cx - x);
      await P.evaluate(([x, y, a]) => { __api.tp(x, y); window.__aimA = a; window.__aimW = 0; }, [x, y, aim]);
      await P.evaluate(() => window.__clock.thaw());
      for (let i = 0; i < 60; i++) { await frames(P, 4); const ok = await P.evaluate(() => { const B = window.__brRole; if (!B || !B.dev || !B.dev.farReady) return true; const s = B.stats(); return B.dev.farReady() && s.lamps.pending === 0; }); if (ok) break; }
      await frames(P, 12); await P.evaluate(() => window.__clock.freeze(true)); await frames(P, 6); await H.settle(P);
      const st = await P.evaluate(() => { const w = __api.layer().parent; return { px: __api.H.x, py: __api.H.y, wx: w.position.x, wy: w.position.y, s: w.scale.x, clip: window.__sceneClip, dpr: document.getElementById('light').width / innerWidth }; });
      await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.dataset.vh = e.style.visibility; e.style.visibility = 'hidden'; }), UI);
      const png = await P.screenshot();
      await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.style.visibility = e.dataset.vh || ''; }), UI);
      /* the clip in world px (the light canvas may be drawn at a lower resolution than the page: dpr) */
      const k2 = st.dpr, clipW = []; for (let i = 0; i < (st.clip || []).length; i += 2) clipW.push((st.clip[i] / k2 - st.wx) / st.s, (st.clip[i + 1] / k2 - st.wy) / st.s);
      const ref = L.Hl(st.px, st.py, 700, 24); let dev = clipW.length === ref.length ? 0 : null; if (dev !== null) for (let i = 0; i < ref.length; i++) dev = Math.max(dev, Math.abs(ref[i] - clipW[i]));
      /* crop: 960 x 640 page px around the pillar */
      const sx = v => st.wx + v * st.s, sy = v => st.wy + v * st.s, left = Math.round(Math.max(0, Math.min(1920 - 960, sx(cx) - 480))), top = Math.round(Math.max(0, Math.min(1080 - 640, sy(cy) - 320)));
      const crop = await sharp(png).extract({ left, top, width: 960, height: 640 }).png().toBuffer(); fs.writeFileSync(path.join(OUT, `${set}_${k}.png`), crop);
      const C = [[PIL.x, PIL.y], [PIL.x + PIL.w, PIL.y], [PIL.x, PIL.y + PIL.h], [PIL.x + PIL.w, PIL.y + PIL.h]], c0 = Math.atan2(cy - st.py, cx - st.px);
      const rel = C.map(([X, Y]) => { let a = Math.atan2(Y - st.py, X - st.px) - c0; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; });
      const lines = [Math.min(...rel), Math.max(...rel)].map(a => { const A = c0 + a, X = st.px + Math.cos(A) * 900, Y = st.py + Math.sin(A) * 900; return `<line x1="${sx(st.px) - left}" y1="${sy(st.py) - top}" x2="${sx(X) - left}" y2="${sy(Y) - top}" stroke="#00e5ff" stroke-width="1.6" stroke-dasharray="7 5"/>`; }).join('');
      let poly = ''; for (let i = 0; i < clipW.length; i += 2) poly += `${(sx(clipW[i]) - left).toFixed(1)},${(sy(clipW[i + 1]) - top).toFixed(1)} `;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><polygon points="${poly}" fill="none" stroke="#ff2bd6" stroke-width="1.6"/>${lines}<circle cx="${sx(st.px) - left}" cy="${sy(st.py) - top}" r="5" fill="#00e5ff"/><rect x="0" y="0" width="960" height="34" fill="rgba(0,0,0,.6)"/><text x="12" y="23" font-family="DejaVu Sans, sans-serif" font-size="18" fill="#fff">${label}</text></svg>`;
      await sharp(crop).composite([{ input: Buffer.from(svg) }]).png().toFile(path.join(OUT, `${set}_${k}_a.png`));
      const row = { set, k, label, at: [st.px, st.py], clipVerts: clipW.length / 2, nodeVerts: ref.length / 2, clipVsNodeMaxPx: dev === null ? null : +dev.toFixed(4) };
      R.shots.push(row); console.log(set, k, label, '| clip verts', row.clipVerts, '| node Hl verts', row.nodeVerts, '| max |page - node| px', row.clipVsNodeMaxPx);
    }
    R.errs = J.errs; if (J.errs.length) console.log('page errors:', J.errs.slice(0, 5).join(' | '));
  } finally { await browser.close(); srv.kill(); }
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
