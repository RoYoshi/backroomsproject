#!/usr/bin/env python3
"""HQ3: re-bind Part 3B acceptance to the corrected-presentation evidence.

Usage: python dev/part3b/certify_hq3.py
Follows certify.py (P3B4) but binds every gate to HQ1/HQ2 evidence for the
top-down correction. Writes dev/part3b/evidence/hq3/acceptance.json (evidence
paths + SHA-256, validated source hashes) and regenerates PART_3B_ACCEPTANCE.md,
PART_3B_TEST_SUMMARY.md and PART_3B_PERFORMANCE.md. Nothing is relabeled: the
historical P3B4 acceptance and every failed attempt remain preserved.
"""
import json,subprocess
from release_common import ROOT,STATUS,NAMED,sha,validated
ev=ROOT/'dev/part3b/evidence';hq2=ev/'hq2'
HQ1,HQ2='ae7157cc1fd246e72dc809b71c0c34acb54f0ca3','1a08f3c2cd78a033e8fb81a76d20859666c9ccb4'
paths={
 'invariants':'hq2/whole-02/invariants.json','presentation-foundation':'hq2/whole-02/presentation-foundation.json','presentation-motion':'hq2/whole-02/presentation-motion.json','presentation-cutaway':'hq2/whole-02/presentation-cutaway.json',
 **{'production-'+n:f'hq2/whole-02/production-{n}.json' for n in ['base','vertical','navigation','gameplay','perception','picking','render_coverage','aftermath']},
 'baseline-comparison':'hq2/whole-02/baseline-comparison.json','frozen-zero-tolerance-failure':'hq2/whole-02/failure.json','frozen-cross-engine':'hq2/parity-cross-engine-01/result.json',
 'browser-foundation':'hq2/whole-03-continuation/browser-foundation/result.json','browser-matrix':'hq2/whole-03-continuation/browser-matrix/result.json','browser-resets':'hq2/whole-03-continuation/browser-resets/result.json',
 'browser-production-readability':'hq2/whole-03-continuation/browser-production-readability/result.json','browser-production-aftermath':'hq2/whole-03-continuation/browser-production-aftermath/result.json','browser-production-gameplay':'hq2/whole-03-continuation/browser-production-gameplay/result.json',
 'performance-production':'hq2/whole-03-continuation/performance-production.json','served-flat-fixture':'hq2/whole-03-continuation/served-flat-fixture.json','served-production':'hq2/whole-03-continuation/served-production.json','redirect':'hq2/whole-03-continuation/redirect.log',
 'hq1-focused':'hq2/whole-03-continuation/hq1-focused.json','hq1-browser':'hq2/whole-03-continuation/hq1-browser/result.json','hq1-focused-initial':'hq1/focused-deterministic.json','hq1-browser-initial':'hq1/browser/result.json',
 'flat-browser-parity':'hq2/whole-04-repaired/flat-browser/result.json','browser-cutaway':'hq2/whole-04-repaired/browser-cutaway/result.json','named':'hq2/named-01/result.json','hq2-summary':'hq2/hq2-summary.json'}
get=lambda n:json.loads((ev/paths[n]).read_text())
for n,p in paths.items():
 if p.endswith('.json') and n!='frozen-zero-tolerance-failure':
  s=get(n)['status'];assert s in ['PASS','PASS_BASELINE_EQUIVALENCE','PASS_CROSS_ENGINE'],(n,s)
