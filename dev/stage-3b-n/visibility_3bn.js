/* Stage 3B-N N2 - true darkness and the danger flicker against the real client (development only; never served).
 *
 *   node dev/stage-3b-n/visibility_3bn.js [--game PATH] [--port 9473] [--out DIR] [--frames 90]      (exit 1 on any failure)
 *
 * The darkness overlay (#light, BR-RoLE's) is what hides the world: everything outside the line of sight is opaque black in
 * it, and light is cut out of it only inside the line of sight.  What the player sees of a point is
 *   (overlay alpha there) x (the overlay element's CSS opacity)    and the world drawn under it must line up with it.
 * Every frame below records, for a hidden test object, the overlay's alpha over it, the overlay's opacity and whether the
 * world was shaken under the overlay; a sample of frames is also screenshot with every UI layer hidden.
 *
 * D1 true darkness: blackout, no carried light, BLACKOUT ZONE - the overlay is fully opaque everywhere (no glow around you)
 * D2 light still works: with the flashlight on, light is cut out of the overlay in the beam; with the lamps on, under them
 * F1 behind a WALL: a Hound within dread range on the far side of a wall, a bright test object next to it; the danger
 *    flicker forced every frame (Math.random stubbed low) and then running naturally: zero frames show anything there
 * F2 behind a PILLAR: the same with the test object behind a PILLAR HALL pillar
 * F3 a legitimate glimpse: an in-sight, dimly lit point near a lamp gets brighter while the flicker surges
 * F4 the flicker never touches the overlay's opacity, and any shake moves the world and the overlay together */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9473), OUT = path.resolve(opt('out') || '/tmp/vis3bn'), NF = +(opt('frames') || 90);
fs.mkdirSync(OUT, { recursive: true });
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const UI = 'header,.location,.coordinates,#hud,#net,#encounterHint,#blackoutHint,#l0vTag,#dread,.grain,#mp,#tip';

/* in-page helpers: a test object, per-frame sampling of the overlay over a world point, the frame recorder */
const PAGE = `(() => {
  window.__vis = {
    screen(x, y) { const w = __api.layer().parent; return [w.position.x + x * w.scale.x, w.position.y + y * w.scale.y]; },
    hidden(x, y, r) { const A = __api, out = []; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const X = x + i * r / 2, Y = y + j * r / 2, d = Math.hypot(X - A.H.x, Y - A.H.y);
      if (A.Uc(A.H.x, A.H.y, Math.atan2(Y - A.H.y, X - A.H.x), d) < d - 30) out.push([X, Y]); } return out; },
    sampleHidden(pts) { const c = document.getElementById('light'), k = c.width / innerWidth, ctx = c.getContext('2d'); let mn = 255;
      for (const [x, y] of pts) { const [sx, sy] = this.screen(x, y), a = ctx.getImageData(Math.round(sx * k), Math.round(sy * k), 1, 1).data[3]; if (a < mn) mn = a; }
      const op = parseFloat(getComputedStyle(c).opacity), gt = document.getElementById('game').style.transform || '', lt = c.style.transform || '';
      return { minA: mn, meanA: mn, op, eff: mn / 255 * op, shakeMismatch: gt !== lt, surge: window.__dangerFlicker || 1, n: pts.length }; },
    recordHidden(pts, n) { return new Promise(res => { const out = []; const f = () => { out.push(this.sampleHidden(pts)); if (out.length >= n) res(out); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); },
    sample(x, y, r) { const c = document.getElementById('light'), [sx, sy] = this.screen(x, y), k = c.width / innerWidth;
      const x0 = Math.max(0, Math.round((sx - r) * k)), y0 = Math.max(0, Math.round((sy - r) * k)), w = Math.max(1, Math.min(c.width - x0, Math.round(2 * r * k))), h = Math.max(1, Math.min(c.height - y0, Math.round(2 * r * k)));
      const d = c.getContext('2d').getImageData(x0, y0, w, h).data; let mn = 255, sum = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] < mn) mn = d[i]; sum += d[i]; }
      const op = parseFloat(getComputedStyle(c).opacity), gt = document.getElementById('game').style.transform || '', lt = c.style.transform || '';
      return { minA: mn, meanA: sum / (d.length / 4), op, eff: mn / 255 * op, shakeMismatch: gt !== lt && (gt !== '' || lt !== ''), surge: window.__dangerFlicker || 1 }; },
    record(x, y, r, n) { return new Promise(res => { const out = []; const f = () => { out.push(this.sample(x, y, r)); if (out.length >= n) res(out); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); },
    force(on) { if (on) { if (!window.__rnd0) window.__rnd0 = Math.random; Math.random = () => .02; } else if (window.__rnd0) { Math.random = window.__rnd0; window.__rnd0 = null; } },
  };
})();`;

