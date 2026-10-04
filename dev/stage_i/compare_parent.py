#!/usr/bin/env python3
"""Serial same-host controls; do not turn a noisy ratio into a source defect."""
import pathlib,subprocess,json,sys,time,hashlib
root=pathlib.Path(__file__).resolve().parents[2];parent=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=False)
runtime=['ai.js','sim.js','ents.js','world.js','move.js','world_geometry.js','world_motion.js','world_view.js','spatial_client.js','spatial_authority.js','spatial_protocol.js','spatial_history.js','dphys.js','death_srv.js','server.js','redirect.js','assets/index-DKbV5Nv9.js','levels/level0.js','camera_policy.js','timing_policy.js']
hashes={}
for n in runtime:
 assert (root/n).read_bytes()==(parent/n).read_bytes(),n
 hashes[n]=hashlib.sha256((root/n).read_bytes()).hexdigest()
script="""const root=process.argv[1],create=require(root+'/sim.js');const sim=create({seed:7331,director:false});for(let i=1;i<=8;i++){const p=sim.addPlayer(i);sim.join(p,0);}const a=[];for(let i=0;i<12000;i++){const t=performance.now();sim.step(1/60);if(i>=3000)a.push(performance.now()-t);}a.sort((a,b)=>a-b);console.log(JSON.stringify({seed:7331,median:a[4500],p95:a[8550],p99:a[8910],worst:a.at(-1),samples:a.length,entities:sim.engine.entities.length,memory:process.memoryUsage()}));"""
rows=[]
for repetition in range(3):
 for label,folder in [('parent',parent),('stageI',root)]:
  start=time.monotonic();p=subprocess.run(['node','-e',script,str(folder)],cwd=folder,capture_output=True,text=True,timeout=600)
  (out/f'flat-{repetition}-{label}.log').write_text(p.stdout+p.stderr);assert p.returncode==0
  rows.append({'family':'flat','repetition':repetition,'label':label,'seconds':time.monotonic()-start,'measurement':json.loads(p.stdout)})
  print(rows[-1],flush=True)
for repetition in range(2):
 for label,folder in [('parent',parent),('stageI',root)]:
  start=time.monotonic();p=subprocess.run(['node','dev/stage_g/performance.js'],cwd=folder,capture_output=True,text=True,timeout=600)
  (out/f'aftermath-{repetition}-{label}.log').write_text(p.stdout+p.stderr);assert p.returncode==0
  result=json.loads(p.stdout.splitlines()[-1]);assert result['status']=='PASS';rows.append({'family':'aftermath','repetition':repetition,'label':label,'seconds':time.monotonic()-start,'measurement':result})
  print(label,'aftermath',[(r['count'],r['activeTickMs']['p99'],r['snapshotBytes']['worst']) for r in result['results']],flush=True)
result={'status':'PASS','runtime':subprocess.check_output(['node','-v'],text=True).strip(),'exactRuntimeIdentity':hashes,'flatWorkload':'8 players, seed 7331, 3000 warmup + 9000 measured fixed ticks; 3 serial alternating parent/candidate pairs; no socket serialization','aftermathWorkload':'two serial parent/candidate pairs, 1/3/24 active then sleeping, exact shared production kernel','rows':rows,'interpretation':'All correctness assertions retained. Runtime bytes identical; report timing ratios and variability explicitly. Known 24-active limit is not repaired or claimed as a threshold pass.'}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
