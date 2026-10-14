/* Stage 3H engine modernization (H3M-6) - derive the client lineage ledger (development only; run once, its outputs are committed).
 *
 *   node dev/stage-3h-modernization/tools/lineage_derive.js --recovery <extracted recovery root> [--ref <commit>] [--out <dir>]
 *        [--base-root src/core/client/bundle/original-v11] [--typescript <path to a TypeScript package>]
 *
 * The recovery root is the folder THE_FAR_BACKROOMS_ORIGINAL_SOURCE_RECOVERY/ of the owner's original source recovery archive (SHA-256
 * 9f4aeac3...).  Nothing in it is changed.  The modern history is read from this repository with git, up to --ref (default: the frozen
 * Stage 3H2 parent 22751bb, whose bundle and stylesheet are B++'s bytes and whose index.html adds 3H2's two script tags).
 *
 * For each client file the original v11 Vite build produced and the modern game still ships under the same name, the tool builds the
 * chain of versions, oldest first:
 *   1. the v11 build output (versions/site-v11-49743e94d6f0/dist/...), the base;
 *   2. the historical packages that hold a different version of the file, in the order they were made (provenance/HISTORICAL_ATTACHMENTS.json);
 *   3. every commit of this repository that changed the file (git rev-list --reverse --topo-order <ref> -- <path>; the path is linear).
 * Between two consecutive versions it records a patch: the smallest token-level edit (git diff --no-index --minimal over one token per line)
 * as hunks {at, del, ins} on the bytes of the earlier version.  Every patch is checked by applying it: the result must be the later version
 * byte for byte (SHA-256).  Versions that the packages and the repository both hold are listed as corroboration, not as extra steps.
 *
 * For the compiled bundle it also writes:
 *   - module_map.json: which byte range of the v11 bundle each original TypeScript module compiled to (TypeScript's own parser splits the
 *     bundle's app code and the modules into units; units are matched by their property names, strings and numbers; one contiguous run per
 *     module, in bundle order);
 *   - blame.json: for every byte of the modern bundle, the step that wrote it ("v11" = the original build), summed and as a piece table;
 *     for every v11 module, how many of its bytes are still there unchanged; for every step, which modules and which earlier steps' text
 *     its hunks touch.
 *
 * Requires git and a TypeScript package (for its parser only; any recent version: --typescript <path to the package>, default the global
 * one).  Writes only under --out. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const ARG = { ref: '22751bbc39c91f3e54e3305638b2ef2c9dd12c68' };
for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.recovery) { console.error('usage: lineage_derive.js --recovery <dir> [--ref <commit>] [--out <dir>] [--typescript <dir>]'); process.exit(2); }
const REC = path.resolve(ARG.recovery), REPO = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(ARG.out || path.join(REPO, 'src', 'core', 'client', 'bundle', 'lineage'));
const V11 = path.join(REC, 'versions', 'site-v11-49743e94d6f0');
const ts = require(ARG.typescript || path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'typescript'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 1 << 30 });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lineage-'));

/* ---------- the historical packages: name, creation time, the member that holds each file ---------- */
const ATT = JSON.parse(fs.readFileSync(path.join(REC, 'provenance', 'HISTORICAL_ATTACHMENTS.json'), 'utf8'));
function zipMember(zipPath, member) {                    // read one member of a ZIP (stored or deflated) without extracting
  const z = fs.readFileSync(zipPath); let eocd = z.length - 22; while (eocd >= 0 && z.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip: ' + zipPath);
  const n = z.readUInt16LE(eocd + 10); let p = z.readUInt32LE(eocd + 16);
  for (let i = 0; i < n; i++) {
    const method = z.readUInt16LE(p + 10), csize = z.readUInt32LE(p + 20), nlen = z.readUInt16LE(p + 28), xlen = z.readUInt16LE(p + 30), clen = z.readUInt16LE(p + 32), lho = z.readUInt32LE(p + 42);
    const name = z.slice(p + 46, p + 46 + nlen).toString('utf8');
    if (name === member) {
      const ln = z.readUInt16LE(lho + 26), lx = z.readUInt16LE(lho + 28), data = z.slice(lho + 30 + ln + lx, lho + 30 + ln + lx + csize);
      return method === 0 ? Buffer.from(data) : require('zlib').inflateRawSync(data);
    }
    p += 46 + nlen + xlen + clen;
  }
  return null;
}
function zipNames(zipPath) {
  const z = fs.readFileSync(zipPath); let eocd = z.length - 22; while (eocd >= 0 && z.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const n = z.readUInt16LE(eocd + 10); let p = z.readUInt32LE(eocd + 16); const out = [];
  for (let i = 0; i < n; i++) { const nlen = z.readUInt16LE(p + 28), xlen = z.readUInt16LE(p + 30), clen = z.readUInt16LE(p + 32); out.push(z.slice(p + 46, p + 46 + nlen).toString('utf8')); p += 46 + nlen + xlen + clen; }
  return out;
}
const packages = ATT.filter(a => /\.zip$/.test(a.original_file_name) && !/_files\.zip$|build-sources|prototype/.test(a.original_file_name))
  .map(a => ({ name: a.original_file_name, path: path.join(REC, a.recovered_path), sha256: a.sha256, created: a.library_metadata.created_at.replace(/\.\d+Z$/, 'Z') }))
  .sort((a, b) => a.created.localeCompare(b.created));
for (const p of packages) if (sha(fs.readFileSync(p.path)) !== p.sha256) throw new Error('package hash differs from the recovery manifest: ' + p.name);

/* ---------- the files and their chains ---------- */
const FILES = [
  { key: 'bundle', modern: 'public/assets/index-DKbV5Nv9.js', old: 'assets/index-DKbV5Nv9.js', v11: 'dist/assets/index-DKbV5Nv9.js', member: /(^|\/)assets\/index-DKbV5Nv9\.js$/ },
  { key: 'css', modern: 'public/assets/index-D7hdwmUU.css', old: 'assets/index-D7hdwmUU.css', v11: 'dist/assets/index-D7hdwmUU.css', member: /(^|\/)assets\/index-D7hdwmUU\.css$/ },
  { key: 'html', modern: 'public/index.html', old: 'index.html', v11: 'dist/index.html', member: /^(thefarbackrooms-level0\/)?index\.html$/ },
];
function chainOf(F) {
  const base = fs.readFileSync(path.join(V11, F.v11));
  const versions = [{ kind: 'v11-build', label: 'v11 original build (versions/site-v11-49743e94d6f0/' + F.v11 + ')', buf: base, date: '2026-09-29T00:46:53Z', commit: '49743e94d6f0e5023790a8f2a726140f25fb14aa' }];
  const repoCommits = execFileSync('git', ['-C', REPO, 'rev-list', '--reverse', '--topo-order', ARG.ref, '--', F.old]).toString().trim().split('\n').filter(Boolean);
  const firstRepoDate = repoCommits.length ? git('log', '-1', '--format=%cI', repoCommits[0]).toString().trim() : null;
  const corroborated = [];
  const seen = new Map([[sha(base), versions[0]]]);
  /* packages made before the first repository commit of the file are steps; later ones corroborate a commit or are side versions */
  const repoBlobs = repoCommits.map(c => ({ c, buf: git('show', c + ':' + F.old) }));
  const repoBySha = new Map(repoBlobs.map(r => [sha(r.buf), r.c]));
  const sideVersions = [];
  for (const p of packages) {
    const m = zipNames(p.path).find(n => F.member.test(n)); if (!m) continue;
    const buf = zipMember(p.path, m), h = sha(buf);
    const at = { package: p.name, member: m, packageSha256: p.sha256, created: p.created };
    if (seen.has(h)) { corroborated.push(Object.assign({ equals: seen.get(h).label }, at)); continue; }
    if (repoBySha.has(h)) { corroborated.push(Object.assign({ equals: 'commit ' + repoBySha.get(h) }, at)); continue; }
    if (firstRepoDate && new Date(p.created) > new Date(firstRepoDate)) { sideVersions.push(Object.assign({ buf, sha256: h, bytes: buf.length }, at)); continue; }
    const v = { kind: 'package', label: p.name + ' :: ' + m, buf, date: p.created, package: at };
    versions.push(v); seen.set(h, v);
  }
  for (const r of repoBlobs) {
    const fmt = git('log', '-1', '--format=%H%x00%cI%x00%an%x00%s', r.c).toString().replace(/\n$/, '').split('\0');
    versions.push({ kind: 'commit', label: fmt[0].slice(0, 7) + ' ' + fmt[3], buf: r.buf, date: fmt[1], commit: fmt[0], author: fmt[2], subject: fmt[3] });
  }
  return { versions, corroborated, sideVersions };
}

/* ---------- token diff ---------- */
const TOK = /[A-Za-z0-9_$]+|[ \t]+|\r?\n|./gsu;
const tokens = s => s.match(TOK) || [];
function diffTokens(a, b) {                               // -> [{a0, a1, b0, b1}] token ranges, ascending
  const fa = path.join(TMP, 'a.tok'), fb = path.join(TMP, 'b.tok');
  fs.writeFileSync(fa, a.map(t => JSON.stringify(t)).join('\n') + '\n'); fs.writeFileSync(fb, b.map(t => JSON.stringify(t)).join('\n') + '\n');
  const r = spawnSync('git', ['-c', 'core.quotepath=off', 'diff', '--no-index', '--no-color', '--no-ext-diff', '--minimal', '-U0', fa, fb], { encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0 && r.status !== 1) throw new Error('git diff failed: ' + r.stderr);
  const out = [];
  for (const m of r.stdout.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const s = +m[1], n = m[2] === undefined ? 1 : +m[2], t = +m[3], k = m[4] === undefined ? 1 : +m[4];
    const a0 = n === 0 ? s : s - 1, b0 = k === 0 ? t : t - 1;
    out.push({ a0, a1: a0 + n, b0, b1: b0 + k });
  }
  return out;
}
function patchOf(before, after) {
  const A = tokens(before.toString('utf8')), B = tokens(after.toString('utf8'));
  if (A.join('') !== before.toString('utf8') || B.join('') !== after.toString('utf8')) throw new Error('tokenizer does not cover the text');
  const ranges = diffTokens(A, B);
  /* merge hunks separated by at most 3 unchanged tokens of at most 12 bytes: one readable edit instead of several fragments */
  const merged = [];
  for (const r of ranges) {
    const p = merged[merged.length - 1];
    if (p && r.a0 - p.a1 <= 3 && Buffer.byteLength(A.slice(p.a1, r.a0).join('')) <= 12) { p.a1 = r.a1; p.b1 = r.b1; } else merged.push(Object.assign({}, r));
  }
  const offA = [0]; for (const t of A) offA.push(offA[offA.length - 1] + Buffer.byteLength(t));
  const hunks = merged.map(r => ({ at: offA[r.a0], del: A.slice(r.a0, r.a1).join(''), ins: B.slice(r.b0, r.b1).join('') }));
  const got = applyPatch(before, hunks);
  if (!got.equals(after)) throw new Error('patch does not reproduce the later version');
  return hunks;
}
function applyPatch(buf, hunks) {
  const parts = []; let pos = 0;
  for (const h of hunks) {
    const d = Buffer.from(h.del, 'utf8');
    if (h.at < pos || !buf.slice(h.at, h.at + d.length).equals(d)) throw new Error('hunk does not match at ' + h.at);
    parts.push(buf.slice(pos, h.at), Buffer.from(h.ins, 'utf8')); pos = h.at + d.length;
  }
  parts.push(buf.slice(pos)); return Buffer.concat(parts);
}

/* ---------- the v11 bundle's module map ---------- */
function moduleMap(bundleText) {
  function fp(node) {
    const out = [];
    (function walk(n) {
      if (ts.isPropertyAccessExpression(n)) { walk(n.expression); out.push('.' + n.name.text); return; }
      if ((ts.isPropertyAssignment(n) || ts.isMethodDeclaration(n) || ts.isPropertyDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n)) && n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) out.push('#' + n.name.text);
      if (ts.isShorthandPropertyAssignment(n)) out.push('#' + n.name.text);
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push('"' + n.text);
      if (ts.isNumericLiteral(n)) out.push('=' + (+n.text));
      ts.forEachChild(n, walk);
    })(node);
    return out;
  }
  function unitsOf(sf) {
    const units = [], push = (n, label) => units.push({ start: n.getStart(sf), end: n.end, label, fp: fp(n) });
    for (const st of sf.statements) {
      if (ts.isImportDeclaration(st) || ts.isExportDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) continue;
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
        if (d.initializer && ts.isClassExpression(d.initializer)) for (const m of d.initializer.members) push(m, d.name.getText(sf) + '.' + (m.name ? m.name.getText(sf) : 'constructor'));
        else push(d, d.name.getText(sf));
      }
      else if (ts.isClassDeclaration(st)) for (const m of st.members) push(m, (st.name ? st.name.text : '?') + '.' + (m.name ? m.name.getText(sf) : 'constructor'));
      else if (ts.isFunctionDeclaration(st)) push(st, 'function ' + (st.name ? st.name.text : '?'));
      else push(st, ts.SyntaxKind[st.kind]);
    }
    return units;
  }
  const bsf = ts.createSourceFile('bundle.js', bundleText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const all = unitsOf(bsf);
  const mods = [];
  for (const d of ['shared', 'client']) for (const f of fs.readdirSync(path.join(V11, d)).sort()) if (/\.ts$/.test(f) && !/\.d\.ts$/.test(f)) {
    const t = fs.readFileSync(path.join(V11, d, f), 'utf8'), sf = ts.createSourceFile(f, t, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    mods.push({ name: d + '/' + f, units: unitsOf(sf) });
  }
  const sim = (a, b) => { if (!a.length || !b.length) return 0; const m = new Map(); for (const x of a) m.set(x, (m.get(x) || 0) + 1); let k = 0; for (const x of b) { const c = m.get(x); if (c) { k++; m.set(x, c - 1); } } return k / Math.max(a.length, b.length); };
  const bestUnit = all.map(u => mods.map(m => m.units.reduce((b, x) => { const s = sim(u.fp, x.fp); return s > b.s ? { s, label: x.label } : b; }, { s: 0, label: '' })));
  const score = bestUnit.map(r => r.map(x => x.s));
  /* the app code starts at the first unit that matches a module well; the library code before it is PixiJS (and Vite's preamble) */
  let first = all.findIndex((u, i) => u.fp.length >= 6 && Math.max(...score[i]) >= 0.8);
  const app = all.slice(first), S = score.slice(first);
  /* module order: median position of the confident matches */
  const med = mods.map((m, k) => { const xs = S.map((s, i) => s[k] >= 0.6 && app[i].fp.length >= 4 ? i : -1).filter(i => i >= 0).sort((a, b) => a - b); return xs.length ? xs[xs.length >> 1] : Infinity; });
  const order = mods.map((m, k) => k).filter(k => med[k] !== Infinity).sort((a, b) => med[a] - med[b]);
  /* one contiguous run per module, in that order, maximising the summed match score (a module may be empty) */
  const N = app.length, K = order.length, best = Array.from({ length: N + 1 }, () => new Float64Array(K).fill(-Infinity)), from = Array.from({ length: N + 1 }, () => new Int32Array(K).fill(-1));
  for (let k = 0; k < K; k++) { best[0][k] = 0; }
  for (let i = 1; i <= N; i++) for (let k = 0; k < K; k++) {
    let b = best[i - 1][k], f = k;                               // continue module k
    for (let j = 0; j < k; j++) if (best[i - 1][j] > b) { b = best[i - 1][j]; f = j; }   // or start k after j
    best[i][k] = b + S[i - 1][order[k]]; from[i][k] = f;
  }
  let k = 0; for (let j = 1; j < K; j++) if (best[N][j] > best[N][k]) k = j;
  const lab = new Array(N); for (let i = N; i >= 1; i--) { lab[i - 1] = order[k]; k = from[i][k]; }
  const regions = [];
  for (let i = 0; i < N; i++) {
    const name = mods[lab[i]].name, r = regions[regions.length - 1];
    if (r && r.module === name) { r.end = app[i].end; r.units++; } else regions.push({ module: name, start: app[i].start, end: app[i].end, units: 1 });
  }
  /* close the gaps: a region runs to the next one's start */
  for (let i = 0; i < regions.length - 1; i++) regions[i].end = regions[i + 1].start;
  regions[regions.length - 1].end = bundleText.length;
  const lib = { module: 'pixi.js 8.21.0 (library) and the Vite preamble', start: 0, end: regions[0].start };
  /* inside each module, align its bundle units with its TypeScript units in order (the minifier keeps a module's statement order): the
   * score of a pair is their match plus a little when they are the same kind of unit, so units without any property, string or number
   * (const renderer = new Renderer()) still pair up by position between matched neighbours */
  const kind = l => /^function /.test(l) ? 'f' : /\./.test(l) ? 'm' : /^[A-Za-z_$][\w$]*$/.test(l) ? 'v' : 's';
  const tsUnitOf = new Array(N).fill(null);
  for (let mk = 0; mk < mods.length; mk++) {
    const bi = []; for (let i = 0; i < N; i++) if (lab[i] === mk) bi.push(i);
    const T = mods[mk].units; if (!bi.length || !T.length) continue;
    const n = bi.length, m = T.length, D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1)), P = Array.from({ length: n + 1 }, () => new Int8Array(m + 1));
    const pair = (i, j) => { const u = app[bi[i]], t = T[j], s = sim(u.fp, t.fp), same = kind(u.label) === kind(t.label); return s > 0 ? s + (same ? 0.05 : 0) : (same ? 0.02 : -1); };
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
      let b = D[i - 1][j], p = 1; if (D[i][j - 1] > b) { b = D[i][j - 1]; p = 2; }
      const d = D[i - 1][j - 1] + pair(i - 1, j - 1); if (d > b) { b = d; p = 3; }
      D[i][j] = b; P[i][j] = p;
    }
    for (let i = n, j = m; i > 0 && j > 0;) { const p = P[i][j]; if (p === 3) { if (pair(i - 1, j - 1) > 0) tsUnitOf[bi[i - 1]] = T[j - 1].label; i--; j--; } else if (p === 1) i--; else j--; }
  }
  const matched = app.map((u, i) => ({ start: u.start, end: u.end, label: u.label, module: mods[lab[i]].name, tsUnit: tsUnitOf[i], score: +S[i][lab[i]].toFixed(2) }));
  return { regions: [lib].concat(regions), weak: matched.filter(m => m.score < 0.34).length, units: matched.length, unitsDetail: matched };
}

