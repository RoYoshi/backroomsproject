#!/usr/bin/env python3
"""Stage 3H engine modernization - authenticate the owner's original source recovery archive (development only; read-only).

    python3 -I -B dev/stage-3h-modernization/tools/recovery_verify.py --zip <THE_FAR_BACKROOMS_ORIGINAL_SOURCE_RECOVERY zip> --out <report.json>

Checks, without changing the archive or this repository:
  1. the archive's SHA-256 and member count, every member's ZIP CRC, and every payload line of its SHA256SUMS.txt;
  2. the Git history bundle: cloned into a new temporary folder, `git fsck --full --strict`, its commits, refs and tree ids;
  3. every versions/site-vNN-<sha> snapshot against its commit: each tracked file's Git blob id, the file count, nothing extra;
  4. version 11's dist/ output: the 304,183-byte index-DKbV5Nv9.js and the other dist files, against the recovery's own build receipts
     (verification/BUILD_REPRODUCTION.json) and the independently uploaded copy (historical_attachments/.../index-DKbV5Nv9.js);
  5. version 11's dist/ files against the files this repository serves under the same names (public/, from the working tree).
It does not run npm: a fresh `npm ci && npm run build` needs the npm registry (see the report's "rebuild" entry).
Stdlib and git only.  Untrusted archive content is only read and hashed; nothing from it is executed."""
import argparse, hashlib, json, os, subprocess, sys, tempfile, zipfile, shutil

EXPECTED_ZIP = '9f4aeac34c8205cf4ace7c57d8b3cb4a97f4c5b29b35c44980ab8c08ac7505e7'
EXPECTED_V11_BUNDLE = '82fb8ff4b25334237f03f57888cfb48dfa84cdba625ffffb7f5eedf03d5bbf5e'
V11 = 'versions/site-v11-49743e94d6f0/'
PREFIX = 'THE_FAR_BACKROOMS_ORIGINAL_SOURCE_RECOVERY/'
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

