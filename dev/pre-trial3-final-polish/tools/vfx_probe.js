#!/usr/bin/env node
/* dev/pre-trial3-final-polish/tools/vfx_probe.js - pre-Trial 3 polish P1: what the screen does near a monster and at a capture, in a real
 * page (development only; a measurement for the P1 checkpoint and its check, not a gate step).
 *
 *   node dev/pre-trial3-final-polish/tools/vfx_probe.js --dir DIR [--out FILE.json] [--shots DIR] [--seconds 12] [--check 1]
 *   (--check 1: exit 1 unless every verdict case below holds; without it the verdict is reported and the exit is 0)
 *
 * One server (`node server.js PORT` in DIR, a synthetic admin passcode), headless Chromium (SwiftShader, 1280x720).  Every name is
 * synthetic.  The server is stopped by its PID.
 *   danger   a run with the world frozen and the player in god mode; a Hound placed beside the player (admin "near").  Every animation
 *            frame for --seconds: #light's opacity as shown (computed) and as the dread hook writes it inline (the darkness overlay
 *            BR-RoLE lights through), #dread's opacity (the red edge
 *            vignette), the shake (#game's transform), the heartbeat (oscillators started by the dread's audio).  Screenshots in a burst:
 *            each one's mean brightness, so a frame that lights the whole scene stands out.
 *   capture  a death through the real kill path (admin "preview", a Hound): every frame for 3 s from the moment body gets `captured`,
 *            #dread's computed opacity, background colour and image, animation, and its ::after layer's opacity and background (what
 *            the eye sees is their product); screenshots in the first 1.6 s with their time; the capture's CSS animations (name,
 *            layer, duration, iterations), then each held (paused) at 0, 75, 250, 500, 900, 1300 and 1900 ms for a screenshot (the death
 *            dialog, which comes up only after the death animation, hidden for them), since
 *            the death scene is too heavy here for live screenshots to land in its first second; the capture burst (a 1.1 s noise
 *            buffer) counted.  Done twice: motion as is, and with the system asking for reduced motion (Settings' motion "auto" follows
 *            it).  --dir may be any complete game folder: C5's for the "before".
 * Brightness is the mean of R, G and B over the whole screenshot (0-255); redness is mean R minus the mean of G and B.
 * Verdict: near the Hound, #light never shown below full opacity (whatever the hook writes inline), while the shake, the red vignette and the heartbeat still run; at a capture,
 * exactly one red animation (once, at most 1.5 s), redness up by 40 or more at 75 ms and red rather than white, back by 1.3 s, one burst;
 * with reduced motion, the calm animation, no sharp onset, softer than the normal impact but seen, back by 1.9 s, one burst; no page
 * error.  Run against C5 it fails (no impact, three bursts): the cases can tell the two apart. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(groot, 'sharp')); } })();
const DIR = path.resolve(ARG.dir || '.'), SECS = +(ARG.seconds || 12), PASS = 'vfx-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = ARG.shots ? path.resolve(ARG.shots) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const INIT = `(() => {
  const S = window.WebSocket; window.__vx = { game: null, unlocked: false, capAt: null, bursts: 0, osc: 0, replies: [] };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__vx.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.t === 'admin' && m.ok) window.__vx.unlocked = true; if (m.t === 'admin' || m.t === 'ares' || m.t === 'adres') window.__vx.replies.push(JSON.stringify(m).slice(0, 160)); } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
  const A = window.AudioContext && AudioContext.prototype;
  if (A) { const cb = A.createBuffer, co = A.createOscillator;
    A.createBuffer = function (ch, len, sr) { if (ch === 1 && Math.abs(len - sr * 1.1) < 2) window.__vx.bursts++; return cb.apply(this, arguments); };
    A.createOscillator = function () { window.__vx.osc++; return co.apply(this, arguments); }; }
  const watch = () => new MutationObserver(() => { if (document.body.classList.contains('captured') && window.__vx.capAt === null) window.__vx.capAt = performance.now(); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
})();`;
async function serve() {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server');
}
async function until(P, fn, arg, ms = 8000) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(100); } }
async function runPage(b, port, room, reduced) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(INIT); const P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__api && window.__ui, null, { timeout: 60000 });
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', 'Probe'); await P.click('#enter');
  await until(P, () => !!(__api.started() && window.__net && __net.on && window.__vx.game), null, 30000);
  await P.evaluate(p => __net.testAuth(p), PASS); await until(P, () => window.__vx.unlocked, null, 5000);
  await P.evaluate(() => { const g = window.__vx.game; g.send(JSON.stringify({ t: 'a', c: 'freeze', on: true })); g.send(JSON.stringify({ t: 'a', c: 'god', id: __api.H.id })); });
  await P.keyboard.press('Shift'); await sleep(1500);                   // a key: the page's audio may start
  return { ctx, P, errs };
}
const lum = async buf => { const s = await sharp(buf).stats(); const [r, g, bl] = s.channels.map(c => c.mean); return { bright: +((r + g + bl) / 3).toFixed(2), red: +(r - (g + bl) / 2).toFixed(2) }; };
const TRACE = `(ms) => new Promise(res => { const out = [], d = document.getElementById('dread'), l = document.getElementById('light'), g = document.getElementById('game'), t0 = performance.now();
  const f = () => { const cs = getComputedStyle(d), ca = getComputedStyle(d, '::after');
    out.push({ t: Math.round(performance.now() - (window.__vx.capAt === null ? t0 : window.__vx.capAt)), light: +getComputedStyle(l).opacity, lightInline: l.style.opacity === '' ? 1 : +l.style.opacity, dreadInline: d.style.opacity === '' ? null : +d.style.opacity,
      op: +cs.opacity, bg: cs.backgroundColor, img: cs.backgroundImage.slice(0, 60), anim: cs.animationName, aOp: ca.content === 'none' ? null : +ca.opacity, aBg: ca.content === 'none' ? null : (ca.backgroundColor + ' ' + ca.backgroundImage.slice(0, 40)),
      shake: !!g.style.transform, osc: window.__vx.osc });
    if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f); })`;
async function shotsFor(P, ms, tag, every = 0) {
  const out = [], t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const at = await P.evaluate(() => Math.round(performance.now() - (window.__vx.capAt === null ? 0 : window.__vx.capAt)));
    const buf = await P.screenshot({ type: 'jpeg', quality: 70 }); const L = await lum(buf); L.t = at; out.push(L);
    if (SHOTS && (out.length <= 3 || L.bright > 0)) fs.writeFileSync(path.join(SHOTS, `${tag}_${String(out.length).padStart(3, '0')}_${at}ms.jpg`), buf);
    if (every) await sleep(every);
  }
  return out;
}
(async () => {
  const { p: srv, port } = await serve();
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const R = { tool: 'dev/pre-trial3-final-polish/tools/vfx_probe.js', dir: DIR, chromium: b.version(), seconds: SECS };
  try {
    /* danger: a Hound beside the player */
    { const { ctx, P, errs } = await runPage(b, port, 'vxd' + Date.now() % 1e6, false);
      await P.evaluate(() => window.__vx.game.send(JSON.stringify({ t: 'a', c: 'near', k: 'hound' })));
      await until(P, () => Math.hypot(__api.G.x - __api.H.x, __api.G.y - __api.H.y) < 2000, null, 8000);
      // stand on a walkable tile about 200 px from the Hound (admin "near" places it out of the dread's 620 px reach); the world is frozen
      R.dangerStand = await P.evaluate(() => { const G = __api.G, H = __api.H;
        for (const r of [200, 230, 170, 260, 150, 300]) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, x = G.x + Math.cos(a) * r, y = G.y + Math.sin(a) * r;
          if (__api.zc(Math.floor(x / 96), Math.floor(y / 96)) && __api.zc(Math.floor((x + 20) / 96), Math.floor(y / 96)) && __api.zc(Math.floor((x - 20) / 96), Math.floor(y / 96))) { __api.tp(x, y); return { x: Math.round(x), y: Math.round(y), r }; } }
        return null; });
      const near = await until(P, () => { const d = document.getElementById('dread'); return +d.style.opacity > .3 ? +d.style.opacity : null; }, null, 15000);
      R.dangerSetup = await P.evaluate(() => ({ replies: window.__vx.replies, houndDist: Math.round(Math.hypot(__api.G.x - __api.H.x, __api.G.y - __api.H.y)) }));
      await P.bringToFront();
      const [trace, shots] = await Promise.all([P.evaluate(`(${TRACE})(${SECS * 1000})`), shotsFor(P, SECS * 1000, 'danger')]);
      // what one of those frames shows: the same view with #light held at the flicker's lowest and highest opacity (.35 + .4 r), next to the
      // view as drawn.  (The flicker's frames are too brief for a screenshot to catch reliably on a software-rendered page.)
      const look = {};
      for (const [tag, v] of [['asDrawn', null], ['light038', .38], ['light075', .75]]) {
        await P.evaluate(v => { let st = document.getElementById('vxHold'); if (!st) { st = document.createElement('style'); st.id = 'vxHold'; document.head.append(st); } st.textContent = v === null ? '' : `#light{opacity:${v}!important}`; }, v);
        await sleep(700); const buf = await P.screenshot({ type: 'jpeg', quality: 80 }); look[tag] = await lum(buf); if (SHOTS) fs.writeFileSync(path.join(SHOTS, `look_${tag}.jpg`), buf);
      }
      await P.evaluate(() => { const st = document.getElementById('vxHold'); if (st) st.remove(); });
      const lit = trace.filter(x => x.light < 1), flick = trace.filter(x => x.lightInline < 1), br = shots.map(s => s.bright).sort((a, c) => a - c), med = br[Math.floor(br.length / 2)];
      R.danger = { dreadReached: near, frames: trace.length, fps: +(trace.length / SECS).toFixed(2), lightBelow1Frames: lit.length, lightMin: trace.length ? Math.min(...trace.map(x => x.light)) : null, flickerWrites: flick.length, flickerInlineMin: flick.length ? Math.min(...flick.map(x => x.lightInline)) : null,
        dreadInlineMax: Math.max(...trace.map(x => x.dreadInline || 0)), shakeFrames: trace.filter(x => x.shake).length, heartbeatOscillators: trace.length ? trace[trace.length - 1].osc - trace[0].osc : 0,
        shots: shots.length, brightMedian: med, brightMax: br[br.length - 1], brightOver130pct: shots.filter(s => s.bright > med * 1.3).length, look, shotsRaw: shots, errors: errs };
      await ctx.close(); }
    /* capture, motion as is and reduced */
    for (const reduced of [false, true]) {
      const { ctx, P, errs } = await runPage(b, port, 'vxc' + (reduced ? 'r' : 'n') + Date.now() % 1e6, reduced);
      await P.bringToFront();
      const b0 = await P.evaluate(() => window.__vx.bursts);
      const tr = P.evaluate(`(${TRACE})(3000)`);
      await P.evaluate(() => window.__vx.game.send(JSON.stringify({ t: 'a', c: 'preview', k: 'hound', var: 'A' })));
      const cap = await until(P, () => window.__vx.capAt !== null, null, 8000);
      const shots = cap ? await shotsFor(P, 1600, reduced ? 'capture_reduced' : 'capture') : [];
      const trace = await tr;
      // the capture's animations (CSS animations on #dread and its ::after), then each held at chosen moments for a screenshot - the death
      // scene is heavy on a software-rendered page, so a live screenshot rarely lands in the impact's first second
      const anims = await P.evaluate(() => document.getAnimations().filter(a => a.animationName && /flashout|tfbCapture/.test(a.animationName))
        .map(a => ({ name: a.animationName, pseudo: a.effect && a.effect.pseudoElement, duration: a.effect.getTiming().duration, iterations: a.effect.getTiming().iterations, state: a.playState })));
      const held = [];
      // (the "It found you." dialog and its dark backdrop come up only when the death animation has finished - after the impact - so
      // they are hidden for these held frames, which show the scene as it is during the impact)
      await P.evaluate(() => { const c = document.getElementById('caught'); if (c) c.style.setProperty('display', 'none', 'important'); });
      for (const ms of [0, 75, 250, 500, 900, 1300, 1900]) {
        const ok = await P.evaluate(ms => { const A = document.getAnimations().filter(a => a.animationName && /flashout|tfbCapture/.test(a.animationName)); A.forEach(a => { a.pause(); a.currentTime = ms; }); return A.length; }, ms);
        await sleep(400); const buf = await P.screenshot({ type: 'jpeg', quality: 80 }); const L = await lum(buf); held.push(Object.assign({ ms, anims: ok }, L));
        if (SHOTS) fs.writeFileSync(path.join(SHOTS, `held_${reduced ? 'reduced' : 'normal'}_${String(ms).padStart(4, '0')}ms.jpg`), buf);
      }
      await P.evaluate(() => { document.getAnimations().filter(a => a.animationName && /flashout|tfbCapture/.test(a.animationName)).forEach(a => a.finish()); const c = document.getElementById('caught'); if (c) c.style.removeProperty('display'); });
      await sleep(1500);
      const after = trace.filter(x => x.t >= 0), b1 = await P.evaluate(() => window.__vx.bursts);
      const reds = shots.map(s => s.red), peakAt = shots.length ? shots[reds.indexOf(Math.max(...reds))].t : null;
      R[reduced ? 'captureReduced' : 'capture'] = { captured: !!cap, rm: await P.evaluate(() => document.documentElement.classList.contains('rm')), frames: after.length, bursts: b1 - b0, anims, held,
        first: after.slice(0, 6), at500: after.find(x => x.t >= 500) || null, at1500: after.find(x => x.t >= 1500) || null, last: after[after.length - 1] || null,
        shots: shots.map(s => ({ t: s.t, bright: s.bright, red: s.red })), redPeak: shots.length ? Math.max(...reds) : null, redPeakAt: peakAt, redLast: shots.length ? reds[reds.length - 1] : null, errors: errs };
      await ctx.close();
    }
  } finally { await b.close(); try { process.kill(srv.pid); } catch (e) { } }
  /* the verdict (the owner's P1 request, as measured above) */
  const cases = [], check = (name, ok, detail) => cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  const D = R.danger || {}, C = R.capture || {}, Q = R.captureReduced || {}, at = (c, ms) => ((c.held || []).find(h => h.ms === ms) || {});
  check('danger_monster_close', D.dreadReached > .3, `the red vignette reached ${D.dreadReached}`);
  check('danger_no_scene_lightening', D.frames > 20 && D.lightBelow1Frames === 0, `#light shown below full opacity on ${D.lightBelow1Frames} of ${D.frames} frames (lowest ${D.lightMin}); the dread hook's own flicker written into its inline style on ${D.flickerWrites} of them (lowest ${D.flickerInlineMin})`);
  check('danger_keeps_shake', D.shakeFrames >= D.frames * .8, `${D.shakeFrames} of ${D.frames} frames shaken`);
  check('danger_keeps_vignette', D.dreadInlineMax >= .5, `vignette up to ${D.dreadInlineMax}`);
  check('danger_keeps_heartbeat', D.heartbeatOscillators >= SECS, `${D.heartbeatOscillators} heartbeat oscillators in ${SECS} s`);
  const base = at(C, 0).red, peak = at(C, 75), animsN = (C.anims || []).map(a => a.name);
  check('capture_happened', C.captured && Q.captured, `normal ${C.captured}, reduced ${Q.captured}`);
  check('capture_one_red_animation', animsN.length === 1 && animsN[0] === 'tfbCaptureRed' && C.anims[0].iterations === 1 && C.anims[0].duration <= 1500, JSON.stringify(C.anims));
  check('capture_red_impact', peak.red >= base + 40, `redness ${base} -> ${peak.red} at 75 ms`);
  check('capture_red_not_white', peak.red > 1.5 * peak.bright && peak.bright < 80, `at its peak: redness ${peak.red}, brightness ${peak.bright}`);
  check('capture_fades_once', at(C, 1300).red <= base + 3 && at(C, 1900).red <= base + 3, `redness ${at(C, 500).red} at 500 ms, ${at(C, 1300).red} at 1300 ms, ${at(C, 1900).red} at 1900 ms`);
  check('capture_one_burst', C.bursts === 1, `${C.bursts} capture bursts`);
  const qN = (Q.anims || []).map(a => a.name), qBase = at(Q, 0).red, qMax = Math.max(...(Q.held || []).map(h => h.red));
  check('reduced_calm_red_animation', Q.rm && qN.length === 1 && qN[0] === 'tfbCaptureRedCalm' && Q.anims[0].iterations === 1, `rm ${Q.rm}; ${JSON.stringify(Q.anims)}`);
  check('reduced_no_sharp_onset', at(Q, 75).red <= qBase + 5, `redness ${qBase} -> ${at(Q, 75).red} at 75 ms`);
  check('reduced_softer_but_seen', at(Q, 500).red >= qBase + 15 && qMax < peak.red, `redness ${at(Q, 500).red} at 500 ms, highest ${qMax} (normal ${peak.red})`);
  check('reduced_fades_once', at(Q, 1900).red <= qBase + 3, `redness ${at(Q, 1900).red} at 1900 ms`);
  check('reduced_one_burst', Q.bursts === 1, `${Q.bursts} capture bursts`);
  check('no_page_errors', !(D.errors || []).length && !(C.errors || []).length && !(Q.errors || []).length, JSON.stringify([].concat(D.errors || [], C.errors || [], Q.errors || [])).slice(0, 300));
  R.cases = cases; R.ok = cases.every(c => c.ok);
  const txt = JSON.stringify(R, null, 1) + '\n'; if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), txt);
  for (const c of cases) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name} - ${c.detail}`);
  console.log(`VFX PROBE: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases`);
  if (ARG.check && !R.ok) process.exitCode = 1;
  const s = x => x ? JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => !['shotsRaw', 'shots', 'first', 'errors', 'at500', 'at1500', 'last'].includes(k)))) : 'none';
  console.log('danger ' + s(R.danger)); console.log('capture ' + s(R.capture)); console.log('captureReduced ' + s(R.captureReduced));
})();