/* ---------- blame: a piece table carried through the bundle's chain ---------- */
function blame(baseLen, steps) {
  let segs = [{ o: 0, s: 0, len: baseLen }];                 // o: origin step (0 = base), s: offset in the base (o = 0) or in that step's text
  const touches = [];
  for (let k = 0; k < steps.length; k++) {
    const hunks = steps[k], next = [], touched = { base: [], steps: new Set() };
    let si = 0, sOff = 0, pos = 0;                         // segment index, offset inside it, position in the current file
    const mark = (g, off, n) => { if (g.o === 0) touched.base.push([g.s + off, g.s + off + n]); else touched.steps.add(g.o); };
    const take = (n, keep) => {                            // move n bytes forward, keeping or dropping them
      while (n > 0) {
        const g = segs[si], c = Math.min(n, g.len - sOff);
        if (keep) next.push({ o: g.o, s: g.s + sOff, len: c }); else mark(g, sOff, c);
        n -= c; sOff += c; pos += c; if (sOff === g.len) { si++; sOff = 0; }
      }
    };
    for (const h of hunks) {
      take(h.at - pos, true);
      const dl = Buffer.byteLength(h.del), il = Buffer.byteLength(h.ins);
      if (dl === 0) {                                       // a pure insertion touches the byte before it (the first byte, at 0)
        const p = next[next.length - 1];
        if (p) mark(p, p.len - 1, 1); else if (segs[si]) mark(segs[si], sOff, 1);
      }
      take(dl, false);
      if (il) next.push({ o: k + 1, s: 0, len: il });
    }
    while (si < segs.length) take(segs[si].len - sOff, true);
    segs = next.reduce((a, g) => { const p = a[a.length - 1]; if (p && p.o === g.o && p.s + p.len === g.s) p.len += g.len; else a.push(Object.assign({}, g)); return a; }, []);
    touches.push({ base: touched.base, steps: [...touched.steps].sort((a, b) => a - b) });
  }
  return { segs, touches };
}

