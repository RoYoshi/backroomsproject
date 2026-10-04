#!/usr/bin/env python3
"""Derive certification rows from completed executions, never historical labels."""
import pathlib,json,re,sys
root=pathlib.Path(__file__).resolve().parents[2];ev=root/'dev/stage_i/evidence';read=lambda p:json.loads((ev/p).read_text());write=lambda p,d:(ev/p).write_text(json.dumps(d,indent=2)+'\n')
def failures(row):return [re.sub(r'\s+\[\d+ms\]$','',s.removeprefix('FAIL ')).strip() for s in row['failureLines']]
if sys.argv[1]=='baseline':
 candidate=read('i4/retained-01/baseline-tests.json');parent=read('i4/regression-01/parent-baseline/baseline-tests.json');assert len(candidate)==18
 expected={r['id']:r for r in parent};rows=[]
 for r in candidate:
  if r['id'] in ['npm-test','shared']:
   p=expected[r['id']];assert failures(r)==failures(p),r['id'];assert r['counts']['passed']==p['counts']['passed'] and r['counts']['total']==p['counts']['total'];assert (r['counts']['passed'],r['counts']['total'])==({'npm-test':(151,162),'shared':(22,23)}[r['id']])
  else:assert r['result']=='PASS' and r['exitCode']==0,r['id']+' unexplained failure'
  rows.append({'suite':r['id'],'disposition':'INHERITED FAILURE' if r['id'] in expected else 'PASS','counts':r['counts'],'failureNames':failures(r),'command':r['command'],'seconds':r['durationSeconds'],'evidence':'dev/stage_i/evidence/i4/retained-01/'+r['log']})
 write('i4/baseline-comparison.json',{'status':'PASS_BASELINE_EQUIVALENCE','freshParent':'692eebd338cc42347d437b0c0a2dcc9d7217ac34','exactFailureNamesMatch':True,'rows':rows});print('PASS inherited counts and exact failure names; other retained gates pass');raise SystemExit
portable=read('i4/portable-01/result.json');regression=read('i4/regression-01/result.json');baseline=read('i4/baseline-comparison.json');parity=read('i4/regression-01/parity/result.json');assert portable['status']==regression['status']==parity['status']=='PASS';assert baseline['status']=='PASS_BASELINE_EQUIVALENCE';assert len(regression['checks'])==15 and all(r['exitCode']==0 for r in regression['checks'])
assert (parity['traces'],parity['records'],parity['tolerance'])==(46,35098,0)
write('i4/portable-final.json',portable);write('i4/regression-final.json',regression)
named=['s_world25d','s_nav25d','s_perception25d','network25d','physics25d','view25d','perf_world25d'];suites={}
for n in named:
 r=next(r for r in portable['checks'] if r['name']==n);assert r['exitCode']==0
 text=(ev/f'i4/portable-01/{n}.log').read_text();assert 'NOT IMPLEMENTED' not in text and not re.search(r'^FAIL ',text,re.M),n
 suites[n]={'suite':n,'command':'node dev/tests/'+n+'.js','runtime':portable['runtime']+(' / Chromium 151.0.7922.34 / ANGLE SwiftShader' if n in ['view25d','perf_world25d'] else ''),'seconds':r['seconds'],'evidence':'dev/stage_i/evidence/i4/portable-01/'+n+'.log','disposition':'PASS'}
write('i4/named-suites.json',{'status':'PASS','rows':list(suites.values())})
matrix=json.loads((root/'dev/stage_a/future_matrix.json').read_text());rows=[]
for r in matrix:
 n=r['entry'];extra=[]
 if r['id']=='Z01':extra=['dev/stage_i/evidence/i4/regression-01/stage-f-authority.log']
 if r['id']=='Z14':extra=[suites['view25d']['evidence'],'dev/stage_i/evidence/i4/regression-01/stage-h-lighting.log']
 if r['id']=='Z17':extra=[suites['physics25d']['evidence'],suites['s_world25d']['evidence']]
 if r['id']=='Z32':extra=['dev/stage_i/evidence/i4/portable-01/result.json','25D_STAGE_I_PACKAGE_VERIFICATION.json (external I5 publication receipt)']
 rows.append({'id':r['id'],'ownerStages':r['stages'],'scenario':r['scenario'],'executingSuite':n,'command':suites[n]['command'],'runtime':suites[n]['runtime'],'evidence':[suites[n]['evidence']]+extra,'disposition':'PASS','scope':'All named owner contributions executed. I5 exact final-source blob/mode/CRC verification is enforced by package_final.py.' if r['id']=='Z32' else 'Final aggregate of real owner executions'})