assert '"status":"PASS"' in (ev/paths['redirect']).read_text()
assert get('frozen-zero-tolerance-failure')['status']=='FAIL'  # preserved, never relabeled
# Runtime identity: no gameplay/runtime change after HQ1.
diff=subprocess.check_output(['git','diff','--name-only',HQ1,'HEAD'],cwd=ROOT,text=True).split()
assert all(n.startswith(('dev/part3b/','PART_3B_')) for n in diff),diff
for n in ['world_view.js','spatial_client.js']:assert subprocess.check_output(['git','rev-parse','HEAD:'+n],cwd=ROOT,text=True)==subprocess.check_output(['git','rev-parse',HQ1+':'+n],cwd=ROOT,text=True)
assert not subprocess.check_output(['git','diff','HEAD','--','world_view.js','spatial_client.js'],cwd=ROOT)
motion,matrix,coverage,perf,xe,named=get('presentation-motion'),get('browser-matrix'),get('production-render_coverage'),get('performance-production'),get('frozen-cross-engine'),get('named')
focused={r['name'].split(':')[0]:r for r in get('hq1-focused')['rows']}
stairs=next(r for r in get('hq1-focused')['rows'] if r['name'].startswith('stairs'))['results']
assert len(matrix['rows'])==8 and all(r['hiddenPixels']==0 and r['positivePixels']>20 and r['glError']==0 for r in matrix['rows'])
assert coverage['physicalSolids']==coverage['completeModelSolids']==910 and coverage['rayComparisons']==1170 and coverage['candidateHullsCompared']==195
assert (xe['traces'],xe['records'],xe['candidateEqualsBaselineOnHost'],xe['map'],xe['frozenUnchanged'])==(46,35098,True,'BYTE IDENTICAL',True)
assert [r['name'] for r in named['checks']]==NAMED and all(r['exitCode']==0 for r in named['checks'])
assert len(get('browser-resets')['rows'])>=8 and get('browser-production-readability')['rooms']==12 and len(get('production-aftermath')['rows'])==12
hb=get('hq1-browser');views=[r for r in hb['rows'] if 'pixelsOutsideBands' in r];assert len(views)==6 and all(r['pixelsOutsideBands']==0 and r['changedPixels']>0 and r['localScale']==1 for r in views)
two=hb['rows'][-1];assert two['high']['peerScale']<1<two['low']['peerScale']
rows=[]
def add(i,name,basis,*names):
 rows.append({'id':i,'name':name,'disposition':'PASS','basis':basis,'evidence':[{'path':'dev/part3b/evidence/'+paths[n],'sha256':sha(ev/paths[n])} for n in names]})
