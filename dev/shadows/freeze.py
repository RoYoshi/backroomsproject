#!/usr/bin/env python3
"""2D Lighting & Shadows - SH0 gameplay freeze manifest and equivalence verifier.

  python3 dev/shadows/freeze.py write  --rev f2805bb... --out dev/shadows/evidence/sh0/parent_manifest.json
  python3 dev/shadows/freeze.py verify --manifest dev/shadows/evidence/sh0/parent_manifest.json [--rev HEAD | --dir PATH] [--json OUT]

The manifest records every tracked file of the immutable v23.3.6 parent: git mode, git blob id,
SHA-256 and size, plus the file's protection class.  `verify` compares a candidate (a git revision,
or a plain directory such as an extracted release ZIP) against it and FAILS when anything outside
the presentation allowance changed.

Protection classes
  protected     special-protection gameplay files named by the pack: byte-identical, no exceptions
  frozen        every other v23.3.6 runtime/test/tool file: byte-identical (gameplay, AI, networking,
                timing, entity presentation, the shipped bundle, the retained test suites)
  mixed         world.js - gameplay data + art; may change only inside drawing code, proven by
                dev/shadows/world_equiv.js (this tool only reports the change)
  presentation  index.html - may change only to load the client-only shadow presentation script
  docs          earlier stage reports (*.md / *.txt at the root, dev/*.md): never edited in this stage
Additions are allowed only under the presentation allowance: assets/shadows-2d.js, dev/shadows/**,
and the 2D_SHADOWS_* reports at the root.
"""
import argparse, hashlib, json, os, subprocess, sys
from pathlib import Path

PARENT = 'f2805bb904c158df17c5c75c3d0d4681049bc246'
PARENT_TREE = '8cc77595fe6e88c425e2f8abd243f3463af44a18'
PROTECTED = ['ai.js', 'sim.js', 'move.js', 'server.js', 'mp.js', 'death_srv.js', 'dphys.js', 'camera_policy.js']
MIXED = ['world.js']
PRESENTATION = ['index.html']
ALLOWED_NEW_PREFIXES = ('dev/shadows/', '2D_SHADOWS_')
ALLOWED_NEW_FILES = ('assets/shadows-2d.js',)


def classify(path):
    if path in PROTECTED: return 'protected'
    if path in MIXED: return 'mixed'
    if path in PRESENTATION: return 'presentation'
    if '/' not in path and (path.endswith('.md') or path.endswith('.txt')): return 'docs'
    if path.startswith('dev/') and path.count('/') == 1 and (path.endswith('.md') or path.endswith('.txt') or path.endswith('.json')): return 'docs'
    return 'frozen'


def git(repo, *args, data=None):
    return subprocess.run(['git', '-C', str(repo), *args], input=data, capture_output=True, check=True).stdout


def tree_entries(repo, rev):
    out = git(repo, 'ls-tree', '-r', '-z', '--full-tree', rev)
    ents = []
    for rec in out.split(b'\0'):
        if not rec: continue
        meta, path = rec.split(b'\t', 1)
        mode, typ, oid = meta.decode().split()
        if typ == 'blob': ents.append((path.decode(), mode, oid))
    return ents


