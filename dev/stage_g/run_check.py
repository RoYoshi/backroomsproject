"""Keep every raw attempt before inspecting/repairing a failing gate."""
import pathlib,subprocess,sys,json,time
root=pathlib.Path(__file__).resolve().parents[2]
stage,label,*cmd=sys.argv[1:];out=root/'dev/stage_g/evidence'/stage;out.mkdir(parents=True,exist_ok=True)
i=1
while (out/f'{label}-{i:02}.log').exists():i+=1
log=out/f'{label}-{i:02}.log'
with log.open('wb') as f:r=subprocess.run(cmd,cwd=root,stdout=f,stderr=subprocess.STDOUT)
meta={'command':cmd,'exitCode':r.returncode,'log':str(log.relative_to(root))}
(out/f'{label}-{i:02}.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta),flush=True);print(log.read_text()[-12000:],flush=True)
sys.exit(r.returncode)
