#!/usr/bin/env python3
"""Resolve L0-01..23 from executing evidence; keep package acceptance separate."""
import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2]
ev=root/'dev/part3a/evidence'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((ev/n).read_text())
d=json.loads((root/'levels/level0_spatial.json').read_text())
accepted='ed1747e299115df0e0c9e9dc299078eb23516627'
old=json.loads(subprocess.check_output(['git','show',accepted+':levels/level0_spatial.json'],cwd=root))
changed=[k for k in old if old[k]!=d[k]]
assert set(changed)=={'viewGroups','contentHash'}
changed_groups=[b['id'] for a,b in zip(old['viewGroups'],d['viewGroups']) if a!=b]
assert changed_groups==['view:long-room:upper-slab']
assert len(d['solids'])==910
base=read('p3a4/base-01.json');vertical=read('p3a3/vertical-01.json')
game=read('p3a3/gameplay-03.json');nav=read('p3a3/navigation-03.json')
perception=read('p3a3/perception-01.json');aftermath=read('p3a3/aftermath-03.json')
browser=read('p3a3/browser-02/result.json');masks=read('p3a4/aftermath-browser-02/result.json')
coverage=read('p3a4/coverage-03.json');picking=read('p3a4/picking-01.json')
readability=read('p3a4/readability-01/result.json');recapture=read('p3a4/readability-02/result.json')
parity=read('p3a4/flat-parity-01/result.json');named=read('p3a4/retained-01/result.json')
for item in [base,vertical,game,nav,perception,aftermath,browser,masks,coverage,picking,readability,recapture,parity,named]:assert item['status']=='PASS'
assert base['hash']==picking['hash']==recapture['hash']==d['contentHash']
assert len(vertical['checks'])==88 and all(r['ok'] for r in vertical['checks'])
assert len(game['results'])==5 and all(r['ok'] for r in game['results'])
assert len(nav['rows'])==10 and all(r['ok'] for r in nav['rows'])
assert len(aftermath['rows'])==12 and all(r['ok'] for r in aftermath['rows'])
assert all(r['ok'] for r in perception['checks'])
assert coverage['rayComparisons']==1170 and coverage['candidateHullsCompared']==195
assert coverage['physicalSolids']==coverage['completeModelSolids']==910
assert readability['rooms']==12 and readability['featureCaptures']==7
assert recapture['checks']==8 and recapture['labels'] is False
assert (parity['traces'],parity['records'],parity['tolerance'])==(46,35098,0)
assert parity['frozenUnchanged'] and parity['map']=='BYTE IDENTICAL'
names=['s_world25d','s_nav25d','s_perception25d','network25d','physics25d','view25d','perf_world25d']
assert [r['name'] for r in named['checks']]==names and all(r['exitCode']==0 for r in named['checks'])
parent='106c87015ae8702f452979e0277cbacb5435fa6a'
assert not subprocess.check_output(['git','diff',parent,'HEAD','--','levels/level0.js','dev/stage_a/traces','dev/stage_b/level0-baseline.json.gz','world_motion.js','move.js','dphys.js','death_srv.js','spatial_authority.js','spatial_protocol.js','dev/ai_src','dev/ents_src'],cwd=root)
rows=[]
def add(i,title,note,*paths):
 refs=[]
 for n in paths:
  p=ev/n;assert p.is_file();refs.append({'path':str(p.relative_to(root)),'sha256':sha(p)})
 rows.append({'id':f'L0-{i:02}','name':title,'disposition':'PASS','basis':note,'evidence':refs})
