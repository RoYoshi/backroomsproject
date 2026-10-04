#!/usr/bin/env python3
"""Resolve B-01..20 from executed evidence and generate the final reports."""
import json,pathlib,sys,subprocess
from release_common import ROOT,PARENT,PARENT_TREE,PARENT_ZIP,NAMED,sha,validated
ev=ROOT/'dev/part3b/evidence';phase=sys.argv[1];assert phase in ['p3b4','p3b5']
read=lambda p:json.loads((ev/p).read_text())
whole=read('p3b4/whole-completion.json');assert whole['status']=='PASS'
paths=whole['evidence'];get=lambda name:json.loads((ROOT/paths[name]).read_text())
named=read('p3b4/named-01/result.json');assert [r['name'] for r in named['checks']]==NAMED
for r in named['checks']:
 if r['name']!='view25d':assert r['exitCode']==0,r['name']
assert '2/2 view25d gates passed' in (ev/'p3b4/view-02/process.log').read_text()
for f in (ev/'p3b4/view-02/raw').glob('*/browser_*/result.json'):assert json.loads(f.read_text())['status']=='PASS'
assert len(list((ev/'p3b4/view-02/raw').glob('*/browser_*/result.json')))==3
for name in ['invariants','presentation-foundation','presentation-motion','presentation-cutaway','production-base','production-vertical','production-navigation','production-gameplay','production-perception','production-picking','production-render_coverage','production-aftermath','browser-foundation','browser-matrix','browser-resets','browser-cutaway','browser-production-readability','browser-production-aftermath','browser-production-gameplay','performance-production','frozen-parity','flat-browser-parity','served-flat-fixture','served-production']:
 assert get(name)['status']=='PASS',name
assert get('baseline-comparison')['status']=='PASS_BASELINE_EQUIVALENCE'
motion=get('presentation-motion');parity=get('frozen-parity');coverage=get('production-render_coverage');matrix=get('browser-matrix');performance=get('performance-production')
assert (parity['traces'],parity['records'],parity['tolerance'])==(46,35098,0);assert parity['frozenUnchanged'] and parity['map']=='BYTE IDENTICAL'
assert coverage['physicalSolids']==coverage['completeModelSolids']==910;assert coverage['rayComparisons']==1170;assert coverage['candidateHullsCompared']==195
assert len(matrix['rows'])==8 and all(r['hiddenPixels']==0 and r['positivePixels']>20 and r['glError']==0 for r in matrix['rows'])
assert len(get('browser-resets')['rows'])>=8;assert get('browser-production-readability')['rooms']==12
rows=[]
def add(i,name,basis,*names):
 refs=[{'path':paths[n],'sha256':sha(ROOT/paths[n])} for n in names]
 rows.append({'id':f'B-{i:02}','name':name,'disposition':'PASS','basis':basis,'evidence':refs})
