#!/usr/bin/env python3
"""Fresh ZIP extraction, reproducible builds and all named spatial gates."""
import pathlib, subprocess, zipfile, hashlib, json, os, time, sys

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1]).resolve()
destination = pathlib.Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=False)
destination.mkdir(parents=True, exist_ok=False)
assert ' ' in str(destination), 'Use a path containing spaces'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
files = []
for raw in subprocess.check_output(['git', 'ls-files', '--stage', '-z'], cwd=root).split(b'\0'):
    if not raw:
        continue
    meta, name = raw.split(b'\t', 1)
    mode, blob, stage = meta.decode().split()
    assert stage == '0'
    files.append((name.decode(), int(mode, 8)))
archive = destination/'stage-h-portable-candidate.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name, mode in files:
        info = zipfile.ZipInfo('thefarbackrooms-level0/'+name, (2026,10,4,0,0,0))
        info.external_attr = mode << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, (root/name).read_bytes())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    z.extractall(destination)
clean = destination/'thefarbackrooms-level0'
for name, mode in files:
    assert (clean/name).read_bytes() == (root/name).read_bytes(), name
    (clean/name).chmod(mode & 0o777)
before = {name: sha(clean/name) for name in ['ai.js','sim.js','ents.js']}
rows = []
commands = [(f'build-{round}-{name}', ['bash', f'dev/build_{name}.sh']) for round in [1,2] for name in ['ai','sim','ents']]
commands += [
    ('physics25d', ['node','dev/tests/physics25d.js']),
    ('network25d', ['node','dev/tests/network25d.js']),
    ('view25d', ['node','dev/tests/view25d.js']),
    ('served-package', ['node','dev/stage_h/served_package.js',str(out/'served.json')]),
    ('fps', ['npm','run','test:fps']),
    ('camera', ['npm','run','test:camera']),
]
for name, cmd in commands:
    print('START', name, flush=True)
    start = time.monotonic()
    with (out/(name+'.log')).open('xb') as log:
        try:
            p = subprocess.run(cmd, cwd=clean, stdout=log, stderr=subprocess.STDOUT,
                env={**os.environ, 'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))}, timeout=2400)
            code = p.returncode
        except subprocess.TimeoutExpired:
            code = 124
            log.write(b'\nPortable orchestration deadline exceeded; failure retained.\n')
    row = {'name':name,'command':cmd,'exitCode':code,'seconds':time.monotonic()-start}
    rows.append(row)
    (out/'progress.json').write_text(json.dumps(rows,indent=2)+'\n')
    print(row, flush=True)
    if code:
        raise SystemExit(code)
    if name.startswith('build-'):
        assert before == {n:sha(clean/n) for n in before}, 'Generated runtime diverged'
validated = {name:sha(clean/name) for name,_ in files
    if name.startswith(('assets/','levels/')) or
    (pathlib.Path(name).suffix in ['.js','.py','.sh','.html','.css'] and '/evidence/' not in name)}
result = {'status':'PASS','sourceFiles':len(files),'byteEqualExtraction':True,
    'pathContainsSpaces':True,'cleanPath':str(clean),'archiveSha256':sha(archive),
    'buildsRepeated':2,'buildHashes':before,'checks':rows,'validatedFiles':validated,
    'runtime':subprocess.check_output(['node','-v'],text=True).strip(),
    'scope':'Clean candidate source extraction; final Git-tree/ZIP verification follows publication.'}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS clean extraction, two reproducible builds and all named gates',flush=True)
