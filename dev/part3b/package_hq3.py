#!/usr/bin/env python3
"""HQ3: package and verify the corrected final Part 3B source.

Usage: python dev/part3b/package_hq3.py <out> <receipt.json>
Follows package_final.py (P3B5), re-bound to the HQ3 acceptance of the
top-down correction. The receipt is the caller's independent remote read
(branch head, commit, tree, recursive remote tree, main head, ancestry).
Steps: identity/remote/audit checks -> deterministic ZIP of the exact committed
Git blobs and modes -> CRC/namelist -> fresh extraction under a path with
spaces -> blob/mode verification -> two repeated generated-file builds and
invariants, served-package, redirect and HQ1 focused smoke checks from the
extraction -> source manifest and source/package/publication receipts.
"""
import pathlib,subprocess,json,zipfile,sys,hashlib,datetime,os
from release_common import ROOT,PARENT,PARENT_TREE,PARENT_ZIP,STATUS,git,sha,blob,entries,validated,tree_hash,audit
HQ1,HQ2='ae7157cc1fd246e72dc809b71c0c34acb54f0ca3','1a08f3c2cd78a033e8fb81a76d20859666c9ccb4'
MAIN='7781e1ac34aa09970df57fae3fc107a873fa2731'
out=pathlib.Path(sys.argv[1]).resolve();receipt=json.loads(pathlib.Path(sys.argv[2]).read_text());out.mkdir(parents=True,exist_ok=False)
commit,tree=git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}')
assert git('branch','--show-current')=='part-3b';assert git('status','--porcelain')==''
assert receipt['commit']==commit and receipt['tree']==tree and receipt['remoteBranchAndCommitIndependentlyRead']
assert receipt['mainHead']==MAIN and receipt['acceptedParentIsAncestor'] and receipt['hq2IsAncestor'] and receipt['parent']==git('rev-parse','HEAD^')
source=entries(commit);assert tree_hash(source)==tree
remote={r['path']:(r['mode'],r['sha']) for r in receipt['remoteTreeEntries'] if r['type']=='blob'}
assert remote=={n:(mode,digest) for mode,digest,n in source},'remote recursive tree differs'
# No gameplay/runtime change after HQ1; HQ3 changes only documentation, acceptance and packaging.
since1=git('diff','--name-only',HQ1,commit).split();assert all(n.startswith(('dev/part3b/','PART_3B_')) for n in since1),since1
since2=git('diff','--name-only',HQ2,commit).split();assert all(n.startswith(('dev/part3b/certify_hq3.py','dev/part3b/package_hq3.py','dev/part3b/evidence/hq3/','PART_3B_')) for n in since2),since2
acceptance=json.loads((ROOT/'dev/part3b/evidence/hq3/acceptance.json').read_text())
assert acceptance['status']=='PASS' and acceptance['humanQA']=='PENDING' and all(r['disposition']=='PASS' for r in acceptance['rows'])
assert [r['id'] for r in acceptance['rows']]==[f'B-{i:02}' for i in range(1,20)]+['HQ-01','HQ-02','B-20']
for r in acceptance['rows']:
 for e in r['evidence']:assert sha(ROOT/e['path'])==e['sha256'],('evidence changed after certification',e['path'])
assert {n for _,_,n in source if validated(n)}==set(acceptance['validatedFiles'])
for n,digest in acceptance['validatedFiles'].items():assert sha(ROOT/n)==digest,'Changed after HQ3 certification: '+n
scope=audit(source);assert (ROOT/'PART_3B_CHANGED_FILES.txt').read_text().splitlines()==scope['changedFiles']
reports=[]
for name in ['REPORT','TEST_SUMMARY','BASELINE_FAILURES','CHANGED_FILES','HUMAN_QA','HUMAN_QA_CORRECTION','CAMERA_DEPTH','CUTAWAY_POLICY','ACCEPTANCE','PERFORMANCE','GIT_CHECKPOINTS']:
 filename='PART_3B_'+name+('.txt' if name=='CHANGED_FILES' else '.md');data=(ROOT/filename).read_text()
 if name=='REPORT':
  marker='Final source identity is recorded in the accompanying external publication receipt.';assert marker in data and STATUS in data
  data=data.replace(marker,f'Final verified remote commit: `{commit}`.\n\nFinal verified source tree: `{tree}`.\n\nBranch: `part-3b`. Exact committed source is separate from these finalized publication reports.')
 if name in ['HUMAN_QA','GIT_CHECKPOINTS','HUMAN_QA_CORRECTION']:data+=f'\nHQ3 final verified remote: `{commit}`; tree `{tree}`.\n'
 p=out/filename;p.write_text(data);reports.append(p)
