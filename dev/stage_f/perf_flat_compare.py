"""Serial retained flat-simulation comparison against a supplied immutable parent."""
import pathlib,subprocess,json,sys
root=pathlib.Path(__file__).resolve().parents[2];parent=pathlib.Path(sys.argv[1]).resolve();out=root/'dev/stage_f/evidence/f5/flat-perf';out.mkdir(parents=True,exist_ok=True)
script="""const root=process.argv[1],createSim=require(root+'/sim.js');const sim=createSim({seed:7331,director:false});for(let i=1;i<=8;i++){const p=sim.addPlayer(i);sim.join(p,0);}const a=[];for(let i=0;i<2400;i++){const t=performance.now();sim.step(1/60);if(i>=600)a.push(performance.now()-t);}a.sort((a,b)=>a-b);console.log(JSON.stringify({median:a[900],p99:a[1782],max:a.at(-1),samples:a.length,entities:sim.engine.entities.length}));"""
rows=[]
for rep in range(3):
 for label,folder in [('parent',parent),('stageF',root)]:
  r=subprocess.run(['node','-e',script,str(folder)],capture_output=True,text=True);assert r.returncode==0,r.stderr;rows.append(dict(run=rep,label=label,**json.loads(r.stdout)));print(rows[-1],flush=True)
(out/'results.json').write_text(json.dumps({'scope':'Retained simulation with 8 players, seed 7331, 600 warmup + 1800 measured fixed ticks; serial alternating repeated runs; excludes socket serialization','runtime':subprocess.check_output(['node','-v'],text=True).strip(),'rows':rows},indent=2)+'\n')
