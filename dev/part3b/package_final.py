#!/usr/bin/env python3
"""Package the independently verified final source and finalized identity reports."""
import pathlib,subprocess,json,zipfile,sys,hashlib,datetime
from release_common import ROOT,PARENT,PARENT_TREE,PARENT_ZIP,STATUS,NAMED,git,sha,blob,entries,validated,tree_hash,audit
out=pathlib.Path(sys.argv[1]).resolve();receipt=json.loads(pathlib.Path(sys.argv[2]).read_text());out.mkdir(parents=True,exist_ok=False)
commit,tree=git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}')
assert git('branch','--show-current')=='part-3b';assert git('status','--porcelain')==''
assert receipt['commit']==commit and receipt['tree']==tree and receipt['remoteBranchAndCommitIndependentlyRead']
assert receipt['mainHead']=='7781e1ac34aa09970df57fae3fc107a873fa2731';assert receipt['acceptedParentIsAncestor']
source=entries(commit);assert tree_hash(source)==tree
remote={r['path']:(r['mode'],r['sha']) for r in receipt['remoteTreeEntries'] if r['type']=='blob'}
assert remote=={n:(mode,digest) for mode,digest,n in source}
portable=json.loads((ROOT/'dev/part3b/evidence/p3b5/portable-02/result.json').read_text());acceptance=json.loads((ROOT/'dev/part3b/evidence/p3b4/acceptance.json').read_text())
assert portable['status']==acceptance['status']=='PASS';assert len(acceptance['rows'])==20;assert all(r['disposition']=='PASS' for r in acceptance['rows'])
assert set(NAMED)<=set(r['name'] for r in portable['gates']['checks'] if r['exitCode']==0)
assert {n for _,_,n in source if validated(n)}==set(portable['validatedFiles'])
for n,digest in portable['validatedFiles'].items():assert sha(ROOT/n)==digest,'Changed after portable validation: '+n
for n,digest in acceptance['validatedFiles'].items():assert sha(ROOT/n)==digest,'Changed after P3B4 validation: '+n
scope=audit(source);assert (ROOT/'PART_3B_CHANGED_FILES.txt').read_text().splitlines()==scope['changedFiles']
reports=[]
for name in ['REPORT','TEST_SUMMARY','BASELINE_FAILURES','CHANGED_FILES','HUMAN_QA','CAMERA_DEPTH','CUTAWAY_POLICY','ACCEPTANCE','PERFORMANCE','GIT_CHECKPOINTS']:
 filename='PART_3B_'+name+('.txt' if name=='CHANGED_FILES' else '.md');data=(ROOT/filename).read_text()
 if name=='REPORT':
  marker='Final source identity is recorded in the accompanying external publication receipt.';assert marker in data
  data=data.replace(marker,f'Final verified remote commit: `{commit}`.\n\nFinal verified source tree: `{tree}`.\n\nBranch: `part-3b`. Exact committed source is separate from these finalized publication reports.')
  data=data.replace('P3B5 PORTABLE GATES PASS — FINAL PUBLICATION PENDING',STATUS)
 if name in ['HUMAN_QA','GIT_CHECKPOINTS']:data+=f'\nP3B5 final verified remote: `{commit}`; tree `{tree}`.\n'
 p=out/filename;p.write_text(data);reports.append(p)
source_verify={'status':'PASS','engineeringStatus':STATUS,'finalRemoteCommit':commit,'finalRemoteTree':tree,'acceptedParentCommit':PARENT,'acceptedParentTree':PARENT_TREE,'acceptedParentZipSha256':PARENT_ZIP,'sourceFiles':len(source),'allGitBlobsAndModesVerified':True,'recursiveRemoteTreeMatches':True,'changedFileAudit':scope,'humanQA':'PENDING','part3CBegun':False,'mainModifiedOrMerged':False}
p=out/'PART_3B_SOURCE_VERIFICATION.json';p.write_text(json.dumps(source_verify,indent=2)+'\n');reports.append(p)
archive=out/'THE_FAR_BACKROOMS_PART_3B_FINAL.zip';manifest=[]
def put(z,n,data,mode=0o100644):
 i=zipfile.ZipInfo(n,(2026,10,4,0,0,0));i.external_attr=mode<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,data)
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for mode,digest,n in source:
  data=(ROOT/n).read_bytes();assert blob(data)==digest
  manifest.append({'path':n,'mode':mode,'gitBlob':digest,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()});put(z,'thefarbackrooms-level0/'+n,data,int(mode,8))
 for p in reports:put(z,'PART_3B_PUBLICATION/'+p.name,p.read_bytes())
fresh=out/'Final Part 3B Verified Extraction'
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert set(z.namelist())=={'thefarbackrooms-level0/'+n for _,_,n in source}|{'PART_3B_PUBLICATION/'+p.name for p in reports}
 z.extractall(fresh)
 for mode,digest,n in source:
  member='thefarbackrooms-level0/'+n;data=z.read(member);assert blob(data)==digest,n
  assert (z.getinfo(member).external_attr>>16)&0o777==int(mode,8)&0o777,n
  p=fresh/member;assert p.read_bytes()==data,n;p.chmod(int(mode,8)&0o777)
 for p in reports:assert z.read('PART_3B_PUBLICATION/'+p.name)==p.read_bytes()
manifest_path=out/'PART_3B_SOURCE_MANIFEST.json';manifest_path.write_text(json.dumps({'sourceCommit':commit,'sourceTree':tree,'files':manifest},indent=2)+'\n')
parity=json.loads((ROOT/'dev/part3b/evidence/p3b5/portable-02/gates/parity/result.json').read_text());assert (parity['traces'],parity['records'],parity['tolerance'])==(46,35098,0);assert parity['frozenUnchanged'] and parity['map']=='BYTE IDENTICAL'
verification={**{k:v for k,v in source_verify.items() if k!='changedFileAudit'},'archive':archive.name,'archiveBytes':archive.stat().st_size,'archiveSha256':sha(archive),'crc':'PASS','freshFinalExtractionMatches':True,'sourceManifestSha256':sha(manifest_path),'publicationFiles':{p.name:sha(p) for p in reports},'portableValidation':{k:v for k,v in portable.items() if k!='validatedFiles'},'allPortableValidatedFilesUnchanged':True,'changedFileAuditExact':True,'frozenParity':{k:parity[k] for k in ['status','traces','records','tolerance','frozenUnchanged','map']},'baselineComparison':'PASS_BASELINE_EQUIVALENCE','acceptance':'B-01 through B-19 PASS; B-20 handoff complete, human decision PENDING','mainHeadAtPublication':receipt['mainHead'],'verifiedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(out/'PART_3B_PACKAGE_VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n');(out/(archive.name+'.sha256')).write_text(sha(archive)+'  '+archive.name+'\n')
publication={k:verification[k] for k in ['status','engineeringStatus','finalRemoteCommit','finalRemoteTree','archive','archiveBytes','archiveSha256','sourceManifestSha256','mainModifiedOrMerged','part3CBegun','humanQA','verifiedAtUTC']};publication['packageVerificationSha256']=sha(out/'PART_3B_PACKAGE_VERIFICATION.json');(out/'PART_3B_PUBLICATION_RECEIPT.json').write_text(json.dumps(publication,indent=2)+'\n')
print(json.dumps(publication))
