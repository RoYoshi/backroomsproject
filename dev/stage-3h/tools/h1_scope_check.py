#!/usr/bin/env python3
"""Stage 3H1 - prove that 3H1 changed nothing but its own documentation and development tooling (development only).

  python3 -I dev/stage-3h/tools/h1_scope_check.py [--base 143b63f] [--rev HEAD | --worktree] [--out FILE.json]

  --base      the accepted B++ head (default 143b63ff42b88c6780c5043e0f61d64100f81f40)
  --rev       compare this commit with the base (default HEAD)
  --worktree  compare the working tree instead (tracked changes, staged or not, and untracked files)

Checks:
  1. every path that differs from the base is under dev/stage-3h/ or dev/devlog4dev/ (3H1's two homes), and is an addition: nothing is
     deleted or renamed, nothing outside those two folders is touched - not the game, not an earlier stage's tools or evidence, not a root
     document;
  2. the production files - every file outside dev/ - are byte-identical to the base: each file's SHA-256 is computed from its content at
     both sides (not taken from Git's object ids), so favicon.ico, the WAV and PNG media, the bundle and every script are compared byte
     for byte; the manifest digest is the SHA-256 of the sorted "path sha256" lines;
  3. every file under dev/ outside 3H1's two folders is byte-identical too.
Exit 0 only when all three hold."""
import argparse, hashlib, json, os, subprocess, sys
ap = argparse.ArgumentParser(); ap.add_argument('--base', default='143b63ff42b88c6780c5043e0f61d64100f81f40'); ap.add_argument('--rev', default='HEAD')
ap.add_argument('--worktree', action='store_true'); ap.add_argument('--out'); A = ap.parse_args()
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ALLOWED = ('dev/stage-3h/', 'dev/devlog4dev/')
git = lambda *a: subprocess.run(['git', '-C', REPO, *a], check=True, capture_output=True).stdout
sha = lambda b: hashlib.sha256(b).hexdigest()
base = git('rev-parse', A.base).decode().strip()
rev = None if A.worktree else git('rev-parse', A.rev).decode().strip()
ls = lambda r: [p for p in git('ls-tree', '-r', '-z', '--name-only', r).decode().split('\0') if p]
base_files = ls(base)
if A.worktree:
    tracked = [p for p in git('ls-files', '-z').decode().split('\0') if p]
    untracked = [p for p in git('ls-files', '-z', '--others', '--exclude-standard').decode().split('\0') if p]
    side_files = sorted(set(tracked + untracked) - {p for p in tracked if not os.path.exists(os.path.join(REPO, p))})
    read_side = lambda p: open(os.path.join(REPO, p), 'rb').read()
    deleted = sorted(p for p in base_files if not os.path.exists(os.path.join(REPO, p)))
else:
    side_files = ls(rev)
    read_side = lambda p: git('show', f'{rev}:{p}')
    deleted = sorted(set(base_files) - set(side_files))
read_base = lambda p: git('show', f'{base}:{p}')
added = sorted(set(side_files) - set(base_files))
common = sorted(set(side_files) & set(base_files))
modified = sorted(p for p in common if read_side(p) != read_base(p))
outside = [p for p in added + modified + deleted if not p.startswith(ALLOWED)]
prod = sorted(p for p in base_files if not p.startswith('dev/'))
prod_rows_base = [f'{p} {sha(read_base(p))}' for p in prod]
prod_rows_side = [f'{p} {sha(read_side(p))}' for p in prod if p in side_files]
dev_other = [p for p in base_files if p.startswith('dev/') and not p.startswith(ALLOWED)]
dev_other_changed = [p for p in dev_other if p not in side_files or read_side(p) != read_base(p)]
R = {'tool': 'dev/stage-3h/tools/h1_scope_check.py', 'base': base, 'side': 'working tree' if A.worktree else rev,
     'added': added, 'modified': modified, 'deleted': deleted, 'outsideAllowed': outside,
     'production': {'files': len(prod), 'bytes': sum(len(read_base(p)) for p in prod), 'manifestSha256Base': sha('\n'.join(prod_rows_base).encode()),
                    'manifestSha256Side': sha('\n'.join(prod_rows_side).encode()), 'identical': prod_rows_base == prod_rows_side},
     'devOutside3H1': {'files': len(dev_other), 'changed': dev_other_changed}}
R['ok'] = not outside and not deleted and not [p for p in modified if not p.startswith(ALLOWED)] and R['production']['identical'] and not dev_other_changed
s = json.dumps(R, indent=1)
if A.out: open(A.out, 'w').write(s + '\n')
print(f"added {len(added)}, modified {len(modified)}, deleted {len(deleted)}; outside dev/stage-3h/ and dev/devlog4dev/: {len(outside)}")
print(f"production files {R['production']['files']} ({R['production']['bytes']} bytes) byte-identical to the base: {R['production']['identical']}  manifest {R['production']['manifestSha256Base'][:16]}")
print(f"other dev/ files {len(dev_other)} unchanged: {not dev_other_changed}")
print('SCOPE CHECK: ' + ('PASS' if R['ok'] else 'FAIL'))
sys.exit(0 if R['ok'] else 1)
