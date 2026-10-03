#!/usr/bin/env python3
"""Reproduce E5 focused, trace and browser gates without rewriting old evidence.

Run retained long suites separately with dev/stage_d/run_inherited.py. Run timing
workloads serially. All output paths are explicit; historical traces stay frozen.
"""
import argparse, hashlib, json, pathlib, subprocess, time

p=argparse.ArgumentParser()
p.add_argument('group',choices=['focused','traces','browser'])
p.add_argument('--out',type=pathlib.Path,required=True)
p.add_argument('--parent',type=pathlib.Path)
a=p.parse_args();root=pathlib.Path(__file__).resolve().parents[2];out=a.out.resolve();out.mkdir(parents=True,exist_ok=True)
runtime=subprocess.check_output(['node','--version'],text=True).strip()
assert runtime=='v25.9.0',runtime
rows=[]
def run(name,cmd,required=True,timeout=600):
    print('START '+name,flush=True);start=time.monotonic()
    r=subprocess.run(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout)
    (out/(name+'.log')).write_bytes(r.stdout)
    row={'name':name,'command':cmd,'runtime':runtime,'exitCode':r.returncode,'seconds':round(time.monotonic()-start,3),'log':name+'.log'}
    rows.append(row);(out/(a.group+'-commands.json')).write_text(json.dumps(rows,indent=2)+'\n')
    print(json.dumps(row),flush=True)
    if required and r.returncode:raise RuntimeError(r.stdout.decode(errors='replace')[-5000:])
    return r

if a.group=='focused':
    commands=[('acceptance',['node','dev/tests/run.js','s_nav25d.js','s_perception25d.js']),('spatial-core',['node','dev/stage_c/test_spatial.js']),('spatial-adversarial',['node','dev/stage_c/test_adversarial.js']),('spatial-schedules',['node','dev/stage_c/test_schedules.js']),('camera-spatial',['node','dev/stage_c/test_camera.js']),('view',['node','dev/stage_d/test_view.js',str(out/'view.json')]),('independence',['node','dev/stage_d/test_independence.js',str(out/'independence.json')]),('smiler',['node','dev/tests/run.js','s_smiler.js'])]
    for name,cmd in commands:run(name,cmd,required=name!='smiler')
elif a.group=='traces':
    frozen=root/'dev/stage_a/traces';before={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in frozen.iterdir() if f.is_file()}
    current=out/'captures';current.mkdir(exist_ok=True)
    run('historical-strict-verifier',['node','dev/stage_c/verify_parity.js',str(out/'historical-strict.json')],required=False)
    run('map-export',['node','dev/stage_b/export_world.js',str(root),str(out/'map-current.json.gz')])
    assert (out/'map-current.json.gz').read_bytes()==(root/'dev/stage_b/level0-baseline.json.gz').read_bytes(),'Map export diverged'
    comparisons=[]
    for group in ['motor','ai','death','navigation','network']:
        run('capture-'+group,['node','dev/stage_a/capture_'+group+'.js',str(current)])
        for record in json.loads((frozen/(group+'-index.json')).read_text()):
            name=record['name']+'.json.gz'
            r=run('compare-'+record['name'],['node','dev/stage_a/diff_traces.js',str(frozen/name),str(current/name)])
            comparisons.append({'trace':record['name'],**json.loads(r.stdout)})
    assert len(comparisons)==46
    assert before=={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in frozen.iterdir() if f.is_file()}
    result={'status':'IDENTICAL RECORDS','runtime':runtime,'frozenRuntime':'v24.19.0','tolerance':0,'traces':len(comparisons),'records':sum(r['records'] for r in comparisons),'mapExport':'BYTE IDENTICAL','frozenFilesUnchanged':True,'comparisons':comparisons}
    (out/'trace-comparison.json').write_text(json.dumps(result,indent=2)+'\n')
else:
    assert a.parent,'--parent accepted Stage D extraction required'
    for name,cmd in [('core',['node','dev/stage_d/browser_core.js',str(root),str(out)]),('extended',['node','dev/stage_d/browser_extended.js',str(root),str(out)]),('flat',['node','dev/stage_d/browser_flat.js',str(root),str(a.parent.resolve()),str(out)])]:run('browser-'+name,cmd)