(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = {};
  const shot = async (P, file, x, y, r) => { await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.dataset.vh = e.style.visibility; e.style.visibility = 'hidden'; }), UI);
    const b = await P.screenshot(); fs.writeFileSync(path.join(OUT, file), b);
    await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.style.visibility = e.dataset.vh || ''; }), UI);
    const [sx, sy] = await P.evaluate(([x, y]) => __vis.screen(x, y), [x, y]);
    const left = Math.max(0, Math.round(sx - r)), top = Math.max(0, Math.round(sy - r)), { data, info } = await sharp(b).extract({ left, top, width: Math.round(2 * r), height: Math.round(2 * r) }).raw().toBuffer({ resolveWithObject: true });
    let mx = 0; for (let i = 0; i < data.length; i += info.channels) mx = Math.max(mx, data[i], data[i + 1], data[i + 2]); return mx; };
  const shotPts = async (P, file, pts) => { await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.dataset.vh = e.style.visibility; e.style.visibility = 'hidden'; }), UI);
    const b = await P.screenshot(); fs.writeFileSync(path.join(OUT, file), b);
    await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.style.visibility = e.dataset.vh || ''; }), UI);
    const sc = await P.evaluate(p => p.map(([x, y]) => __vis.screen(x, y)), pts), { data, info } = await sharp(b).raw().toBuffer({ resolveWithObject: true }); let mx = 0;
    for (const [sx, sy] of sc) { const X = Math.round(sx), Y = Math.round(sy); if (X < 0 || Y < 0 || X >= info.width || Y >= info.height) continue; const i = (Y * info.width + X) * info.channels; mx = Math.max(mx, data[i], data[i + 1], data[i + 2]); } return mx; };
  /* a bright test object in the world (not masked by the line of sight: only the darkness overlay can hide it) */
  const addObj = (P, x, y) => P.evaluate(([x, y]) => { const world = __api.layer().parent, proto = world.children.find(c => c && c.context && typeof c.rect === 'function');
    const g = new proto.constructor(); g.rect(x - 22, y - 22, 44, 44).fill(0xffffff); g.label = 'vis-test-object'; world.addChild(g); window.__visObj = g; return true; }, [x, y]);
  try {
    const J = await H.join(browser, PORT, 'vis' + Date.now() % 1e5, 'VIS', { init: PAGE }), P = J.P;
    await H.until(() => P.evaluate(() => !window.__l0v || __l0v.ready()), 30000); await H.stage(P); await H.setLights(P, 'off');
    await P.evaluate(() => Object.defineProperty(window, '__glitches', { configurable: true, get: () => [], set: () => { } }));
    R.brRole = await P.evaluate(() => !!(window.__brRole && __brRole.on()));

    /* ---- D1 / D2: true darkness, and light still works ---- */
    await H.setLights(P, 'on');                                     // blackout: every lamp out
    await H.place(P, 1300, 5330, 0, { light: false }); await sleep(900); await frames(P, 10);
    const dark = await P.evaluate(() => { const c = document.getElementById('light'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let mn = 255, lit = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] < mn) mn = d[i]; if (d[i] < 255) lit++; } return { minA: mn, litPx: lit, op: getComputedStyle(c).opacity }; });
    const darkShot = await shot(P, 'D1-blackout-no-light.png', 1300, 5330, 300);
    await H.place(P, 1300, 5330, 0, { light: true }); await sleep(600); await frames(P, 8);
    const torch = await P.evaluate(() => { const s = __vis.sample(__api.H.x + 120, __api.H.y, 10); return s; });
    await H.setLights(P, 'off');
    await H.place(P, 1300, 3500, 0, { light: false }); await sleep(900); await frames(P, 8);
    const lamp = await P.evaluate(() => { const L = __api.lamps || []; let best = null; for (const l of L) { const d = Math.hypot(l.x - __api.H.x, l.y - __api.H.y); if (d < 500 && (!best || d < best.d) && __api.Uc(__api.H.x, __api.H.y, Math.atan2(l.y - __api.H.y, l.x - __api.H.x), d) >= d - 1) best = { x: l.x, y: l.y, d }; } return best ? __vis.sample(best.x, best.y + 40, 8) : null; });
    R.D = { dark, darkShot, torch, lamp };
    check('D1 true darkness: in a blackout with no carried light the overlay is opaque everywhere (no glow carried around you) and the screen is black', dark.minA === 255 && +dark.op === 1 && darkShot <= 12,
      `overlay min alpha ${dark.minA}/255 (${dark.litPx} px not fully dark), opacity ${dark.op}; screenshot max channel near you ${darkShot}`);
    check('D2 light still works: the flashlight cuts light out of the overlay in its beam, a lamp under itself', torch.minA < 200 && lamp && lamp.minA < 200, `beam ${torch.minA}/255, under a lamp ${lamp ? lamp.minA : '-'}/255`);

    /* ---- F1: a Hound and a test object behind a wall, within dread range ---- */
    let hp = null, standW = null;
    for (let tries = 0; tries < 4 && !standW; tries++) {                 // the admin 'near' spawn lands somewhere random: try again until a wall can stand between
    await H.stage(P); await P.evaluate(() => __clock.thaw()); await H.place(P, 1300, 3500, 0, { light: true }); await sleep(600);
    hp = await H.near(P, 'hound');
    standW = await P.evaluate(([hx, hy]) => { const A = __api; for (let r = 230; r <= 370; r += 20) for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, X = hx + Math.cos(a) * r, Y = hy + Math.sin(a) * r;
      if (!A.sl(X, Y, 22)) continue; let ok = true; const ang = Math.atan2(hy - Y, hx - X), ox = hx + Math.cos(ang) * 30, oy = hy + Math.sin(ang) * 30;
      for (const [u, v] of [[0, 0], [-22, -22], [22, -22], [-22, 22], [22, 22], [0, 0]]) { const px = (v === 0 && u === 0 && ok === true) ? hx : ox + u, py = (v === 0 && u === 0) ? hy : oy + v, d = Math.hypot(px - X, py - Y); if (A.Uc(X, Y, Math.atan2(py - Y, px - X), d) >= d - 40) { ok = false; break; } }
      if (ok) return [Math.round(X), Math.round(Y)]; } return null; }, hp);
    }
    const runCase = async (tag, x, y, ox, oy, aim) => {
      await H.place(P, x, y, aim, { light: true }); await sleep(900); await frames(P, 10); await addObj(P, ox, oy); await frames(P, 4);
      const los = await P.evaluate(([x, y, ox, oy]) => { const d = Math.hypot(ox - x, oy - y); return { d: Math.round(d), clear: Math.round(__api.Uc(x, y, Math.atan2(oy - y, ox - x), d)) }; }, [x, y, ox, oy]);
      const pts = await P.evaluate(([x, y]) => __vis.hidden(x, y, 20), [ox, oy]);
      await P.evaluate(() => __vis.force(true)); const forced = await P.evaluate(([p, n]) => __vis.recordHidden(p, n), [pts, Math.round(NF / 2)]);
      const shots = []; for (let i = 0; i < 3; i++) { shots.push(await shotPts(P, `${tag}-forced-${i}.png`, pts)); await frames(P, 2); }
      await P.evaluate(() => __vis.force(false)); const natural = await P.evaluate(([p, n]) => __vis.recordHidden(p, n), [pts, NF]);
      await P.evaluate(() => { if (window.__visObj) { window.__visObj.destroy(); window.__visObj = null; } });
      const all = [...forced, ...natural], leaks = all.filter(s => s.eff < .999 || s.shakeMismatch);
      return { los, hiddenPoints: pts.length, frames: all.length, forcedFlickerFrames: forced.filter(s => s.op < 1 || s.surge > 1).length, naturalFlickerFrames: natural.filter(s => s.op < 1 || s.surge > 1).length,
        leakFrames: leaks.length, worstEff: Math.min(...all.map(s => s.eff)), shakeMismatchFrames: all.filter(s => s.shakeMismatch).length, minOpacity: Math.min(...all.map(s => s.op)), maxSurge: Math.max(...all.map(s => s.surge)), shotMax: shots };
    };
    if (!standW) check('F1 behind a WALL', false, 'no stand point with a wall between you and the Hound');
    else {
      const ang = Math.atan2(hp[1] - standW[1], hp[0] - standW[0]);
      const ox = hp[0] + Math.cos(ang) * 30, oy = hp[1] + Math.sin(ang) * 30;
      const w = R.F1 = await runCase('F1-wall', standW[0], standW[1], ox, oy, ang);
      check('F1 behind a WALL: the danger flicker (forced every frame, then natural) shows nothing of a Hound and a bright object behind the wall in any frame',
        w.leakFrames === 0 && w.hiddenPoints >= 12 && w.shotMax.every(m => m <= 12) && w.forcedFlickerFrames > 0,
        `${w.hiddenPoints} hidden points x ${w.frames} frames, flicker in ${w.forcedFlickerFrames} forced + ${w.naturalFlickerFrames} natural; exposed frames ${w.leakFrames} (worst visibility ${(1 - w.worstEff).toFixed(3)}, overlay opacity down to ${w.minOpacity}, shake mismatch ${w.shakeMismatchFrames}); screenshots max ${w.shotMax.join('/')} at the object; ray clear ${w.los.clear} of ${w.los.d} px`);
    }

    /* ---- F2: behind a PILLAR (PILLAR HALL), a Hound within dread range ---- */
    await H.stage(P); await P.evaluate(() => __clock.thaw()); await H.place(P, 8352, 1632, 0, { light: true }); await sleep(600);
    const hp2 = await H.near(P, 'hound');
    const pose = await P.evaluate(([hx, hy]) => { const A = __api, pil = [[7632, 912], [7632, 1392], [7632, 1872], [8112, 912], [8112, 1392], [8112, 1872], [8592, 912], [8592, 1392], [8592, 1872]];
      for (const [px, py] of pil) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, X = px + Math.cos(a) * 170, Y = py + Math.sin(a) * 170, OX = px - Math.cos(a) * 75, OY = py - Math.sin(a) * 75;
        if (!A.sl(X, Y, 22) || !A.sl(OX, OY, 10)) continue; if (Math.hypot(hx - X, hy - Y) > 380) continue; const d = Math.hypot(OX - X, OY - Y); if (A.Uc(X, Y, Math.atan2(OY - Y, OX - X), d) < d - 40) return [Math.round(X), Math.round(Y), Math.round(OX), Math.round(OY)]; }
      return null; }, hp2);
    if (!pose) check('F2 behind a PILLAR', false, 'no pose with a pillar between you and the object and a Hound within dread range');
    else {
      const p2 = R.F2 = await runCase('F2-pillar', pose[0], pose[1], pose[2], pose[3], Math.atan2(pose[3] - pose[1], pose[2] - pose[0]));
      check('F2 behind a PILLAR: the danger flicker (forced, then natural) shows nothing of a bright object behind a pillar in any frame',
        p2.leakFrames === 0 && p2.hiddenPoints >= 12 && p2.shotMax.every(m => m <= 12) && p2.forcedFlickerFrames > 0,
        `${p2.hiddenPoints} hidden points x ${p2.frames} frames, flicker in ${p2.forcedFlickerFrames} forced + ${p2.naturalFlickerFrames} natural; exposed frames ${p2.leakFrames} (worst visibility ${(1 - p2.worstEff).toFixed(3)}, opacity down to ${p2.minOpacity}, shake mismatch ${p2.shakeMismatchFrames}); screenshots max ${p2.shotMax.join('/')}`);
    }

    /* ---- F3: a legitimate glimpse - an in-sight point at the edge of a lamp's reach, flicker forced vs not ---- */
    const g = await P.evaluate(() => { const A = __api, L = A.lamps || []; for (const l of L) { const d0 = Math.hypot(l.x - A.H.x, l.y - A.H.y); if (d0 > 900) continue;
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, X = l.x + Math.cos(a) * 230, Y = l.y + Math.sin(a) * 230; if (!A.sl(X, Y, 10)) continue; if (A.Uc(l.x, l.y, a, 230) < 229) continue;
        const d = Math.hypot(X - A.H.x, Y - A.H.y); if (d < 120 || d > 600 || A.Uc(A.H.x, A.H.y, Math.atan2(Y - A.H.y, X - A.H.x), d) < d - 1) continue; return [Math.round(X), Math.round(Y)]; } } return null; });
    if (!g) check('F3 a legitimate glimpse', false, 'no in-sight point at a lamp\'s edge from here');
    else {
      await H.place(P, await P.evaluate(() => __api.H.x), await P.evaluate(() => __api.H.y), 0, { light: false }); await frames(P, 8);
      R.F3pre = await P.evaluate(() => ({ hound: (window.__hounds || []).filter(Boolean).map(o => Math.round(Math.hypot(o.x - __api.H.x, o.y - __api.H.y))) }));
      const base = await P.evaluate(([x, y]) => __vis.record(x, y, 6, 12), g); await P.evaluate(() => __vis.force(true));
      const surge = await P.evaluate(([x, y]) => __vis.record(x, y, 6, 12), g); await P.evaluate(() => __vis.force(false));
      const mb = Math.min(...base.map(s => s.meanA * s.op)), ms = Math.min(...surge.map(s => s.meanA * s.op));
      R.F3 = { at: g, base: mb, surge: ms, surgeFrames: surge.filter(s => s.surge > 1).length, maxSurge: Math.max(...surge.map(s => s.surge)), minOpacity: Math.min(...surge.map(s => s.op)) };
      check('F3 a legitimate glimpse: an in-sight point in the dim outer part of a lamp\'s reach (230 px) is lit more while the flicker surges', ms < mb - 3, `overlay alpha there ${mb.toFixed(1)} steady, ${ms.toFixed(1)} during the flicker (lower = more light); surge in ${R.F3.surgeFrames}/12 frames, up to x${R.F3.maxSurge.toFixed(2)}; Hound at ${JSON.stringify(R.F3pre.hound)} px`);
    }
    const allF = [R.F1, R.F2].filter(Boolean);
    check('F4 the flicker never lowers the overlay\'s opacity and the world never shakes under the overlay', allF.length === 2 && allF.every(c => c.minOpacity === 1 && c.shakeMismatchFrames === 0),
      allF.map(c => `opacity min ${c.minOpacity}, shake mismatch ${c.shakeMismatchFrames}/${c.frames}`).join('; '));
    R.errors = J.errs;
  } catch (e) { check('V00 harness', false, String(e && e.stack || e).slice(0, 700)); }
  await browser.close(); srv.kill();
  R.results = results; fs.writeFileSync(path.join(OUT, 'visibility.json'), JSON.stringify(R, null, 1));
  const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})();