assert [r['id'] for r in rows]==[f'Z{i:02d}' for i in range(1,33)];write('i4/final-matrix.json',{'status':'PASS','rows':rows})
spec=[
 ('Fixed 1/60 gameplay and four 1/240 death substeps; render independence',['timing_policy.js','move.js','dphys.js'],['s_world25d','physics25d'],'stage-d-independence'),
 ('Physical XYZ separated from view interpretation',['world_motion.js','world_view.js','spatial_client.js'],['s_world25d','view25d'],'stage-d-independence'),
 ('Stacked same-XY branches stay distinct',['world_geometry.js','dev/ai_src/10_geo.js','spatial_authority.js'],['s_world25d','s_nav25d','network25d'],None),
 ('Continuous support, no unsupported sleep/floor snap',['world_motion.js','dphys.js'],['s_world25d','physics25d'],None),
 ('Full-volume clearance and hidden physical geometry',['world_geometry.js','world_view.js'],['s_world25d','view25d'],None),
 ('Retained surface-local A*/traversal and capabilities',['dev/ai_src/10_geo.js','dev/ai_src/30_entity.js'],['s_nav25d'],None),
 ('Shortcuts require continuous support and clearance',['world_geometry.js:traceSupportMotion','dev/ai_src/30_entity.js'],['s_nav25d'],None),
 ('No hidden truth in beliefs',['dev/ai_src/20_senses.js','dev/ai_src/22_intelligence.js'],['s_perception25d'],'stage-h-lighting'),
 ('Accepted Hound/Smiler behavior/tuning and IR separation',['dev/ai_src/50_hound.js','dev/ai_src/60_smiler.js','dev/ai_src/25_light.js'],['s_perception25d'],'frozen-parity'),
 ('Server authority and bounded proposal validation',['server.js','spatial_authority.js'],['network25d'],'stage-f-authority'),
 ('World/lifecycle generation isolation',['spatial_protocol.js','spatial_history.js','mp.js'],['network25d','physics25d'],None),
 ('Exactly one canonical authoritative aftermath',['dev/sim_glue.js','dphys.js','spatial_protocol.js'],['physics25d'],None),
 ('Rounded body and two physical independent hands',['dphys.js','dev/ents_src/25_death.js','spatial_client.js'],['physics25d','view25d'],None),
 ('Independent loose-object/decal support',['world_motion.js:createPassive','dphys.js','spatial_client.js'],['physics25d','view25d'],None),
 ('Cutaway changes no physical visibility or targeting',['world_view.js','spatial_client.js'],['view25d'],'stage-h-picking'),
 ('Flat Level 0 preservation',['levels/level0.js','move.js','ai.js','dphys.js'],['s_world25d'],'flat-browser-parity'),
 ('One versioned geometry source and reproducible outputs',['levels/level0.js','world_geometry.js','dev/build_ai.sh','dev/build_sim.sh','dev/build_ents.sh'],['perf_world25d'],None),
 ('No physics/evidence skipped for performance',['server.js','dev/sim_glue.js','world_motion.js','world_view.js'],['physics25d','s_perception25d','perf_world25d'],None),
 ('Explicit numeric/work bounds and safe diagnostics',['world_geometry.js:NUM','world_motion.js:POLICY','spatial_protocol.js:LIMIT'],['s_world25d','network25d','physics25d'],None),
 ('Human QA remains a separate pending gate',['dev/stage_i/package_final.py','25D_STAGE_I_HUMAN_QA.md'],list(named),None)]
inv=[]
for i,(requirement,source,owners,extra) in enumerate(spec,1):
 evidence=[suites[n]['evidence'] for n in owners]
 if extra:evidence.append('dev/stage_i/evidence/i4/regression-01/'+extra+'.log')
 if i in [16,17]:evidence.append('dev/stage_i/evidence/i4/regression-01/parity/result.json')
 if i in [17,20]:evidence.append('dev/stage_i/evidence/i4/portable-01/result.json')
 if i==18:evidence+=['dev/stage_i/evidence/i2/result.json','dev/stage_i/evidence/i3/disposition.json']
 inv.append({'id':f'I-{i:02d}','requirement':requirement,'sourceBoundaries':source,'commands':[suites[n]['command'] for n in owners],'runtime':portable['runtime'],'evidence':evidence,'disposition':'PASS','qualification':'Preservation of accepted behavior; inherited F22 remains a failing retained parameter assertion and P08 remains UNKNOWN.' if i==9 else 'Automation does not grant human approval; finalizer enforces HUMAN QA PENDING.' if i==20 else ''})
write('i4/invariants.json',{'status':'PASS','humanQA':'PENDING','rows':inv});print('PASS seven named suites, 32 executing matrix rows, 20 traceable invariant audits')
