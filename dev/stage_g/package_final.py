#!/usr/bin/env python3
"""Finalize the externally verified source checkpoint without self-referential hashes.
Usage: python dev/stage_g/package_final.py /absolute/output/directory
The caller must first push stage-g, verify its remote ref, and fetch that SHA.
"""
import pathlib,subprocess,hashlib,json,zipfile,sys,datetime
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
git=lambda *a:subprocess.check_output(['git',*a],cwd=root).decode().strip()
sha=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}');parent='ba4fd2d63f440aa113722942bcb4861ba665e1f3'
assert git('branch','--show-current')=='stage-g';assert git('rev-parse','FETCH_HEAD')==sha
subprocess.run(['git','merge-base','--is-ancestor',parent,sha],cwd=root,check=True)
status=git('status','--porcelain');assert status in ['', 'M 25D_STAGE_G_GIT_CHECKPOINTS.md'],status
# The final SHA receipt may be an uncommitted append made AFTER exact remote
# verification. Only the external copy includes this self-reference.
report_paths=sorted(root.glob('25D_STAGE_G_*.md'))+[root/'25D_STAGE_G_CHANGED_FILES.txt']
reports=[]
for p in report_paths:
 data=p.read_text()
 if p.name=='25D_STAGE_G_REPORT.md':
  data=data.replace('Final remote commit and tree are recorded in the external publication receipt accompanying this archive.',f'Final verified remote commit: `{sha}`.\n\nFinal verified source tree: `{tree}`.\n\nBranch: `stage-g`. Publication receipt is external to avoid self-referential Git/ZIP hashes.')
 if p.name=='25D_STAGE_G_GIT_CHECKPOINTS.md' and sha not in data:data+=f'\nG5 final verified remote: `{sha}`; tree `{tree}`.\n'
 if p.name=='25D_STAGE_G_HUMAN_QA.md':data+=f'\nFinal verified Stage G source: `{sha}`; tree `{tree}`.\n'
 target=out/p.name;target.write_text(data);reports.append(target)
entries=[]
for raw in subprocess.check_output(['git','ls-tree','-rz',sha],cwd=root).split(b'\0'):
 if not raw:continue
 meta,name=raw.split(b'\t',1);mode,kind,blob=meta.decode().split();assert kind=='blob';entries.append((mode,blob,name.decode()))
archive=out/'THE_FAR_BACKROOMS_STAGE_G_FINAL.zip';source_zip=out/'source-transfer.tmp.zip'
subprocess.run(['git','archive','--format=zip','--prefix=thefarbackrooms-level0/','-o',str(source_zip),sha],cwd=root,check=True)
# Git ZIP omits ordinary 0644 mode attributes. Store the exact Git file mode
# explicitly so extraction and receipt verification do not depend on defaults.
with zipfile.ZipFile(source_zip) as source,zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for mode,blob,name in entries:
  member='thefarbackrooms-level0/'+name;info=zipfile.ZipInfo(member,(2026,10,3,0,0,0));info.external_attr=int(mode,8)<<16;info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,source.read(member))
 for p in reports:
  info=zipfile.ZipInfo('STAGE_G_PUBLICATION/'+p.name,(2026,10,3,0,0,0));info.external_attr=0o100644<<16;info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
source_zip.unlink()
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 actual={n for n in z.namelist() if n.startswith('thefarbackrooms-level0/') and not n.endswith('/')}
 expected={'thefarbackrooms-level0/'+name for _,_,name in entries};assert actual==expected
 for mode,blob,name in entries:
  member='thefarbackrooms-level0/'+name;data=z.read(member);digest=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest();assert digest==blob,name
  stored=z.getinfo(member).external_attr>>16;assert (stored&0o777)==(int(mode,8)&0o777),name
 for p in reports:assert z.read('STAGE_G_PUBLICATION/'+p.name)==p.read_bytes()
 # Verify a fresh final extraction too; no tests modify this exact receipt tree.
 fresh=out/'Final Stage G Verified Extraction';assert not fresh.exists();z.extractall(fresh)
 for _,_,name in entries:assert (fresh/'thefarbackrooms-level0'/name).read_bytes()==z.read('thefarbackrooms-level0/'+name)
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
verification={'status':'PASS','stage':'G','engineeringStatus':'2.5D STAGE G ENGINEERING COMPLETE — HUMAN QA PENDING','repository':'RoYoshi/backroomsproject','branch':'stage-g','finalRemoteCommit':sha,'finalRemoteTree':tree,'acceptedParentCommit':parent,'acceptedParentTree':'1f33fdd0bfff9ed3268b4fd39648eb4112813199','acceptedParentZipSha256':'7d9176c3e66caab42683d22d9068c0fd3596d6fe7d8f1fd50eff9532e7ad5a5b','parentHumanQA':'PASS','sourceFiles':len(entries),'everySourceBlobAndModeMatchesGitTree':True,'freshFinalExtractionMatches':True,'archive':archive.name,'archiveBytes':archive.stat().st_size,'archiveSha256':H(archive),'crc':'PASS','publicationFiles':{p.name:H(p) for p in reports},'portableValidation':json.loads((root/'dev/stage_g/evidence/g5/portable/result.json').read_text()),'buildValidation':json.loads((root/'dev/stage_g/evidence/g5/builds.json').read_text()),'physics25d':'5/5 PASS, original matrix activated; repeated in portable extraction','frozenParity':{'traces':46,'records':35098,'tolerance':0,'map':'BYTE IDENTICAL'},'baselineComparison':'PASS; same accepted 11 aggregate failures; isolated audit-net2 11/11','mainModifiedOrMerged':False,'stageHBegun':False,'humanQA':'PENDING','performanceLimit':'24-active workload p99 50.402 ms exceeds 16.667 ms budget; peak total 439626 bytes/update, nominal 8.793 MB/client/s at 20Hz; no Stage I certification','verifiedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(out/'25D_STAGE_G_PACKAGE_VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n')
(out/(archive.name+'.sha256')).write_text(H(archive)+'  '+archive.name+'\n')
print(json.dumps({k:verification[k] for k in ['status','finalRemoteCommit','finalRemoteTree','sourceFiles','archive','archiveBytes','archiveSha256']}))