source_verify={'status':'PASS','engineeringStatus':STATUS,'finalRemoteCommit':commit,'finalRemoteTree':tree,'finalRemoteParent':receipt['parent'],
 'correctionLineage':{'rejectedP3B5':'6ec76c6ca9b289c108ab933c71af196dd5c522cd','HQ0':'66ca14f527244e2e2bf50790ed78d00a05a785ee','HQ1':HQ1,'HQ2':HQ2,'HQ3':commit},
 'acceptedParentCommit':PARENT,'acceptedParentTree':PARENT_TREE,'acceptedParentZipSha256':PARENT_ZIP,'sourceFiles':len(source),'allGitBlobsAndModesVerified':True,'recursiveRemoteTreeMatches':True,
 'runtimeChangesSinceHQ1':0,'filesChangedSinceHQ2':since2,'changedFileAudit':scope,'humanQA':'PENDING','part3CBegun':False,'mainModifiedOrMerged':False,'mainHead':MAIN}
p=out/'PART_3B_SOURCE_VERIFICATION.json';p.write_text(json.dumps(source_verify,indent=2)+'\n');reports.append(p)
archive=out/'THE_FAR_BACKROOMS_PART_3B_FINAL_HQ3.zip';manifest=[];prefix='thefarbackrooms-level0/'
def put(z,n,data,mode=0o100644):
 i=zipfile.ZipInfo(n,(2026,10,4,0,0,0));i.create_system=3;i.external_attr=mode<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,data)
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for mode,digest,n in source:
  data=(ROOT/n).read_bytes();assert blob(data)==digest,n
  manifest.append({'path':n,'mode':mode,'gitBlob':digest,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()});put(z,prefix+n,data,int(mode,8))
 for p in reports:put(z,'PART_3B_PUBLICATION/'+p.name,p.read_bytes())
fresh=out/'Final Part 3B HQ3 Verified Extraction'
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert set(z.namelist())=={prefix+n for _,_,n in source}|{'PART_3B_PUBLICATION/'+p.name for p in reports}
 z.extractall(fresh)
 for mode,digest,n in source:
  member=prefix+n;data=z.read(member);assert blob(data)==digest,n
  assert (z.getinfo(member).external_attr>>16)&0o777==int(mode,8)&0o777,n
  p=fresh/member;assert p.read_bytes()==data,n;p.chmod(int(mode,8)&0o777)
 for p in reports:assert z.read('PART_3B_PUBLICATION/'+p.name)==p.read_bytes()
clean=fresh/prefix;assert ' ' in str(clean)
# Smoke gates from the fresh extraction; source bytes must survive them unchanged.
gates=out/'extraction-gates';gates.mkdir();rows=[]
env={k:v for k,v in os.environ.items() if k not in ['ONLY','TFB_WORLD']};env['PYTHONDONTWRITEBYTECODE']='1'
generated=['ai.js','sim.js','ents.js','levels/level0_spatial.json'];expected={n:sha(clean/n) for n in generated}
def run(name,cmd):
 with (gates/(name+'.log')).open('xb') as f:code=subprocess.run(cmd,cwd=clean,env={**env,'TFB_EVIDENCE_DIR':str(gates/(name+'-raw'))},stdout=f,stderr=subprocess.STDOUT,timeout=1800).returncode
 rows.append({'name':name,'command':cmd,'exitCode':code});print(json.dumps(rows[-1]),flush=True);assert code==0,name
 assert {n:sha(clean/n) for n in generated}==expected,'generated output not reproduced: '+name
