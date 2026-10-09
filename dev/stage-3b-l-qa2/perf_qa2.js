/* Stage 3B-L QA2 - performance after warm-up, one build (development only; never served).  perf_ab_qa2.js runs it for the
 * QA1 parent and QA2 in turn and compares.
 *
 *   node dev/stage-3b-l-qa2/perf_qa2.js [--game PATH] [--port 9483] [--quality medium] [--scenes A,D,..] [--secs 4] [--out FILE.json]
 *
 * 1920 x 1080 (the accepted 1.25 camera), no monsters.  Per scene: arrive, let every lamp in view be built (its far field and
 * bounce light too), then measure `secs` standing and `secs` walking (D held): the page's frame interval (rAF), BR-RoLE's own
 * time per frame (its counters), and from the DevTools sampling profiler (100 us) the time per rendered frame spent in the
 * game's drawLight (the whole darkness overlay: BR-RoLE, the clip, the camcorder's infrared fans in the parent) and in Hl (the
 * two sight polygons, Uc included).
 * Scenes - night vision OFF (the visible world): A YELLOW HALL, D PILLAR HALL, H the long corridor, E the BLACKOUT ZONE with a
 * flashlight, K a flashlight across a convex corner; night vision ON (the camcorder raised, the emitter on): NA YELLOW HALL
 * (lamps on, LOW), NB the BLACKOUT ZONE (HIGH), NP PILLAR HALL (lamps on, LOW).
 * NOTE: software rendering (SwiftShader, 2 CPUs): far slower than any GPU; only the two builds against each other mean
 * anything, on the same scenes, interleaved. */
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./qa2_lib.js'); const { H, frames, sleep } = Q;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9483), QUAL = opt('quality') || 'medium', SECS = +(opt('secs') || 4), OUT = opt('out');
const C = c => c * 96 + 48;
const ALL = [
  ['A', 'YELLOW HALL (NV off)', { x: C(12), y: C(35), aim: 0 }],
  ['D', 'PILLAR HALL (NV off)', { x: C(82), y: C(12), aim: 0 }],
  ['H', 'long corridor (NV off)', { x: C(11.5), y: C(22), aim: -Math.PI / 2 }],
  ['E', 'BLACKOUT ZONE, flashlight (NV off)', { x: C(13), y: C(53), aim: Math.PI, kind: 'flashlight', blackout: true }],
  ['K', 'flashlight across a convex corner (NV off)', { x: 1136, y: 5360, aim: -2.356, kind: 'flashlight', blackout: true }],
  ['NA', 'YELLOW HALL, NV on, IR LOW', { x: C(12), y: C(35), aim: 0, kind: 'camcorder', nv: true, ir: 1 }],
  ['NB', 'BLACKOUT ZONE, NV on, IR HIGH', { x: C(13), y: C(53), aim: Math.PI, kind: 'camcorder', nv: true, ir: 2, blackout: true }],
  ['NP', 'PILLAR HALL, NV on, IR LOW', { x: C(82), y: C(12), aim: Math.PI, kind: 'camcorder', nv: true, ir: 1 }],
];
const ONLY = opt('scenes') ? opt('scenes').split(',') : null, SCENES = ALL.filter(s => !ONLY || ONLY.includes(s[0]));
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + .5))]; };
(async () => {
  const s = await Q.open(GAME, PORT, { quality: QUAL }), P = s.P, R = { game: GAME, quality: QUAL, secs: SECS, rows: [] };
  try {
    R.version = await P.evaluate(() => __brRole.version);
    const cdp = await P.context().newCDPSession(P); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
    const measure = async walk => {
      await P.evaluate(() => { __brRole.resetStats(); window.__pf = []; let last = performance.now(); const f = () => { if (!window.__pf) return; const t = performance.now(); window.__pf.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await cdp.send('Profiler.start'); if (walk) await P.keyboard.down('KeyD'); await sleep(SECS * 1000); if (walk) await P.keyboard.up('KeyD');
      const { profile } = await cdp.send('Profiler.stop');
      const r = await P.evaluate(() => { const d = window.__pf; window.__pf = null; return { dt: d.slice(1), s: __brRole.stats() }; });
      /* inclusive time of drawLight / Hl / BR-RoLE's draw: samples with that function on the stack */
      const par = new Map(); for (const nd of profile.nodes) for (const c of nd.children || []) par.set(c, nd.id);
      const byId = new Map(profile.nodes.map(n => [n.id, n])), memo = new Map();
      const tags = id => { if (memo.has(id)) return memo.get(id); const nd = byId.get(id), f = nd.callFrame, up = par.has(id) ? tags(par.get(id)) : 0;
        const t = up | (f.functionName === 'drawLight' ? 1 : 0) | (f.functionName === 'Hl' ? 2 : 0) | (f.functionName === 'draw' && /br-role\.js/.test(f.url) ? 4 : 0) | (f.functionName === 'irLight' || f.functionName === 'drawFan' ? 8 : 0); memo.set(id, t); return t; };
      const tot = [0, 0, 0, 0]; const dts = profile.timeDeltas; for (let i = 0; i < profile.samples.length; i++) { const dt = (dts[i + 1] || 0) / 1000, t = tags(profile.samples[i]); for (let b = 0; b < 4; b++) if (t & (1 << b)) tot[b] += dt; }
      const fr = Math.max(1, r.dt.length);
      return { frames: r.dt.length, pageMs: { mean: +(r.dt.reduce((a, b) => a + b, 0) / fr).toFixed(1), p95: +pct(r.dt, .95).toFixed(1) }, brMs: r.s.frameMs, lamps: r.s.lamps.last, ir: r.s.ir ? r.s.ir.last : null,
        drawLightMs: +(tot[0] / fr).toFixed(2), hlMs: +(tot[1] / fr).toFixed(3), brDrawMs: +(tot[2] / fr).toFixed(2), irMs: +(tot[3] / fr).toFixed(2) };
    };
    for (const [id, label, sc] of SCENES) {
      await H.stage(P); await P.evaluate(() => __brRole.resetStats());
      const st = await Q.scene(s, sc); await P.evaluate(() => window.__clock.thaw());          // (the clock runs while measuring)
      /* the warm-up this arrival cost: lamp field builds, far + bounce builds (and the longest frame step), BR-RoLE's longest frame */
      const warm = await P.evaluate(() => { const s = __brRole.stats(); return { lampBuilds: s.lamps.builds, lampBuildMs: s.lamps.buildMs, lampBuildMaxMs: s.lamps.buildMaxMs, far: s.far ? { builds: s.far.builds, buildMs: s.far.buildMs, frameMaxMs: s.far.frameMaxMs, phaseMaxMs: s.far.phaseMaxMs } : null, brMaxMs: s.frameMs.max }; });
      if (sc.kind === 'camcorder') await P.evaluate(([nv, ir]) => { const c = window.__cam; c.S.nvOn = nv; c.S.ir = ir; c.S.heat = 0; c.S.locked = false; c.CFG.IR[1].heat = 0; c.CFG.IR[2].heat = 0; }, [sc.nv, sc.ir]);   // (no overheating while measuring)
      await frames(P, 30);
      const stand = await measure(false), walk = await measure(true);
      const row = { id, scene: label, at: [st.x, st.y], warmUp: warm, nv: await P.evaluate(() => !!(window.__cam && __cam.nv)), ir: await P.evaluate(() => window.__cam ? __cam.ir : 0), standing: stand, walking: walk };
      R.rows.push(row);
      console.log(`${id} | ${label} | standing: page ${stand.pageMs.mean} ms, drawLight ${stand.drawLightMs}, BR ${stand.brMs.mean} (${stand.brDrawMs}), Hl ${stand.hlMs}, IR ${stand.irMs} | walking: page ${walk.pageMs.mean}, drawLight ${walk.drawLightMs}, BR ${walk.brMs.mean}, Hl ${walk.hlMs}, IR ${walk.irMs} | nv ${row.nv} ir ${row.ir}`);
      await H.stage(P);
    }
    R.errs = s.J.errs;
  } finally { await Q.close(s); }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
