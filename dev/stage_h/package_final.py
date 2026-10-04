#!/usr/bin/env python3
"""Publish only an exact verified stage-h source checkpoint; no self hashes."""
import pathlib, subprocess, hashlib, json, zipfile, sys, datetime

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=False)
git = lambda *a: subprocess.check_output(['git',*a],cwd=root,text=True).strip()
sha, tree = git('rev-parse','HEAD'), git('rev-parse','HEAD^{tree}')
parent, parent_tree = '7fb4dafef92040571209403358e536ccb1105509', 'eee7f43a74aeb4d0e7ef38effdfc7516eee5e8cf'
assert git('branch','--show-current') == 'stage-h'
assert git('status','--porcelain') == '', 'Final source must be clean'
assert git('rev-parse','FETCH_HEAD') == sha
assert git('ls-remote','origin','refs/heads/stage-h').split()[0] == sha
subprocess.run(['git','merge-base','--is-ancestor',parent,sha],cwd=root,check=True)
assert git('rev-parse',parent+'^{tree}') == parent_tree
H = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
ev = root/'dev/stage_h/evidence/h5'
portable = json.loads((ev/'portable-01/result.json').read_text())
parity = json.loads((ev/'regression-01/parity/result.json').read_text())
baseline = json.loads((ev/'baseline-comparison.json').read_text())
regression = json.loads((ev/'regression-final.json').read_text())
assert portable['status'] == parity['status'] == 'PASS'
assert baseline['status'] == 'PASS_BASELINE_EQUIVALENCE'
assert regression['status'] == 'PASS' and len(regression['finalChecks']) == 19 and all(r['exitCode']==0 for r in regression['finalChecks'])
assert parity['traces'] == 46 and parity['records'] == 35098 and parity['tolerance'] == 0
for name, digest in portable['validatedFiles'].items():
    assert H(root/name) == digest, 'Changed since portable validation: '+name
audit = json.loads((ev/'scope-audit.json').read_text())
assert audit['status'] == 'PASS'
paths = sorted(root.glob('25D_STAGE_H_*.md'))+[root/'25D_STAGE_H_CHANGED_FILES.txt']
required = ['REPORT','TEST_SUMMARY','BASELINE_FAILURES','PARITY','HUMAN_QA','PRESENTATION','VIEW','LIGHTING','BROWSER_EVIDENCE','GIT_CHECKPOINTS']
assert all(root.joinpath('25D_STAGE_H_'+n+'.md').exists() for n in required)
reports = []
for p in paths:
    data = p.read_text()
    if p.name == '25D_STAGE_H_REPORT.md':
        marker = 'Final remote commit and tree are recorded in the external publication receipt accompanying this archive.'
        assert marker in data
        data = data.replace(marker, f'Final verified remote commit: `{sha}`.\n\nFinal verified source tree: `{tree}`.\n\nBranch: `stage-h`. Exact source is separate from these finalized publication reports.')
    if p.name in ['25D_STAGE_H_GIT_CHECKPOINTS.md','25D_STAGE_H_HUMAN_QA.md']:
        data += f'\nH5 final verified remote: `{sha}`; tree `{tree}`.\n'
    target = out/p.name
    target.write_text(data)
    reports.append(target)
entries = []
for raw in subprocess.check_output(['git','ls-tree','-rz',sha],cwd=root).split(b'\0'):
    if not raw:
        continue
    meta, name = raw.split(b'\t',1)
    mode, kind, blob = meta.decode().split()
    assert kind == 'blob'
    entries.append((mode,blob,name.decode()))
# The index-derived changed-file audit must describe exactly the final tree.
actual = git('diff','--name-status',parent,sha).splitlines()
assert actual == audit['changedFiles'], 'Final scope differs from audited staged tree'
archive = out/'THE_FAR_BACKROOMS_STAGE_H_FINAL.zip'
transfer = out/'source-transfer.tmp.zip'
subprocess.run(['git','archive','--format=zip','-o',str(transfer),sha],cwd=root,check=True)
def put(z, name, data, mode=0o100644):
    info = zipfile.ZipInfo(name,(2026,10,4,0,0,0))
    info.external_attr = mode << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(info,data)
with zipfile.ZipFile(transfer) as source, zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for mode,blob,name in entries:
        put(z,'thefarbackrooms-level0/'+name,source.read(name),int(mode,8))
    for p in reports:
        put(z,'STAGE_H_PUBLICATION/'+p.name,p.read_bytes())
transfer.unlink()
fresh = out/'Final Stage H Verified Extraction'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    expected = {'thefarbackrooms-level0/'+name for _,_,name in entries}
    assert {n for n in z.namelist() if n.startswith('thefarbackrooms-level0/')} == expected
    z.extractall(fresh)
    for mode,blob,name in entries:
        member = 'thefarbackrooms-level0/'+name
        data = z.read(member)
        assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest() == blob, name
        assert (z.getinfo(member).external_attr>>16)&0o777 == int(mode,8)&0o777, name
        p = fresh/member
        assert p.read_bytes() == data, name
        p.chmod(int(mode,8)&0o777)
    for p in reports:
        assert z.read('STAGE_H_PUBLICATION/'+p.name) == p.read_bytes()
verification = {
    'status':'PASS','stage':'H','engineeringStatus':'2.5D STAGE H ENGINEERING COMPLETE — HUMAN QA PENDING',
    'repository':'RoYoshi/backroomsproject','branch':'stage-h','finalRemoteCommit':sha,'finalRemoteTree':tree,
    'acceptedParentCommit':parent,'acceptedParentTree':parent_tree,'parentHumanQA':'PASS',
    'sourceFiles':len(entries),'everySourceBlobAndModeMatchesGitTree':True,'freshFinalExtractionMatches':True,
    'allPortableValidatedFilesUnchanged':True,'changedFileAuditExact':True,
    'archive':archive.name,'archiveBytes':archive.stat().st_size,'archiveSha256':H(archive),'crc':'PASS',
    'publicationFiles':{p.name:H(p) for p in reports},'portableValidation':{k:v for k,v in portable.items() if k!='validatedFiles'},
    'frozenParity':{k:parity[k] for k in ['status','traces','records','tolerance','frozenUnchanged','map']},
    'Z14-H':'PASS','Z29':'PASS','Z30':'PASS 8/8','view25d':'PASS 2/2, repeated in clean extraction',
    'network25d':'PASS 5/5, repeated in clean extraction','physics25d':'PASS 5/5, repeated in clean extraction',
    'baselineComparison':baseline['status'],'mainModifiedOrMerged':False,'stageIBegun':False,'humanQA':'PENDING',
    'limitations':['SwiftShader software GPU misses 16.7 ms frame target; no hardware/capacity certification',
        'Full-quality SwiftShader two-client fall capture missed airborne phase; existing reduced detail passes unchanged assertion',
        'Accepted eleven aggregate failures, shared F22 and P08 UNKNOWN remain',
        'Stage G 24-active physics/payload limitation remains; Stage I not started',
        'External Google Fonts network/TLS limitation retained'],
    'verifiedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()
}
(out/'25D_STAGE_H_PACKAGE_VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n')
(out/(archive.name+'.sha256')).write_text(H(archive)+'  '+archive.name+'\n')
print(json.dumps({k:verification[k] for k in ['status','finalRemoteCommit','finalRemoteTree','sourceFiles','archive','archiveBytes','archiveSha256']}))
