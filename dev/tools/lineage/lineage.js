/* The client lineage ledger's own tool (development only; zero dependencies).
 *
 *   node dev/tools/lineage/lineage.js verify [--recovery <dir>] [--out <file.json>]
 *   node dev/tools/lineage/lineage.js show <step id> [--context 60] [--max 40]
 *   node dev/tools/lineage/lineage.js blame
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
 *         Exit 0 only when every chain replays and the bundle and the stylesheet are identical.
 * show    prints one step's hunks: where, which original module (for the bundle), what was removed and what was written.
 * blame   prints who wrote the modern bundle's bytes: the v11 build, or which step. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..', '..', '..');
const LIN = path.join(REPO, 'src', 'core', 'client', 'bundle', 'lineage');
const [MODE, ...rest] = process.argv.slice(2);
const ARG = { _: [] }; for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) ARG[rest[i].slice(2)] = rest[++i]; else ARG._.push(rest[i]); }
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const ledger = JSON.parse(fs.readFileSync(path.join(LIN, 'ledger.json'), 'utf8'));

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
  const src = s.source.kind === 'commit' ? `commit ${s.source.commit.slice(0, 10)} ${s.source.date} "${s.source.subject}"` : `package ${s.source.package} (${s.source.created})`;
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
} else {
  console.error('usage: lineage.js verify [--recovery <dir>] [--out <file>] | show <step> [--context N] [--max N] | blame');
  process.exitCode = 2;
}
