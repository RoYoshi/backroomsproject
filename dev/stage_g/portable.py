import pathlib,subprocess,zipfile,hashlib,json,os,time
root=pathlib.Path(__file__).resolve().parents[2];out=root/'dev/stage_g/evidence/g5/portable';out.mkdir(parents=True,exist_ok=True)
destination=root.parent/'Stage G Clean Extraction With Spaces';destination.mkdir(exist_ok=False)
archive=root.parent/'stage-g-portable-candidate.zip'
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')[:-1]
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for file in files:z.write(root/file,'thefarbackrooms-level0/'+file)
with zipfile.ZipFile(archive) as z:assert z.testzip() is None;z.extractall(destination)
clean=destination/'thefarbackrooms-level0';assert all((clean/f).read_bytes()==(root/f).read_bytes() for f in files)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before={f:sha(clean/f) for f in ['ai.js','sim.js','ents.js']};rows=[]
commands=[('build-ai',['bash','dev/build_ai.sh']),('build-sim',['bash','dev/build_sim.sh']),('build-ents',['bash','dev/build_ents.sh']),('physics25d',['node','dev/tests/physics25d.js']),('stage-f-wire',['node','dev/stage_f/test_f3.js']),('served-package',['node','dev/stage_c/served_package.js',str(clean),str(out/'served.json')])]
for name,cmd in commands:
 print('START',name,flush=True);start=time.monotonic()
 with (out/(name+'.log')).open('wb') as f:r=subprocess.run(cmd,cwd=clean,stdout=f,stderr=subprocess.STDOUT,timeout=240,env={**os.environ,'TFB_EVIDENCE_DIR':str(out/'physics-raw')})
 rows.append(dict(name=name,exit=r.returncode,seconds=time.monotonic()-start));print(rows[-1],flush=True)
 assert r.returncode==0,(name,r.returncode)
assert before=={f:sha(clean/f) for f in before}
result=dict(status='PASS',archiveSha256=sha(archive),files=len(files),byteEqual=True,pathContainsSpaces=True,buildHashes=before,checks=rows,runtime=subprocess.check_output(['node','-v']).decode().strip(),note='Portable source candidate. Final package receives an additional exact tree/content check after publication.');(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
