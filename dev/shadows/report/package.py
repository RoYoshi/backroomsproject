#!/usr/bin/env python3
"""Final package: ZIP of the SH4 commit (git archive), its SHA-256, and a verification receipt.

  package.py REPO COMMIT OUTDIR [REMOTE_VERIFY_JSON]

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == git ls-tree) and nothing is missing or extra;
  - the protected / frozen v23.3.6 files are byte-identical to the immutable parent (dev/shadows/freeze.py verify);
  - index.html is the parent's plus the one 46-byte script tag; the served module's SHA-256;
  - the commit, tree and parent of the packaged revision, and (REMOTE_VERIFY_JSON, written by the caller after the
    push) what GitHub reports for the branch.
Writes OUTDIR/<name>.zip, <name>.zip.sha256, receipt.json and 2D_SHADOWS_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, subprocess, sys, tempfile, time, zipfile
from pathlib import Path
REPO, COMMIT, OUT = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
REMOTE = json.loads(Path(sys.argv[4]).read_text()) if len(sys.argv) > 4 else None
PARENT = 'f2805bb904c158df17c5c75c3d0d4681049bc246'
def git(*a): return subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
OUT.mkdir(parents=True, exist_ok=True)
name = 'THE_FAR_BACKROOMS_2D_LIGHTING_SHADOWS_SH4'
zpath = OUT / f'{name}.zip'
subprocess.run(['git', '-C', str(REPO), 'archive', '--format=zip', f'--prefix={name}/', '-o', str(zpath), COMMIT], check=True)
sha = hashlib.sha256(zpath.read_bytes()).hexdigest()
(OUT / f'{name}.zip.sha256').write_text(f'{sha}  {zpath.name}\n')
commit = git('rev-parse', COMMIT).strip(); tree = git('rev-parse', f'{COMMIT}^{{tree}}').strip(); parent = git('rev-parse', f'{COMMIT}^').strip()
listing = {}
for line in git('ls-tree', '-r', COMMIT).splitlines():
    meta, path = line.split('\t', 1); mode, kind, blob = meta.split(); listing[path] = blob
with tempfile.TemporaryDirectory() as td:
    with zipfile.ZipFile(zpath) as z: z.extractall(td)
    root = Path(td) / name
    files = sorted(str(p.relative_to(root)) for p in root.rglob('*') if p.is_file())
    missing = sorted(set(listing) - set(files)); extra = sorted(set(files) - set(listing)); mismatched = []
    for f in files:
        if f in listing:
            h = subprocess.run(['git', 'hash-object', str(root / f)], check=True, capture_output=True, text=True).stdout.strip()
            if h != listing[f]: mismatched.append(f)
    fz = subprocess.run([sys.executable, str(root / 'dev/shadows/freeze.py'), 'verify', '--manifest', str(root / 'dev/shadows/evidence/sh0/parent_manifest.json'), '--dir', str(root)], capture_output=True, text=True)
    freeze = fz.stdout.replace(str(root), '<extracted ZIP>').strip().splitlines()
    sha_of = lambda f: hashlib.sha256((root / f).read_bytes()).hexdigest()
    shipped = {f: {'sha256': sha_of(f), 'bytes': (root / f).stat().st_size} for f in ['assets/shadows-2d.js', 'index.html']}
    idx = (root / 'index.html').read_bytes(); tag = b'<script src="./assets/shadows-2d.js"></script>'
    parent_index = subprocess.run(['git', '-C', str(REPO), 'show', f'{PARENT}:index.html'], check=True, capture_output=True).stdout
    index_ok = idx.count(tag) == 1 and idx.replace(tag, b'', 1) == parent_index and len(tag) == 46
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'commit': commit, 'tree': tree, 'parentCommit': parent,
     'immutableGameplayParent': PARENT, 'filesInZip': len(files), 'filesInCommit': len(listing),
     'missing': missing, 'extra': extra, 'contentMismatches': mismatched,
     'freezeVerify': {'exit': fz.returncode, 'summary': freeze[0] if freeze else '', 'verdict': freeze[-1] if freeze else '',
                      'protected': [l for l in freeze if l.startswith(('IDENTICAL', 'CHANGED'))]},
     'shipped': shipped, 'indexHtmlIsParentPlusOneScriptTag': index_ok, 'remote': REMOTE,
     'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
remote_ok = REMOTE is None or (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree)
R['ok'] = bool(not missing and not extra and not mismatched and fz.returncode == 0 and freeze and freeze[-1] == 'FREEZE OK' and index_ok and remote_ok)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
T = ['THE FAR BACKROOMS - 2D LIGHTING & SHADOWS - package and source verification receipt', '',
     f'written {R["written"]} by dev/shadows/report/package.py', '',
     '== Package ==', f'file      {zpath.name}', f'bytes     {R["bytes"]}', f'sha256    {sha}', '',
     '== Source revision (branch lighting-shadows-2d, repository RoYoshi/backroomsproject) ==',
     f'commit    {commit}', f'tree      {tree}', f'parent    {parent}  (SH3)', f'gameplay  {PARENT}  (immutable v23.3.6 parent)', '']
if REMOTE:
    T += ['== GitHub (checked after the push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}',
          f'REST API commit   {REMOTE["githubApi"]["commit"]}', f'REST API tree     {REMOTE["githubApi"]["tree"]}',
          f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}', f'main (untouched)  {REMOTE["mainUntouched"]}',
          f'matches the packaged commit and tree: {yn(remote_ok)}', '']
T += ['== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
      f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mismatched)}',
      '(every file hashed with git hash-object and compared with the commit\'s blob id)', '',
      '== Gameplay freeze (dev/shadows/freeze.py verify, run on the extracted ZIP) ==', *[l for l in freeze if l.startswith(('candidate', 'IDENTICAL', 'CHANGED', 'REMOVED', 'FREEZE'))], '',
      '== Shipped client files ==',
      *[f'{f:<22} sha256 {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()],
      f'index.html is the parent\'s plus one 46-byte <script src="./assets/shadows-2d.js"></script>: {yn(index_ok)}', '',
      f'RESULT: {"OK" if R["ok"] else "FAILED"}', '']
(OUT / '2D_SHADOWS_PACKAGE_RECEIPT.txt').write_text('\n'.join(T))
print(json.dumps({k: R[k] for k in ['package', 'sha256', 'bytes', 'commit', 'tree', 'filesInZip', 'filesInCommit', 'ok']}, indent=1))
