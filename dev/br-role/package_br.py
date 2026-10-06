#!/usr/bin/env python3
"""BR-RoLE package: ZIP of a commit (git archive), its SHA-256, and a verification receipt.

  package_br.py REPO COMMIT OUTDIR REMOTE_VERIFY_JSON NAME

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id), nothing missing or extra;
  - the gameplay freeze (dev/br-role/freeze_br.py on the extracted ZIP): v23.3.6 files byte-identical except the two
    presentation edits, each of which undoes to the parent's bytes;
  - the shipped client files' SHA-256; the commit, tree and parent; what GitHub reports for the branch after the push.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and BR_ROLE_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, subprocess, sys, tempfile, time, zipfile
from pathlib import Path
REPO, COMMIT, OUT, RV, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
REMOTE = json.loads(RV.read_text())
def git(*a): return subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
OUT.mkdir(parents=True, exist_ok=True); zpath = OUT / f'{name}.zip'
subprocess.run(['git', '-C', str(REPO), 'archive', '--format=zip', f'--prefix={name}/', '-o', str(zpath), COMMIT], check=True)
sha = hashlib.sha256(zpath.read_bytes()).hexdigest(); (OUT / f'{name}.zip.sha256').write_text(f'{sha}  {zpath.name}\n')
commit = git('rev-parse', COMMIT).strip(); tree = git('rev-parse', f'{COMMIT}^{{tree}}').strip(); parent = git('rev-parse', f'{COMMIT}^').strip()
listing = {l.split('\t', 1)[1]: l.split('\t', 1)[0].split()[2] for l in git('ls-tree', '-r', COMMIT).splitlines()}
with tempfile.TemporaryDirectory() as td:
    with zipfile.ZipFile(zpath) as z: bad_zip = z.testzip(); z.extractall(td)
    root = Path(td) / name
    files = sorted(str(p.relative_to(root)) for p in root.rglob('*') if p.is_file())
    missing = sorted(set(listing) - set(files)); extra = sorted(set(files) - set(listing))
    mism = [f for f in files if f in listing and subprocess.run(['git', 'hash-object', str(root / f)], check=True, capture_output=True, text=True).stdout.strip() != listing[f]]
    fz = subprocess.run([sys.executable, str(root / 'dev/br-role/freeze_br.py'), '--dir', str(root), '--label', '<extracted ZIP>'], capture_output=True, text=True)
    freeze = [l for l in fz.stdout.strip().splitlines() if not l.startswith('ADDED')]
    shipped = {f: {'sha256': hashlib.sha256((root / f).read_bytes()).hexdigest(), 'bytes': (root / f).stat().st_size} for f in ['assets/br-role.js', 'assets/index-DKbV5Nv9.js', 'index.html']}
    version = next((l.split("'")[1] for l in (root / 'assets/br-role.js').read_text().splitlines() if 'const VERSION' in l), '?')
remote_ok = REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'commit': commit, 'tree': tree, 'parentCommit': parent,
     'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'freeze': {'exit': fz.returncode, 'lines': freeze}, 'shipped': shipped, 'moduleVersion': version, 'remote': REMOTE, 'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and fz.returncode == 0 and remote_ok)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
T = ['THE FAR BACKROOMS - BR-RoLE - package and source verification receipt', '', f'written {R["written"]} by dev/br-role/package_br.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}', f'zip CRCs   {"all OK" if bad_zip is None else "BAD: " + bad_zip}', '',
     '== Source revision (branch br-role, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}  ({git("log", "-1", "--format=%s", parent).strip()})', 'gameplay   f2805bb904c158df17c5c75c3d0d4681049bc246  (immutable v23.3.6 lineage)', '',
     '== GitHub (checked after the push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}', f'REST API commit   {REMOTE["githubApi"]["commit"]}',
     f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}', f'main (untouched)  {REMOTE["mainUntouched"]}',
     f'lighting-shadows-2d (untouched, SH7)  {REMOTE.get("lightingShadows2dUntouched", "?")}', f'matches the packaged commit and tree: {yn(remote_ok)}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     '== Gameplay freeze (dev/br-role/freeze_br.py, run on the extracted ZIP) ==', *freeze, '',
     '== Shipped client files ==', *[f'{f:<26} sha256 {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], f'lighting module version: {version}', '',
     f'RESULT: {"OK" if R["ok"] else "FAILED"}', '']
(OUT / 'BR_ROLE_PACKAGE_RECEIPT.txt').write_text('\n'.join(T))
print(json.dumps({k: R[k] for k in ['package', 'sha256', 'bytes', 'commit', 'tree', 'filesInZip', 'filesInCommit', 'zipIntegrity', 'ok']}, indent=1))