for i in [1,2]:
 for n in ['ai','sim','ents']:run(f'build-{i}-{n}',['bash',f'dev/build_{n}.sh'])
 run(f'build-{i}-level0',['node','dev/part3a/build_level0_spatial.js'])
run('invariants',['python','dev/part3b/verify_invariants.py',str(gates/'invariants.json')])
run('hq1-focused',['node','dev/part3b/test_hq1.js',str(gates/'hq1-focused.json')])
run('served-flat-fixture',['node','dev/stage_h/served_package.js',str(gates/'served-flat-fixture.json')])
run('served-production',['node','dev/part3a/served_production.js',str(gates/'served-production.json')])
run('redirect',['node','dev/stage_i/test_redirect.js'])
for mode,digest,n in source:assert blob((clean/n).read_bytes())==digest,'Source mutated during extraction gates: '+n
manifest_path=out/'PART_3B_SOURCE_MANIFEST.json';manifest_path.write_text(json.dumps({'sourceCommit':commit,'sourceTree':tree,'files':manifest},indent=2)+'\n')
xe=json.loads((ROOT/'dev/part3b/evidence/hq2/parity-cross-engine-01/result.json').read_text());assert xe['status']=='PASS_CROSS_ENGINE' and (xe['traces'],xe['records'])==(46,35098)
summary=json.loads((ROOT/'dev/part3b/evidence/hq2/hq2-summary.json').read_text());assert summary['status']=='PASS'
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
verification={**{k:v for k,v in source_verify.items() if k!='changedFileAudit'},'archive':archive.name,'archiveBytes':archive.stat().st_size,'archiveSha256':sha(archive),'crc':'PASS',
 'freshFinalExtractionMatches':True,'extractionPathContainsSpaces':True,'extractionGates':rows,'generatedOutputsReproducedTwice':True,'sourceManifestSha256':sha(manifest_path),
 'publicationFiles':{p.name:sha(p) for p in reports},'changedFileAuditExact':True,'acceptance':'B-01..B-19 and HQ-01..HQ-02 PASS; B-20 handoff complete, human decision PENDING',
 'acceptanceSha256':sha(ROOT/'dev/part3b/evidence/hq3/acceptance.json'),'allHq3ValidatedFilesUnchanged':True,
 'hq2Regression':{'checkpoint':HQ2,'status':summary['status'],'gameplayOrRuntimeChanges':0,'baselineComparison':'PASS_BASELINE_EQUIVALENCE',
  'frozenParity':{'zeroTolerance':'FAIL preserved: 3 traces differ by 1 ULP, host '+xe['hostRuntime']+' vs recorded '+'/'.join(xe['recordedRuntime']),'crossEngine':xe['status'],'traces':xe['traces'],'records':xe['records'],'tolerance':xe['crossEngineTolerance'],'hq1EqualsHq0BytesOnHost':xe['candidateEqualsBaselineOnHost'],'zeroToleranceIdentical':xe['zeroToleranceIdentical'],'map':xe['map']},
  'harnessSetupRepairsAssertionsUnchanged':['flat-browser-parity clock start (dev/part3b/browser_flat.js)','NORTH concealment in-tunnel beam aim (dev/part3b/browser_cutaway.js)']},
 'mainHeadAtPublication':MAIN,'verifiedAtUTC':now}
(out/'PART_3B_PACKAGE_VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n');(out/(archive.name+'.sha256')).write_text(sha(archive)+'  '+archive.name+'\n')
publication={k:verification[k] for k in ['status','engineeringStatus','finalRemoteCommit','finalRemoteTree','finalRemoteParent','correctionLineage','archive','archiveBytes','archiveSha256','sourceManifestSha256','mainModifiedOrMerged','part3CBegun','humanQA','verifiedAtUTC']}
publication['packageVerificationSha256']=sha(out/'PART_3B_PACKAGE_VERIFICATION.json');(out/'PART_3B_PUBLICATION_RECEIPT.json').write_text(json.dumps(publication,indent=2)+'\n')
print(json.dumps(publication))
