/* Stage 3H engine modernization (H3M-8) - the Human QA package of one commit: a playable, buildable ZIP, its manifest and its receipts,
 * each checked (development only).
 *
 *   node dev/stage-3h-modernization/tools/m8_package.js --ref COMMIT --out <empty folder> [--port 8890]
 *
 * Writes into --out:
 *   THE_FAR_BACKROOMS_STAGE_3H_ENGINE_MODERNIZATION_HUMAN_QA.zip
 *        `git archive` of COMMIT, limited to what plays and builds: server.js, package.json, README.md, the run scripts, public/,
 *        generated/, src/, docs/, the lasting tools that need no Git (dev/tools/build, checks, docs, lineage, layout.js) and this stage's
 *        HUMAN_QA.md and REPORT.md.  Left out: the rest of dev/ (the tests, the gate, the evidence, earlier stages, the archive),
 *        audio_source/ (the audio master), .github/ and redirect.js (deployment).  The whole tree, with its history, is the branch.
 *   SOURCE_MANIFEST.json   the master pack's fields: every file in the ZIP with its SHA-256, owner and origin; every built artifact with
 *                          its inputs; the entry points, the opaque components, the limitations
 *   BUILD_RECEIPT.json     the tools' versions, and the commands run on the extracted ZIP with their results
 *   PACKAGE_RECEIPT.json   every check below and its result
 *   HUMAN_QA.md            a copy of the one-page Human QA guide (dev/stage-3h-modernization/HUMAN_QA.md at COMMIT)
 *   SHA256SUMS.txt         the SHA-256 of each file above
 * Checks:
 *   1. the ZIP: every entry's CRC read back (Python's zipfile), and its files are exactly COMMIT's files under the listed paths;
 *   2. extracted into a new empty folder (no Git, no npm install there): build.js --check, lineage.js verify, docs.js --check and
 *      checks/parts.js (TypeScript, Node's global copy) pass;
 *   3. there, `node server.js PORT` (a synthetic admin passcode) starts.  The page, every built public script, every static file the
 *      allowlist serves and a sound answer 200 with COMMIT's bytes; server.js, src/, generated/, dev/, docs/, public/, package.json,
 *      README.md, traversal and encoded variants never answer 200; a WebSocket client in a room is greeted ({t:'hi'}).  The server is
 *      stopped by its PID;
 *   4. SHA256SUMS.txt is checked again by sha256sum -c, a separate program.
 * The working tree is only read; nothing outside --out is written. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), http = require('http'), os = require('os');
const { spawn, spawnSync, execFileSync } = require('child_process');
const ARG = { port: '8890' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.ref || !ARG.out) { console.error('--ref COMMIT and --out <empty folder> are required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), OUT = path.resolve(ARG.out), PORT = +ARG.port;
if (fs.existsSync(OUT) && fs.readdirSync(OUT).length) { console.error('--out must be empty'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 1 << 30 });
const COMMIT = git('rev-parse', ARG.ref + '^{commit}').toString().trim(), TREE = git('rev-parse', COMMIT + '^{tree}').toString().trim();
const PARENT = git('rev-parse', COMMIT + '^').toString().trim(), WHEN = git('log', '-1', '--format=%cI', COMMIT).toString().trim();
const NAME = 'THE_FAR_BACKROOMS_STAGE_3H_ENGINE_MODERNIZATION_HUMAN_QA', PREFIX = `the-far-backrooms-stage-3h-${COMMIT.slice(0, 7)}/`;
const PATHS = ['server.js', 'package.json', 'README.md', 'run_linux.sh', 'run_windows.bat', 'public', 'generated', 'src', 'docs',
  'dev/tools/README.md', 'dev/tools/layout.js', 'dev/tools/build', 'dev/tools/checks', 'dev/tools/docs', 'dev/tools/lineage',
  'dev/stage-3h-modernization/HUMAN_QA.md', 'dev/stage-3h-modernization/REPORT.md'];
const R = { tool: 'dev/stage-3h-modernization/tools/m8_package.js', commit: COMMIT, tree: TREE, parent: PARENT, committedAt: WHEN, checks: {}, ok: true };
const fail = m => { (R.problems = R.problems || []).push(m); R.ok = false; console.log('PROBLEM ' + m); };
const at = f => git('show', `${COMMIT}:${f}`);

/* the ZIP, and the files it must hold */
const ZIP = path.join(OUT, NAME + '.zip');
git('archive', '--format=zip', '-9', `--prefix=${PREFIX}`, '-o', ZIP, COMMIT, '--', ...PATHS);
const FILES = git('ls-tree', '-r', '-z', '--name-only', COMMIT, '--', ...PATHS).toString().split('\0').filter(Boolean).sort();
for (const p of PATHS) if (!FILES.some(f => f === p || f.startsWith(p + '/'))) fail(`${p} is not in ${COMMIT}`);
const PY = String.raw`
import json, sys, zipfile
z = zipfile.ZipFile(sys.argv[1]); bad = z.testzip()
names = [i.filename for i in z.infolist() if not i.is_dir()]
z.extractall(sys.argv[2])
print(json.dumps({'crcFirstBad': bad, 'entries': len(z.infolist()), 'files': names}))`;
const EX = fs.mkdtempSync(path.join(os.tmpdir(), 'm8pkg-')), py = spawnSync('python3', ['-I', '-B', '-c', PY, ZIP, EX], { encoding: 'utf8', maxBuffer: 1 << 28 });
let zj = null; try { zj = JSON.parse(py.stdout); } catch (e) { fail('the ZIP could not be read back: ' + (py.stderr || '').slice(0, 300)); }
if (zj) {
  const got = zj.files.map(f => f.startsWith(PREFIX) ? f.slice(PREFIX.length) : '!' + f).sort();
  const missing = FILES.filter(f => !got.includes(f)), extra = got.filter(f => !FILES.includes(f));
  R.checks.zip = { bytes: fs.statSync(ZIP).size, entries: zj.entries, files: got.length, expected: FILES.length, crc: zj.crcFirstBad === null ? 'every entry read back' : 'BAD: ' + zj.crcFirstBad, missing, extra };
  if (zj.crcFirstBad !== null) fail('a CRC does not match: ' + zj.crcFirstBad);
  if (missing.length || extra.length) fail(`the ZIP's files are not the commit's: ${missing.length} missing, ${extra.length} extra`);
  const differ = FILES.filter(f => fs.existsSync(path.join(EX, PREFIX, f)) && !fs.readFileSync(path.join(EX, PREFIX, f)).equals(at(f)));
  R.checks.zip.identicalToCommit = FILES.length - differ.length; if (differ.length) fail('extracted files differ from the commit: ' + differ.slice(0, 5).join(', '));
}
const G = path.join(EX, PREFIX);

