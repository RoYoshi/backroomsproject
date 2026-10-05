/* 2D Lighting & Shadows - scene benchmark and capture harness (SH0 baseline, SH3 candidate).
 *
 *   node dev/shadows/scene_bench.js --game PATH --out DIR [--label TEXT] [--profiles 16x9,hidpi,mobile]
 *        [--scenes room,props,dense,sweep,peers,blackout,flicker,entities] [--tiers baseline|off,low,medium,high] [--secs 4] [--minframes 20]
 *
 * Starts the shipped `node server.js` from --game, opens the real client in Chromium (SwiftShader software GL, the same
 * flags as the retained browser suites) and stages the world through harness_lib: frozen halls, no monsters (unless the
 * scene adds some), god mode, lights confirmed from the server's snapshots.  The same harness runs unchanged against the
 * v23.3.6 parent (no shadow module: tier "baseline") and against the candidate (tiers off/low/medium/high through
 * window.__shadows).  The clock is NOT frozen: frames are measured as they run.
 *
 * Profiles: 16x9 (1280x720, DPR 1), hidpi (1920x1080, DPR 2: 3840x2160 device pixels), mobile (390x844, DPR 3, touch, and
 * the main thread slowed 4x through CDP CPU throttling: a mobile-LIKE case, not a phone).
 *
 * Per scene it records: rAF frame intervals, main-thread time spent inside rAF callbacks per frame, WebGL draw calls per
 * frame, 2D-canvas drawing calls per frame, CDP Performance metric deltas, the shadow module's own counters (its build time
 * per frame, lights, candidate / active casters, primitives, dynamic polygons, lamp cache) when present, and a screenshot.
 * Software rendering on a small container is evidence, not hardware certification. */
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const H = require('./harness_lib.js');
const { sleep } = H;

const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..'));
const OUT = path.resolve(opt('out') || path.join(__dirname, 'evidence', 'bench'));
const LABEL = opt('label') || '';
const SECS = +(opt('secs') || 4), MINFRAMES = +(opt('minframes') || 20);
const PORT = +(opt('port') || 9461);
const PROFILES = {
  '16x9': { viewport: { width: 1280, height: 720 }, dpr: 1 },
  hidpi: { viewport: { width: 1920, height: 1080 }, dpr: 2 },
  mobile: { viewport: { width: 390, height: 844 }, dpr: 3, mobile: true, throttle: 4 },
};
const profiles = (opt('profiles') || '16x9,hidpi,mobile').split(',');
const sceneList = (opt('scenes') || 'room,props,dense,sweep,peers,blackout,flicker,entities').split(',');
const tierArg = opt('tiers');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(path.join(OUT, 'bench.log'), s + '\n'); };

/* scenes: where the player stands and how the light is aimed (world px).  Chosen from the shipped map:
 *   room     YELLOW HALL spawn area: the lamp beside spawn, a partition wall at arm's length, flashlight aimed along the room
 *   props    the reception counter L1 seen from the south, flashlight on it, lamp light around
 *   dense    PILLAR HALL: pillars + partition walls + several lamps in view - the most casters on screen
 *   sweep    PILLAR HALL, the flashlight sweeping a full turn at 1.6 rad/s between the pillars
 *   peers    the room spot with three other wanderers (flashlight, headlamp, lantern) standing around, lights on
 *   blackout the room spot during a forced blackout: lamps out, only the flashlight
 *   flicker  beside lamp #0 (a dim flickering fixture: index % 13 == 0)
 *   entities a hound and a smiler brought near, the wanderer ~230 px from the hound with the light on it */
const SCENES = {
  room: { at: [1060, 3300], aim: -0.25, lights: 'off' },
  props: { at: [1776, 3460], aim: -Math.PI / 2 - 0.15, lights: 'off' },
  dense: { at: [7860, 1150], aim: 0.65, lights: 'off' },
  sweep: { at: [7860, 1150], aim: 0, sweep: 1.6, lights: 'off' },
  peers: { at: [1060, 3300], aim: -0.25, lights: 'off', peers: [['flashlight', '#ffe7b2', 150, -120], ['headlamp', '#cfe6ff', -120, 140], ['lantern', '#ffc277', 210, 120]] },
  blackout: { at: [1060, 3300], aim: -0.25, lights: 'on' },
  flicker: { at: [600, 2930], aim: -2.2, lights: 'off' },
  entities: { at: [1060, 3300], aim: -0.25, lights: 'off', entities: true },
};

