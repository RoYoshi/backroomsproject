/* Stage 3B-L QA2 - what building the sight polygons costs per frame, QA1 parent vs QA2 (development only; never served).
 * (From the Stage 3B pillar LOS work's perf_los.js; QA2's paths.)
 *
 *   node dev/stage-3b-l-qa2/perf_hl_qa2.js --parent DIR [--game PATH] [--rounds 9] [--out FILE.json]
 *
 * MICRO (default).  The renderer builds two polygons every frame: Hl(x, y, 700) (entity mask) and Hl(x, y, 700, 24)
 * (darkness clip).  Both builds' LOS code (the map tables, Uc, Vl, Hl), cut verbatim from each bundle, run side by side in
 * one Chromium page (the browser's own JavaScript engine), interleaved round by round (the order alternating), on four
 * paths: an empty corridor walked 2 px a frame (YELLOW HALL -> NORTH ROOMS), YELLOW HALL walked across (partitions and
 * corners), standing at PILLAR HALL's centre (every pillar in reach), and circling a pillar 45 px from its centre 2 degrees
 * a frame.  Per round: the mean per frame; reported: the median and the worst round, and the rays per frame.
 *
 * INGAME (--ingame).  The real client at MEDIUM, 1920 x 1080, lamps on, no monsters, the player moved along the same pillar
 * circle every frame: the DevTools sampling profiler (50 us) over --seconds, the time with Hl on the stack (Uc included)
 * per rendered frame, and the frame interval.  Run once per build (--game PATH). */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PARENT = opt('parent') ? path.resolve(opt('parent')) : null;
const ROUNDS = +(opt('rounds') || 9), OUT = opt('out'), BUNDLE = 'assets/index-DKbV5Nv9.js';
const cutLos = root => { const B = fs.readFileSync(path.join(root, BUNDLE), 'utf8'), cut = (a, b) => { const i = B.indexOf(a), j = B.indexOf(b, i); if (i < 0 || j < 0) throw Error('marker ' + a); return B.slice(i, j); };
  return cut('var FBW=96', 'var Wc={kind:') + ';\nvar ' + cut('Vl=[];for(let e=0;e<=FBH', 'function Ul(') + ';\nreturn {Hl,Uc,Pc};'; };
