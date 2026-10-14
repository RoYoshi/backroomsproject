/* Stage 3H engine modernization - Stage 3H0's deterministic performance comparison on either layout (development only).  A copy of
 * dev/stage-3h0/golden/perf_det.js (left as it is for the frozen layout).  The differences: the old server.js runs against the working
 * tree's runtime under its old names (dev/tools/layout.js projectOld), the new one in the working tree, both through the layout-aware
 * harness here; the client side uses the layout-aware page runner here; the default --old-ref is the accepted B++ head 143b63f.  The
 * workloads and the pass rule are the original's.  The original's description follows.
 *
 * Stage 3H0 - performance on deterministic workloads: the same inputs, old code against new code, interleaved.
 *
 *   node dev/tools/gate/golden/perf_det.js [--rounds 7] [--old-ref 143b63f] [--out FILE.json] [--only server|client]
 *
 * SERVER: srv_harness.js scenarios lifecycle, deaths, admin, schedule (the same bytes in, the same bytes out), timed with the real
 *   process.cpuUsage() around the scenario only (not module loading).
 * CLIENT: cli_lib.js scenes menu_online, run_online, interp, fx_bodies, hum_dread, timed with the real performance.now() around every call of
 *   mp.js's per-frame hook and of its WebSocket message handler (the fake clock the trace uses is not involved).
 * Rounds alternate old, new, old, new ...  The pass rule, fixed at H0-1 before any extraction and calibrated by an old-against-old run:
 *   tolerance = max(old's spread across rounds, 5 % of old's median) for the server, 10 % for the client;
 *   new passes when its median is at most old's median + tolerance.
 * Without the working tree differing from old (H0-1) this is an A/A run: it shows the noise floor the rule has to live with. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const HERE = __dirname, REPO = path.resolve(HERE, '..', '..', '..', '..'), LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js'));
const ARG = { rounds: '7', 'old-ref': '143b63ff42b88c6780c5043e0f61d64100f81f40' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const R = +ARG.rounds;
const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
function rule(a, b, floor) {
  const am = med(a), bm = med(b), spread = Math.max(...a) - Math.min(...a), tol = Math.max(spread, am * floor);
  return { old: a.map(x => +x.toFixed(3)), new: b.map(x => +x.toFixed(3)), oldMedian: +am.toFixed(3), newMedian: +bm.toFixed(3), tolerance: +tol.toFixed(3), changePct: +((bm - am) / am * 100).toFixed(2), ok: bm <= am + tol };
}
(async () => {
  const res = { tool: 'dev/tools/gate/golden/perf_det.js', rounds: R, oldRef: ARG['old-ref'], node: process.version, cpus: os.cpus().length, startedAt: new Date().toISOString(), server: {}, client: {} };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'h0pd-')), oldSrc = path.join(tmp, 'old_server.js');
  fs.writeFileSync(oldSrc, execFileSync('git', ['-C', REPO, 'show', ARG['old-ref'] + ':server.js']));
  const PROJ = path.join(tmp, 'old_layout'); fs.mkdirSync(PROJ); LAYOUT.projectOld(REPO, PROJ);                         // (this copy)
  if (ARG.only !== 'client') for (const sc of ['lifecycle', 'deaths', 'admin', 'schedule']) {
    const o = [], n = [];
    for (let r = 0; r < R; r++) for (const [src, arr] of [[oldSrc, o], [path.join(REPO, 'server.js'), n]]) {
      const pf = path.join(tmp, 'p.json'), tr = path.join(tmp, 't.jsonl');
      const x = spawnSync(process.execPath, [path.join(HERE, 'srv_harness.js'), '--src', src, '--dir', src === oldSrc ? PROJ : REPO, '--scenario', sc, '--out', tr, '--perf', pf], { encoding: 'utf8', timeout: 600000 });
      if (x.status !== 0) throw new Error(sc + ' harness failed: ' + x.stdout + x.stderr);
      const p = JSON.parse(fs.readFileSync(pf, 'utf8')); arr.push(p.cpuUserMs + p.cpuSysMs);
    }
    res.server[sc] = rule(o, n, .05);
    console.log(`server ${sc}: cpu ms old ${res.server[sc].oldMedian} new ${res.server[sc].newMedian} (${res.server[sc].changePct} %, tol ${res.server[sc].tolerance}) ${res.server[sc].ok ? 'ok' : 'OVER'}`);
  }
  if (ARG.only !== 'server') {
    const L = require('./cli_lib.js'), OLD = L.fromRef(ARG['old-ref']), NEW = L.fromTree(), b = await L.launch();
    for (const sc of ['menu_online', 'run_online', 'interp', 'fx_bodies', 'hum_dread']) {
      const o = { mp: [], msg: [] }, n = { mp: [], msg: [] };
      for (let r = 0; r < R; r++) for (const [v, acc] of [[OLD, o], [NEW, n]]) { const x = await L.runScene(b, v, sc); acc.mp.push(x.perf.mpMs); acc.msg.push(x.perf.msgMs); }
      res.client[sc] = { hookMs: rule(o.mp, n.mp, .10), handlerMs: rule(o.msg, n.msg, .10) };
      console.log(`client ${sc}: hook ms old ${res.client[sc].hookMs.oldMedian} new ${res.client[sc].hookMs.newMedian} (${res.client[sc].hookMs.changePct} %) ${res.client[sc].hookMs.ok ? 'ok' : 'OVER'}; handler ms old ${res.client[sc].handlerMs.oldMedian} new ${res.client[sc].handlerMs.newMedian} (${res.client[sc].handlerMs.changePct} %) ${res.client[sc].handlerMs.ok ? 'ok' : 'OVER'}`);
    }
    await b.close();
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  res.ok = Object.values(res.server).every(x => x.ok) && Object.values(res.client).every(x => x.hookMs.ok && x.handlerMs.ok);
  res.finishedAt = new Date().toISOString();
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
  console.log(res.ok ? 'deterministic performance: within the predeclared tolerance' : 'deterministic performance: OUTSIDE the predeclared tolerance');
  process.exitCode = res.ok ? 0 : 1;
})().catch(e => { console.error('ERROR', e && e.stack || e); process.exitCode = 2; });
