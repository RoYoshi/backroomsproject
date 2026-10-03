#!/usr/bin/env python3
"""Package a committed Stage E tree and verify the exact ZIP in a space path.

Archive identity and final commit identity live outside the archive to avoid
self-referential hashes. Historical evidence remains untouched.
"""
import argparse,hashlib,json,os,pathlib,shutil,subprocess,tempfile,time,zipfile
p=argparse.ArgumentParser();p.add_argument('output',type=pathlib.Path);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
def git(*args):return subprocess.check_output(['git','-C',str(root),*args])
assert git('branch','--show-current').decode().strip()=='stage-e'
assert not git('status','--porcelain').strip(),'Commit and publish all final files before packaging'
assert subprocess.check_output(['node','--version'],text=True).strip()=='v25.9.0'
commit=git('rev-parse','HEAD').decode().strip();tree=git('rev-parse','HEAD^{tree}').decode().strip()
paths=[p.decode() for p in git('ls-files','-z').split(b'\0') if p]
assert 'redirect.js' in paths
assert not [p for p in paths if p.endswith('.zip') or any(q in p.split('/') for q in ['node_modules','__pycache__','.git'])]
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest={p:sha((root/p).read_bytes()) for p in paths}
name='thefarbackrooms-level0-25d-stageE-surface-navigation-sensors.zip'
dest=out/name;assert not dest.exists(),'Never overwrite a checkpoint'
stamp=time.gmtime(int(git('show','-s','--format=%ct','HEAD')))[:6]
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(paths):
  info=zipfile.ZipInfo('thefarbackrooms-level0/'+p,stamp);info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,(root/p).read_bytes())
commands=[]
with zipfile.ZipFile(dest) as z:
 assert z.testzip() is None
 with tempfile.TemporaryDirectory(prefix='Stage E final package with spaces ') as temp:
  z.extractall(temp);pkg=pathlib.Path(temp)/'thefarbackrooms-level0'
  assert all(sha((pkg/p).read_bytes())==h for p,h in manifest.items())
  generated=['ai.js','sim.js','ents.js','assets/stageD-browser.js','assets/stageD-pixi.js','assets/stageD-world.json','dev/stage_d/runtime-provenance.json']
  for label,cmd in [('build-ai',['bash','dev/build_ai.sh']),('build-sim',['bash','dev/build_sim.sh']),('build-ents',['bash','dev/build_ents.sh']),('build-stage-d',['node','dev/stage_d/build_prototype.js']),('nav-core',['node','dev/stage_e/test_core.js']),('view',['node','dev/stage_d/test_view.js']),('camera',['node','dev/stage_c/test_camera.js']),('served',['node','dev/stage_c/served_package.js',str(pkg),str(out/'25D_STAGE_E_SERVED_PACKAGE.json')]),('browser-core',['node','dev/stage_d/browser_core.js',str(pkg),str(out/'package-browser')])]:
   print('PACKAGE '+label,flush=True);r=subprocess.run(cmd,cwd=pkg,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=240)
   (out/('package-'+label+'.log')).write_bytes(r.stdout);commands.append({'name':label,'exitCode':r.returncode})
   if r.returncode:raise RuntimeError(label+': '+r.stdout.decode(errors='replace')[-3000:])
  assert all(sha((pkg/p).read_bytes())==manifest[p] for p in generated),'Generated build output differs'
  assert all(sha((pkg/p).read_bytes())==h for p,h in manifest.items()),'Build or verification modified original package bytes'
digest=sha(dest.read_bytes())
# Recovery-request name is canonical; master-prompt spelling is an exact-byte alias.
alias='thefarbackrooms-level0-25d-stageE-surface-nav-sensors.zip';assert not (out/alias).exists();shutil.copyfile(dest,out/alias)
verification={'status':'PASS','branch':'stage-e','finalCommit':commit,'tree':tree,'archive':name,'aliases':[alias],'sha256':digest,'bytes':dest.stat().st_size,'zipCRC':'PASS','cleanExtraction':'PASS','pathWithSpaces':'PASS','gitlessRuntime':'PASS','reproducibleBuilds':generated,'requiredRootRedirect':True,'noNestedArchivesOrWorkspaces':True,'sourceFiles':len(paths),'fileSHA256':manifest,'commands':commands,'runtime':'v25.9.0','stageFStarted':False,'humanQA':'PENDING'}
(out/'25D_STAGE_E_SHA256.txt').write_text(''.join(digest+'  '+n+'\n' for n in [name,alias]))
(out/'25D_STAGE_E_PACKAGE_VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n')
for p in paths:
 if p.startswith('25D_STAGE_E_') and '/' not in p:shutil.copyfile(root/p,out/p)
ledger=out/'25D_STAGE_E_GIT_CHECKPOINTS.md'
with ledger.open('a') as f:f.write('\n## Final external identity\n\nFinal Stage E commit: `'+commit+'`.\n\nTree: `'+tree+'`.\n\nFinal ZIP SHA-256: `'+digest+'`.\n')
print(json.dumps({k:v for k,v in verification.items() if k!='fileSHA256'},indent=2))
