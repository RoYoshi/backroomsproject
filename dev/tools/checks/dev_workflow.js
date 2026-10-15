#!/usr/bin/env node
/* dev/tools/checks/dev_workflow.js - a developer's round trip on a scratch copy of the project, checked step by step (development tool;
 * added at Stage 3H continuation C5; the gate's workflow step).
 *
 *   node dev/tools/checks/dev_workflow.js [--ref COMMIT] [--out FILE.json] [--keep 1]
 *
 * The copy, in a new scratch folder, is what plays and builds (server.js, package.json, public/, generated/, src/, dev/tools/build/) as
 * it is on disk in the working tree (Git's files and the new ones Git does not ignore; without Git, those folders as they are), or as
 * `git archive` of --ref has it.  Nothing in the working tree is read after that, or written.  On the copy, exactly what QUICKSTART.md
 * tells a developer to do:
 *   1. the built files are what src/ builds (build.js --check), and every output's SHA-256 is noted;
 *   2. a page module is edited (B++'s session, src/frameworks/bpp/client/mp.session.js: the status line's words); build.js --check now
 *      fails (the outputs no longer match the sources); build.js rebuilds, and the only files it writes are public/mp.js and the
 *      manifest; --check passes again;
 *   3. the copy's own server (node server.js PORT, a synthetic admin passcode) serves the new public/mp.js, and a real Chromium page shows
 *      the new words in its status line;
 *   4. a server module is edited (W.A.R.D.'s static file server: one more response header).  It is not built (build.js --check still
 *      passes, nothing is written); the server restarted, every response carries the header;
 *   5. both edits undone: build.js writes public/mp.js and the manifest back, and every output is again byte for byte what it was in 1;
 *      the restarted server serves the original bytes, without the header, and the page's status line is the original's;
 *   6. a clean rebuild: build.js --clean deletes every output, build.js writes them all again, byte for byte what they were in 1.
 * Each server is stopped by its PID.  The scratch folder is removed at the end (--keep 1 keeps it).  Exit 0 only when every step holds. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), http = require('http'), net = require('net');
const { spawn, spawnSync, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..');
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const PASS = 'c5-synthetic-admin';                                       // a synthetic passcode for the copy's server (never a real one)
const CLIENT = { file: 'src/frameworks/bpp/client/mp.session.js', find: "' · SHARED MONSTERS'", repl: "' · SHARED MONSTERS · DEV WORKFLOW CHECK'", mark: 'DEV WORKFLOW CHECK' };
const PARTS = ['server.js', 'package.json', 'public', 'generated', 'src', 'dev/tools/build'];   // what plays and builds (the rest of dev/ is not needed)
const SERVER = { file: 'src/frameworks/ward/server/static.js', find: "'Vary': 'Accept-Encoding' }", repl: "'Vary': 'Accept-Encoding', 'X-Dev-Workflow-Check': '1' }", header: 'x-dev-workflow-check' };

const R = { tool: 'dev/tools/checks/dev_workflow.js', ref: null, node: process.version, steps: [], ok: true };
const step = (id, ok, detail) => { R.steps.push(Object.assign({ id, ok: !!ok }, detail || {})); if (!ok) R.ok = false; console.log(`${ok ? 'ok  ' : 'FAIL'} ${id}${detail && detail.note ? ': ' + detail.note : ''}`); return !!ok; };
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-workflow-'));
const build = (...a) => spawnSync(process.execPath, ['dev/tools/build/build.js', ...a], { cwd: T, encoding: 'utf8' });
const outputs = () => JSON.parse(fs.readFileSync(path.join(T, 'generated', 'BUILD_MANIFEST.json'), 'utf8')).outputs.map(o => o.out);
const hashes = list => Object.fromEntries(list.concat('generated/BUILD_MANIFEST.json').map(f => [f, fs.existsSync(path.join(T, f)) ? sha(fs.readFileSync(path.join(T, f))) : null]));
const mtimes = list => Object.fromEntries(list.concat('generated/BUILD_MANIFEST.json').map(f => [f, fs.existsSync(path.join(T, f)) ? fs.statSync(path.join(T, f)).mtimeMs : null]));
const edit = (e, undo) => { const f = path.join(T, e.file), t = fs.readFileSync(f, 'utf8'); if (undo) { fs.writeFileSync(f, undo); return true; } if (t.split(e.find).length !== 2) return null; fs.writeFileSync(f, t.replace(e.find, e.repl)); return t; };
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { const b = []; q.on('data', d => b.push(d)); q.on('end', () => r({ status: q.statusCode, headers: q.headers, body: Buffer.concat(b) })); }).on('error', e => r({ status: 0, error: String(e) })));
async function serve(port) {
  const p = spawn(process.execPath, ['server.js', String(port)], { cwd: T, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { const r = await get(port, '/index.html'); if (r.status === 200) return p; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('the copy\'s server did not start');
}
const stop = async p => { if (!p) return; try { process.kill(p.pid); } catch (e) { } for (let i = 0; i < 50 && p.exitCode === null && p.signalCode === null; i++) await sleep(50); };
async function statusLine(browser, port, want, ms = 30000) {               // the page's status line (#net), once it holds `want` (or the last text seen)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), P = await ctx.newPage(), errs = [];
  P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  try {
    await P.goto(`http://127.0.0.1:${port}/?room=workflow${port}`, { timeout: 90000 });
    const t0 = Date.now(); let text = null;
    while (Date.now() - t0 < ms) { text = await P.evaluate(() => { const n = document.getElementById('net'); return n ? n.textContent : null; }).catch(() => null); if (text && want(text)) break; await sleep(200); }
    return { text, errors: errs };
  } finally { await ctx.close(); }
}

(async () => {
  let srv = null, browser = null;
  try {
    /* the copy */
    if (ARG.ref) {                                                     // a commit: git archive
      R.ref = execFileSync('git', ['-C', REPO, 'rev-parse', ARG.ref + '^{commit}']).toString().trim();
      const tar = execFileSync('git', ['-C', REPO, 'archive', '--format=tar', R.ref, '--', ...PARTS], { maxBuffer: 1 << 30 });
      const x = spawnSync('tar', ['-x', '-C', T], { input: tar, maxBuffer: 1 << 30 }); if (x.status !== 0) throw new Error('tar: ' + x.stderr);
    } else if (fs.existsSync(path.join(REPO, '.git'))) {               // the working tree as it is on disk: Git's files and the new ones it does not ignore
      R.ref = 'the working tree (' + execFileSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD']).toString().trim() + ' and its changes)';
      for (const f of execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...PARTS], { maxBuffer: 1 << 28 }).toString().split('\0').filter(Boolean)) {
        const src = path.join(REPO, f); if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;   // deleted, not yet committed
        fs.mkdirSync(path.dirname(path.join(T, f)), { recursive: true }); fs.copyFileSync(src, path.join(T, f));
      }
    } else { R.ref = 'a folder without Git: ' + REPO; for (const f of PARTS) if (fs.existsSync(path.join(REPO, f))) fs.cpSync(path.join(REPO, f), path.join(T, f), { recursive: true }); }
    R.copy = { files: Number(execFileSync('find', [T, '-type', 'f']).toString().trim().split('\n').length) };
    /* 1 */
    let c = build('--check'); const outs = outputs(), H0 = hashes(outs);
    step('1 the copy builds as committed', c.status === 0 && /BUILD CHECK: PASS/.test(c.stdout), { note: `${outs.length} outputs; ${(c.stdout.trim().split('\n').pop() || '').slice(0, 120)}` });
    /* 2 */
    const origClient = edit(CLIENT); step('2a a page module edited', origClient !== null, { note: `${CLIENT.file}: ${CLIENT.find} -> ${CLIENT.repl}` });
    c = build('--check'); step('2b --check sees the outputs no longer match', c.status !== 0 && /public\/mp\.js/.test(c.stdout + c.stderr), { note: ((c.stdout + c.stderr).trim().split('\n').find(l => /mp\.js/.test(l)) || '').slice(0, 140) });
    const before = mtimes(outs), h1before = hashes(outs); await sleep(20);
    c = build(); const after = mtimes(outs), H1 = hashes(outs);
    const written = Object.keys(H1).filter(f => H1[f] !== h1before[f] || after[f] !== before[f]).sort();
    step('2c the build writes public/mp.js and the manifest, nothing else', c.status === 0 && JSON.stringify(written) === JSON.stringify(['generated/BUILD_MANIFEST.json', 'public/mp.js']), { note: `written: ${written.join(', ')}` });
    const mp1 = fs.readFileSync(path.join(T, 'public', 'mp.js'), 'utf8');
    step('2d the new public/mp.js holds the edit, and --check passes', mp1.includes(CLIENT.repl) && build('--check').status === 0, { note: `public/mp.js ${H0['public/mp.js'].slice(0, 12)} -> ${H1['public/mp.js'].slice(0, 12)}` });
    /* 3 */
    const port = await freePort(); srv = await serve(port); browser = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    R.chromium = browser.version();
    let g = await get(port, '/mp.js'); step('3a the server serves the new mp.js', g.status === 200 && sha(g.body) === H1['public/mp.js'], { note: `GET /mp.js ${g.status}, ${g.body ? g.body.length : 0} bytes` });
    let s = await statusLine(browser, port, t => t.includes(CLIENT.mark));
    step('3b a real page shows the edit', !!s.text && s.text.includes(CLIENT.mark) && !s.errors.length, { note: `#net: ${JSON.stringify(s.text)}${s.errors.length ? '; page errors: ' + s.errors.join(' | ') : ''}` });
    /* 4 */
    const origServer = edit(SERVER); step('4a a server module edited', origServer !== null, { note: `${SERVER.file}: one more response header` });
    const m4 = mtimes(outs); c = build('--check'); const m4b = mtimes(outs);
    step('4b a server module is not built: --check passes, nothing written', c.status === 0 && JSON.stringify(m4) === JSON.stringify(m4b), { note: (c.stdout.trim().split('\n').pop() || '').slice(0, 120) });
    await stop(srv); srv = await serve(port);
    g = await get(port, '/index.html'); const g2 = await get(port, '/mp.js');
    step('4c the restarted server answers with the new header', g.status === 200 && g.headers[SERVER.header] === '1' && g2.headers[SERVER.header] === '1', { note: `GET /index.html ${g.status} ${SERVER.header}: ${g.headers[SERVER.header]}` });
    /* 5 */
    edit(CLIENT, origClient); edit(SERVER, origServer);
    c = build(); const H2 = hashes(outs), diff2 = Object.keys(H0).filter(f => H0[f] !== H2[f]);
    step('5a both edits undone: every output is byte for byte what it was', c.status === 0 && !diff2.length && build('--check').status === 0, { note: diff2.length ? 'differ: ' + diff2.join(', ') : `${Object.keys(H0).length} files identical` });
    await stop(srv); srv = await serve(port);
    g = await get(port, '/mp.js'); const g3 = await get(port, '/index.html');
    step('5b the restarted server serves the original bytes, without the header', g.status === 200 && sha(g.body) === H0['public/mp.js'] && g.headers[SERVER.header] === undefined && g3.headers[SERVER.header] === undefined, { note: `GET /mp.js ${g.status}, sha256 ${g.body ? sha(g.body).slice(0, 12) : '-'}` });
    s = await statusLine(browser, port, t => /SHARED MONSTERS/.test(t));
    step('5c the page\'s status line is the original\'s', !!s.text && /SHARED MONSTERS/.test(s.text) && !s.text.includes(CLIENT.mark) && !s.errors.length, { note: `#net: ${JSON.stringify(s.text)}` });
    await stop(srv); srv = null;
    /* 6 */
    c = build('--clean'); const gone = outs.filter(f => !fs.existsSync(path.join(T, f)));
    step('6a build.js --clean deletes every output', c.status === 0 && gone.length === outs.length && !fs.existsSync(path.join(T, 'generated', 'BUILD_MANIFEST.json')), { note: `${gone.length} of ${outs.length} outputs gone` });
    c = build(); const H3 = hashes(outs), diff3 = Object.keys(H0).filter(f => H0[f] !== H3[f]);
    step('6b a clean rebuild gives every output back, byte for byte', c.status === 0 && !diff3.length && build('--check').status === 0, { note: diff3.length ? 'differ: ' + diff3.join(', ') : `${Object.keys(H0).length} files identical; ${(c.stdout.trim().split('\n').pop() || '').slice(0, 100)}` });
  } catch (e) { step('error', false, { note: String(e && e.stack || e).slice(0, 400) }); }
  finally {
    await stop(srv); if (browser) await browser.close().catch(() => { });
    if (ARG.keep) R.kept = T; else fs.rmSync(T, { recursive: true, force: true });
  }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(`DEV WORKFLOW: ${R.ok ? 'PASS' : 'FAIL'} (${R.steps.filter(s => s.ok).length} of ${R.steps.length} steps; ${R.ref})`);
  process.exitCode = R.ok ? 0 : 1;
})();
