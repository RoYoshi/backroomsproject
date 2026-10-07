/* Stage 3B-N N3 - fixture / blocker separation and line-of-sight stability around a pillar, against the real server and
 * client (development only; never served).
 *
 *   node dev/stage-3b-n/pillar_3bn.js [--game PATH] [--port 9474] [--out DIR] [--steps 240]      (exit 1 on any failure)
 *
 * P1 no fixture housing (90 x 28) overlaps a pillar or a wall cell, on the client (__api.lamps) and on the server (the AI's
 *    lamp list, sim.adapter.lamps), and the two lists are identical (same fixtures, same order: no per-machine correction)
 * P2 a full loop around the PILLAR HALL's centre pillar (radius 160, one step per 1.5 degrees; steps where a body does not fit are skipped), lamps on, flashlight on:
 *    the line of sight the game builds (its sight polygon, the creature mask) is compared with the exact geometry behind the
 *    pillar at every step.  Reveal = a point hidden by the pillar (with a 10 px margin) inside the polygon; over-hide = a
 *    visible point (same margin) outside it.  The margin is 10 px at the pillar (wider at the point, by distance).  Required: zero reveals in every frame (no one-frame reveal, no wedge) and the
 *    polygon's error at the silhouette within 2 px at every step (stable edge, no jitter)
 * P3 the darkness overlay agrees: at every step, no hidden point behind the pillar shows through it (alpha < 250)
 * P4 no oscillation: at 8 held poses on the loop (clock frozen, after the lamp fields have finished building) the overlay and the sight polygon are identical frame to frame
 * P5 stable light origin: the fixtures around the pillar never move during the loop and none sits inside a pillar */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9474), OUT = path.resolve(opt('out') || '/tmp/pillar3bn'), STEPS = +(opt('steps') || 240);
fs.mkdirSync(OUT, { recursive: true });
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const PILLARS = []; for (const e of [79.5, 84.5, 89.5]) for (const t of [9.5, 14.5, 19.5]) PILLARS.push({ x: e * 96 - 28, y: t * 96 - 28, w: 56, h: 56 });   // the game's own pillar list (bundle and sim)
const C = [8112, 1392], RAD = 160;
const housingBad = (L, kc, W) => { const x0 = L.x - 45, x1 = L.x + 45, y0 = L.y - 15, y1 = L.y + 13, why = [];
  for (const p of PILLARS) if (x1 > p.x && x0 < p.x + p.w && y1 > p.y && y0 < p.y + p.h) why.push('pillar');
  if (kc) for (let cy = Math.floor(y0 / 96); cy <= Math.floor((y1 - 1e-6) / 96); cy++) for (let cx = Math.floor(x0 / 96); cx <= Math.floor((x1 - 1e-6) / 96); cx++) if (!kc[cy * W + cx]) why.push('wall'); return why; };

