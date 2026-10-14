/* Stage 3E-0 - the site icon is served, and nothing else newly is (development only)
 *
 *   node dev/stage-3e-0/static_check.js --game DIR --ico SUPPLIED_FAVICON [--out FILE.json]
 *
 * Starts DIR's server.js (synthetic admin passcode) and asks it over HTTP:
 *   /favicon.ico      200, Content-Type image/x-icon, the bytes byte-identical to SUPPLIED_FAVICON (asked without gzip, and with gzip
 *                     then unzipped); HEAD is not required (a GET is enough, as the contract says)
 *   /                 200, the page names the icon once (<link rel="icon" type="image/x-icon" href="./favicon.ico">)
 *   protected paths   404: /server.js, /server/static.js, /.git/config, /dev/, /dev/stage-3e-0/net_lab.js, /sim.js, /package.json,
 *                     /favicon.ico.bak, /other.ico, /assets/../server.js, /%2e%2e/server.js, /sounds/../server.js
 * Exit 0 only if every answer is as listed. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), net = require('net'), http = require('http'), zlib = require('zlib'), crypto = require('crypto');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game), ICO = fs.readFileSync(ARG.ico), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const get = (port, p, enc) => new Promise(res => {
  const r = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers: { 'Accept-Encoding': enc || 'identity' } }, rs => { const ch = []; rs.on('data', d => ch.push(d)); rs.on('end', () => res({ status: rs.statusCode, headers: rs.headers, body: Buffer.concat(ch) })); });
  r.on('error', e => res({ status: -1, error: String(e) })); r.end();
});
(async () => {
  const port = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: 'd3-synthetic-admin' }); delete env.PORT;
  const srv = spawn('node', ['server.js', String(port)], { cwd: GAME, env, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
  const R = { tool: 'dev/stage-3e-0/static_check.js', suppliedSha256: sha(ICO), checks: {} };
  try {
    const a = await get(port, '/favicon.ico'), g = await get(port, '/favicon.ico', 'gzip');
    const gz = g.headers && g.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(g.body) : g.body;
    R.checks.favicon = { status: a.status, type: a.headers['content-type'], bytes: a.body.length, sha256: sha(a.body), cache: a.headers['cache-control'],
      gzipStatus: g.status, gzipEncoding: g.headers['content-encoding'] || null, gzipUnzippedSha256: sha(gz),
      ok: a.status === 200 && a.headers['content-type'] === 'image/x-icon' && a.body.equals(ICO) && g.status === 200 && gz.equals(ICO) };
    const h = await get(port, '/'), html = h.body.toString('utf8'), links = html.match(/<link[^>]*rel="icon"[^>]*>/g) || [];
    R.checks.page = { status: h.status, iconLinks: links, ok: h.status === 200 && links.length === 1 && links[0] === '<link rel="icon" type="image/x-icon" href="./favicon.ico">' };
    const prot = ['/server.js', '/server/static.js', '/.git/config', '/dev/', '/dev/stage-3e-0/net_lab.js', '/sim.js', '/package.json', '/favicon.ico.bak', '/other.ico', '/assets/../server.js', '/%2e%2e/server.js', '/sounds/../server.js'];
    R.checks.protected = {}; for (const p of prot) R.checks.protected[p] = (await get(port, p)).status;
    R.checks.protectedOk = Object.values(R.checks.protected).every(s => s === 404 || s === 400);
  } finally { srv.kill(); }
  R.ok = R.checks.favicon.ok && R.checks.page.ok && R.checks.protectedOk;
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R)); process.exit(R.ok ? 0 : 1);
})();
