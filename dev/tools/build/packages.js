#!/usr/bin/env node
/* dev/tools/build/packages.js - the client build's npm packages, offline and checked (development tool; Node 18 or later and npm;
 * no network; no dependencies).  Stage 3H continuation C4: the lasting form of C1's tools/c1_verify_packages.js.
 *
 *   node dev/tools/build/packages.js --dir <folder of .tgz> [--lockfile FILE] [--os linux --cpu x64] [--out FILE.json]
 *
 * This environment, and any machine without the npm registry, builds the client from a folder of package tarballs (the owner's
 * TFB_V11_LINUX_X64_PACKAGES.zip, or what dev/stage-3h-modernization/tools/c1_fetch_locked_packages.js fetches elsewhere).  Nothing
 * from that folder is trusted before it is checked against the lockfile:
 *   - each tarball's name and version are read from the package.json inside it, never from its file name;
 *   - its SHA-512 must be the lockfile's "integrity" for that package at that version;
 *   - the folder must hold exactly what the build needs on --os/--cpu: every package the lockfile requires there (the non-optional ones,
 *     and the optional ones whose os and cpu fit; the lockfile records no libc, so both gnu and musl variants fit), none missing, none
 *     extra, none twice.  A MANIFEST.json beside the tarballs is only reported.
 * The lockfile is the client tree's (src/core/client/game/package-lock.json) unless --lockfile names another.  The client tree keeps the
 * recovered v11 project's lockfile byte for byte, so its anchor is the snapshot's provenance record: ORIGINAL_V11_PROVENANCE.json's blob
 * id and SHA-256 of package-lock.json (reported as "the v11 snapshot's lockfile").
 *
 * As a module: verify({ dir, lockfile, os, cpu }) -> report; install({ project, dir, work, verified }) installs the verified tarballs
 * into project/node_modules with `npm ci --offline --ignore-scripts` from a private cache in work/, with an empty user npmrc: no
 * registry is asked and no package runs an install script. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), { execFileSync, spawnSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..');
const GAME_LOCK = path.join(REPO, 'src', 'core', 'client', 'game', 'package-lock.json');
const PROVENANCE = path.join(REPO, 'src', 'core', 'client', 'bundle', 'ORIGINAL_V11_PROVENANCE.json');
const sha = (alg, b, enc = 'hex') => crypto.createHash(alg).update(b).digest(enc);

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

function verify({ dir, lockfile = GAME_LOCK, os = 'linux', cpu = 'x64' }) {
  const R = { dir: path.resolve(dir), platform: `${os} ${cpu}`, lockfile: {}, packages: [], missing: [], extra: [], problems: [], ok: false };
  const problem = m => R.problems.push(m);
  const lockBuf = fs.readFileSync(lockfile), prov = JSON.parse(fs.readFileSync(PROVENANCE, 'utf8')), rec = prov.files.find(f => f.path === 'package-lock.json');
  const blob = execFileSync('git', ['hash-object', '--stdin'], { input: lockBuf }).toString().trim();
  R.lockfile = { path: path.relative(REPO, lockfile), blob, sha256: sha('sha256', lockBuf), v11Snapshot: !!rec && rec.blob === blob && rec.sha256 === sha('sha256', lockBuf) };
  const lock = JSON.parse(lockBuf.toString('utf8'));
  const fits = v => !v.optional || ((!v.os || v.os.includes(os)) && (!v.cpu || v.cpu.includes(cpu)));
  const need = new Map(Object.entries(lock.packages).filter(([k, v]) => k && v.resolved && fits(v)));
  const seen = new Set();
  for (const f of fs.readdirSync(R.dir).filter(f => f.endsWith('.tgz')).sort()) {
    const buf = fs.readFileSync(path.join(R.dir, f));
    let pj = null; try { pj = readPackageJson(buf); } catch (e) { /* reported below */ }
    const row = { file: f, bytes: buf.length, sha512: 'sha512-' + sha('sha512', buf, 'base64'), sha256: sha('sha256', buf), name: pj && pj.name, version: pj && pj.version, ok: false };
    R.packages.push(row);
    if (!pj) { problem(`${f}: no package/package.json inside`); continue; }
    const key = 'node_modules/' + pj.name, entry = lock.packages[key];
    if (!entry) { R.extra.push(f); problem(`${f}: ${pj.name} is not in the lockfile`); continue; }
    if (entry.version !== pj.version) { problem(`${f}: ${pj.name}@${pj.version}, the lockfile has ${entry.version}`); continue; }
    if (entry.integrity !== row.sha512) { problem(`${f}: ${pj.name}@${pj.version}: its sha512 is not the lockfile's integrity`); continue; }
    if (!need.has(key)) { R.extra.push(f); problem(`${f}: ${pj.name} is in the lockfile but not needed on ${R.platform}`); continue; }
    if (seen.has(key)) { problem(`${f}: ${pj.name} given twice`); continue; }
    seen.add(key); row.ok = true; row.lockfileEntry = key;
  }
  for (const k of need.keys()) if (!seen.has(k)) { R.missing.push(k.replace(/^node_modules\//, '')); problem(`missing: ${k.replace(/^node_modules\//, '')}@${need.get(k).version}`); }
  const mf = path.join(R.dir, 'MANIFEST.json');
  if (fs.existsSync(mf)) {
    try { const m = JSON.parse(fs.readFileSync(mf, 'utf8')), byFile = new Map(R.packages.map(p => [p.file, p]));
      const disagree = (m.packages || []).filter(p => { const r = byFile.get(p.file); return !r || r.sha256 !== p.sha256 || r.sha512 !== p.integrity; }).map(p => p.file);
      R.manifest = { packages: (m.packages || []).length, agrees: !disagree.length && (m.packages || []).length === R.packages.length, disagree };
    } catch (e) { R.manifest = { error: String(e) }; }
  }
  R.needed = need.size; R.verified = R.packages.filter(p => p.ok).length;
  R.ok = !R.problems.length && R.verified === need.size && R.packages.length === need.size;
  return R;
}

/* install the verified tarballs into project/node_modules, offline */
function install({ project, dir, work, verified }) {
  if (!verified || !verified.ok) throw new Error('the packages are not verified; nothing is installed');
  const cache = path.join(work, 'npm-cache'), rc = path.join(work, 'npmrc'); fs.mkdirSync(cache, { recursive: true }); fs.writeFileSync(rc, '');
  const env = { ...process.env, npm_config_userconfig: rc, npm_config_cache: cache, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false', npm_config_offline: 'true' };
  const run = (args, cwd) => { const r = spawnSync('npm', args, { cwd, env, encoding: 'utf8', maxBuffer: 64 << 20 }); if (r.status !== 0) throw new Error(`npm ${args.join(' ')}: ${(r.stdout + r.stderr).trim().split('\n').slice(-6).join('\n')}`); return (r.stdout + r.stderr).trim(); };
  for (const p of verified.packages) run(['cache', 'add', path.join(dir, p.file)], work);
  const log = run(['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], project);
  const lock = JSON.parse(fs.readFileSync(path.join(project, 'package-lock.json'), 'utf8')), inst = JSON.parse(fs.readFileSync(path.join(project, 'node_modules', '.package-lock.json'), 'utf8'));
  const wrong = Object.entries(inst.packages).filter(([k, v]) => k && (!lock.packages[k] || lock.packages[k].version !== v.version)).map(([k]) => k);
  if (wrong.length) throw new Error('installed packages differ from the lockfile: ' + wrong.join(', '));
  return { log: log.split('\n').slice(-1)[0], packages: Object.keys(inst.packages).filter(Boolean).length, env };
}
module.exports = { verify, install, readPackageJson };

if (require.main === module) {
  const ARG = { os: 'linux', cpu: 'x64' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  if (!ARG.dir) { console.error('usage: packages.js --dir <folder of .tgz> [--lockfile FILE] [--os linux --cpu x64] [--out FILE.json]'); process.exit(2); }
  const R = verify({ dir: ARG.dir, lockfile: ARG.lockfile ? path.resolve(ARG.lockfile) : GAME_LOCK, os: ARG.os, cpu: ARG.cpu });
  for (const p of R.problems) console.log('PROBLEM ' + p);
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(`lockfile: ${R.lockfile.path} (${R.lockfile.v11Snapshot ? 'the v11 snapshot\'s lockfile' : 'NOT the v11 snapshot\'s lockfile'}); needed on ${R.platform}: ${R.needed}`);
  if (R.manifest) console.log(`the accompanying MANIFEST.json: ${R.manifest.agrees ? 'agrees' : 'DISAGREES'} (read only to report)`);
  console.log(`PACKAGES: ${R.ok ? 'VERIFIED' : 'FAIL'} (${R.verified} of ${R.needed} tarballs equal to the lockfile's integrity, by their own package.json; missing ${R.missing.length}, extra ${R.extra.length})`);
  process.exitCode = R.ok ? 0 : 1;
}