def blob_bytes(repo, oids):
    """stream many blobs through one `git cat-file --batch` (no per-file process)"""
    p = subprocess.Popen(['git', '-C', str(repo), 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    out = {}
    for oid in oids:
        p.stdin.write((oid + '\n').encode()); p.stdin.flush()
        hdr = p.stdout.readline().decode().split()
        size = int(hdr[2]); body = p.stdout.read(size); p.stdout.read(1)
        out[oid] = body
    p.stdin.close(); p.wait()
    return out


def git_blob_id(b):
    return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()


def snapshot_rev(repo, rev):
    ents = tree_entries(repo, rev)
    data = blob_bytes(repo, [o for _, _, o in ents])
    return {p: {'mode': m, 'blob': o, 'sha256': hashlib.sha256(data[o]).hexdigest(), 'bytes': len(data[o])} for p, m, o in ents}


def snapshot_dir(root):
    root = Path(root); snap = {}
    for f in sorted(root.rglob('*')):
        if not f.is_file() or '.git' in f.relative_to(root).parts or '__pycache__' in f.parts: continue
        b = f.read_bytes(); rel = f.relative_to(root).as_posix()
        snap[rel] = {'mode': '100755' if os.access(f, os.X_OK) else '100644', 'blob': git_blob_id(b), 'sha256': hashlib.sha256(b).hexdigest(), 'bytes': len(b)}
    return snap


def cmd_write(a):
    repo = Path(a.repo).resolve()
    commit = git(repo, 'rev-parse', a.rev + '^{commit}').decode().strip()
    tree = git(repo, 'rev-parse', a.rev + '^{tree}').decode().strip()
    snap = snapshot_rev(repo, commit)
    files = [{'path': p, 'class': classify(p), **v} for p, v in sorted(snap.items())]
    counts = {}
    for f in files: counts[f['class']] = counts.get(f['class'], 0) + 1
    man = {'schema': 'tfb-shadows-freeze/1', 'commit': commit, 'tree': tree, 'expectedParent': PARENT, 'expectedTree': PARENT_TREE,
           'parentVerified': commit == PARENT and tree == PARENT_TREE, 'protected': PROTECTED, 'mixed': MIXED, 'presentation': PRESENTATION,
           'allowedNew': {'prefixes': list(ALLOWED_NEW_PREFIXES), 'files': list(ALLOWED_NEW_FILES)}, 'classCounts': counts, 'fileCount': len(files), 'files': files}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(man, indent=1) + '\n')
    print(json.dumps({k: man[k] for k in ('commit', 'tree', 'parentVerified', 'fileCount', 'classCounts')}))
    for p in PROTECTED: print('PROTECTED', p, snap[p]['blob'], snap[p]['sha256'])
    return 0 if man['parentVerified'] else 2


def cmd_verify(a):
    man = json.loads(Path(a.manifest).read_text())
    base = {f['path']: f for f in man['files']}
    if a.dir: cand = snapshot_dir(a.dir); src = {'dir': str(Path(a.dir).resolve())}
    else:
        repo = Path(a.repo).resolve(); commit = git(repo, 'rev-parse', a.rev + '^{commit}').decode().strip()
        cand = snapshot_rev(repo, commit); src = {'rev': commit, 'tree': git(repo, 'rev-parse', a.rev + '^{tree}').decode().strip()}
    changed, removed, added, violations = [], [], [], []
    for p, f in base.items():
        c = cand.get(p)
        if c is None: removed.append(p); violations.append(f'removed {f["class"]} file {p}'); continue
        if c['sha256'] != f['sha256'] or (not a.dir and c['mode'] != f['mode']):
            changed.append({'path': p, 'class': f['class'], 'before': f['sha256'], 'after': c['sha256'], 'bytesBefore': f['bytes'], 'bytesAfter': c['bytes']})
            if f['class'] in ('protected', 'frozen', 'docs'): violations.append(f'changed {f["class"]} file {p}')
    for p in sorted(set(cand) - set(base)):
        added.append(p)
        if not (p in ALLOWED_NEW_FILES or p.startswith(ALLOWED_NEW_PREFIXES)): violations.append(f'unexpected new file {p}')
    prot = {p: (cand.get(p) or {}).get('sha256') == base[p]['sha256'] for p in man['protected']}
    rep = {'schema': 'tfb-shadows-verify/1', 'manifestCommit': man['commit'], 'candidate': src, 'unchanged': len(base) - len(changed) - len(removed),
           'changed': changed, 'removed': removed, 'added': added, 'protectedIdentical': prot, 'allProtectedIdentical': all(prot.values()),
           'violations': violations, 'ok': not violations}
    if a.json: Path(a.json).parent.mkdir(parents=True, exist_ok=True); Path(a.json).write_text(json.dumps(rep, indent=1) + '\n')
    print(f"candidate {src}: {rep['unchanged']}/{len(base)} parent files byte-identical; {len(changed)} changed; {len(removed)} removed; {len(added)} added")
    for p, ok in prot.items(): print(('IDENTICAL ' if ok else 'CHANGED   ') + p)
    for c in changed: print(f"CHANGED [{c['class']}] {c['path']}")
    for p in added: print('ADDED', p)
    for v in violations: print('VIOLATION', v)
    print('FREEZE OK' if rep['ok'] else 'FREEZE VIOLATED')
    return 0 if rep['ok'] else 1


def main():
    P = argparse.ArgumentParser(); S = P.add_subparsers(dest='cmd', required=True)
    w = S.add_parser('write'); w.add_argument('--repo', default='.'); w.add_argument('--rev', default=PARENT); w.add_argument('--out', required=True)
    v = S.add_parser('verify'); v.add_argument('--repo', default='.'); v.add_argument('--manifest', required=True); v.add_argument('--rev', default='HEAD'); v.add_argument('--dir'); v.add_argument('--json')
    a = P.parse_args()
    sys.exit(cmd_write(a) if a.cmd == 'write' else cmd_verify(a))


if __name__ == '__main__':
    main()
