#!/usr/bin/env python3
"""Final archive from the exact verified remote tree; identities remain external."""
import pathlib,subprocess,hashlib,json,zipfile,sys,datetime
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
git=lambda *a:subprocess.check_output(['git',*a],cwd=root,text=True).strip()
sha,tree=git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}');parent='692eebd338cc42347d437b0c0a2dcc9d7217ac34';parent_tree='1cd5430b61aac7f994da29f4879621a638c49526';parent_zip='037feeeaeb16c354c11228458c31f986cfce594cfeaf8e93472d21b919ef9d5d'
status='2.5D IMPLEMENTATION COMPLETE — HUMAN QA PENDING'
assert git('branch','--show-current')=='stage-i';assert git('status','--porcelain')==''
assert git('rev-parse','FETCH_HEAD')==sha;assert git('ls-remote','origin','refs/heads/stage-i').split()[0]==sha
assert git('rev-parse',parent+'^{tree}')==parent_tree;subprocess.run(['git','merge-base','--is-ancestor',parent,sha],cwd=root,check=True)
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();ev=root/'dev/stage_i/evidence';read=lambda p:json.loads((ev/p).read_text())
portable=read('i4/portable-final.json');parity=read('i4/regression-01/parity/result.json');baseline=read('i4/baseline-comparison.json');regression=read('i4/regression-final.json');matrix=read('i4/final-matrix.json');invariants=read('i4/invariants.json');stress=read('i2/result.json');audit=read('i5/scope-audit.json')
assert portable['status']==parity['status']==regression['status']==stress['status']==audit['status']=='PASS'
assert baseline['status']=='PASS_BASELINE_EQUIVALENCE';assert matrix['status']==invariants['status']=='PASS'
assert len(matrix['rows'])==32 and all(r['disposition']=='PASS' for r in matrix['rows']);assert len(invariants['rows'])==20 and all(r['disposition']=='PASS' for r in invariants['rows'])
assert (parity['traces'],parity['records'],parity['tolerance'])==(46,35098,0)
assert all(r['exitCode']==0 for r in regression['checks']) and len(regression['checks'])==15
names={r['name'] for r in portable['checks'] if r['exitCode']==0};assert set(['s_world25d','s_nav25d','s_perception25d','network25d','physics25d','view25d','perf_world25d'])<=names
entries=[]
for raw in subprocess.check_output(['git','ls-tree','-rz',sha],cwd=root).split(b'\0'):
 if raw:
  meta,n=raw.split(b'\t',1);mode,kind,blob=meta.decode().split();assert kind=='blob';entries.append((mode,blob,n.decode()))
def validated(n):return n.startswith(('assets/','levels/')) or (pathlib.Path(n).suffix in ['.js','.py','.sh','.html','.css','.json'] and '/evidence/' not in n and '/results/' not in n)
assert {n for _,_,n in entries if validated(n)}==set(portable['validatedFiles']),'Unvalidated new code path'
for n,digest in portable['validatedFiles'].items():assert H(root/n)==digest,'Changed after portable validation: '+n
assert git('diff','--name-status',parent,sha).splitlines()==audit['changedFiles']
required=['REPORT','TEST_SUMMARY','BASELINE_FAILURES','PARITY','HUMAN_QA','FINAL_MATRIX','INVARIANTS','PERFORMANCE','STRESS','PORTABILITY','GIT_CHECKPOINTS']
reports=[]
for name in required+['CHANGED_FILES']:
 filename='25D_STAGE_I_'+name+('.txt' if name=='CHANGED_FILES' else '.md');p=root/filename;data=p.read_text()
 if name=='REPORT':
  marker='Final remote commit and tree are recorded in the external publication receipt accompanying this archive.';assert marker in data
  data=data.replace(marker,f'Final verified remote commit: `{sha}`.\n\nFinal verified source tree: `{tree}`.\n\nBranch: `stage-i`. Final source is separate from these finalized publication reports.')
 if name in ['GIT_CHECKPOINTS','HUMAN_QA']:data+=f'\nI5 verified final remote: `{sha}`; tree `{tree}`.\n'
 target=out/filename;target.write_text(data);reports.append(target)
for name,file in [('FINAL_MATRIX','i4/final-matrix.json'),('INVARIANTS','i4/invariants.json')]:
 p=out/('25D_STAGE_I_'+name+'.json');p.write_bytes((ev/file).read_bytes());reports.append(p)