add(1,'Simulation invariance','Only world_view.js and spatial_client.js are runtime changes; immutable runtime/content manifests and retained traces agree.','invariants','frozen-parity')
add(2,'Time-based camera smoothing','Analytic spring replay at 30/60/120/144/240 Hz and jitter; camera maximum cross-schedule error '+str(max(r.get('maxCameraDifference',0) for r in motion['rows']))+' units.','presentation-foundation','presentation-motion')
add(3,'Stair visual continuity','Physical forward/reverse, reversal and sideways departure replay; retained real keyboard traversal and bounded render/camera lag.','presentation-motion','production-vertical')
add(4,'Ramp continuity','Both directions on production ramp and lower return ramp; real physical traces with six presentation schedules.','presentation-motion','production-vertical')
add(5,'Fall depth cue','Both +180 to 0 and 0 to -96 physical arcs pass monotonic destination-scale approach. Full-height case starts in a clearance-valid airborne stairwell pose; no new ledge is claimed. Human feel remains pending.','presentation-motion')
add(6,'Landing response','At most 1.25 units of presentation settle over 180 ms; physical inputs and aim origin remain unchanged.','presentation-motion','invariants')
add(7,'Depth projection bounds','94–106 percent scale, 95.238 percent for a plane 180 below; inverse and clamp-crossing geometry pass.','presentation-foundation','browser-foundation')
add(8,'Camera fairness','Byte-identical camera policy and canonical physical XY footprint, with rejected outside targets and eight actual viewport/DPR/quality/NV/zoom configurations.','presentation-foundation','browser-matrix','invariants')
add(9,'Picking correctness','Projection inverse, offset-aware physical body points, nearest visible actor and same-XY slab rejection pass.','presentation-foundation','presentation-motion','production-picking','browser-matrix')
add(10,'Continuous Level 0 rooms','288 ceiling pieces are omitted only from camera presentation, independent of ordinary room entry; all twelve rooms captured.','presentation-cutaway','browser-cutaway','browser-production-readability')
add(11,'NORTH local cover','Actual crawl passage, independent inside/outside clients, zero hidden peer/beam pixel differences.','presentation-cutaway','browser-cutaway')
add(12,'LONG overlap cutaway','Only six-piece local slab/edge group reveals for lower viewer; upper view independent; no hidden peer/aftermath/beam leaks.','browser-cutaway','browser-matrix','browser-production-aftermath')
add(13,'Physical ceiling truth','Complete 910-solid model, unchanged convex planes/channels, parent ray equality, collision/IR/sound/support checks.','presentation-cutaway','production-render_coverage','invariants')
add(14,'Multiplayer independence','Two real clients maintain separate camera and cutaway; no peer state or physical pose mutation from display settings.','browser-matrix','browser-cutaway','browser-production-gameplay')
add(15,'Reconnect/teleport/reset','Observed production camera reset calls snap exactly with zero spring velocity after teleports, epoch reset, socket reconnect, death reference and life reset.','browser-resets')
add(16,'Aftermath','Twelve real server-owned deaths on six elevation stations plus actual active/settled/beam/vanish browser masks and same-floor positive controls.','production-aftermath','browser-production-aftermath')
add(17,'Full/reduced truth equality','Same physical world, canonical scope, candidate IDs, local cutaway and picking; hidden pixel count remains zero.','browser-matrix','browser-production-readability')
add(18,'Browser coverage','16:9, 16:10, ultrawide, DPR2, 4K, quality, UI scale, NV LOW/HIGH, zoom 1/2/4 and two clients.','browser-matrix')
add(19,'Retained certification','All seven named Stage I suites pass after narrow H2 setup repair; eight Part 3A production suites pass; all 18 historical suites match exact accepted counts/failure names; 46 frozen traces/35,098 records at zero tolerance.','baseline-comparison','frozen-parity','production-base','production-vertical','production-gameplay')
qa=ROOT/'PART_3B_HUMAN_QA.md';assert qa.is_file()
rows.append({'id':'B-20','name':'Human readability handoff','disposition':'PASS','basis':'Explicit human tests supplied for stairs, ramps, both falls, depth, continuous rooms, crawl, overlap, picking, aftermath, resets, settings and comfort. Human design decision PENDING.','evidence':[{'path':qa.name,'sha256':sha(qa)}]})
acceptance={'status':'PASS','milestone':'P3B4','rows':rows,'humanQA':'PENDING','sourceContentHash':whole['contentHash'],'runtimeChangesDuringRecovery':0,'retainedViewRetry':'p3b4/view-02/process.log','historicalFailuresPreserved':True}
if phase=='p3b4':
 names=set(n for n in subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=ROOT).decode().split('\0') if n and validated(n))
 acceptance['validatedFiles']={n:sha(ROOT/n) for n in sorted(names)}
else:
 acceptance['validatedFiles']=read('p3b4/acceptance.json')['validatedFiles']
 for n,digest in acceptance['validatedFiles'].items():assert sha(ROOT/n)==digest,'Changed after P3B4: '+n
