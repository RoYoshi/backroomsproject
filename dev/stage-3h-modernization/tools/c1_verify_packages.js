#!/usr/bin/env node
/* Stage 3H continuation C1 - check a folder of npm tarballs against the recovered v11 project's lockfile before anything is installed
 * (development only; Node 18 or later; no dependencies).
 *
 *   node dev/stage-3h-modernization/tools/c1_verify_packages.js --dir <folder of .tgz> [--os linux --cpu x64] [--out FILE.json]
 *
 * The lockfile is src/core/client/bundle/original-v11/package-lock.json, first checked against the snapshot's provenance record
 * (ORIGINAL_V11_PROVENANCE.json: its Git blob id and SHA-256; the record's tree is the one `lineage.js tree-id` proves).  Then, for
 * every tarball in --dir, independently of any manifest that came with them:
 *   1. its name and version are read from the tarball itself (package/package.json inside the gzip'd tar), not from the file name;
 *   2. the lockfile must hold that package at that version, and its "integrity" (sha512) must equal the tarball's own SHA-512;
 * and the set must be exactly what the build needs on --os/--cpu (default linux x64): every package the lockfile requires there (the
 * non-optional ones, and the optional ones whose os and cpu fit; the lockfile records no libc, so both gnu and musl variants fit),
 * none missing.  A tarball the lockfile does not need is reported as extra, and fails the check.  A MANIFEST.json beside the tarballs
 * (c1_fetch_locked_packages.js writes one) is read only to report whether it agrees.  Exit 0 only when everything holds. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), { execFileSync } = require('child_process');
const ARG = { os: 'linux', cpu: 'x64' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.dir) { console.error('--dir <folder of .tgz> is required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), V11 = path.join(REPO, 'src', 'core', 'client', 'bundle', 'original-v11');
const R = { tool: 'dev/stage-3h-modernization/tools/c1_verify_packages.js', dir: path.resolve(ARG.dir), platform: `${ARG.os} ${ARG.cpu}`, lockfile: {}, packages: [], missing: [], extra: [], problems: [], ok: false };
const problem = m => { R.problems.push(m); console.log('PROBLEM ' + m); };

/* the lockfile, against the snapshot's provenance */
const lockBuf = fs.readFileSync(path.join(V11, 'package-lock.json'));
const prov = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'core', 'client', 'bundle', 'ORIGINAL_V11_PROVENANCE.json'), 'utf8'));
const rec = prov.files.find(f => f.path === 'package-lock.json');
const blob = execFileSync('git', ['hash-object', '--stdin'], { input: lockBuf }).toString().trim(), sha256 = crypto.createHash('sha256').update(lockBuf).digest('hex');
R.lockfile = { path: path.relative(REPO, path.join(V11, 'package-lock.json')), blob, sha256, provenance: rec ? { blob: rec.blob, sha256: rec.sha256 } : null, snapshotTree: prov.tree, authentic: !!rec && rec.blob === blob && rec.sha256 === sha256 };
if (!R.lockfile.authentic) problem('the lockfile is not the one the snapshot\'s provenance records');
const lock = JSON.parse(lockBuf.toString('utf8'));

/* what the build needs here: every package entry that is not optional, and the optional ones whose os and cpu fit */
const fits = v => !v.optional || ((!v.os || v.os.includes(ARG.os)) && (!v.cpu || v.cpu.includes(ARG.cpu)));
const need = new Map(Object.entries(lock.packages).filter(([k, v]) => k && v.resolved && fits(v)).map(([k, v]) => [k, v]));