transfer=out/'source-transfer.tmp.zip';subprocess.run(['git','archive','--format=zip','-o',str(transfer),sha],cwd=root,check=True)
archive=out/'THE_FAR_BACKROOMS_STAGE_I_FINAL.zip';manifest=[]
def put(z,n,data,mode=0o100644):
 info=zipfile.ZipInfo(n,(2026,10,4,0,0,0));info.external_attr=mode<<16;info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
with zipfile.ZipFile(transfer) as src,zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for mode,blob,n in entries:
  data=src.read(n);assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==blob
  manifest.append({'path':n,'mode':mode,'gitBlob':blob,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()});put(z,'thefarbackrooms-level0/'+n,data,int(mode,8))
 for p in reports:put(z,'STAGE_I_PUBLICATION/'+p.name,p.read_bytes())
transfer.unlink();fresh=out/'Final Stage I Verified Extraction'
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert {n for n in z.namelist() if n.startswith('thefarbackrooms-level0/')}=={'thefarbackrooms-level0/'+n for _,_,n in entries}
 z.extractall(fresh)
 for mode,blob,n in entries:
  member='thefarbackrooms-level0/'+n;data=z.read(member);assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==blob,n
  assert (z.getinfo(member).external_attr>>16)&0o777==int(mode,8)&0o777,n;p=fresh/member;assert p.read_bytes()==data,n;p.chmod(int(mode,8)&0o777)
 for p in reports:assert z.read('STAGE_I_PUBLICATION/'+p.name)==p.read_bytes()
manifest_path=out/'25D_STAGE_I_SOURCE_MANIFEST.json';manifest_path.write_text(json.dumps({'sourceCommit':sha,'sourceTree':tree,'files':manifest},indent=2)+'\n')
verification={'status':'PASS','engineeringStatus':status,'repository':'RoYoshi/backroomsproject','branch':'stage-i','finalRemoteCommit':sha,'finalRemoteTree':tree,'acceptedParentCommit':parent,'acceptedParentTree':parent_tree,'acceptedParentZipSha256':parent_zip,'parentHumanQA':'PASS','sourceFiles':len(entries),'everySourceBlobAndModeMatchesGitTree':True,'freshFinalExtractionMatches':True,'allPortableValidatedFilesUnchanged':True,'changedFileAuditExact':True,'runtimeChanges':0,'archive':archive.name,'archiveBytes':archive.stat().st_size,'archiveSha256':H(archive),'crc':'PASS','sourceManifestSha256':H(manifest_path),'publicationFiles':{p.name:H(p) for p in reports},'portableValidation':{k:v for k,v in portable.items() if k!='validatedFiles'},'frozenParity':{k:parity[k] for k in ['status','traces','records','tolerance','frozenUnchanged','map']},'finalMatrix':'Z01–Z32 PASS','invariants':'I-01–I-20 PASS','baselineComparison':baseline['status'],'mainModifiedOrMerged':False,'productionLevel0ConversionBegun':False,'part3Begun':False,'humanQA':'PENDING','limitations':['Accepted eleven aggregate failures; shared F22; P08 UNKNOWN; historical L5/NZ1 observations','SwiftShader misses 16.7 ms; no hardware GPU certification; inherited full-quality two-client fall capture limitation','24-active aftermath CPU/payload limitation reproduced in accepted parent','External Google Fonts network/TLS failures','Accepted spatial renderer limits: 64 solids, eight planes per solid, 128 light emitters, 64 lamp-failure records and 4194304 target pixels','60-second multi-room soak and bounded admin ceiling are measured workloads, not general capacity or long-term memory certification'],'verifiedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(out/'25D_STAGE_I_PACKAGE_VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n');(out/(archive.name+'.sha256')).write_text(H(archive)+'  '+archive.name+'\n')
receipt={k:verification[k] for k in ['status','engineeringStatus','repository','branch','finalRemoteCommit','finalRemoteTree','archive','archiveBytes','archiveSha256','publicationFiles','sourceManifestSha256','mainModifiedOrMerged','productionLevel0ConversionBegun','part3Begun','humanQA','verifiedAtUTC']};receipt['packageVerificationSha256']=H(out/'25D_STAGE_I_PACKAGE_VERIFICATION.json');(out/'25D_STAGE_I_PUBLICATION_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:verification[k] for k in ['status','engineeringStatus','finalRemoteCommit','finalRemoteTree','sourceFiles','archiveBytes','archiveSha256']}))
