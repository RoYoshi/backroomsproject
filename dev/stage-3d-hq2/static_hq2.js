/* Stage 3D HQ2 - what the server serves of HQ2's own files (development only)
 *
 *   node dev/stage-3d-hq2/static_hq2.js --game DIR [--out FILE.json]
 *
 * dev/stage-3d/static_check.js asks 3D's paths; this asks HQ2's.  The server-only code HQ2 added (server/peers.js), HQ2's tools, evidence
 * and reports must never be served (404); the client files HQ2 changed are served as before (200, JavaScript).  Exit 0 when they are. */
'use strict';
const { spawn } = require('child_process'), http = require('http'), net = require('net'), fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || '.'), sleep = ms => new Promise(r => setTimeout(r, ms));
const HIDDEN = ['/server/peers.js', '/server/../server/peers.js', '/%73erver/peers.js', '/dev/stage-3d-hq2/proto_lab.js', '/dev/stage-3d-hq2/mutate.py', '/dev/stage-3d-hq2/evidence/h2-4/SUMMARY.md',
  '/dev/stage-3d-hq2/README.md', '/STAGE_3D_HQ2_AUDIT.md', '/STAGE_3D_HQ2_PLAYER_COLLISION.md', '/STAGE_3D_HQ2_NEW_RUN_AUTHORITY.md', '/STAGE_3D_HQ2_SOURCE_PARENT_AND_CHECKPOINTS.md', '/dev/sim_glue.js', '/sim.js', '/server.js', '/death_srv.js'];
const SERVED = ['/mp.js', '/move.js', '/gore.js', '/ents.js', '/dphys.js', '/assets/index-DKbV5Nv9.js'];
const get = (port, p) => new Promise(res => { const r = http.get({ host: '127.0.0.1', port, path: p }, x => { let n = 0; x.on('data', d => n += d.length); x.on('end', () => res({ status: x.statusCode, type: x.headers['content-type'] || '', bytes: n })); }); r.on('error', e => res({ status: 0, err: String(e) })); });
(async () => {
  const port = await new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: 'd3-synthetic-admin' }); delete env.PORT;
  const srv = spawn('node', ['server.js', String(port)], { cwd: GAME, env, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
  const out = { tool: 'dev/stage-3d-hq2/static_hq2.js', game: GAME, hidden: {}, served: {}, bad: [] };
  try {
    for (const p of HIDDEN) { const r = out.hidden[p] = await get(port, p); if (r.status !== 404) out.bad.push(['served but must not be', p, r.status]); }
    for (const p of SERVED) { const r = out.served[p] = await get(port, p); if (r.status !== 200 || !/javascript/.test(r.type)) out.bad.push(['not served as JavaScript', p, r.status, r.type]); }
  } finally { srv.kill('SIGTERM'); }
  out.ok = !out.bad.length;
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  for (const [p, r] of Object.entries(out.hidden)) console.log(`hidden ${p.padEnd(52)} ${r.status}`);
  for (const [p, r] of Object.entries(out.served)) console.log(`served ${p.padEnd(52)} ${r.status} ${r.type}`);
  console.log(out.ok ? 'STATIC HQ2: nothing of HQ2 that must stay on the server is served; the client files are' : 'STATIC HQ2: FAIL ' + JSON.stringify(out.bad));
  process.exit(out.ok ? 0 : 1);
})();