/* 2. the build and the checks, on the extracted files */
const run = (label, args) => { const r = spawnSync(process.execPath, args, { cwd: G, encoding: 'utf8', maxBuffer: 1 << 28, env: Object.assign({}, process.env) }); const text = ((r.stdout || '') + (r.stderr || '')).trim();
  const rec = { command: 'node ' + args.join(' '), exit: r.status, said: text.split('\n').pop().slice(0, 300) }; (R.checks.extracted = R.checks.extracted || {})[label] = rec; return rec; };
const want = (rec, re) => { if (rec.exit !== 0 || !re.test(rec.said)) fail(`${rec.command}: ${rec.said}`); };
if (fs.existsSync(G)) {
  want(run('build_check', ['dev/tools/build/build.js', '--check']), /BUILD CHECK: PASS/);
  want(run('lineage_verify', ['dev/tools/lineage/lineage.js', 'verify']), /LINEAGE: PASS/);
  want(run('docs_check', ['dev/tools/docs/docs.js', '--check']), /DOCS CHECK: PASS/);
  want(run('parts_check', ['dev/tools/checks/parts.js', '--out', 'parts_report.json']), /PARTS CHECK: PASS/);
  try { R.checks.extracted.parts_check.typescript = JSON.parse(fs.readFileSync(path.join(G, 'parts_report.json'), 'utf8')).typescript || null; } catch (e) {}
  R.checks.extracted.gitPresent = fs.existsSync(path.join(G, '.git'));
}