/* in-page: the sight polygon (from the creature mask the game draws every frame), exact visibility behind the pillar */
const PAGE = `(() => {
  const polyOf = () => { const m = __api.layer().mask; if (!m || !m.context || !m.context.instructions) return null; let best = null;          // the points the game passed to .poly(sightPoints)
    for (const ins of m.context.instructions) { const pi = ins && ins.data && ins.data.path && ins.data.path.instructions; if (!pi) continue;
      for (const q of pi) if (q && q.action === 'poly' && Array.isArray(q.data[0]) && (!best || q.data[0].length > best.length)) best = q.data[0]; }
    return best && typeof best[0] === 'number' ? best : null; };
  const inside = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2) { const xi = P[i], yi = P[i + 1], xj = P[j], yj = P[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const vis = (px, py, x, y) => { const d = Math.hypot(x - px, y - py); return __api.Uc(px, py, Math.atan2(y - py, x - px), d) >= d - .5; };
  window.__pil = {
    poly: polyOf,
    probe(cx, cy) {
      const A = __api, px = A.H.x, py = A.H.y, P = polyOf(); if (!P) return { err: 'no sight polygon' };
      const dx = cx - px, dy = cy - py, D = Math.hypot(dx, dy), ux = dx / D, uy = dy / D, vx = -uy, vy = ux, M = 10;
      let reveal = 0, over = 0, hid = 0, seen = 0, worst = 0; const hidPts = [];
      for (let d = 50; d <= 340; d += 10) for (let s = -150; s <= 150; s += 5) {
        const x = cx + ux * d + vx * s, y = cy + uy * d + vy * s; if (Math.hypot(x - px, y - py) > 690) continue;
        if (A.Hc(Math.floor(x / 96), Math.floor(y / 96))) continue;
        if ([[-6, 0], [6, 0], [0, -6], [0, 6]].some(([a, b]) => A.Hc(Math.floor((x + a) / 96), Math.floor((y + b) / 96)))) continue;   // within 6 px of a wall face: the lit face strip the game shows (24 px into a visible wall) blurs into it
        const m = M * Math.max(1, Math.hypot(x - px, y - py) / Math.max(40, D - 40)), a = vis(px, py, x, y), l = vis(px, py, x - vx * m, y - vy * m), r = vis(px, py, x + vx * m, y + vy * m), inP = inside(P, x, y);   // the margin is >= 10 px at the pillar, not only at the point
        let deep = !a && !l && !r; for (let o = -m; deep && o <= m; o += 3) deep = !vis(px, py, x + vx * o, y + vy * o);   // hidden across the whole margin (not a point between two shadows with a sliver of view between them)
        if (deep) { hid++; hidPts.push([x, y]); if (inP) { reveal++; worst = Math.max(worst, M); } }
        else if (a && l && r) { seen++; if (!inP) over++; }
        else if (a !== inP) worst = Math.max(worst, 0);               // inside the 10 px band around the exact edge: not scored
      }
      /* the polygon's error at the silhouette: for each depth, the distance (px, sideways) between the polygon's edge and the exact edge */
      let edgeErr = 0;
      for (let d = 60; d <= 300; d += 20) for (const side of [-1, 1]) {
        let ex = null, px2 = null;
        for (let s = 0; s <= 160; s += .5) { const x = cx + ux * d + vx * s * side, y = cy + uy * d + vy * s * side; if (Math.hypot(x - px, y - py) > 690) break;
          if (A.Hc(Math.floor(x / 96), Math.floor(y / 96))) break;
          if (ex === null && vis(px, py, x, y)) ex = s; if (px2 === null && inside(P, x, y)) px2 = s; if (ex !== null && px2 !== null) break; }
        if (ex !== null && px2 !== null) edgeErr = Math.max(edgeErr, Math.abs(ex - px2));
      }
      return { reveal, over, hid, seen, edgeErr, hidPts: hidPts.filter((_, i) => i % 3 === 0) };
    },
    overlay(pts) { const c = document.getElementById('light'), k = c.width / innerWidth, w = __api.layer().parent, sc = [];
      for (const [x, y] of pts) { const sx = Math.round((w.position.x + x * w.scale.x) * k), sy = Math.round((w.position.y + y * w.scale.y) * k); if (sx >= 0 && sy >= 0 && sx < c.width && sy < c.height) { const q = [sx, sy]; q.w = [Math.round(x), Math.round(y)]; sc.push(q); } }
      if (!sc.length) return { min: 255, n: 0 };
      const x0 = Math.min(...sc.map(p => p[0])), y0 = Math.min(...sc.map(p => p[1])), x1 = Math.max(...sc.map(p => p[0])), y1 = Math.max(...sc.map(p => p[1])), bw = x1 - x0 + 1;
      const d = c.getContext('2d').getImageData(x0, y0, bw, y1 - y0 + 1).data; let mn = 255;
      let at = null; for (let i = 0; i < sc.length; i++) { const [sx, sy] = sc[i], a = d[((sy - y0) * bw + (sx - x0)) * 4 + 3]; if (a < mn) { mn = a; at = sc[i].w; } } return { min: mn, n: sc.length, at }; },
    lampsNear(cx, cy, r) { return (__api.lamps || []).map((l, i) => [i, l.x, l.y]).filter(([, x, y]) => Math.hypot(x - cx, y - cy) < r); },
  };
})();`;

