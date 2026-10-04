#!/usr/bin/env python3
"""Bind successful executed whole-presentation checks to their exact evidence."""
import json,pathlib,sys
from release_common import ROOT,sha,NAMED
run=pathlib.Path(sys.argv[1]).resolve();result=json.loads((run/'result.json').read_text());assert result['status']=='PASS'
assert all(r['exitCode']==0 for r in result['checks'])
evidence={}
for r in result['checks']:
 name=r['name']
 if name in ['full-retained','redirect']:continue
 p=pathlib.Path(r['command'][-1]);p=p/'result.json' if p.is_dir() else p
 d=json.loads(p.read_text());assert d['status']=='PASS',name;evidence[name]=str(p.relative_to(ROOT))
p=run/'baseline-comparison.json';assert json.loads(p.read_text())['status']=='PASS_BASELINE_EQUIVALENCE';evidence['baseline-comparison']=str(p.relative_to(ROOT))
named=json.loads((ROOT/'dev/part3b/evidence/p3b4/named-01/result.json').read_text());assert [r['name'] for r in named['checks']]==NAMED
for r in named['checks']:
 if r['name']!='view25d':assert r['exitCode']==0,r['name']
assert json.loads((ROOT/'dev/part3b/evidence/p3b4/view-02/receipt.json').read_text())['status']=='PASS'
payload={'status':'PASS','contentHash':result['contentHash'],'checks':result['checks'],'evidence':evidence,'evidenceSha256':{name:sha(ROOT/p) for name,p in evidence.items()},'sevenNamedSuites':'PASS with preserved view25d attempt 01 and successful exact-entrypoint retry 02','humanQA':'PENDING'}
(ROOT/'dev/part3b/evidence/p3b4/whole-completion.json').write_text(json.dumps(payload,indent=2)+'\n');print('PASS whole presentation evidence binding')