/* 3. the server, from the extracted files */
const get = (u, headers = {}) => new Promise(res => { const q = http.get({ host: '127.0.0.1', port: PORT, path: u, headers }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(c) })); }); q.on('error', e => res({ status: 0, error: e.message, body: Buffer.alloc(0) })); q.setTimeout(10000, () => q.destroy(new Error('timeout'))); });
(async () => {
  const recipes = JSON.parse(at('src/build-recipes.json').toString('utf8')).outputs.map(o => o.out).filter(o => o.startsWith('public/'));
  const SERVE = /^\/(index\.html|favicon\.ico|camera_policy\.js|timing_policy\.js|world\.js|move\.js|ents\.js|mp\.js|hud\.js|gore\.js|dphys\.js|light\.js|glitch\.js|camcorder\.js|inventory\.js|sfx\.js|assets\/[\w.\-]+)$/;
  const staticServed = FILES.filter(f => f.startsWith('public/') && !recipes.includes(f) && SERVE.test('/' + f.slice(7)));
  const sounds = FILES.filter(f => /^public\/sounds\/[^/]+\.(mp3|ogg|wav|m4a|aac|flac|webm)$/i.test(f));
  const srv = fs.existsSync(G) ? spawn(process.execPath, ['server.js', String(PORT)], { cwd: G, env: Object.assign({}, process.env, { ADMIN_PASSCODE: 'm8-synthetic-admin' }), stdio: ['ignore', 'pipe', 'pipe'] }) : null;
  let log = ''; if (srv) { srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d); }
  const t0 = Date.now(); while (srv && !/localhost:\d+/.test(log) && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 100));
  const S = R.checks.server = { pid: srv ? srv.pid : null, started: /localhost:\d+/.test(log), startLine: log.trim().split('\n')[0] || '', served: [], refused: [] };
  if (!S.started) fail('the server did not start: ' + log.slice(0, 300));
  else {
    const page = await get('/'); S.served.push({ url: '/', status: page.status, sameBytes: page.body.equals(at('public/index.html')) });
    for (const f of recipes.concat(staticServed)) { const r = await get('/' + f.slice(7)); S.served.push({ url: '/' + f.slice(7), status: r.status, sameBytes: r.body.equals(at(f)) }); }
    const list = await get('/sounds'); let names = []; try { names = JSON.parse(list.body.toString('utf8')); } catch (e) {}
    S.served.push({ url: '/sounds', status: list.status, sameBytes: JSON.stringify(names.slice().sort()) === JSON.stringify(sounds.map(f => f.slice(14)).sort()) });
    if (sounds.length) { const s = sounds[0], r = await get('/sounds/' + encodeURIComponent(s.slice(14))); S.served.push({ url: '/sounds/' + s.slice(14), status: r.status, sameBytes: r.body.equals(at(s)) }); }
    const gz = await get('/mp.js', { 'Accept-Encoding': 'gzip' }); S.gzip = { status: gz.status, sameBytesAfterGunzip: (() => { try { return require('zlib').gunzipSync(gz.body).equals(at('public/mp.js')); } catch (e) { return false; } })() };
    for (const u of ['/server.js', '/package.json', '/README.md', '/src/core/server/loop.js', '/src/frameworks/ward/server/static.js', '/src/build-recipes.json',
      '/generated/server/sim.js', '/generated/BUILD_MANIFEST.json', '/dev/tools/build/build.js', '/docs/architecture/FRAMEWORKS.md', '/public/index.html',
      '/src/', '/dev/', '/generated/', '/../server.js', '/%2e%2e/server.js', '/assets/..%2f..%2fserver.js', '/assets/%2e%2e/%2e%2e/server.js', '/SERVER.JS',
      '/sounds/../../server.js', '/sounds/README.txt', '/%', '/x%00.js']) { const r = await get(u); S.refused.push({ url: u, status: r.status }); }
    const badServed = S.served.filter(x => x.status !== 200 || !x.sameBytes), leaked = S.refused.filter(x => x.status === 200);
    S.servedOk = S.served.length - badServed.length; S.refusedOk = S.refused.length - leaked.length;
    if (badServed.length) fail('not served as committed: ' + badServed.map(x => `${x.url} (${x.status})`).join(', '));
    if (leaked.length) fail('served although it must not be: ' + leaked.map(x => x.url).join(', '));
    if (gz.status !== 200 || !S.gzip.sameBytesAfterGunzip) fail('the gzipped /mp.js is not the committed file');
    S.websocket = await new Promise(res => { let done = false; const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=m8package`); const end = v => { if (!done) { done = true; try { ws.close(); } catch (e) {} res(v); } };
      ws.onmessage = e => { let m = null; try { m = JSON.parse(e.data); } catch (x) {} end({ greeted: !!m && m.t === 'hi', type: m && m.t, hasId: !!m && m.id !== undefined }); };
      ws.onerror = () => end({ greeted: false, error: 'socket error' }); setTimeout(() => end({ greeted: false, error: 'timeout' }), 10000); });
    if (!S.websocket.greeted) fail('the WebSocket was not greeted: ' + JSON.stringify(S.websocket));
  }
  if (srv) { process.kill(srv.pid); await new Promise(r => srv.once('exit', r)); S.stopped = true; }
  fs.rmSync(EX, { recursive: true, force: true });

  /* the manifest, the receipts, the guide */
  const recipesAll = JSON.parse(at('src/build-recipes.json').toString('utf8')).outputs, built = new Map(recipesAll.map(o => [o.out, o]));
  const FW = { bpp: 'B++', 'br-role': 'BR-RoLE', 'br-r': 'BR-R', 'spacious-audio': 'Spacious Audio', nani: 'N.A.N.I.', space: 'S.P.A.C.E.', gib: 'G.I.B.', lost: 'L.O.S.T.', pulse: 'P.U.L.S.E.', overseer: 'OVERSEER', echo: 'E.C.H.O.', cashier: 'CASHIER', logicz: 'LogicZ', pocket: 'P.O.C.K.E.T.', front: 'F.R.O.N.T.', ward: 'W.A.R.D.', atlas: 'A.T.L.A.S.', stage: 'S.T.A.G.E.', vault: 'V.A.U.L.T.', hands: 'H.A.N.D.S.' };
  const ownerOf = f => { const m = /^src\/frameworks\/([^/]+)\//.exec(f); return m ? FW[m[1]] || m[1] : f.startsWith('src/core/') ? 'core' : null; };
  const originOf = f => f.startsWith('src/core/client/bundle/original-v11/') ? 'the recovered original v11 project, byte for byte (ORIGINAL_V11_PROVENANCE.json)'
    : f.startsWith('src/core/client/bundle/lineage/') ? 'the client lineage ledger: a recorded step or its record' : /\.md$/.test(f) ? 'documentation'
    : f === 'src/build-recipes.json' ? "the build's recipes: every output and its inputs" : f.startsWith('src/') ? 'canonical source'
    : f.startsWith('public/') ? 'a static web file, edited where it is (no recipe builds it)' : f === 'server.js' ? "the server's composition root"
    : f.startsWith('dev/tools/') ? 'a development tool' : /\.md$/.test(f) ? 'documentation' : 'a project file';
  const manifest = {
    revision: COMMIT, parent_sha: PARENT, tree_sha: TREE, committed_at: WHEN, node_version: process.version, node_required: JSON.parse(at('package.json')).engines,
    build_tool_versions: { build: { tool: 'dev/tools/build/build.js', sha256: sha(at('dev/tools/build/build.js')), dependencies: 'none' },
      parts_check: { tool: 'dev/tools/checks/parts.js', needs: 'TypeScript (global); not needed to build or run' }, git: execFileSync('git', ['--version']).toString().trim() },
    dependencies_locked: 'The game, its server and its build have no dependencies: no node_modules, no npm install. The recovered v11 project keeps its own lockfile (src/core/client/bundle/original-v11/package-lock.json) for its own toolchain (Vite, TypeScript, PixiJS); this build never installs or runs it.',
    source_files: FILES.filter(f => !built.has(f) && f !== 'generated/BUILD_MANIFEST.json').map(f => ({ path: f, sha256: sha(at(f)), framework: ownerOf(f), origin: originOf(f) })),
    artifacts: [...built.values()].map(o => ({ path: o.out, sha256: sha(at(o.out)), inputs: o.replay ? [o.replay.ledger + ' (chain ' + o.replay.chain + ')'] : o.parts, public: o.out.startsWith('public/'), generated: true }))
      .concat([{ path: 'generated/BUILD_MANIFEST.json', sha256: sha(at('generated/BUILD_MANIFEST.json')), inputs: ['every recipe input and output'], public: false, generated: true }]),
    entrypoints: { server: 'node server.js [port]  (npm start)', page: 'public/index.html', build: 'npm run build  (node dev/tools/build/build.js)', build_check: 'npm run build:check' },
    known_opaque_components: [
      { component: "the compiled client bundle's post-v11 edits", where: 'public/assets/index-DKbV5Nv9.js (40 steps), public/assets/index-D7hdwmUU.css (8 steps)', status: 'COMPATIBILITY ISLAND WITH COMPLETE LINEAGE: each byte is the v11 build output or a recorded, dated, owned step (src/core/client/bundle/lineage/); the edits are minified code, not yet ported to TypeScript (ADR-002)' },
      { component: 'sim.level0.js', where: 'src/frameworks/lost/server/sim.level0.js', status: "the bundle's own minified Level 0 code, kept as one part (FINDINGS M-003, M-025)" },
      { component: 'PixiJS 8.21.0', where: 'public/assets/*.js chunks and the bundle', status: 'third-party (MIT), from the v11 lockfile, copied from the v11 build output' }],
    tests: { here: 'PACKAGE_RECEIPT.json: the build, the lineage, the documentation and the parts checked on the extracted ZIP; the server started from it, every served file compared, the refused paths, a WebSocket greeting',
      repository: 'npm run gate:full on the branch (it needs the Git history, the dev/ folders, Playwright and Python): dev/stage-3h-modernization/evidence/m8/' },
    limitations: [
      'The WebSocket session, with the admin passcode check and its lockout, stays in server.js until the owner decides (FINDINGS M-023): PARTIAL.',
      "The bundle's 40 post-v11 edits are still minified code with complete lineage; the TypeScript port (ADR-002, P0 to P4) is not started: PARTIAL.",
      'The fresh npm rebuild of the recovered v11 project was not tested (no package registry access; FINDINGS M-017): NOT TESTED.',
      'Eight frameworks are names with a README and no code: P.U.L.S.E., E.C.H.O., CASHIER, LogicZ, A.T.L.A.S., S.T.A.G.E., V.A.U.L.T., H.A.N.D.S.',
      'Parts share their script\'s closure (FINDINGS M-024); five scripts stay whole (M-025).',
      'Sound as heard, real-browser timing and feel, pixels outside the contact lab, phones and real networks are Human QA\'s (docs/architecture/PARITY_MATRIX.md).'] };
  fs.writeFileSync(path.join(OUT, 'SOURCE_MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');
  const receipt = { commit: COMMIT, tree: TREE, made_at: new Date().toISOString(), node: process.version, git: execFileSync('git', ['--version']).toString().trim(),
    python: spawnSync('python3', ['--version'], { encoding: 'utf8' }).stdout.trim(), typescript: R.checks.extracted && R.checks.extracted.parts_check ? R.checks.extracted.parts_check.typescript : null, os: `${os.platform()} ${os.release()} ${os.arch()}`,
    zip: { command: `git archive --format=zip -9 --prefix=${PREFIX} ${COMMIT} -- ${PATHS.join(' ')}` }, on_the_extracted_zip: R.checks.extracted || null };
  fs.writeFileSync(path.join(OUT, 'BUILD_RECEIPT.json'), JSON.stringify(receipt, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'HUMAN_QA.md'), at('dev/stage-3h-modernization/HUMAN_QA.md'));
  R.sha256sumCheck = 'SHA256SUMS.txt lists every file here; sha256sum -c checks it after this receipt is written (the console says the result)';
  fs.writeFileSync(path.join(OUT, 'PACKAGE_RECEIPT.json'), JSON.stringify(R, null, 1) + '\n');
  const sums = fs.readdirSync(OUT).filter(f => f !== 'SHA256SUMS.txt').sort().map(f => `${sha(fs.readFileSync(path.join(OUT, f)))}  ${f}`).join('\n') + '\n';
  fs.writeFileSync(path.join(OUT, 'SHA256SUMS.txt'), sums);
  const c2 = spawnSync('sha256sum', ['-c', 'SHA256SUMS.txt'], { cwd: OUT, encoding: 'utf8' }); if (c2.status !== 0) fail('sha256sum -c failed');
  console.log(`commit ${COMMIT}, tree ${TREE}`);
  if (R.checks.zip) console.log(`zip: ${R.checks.zip.bytes} bytes, ${R.checks.zip.files} files (= the commit's ${R.checks.zip.expected}), CRC ${R.checks.zip.crc}`);
  for (const [k, v] of Object.entries(R.checks.extracted || {})) if (v && v.command) console.log(`extracted: ${v.command}: exit ${v.exit}: ${v.said}`);
  if (R.checks.server) console.log(`server: ${R.checks.server.startLine}; served as committed ${R.checks.server.servedOk}/${R.checks.server.served.length}; refused ${R.checks.server.refusedOk}/${R.checks.server.refused.length}; gzip ${R.checks.server.gzip ? R.checks.server.gzip.sameBytesAfterGunzip : '-'}; websocket ${JSON.stringify(R.checks.server.websocket)}; stopped ${!!R.checks.server.stopped}`);
  console.log(`sha256sum -c: exit ${c2.status}: ${(c2.stdout || '').trim().split('\n').join('; ')}`);
  console.log(sums.trim());
  console.log('PACKAGE: ' + (R.ok ? 'PASS' : 'FAIL'));
  process.exitCode = R.ok ? 0 : 1;
})();
