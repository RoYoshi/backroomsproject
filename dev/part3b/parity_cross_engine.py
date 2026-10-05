#!/usr/bin/env python3
"""Frozen-trace parity when the host Node differs from the recorded runtime.

Usage: python dev/part3b/parity_cross_engine.py <out> <baseline-source-dir>
The zero-tolerance gate (dev/stage_h/run_parity.py) is unchanged and its failure
is preserved separately. Frozen references record Node v24.19.0; this host may
run another V8. Following dev/stage_a/README.md, this records for every trace:
  1. candidate vs baseline source captured on THIS engine: byte-identical
     (proves the candidate changes no simulated behaviour),
  2. candidate vs frozen reference at tolerance 0 (recorded, may diverge by ULPs),
  3. candidate vs frozen reference at the README's cross-engine tolerance
     0.00001 world units; discrete state and event order must still agree,
plus the byte-identical exported map and unchanged frozen trace files.
"""
import pathlib,subprocess,json,hashlib,sys,gzip
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]).resolve();base=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=False)
frozen=root/'dev/stage_a/traces';before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in frozen.iterdir() if p.is_file()}
node=subprocess.check_output(['node','-v']).decode().strip();rows=[];zeroFailures=[]
recorded=sorted({json.loads(gzip.decompress(p.read_bytes()))['runtime']['node'] for p in frozen.glob('*.json.gz')})
for group in ['motor','ai','death','navigation','network']:
 for label,src in [('candidate',root),('baseline',base)]:
  p=subprocess.run(['node','dev/stage_a/capture_'+group+'.js',str(out/label)],cwd=src,capture_output=True);(out/(label+'-'+group+'.log')).write_bytes(p.stdout+p.stderr);assert p.returncode==0,(label,group)
 for item in json.loads((frozen/(group+'-index.json')).read_text()):
  name=item['name']+'.json.gz';cand=out/'candidate'/name
  sameAsBaseline=cand.read_bytes()==(out/'baseline'/name).read_bytes();assert sameAsBaseline,('candidate differs from baseline on this engine',name)
  z=subprocess.run(['node','dev/stage_a/diff_traces.js',str(frozen/name),str(cand)],cwd=root,capture_output=True)
  t=subprocess.run(['node','dev/stage_a/diff_traces.js',str(frozen/name),str(cand),'0.00001'],cwd=root,capture_output=True)
  (out/(item['name']+'.log')).write_bytes(b'== tolerance 0\n'+z.stdout+z.stderr+b'\n== tolerance 0.00001\n'+t.stdout+t.stderr)
  assert t.returncode==0,(name,t.stdout,t.stderr);tol=json.loads(t.stdout)
  zero=json.loads(z.stdout) if z.stdout.strip().startswith(b'{') else {'status':'ERROR'}
  if z.returncode!=0:zeroFailures.append({'trace':item['name'],'status':zero.get('status'),'tick':zero.get('tick'),'fields':zero.get('fields')})
  rows.append({'trace':item['name'],'candidateEqualsBaselineBytes':sameAsBaseline,'zeroTolerance':'IDENTICAL' if z.returncode==0 else zero.get('status'),'crossEngine':tol.get('status'),'records':tol.get('records')})
 print(group,'PASS',flush=True)
r=subprocess.run(['node','dev/stage_b/export_world.js',str(root),str(out/'map.json.gz')],cwd=root,capture_output=True);assert r.returncode==0
assert (out/'map.json.gz').read_bytes()==(root/'dev/stage_b/level0-baseline.json.gz').read_bytes()
assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in frozen.iterdir() if p.is_file()}
result={'status':'PASS_CROSS_ENGINE','hostRuntime':node,'recordedRuntime':recorded,'traces':len(rows),'records':sum(r['records'] or 0 for r in rows),
 'candidateEqualsBaselineOnHost':all(r['candidateEqualsBaselineBytes'] for r in rows),'zeroToleranceIdentical':len(rows)-len(zeroFailures),'zeroToleranceDivergent':zeroFailures,
 'crossEngineTolerance':0.00001,'map':'BYTE IDENTICAL','frozenUnchanged':True,'rows':rows}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['rows','zeroToleranceDivergent']}),len(zeroFailures),'zero-tolerance divergent')