def sha(b): return hashlib.sha256(b).hexdigest()
def blob_id(b): return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--zip', required=True); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    R = {'tool': 'dev/stage-3h-modernization/tools/recovery_verify.py', 'checks': {}, 'ok': True}
    def check(name, ok, **detail):
        R['checks'][name] = dict(ok=bool(ok), **detail); R['ok'] = R['ok'] and bool(ok)
        print(('PASS ' if ok else 'FAIL ') + name + (': ' + json.dumps(detail)[:300] if detail else ''))
    raw = open(a.zip, 'rb').read()
    check('archive_sha256', sha(raw) == EXPECTED_ZIP, sha256=sha(raw), bytes=len(raw))
    z = zipfile.ZipFile(a.zip)
    names = z.namelist()
    bad = [n for n in names if n.startswith('/') or '..' in n.split('/') or '\\' in n]
    check('archive_members', len(names) == 533 and not bad, members=len(names), unsafePaths=bad)
    check('archive_crc', z.testzip() is None)
    sums = z.read(PREFIX + 'SHA256SUMS.txt').decode().splitlines()
    mism, n = [], 0
    for line in sums:
        if not line.strip(): continue
        h, rel = line.split('  ', 1); n += 1
        if sha(z.read(PREFIX + rel)) != h: mism.append(rel)
    check('payload_sha256sums', n == 532 and not mism, lines=n, mismatches=mism)
    # the git history bundle, restored into a new folder
    tmp = tempfile.mkdtemp(prefix='recovery-')
    try:
        bpath = os.path.join(tmp, 'history.bundle'); open(bpath, 'wb').write(z.read(PREFIX + 'history/original-sites-history.bundle'))
        clone = os.path.join(tmp, 'history')
        env = dict(os.environ, GIT_CONFIG_NOSYSTEM='1', GIT_TERMINAL_PROMPT='0')
        subprocess.run(['git', '-c', 'core.hooksPath=/dev/null', 'clone', '-q', '--no-checkout', bpath, clone], check=True, env=env)
        fsck = subprocess.run(['git', '-C', clone, 'fsck', '--full', '--strict'], capture_output=True, text=True)
        log = subprocess.run(['git', '-C', clone, 'log', '--format=%H %T %cI', 'HEAD'], capture_output=True, text=True, check=True).stdout.split('\n')
        commits = [l.split() for l in log if l.strip()]
        check('history_bundle', fsck.returncode == 0 and len(commits) == 11 and commits[0][0] == '49743e94d6f0e5023790a8f2a726140f25fb14aa',
              fsckExit=fsck.returncode, commits=len(commits), head=commits[0][0], headTree=commits[0][1], earliest=commits[-1][0])
        # every snapshot against its commit's tree
        snaps, total, problems = {}, 0, []
        for c, tree, when in commits:
            d = [x for x in {n.split('/')[2] for n in names if n.startswith(PREFIX + 'versions/site-v')} if x.endswith(c[:12])]
            if len(d) != 1: problems.append('no snapshot for ' + c); continue
            base = PREFIX + 'versions/' + d[0] + '/'
            lt = subprocess.run(['git', '-C', clone, 'ls-tree', '-r', '--full-tree', c], capture_output=True, text=True, check=True).stdout.splitlines()
            files = {}
            for l in lt:
                meta, p = l.split('\t', 1); mode, typ, blob = meta.split(); files[p] = blob
            present = {n[len(base):] for n in names if n.startswith(base) and not n.endswith('/')}
            bad = [p for p, b in files.items() if p not in present or blob_id(z.read(base + p)) != b]
            extra = sorted(present - set(files))
            snaps[d[0]] = dict(commit=c, tree=tree, files=len(files), mismatches=bad, extra=extra)
            total += len(files)
            if bad or extra: problems.append(d[0])
        check('snapshots_equal_git_blobs', not problems and len(snaps) == 11, snapshots=len(snaps), fileInstances=total, problems=problems)
        R['snapshots'] = snaps
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    # v11 dist: the bundle, the receipts, the uploaded copy
    v11b = z.read(PREFIX + V11 + 'dist/assets/index-DKbV5Nv9.js')
    up = z.read(PREFIX + 'historical_attachments/backrooms game/index-DKbV5Nv9.js')
    receipts = json.loads(z.read(PREFIX + 'verification/BUILD_REPRODUCTION.json'))
    r11 = [r for r in receipts if r.get('site_version') == 11][0]
    dist = {n[len(PREFIX + V11 + 'dist/'):]: z.read(n) for n in names if n.startswith(PREFIX + V11 + 'dist/') and not n.endswith('/')}
    exp = r11['expected_dist_hashes']
    check('v11_bundle', sha(v11b) == EXPECTED_V11_BUNDLE and len(v11b) == 304183 and v11b == up, bytes=len(v11b), sha256=sha(v11b), equalsUploadedCopy=v11b == up)
    check('v11_dist_vs_build_receipt', set(dist) == set(exp) and all(sha(dist[k]) == exp[k] for k in exp) and r11.get('dist_identical') is True,
          files=len(dist), receiptRuntime=r11.get('runtime'), receiptSaysIdentical=r11.get('dist_identical'))
    R['rebuild'] = {'freshNpmBuildHere': 'NOT RUN', 'why': 'this session cannot reach the npm registry (registry.npmjs.org: CONNECT 403 from the network policy, and no direct DNS); the rebuild evidence is the recovery\'s own receipt (Node v24.19.0, npm 11.9.0, 17/17 dist files identical) plus the byte identity of the archived dist with the history blobs and the uploaded copy',
                    'command': 'npm ci --ignore-scripts && npm run build   (in a copy of ' + V11 + ')'}
    # v11 dist against what this repository serves
    cmp = {}
    for k, b in sorted(dist.items()):
        p = os.path.join(REPO, 'public', k)
        if os.path.exists(p):
            m = open(p, 'rb').read(); cmp[k] = dict(v11Bytes=len(b), servedBytes=len(m), same=m == b, v11Sha256=sha(b), servedSha256=sha(m))
        else:
            cmp[k] = dict(v11Bytes=len(b), served=None, same=False, v11Sha256=sha(b))
    R['v11DistVsServed'] = cmp
    same = [k for k, v in cmp.items() if v['same']]
    check('v11_dist_vs_served_recorded', True, identical=len(same), different=[k for k, v in cmp.items() if not v['same'] and v.get('servedBytes')], notServed=[k for k, v in cmp.items() if v.get('served', 1) is None])
    json.dump(R, open(a.out, 'w'), indent=1); open(a.out, 'a').write('\n')
    print('RECOVERY: ' + ('VERIFIED' if R['ok'] else 'FAILED'))
    sys.exit(0 if R['ok'] else 1)

if __name__ == '__main__':
    main()
