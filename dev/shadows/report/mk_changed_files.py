#!/usr/bin/env python3
"""2D_SHADOWS_CHANGED_FILES.txt from git: every path that differs from the immutable parent, with status, SHA-256 and size."""
import hashlib, subprocess, sys
REPO, PARENT, OUT = sys.argv[1], 'f2805bb904c158df17c5c75c3d0d4681049bc246', sys.argv[2]
def git(*a): return subprocess.run(['git', '-C', REPO, *a], check=True, capture_output=True, text=True).stdout
rows = [l.split('\t') for l in git('diff', '--cached', '--name-status', '--no-renames', PARENT).splitlines() if l.strip()]   # the staged SH4 tree
rows = [r for r in rows if r[1] != '2D_SHADOWS_CHANGED_FILES.txt']                     # listed once below as "(this file)"
def info(path):
    data = subprocess.run(['git', '-C', REPO, 'show', f':{path}'], check=True, capture_output=True).stdout
    return hashlib.sha256(data).hexdigest(), len(data)
groups = {'shipped': [], 'reports': [], 'dev': []}
for st, path in rows:
    if path.startswith('dev/'): groups['dev'].append((st, path))
    elif path.startswith('2D_SHADOWS_'): groups['reports'].append((st, path))
    else: groups['shipped'].append((st, path))
L = ['2D LIGHTING & SHADOWS - changed files', '',
     f'Immutable gameplay parent: {PARENT} (tree 8cc77595fe6e88c425e2f8abd243f3463af44a18, v23.3.6)',
     'Final tree: the final SH4 commit. Its commit and tree are in the package receipt (2D_SHADOWS_PACKAGE_RECEIPT.txt, beside the ZIP).',
     'Status letters: A added, M modified, D deleted against the parent. SHA-256 and size of the file in the SH4 tree.', '',
     '== Served to browsers (the game) ==']
for st, p in groups['shipped']:
    h, n = info(p); L.append(f'{st}  {p:<40} sha256 {h}  {n} bytes')
L += ['   index.html: one 46-byte insertion, <script src="./assets/shadows-2d.js"></script> after inventory.js; removing it gives the parent file byte for byte.',
      '   assets/shadows-2d.js: the client-only presentation module (served through the existing assets/ whitelist; the server never loads it).', '',
      '== Unchanged ==',
      'Every other file of the parent is byte-identical, including the special-protection files',
      'ai.js, sim.js, move.js, server.js, mp.js, death_srv.js, dphys.js, camera_policy.js, and world.js',
      '(dev/shadows/freeze.py verify against dev/shadows/evidence/sh0/parent_manifest.json: 229 of the 230 parent files',
      'byte-identical; the one that differs is index.html. FREEZE OK).', '',
      '== Stage reports (repository root, documentation only) ==']
for st, p in groups['reports']:
    h, n = info(p); L.append(f'{st}  {p:<40} sha256 {h}  {n} bytes')
L.append(f'A  {"2D_SHADOWS_CHANGED_FILES.txt":<40} (this file)')
L += ['', '== Development tooling and evidence (dev/shadows/, never served: the server whitelist does not include dev/) ==']
for st, p in groups['dev']:
    h, n = info(p); L.append(f'{st}  {p:<72} {n} bytes')
L += ['', f'Totals: {len(groups["shipped"])} served, {len(groups["reports"]) + 1} reports (this file included), {len(groups["dev"])} dev files.']
open(OUT, 'w').write('\n'.join(L) + '\n')
print('\n'.join(L[:20]))
