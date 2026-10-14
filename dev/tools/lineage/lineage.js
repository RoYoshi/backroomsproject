/* The client lineage ledger's own tool (development only; zero dependencies).
 *
 *   node dev/tools/lineage/lineage.js verify [--recovery <dir>] [--out <file.json>]
 *   node dev/tools/lineage/lineage.js show <step id> [--context 60] [--max 40]
 *   node dev/tools/lineage/lineage.js blame
 *   node dev/tools/lineage/lineage.js tree-id
 *   node dev/tools/lineage/lineage.js record <bundle|css> --label "<what changed and why>" [--owner <framework>]
 *
 * The ledger (src/core/client/bundle/lineage/ledger.json) says how each file the original v11 Vite build produced became the file the
 * modern game ships: public/assets/index-DKbV5Nv9.js (the compiled bundle), public/assets/index-D7hdwmUU.css and public/index.html.
 * Every step is a patch on the bytes of the previous version, with the SHA-256 of the version before and after it.
 *
 * verify  replays every chain from its base and checks every step's hashes and the end result.  The base is the v11 build output: read
 *         from the repository (src/core/client/bundle/original-v11/dist/...) when it is there, else from --recovery (the extracted
 *         THE_FAR_BACKROOMS_ORIGINAL_SOURCE_RECOVERY/ folder).  It then compares each result with the working tree's file:
 *           - the bundle and the stylesheet must be identical (they are edits of build outputs, and the ledger is their only record);
 *           - index.html is reported (it is the page's hand-edited source; edits after the frozen parent are not ledger steps).
 *         It also checks that blame.json is still what the ledger gives.
 *         Exit 0 only when every chain replays, the bundle and the stylesheet are identical, and blame.json is current.
 * show    prints one step's hunks: where, which original module (for the bundle), what was removed and what was written.
 * blame   prints who wrote the modern bundle's bytes: the v11 build, or which step.
 * tree-id proves that src/core/client/bundle/original-v11/ is the recovered v11 snapshot: the Git tree id of its files, with the one file
 *         left out of this public repository (.openai/hosting.json, the old hosting account's project id; its blob id is recorded in
 *         ORIGINAL_V11_PROVENANCE.json), must be the v11 commit's tree id b80323b0...  Computed here (no Git needed).
 * record  turns a change made to public/assets/index-DKbV5Nv9.js or index-D7hdwmUU.css into the ledger's next step (the smallest token
 *         edit, as lineage_derive.js made the others; needs git for the diff), so the build reproduces it, and rewrites blame.json for the
 *         bundle.  The way to change those files until their concern is ported to TypeScript
 *         (docs/architecture/ADRS/ADR-002-client-bundle-source.md). */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..', '..', '..');
const LIN = path.join(REPO, 'src', 'core', 'client', 'bundle', 'lineage');
const [MODE, ...rest] = process.argv.slice(2);
const ARG = { _: [] }; for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) ARG[rest[i].slice(2)] = rest[++i]; else ARG._.push(rest[i]); }
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const ledger = JSON.parse(fs.readFileSync(path.join(LIN, 'ledger.json'), 'utf8'));
const B = path.join(REPO, 'src', 'core', 'client', 'bundle');

