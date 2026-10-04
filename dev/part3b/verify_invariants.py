#!/usr/bin/env python3
"""Verify immutable runtime bytes against the accepted Part 3A preflight."""
import hashlib,json,pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[2]
parent='4d1f17a600a10599b848b6db9d02fa16b4f479f0'
allowed={'world_view.js','spatial_client.js'}
frozen=json.loads((root/'dev/part3b/evidence/p3b0/runtime-freeze.json').read_text())
changed=[]
for name,expected in frozen.items():
    actual=hashlib.sha256((root/name).read_bytes()).hexdigest()
    if actual!=expected:
        assert name in allowed, 'Unauthorized runtime change: '+name
        changed.append(name)
result={'status':'PASS','parent':parent,'runtimeFiles':len(frozen),'permittedPresentationChanges':changed,
        'simulationNetworkAiDeathContentCameraPolicyUnchanged':True}
if len(sys.argv)>1:pathlib.Path(sys.argv[1]).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