function get(p) { return new Promise(res => { http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }

/* a scripted wanderer over the real WebSocket protocol (the live.js client format), with real admin rights to stand where we want */
class Peer {
  constructor(room, name, kind, color) {
    Object.assign(this, { name, kind, color, id: 0, admin: null, pos: { x: 0, y: 0 }, angle: 0, timer: null });
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`);
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === 'hi') this.id = m.id; else if (m.t === 'admin') this.admin = m; else if (m.t === 'tp') this.pos = { x: m.x, y: m.y }; };
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  start() { this.send({ t: 'join' }); this.timer = setInterval(() => this.send({ t: 'p', x: Math.round(this.pos.x), y: Math.round(this.pos.y), vx: 0, vy: 0, a: +this.angle.toFixed(2), r: 0, l: 1, k: this.kind, n: this.name, c: this.color, mv: { s: 0, st: 100, ex: 0, sp: 0, ev: [] } }), 50); }
  async walkTo(x, y, speed = 220) { for (let i = 0; i < 400; i++) { const dx = x - this.pos.x, dy = y - this.pos.y, d = Math.hypot(dx, dy); if (d < 2) break; const s = Math.min(d, speed / 20); this.pos = { x: this.pos.x + dx / d * s, y: this.pos.y + dy / d * s }; await sleep(50); } }
  close() { clearInterval(this.timer); try { this.ws.close(); } catch (e) { } }
}

/* runs in the page before any game script (after harness_lib's own init): frame / callback / draw-call accounting */
const INSTRUMENT = `(() => {
  const S = window.__bench = { on: false, frames: [], gl: 0, c2d: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  let ts0 = -1, cpu = 0, gl0 = 0, c0 = 0;
  window.requestAnimationFrame = function (cb) {
    return raf(function (ts) {
      if (ts !== ts0) { if (S.on && ts0 >= 0) S.frames.push([ts0, cpu, S.gl - gl0, S.c2d - c0]); ts0 = ts; cpu = 0; gl0 = S.gl; c0 = S.c2d; }
      const t = performance.now(); try { return cb(ts); } finally { cpu += performance.now() - t; }
    });
  };
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) if (C) for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
    const f = C.prototype[m]; if (f) C.prototype[m] = function () { S.gl++; return f.apply(this, arguments); };
  }
  const P = CanvasRenderingContext2D.prototype;
  for (const m of ['fill', 'stroke', 'fillRect', 'clearRect', 'strokeRect', 'clip', 'drawImage', 'putImageData', 'fillText']) { const f = P[m]; if (f) P[m] = function () { S.c2d++; return f.apply(this, arguments); }; }
})();`;

const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + .5))]; };
const stat = a => a.length ? { n: a.length, mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3), p50: +pct(a, .5).toFixed(3), p95: +pct(a, .95).toFixed(3), p99: +pct(a, .99).toFixed(3), max: +Math.max(...a).toFixed(3) } : null;

async function setupPage(browser, prof, room) {
  const pr = PROFILES[prof];
  const J = await H.join(browser, PORT, room, 'BENCH', { viewport: pr.viewport, dpr: pr.dpr, mobile: !!pr.mobile, init: INSTRUMENT });
  const P = J.P, staged = await H.stage(P);
  const cdp = await J.ctx.newCDPSession(P); await cdp.send('Performance.enable');
  if (pr.throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: pr.throttle });
  const env = await P.evaluate(() => { let r = null; try { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); r = e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; } catch (e) { }
    return { dpr: devicePixelRatio, inner: [innerWidth, innerHeight], cores: navigator.hardwareConcurrency, renderer: r, shadows: !!window.__shadows, shadowQualityDefault: window.__shadows ? __shadows.quality() : null, lightCanvas: (c => [c.width, c.height])(document.getElementById('light')), pixi: (c => c ? [c.width, c.height] : null)(document.querySelector('#game canvas')) }; });
  env.cpuThrottle = pr.throttle || 1; env.staged = staged;
  return { ctx: J.ctx, P, errs: J.errs, cdp, env, missing: J.missing };
}

async function measure(S, scene, tier, name) {
  const { P, cdp } = S;
  /* settle in frames, not seconds (software rendering at 4K or under CPU throttling draws ~1 frame a second): at least 8
   * frames and until the lamp caches have stopped building for 4 frames (they build 1-2 per frame and ease in) */
  const has = await P.evaluate(() => !!(window.__shadows && __shadows.resetStats));
  await H.frames(P, 8);
  if (has) for (let i = 0, b0 = -1, still = 0; i < 60 && still < 4; i++) { const b = await P.evaluate(() => __shadows.stats().cache.lampBuilds); still = b === b0 ? still + 1 : 0; b0 = b; await H.frames(P, 1); }
  if (has) await P.evaluate(() => __shadows.resetStats());
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  await P.evaluate(() => { __bench.frames = []; __bench.on = true; });
  /* measure for SECS, longer if needed to get at least MINFRAMES frames (capped at 45 s) */
  const t0 = Date.now(); await sleep(SECS * 1000);
  while (Date.now() - t0 < 45000 && await P.evaluate(() => __bench.frames.length) < MINFRAMES) await sleep(500);
  await P.evaluate(() => { __bench.on = false; });
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const fr = await P.evaluate(() => __bench.frames);
  const iv = []; for (let i = 1; i < fr.length; i++) iv.push(fr[i][0] - fr[i - 1][0]);
  const n = Math.max(1, fr.length);
  const sh = has ? await P.evaluate(() => __shadows.stats()) : null;
  const shot = `${name}.jpg`;
  await P.screenshot({ path: path.join(OUT, shot), type: 'jpeg', quality: 72, scale: 'css' });
  const st = await P.evaluate(() => ({ x: Math.round(__api.H.x), y: Math.round(__api.H.y), angle: +__api.H.angle.toFixed(3), lightOn: __api.lightOn(), blackout: !!__api.V.blackout, peers: (window.__peerLights || []).length,
    hounds: (window.__hounds || []).filter(Boolean).length, smilers: __api.q.filter(o => o && !o.off).length }));
  const secs = fr.length > 1 ? (fr[fr.length - 1][0] - fr[0][0]) / 1000 : SECS;
  return { scene, tier, frames: fr.length, fps: +((fr.length - 1) / Math.max(.001, secs)).toFixed(2), frameIntervalMs: stat(iv), rafCpuMsPerFrame: stat(fr.map(f => f[1])), webglDrawCallsPerFrame: stat(fr.map(f => f[2])), canvas2dCallsPerFrame: stat(fr.map(f => f[3])),
    cdpPerFrameMs: { task: +((m1.TaskDuration - m0.TaskDuration) * 1000 / n).toFixed(3), script: +((m1.ScriptDuration - m0.ScriptDuration) * 1000 / n).toFixed(3), layout: +((m1.LayoutDuration - m0.LayoutDuration) * 1000 / n).toFixed(3) },
    heapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(2), shadows: sh, state: st, screenshot: shot };
}

(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: ['ignore', 'pipe', 'pipe'] });
  let slog = ''; srv.stdout.on('data', d => slog += d); srv.stderr.on('data', d => slog += d);
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS });
  const R = { schema: 'tfb-shadows-bench/2', label: LABEL, game: GAME, secs: SECS, minFrames: MINFRAMES, node: process.version, chromium: browser.version(), started: new Date().toISOString(), runs: [], errors: {} };
  try {
    for (const prof of profiles) {
      const room = 'bench' + prof + Date.now() % 100000;
      const S = await setupPage(browser, prof, room);
      R.env = R.env || {}; R.env[prof] = S.env; log('profile', prof, S.env);
      const tiers = tierArg ? tierArg.split(',') : (S.env.shadows ? ['off', 'low', 'medium', 'high'] : ['baseline']);
      const scenes = prof === '16x9' ? sceneList : sceneList.filter(s => ['room', 'dense', 'sweep', 'peers'].includes(s));
      for (const sc of scenes) {
        const D = SCENES[sc]; const peers = [];
        if (!(await H.setLights(S.P, D.lights))) log('WARN lights not confirmed', sc, D.lights);
        const at = await H.place(S.P, D.at[0], D.at[1], D.aim, { sweep: D.sweep || 0 });
        if (D.entities) {                                                     // a hound and a smiler brought near, then the wanderer steps back ~230 px and lights the hound
          const h = await H.near(S.P, 'hound'); await H.near(S.P, 'smiler');
          const spot = h && await S.P.evaluate(([hx, hy]) => { const A = __api; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = hx + Math.cos(a) * 230, y = hy + Math.sin(a) * 230;
            if (A.sl(x, y, 26) && A.Uc(x, y, Math.atan2(hy - y, hx - x), 230) >= 200) return [Math.round(x), Math.round(y), Math.atan2(hy - y, hx - x)]; } return null; }, h);
          if (spot) { await H.place(S.P, spot[0], spot[1], spot[2]); await sleep(600); }
        }
        if (D.peers) {
          for (const [kind, color] of D.peers) { const p = new Peer(room, 'PEER-' + kind.toUpperCase(), kind, color); await p.ready; p.start(); p.send({ t: 'admin', pass: 'smoor' }); peers.push(p); }
          await sleep(1200);
          for (const p of peers) { const me = p.admin && p.admin.pl && p.admin.pl.find(q => q.n === 'BENCH'); if (me) p.send({ t: 'a', c: 'goto', id: me.id }); }
          await sleep(700);
          await Promise.all(peers.map(async (p, i) => { const [, , dx, dy] = D.peers[i];
            const tgt = await S.P.evaluate(([x, y]) => { const A = __api; if (A.sl(x, y, 26)) return [x, y]; for (let d = 8; d < 200; d += 8) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, X = x + Math.cos(a) * d, Y = y + Math.sin(a) * d; if (A.sl(X, Y, 26)) return [Math.round(X), Math.round(Y)]; } return null; }, [at[0] + dx, at[1] + dy]);
            if (tgt) await p.walkTo(tgt[0], tgt[1]); p.angle = Math.atan2(at[1] - p.pos.y, at[0] - p.pos.x) + (i - 1) * .35; }));
          await sleep(800);
        }
        for (const tier of tiers) {
          if (tier !== 'baseline') await S.P.evaluate(t => window.__shadows && __shadows.setQuality(t), tier);
          const name = `${prof}-${sc}-${tier}`;
          const r = Object.assign({ profile: prof }, await measure(S, sc, tier, name));
          R.runs.push(r); log(name, { fps: r.fps, cpu: r.rafCpuMsPerFrame && r.rafCpuMsPerFrame.mean, iv95: r.frameIntervalMs && r.frameIntervalMs.p95, gl: r.webglDrawCallsPerFrame && r.webglDrawCallsPerFrame.mean, c2d: r.canvas2dCallsPerFrame && r.canvas2dCallsPerFrame.mean, sh: r.shadows && { b: r.shadows.buildMs, l: r.shadows.lights, c: r.shadows.casters, d: r.shadows.dynamicPolys }, st: r.state });
          fs.writeFileSync(path.join(OUT, 'bench.json'), JSON.stringify(R, null, 1) + '\n');
        }
        for (const p of peers) p.close();
        if (D.entities) await H.stage(S.P);
        if (peers.length) for (let i = 0; i < 40 && await S.P.evaluate(() => (window.__peerLights || []).length); i++) await sleep(250);   // the room forgets them
      }
      R.errors[prof] = S.errs; R.missing = R.missing || {}; R.missing[prof] = [...new Set(S.missing)]; await S.ctx.close();
    }
  } catch (e) { R.fatal = String(e && e.stack || e).slice(0, 1200); log('FATAL', R.fatal); }
  finally {
    R.finished = new Date().toISOString(); R.serverLog = slog.split('\n').slice(0, 40);
    fs.writeFileSync(path.join(OUT, 'bench.json'), JSON.stringify(R, null, 1) + '\n');
    await browser.close(); srv.kill('SIGTERM');
    log('done', R.runs.length, 'runs', R.fatal ? 'FATAL' : 'ok', 'page errors:', JSON.stringify(R.errors));
    process.exit(R.fatal ? 1 : 0);
  }
})();