(ev/'p3b4/acceptance.json').write_text(json.dumps(acceptance,indent=2)+'\n')
(ROOT/'PART_3B_ACCEPTANCE.md').write_text('# Part 3B acceptance\n\nB-01 through B-19 objective gates PASS. B-20 handoff is supplied; human readability/comfort/design decision remains PENDING.\n\n| Gate | Result | Evidence and scope |\n|---|---|---|\n'+'\n'.join('| '+r['id']+' '+r['name']+' | PASS'+(' — human QA pending' if r['id']=='B-20' else '')+' | '+r['basis']+' |' for r in rows)+'\n\nExact evidence paths and SHA-256 values: `dev/part3b/evidence/p3b4/acceptance.json`. Historical failed attempts remain in the package.\n')
perf='# Part 3B performance evidence\n\nBounded measurements on the recorded host and software SwiftShader GPU. No hardware FPS, capacity or Part 3G certification is claimed. The seven retained named suites include their unchanged performance/portability assertions.\n\n| Production simulation | p50 ms | p95 ms | p99 ms | max ms |\n|---|---:|---:|---:|---:|\n'
for r in performance['rows']:
 if 'players' in r:
  t=r['allTickMs'];perf+=f'| {r["players"]} players / 1,200 fixed ticks | {t["p50"]:.3f} | {t["p95"]:.3f} | {t["p99"]:.3f} | {t["worst"]:.3f} |\n'
perf+='\n| Completed production render/readback | Drained samples, ms |\n|---|---|\n'
for r in matrix['rows']:perf+='| '+r['case']['id']+' | '+', '.join(f'{t:.1f}' for t in r['drainedFrameMs'])+' |\n'
perf+='\nGPU completion/readback is included; CPU submission is not presented as frame completion. High-DPR/4K targets are capped at 4,194,304 pixels. Geometry contains all 910 physical occluders, with conservative candidate batches; 288 continuous ceilings are camera-only omissions. CPU cold-start/navigation stalls and accepted aftermath limits remain relevant. No physics, AI, ray or quality-truth threshold was relaxed.\n\nRaw production CPU and GPU evidence: `'+paths['performance-production']+'`, `'+paths['browser-matrix']+'`. Parent measurements remain in `PART_3A_PERFORMANCE.md`; run-to-run timings are host-dependent.\n'
(ROOT/'PART_3B_PERFORMANCE.md').write_text(perf)
final=None
if phase=='p3b5':
 final=read('p3b5/portable-01/result.json');assert final['status']=='PASS';assert set(NAMED)<=set(r['name'] for r in final['gates']['checks'] if r['exitCode']==0)
