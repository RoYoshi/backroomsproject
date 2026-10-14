/* Stage 3H1 - a reproducible inventory of the game's runtime surfaces at a commit (development only; reads Git, writes JSON).
 *
 *   node dev/stage-3h/tools/h1_inventory.js [--ref HEAD] [--out FILE.json]
 *
 * Reads every file of REF from Git (never the working tree, never runs game code) and records:
 *   files       every tracked file outside dev/: bytes, lines, SHA-256 and its runtime role -
 *                 served   the browser can fetch it: server/static.js's SERVE allowlist (the regular expression is read from that file at
 *                          REF and applied to '/' + path) or the /sounds/ rule (an audio extension directly under sounds/);
 *                 server   loaded by `node server.js`: server.js and the transitive closure of its relative require() calls (death_srv.js's
 *                          fs read of dphys.js counts: it runs that file's text);
 *                 both     served and server;  neither  tracked but neither served nor loaded (documents, sources, scripts, retired files)
 *   page        index.html's <script> / <link> tags in document order (classic scripts run in that order; the module script runs after them)
 *   esm         the static and dynamic ES-module imports among assets/*.js (the game bundle and the PixiJS chunks), and missing targets
 *   require     server.js's require graph
 *   globals     for every served script: the globals it assigns (window.x = / globalThis.x = / a UMD factory's root.x = ...; browser
 *               properties such as window.onresize are left out) and every __name it mentions;
 *               a text scan of the code with its comments removed, not an evaluation: it tells where to look, the documents say what was
 *               checked by reading the code
 *   signals     per runtime script, counts of things that make code hard to move: Math.random, timers, requestAnimationFrame,
 *               addEventListener, AudioContext, WebSocket, localStorage, performance.now, Date.now
 *   messages    the WebSocket message types: in server.js (the types onMessage compares, and the t: literals it sends) and in mp.js (the types
 *               its onmessage compares, and the t: literals it sends) - a text scan with comments removed, cross-checked in the documents
 *               against the golden traces
 * Exit 0. */
'use strict';
const { execFileSync } = require('child_process');
const crypto = require('crypto'), path = require('path'), fs = require('fs');
const ARG = { ref: 'HEAD' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 1 << 30 });
const ref = git('rev-parse', ARG.ref).toString().trim(), tree = git('rev-parse', ref + '^{tree}').toString().trim();
const blob = p => git('show', `${ref}:${p}`);
const all = git('ls-tree', '-r', '-z', '--name-only', ref).toString().split('\0').filter(Boolean);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const lines = b => { let n = 0; for (const c of b) if (c === 10) n++; return n + (b.length && b[b.length - 1] !== 10 ? 1 : 0); };

