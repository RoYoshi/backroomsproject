/* Stage 3H continuation (C1) - fetch the recovered v11 project's locked packages on a machine with internet access, for an offline build
 * elsewhere (development only; Node 18 or later; no dependencies).
 *
 *   node dev/stage-3h-modernization/tools/c1_fetch_locked_packages.js --out <empty folder> [--os linux --cpu x64 --libc glibc] [--all]
 *
 * It reads src/core/client/bundle/original-v11/package-lock.json and downloads, for each package the build needs on the given platform
 * (by default the Linux x64 glibc machine the Stage 3H build runs on; --all takes every platform's), the tarball the lockfile names
 * ("resolved"), checks it against the lockfile's "integrity" (sha512), and writes it into --out with a MANIFEST.json of names, versions,
 * sizes and hashes.  A tarball whose hash does not match is not kept, and the run fails.  Zip the folder and hand it over: the receiving
 * side checks every hash again before anything is installed.  Nothing in this repository is changed, and nothing is installed or run. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ARG = { os: 'linux', cpu: 'x64', libc: 'glibc' }; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k === 'all') ARG.all = true; else ARG[k] = process.argv[++i]; }
if (!ARG.out) { console.error('--out <empty folder> is required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), OUT = path.resolve(ARG.out);
if (fs.existsSync(OUT) && fs.readdirSync(OUT).length) { console.error('--out must be empty'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const lock = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'core', 'client', 'bundle', 'original-v11', 'package-lock.json'), 'utf8'));
const fits = v => ARG.all || !v.optional || ((!v.os || v.os.includes(ARG.os)) && (!v.cpu || v.cpu.includes(ARG.cpu)) && (!v.libc || v.libc.includes(ARG.libc)));
const want = Object.entries(lock.packages).filter(([k, v]) => k && v.resolved && fits(v));
(async () => {
  const manifest = { lockfile: 'src/core/client/bundle/original-v11/package-lock.json', platform: ARG.all ? 'all' : `${ARG.os} ${ARG.cpu} ${ARG.libc}`, fetchedAt: new Date().toISOString(), packages: [] };
  let bad = 0;
  for (const [k, v] of want) {
    const name = k.replace(/^.*node_modules\//, ''), file = name.replace('/', '__') + '-' + v.version + '.tgz';
    const res = await fetch(v.resolved); const buf = Buffer.from(await res.arrayBuffer());
    const [alg, b64] = String(v.integrity).split('-'), got = crypto.createHash(alg).update(buf).digest('base64');
    const ok = res.ok && got === b64;
    console.log(`${ok ? 'ok ' : 'BAD'} ${name}@${v.version} ${buf.length} bytes`);
    if (!ok) { bad++; continue; }
    fs.writeFileSync(path.join(OUT, file), buf);
    manifest.packages.push({ name, version: v.version, file, bytes: buf.length, integrity: v.integrity, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
  }
  fs.writeFileSync(path.join(OUT, 'MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(`${manifest.packages.length} of ${want.length} packages fetched and verified into ${OUT}${bad ? `; ${bad} FAILED` : ''}`);
  process.exitCode = bad ? 1 : 0;
})();