red=lambda r:f"{100*r['reduction']:.0f}%"
add('B-01','Simulation invariance','Only world_view.js and spatial_client.js differ from the Part 3A runtime freeze. HQ1 frozen-trace captures are byte-identical to HQ0 on the host (46 traces).','invariants','frozen-cross-engine')
add('B-02','Time-based camera smoothing','Unchanged analytic spring; 30/60/120/144/240 Hz and jitter replay, maximum cross-schedule camera difference '+str(max(r.get('maxCameraDifference',0) for r in motion['rows']))+' units.','presentation-foundation','presentation-motion')
add('B-03','Stair visual continuity','Physical stair traces at six schedules. The smoothed wall-band cue cuts the peak per-frame change by '+', '.join(red(r) for r in stairs[:2])+' versus unsmoothed steps.','presentation-motion','production-vertical','hq1-focused')
add('B-04','Ramp continuity','Both production ramps, real physical traces, six presentation schedules.','presentation-motion','production-vertical')
add('B-05','Fall depth cue','Falls 180→0 and 0→−96 move the smoothed wall cue '+' and '.join(f"{r['startCue']:.1f}→{r['endCue']:.1f}" for r in stairs[2:])+' units without a snap. The full-height case starts airborne over the stairwell; no new ledge is claimed. Human feel pending.','hq1-focused','presentation-motion')
add('B-06','Landing response','At most 1.25 units of presentation settle over 180 ms; physical inputs and aim origin unchanged.','presentation-motion','invariants')
add('B-07','Top-down projection lock','Production camera: elevation 0, no layer depth or oblique offset. Footprint corners coincide at every Z, caps are exact and every strip is a perpendicular rectangle inside its solid. In six live views a 180-unit camera-Z change alters only band pixels (0 elsewhere).','hq1-focused','hq1-browser')
add('B-08','Camera fairness','Byte-identical camera policy and canonical physical XY footprint across eight viewport/DPR/quality/NV/zoom configurations with identical candidates and scope.','browser-matrix','invariants')
add('B-09','Picking correctness','Band picks resolve to the exact physical face (deterministic and live), floors pick the vertical-ray point, unseen caps pick nothing, scaled actors map back to the body, and hidden same-XY targets stay unpickable.','hq1-focused','hq1-browser','production-picking','browser-matrix')
add('B-10','Continuous Level 0 rooms','288 ceiling pieces omitted only from camera presentation; no room-entry blackout; all twelve rooms captured.','presentation-cutaway','browser-production-readability','hq1-focused')
add('B-11','NORTH local cover','Real crawl, independent inside/outside clients, zero hidden peer/beam pixel differences. HQ2 setup repair aims the beam along the tunnel; assertion unchanged.','presentation-cutaway','browser-cutaway')
add('B-12','LONG overlap cutaway','Only the local slab/edge group reveals for a lower viewer; upper view independent; no hidden peer/aftermath/beam leaks.','browser-cutaway','browser-matrix','browser-production-aftermath')
add('B-13','Physical ceiling truth','Complete 910-solid model, unchanged planes/channels, 1,170 parent ray comparisons and 195 candidate hulls, plus collision/IR/sound/support checks.','presentation-cutaway','production-render_coverage','invariants')
add('B-14','Multiplayer independence','Two real clients keep separate camera, cutaway and relative-scale anchors; display settings mutate no peer state.','browser-matrix','browser-cutaway','browser-production-gameplay','hq1-browser')
add('B-15','Reconnect/teleport/reset','Production camera resets snap exactly with zero spring velocity across all retained reset paths.','browser-resets')
add('B-16','Aftermath','Twelve server-owned deaths on six elevation stations plus active/settled/beam/vanish browser masks and same-floor positive controls.','production-aftermath','browser-production-aftermath')
add('B-17','Full/reduced truth equality','Same physical world, scope, candidate IDs, local cutaway and picking; hidden pixels zero.','browser-matrix','browser-production-readability')
add('B-18','Browser coverage','16:9, 16:10, ultrawide, DPR2, 4K, quality, UI scale, NV LOW/HIGH, zoom 1/2/4 and two clients.','browser-matrix')
add('B-19','Retained certification',"Seven named Stage I suites and eight Part 3A production suites pass, and all 18 historical suites match exact accepted counts and failure names. Frozen parity: 46 traces / 35,098 records within the documented cross-engine tolerance, byte-identical to HQ0 on host Node "+xe['hostRuntime']+"; the zero-tolerance 1-ULP divergence against recorded "+'/'.join(xe['recordedRuntime'])+' is preserved, not relabeled. Flat browser parity passes with the repaired clock start.','named','baseline-comparison','frozen-cross-engine','frozen-zero-tolerance-failure','flat-browser-parity','production-base','production-vertical','production-gameplay')
add('HQ-01','Four-direction local wall depth','Bounded strips on all four wall orientations (N/S/E/W faces banded and eye-facing from room anchors), widths within 3–28 units, never over open floor, mitred corners.','hq1-focused','hq1-browser')
add('HQ-02','Relative-Z local presentation','Each client renders its own player at exactly 1.0; actors below or above scale within 94–106%. Live two-client: higher sees lower at '+f"{two['high']['peerScale']:.3f}"+', lower sees higher at '+f"{two['low']['peerScale']:.3f}"+'.','hq1-focused','hq1-browser')
qa=ROOT/'PART_3B_HUMAN_QA.md';text=qa.read_text()
for q in ['unmistakably top-down','rectangular','left/right walls','top/bottom walls','stairs and ramps','falls','subtle','cutaways','toy-sized','camera comfort']:assert q in text,q
rows.append({'id':'B-20','name':'Human readability handoff','disposition':'PASS','basis':'Explicit ten-question top-down handoff with launch instructions. Human design decision PENDING.','evidence':[{'path':qa.name,'sha256':sha(qa)}]})
names=set(n for n in subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=ROOT).decode().split('\0') if n and validated(n))
acceptance={'status':'PASS','milestone':'HQ3','presentation':'top-down correction (HQ1 '+HQ1+')','regressionCheckpoint':HQ2,'rows':rows,'humanQA':'PENDING','engineeringStatus':STATUS,
 'runtimeChangesSinceHQ1':0,'historicalP3B4Acceptance':'dev/part3b/evidence/p3b4/acceptance.json (superseded presentation; preserved)','historicalFailuresPreserved':True,'validatedFiles':{n:sha(ROOT/n) for n in sorted(names)}}