const CX = 8592, CY = 1392;
const PATHS = {
  corridor: Array.from({ length: 145 }, (_, k) => [1152, 2160 - 2 * k]),
  yellowHall: Array.from({ length: 178 }, (_, k) => [300 + 9 * k, 3020]),
  hallCentre: Array.from({ length: 145 }, () => [8040, 1290]),
  nearPillar: Array.from({ length: 180 }, (_, k) => [CX + Math.cos(k * 2 * Math.PI / 180) * 45, CY + Math.sin(k * 2 * Math.PI / 180) * 45]),
};
async function micro() {
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { mode: 'micro', game: GAME, parent: PARENT, rounds: ROUNDS, paths: {} };
  try {
    const P = await (await browser.newContext()).newPage(); await P.goto('about:blank');
    await P.addScriptTag({ content: fs.readFileSync(path.join(GAME, 'world.js'), 'utf8') });
    await P.evaluate(([a, b, paths]) => { window.__V = { parent: new Function(a)(), fix: new Function(b)() }; window.__paths = paths; }, [cutLos(PARENT), cutLos(GAME), PATHS]);
    const res = {}; for (const k of Object.keys(PATHS)) res[k] = { parent: [], fix: [], rays: {} };
    for (let round = 0; round < ROUNDS + 1; round++) {
      const order = round % 2 ? ['fix', 'parent'] : ['parent', 'fix'];
      for (const v of order) for (const k of Object.keys(PATHS)) {
        const o = await P.evaluate(([v, k]) => { const { Hl } = window.__V[v], ps = window.__paths[k]; let rays = 0;
          const t0 = performance.now(); for (let rep = 0; rep < 4; rep++) for (const [x, y] of ps) { const a = Hl(x, y, 700), b = Hl(x, y, 700, 24); rays += (a.length + b.length) / 2; }
          const t1 = performance.now(); return { ms: (t1 - t0) / (4 * ps.length), rays: rays / (4 * ps.length) }; }, [v, k]);
        if (round > 0) res[k][v].push(o.ms); res[k].rays[v] = +o.rays.toFixed(1);       /* round 0: warm-up (JIT) */
      }
    }
    const med = a => { const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
    for (const [k, r] of Object.entries(res)) { R.paths[k] = { parentMsPerFrame: { median: +med(r.parent).toFixed(4), worstRound: +Math.max(...r.parent).toFixed(4) }, fixMsPerFrame: { median: +med(r.fix).toFixed(4), worstRound: +Math.max(...r.fix).toFixed(4) }, raysPerFrame: r.rays, rounds: { parent: r.parent.map(v => +v.toFixed(4)), fix: r.fix.map(v => +v.toFixed(4)) } };
      console.log(k.padEnd(11), 'ms / frame (both polygons): parent', R.paths[k].parentMsPerFrame.median, '-> fix', R.paths[k].fixMsPerFrame.median, '| worst round', R.paths[k].parentMsPerFrame.worstRound, '->', R.paths[k].fixMsPerFrame.worstRound, '| rays / frame', r.rays.parent, '->', r.rays.fix); }
  } finally { await browser.close(); }
  return R;
}
async function ingame() {
  const PORT = +(opt('port') || 9493), SECS = +(opt('seconds') || 25);
  const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' }); for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { mode: 'ingame', game: GAME, quality: 'medium' };
  try {
    const J = await H.join(browser, PORT, 'plp' + Date.now() % 1e5, 'PLP', { viewport: { width: 1920, height: 1080 }, query: '&lighting=medium' }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off'); await H.place(P, CX + 45, CY, Math.PI, { light: false });
    for (let k = 0; k < 200; k++) { await frames(P, 4); const ok = await P.evaluate(() => { const B = window.__brRole; if (!B || !B.dev || !B.dev.farReady) return true; const s = B.stats(); return B.dev.farReady() && s.lamps.pending === 0; }); if (ok) break; }
    /* move 2 degrees round the pillar every rendered frame */
    await P.evaluate(([cx, cy]) => { let k = 0; window.__orbitN = 0; const f = () => { if (window.__orbitStop) return; k++; const a = k * 2 * Math.PI / 180; __api.tp(cx + Math.cos(a) * 45, cy + Math.sin(a) * 45); window.__aimA = a + Math.PI; window.__orbitN++; requestAnimationFrame(f); }; requestAnimationFrame(f); }, [CX, CY]);
    await sleep(3000);
    const cdp = await P.context().newCDPSession(P); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
    const n0 = await P.evaluate(() => window.__orbitN), t0 = Date.now(); await cdp.send('Profiler.start'); await sleep(SECS * 1000);
    const { profile } = await cdp.send('Profiler.stop'); const n1 = await P.evaluate(() => window.__orbitN), t1 = Date.now(); await P.evaluate(() => { window.__orbitStop = 1; });
    /* inclusive time of Hl: samples whose stack has a node named Hl */
    const parent = new Map(); for (const nd of profile.nodes) for (const c of nd.children || []) parent.set(c, nd.id);
    const byId = new Map(profile.nodes.map(n => [n.id, n])), underHl = new Map();
    const isUnder = id => { if (underHl.has(id)) return underHl.get(id); const nd = byId.get(id); const v = nd.callFrame.functionName === 'Hl' || (parent.has(id) && isUnder(parent.get(id))); underHl.set(id, v); return v; };
    let hl = 0, all = 0; const dts = profile.timeDeltas; for (let i = 0; i < profile.samples.length; i++) { const dt = (dts[i + 1] || 0) / 1000; all += dt; if (isUnder(profile.samples[i])) hl += dt; }
    const fr = n1 - n0; R.frames = fr; R.seconds = (t1 - t0) / 1000; R.frameIntervalMs = +(1000 * R.seconds / fr).toFixed(1); R.hlMsPerFrame = +(hl / fr).toFixed(3); R.profiledMs = +all.toFixed(0);
    console.log('in game (MEDIUM, circling a pillar 2 deg a frame):', fr, 'frames in', R.seconds, 's | frame interval', R.frameIntervalMs, 'ms | Hl (both polygons, Uc included)', R.hlMsPerFrame, 'ms / frame');
    R.errs = J.errs;
  } finally { await browser.close(); srv.kill(); }
  return R;
}
(async () => { const R = argv.includes('--ingame') ? await ingame() : await micro(); if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); })().catch(e => { console.error(e); process.exit(1); });
