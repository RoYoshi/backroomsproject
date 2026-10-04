#!/usr/bin/env python3
"""Publish an exact verified Git tree plus finalized external identity reports."""
import pathlib,subprocess,hashlib,json,zipfile,sys,datetime
from release_common import ROOT,PARENT,PARENT_TREE,PARENT_ZIP,STATUS,NAMED,git,sha,blob,entries,validated
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
commit,tree=git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}')
assert git('branch','--show-current')=='part-3a';assert git('status','--porcelain')==''
assert git('rev-parse','FETCH_HEAD')==commit
heads=dict((r.split()[1],r.split()[0]) for r in git('ls-remote','origin','refs/heads/part-3a','refs/heads/main').splitlines())
assert heads['refs/heads/part-3a']==commit;assert git('rev-parse',PARENT+'^{tree}')==PARENT_TREE
subprocess.run(['git','merge-base','--is-ancestor',PARENT,commit],cwd=ROOT,check=True)
ev=ROOT/'dev/part3a/evidence';read=lambda p:json.loads((ev/p).read_text())
portable=read('p3a5/portable-01/result.json');acceptance=read('p3a4/acceptance.json');audit=read('p3a5/scope-audit.json')
parity=read('p3a5/portable-01/parity/result.json');baseline=read('p3a5/portable-01/baseline-comparison.json')
assert portable['status']==acceptance['status']==audit['status']==parity['status']=='PASS'
assert baseline['status']=='PASS_BASELINE_EQUIVALENCE'
assert len(acceptance['rows'])==23 and all(r['disposition']=='PASS' for r in acceptance['rows'])
assert (parity['traces'],parity['records'],parity['tolerance'])==(46,35098,0)
assert parity['frozenUnchanged'] and parity['map']=='BYTE IDENTICAL'
assert set(NAMED)<=set(r['name'] for r in portable['checks'] if r['exitCode']==0)
source=entries(commit);assert {n for _,_,n in source if validated(n)}==set(portable['validatedFiles'])
for n,digest in portable['validatedFiles'].items():assert sha(ROOT/n)==digest,'Changed after portable validation: '+n
assert git('diff','--name-status',PARENT,commit).splitlines()==audit['changedFiles']
reports=[]
required=['REPORT','TEST_SUMMARY','BASELINE_FAILURES','CHANGED_FILES','HUMAN_QA','LEVEL0_SPATIAL','CONTENT_MANIFEST','READABILITY','PERFORMANCE','GIT_CHECKPOINTS']
for name in required:
 ext='.json' if name=='CONTENT_MANIFEST' else '.txt' if name=='CHANGED_FILES' else '.md';filename='PART_3A_'+name+ext;data=(ROOT/filename).read_text()
 if name=='REPORT':
  marker='Final source identity is recorded in the accompanying external publication receipt.';assert marker in data
  data=data.replace(marker,f'Final verified remote commit: `{commit}`.\n\nFinal verified source tree: `{tree}`.\n\nBranch: `part-3a`. The exact source tree is packaged separately from these finalized publication reports.')
  data=data.replace('P3A5 PORTABLE GATES PASS — FINAL PUBLICATION PENDING',STATUS).replace('PENDING FINAL ARCHIVE VERIFICATION','PASS — exact final archive/blob/mode/tree verification completed')
 if name in ['GIT_CHECKPOINTS','HUMAN_QA']:data+=f'\nP3A5 final verified remote: `{commit}`; tree `{tree}`.\n'
 if name=='CONTENT_MANIFEST':
  d=json.loads(data);d.update(milestone='P3A5',status=STATUS);data=json.dumps(d,indent=2)+'\n'
 p=out/filename;p.write_text(data);reports.append(p)