function applyPatch(buf, hunks) {
  const parts = []; let pos = 0;
  for (const [at, del, ins] of hunks) {
    const d = Buffer.from(del, 'utf8');
    if (at < pos || !buf.slice(at, at + d.length).equals(d)) throw new Error('hunk does not match at byte ' + at);
    parts.push(buf.slice(pos, at), Buffer.from(ins, 'utf8')); pos = at + d.length;
  }
  parts.push(buf.slice(pos)); return Buffer.concat(parts);
}
function baseOf(F) {
  const inRepo = path.join(REPO, F.base.path);
  if (fs.existsSync(inRepo)) return { buf: fs.readFileSync(inRepo), from: F.base.path };
  if (ARG.recovery) { const p = path.join(path.resolve(ARG.recovery), F.base.recoveryPath); if (fs.existsSync(p)) return { buf: fs.readFileSync(p), from: '<recovery>/' + F.base.recoveryPath }; }
  return null;
}
/* replay one chain; returns { ok, steps, result, error } */
function replay(key) {
  const F = ledger.files[key], b = baseOf(F);
  if (!b) return { ok: false, error: `the base ${F.base.path} is not in the repository; pass --recovery <dir>` };
  if (sha(b.buf) !== F.base.sha256) return { ok: false, error: 'the base differs from the ledger: ' + b.from };
  let cur = b.buf; const steps = [];
  for (const s of F.steps) {
    const P = JSON.parse(fs.readFileSync(path.join(LIN, s.patch), 'utf8'));
    if (P.step !== s.id || P.before.sha256 !== sha(cur)) return { ok: false, steps, error: `step ${s.id}: the version before it is not the one the patch was made on` };
    try { cur = applyPatch(cur, P.hunks); } catch (e) { return { ok: false, steps, error: `step ${s.id}: ${e.message}` }; }
    if (sha(cur) !== P.after.sha256 || sha(cur) !== s.after.sha256 || cur.length !== s.after.bytes) return { ok: false, steps, error: `step ${s.id}: the result is not the recorded version` };
    steps.push(s.id);
  }
  if (sha(cur) !== F.result.sha256) return { ok: false, steps, error: 'the end of the chain is not the recorded result' };
  return { ok: true, steps, result: cur, base: b.from };
}

/* who wrote each byte of the bundle: a piece table carried through the bundle's chain, summed by origin and by v11 module (module_map.json).
 * The same computation as dev/stage-3h-modernization/tools/lineage_derive.js, which wrote blame.json first; verify checks that blame.json
 * is still what the ledger gives, and record rewrites it. */
function blameOf() {
  const F = ledger.files.bundle, MM = JSON.parse(fs.readFileSync(path.join(LIN, 'module_map.json'), 'utf8'));
  let segs = [{ o: 0, s: 0, len: F.base.bytes }];                // o: origin step (0 = v11), s: offset in the v11 bundle (o = 0) or in that step's text
  const touches = [];
  F.steps.forEach((st, k) => {
    const hunks = JSON.parse(fs.readFileSync(path.join(LIN, st.patch), 'utf8')).hunks, next = [], touched = { base: [], steps: new Set() };
    let si = 0, sOff = 0, pos = 0;
    const mark = (g, off, n) => { if (g.o === 0) touched.base.push([g.s + off, g.s + off + n]); else touched.steps.add(g.o); };
    const take = (n, keep) => { while (n > 0) { const g = segs[si], c = Math.min(n, g.len - sOff); if (keep) next.push({ o: g.o, s: g.s + sOff, len: c }); else mark(g, sOff, c); n -= c; sOff += c; pos += c; if (sOff === g.len) { si++; sOff = 0; } } };
    for (const [at, del, ins] of hunks) {
      take(at - pos, true);
      const dl = Buffer.byteLength(del), il = Buffer.byteLength(ins);
      if (dl === 0) { const q = next[next.length - 1]; if (q) mark(q, q.len - 1, 1); else if (segs[si]) mark(segs[si], sOff, 1); }   // a pure insertion touches the byte before it
      take(dl, false);
      if (il) next.push({ o: k + 1, s: 0, len: il });
    }
    while (si < segs.length) take(segs[si].len - sOff, true);
    segs = next.reduce((a, g) => { const q = a[a.length - 1]; if (q && q.o === g.o && q.s + q.len === g.s) q.len += g.len; else a.push(Object.assign({}, g)); return a; }, []);
    touches.push({ base: touched.base, steps: [...touched.steps].sort((a, b) => a - b) });
  });
  const S = F.steps, byOrigin = {}; for (const g of segs) byOrigin[g.o] = (byOrigin[g.o] || 0) + g.len;
  const modOf = off => (MM.regions.find(r => off >= r.start && off < r.end) || { module: '?' }).module;
  const kept = {}; for (const r of MM.regions) kept[r.module] = { bytes: r.end - r.start, kept: 0 };
  for (const g of segs) if (g.o === 0) for (const r of MM.regions) { const a = Math.max(g.s, r.start), b = Math.min(g.s + g.len, r.end); if (b > a) kept[r.module].kept += b - a; }
  const srcText = x => x.kind === 'commit' ? x.commit.slice(0, 7) + ' ' + x.subject : x.kind === 'recorded' ? 'recorded ' + x.date.slice(0, 10) + ' ' + x.label : x.package;
  const steps = S.map((st, i) => { const mods = {}; for (const [a, b] of touches[i].base) { const m = modOf(a); mods[m] = (mods[m] || 0) + (b - a); } return { id: st.id, source: srcText(st.source), v11BytesReplaced: mods, editsTextOfSteps: touches[i].steps.map(k => S[k - 1].id) }; });
  return JSON.stringify({
    note: 'Who wrote each byte of the modern bundle. "v11" is the original build; a step id is a ledger step. "segments" is the final piece table: [origin, offset in the origin, length], in file order (for v11 the offset is in the v11 bundle; for a step, in the text that step inserted). "v11BytesReplaced" says which original modules a step removed or replaced bytes of (a pure insertion counts the byte before it); "editsTextOfSteps" which earlier steps\' text it changed.',
    modernBytes: segs.reduce((n, g) => n + g.len, 0),
    bytesByOrigin: Object.fromEntries(Object.entries(byOrigin).map(([o, n]) => [o === '0' ? 'v11' : S[o - 1].id, n])),
    v11ModulesKept: kept, steps,
    segments: segs.map(g => [g.o === 0 ? 'v11' : S[g.o - 1].id, g.s, g.len]) }) + '\n';
}