add(1,'Deterministic conversion','Two clean builds equal the shipped artifact and current content hash.','p3a4/base-01.json')
add(2,'Base identity','Twelve canonical rooms and bounds; 3,308 source floor footprints; all-room physical base circulation.','p3a4/base-01.json','p3a3/vertical-01.json')
add(3,'Physical base world','Complete finite physical solids and named support; source cell coverage and body clearance.','p3a4/base-01.json','p3a3/vertical-01.json')
add(4,'Production rendering','910 physical/model solids, 1,170 brute-force ray comparisons, 195 candidate hulls, chunk-boundary/permutation checks and actual multiple GPU pages.','p3a4/coverage-03.json','p3a4/readability-01/result.json','p3a4/readability-02/result.json')
add(5,'Upper overlap','Useful LONG ROOM +180 branch with retained Z0 floor, real slab, independent clients.','p3a3/vertical-01.json','p3a3/browser-02/result.json','p3a4/readability-02/result.json')
add(6,'Stairs','Finite physical treads; ascending/descending/reversing/departing routes and actual species navigation.','p3a3/vertical-01.json','p3a3/navigation-03.json','p3a4/readability-02/result.json')
add(7,'Ramp','Continuous slope routes in both directions; real bodies and readback captures.','p3a3/vertical-01.json','p3a3/navigation-03.json','p3a4/readability-02/result.json')
add(8,'Lower route','BLACKOUT -96 depression, rim fall and legal south ramp return.','p3a3/vertical-01.json','p3a3/browser-02/result.json')
add(9,'Crawl passage','28-unit real clearance; accepted 24-unit crawl fits; standing and incapable species rejected.','p3a3/vertical-01.json','p3a4/readability-01/result.json')
add(10,'Props','Eighteen identities; actual low/window vault, under clearance and tight-gap capability tests.','p3a3/gameplay-03.json','p3a3/prop-links-01.json','p3a3/navigation-03.json')
add(11,'Lamps/materials','90 ordered lamps; nine documented within-bay placement corrections; actual visible/IR positive and negative slab controls.','p3a3/lamp-placement-02.json','p3a4/aftermath-browser-02/result.json')
add(12,'Player spawn','Original neighborhood within 48 units; valid named Z0 support and base circulation.','p3a4/base-01.json','p3a3/vertical-01.json')
add(13,'Entity director','Existing seeded director and populations; 195 candidates per species with safety/separation and upper/lower participation.','p3a3/gameplay-03.json')
add(14,'Cartograph','One seeded variable selection among 164 base-reachable candidates; real multiplayer collection.','p3a3/gameplay-03.json','p3a3/browser-02/result.json')
add(15,'Glitched exits','Three variable supported wall exits from 511 candidates; real normal escape.','p3a3/gameplay-03.json','p3a3/browser-02/result.json')
add(16,'Navigation','Ten complete graph/waypoint routes and 82 physical player/species executions; incapable links rejected.','p3a3/navigation-03.json','p3a3/vertical-01.json')
add(17,'Perception','Actual observation-only memory, anonymous vertical hearing, slab ray/contact rejection, visible/IR separation.','p3a3/perception-01.json','p3a4/aftermath-browser-02/result.json','p3a4/retained-01/result.json')
add(18,'Multiplayer','Real clients, same XY/different Z, independent cutaway, authoritative fall and reconnect.','p3a3/browser-02/result.json','p3a4/retained-01/result.json')
add(19,'Aftermath','Twelve actual server-owned deaths at six elevation stations; mass/support/tether checks and real production masked active/settled/beam/vanish lifecycle.','p3a3/aftermath-03.json','p3a4/aftermath-browser-02/result.json','p3a4/retained-01/result.json')
add(20,'Picking/interactions','Nearest physical visible target at seven viewport/zoom settings; opaque camera and hidden upper targets rejected; physical objective gate.','p3a4/picking-01.json','p3a3/gameplay-03.json')
add(21,'Readability','All twelve rooms and seven feature scenes captured without debug labels; eight affected/additional LONG ROOM captures refreshed. Human judgment remains pending.','p3a4/readability-01/result.json','p3a4/readability-02/result.json')
add(22,'Flat control','Explicit spatial selection; immutable flat source and frozen map; all 46 traces at zero tolerance.','p3a4/flat-parity-01/result.json','p3a4/retained-01/result.json')
add(23,'Regression','All seven retained Stage I named suites actually executed with zero exit status; frozen references unchanged.','p3a4/retained-01/result.json','p3a4/flat-parity-01/result.json')
result={'status':'PASS','milestone':'P3A4','contentHash':d['contentHash'],'rows':rows,'L0-24':'PENDING P3A5','reuseProof':{'acceptedP3A3':accepted,'changedTopLevelFields':changed,'changedViewGroups':changed_groups,'allPhysicalNavigationLightAnchorAndGameplayArraysIdentical':True,'explanation':'P3A3 accepted physical/gameplay evidence remains applicable. Only the local overhead view group changed; affected views have been recaptured and real physical masks tested.'},'namedSuites':named['checks'],'humanQA':'PENDING'}
target=ev/'p3a4/acceptance.json';target.write_text(json.dumps(result,indent=2)+'\n')
print('PASS L0-01 through L0-23; L0-24 awaits P3A5')
