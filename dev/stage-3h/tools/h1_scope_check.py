#!/usr/bin/env python3
"""Stage 3H - prove which files a stage changed, and that every other production file is byte-identical to the accepted B++ head
(development only).

  python3 -I dev/stage-3h/tools/h1_scope_check.py [--base 143b63f] [--rev HEAD | --worktree] [--allow-prod P1,P2,...] [--out FILE.json]

  --base        the accepted B++ head (default 143b63ff42b88c6780c5043e0f61d64100f81f40)
  --rev         compare this commit with the base (default HEAD)
  --worktree    compare the working tree instead (tracked changes, staged or not, and untracked files)
  --allow-prod  production paths (outside dev/) that this checkpoint may add or change on purpose, comma-separated.  Without it no production
                file may differ (Stage 3H1).  Each allowed path is reported with its SHA-256 on both sides, and whether it really changed.

Checks:
  1. every path that differs from the base is under dev/stage-3h/ or dev/devlog4dev/ (3H's two homes) or is an allowed production path;
     nothing is deleted or renamed;
  2. every other production file - every file outside dev/ - is byte-identical to the base: each file's SHA-256 is computed from its content
     at both sides (not taken from Git's object ids), so favicon.ico, the WAV and PNG media, the bundle and every script are compared byte
     for byte; the manifest digest is the SHA-256 of the sorted "path sha256" lines of the base's production files;
  3. every file under dev/ outside the two folders is unchanged (compared by Git's blob id, itself a hash of the content).
Exit 0 only when all three hold.
Stage 3H2: the same checks as at 3H1, made fast (one `git cat-file --batch` reader for every blob, blob ids for dev/ files; for the
working tree, the index's blob ids and one `git hash-object` call for only the files `git diff-files` names and the untracked ones),
and --allow-prod added; without --allow-prod the result is the one 3H1's version gave."""
import argparse, hashlib, json, os, subprocess, sys
ap = argparse.ArgumentParser(); ap.add_argument('--base', default='143b63ff42b88c6780c5043e0f61d64100f81f40'); ap.add_argument('--rev', default='HEAD')
ap.add_argument('--worktree', action='store_true'); ap.add_argument('--allow-prod', default=''); ap.add_argument('--out'); A = ap.parse_args()
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
HOMES = ('dev/stage-3h/', 'dev/devlog4dev/')
ALLOW_PROD = sorted(p.strip() for p in A.allow_prod.split(',') if p.strip())
git = lambda *a, **k: subprocess.run(['git', '-C', REPO, *a], check=True, capture_output=True, **k).stdout
sha = lambda b: hashlib.sha256(b).hexdigest()
base = git('rev-parse', A.base).decode().strip()
rev = None if A.worktree else git('rev-parse', A.rev).decode().strip()


def tree(r):                                    # path -> blob id, for every file of commit r
    out = {}
    for rec in git('ls-tree', '-r', '-z', r).split(b'\0'):
        if rec:
            meta, p = rec.split(b'\t', 1); out[p.decode()] = meta.split()[2].decode()
    return out


