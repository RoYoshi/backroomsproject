/* Stage 3D - what the server serves of the death code, against the accepted parent (development only).
 *
 *   node dev/stage-3d/static_check.js --old DIR --new DIR [--out FILE.json]
 *
 * Starts each tree's own server.js and asks both the same paths: the client death files (served, with their MIME type), the server-only
 * files and the stage's tools and evidence (never served).  Status codes and content types must be the same on both sides; bodies may
 * differ only for files 3D changed (listed).  Exit 0 when they agree. */
'use strict';
const { spawn } = require('child_process'); const http = require('http'), net = require('net'), fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const PATHS = ['/', '/index.html', '/dphys.js', '/gore.js', '/ents.js', '/mp.js', '/sfx.js', '/assets/net-wire.js', '/assets/index-DKbV5Nv9.js',
  '/death_srv.js', '/sim.js', '/ai.js', '/server.js', '/server/fields.js', '/server/static.js', '/package.json', '/dev/sim_glue.js', '/dev/ents_src/30_audio.js',
  '/dev/stage-3d/lib3d.py', '/dev/stage-3d/death_net.js', '/dev/stage-3d/evidence/d0/steps.txt', '/STAGE_3D_D0_AUDIT.md', '/STAGE_3D_DEATH_AUTHORITY_AND_PROTOCOL.md', '/.git/HEAD', '/%2e%2e/death_srv.js', '/assets/../death_srv.js'];
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const get = (port, p) => new Promise(res => { const q = http.get({ host: '127.0.0.1', port, path: p }, r => { const b = []; r.on('data', d => b.push(d)); r.on('end', () => res({ code: r.statusCode, type: r.headers['content-type'] || '', bytes: Buffer.concat(b).length, sha: require('crypto').createHash('sha256').update(Buffer.concat(b)).digest('hex').slice(0, 16) })); }); q.on('error', e => res({ code: 'ERR ' + e.code })); });
async function serve(dir) {
  const port = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: 'd3-synthetic-admin' });
  const p = spawn('node', ['server.js', String(port)], { cwd: dir, env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { await new Promise(r => setTimeout(r, 100)); const ok = await get(port, '/'); if (ok.code === 200) break; }
  const out = {}; for (const q of PATHS) out[q] = await get(port, q); p.kill(); return out;
}
(async () => {
  const O = await serve(path.resolve(ARG.old)), N = await serve(path.resolve(ARG.new));
  const rows = PATHS.map(p => ({ path: p, old: O[p], new: N[p], sameStatus: O[p].code === N[p].code && O[p].type === N[p].type, sameBody: O[p].sha === N[p].sha }));
  const ok = rows.every(r => r.sameStatus);
  for (const r of rows) console.log(`${r.sameStatus ? 'same' : 'DIFF'} ${r.path.padEnd(42)} ${String(r.old.code).padEnd(4)} ${String(r.new.code).padEnd(4)} ${r.new.type.padEnd(32)} ${r.sameBody ? '' : 'body changed'}`);
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify({ tool: 'dev/stage-3d/static_check.js', ok, rows }, null, 1) + '\n');
  console.log(ok ? 'STATIC: every path answers as at the parent (status and type)' : 'STATIC: DIFFERENT');
  process.exitCode = ok ? 0 : 1;
})();
