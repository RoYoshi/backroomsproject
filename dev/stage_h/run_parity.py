import pathlib,subprocess,json,hashlib,time,sys
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
frozen=root/'dev/stage_a/traces';before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in frozen.iterdir() if p.is_file()};rows=[]
for group in ['motor','ai','death','navigation','network']:
 p=subprocess.run(['node','dev/stage_a/capture_'+group+'.js',str(out/'captures')],cwd=root,capture_output=True);(out/(group+'.log')).write_bytes(p.stdout+p.stderr);assert p.returncode==0,group
 for item in json.loads((frozen/(group+'-index.json')).read_text()):
  name=item['name']+'.json.gz';r=subprocess.run(['node','dev/stage_a/diff_traces.js',str(frozen/name),str(out/'captures'/name)],cwd=root,capture_output=True);(out/(item['name']+'.log')).write_bytes(r.stdout+r.stderr);assert r.returncode==0,(name,r.stdout,r.stderr);rows.append(json.loads(r.stdout))
 print(group,'PASS',flush=True)
r=subprocess.run(['node','dev/stage_b/export_world.js',str(root),str(out/'map.json.gz')],cwd=root,capture_output=True);assert r.returncode==0;assert (out/'map.json.gz').read_bytes()==(root/'dev/stage_b/level0-baseline.json.gz').read_bytes();assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in frozen.iterdir() if p.is_file()}
result={'status':'PASS','traces':len(rows),'records':sum(r['records'] for r in rows),'tolerance':0,'frozenUnchanged':True,'map':'BYTE IDENTICAL','runtime':subprocess.check_output(['node','-v']).decode().strip(),'results':rows};(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='results'}))