/* ---------- run ---------- */
const BASE_ROOT = ARG['base-root'] || 'src/core/client/bundle/original-v11';
fs.mkdirSync(OUT, { recursive: true });
const ledger = {
  note: 'The client lineage ledger: how each file the original v11 Vite build produced became the file the modern game ships. Each step is a patch on the bytes of the previous version, checked by its SHA-256 before and after. Derived by dev/stage-3h-modernization/tools/lineage_derive.js; replayed and verified by dev/tools/lineage/lineage.js.',
  provenance: { recoveryArchiveSha256: '9f4aeac34c8205cf4ace7c57d8b3cb4a97f4c5b29b35c44980ab8c08ac7505e7', v11Commit: '49743e94d6f0e5023790a8f2a726140f25fb14aa', v11Tree: 'b80323b0ee9c9124453e2d0a62c5f894c8f41db7', historyRef: execFileSync('git', ['-C', REPO, 'rev-parse', ARG.ref]).toString().trim() },
  files: {} };
let bundleSteps = null, bundleBase = null;
for (const F of FILES) {
  const { versions, corroborated, sideVersions } = chainOf(F);
  const dir = path.join(OUT, F.key); fs.mkdirSync(dir, { recursive: true });
  const steps = [], hunkLists = [];
  for (let i = 1; i < versions.length; i++) {
    const a = versions[i - 1], b = versions[i], id = F.key.charAt(0).toUpperCase() + String(i).padStart(2, '0');
    if (sha(a.buf) === sha(b.buf)) throw new Error('two equal consecutive versions: ' + a.label + ' / ' + b.label);
    const hunks = patchOf(a.buf, b.buf);
    const file = path.join(dir, id + '.json');
    fs.writeFileSync(file, JSON.stringify({ step: id, file: F.modern, before: { bytes: a.buf.length, sha256: sha(a.buf) }, after: { bytes: b.buf.length, sha256: sha(b.buf) }, hunks: hunks.map(h => [h.at, h.del, h.ins]) }) + '\n');
    steps.push({ id, source: srcOf(b), patch: path.relative(OUT, file).split(path.sep).join('/'), hunks: hunks.length, deleted: hunks.reduce((s, h) => s + Buffer.byteLength(h.del), 0), inserted: hunks.reduce((s, h) => s + Buffer.byteLength(h.ins), 0), after: { bytes: b.buf.length, sha256: sha(b.buf) } });
    hunkLists.push(hunks);
  }
  const last = versions[versions.length - 1].buf;
  ledger.files[F.key] = {
    file: F.modern, historicalPath: F.old,
    base: { path: BASE_ROOT + '/' + F.v11, recoveryPath: 'versions/site-v11-49743e94d6f0/' + F.v11, bytes: versions[0].buf.length, sha256: sha(versions[0].buf) },
    steps, result: { bytes: last.length, sha256: sha(last) },
    corroboration: corroborated, sideVersions: sideVersions.map(s => ({ package: s.package, member: s.member, created: s.created, bytes: s.bytes, sha256: s.sha256, note: sideNote(s, versions) })),
  };
  if (F.key === 'bundle') { bundleSteps = hunkLists; bundleBase = versions[0].buf; }
  const modernNow = fs.existsSync(path.join(REPO, F.modern)) ? fs.readFileSync(path.join(REPO, F.modern)) : null;
  console.log(`${F.key}: ${steps.length} steps, ${corroborated.length} corroborating package copies, ${sideVersions.length} side versions; result ${last.length} B ${sha(last).slice(0, 16)}${modernNow ? (sha(modernNow) === sha(last) ? ' = working tree' : ' DIFFERS from the working tree') : ''}`);
}
function srcOf(v) {
  if (v.kind === 'commit') return { kind: 'commit', commit: v.commit, date: v.date, author: v.author, subject: v.subject };
  return { kind: 'package', package: v.package.package, member: v.package.member, packageSha256: v.package.packageSha256, created: v.package.created };
}
function sideNote(s, versions) {
  /* where a package's version that is not on the repository's path sits: the version it is closest to, by token edit size */
  let best = null;
  for (let i = 0; i < versions.length; i++) {
    const hunks = patchOf(versions[i].buf, s.buf), size = hunks.reduce((a, h) => a + Buffer.byteLength(h.del) + Buffer.byteLength(h.ins), 0);
    if (!best || size < best.size) best = { i, size };
  }
  return `closest to ${versions[best.i].label} (${best.size} bytes of token edits); not on the repository's path`;
}