/* a tarball's own package.json: gunzip, then walk the tar's 512-byte headers */
function readPackageJson(tgz) {
  const tar = zlib.gunzipSync(tgz);
  for (let o = 0; o + 512 <= tar.length;) {
    const h = tar.subarray(o, o + 512); if (h.every(b => b === 0)) break;
    const str = (a, b) => h.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    let name = str(0, 100); const prefix = str(345, 500), size = parseInt(str(124, 136).trim() || '0', 8), type = String.fromCharCode(h[156] || 48);
    if (prefix) name = prefix + '/' + name;
    const body = o + 512;
    if ((type === '0' || type === '\0') && /^[^/]+\/package\.json$/.test(name)) return JSON.parse(tar.subarray(body, body + size).toString('utf8'));
    o = body + Math.ceil(size / 512) * 512;
  }
  return null;
}
const seen = new Set();
for (const f of fs.readdirSync(R.dir).filter(f => f.endsWith('.tgz')).sort()) {
  const buf = fs.readFileSync(path.join(R.dir, f)), sha512 = crypto.createHash('sha512').update(buf).digest('base64');
  let pj = null; try { pj = readPackageJson(buf); } catch (e) { /* reported below */ }
  const row = { file: f, bytes: buf.length, sha512: 'sha512-' + sha512, sha256: crypto.createHash('sha256').update(buf).digest('hex'), name: pj && pj.name, version: pj && pj.version, ok: false };
  R.packages.push(row);
  if (!pj) { problem(`${f}: no package/package.json inside`); continue; }
  const key = 'node_modules/' + pj.name, entry = lock.packages[key];
  if (!entry) { R.extra.push(f); problem(`${f}: ${pj.name} is not in the lockfile`); continue; }
  if (entry.version !== pj.version) { problem(`${f}: ${pj.name}@${pj.version}, the lockfile has ${entry.version}`); continue; }
  if (entry.integrity !== row.sha512) { problem(`${f}: ${pj.name}@${pj.version}: its sha512 is not the lockfile's integrity`); continue; }
  if (!need.has(key)) { R.extra.push(f); problem(`${f}: ${pj.name} is in the lockfile but not needed on ${R.platform}`); continue; }
  if (seen.has(key)) { problem(`${f}: ${pj.name} given twice`); continue; }
  seen.add(key); row.ok = true; row.lockfileEntry = key; row.optional = !!entry.optional; row.dev = !!entry.dev;
  console.log(`ok   ${pj.name}@${pj.version}  ${String(buf.length).padStart(9)} bytes  sha512 = the lockfile's`);
}
for (const k of need.keys()) if (!seen.has(k)) { R.missing.push(k.replace(/^node_modules\//, '')); problem(`missing: ${k.replace(/^node_modules\//, '')}@${need.get(k).version}`); }
/* the manifest that came with them, if any: does it agree (read only to report) */
const mf = path.join(R.dir, 'MANIFEST.json');
if (fs.existsSync(mf)) {
  try { const m = JSON.parse(fs.readFileSync(mf, 'utf8')); const byFile = new Map(R.packages.map(p => [p.file, p]));
    const disagree = (m.packages || []).filter(p => { const r = byFile.get(p.file); return !r || r.sha256 !== p.sha256 || r.sha512 !== p.integrity; }).map(p => p.file);
    R.manifest = { packages: (m.packages || []).length, platform: m.platform, fetchedAt: m.fetchedAt, agrees: !disagree.length && (m.packages || []).length === R.packages.length, disagree };
  } catch (e) { R.manifest = { error: String(e) }; }
}
R.needed = need.size; R.verified = R.packages.filter(p => p.ok).length;
R.ok = R.lockfile.authentic && !R.problems.length && R.verified === need.size && R.packages.length === need.size;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`lockfile: ${R.lockfile.authentic ? 'the snapshot\'s own (blob ' + blob.slice(0, 12) + ', sha256 ' + sha256.slice(0, 12) + ')' : 'NOT the recorded one'}; needed on ${R.platform}: ${need.size}`);
if (R.manifest) console.log(`the accompanying MANIFEST.json: ${R.manifest.agrees ? 'agrees' : 'DISAGREES'} (${R.manifest.packages} entries, ${R.manifest.platform || '?'}, fetched ${R.manifest.fetchedAt || '?'})`);
console.log(`C1 PACKAGES: ${R.ok ? 'VERIFIED' : 'FAIL'} (${R.verified} of ${need.size} tarballs equal to the lockfile's integrity, by their own package.json; missing ${R.missing.length}, extra ${R.extra.length})`);
process.exitCode = R.ok ? 0 : 1;