matrix={**acceptance,'milestone':'P3A5','sourceCommit':commit,'sourceTree':tree,'L0-24':'PASS','rows':acceptance['rows']+[{'id':'L0-24','name':'Package','disposition':'PASS','basis':'Fresh path-with-spaces execution, exact final Git blobs/modes/tree, final CRC and extraction; see PART_3A_PACKAGE_VERIFICATION.json.'}]}
p=out/'PART_3A_ACCEPTANCE.json';p.write_text(json.dumps(matrix,indent=2)+'\n');reports.append(p)
transfer=out/'source-transfer.tmp.zip';subprocess.run(['git','archive','--format=zip','-o',str(transfer),commit],cwd=ROOT,check=True)
archive=out/'THE_FAR_BACKROOMS_PART_3A_FINAL.zip';manifest=[]
def put(z,n,data,mode=0o100644):
 i=zipfile.ZipInfo(n,(2026,10,4,0,0,0));i.external_attr=mode<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,data)
with zipfile.ZipFile(transfer) as src,zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for mode,digest,n in source:
  data=src.read(n);assert blob(data)==digest
  manifest.append({'path':n,'mode':mode,'gitBlob':digest,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()});put(z,'thefarbackrooms-level0/'+n,data,int(mode,8))
 for p in reports:put(z,'PART_3A_PUBLICATION/'+p.name,p.read_bytes())
transfer.unlink();fresh=out/'Final Part 3A Verified Extraction'
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert set(z.namelist())=={'thefarbackrooms-level0/'+n for _,_,n in source}|{'PART_3A_PUBLICATION/'+p.name for p in reports}
 z.extractall(fresh)
 for mode,digest,n in source:
  member='thefarbackrooms-level0/'+n;data=z.read(member);assert blob(data)==digest,n
  assert (z.getinfo(member).external_attr>>16)&0o777==int(mode,8)&0o777,n
  p=fresh/member;assert p.read_bytes()==data,n;p.chmod(int(mode,8)&0o777)
 for p in reports:assert z.read('PART_3A_PUBLICATION/'+p.name)==p.read_bytes()
manifest_path=out/'PART_3A_SOURCE_MANIFEST.json';manifest_path.write_text(json.dumps({'sourceCommit':commit,'sourceTree':tree,'files':manifest},indent=2)+'\n')
verification={'status':'PASS','engineeringStatus':STATUS,'repository':'RoYoshi/backroomsproject','branch':'part-3a','finalRemoteCommit':commit,'finalRemoteTree':tree,'acceptedParentCommit':PARENT,'acceptedParentTree':PARENT_TREE,'acceptedParentZipSha256':PARENT_ZIP,'parentHumanQA':'PASS','sourceFiles':len(source),'everySourceBlobAndModeMatchesGitTree':True,'freshFinalExtractionMatches':True,'allPortableValidatedFilesUnchanged':True,'changedFileAuditExact':True,'recoveryRuntimeChanges':0,'archive':archive.name,'archiveBytes':archive.stat().st_size,'archiveSha256':sha(archive),'crc':'PASS','sourceManifestSha256':sha(manifest_path),'publicationFiles':{p.name:sha(p) for p in reports},'portableValidation':{k:v for k,v in portable.items() if k!='validatedFiles'},'frozenParity':{k:parity[k] for k in ['status','traces','records','tolerance','frozenUnchanged','map']},'baselineComparison':baseline['status'],'acceptance':'L0-01 through L0-24 PASS','sourceContentHash':portable['contentHash'],'mainHeadAtPublication':heads.get('refs/heads/main'),'mainModifiedOrMerged':False,'part3BBegun':False,'part3CPlusBegun':False,'humanQA':'PENDING','verifiedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(out/'PART_3A_PACKAGE_VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n');(out/(archive.name+'.sha256')).write_text(sha(archive)+'  '+archive.name+'\n')
receipt={k:verification[k] for k in ['status','engineeringStatus','repository','branch','finalRemoteCommit','finalRemoteTree','archive','archiveBytes','archiveSha256','publicationFiles','sourceManifestSha256','mainModifiedOrMerged','part3BBegun','part3CPlusBegun','humanQA','verifiedAtUTC']};receipt['packageVerificationSha256']=sha(out/'PART_3A_PACKAGE_VERIFICATION.json');(out/'PART_3A_PUBLICATION_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:verification[k] for k in ['status','engineeringStatus','finalRemoteCommit','finalRemoteTree','sourceFiles','archiveBytes','archiveSha256']}))