/* the module map and the blame of the bundle (byte offsets; the parser's positions are UTF-16 offsets, converted) */
const mm = moduleMap(bundleBase.toString('utf8'));
const text = bundleBase.toString('utf8'), u16toByte = i => i >= text.length ? bundleBase.length : Buffer.byteLength(text.slice(0, i));
for (const r of mm.regions) { r.start = u16toByte(r.start); r.end = u16toByte(r.end); }
for (const u of mm.unitsDetail) { u.start = u16toByte(u.start); u.end = u16toByte(u.end); }
fs.writeFileSync(path.join(OUT, 'module_map.json'), JSON.stringify({
  note: 'Which byte range of the v11 bundle (304,183 bytes) each original TypeScript module compiled to. Derived, not recorded by the build: TypeScript\'s parser splits the bundle\'s app code and the modules into units (statements, declarators, class members); each bundle unit is matched to the module unit with the most property names, strings and numbers in common; one contiguous run per module, in bundle order, maximises the summed match (lineage_derive.js). "weakUnits" counts bundle units whose best match shares under a third of its tokens: their module is inferred from their neighbours.',
  bundleSha256: sha(bundleBase), units: mm.units, weakUnits: mm.weak, regions: mm.regions,
  unitsDetail: mm.unitsDetail.map(u => [u.start, u.end, u.label, u.module, u.tsUnit, u.score]) }) + '\n');