class Blobs:                                    # one `git cat-file --batch` process reads every blob
    def __init__(self):
        self.p = subprocess.Popen(['git', '-C', REPO, 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)

    def read(self, oid):
        self.p.stdin.write(oid.encode() + b'\n'); self.p.stdin.flush()
        hdr = self.p.stdout.readline().split()
        if len(hdr) < 3 or hdr[1] != b'blob': raise RuntimeError('not a blob: ' + oid)
        data = self.p.stdout.read(int(hdr[2])); self.p.stdout.read(1)
        return data

    def close(self):
        self.p.stdin.close(); self.p.wait()


B = Blobs()
base_t = tree(base)
if A.worktree:
    # the index's blob id for every tracked file, then the bytes of only what may differ from it: the files `git diff-files` names (its
    # stat check reads no unchanged file; a file whose stat changed is named and hashed, so nothing is missed) and the untracked ones
    side_t = {}
    for rec in git('ls-files', '-s', '-z').split(b'\0'):
        if rec:
            meta, p = rec.split(b'\t', 1); side_t[p.decode()] = meta.split()[1].decode()
    changed = [p for p in git('diff-files', '--name-only', '-z').decode().split('\0') if p]
    untracked = [p for p in git('ls-files', '-z', '--others', '--exclude-standard').decode().split('\0') if p]
    for p in changed:
        if not os.path.isfile(os.path.join(REPO, p)): side_t.pop(p, None)          # deleted in the working tree
    to_hash = sorted(set(p for p in changed + untracked if os.path.isfile(os.path.join(REPO, p))))
    ids = git('hash-object', '--stdin-paths', input='\n'.join(to_hash).encode()).decode().split() if to_hash else []
    side_t.update(zip(to_hash, ids))
    read_side = lambda p: open(os.path.join(REPO, p), 'rb').read()
else:
    side_t = tree(rev)
    read_side = lambda p: B.read(side_t[p])
added = sorted(set(side_t) - set(base_t))
deleted = sorted(set(base_t) - set(side_t))
modified = sorted(p for p in set(side_t) & set(base_t) if side_t[p] != base_t[p])
outside = [p for p in added + modified + deleted if not (p.startswith(HOMES) or p in ALLOW_PROD)]
prod = sorted(p for p in base_t if not p.startswith('dev/'))
rows_base, rows_side, differing, prod_bytes = [], [], [], 0
for p in prod:
    b = B.read(base_t[p]); hb = sha(b); prod_bytes += len(b); rows_base.append(f'{p} {hb}')
    if p in side_t:
        hs = hb if side_t[p] == base_t[p] else sha(read_side(p))
        rows_side.append(f'{p} {hs}')
        if hs != hb: differing.append(p)
added_prod = [p for p in added if not p.startswith('dev/')]
unexpected = [p for p in differing + added_prod if p not in ALLOW_PROD]
allowed = {}
for p in ALLOW_PROD:
    hb = sha(B.read(base_t[p])) if p in base_t else None
    hs = sha(read_side(p)) if p in side_t else None
    allowed[p] = {'base': hb, 'side': hs, 'changed': hb != hs}
dev_other = [p for p in base_t if p.startswith('dev/') and not p.startswith(HOMES)]
dev_other_changed = [p for p in dev_other if side_t.get(p) != base_t[p]]
B.close()
R = {'tool': 'dev/stage-3h/tools/h1_scope_check.py', 'base': base, 'side': 'working tree' if A.worktree else rev, 'allowProd': ALLOW_PROD,
     'added': added, 'modified': modified, 'deleted': deleted, 'outsideAllowed': outside,
     'production': {'files': len(prod), 'bytes': prod_bytes, 'manifestSha256Base': sha('\n'.join(rows_base).encode()),
                    'manifestSha256Side': sha('\n'.join(rows_side).encode()), 'identical': not differing and not added_prod,
                    'differing': differing, 'added': added_prod, 'notAllowed': unexpected, 'allowed': allowed},
     'devOutside3H1': {'files': len(dev_other), 'changed': dev_other_changed}}
R['ok'] = not outside and not deleted and not unexpected and not dev_other_changed
s = json.dumps(R, indent=1)
if A.out:
    with open(A.out, 'w') as f: f.write(s + '\n')
print(f"added {len(added)}, modified {len(modified)}, deleted {len(deleted)}; outside dev/stage-3h/ and dev/devlog4dev/ (and the allowed production files): {len(outside)}")
print(f"production files {len(prod)} ({prod_bytes} bytes) byte-identical to the base: {R['production']['identical']}  manifest {R['production']['manifestSha256Base'][:16]}"
      + (f"; changed on purpose: {', '.join(p for p in ALLOW_PROD if allowed[p]['changed']) or 'none'}" if ALLOW_PROD else ''))
for p, d in allowed.items():
    if not d['changed']: print(f"  allowed {p}: NOT changed (declared, but identical to the base or absent on both sides)")
if unexpected: print('  production files changed WITHOUT being allowed: ' + ', '.join(unexpected))
print(f"other dev/ files {len(dev_other)} unchanged: {not dev_other_changed}")
print('SCOPE CHECK: ' + ('PASS' if R['ok'] else 'FAIL'))
sys.exit(0 if R['ok'] else 1)