(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = {};
  try {
    /* ---- P1: fixtures vs blockers, client and server ---- */
    const sim = require(path.join(GAME, 'sim.js'))({ seed: 1 }), srvL = sim.adapter.lamps.map(l => [l.x, l.y]);
    const J = await H.join(browser, PORT, 'pil' + Date.now() % 1e5, 'PIL', { init: PAGE }), P = J.P;
    await H.until(() => P.evaluate(() => !window.__l0v || __l0v.ready()), 30000); await H.stage(P); await H.setLights(P, 'off');
    await P.evaluate(() => Object.defineProperty(window, '__glitches', { configurable: true, get: () => [], set: () => { } }));
    const cli = await P.evaluate(() => ({ lamps: __api.lamps.map(l => [l.x, l.y]), kc: null }));
    const kc = await P.evaluate(() => { const out = []; for (let y = 0; y < 72; y++) for (let x = 0; x < 96; x++) out.push(__api.Hc(x, y) ? 0 : 1); return out; });
    const badC = cli.lamps.map(([x, y], i) => [i, housingBad({ x, y }, kc, 96)]).filter(([, w]) => w.length), badS = srvL.map(([x, y], i) => [i, housingBad({ x, y }, kc, 96)]).filter(([, w]) => w.length);
    const same = JSON.stringify(cli.lamps) === JSON.stringify(srvL);
    R.P1 = { client: cli.lamps.length, server: srvL.length, same, badClient: badC, badServer: badS, pillarHall: cli.lamps.filter(([x, y]) => x > 77 * 96 && x < 92 * 96 && y > 7 * 96 && y < 21 * 96) };
    check('P1 no fixture housing overlaps a pillar or a wall, on the client or the server, and both machines have the same fixtures', !badC.length && !badS.length && same,
      `client ${cli.lamps.length} fixtures (${badC.length} on a blocker${badC.length ? ': ' + badC.map(([i, w]) => i + ' ' + [...new Set(w)].join('+')).join(', ') : ''}), server ${srvL.length} (${badS.length} on a blocker); identical: ${same}; PILLAR HALL fixtures ${JSON.stringify(R.P1.pillarHall)}`);
    try { sim.stop && sim.stop(); } catch (e) { }

    /* ---- P2/P3/P5: the loop ---- */
    await P.evaluate(() => __clock.thaw());
    await H.place(P, C[0] + RAD, C[1], Math.PI, { light: true }); await sleep(900); await frames(P, 10);
    const lamps0 = await P.evaluate(([x, y]) => __pil.lampsNear(x, y, 520), C);
    const builds0 = await P.evaluate(() => { const s = window.__brRole && __brRole.stats(); return s && s.lamps ? s.lamps.builds : null; });
    const rows = []; let lampMoves = 0, lampInPillar = 0;
    for (let k = 0; k < STEPS; k++) {
      const a = k / STEPS * Math.PI * 2, x = C[0] + Math.cos(a) * RAD, y = C[1] + Math.sin(a) * RAD;
      const ok = await P.evaluate(([x, y]) => __api.sl(x, y, 22), [x, y]); if (!ok) { rows.push({ k, skipped: true }); continue; }
      await P.evaluate(([x, y, ang]) => { __api.tp(x, y); window.__aimA = ang; window.__aimW = 0; }, [x, y, a + Math.PI]); await frames(P, 2);
      const pr = await P.evaluate(([cx, cy]) => __pil.probe(cx, cy), C);
      const ov = pr.hidPts ? await P.evaluate(p => __pil.overlay(p), pr.hidPts) : { min: 255, n: 0 };
      if (ov.min < 255) await P.screenshot({ path: path.join(OUT, `faint-${String(k).padStart(3, '0')}.png`) });
      const ln = await P.evaluate(([x, y]) => __pil.lampsNear(x, y, 520), C);
      if (JSON.stringify(ln) !== JSON.stringify(lamps0)) lampMoves++;
      for (const [, lx, ly] of ln) if (PILLARS.some(p => lx >= p.x && lx <= p.x + p.w && ly >= p.y && ly <= p.y + p.h)) { lampInPillar++; break; }
      rows.push({ k, x: Math.round(x), y: Math.round(y), reveal: pr.reveal, over: pr.over, hid: pr.hid, seen: pr.seen, edgeErr: +(pr.edgeErr || 0).toFixed(1), overlayMin: ov.min, overlayN: ov.n, overlayAt: ov.min < 255 ? ov.at : null, err: pr.err });
      if (k % 30 === 0) console.log(`  step ${k}: reveal ${pr.reveal}, over ${pr.over}, edge ${(pr.edgeErr || 0).toFixed(1)} px, overlay min ${ov.min}`);
      if (k % 60 === 0) await P.screenshot({ path: path.join(OUT, `loop-${String(k).padStart(3, '0')}.png`) });
    }
    const builds1 = await P.evaluate(() => { const s = window.__brRole && __brRole.stats(); return s && s.lamps ? s.lamps.builds : null; });
    const done = rows.filter(r => !r.skipped && !r.err);
    const revealFrames = done.filter(r => r.reveal > 0), overFrames = done.filter(r => r.over > 0), errs = done.map(r => r.edgeErr);
    const jit = []; for (let i = 1; i < done.length; i++) jit.push(Math.abs(done[i].edgeErr - done[i - 1].edgeErr));
    R.P2 = { steps: STEPS, measured: done.length, skipped: rows.filter(r => r.skipped).length, errors: rows.filter(r => r.err).length, revealFrames: revealFrames.length, maxReveal: Math.max(0, ...done.map(r => r.reveal)),
      overHideFrames: overFrames.length, maxEdgeErr: Math.max(0, ...errs), meanEdgeErr: +(errs.reduce((a, b) => a + b, 0) / Math.max(1, errs.length)).toFixed(2), maxStepJitter: +Math.max(0, ...jit).toFixed(1), hiddenPerStep: Math.round(done.reduce((a, r) => a + r.hid, 0) / Math.max(1, done.length)) };
    check('P2 full loop around a pillar: the sight polygon never reveals a point the pillar hides nor hides a point in plain view (no one-frame reveal, no false wedge) and its edge is the pillar\'s silhouette (stable, no jitter)',
      done.length >= STEPS * .75 && R.P2.revealFrames === 0 && R.P2.overHideFrames === 0 && R.P2.maxEdgeErr <= 2,
      `${done.length}/${STEPS} steps; ~${R.P2.hiddenPerStep} hidden points a step; reveal in ${R.P2.revealFrames} steps (up to ${R.P2.maxReveal} points), over-hide in ${R.P2.overHideFrames}; silhouette error max ${R.P2.maxEdgeErr} px, mean ${R.P2.meanEdgeErr} px, step-to-step change up to ${R.P2.maxStepJitter} px`);
    const ovLeak = done.filter(r => r.overlayN && r.overlayMin < 250);
    R.P3 = { leakSteps: ovLeak.length, worst: Math.min(255, ...done.map(r => r.overlayMin)), sampled: done.reduce((a, r) => a + r.overlayN, 0) };
    check('P3 the darkness overlay shows nothing behind the pillar at any step of the loop', R.P3.leakSteps === 0, `${R.P3.sampled} hidden samples; steps showing something ${R.P3.leakSteps}; lowest overlay alpha there ${R.P3.worst}/255`);

    /* ---- P4: held poses, clock frozen ---- */
    const held = [];
    for (let j = 0; j < 8; j++) {
      const a = (j / 8 + 1 / 32) * Math.PI * 2, x = C[0] + Math.cos(a) * RAD, y = C[1] + Math.sin(a) * RAD;
      if (!await P.evaluate(([x, y]) => __api.sl(x, y, 22), [x, y])) continue;
      await P.evaluate(([x, y, ang]) => { __api.tp(x, y); window.__aimA = ang; window.__aimW = 0; }, [x, y, a + Math.PI]); await frames(P, 4);
      await P.evaluate(() => __clock.freeze(true)); const settled = await H.settle(P);                 // lamp fields finish building / fading in first
      const hs = [], ps = []; for (let f = 0; f < 10; f++) { hs.push(await H.lightHash(P)); ps.push(await P.evaluate(() => { const p = __pil.poly(); return p ? p.map(v => Math.round(v * 100)).join(',') : ''; })); await frames(P, 1); }
      await P.evaluate(() => __clock.thaw());
      held.push({ j, settled: !!settled, overlayStates: new Set(hs).size, polyStates: new Set(ps).size });
    }
    R.P4 = held;
    check('P4 no oscillation: at held poses around the pillar (clock frozen) the overlay and the sight polygon do not change frame to frame', held.length >= 6 && held.every(h => h.overlayStates === 1 && h.polyStates === 1),
      held.map(h => `pose ${h.j}: overlay ${h.overlayStates} state(s), polygon ${h.polyStates}`).join('; '));
    R.P5 = { lamps: lamps0, movedSteps: lampMoves, stepsWithLampInPillar: lampInPillar, lampBuildsDuringLoop: builds0 == null ? null : builds1 - builds0 };
    check('P5 stable light origin: the fixtures around the pillar never move during the loop and none sits inside a pillar', lampMoves === 0 && lampInPillar === 0 && lamps0.length > 0,
      `${lamps0.length} fixtures within 520 px: ${JSON.stringify(lamps0)}; steps with a moved fixture ${lampMoves}, with a fixture inside a pillar ${lampInPillar}; BR-RoLE lamp-field builds during the loop ${R.P5.lampBuildsDuringLoop}`);
    await H.place(P, 8352, 1632, -2.4, { light: false }); await sleep(700); await frames(P, 6); await P.screenshot({ path: path.join(OUT, 'pillar-hall.png') });
    R.rows = rows; R.errorsPage = J.errs;
  } catch (e) { check('P00 harness', false, String(e && e.stack || e).slice(0, 700)); }
  await browser.close(); srv.kill();
  R.results = results; fs.writeFileSync(path.join(OUT, 'pillar.json'), JSON.stringify(R, null, 1));
  const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})();