status='P3B4 OBJECTIVE GATES PASS — P3B5 PENDING' if phase=='p3b4' else 'P3B5 PORTABLE GATES PASS — FINAL PUBLICATION PENDING'
summary='# Part 3B test summary\n\n'+status+'\n\n- B-01..B-19: PASS. B-20 handoff: complete; human decision PENDING.\n- Three focused presentation suites: PASS. Ten real physical traces replayed at six render schedules.\n- Eight retained Part 3A production suites: PASS, including 88 vertical checks, 1,170 independent ray comparisons, 195 candidate hulls and 12 aftermath scenarios.\n- Seven named Stage I suites: PASS after the recorded H2 post-teleport setup repair.\n- Eighteen historical suites: exact accepted baseline equivalence. Aggregate remains 151/162; shared remains 22/23 (F22); P08 remains UNKNOWN. These are not relabeled as passes.\n- Frozen flat parity: 46 traces, 35,098 records, zero tolerance, byte-identical map/reference.\n- Real production browser display matrix, resets, NORTH/LONG concealment, twelve-room readability, aftermath and multiplayer/objective checks: PASS.\n- Package-relative HTTP and redirect gates: PASS.\n'
if final:summary+='- Fresh path-with-spaces extraction: PASS. Every source blob/mode matches; two repeated builds reproduce identical generated outputs; all final gates executed from the extraction.\n'
summary+='\nHistorical/raw failures, logs, screenshots and timings remain under `dev/part3b/evidence`. Final pass requires the exact assertions; no successful result replaces the preserved failing attempt.\n'
(ROOT/'PART_3B_TEST_SUMMARY.md').write_text(summary)
report=f'''# Part 3B — Movement, Camera & Depth Presentation

{status}

Accepted Part 3A parent: `{PARENT}`. Tree: `{PARENT_TREE}`. Immutable ZIP SHA-256: `{PARENT_ZIP}`.

Final source identity is recorded in the accompanying external publication receipt.

P3B0–P3B2 were retained. P3B3 was recovered from `82f501e24c2757e6cdcf4046f36916e5e02ea589` / `83db9423727fb87bb603b833032dbc078c2d0bb6` and closed without runtime changes. All 3,550 recovered files matched their remote blobs/modes. P3B4 includes objective validation and a narrow inherited browser-harness setup repair. Runtime changes for all Part 3B remain limited to `world_view.js` and `spatial_client.js`.

The camera uses an analytic critically damped elevation spring at 24/s, bounded to 28 units of lag. Live player/peer rendered elevation uses 40/s with at most 8 units or 14 percent of body height. Landing settle is at most 1.25 units over 180 ms. Resets snap on world/life/authoritative discontinuities, connection changes and gaps over 250 ms. Physical XYZ, support, aim/eye/light origins and simulation remain exact.

Depth denominator is `clamp(1 - (z-cameraZ)/3600, 1/1.06, 1/0.94)`; scale is its inverse. A floor 180 below reads at 95.238 percent scale; all layers stay within 94–106 percent. Clamp-crossing triangles are split so physical fragment interpolation and ray masks remain correct. The canonical camera-policy footprint is unchanged; projection cannot admit additional actors or geometry outside it. DPR changes sharpness, and quality changes presentation cost.

Projection-aware picking uses the matching inverse/segmented camera ray, returns physical body coordinates after visual offset, and retains physical eye visibility and camera occlusion. Same-XY hidden upper/lower targets stay unpickable. Full/reduced views preserve scope, physical candidates, cutaway and picking truth.

Level 0 remains one continuous interior. The 288 ordinary/upper ceiling pieces are camera-only omissions, while all 910 physical occluders remain for collision, support, LOS, light/IR and sound. NORTH reveals only local crawl cover for an eligible inside viewer. LONG reveals only the necessary upper slab/edge group for a lower viewer. Clients retain independent cutaway/camera state, with zero hidden peer/beam/aftermath pixel differences in the tested controls.

B-01 through B-19: PASS. B-20: explicit handoff supplied, human readability/comfort/design decision PENDING. See `PART_3B_ACCEPTANCE.md` and its evidence JSON for every disposition. All seven Stage I named suites, eight Part 3A production suites, exact historical baseline comparison and frozen flat parity are retained. The H2 setup race and all earlier failed attempts remain documented; no production repair or test assertion weakening was needed during recovery.

Known limits: full-height +180→0 replay begins at a clearance-valid airborne pose above the bottom stairwell, not a newly authored walk-off ledge. Depth readability and comfort require RoYo's judgment. Software-GPU captures are not hardware FPS certification. Accepted CPU navigation stalls, aftermath limits, historical aggregate failures and P08 UNKNOWN remain. External fonts may fail while local-resource loading must pass.

Part 3C begun: NO. Multi-Level Runtime begun: NO. Main modified/merged: NO. Physics/AI/network/death retuning: NO. Human QA: PENDING.
'''
(ROOT/'PART_3B_REPORT.md').write_text(report)
print('PASS B-01..19, B-20 handoff; reports generated for '+phase)