const bl = blame(bundleBase.length, bundleSteps);
const realSteps = ledger.files.bundle.steps;
const byOrigin = {}; for (const g of bl.segs) byOrigin[g.o] = (byOrigin[g.o] || 0) + g.len;
const modOf = off => (mm.regions.find(r => off >= r.start && off < r.end) || { module: '?' }).module;
const keptByModule = {}; for (const r of mm.regions) keptByModule[r.module] = { bytes: r.end - r.start, kept: 0 };
for (const g of bl.segs) if (g.o === 0) { const s = g.s, e = g.s + g.len; for (const r of mm.regions) { const a = Math.max(s, r.start), b = Math.min(e, r.end); if (b > a) keptByModule[r.module].kept += b - a; } }
const stepTouch = realSteps.map((s, i) => {
  const mods = {}; for (const [a, b] of bl.touches[i].base) { const m = modOf(a); mods[m] = (mods[m] || 0) + (b - a); }
  return { id: s.id, source: s.source.kind === 'commit' ? s.source.commit.slice(0, 7) + ' ' + s.source.subject : s.source.package, v11BytesReplaced: mods, editsTextOfSteps: bl.touches[i].steps.map(k => realSteps[k - 1].id) };
});
fs.writeFileSync(path.join(OUT, 'blame.json'), JSON.stringify({
  note: 'Who wrote each byte of the modern bundle. "v11" is the original build; a step id is a ledger step. "segments" is the final piece table: [origin, offset in the origin, length], in file order (for v11 the offset is in the v11 bundle; for a step, in the text that step inserted). "v11BytesReplaced" says which original modules a step removed or replaced bytes of (a pure insertion counts the byte before it); "editsTextOfSteps" which earlier steps\' text it changed.',
  modernBytes: bl.segs.reduce((s, g) => s + g.len, 0),
  bytesByOrigin: Object.fromEntries(Object.entries(byOrigin).map(([o, n]) => [o === '0' ? 'v11' : realSteps[o - 1].id, n])),
  v11ModulesKept: keptByModule, steps: stepTouch,
  segments: bl.segs.map(g => [g.o === 0 ? 'v11' : realSteps[g.o - 1].id, g.s, g.len]) }) + '\n');
fs.writeFileSync(path.join(OUT, 'ledger.json'), JSON.stringify(ledger, null, 1) + '\n');
console.log(`module map: ${mm.regions.length - 1} module regions, ${mm.units} app units (${mm.weak} weakly matched)`);
console.log(`blame: kept from the v11 build ${byOrigin[0]} of ${bundleBase.length} bytes; written by later steps ${bl.segs.reduce((s, g) => s + (g.o ? g.len : 0), 0)}`);
fs.rmSync(TMP, { recursive: true, force: true });
