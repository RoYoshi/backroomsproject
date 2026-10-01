"""Isolate RNG migration in a throwaway Stage 2E copy, preserving old evidence/species rules.
Usage: python dev/tests/diagnose_rng2f.py /path/to/pristine/2E /path/to/experiment
This is a test-only counterfactual, never a shipping build or compatibility mode.
"""
from pathlib import Path
import shutil,sys,subprocess,os
baseline=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();current=Path(__file__).resolve().parents[2]
assert not out.exists(),'Use a new experiment directory'
shutil.copytree(baseline,out)
a=out/'dev/ai_src';c=current/'dev/ai_src'
for f in ['00_head.js','30_entity.js']:shutil.copyfile(c/f,a/f)
for f in ['40_capture.js','50_hound.js','60_smiler.js']:
 p=a/f;s=p.read_text().replace('eng.rng','e.rng').replace('rand(eng,','rand(e,').replace('const rand = (eng,','const rand = (e,')
 if f=='50_hound.js':
  start=s.index('function pickSearchGoal');end=s.index('\nfunction ',start+10);s=s[:start]+s[start:end].replace('e.rng()','e.streams.search()')+s[end:]
 if f=='60_smiler.js':
  start=s.index('function darkSpot');end=s.index('\n/*',start+10);s=s[:start]+s[start:end].replace('e.rng()','e.streams.search()').replace('rand(e, minD, maxD)','(minD + e.streams.search() * (maxD - minD))')+s[end:]
  s=s.replace('e.rng() * 90','e.streams.search() * 90')
 p.write_text(s)
p=a/'20_senses.js';p.write_text(p.read_text().replace('eng.rng()','e.streams.perception()'))
p=a/'90_engine.js';s=p.read_text().replace('const rng = cfg.rng || Math.random;',"const seed=(cfg.seed??1)>>>0, rng=mkRng(deriveSeed(seed,'world'));").replace('rng, geo:','rng, seed, geo:').replace('this.rng() * .15','e.streams.schedule() * .15').replace('rand(eng,','rand(e,').replace('const rand = (eng,','const rand = (e,');p.write_text(s)
p=out/'dev/sim_glue.js';p.write_text(p.read_text().replace('const RND=opts.seed?AI.mkRng(opts.seed):Math.random;',"const SIM_SEED=(opts.seed??1)>>>0;const RND=AI.mkRng(SIM_SEED);").replace('AI.create({adapter,rng:RND})','AI.create({adapter,seed:SIM_SEED})'))
for f in ['dev/build_ai.sh','dev/build_sim.sh']:subprocess.run(['bash',f],cwd=out,check=True)
env=dict(os.environ,ONLY=r'^(P01|P07|H07|SM01|NV09|C1 |C4 |C5 |C9 |C18)')
r=subprocess.run(['node','dev/tests/run.js'],cwd=out,env=env);sys.exit(r.returncode)