if (MODE === 'verify') {
  const R = { tool: 'dev/tools/lineage/lineage.js verify', files: {}, ok: true };
  for (const key of Object.keys(ledger.files)) {
    const F = ledger.files[key], r = replay(key), rec = { file: F.file, base: r.base || null, steps: r.steps ? r.steps.length : 0, of: F.steps.length, replayed: r.ok };
    if (!r.ok) { rec.error = r.error; R.ok = false; }
    else {
      const wt = path.join(REPO, F.file), now = fs.existsSync(wt) ? fs.readFileSync(wt) : null;
      rec.resultSha256 = F.result.sha256; rec.workingTree = now ? (now.equals(r.result) ? 'identical' : 'different') : 'missing';
      rec.enforced = key !== 'html';
      if (rec.enforced && rec.workingTree !== 'identical') R.ok = false;
    }
    R.files[key] = rec;
    console.log(`${rec.replayed && (!rec.enforced || rec.workingTree === 'identical') ? 'PASS' : 'FAIL'} ${key}: ${rec.steps}/${rec.of} steps replayed from ${rec.base || '(no base)'}${rec.error ? ' - ' + rec.error : ''}${rec.workingTree ? `; working tree ${F.file} ${rec.workingTree}${rec.enforced ? '' : ' (reported, not enforced)'}` : ''}`);
  }
  if (R.files.bundle && R.files.bundle.replayed) {               // blame.json is derived from the ledger: it must still be what the ledger gives
    R.blame = fs.readFileSync(path.join(LIN, 'blame.json'), 'utf8') === blameOf() ? 'what the ledger gives' : 'STALE';
    if (R.blame !== 'what the ledger gives') R.ok = false;
    console.log(`${R.blame === 'STALE' ? 'FAIL' : 'PASS'} blame: blame.json is ${R.blame === 'STALE' ? 'not what the ledger gives (run record again, or lineage_derive.js)' : 'what the ledger gives'}`);
  }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log('LINEAGE: ' + (R.ok ? 'PASS' : 'FAIL'));
  process.exitCode = R.ok ? 0 : 1;
} else if (MODE === 'show') {
  const id = ARG._[0], key = Object.keys(ledger.files).find(k => ledger.files[k].steps.some(s => s.id === id));
  if (!key) { console.error('no such step: ' + id); process.exit(2); }
  const s = ledger.files[key].steps.find(x => x.id === id), P = JSON.parse(fs.readFileSync(path.join(LIN, s.patch), 'utf8'));
  const ctx = +(ARG.context || 60), max = +(ARG.max || 40);
  /* the version before the step, for context */
  const F = ledger.files[key], b = baseOf(F); let before = null;
  if (b) { let cur = b.buf; for (const x of F.steps) { if (x.id === id) break; cur = applyPatch(cur, JSON.parse(fs.readFileSync(path.join(LIN, x.patch), 'utf8')).hunks); } before = cur; }
  const src = s.source.kind === 'commit' ? `commit ${s.source.commit.slice(0, 10)} ${s.source.date} "${s.source.subject}"` : s.source.kind === 'recorded' ? `recorded ${s.source.date} "${s.source.label}"${s.source.owner ? ' (' + s.source.owner + ')' : ''}` : `package ${s.source.package} (${s.source.created})`;
  console.log(`${id} on ${F.file}: ${src}\n  ${P.hunks.length} hunks, -${s.deleted} +${s.inserted} bytes; ${P.before.bytes} -> ${P.after.bytes} bytes`);
  P.hunks.slice(0, max).forEach(([at, del, ins], i) => {
    const pre = before ? before.slice(Math.max(0, at - ctx), at).toString('utf8') : '', post = before ? before.slice(at + Buffer.byteLength(del), at + Buffer.byteLength(del) + ctx).toString('utf8') : '';
    console.log(`\n@@ hunk ${i + 1} at byte ${at}`);
    if (pre) console.log('   ' + JSON.stringify(pre).slice(1, -1));
    if (del) console.log(' - ' + JSON.stringify(del).slice(1, -1));
    if (ins) console.log(' + ' + JSON.stringify(ins).slice(1, -1));
    if (post) console.log('   ' + JSON.stringify(post).slice(1, -1));
  });
  if (P.hunks.length > max) console.log(`\n... ${P.hunks.length - max} more hunks (--max)`);
} else if (MODE === 'blame') {
  const B = JSON.parse(fs.readFileSync(path.join(LIN, 'blame.json'), 'utf8'));
  console.log(`the modern bundle: ${B.modernBytes} bytes`);
  for (const [o, n] of Object.entries(B.bytesByOrigin)) console.log(`  ${o.padEnd(4)} ${String(n).padStart(7)}`);
  console.log('v11 modules, bytes still there unchanged:');
  for (const [m, v] of Object.entries(B.v11ModulesKept)) console.log(`  ${m.padEnd(48)} ${String(v.kept).padStart(7)} / ${String(v.bytes).padStart(7)}`);
} else if (MODE === 'tree-id') {
  const P = JSON.parse(fs.readFileSync(path.join(B, 'ORIGINAL_V11_PROVENANCE.json'), 'utf8')), root = path.join(B, 'original-v11');
  const sha1 = (...b) => { const h = crypto.createHash('sha1'); for (const x of b) h.update(x); return h.digest(); };
  /* every file: [path, mode, blob id]; the committed files hashed here, the omitted ones as recorded */
  const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name).split(path.sep).join('/')]);
  const files = walk('').map(f => { const b = fs.readFileSync(path.join(root, f)); return [f, (fs.statSync(path.join(root, f)).mode & 0o111) ? '100755' : '100644', sha1(`blob ${b.length}\0`, b)]; });
  for (const o of P.omitted) files.push([o.path, o.mode, Buffer.from(o.blob, 'hex')]);
  /* a Git tree object: entries sorted by name (a folder as name + '/'), each "mode name\0" + 20-byte id */
  function tree(entries) {
    const dirs = new Map(), here = [];
    for (const [p, mode, id] of entries) { const i = p.indexOf('/'); if (i < 0) here.push([p, mode, id]); else { const d = p.slice(0, i); if (!dirs.has(d)) dirs.set(d, []); dirs.get(d).push([p.slice(i + 1), mode, id]); } }
    for (const [d, sub] of dirs) here.push([d, '40000', tree(sub)]);
    here.sort((a, b) => { const x = a[1] === '40000' ? a[0] + '/' : a[0], y = b[1] === '40000' ? b[0] + '/' : b[0]; return x < y ? -1 : x > y ? 1 : 0; });
    const body = Buffer.concat(here.map(([n, m, id]) => Buffer.concat([Buffer.from(`${m} ${n}\0`), id])));
    return sha1(`tree ${body.length}\0`, body);
  }
  const got = tree(files).toString('hex'), ok = got === P.tree;
  const listed = new Set(P.files.map(f => f.path)), extra = files.filter(f => !listed.has(f[0]) && !P.omitted.some(o => o.path === f[0])).map(f => f[0]);
  console.log(`${files.length - P.omitted.length} files in original-v11/ + ${P.omitted.length} recorded omission(s): tree ${got}${ok ? ' = ' : ' != '}the v11 commit's tree ${P.tree}${extra.length ? '; not in the snapshot: ' + extra.join(', ') : ''}`);
  console.log('ORIGINAL V11 TREE: ' + (ok && !extra.length ? 'PROVEN' : 'FAIL'));
  process.exitCode = ok && !extra.length ? 0 : 1;
} else if (MODE === 'record') {
  const key = ARG._[0], F = ledger.files[key];
  if (!F || key === 'html' || !ARG.label) { console.error('usage: lineage.js record <bundle|css> --label "<what changed and why>" [--owner <framework>]'); process.exit(2); }
  const r = replay(key); if (!r.ok) { console.error('the ledger does not replay: ' + r.error); process.exit(1); }
  const now = fs.readFileSync(path.join(REPO, F.file));
  if (now.equals(r.result)) { console.log(`${F.file} is what the ledger builds: nothing to record`); process.exit(0); }
  const { spawnSync } = require('child_process'), os = require('os');
  const TOK = /[A-Za-z0-9_$]+|[ \t]+|\r?\n|./gsu, A = r.result.toString('utf8').match(TOK) || [], Bt = now.toString('utf8').match(TOK) || [];
  if (A.join('') !== r.result.toString('utf8') || Bt.join('') !== now.toString('utf8')) { console.error('the file is not UTF-8 text the tokenizer covers'); process.exit(1); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lineage-rec-')), fa = path.join(tmp, 'a'), fb = path.join(tmp, 'b');
  fs.writeFileSync(fa, A.map(t => JSON.stringify(t)).join('\n') + '\n'); fs.writeFileSync(fb, Bt.map(t => JSON.stringify(t)).join('\n') + '\n');
  const d = spawnSync('git', ['diff', '--no-index', '--no-color', '--no-ext-diff', '--minimal', '-U0', fa, fb], { encoding: 'utf8', maxBuffer: 1 << 30 }); fs.rmSync(tmp, { recursive: true, force: true });
  if (d.status !== 0 && d.status !== 1) { console.error('git diff failed: ' + d.stderr); process.exit(1); }
  const off = [0]; for (const t of A) off.push(off[off.length - 1] + Buffer.byteLength(t));
  const hunks = [...d.stdout.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map(m => { const s0 = +m[1], n = m[2] === undefined ? 1 : +m[2], t0 = +m[3], k = m[4] === undefined ? 1 : +m[4], a0 = n === 0 ? s0 : s0 - 1, b0 = k === 0 ? t0 : t0 - 1; return [off[a0], A.slice(a0, a0 + n).join(''), Bt.slice(b0, b0 + k).join('')]; });
  if (!applyPatch(r.result, hunks).equals(now)) { console.error('the recorded patch does not reproduce the file'); process.exit(1); }
  const id = key.charAt(0).toUpperCase() + String(F.steps.length + 1).padStart(2, '0'), rel = `${key}/${id}.json`;
  fs.writeFileSync(path.join(LIN, rel), JSON.stringify({ step: id, file: F.file, before: { bytes: r.result.length, sha256: sha(r.result) }, after: { bytes: now.length, sha256: sha(now) }, hunks }) + '\n');
  F.steps.push({ id, source: { kind: 'recorded', date: new Date().toISOString(), label: ARG.label, owner: ARG.owner || null }, patch: rel, hunks: hunks.length,
    deleted: hunks.reduce((s, h) => s + Buffer.byteLength(h[1]), 0), inserted: hunks.reduce((s, h) => s + Buffer.byteLength(h[2]), 0), after: { bytes: now.length, sha256: sha(now) } });
  F.result = { bytes: now.length, sha256: sha(now) };
  fs.writeFileSync(path.join(LIN, 'ledger.json'), JSON.stringify(ledger, null, 1) + '\n');
  if (key === 'bundle') fs.writeFileSync(path.join(LIN, 'blame.json'), blameOf());
  console.log(`recorded ${id} (${hunks.length} hunks) for ${F.file}${key === 'bundle' ? '; blame.json rewritten' : ''}. Next: npm run build (the manifest), npm run build:check, `
    + 'node dev/tools/lineage/lineage.js verify, and the generated pages (node dev/stage-3h-modernization/tools/lineage_doc.js)');
} else {
  console.error('usage: lineage.js verify [--recovery <dir>] [--out <file>] | show <step> [--context N] [--max N] | blame | tree-id | record <bundle|css> --label "..."');
  process.exitCode = 2;
}