/* the allowlist, read from server/static.js at REF */
const staticSrc = blob('server/static.js').toString();
const serveLine = staticSrc.split('\n').find(l => /^const SERVE = \//.test(l));
const SERVE = new Function('return ' + serveLine.replace(/^const SERVE = /, '').replace(/;.*$/, ''))();
const AUDIO = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.webm']);
const served = p => SERVE.test('/' + p) || (/^sounds\/[\w.\- ]+$/.test(p) && AUDIO.has(path.extname(p).toLowerCase()));

/* server.js's require closure */
const req = {}, serverSet = new Set();
(function walk(p) {
  if (serverSet.has(p)) return; serverSet.add(p);
  const src = blob(p).toString(), deps = [];
  for (const m of src.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) { let d = path.posix.normalize(path.posix.join(path.posix.dirname(p), m[1])); if (!d.endsWith('.js') && !d.endsWith('.json')) d += '.js'; deps.push(d); }
  for (const m of src.matchAll(/require\(\s*['"]([^.'"][^'"]*)['"]\s*\)/g)) deps.push('node:' + m[1]);
  if (/readFileSync\(path\.join\(__dirname, 'dphys\.js'\)/.test(src)) deps.push('dphys.js (text, run with new Function)');
  req[p] = [...new Set(deps)];
  for (const d of req[p]) if (!d.startsWith('node:') && !d.includes(' ')) walk(d);
  if (req[p].some(d => d.startsWith('dphys.js'))) serverSet.add('dphys.js');
})('server.js');

/* the page */
const html = blob('index.html').toString(), page = [];
for (const m of html.matchAll(/<(script|link)\b([^>]*)>/g)) {
  const a = m[2], src = (a.match(/\b(?:src|href)="([^"]+)"/) || [])[1] || null;
  page.push({ tag: m[1], src, type: (a.match(/\btype="([^"]+)"/) || [])[1] || (m[1] === 'script' ? 'classic' : null), rel: (a.match(/\brel="([^"]+)"/) || [])[1] || null, inline: m[1] === 'script' && !src });
}

/* ES modules among assets */
const esm = {}; const assetsJs = all.filter(p => /^assets\/[^/]+\.js$/.test(p));
for (const p of assetsJs) {
  const s = blob(p).toString(), st = [...s.matchAll(/(?:from|import)\s*["'](\.\/[^"']+)["']/g)].map(m => 'assets/' + m[1].slice(2)), dy = [...s.matchAll(/import\(\s*[`"'](\.\/[^`"']+)[`"']\s*\)/g)].map(m => 'assets/' + m[1].slice(2));
  if (st.length || dy.length) esm[p] = { static: [...new Set(st)], dynamic: [...new Set(dy)], missing: [...new Set([...st, ...dy])].filter(t => !all.includes(t)) };
}

/* comments out (block, and line comments after whitespace or punctuation; a URL's '//' follows ':').  Every text scan below reads the code
 * without its comments: a comment that shows an assignment ("window.__glitches = [[x, y, nx, ny], ...]" in glitch.js) or names a global is not
 * code that sets or reads it.  Checked on the B++ head: this changes nothing else in any served or server script. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}()])\/\/.*$/gm, '$1');

/* per-file records */
const SKIP_G =new Set(['__proto__', '__dirname', '__filename', '__vite__mapDeps', '__esModule', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', '__H', '__rec']);
const files = all.filter(p => !p.startsWith('dev/')).map(p => {
  const b = blob(p), isServed = served(p), isServer = serverSet.has(p);
  const r = { path: p, bytes: b.length, lines: lines(b), sha256: sha(b), role: isServed && isServer ? 'both' : isServed ? 'served' : isServer ? 'server' : 'neither' };
  if (/\.js$/.test(p) && (isServed || isServer)) {
    const raw = b.toString(), s = strip(raw), cnt = re => (s.match(re) || []).length;
    const assigned = [...new Set([...s.matchAll(/\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*(?:=(?!=)|\|\|=|\?\?=)/g)].map(m => m[1])
      .concat([...s.matchAll(/\broot\.((?:__|[A-Z])[\w$]*)\s*=(?!=)/g)].map(m => m[1])).concat([...s.matchAll(/window\[\s*['"](__[A-Za-z]\w*)['"]\s*\]\s*=(?!=)/g)].map(m => m[1])))]
      .filter(g => !SKIP_G.has(g) && !/^(on[a-z]+|location|name|status|innerWidth|innerHeight|devicePixelRatio)$/.test(g)).sort();   // (window.x = / globalThis.x = / a UMD factory's root.X = with X capitalised or __-prefixed (a PIXI container called root is not a global); browser properties left out)
    const mentioned = [...new Set([...s.matchAll(/(?<![\w$])(__[A-Za-z][\w]*)/g)].map(m => m[1]))].filter(g => !SKIP_G.has(g)).sort();
    r.globals = { assigned, mentioned };
    r.signals = { mathRandom: cnt(/Math\.random\(/g), setTimeout: cnt(/\bsetTimeout\(/g), setInterval: cnt(/\bsetInterval\(/g), rAF: cnt(/requestAnimationFrame\(/g), addEventListener: cnt(/addEventListener\(/g),
      audioContext: cnt(/AudioContext|createOscillator|createGain|createBufferSource/g), webSocket: cnt(/\bWebSocket\b/g), localStorage: cnt(/localStorage/g), performanceNow: cnt(/performance\.now\(/g), dateNow: cnt(/Date\.now\(/g),
      useStrict: /^\s*(?:\/\*[\s\S]*?\*\/\s*)?['"]use strict['"]/.test(s), iife: /^\s*(?:\/\*[\s\S]*?\*\/\s*)?(?:\(\s*\(\s*\)\s*=>|\(function|!function|;\(\(\)|\(\(\)\s*=>)/.test(s) };
    const head = (raw.match(/^\s*\/\*([\s\S]*?)\*\//) || [])[1];
    if (head) r.header = head.replace(/\s*\n\s*\*?\s?/g, ' ').trim().slice(0, 300);
  }
  return r;
});

/* messages (text scan, comments out) */
const typesIn = s => [...new Set([...strip(s).matchAll(/\bm\.t\s*===\s*'([\w-]+)'/g)].map(m => m[1]))].sort();
const typesOut = s => [...new Set([...strip(s).matchAll(/\{\s*t\s*:\s*'([\w-]+)'/g)].map(m => m[1]))].sort();
const sv = blob('server.js').toString(), mp = blob('mp.js').toString();
const messages = { 'server.js': { compares: typesIn(sv), sendsLiterals: typesOut(sv) }, 'mp.js': { compares: typesIn(mp), sendsLiterals: typesOut(mp) } };
for (const p of ['death_srv.js', 'server/ws.js']) messages[p] = { sendsLiterals: typesOut(blob(p).toString()) };

const roleCount = {}; for (const f of files) roleCount[f.role] = (roleCount[f.role] || 0) + 1;
const R = { tool: 'dev/stage-3h/tools/h1_inventory.js', ref, tree, serveRegex: SERVE.source, roleCount, page, esm, require: req, serverFiles: [...serverSet].sort(), messages,
  runtimeBytes: files.filter(f => f.role !== 'neither').reduce((s, f) => s + f.bytes, 0), files };
const out = JSON.stringify(R, null, 1) + '\n';
if (ARG.out) fs.writeFileSync(ARG.out, out);
console.log(JSON.stringify({ ref, tree, roleCount, runtimeBytes: R.runtimeBytes, pageScripts: page.filter(p => p.tag === 'script').length, esmMissing: Object.values(esm).flatMap(e => e.missing), serverFiles: R.serverFiles }));