(ev/'hq3').mkdir(exist_ok=True);(ev/'hq3/acceptance.json').write_text(json.dumps(acceptance,indent=2)+'\n')
(ROOT/'PART_3B_ACCEPTANCE.md').write_text('# Part 3B acceptance — corrected top-down presentation\n\nB-01..B-19 and HQ-01..HQ-02 objective gates PASS against the HQ1/HQ2 evidence for the top-down correction. B-20 handoff is supplied; the human readability, comfort and design decision remains PENDING. The P3B4 acceptance of the rejected projection is preserved at `dev/part3b/evidence/p3b4/acceptance.json` as history.\n\n| Gate | Result | Evidence and scope |\n|---|---|---|\n'+'\n'.join('| '+r['id']+' '+r['name']+' | PASS'+(' — human QA pending' if r['id']=='B-20' else '')+' | '+r['basis']+' |' for r in rows)+'\n\nExact evidence paths and SHA-256 values: `dev/part3b/evidence/hq3/acceptance.json`. All failed attempts remain in the package.\n')
p='# Part 3B performance evidence\n\nHQ2 measurements of the corrected top-down presentation, on the validation host (Node '+xe['hostRuntime']+') and software SwiftShader GPU. No hardware FPS, capacity or Part 3G certification is claimed. Host timings are noisier than the P3B4 host; the retained performance suites still pass their unchanged thresholds.\n\n| Production simulation | p50 ms | p95 ms | p99 ms | max ms |\n|---|---:|---:|---:|---:|\n'
for r in perf['rows']:
 if 'players' in r:t=r['allTickMs'];p+=f'| {r["players"]} players / 1,200 fixed ticks | {t["p50"]:.3f} | {t["p95"]:.3f} | {t["p99"]:.3f} | {t["worst"]:.3f} |\n'
p+='\n| Completed production render/readback | Drained samples, ms |\n|---|---|\n'+''.join('| '+r['case']['id']+' | '+', '.join(f'{t:.1f}' for t in r['drainedFrameMs'])+' |\n' for r in matrix['rows'])
p+='\nGPU completion/readback is included; CPU submission is not presented as frame completion. High-DPR/4K targets are capped at 4,194,304 pixels. The top-down mesh (caps + local strips) is built once at model compile (about 65 ms one-time in Node) and needs no per-frame projection rebuild. All 910 physical occluders stay in conservative candidate batches, and the 288 continuous ceilings are camera-only omissions. No physics, AI, ray or quality-truth threshold was relaxed.\n\nRaw evidence: `dev/part3b/evidence/'+paths['performance-production']+'`, `dev/part3b/evidence/'+paths['browser-matrix']+'`. P3B4 measurements of the superseded projection remain under `dev/part3b/evidence/p3b4`.\n'
(ROOT/'PART_3B_PERFORMANCE.md').write_text(p)
(ROOT/'PART_3B_TEST_SUMMARY.md').write_text('# Part 3B test summary\n\n'+STATUS+'\n\nThe corrected top-down presentation (HQ1 `'+HQ1+'`) was validated in HQ2 (`'+HQ2+'`) with no runtime change since HQ1.\n\n- B-01..B-19 and HQ-01..HQ-02: PASS. B-20 handoff complete; human decision PENDING.\n- HQ1 focused: deterministic PASS (top-down lock, exact footprints, four-direction strips, 1.0 local anchor, exact band picking, smoothed stair/fall cue, local cutaway). Production browser PASS: six views change only band pixels under a 180-unit camera-Z change, and a two-client relative-scale check passes.\n- Three Part 3B presentation suites and eight Part 3A production suites: PASS, including 1,170 independent ray comparisons, 195 candidate hulls and 12 aftermath scenarios.\n- Seven named Stage I suites: PASS (`hq2/named-01`).\n- Eighteen historical suites: exact accepted baseline equivalence. Aggregate remains 151/162, shared remains 22/23 (F22) and P08 remains UNKNOWN; these are not relabeled as passes. The first attempt\'s perf-light host-timing outlier is preserved.\n- Frozen flat parity: 46 traces / 35,098 records. HQ1 is byte-identical to HQ0 on host Node '+xe['hostRuntime']+'; 43 traces are identical to the '+'/'.join(xe['recordedRuntime'])+' references at zero tolerance, and 3 differ by 1 ULP, within the documented cross-engine tolerance 0.00001. The map is byte-identical. The zero-tolerance failure is preserved.\n- Flat browser parity (repaired clock start), production display matrix (8 cases, zero hidden pixels), resets, NORTH/LONG concealment (repaired in-tunnel aim), twelve-room readability, aftermath, multiplayer gameplay, performance, served packages and redirect: PASS.\n\nHistorical and raw failures, logs, screenshots and timings remain under `dev/part3b/evidence`. A later successful attempt never replaces a preserved failing one.\n')
print('PASS HQ3 acceptance:',len(rows),'rows; validated files',len(acceptance['validatedFiles']))
