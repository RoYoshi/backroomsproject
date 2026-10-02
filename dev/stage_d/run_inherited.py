#!/usr/bin/env python3
"""Stage D retained runner: same commands, complete PIPE capture before log commit. Timing is runner metadata, never trace input.
Usage: python3 dev/stage_a/run_baseline.py --game PATH --out PATH
Suites run serially, particularly performance suites. No thresholds are changed.
"""
import argparse, json, os, platform, re, signal, subprocess, time
from pathlib import Path
P=argparse.ArgumentParser();P.add_argument('--game',type=Path,default=Path(__file__).resolve().parents[2]);P.add_argument('--out',type=Path,required=True);P.add_argument('--only',default='')
a=P.parse_args();a.game=a.game.resolve();a.out.mkdir(parents=True,exist_ok=True)
commands=[('npm-test',['npm','test']),('hound',['npm','run','test:hound']),('shared',['npm','run','test:shared']),('humanqa',['npm','run','test:humanqa']),('fps',['npm','run','test:fps']),('camera',['npm','run','test:camera']),('entity-look',['node','dev/tests/run.js','s_entity_look.js']),('physics',['node','dev/tests/phys_test.js']),('interpolation',['node','dev/tests/interp_test.js']),('navigation',['node','dev/tests/nav_bench.js']),('audit-net',['node','dev/tests/audit_net.js']),('audit-net2',['node','dev/tests/audit_net2.js']),('live',['node','dev/tests/live.js']),('ir-net',['node','dev/tests/ir_net.js']),('perf-hound',['node','dev/tests/perf_hound2e.js']),('perf-shared',['node','dev/tests/perf_shared2f.js']),('perf-smiler',['node','dev/tests/perf_smiler.js']),('perf-light',['node','dev/tests/perf_light.js'])]
env={'node':subprocess.check_output(['node','--version'],text=True).strip(),'os':platform.platform(),'machine':platform.machine(),'browserUsed':False}
rows=[]
for name,cmd in commands:
 if a.only and name not in a.only.split(','):continue
 start=time.monotonic();timeout=600 if name=='audit-net2' else 300
 log=a.out/(name+'.log');code=None;blocked=None
 print('START '+name,flush=True)
 proc=subprocess.Popen(cmd,cwd=a.game,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
 output=b''
 try:output,_=proc.communicate(timeout=timeout);code=proc.returncode
 except subprocess.TimeoutExpired:
  blocked=f'External {timeout}s safety deadline; no product classification inferred.'
  os.killpg(proc.pid,signal.SIGTERM)
  try:output,_=proc.communicate(timeout=3)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);output,_=proc.communicate()
 finally:
  try:os.killpg(proc.pid,signal.SIGTERM)
  except ProcessLookupError:pass
 log.write_bytes(output)
 txt=log.read_text();passed=re.findall(r'^PASS\b.*$',txt,re.M);failed=re.findall(r'^FAIL\b.*$',txt,re.M)
 final=re.findall(r'(\d+)\s*/\s*(\d+)\s+(?:passed|PASS)',txt,re.I)
 cases=[]
 for line in txt.splitlines():
  try:q=json.loads(line)
  except (ValueError,TypeError):continue
  if isinstance(q,dict) and isinstance(q.get('ok'),bool):cases.append(q)
 counts={'passed':int(final[-1][0]),'total':int(final[-1][1]),'source':'suite summary'} if final else {'passed':sum(x['ok'] for x in cases),'total':len(cases),'source':'JSON workloads'} if cases else {'passed':len(passed),'total':len(passed)+len(failed),'source':'explicit PASS/FAIL lines; not underlying assertion count'}
 if name=='navigation':counts={'passed':None,'total':None,'source':'Descriptive benchmark; exit status is completion, not acceptance assertions'}
 row={'id':name,'command':' '.join(cmd),'runtime':env,'result':'BLOCKED' if blocked else 'PASS' if code==0 else 'FAIL','exitCode':code,'durationSeconds':round(time.monotonic()-start,3),'counts':counts,'firstFailure':failed[0] if failed else blocked or (txt.splitlines()[-1] if code else None),'failureLines':failed,'limitation':blocked,'log':log.name,'performance':cases}
 rows.append(row);(a.out/'baseline-tests.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps({k:row[k] for k in ['id','result','durationSeconds','counts','firstFailure']}),flush=True)
