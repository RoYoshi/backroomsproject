#!/usr/bin/env python3
"""Human-readable reports from verified final evidence; no fabricated outcomes."""
from pathlib import Path
import json,statistics
root=Path(__file__).resolve().parents[2];ev=root/'dev/stage_i/evidence';load=lambda p:json.loads((ev/p).read_text());put=lambda n,t:(root/('25D_STAGE_I_'+n+'.md')).write_text(t.rstrip()+'\n')
status='2.5D IMPLEMENTATION COMPLETE — HUMAN QA PENDING'
baseline=load('i4/baseline-comparison.json');portable=load('i4/portable-final.json');reg=load('i4/regression-final.json');parity=load('i4/regression-01/parity/result.json');matrix=load('i4/final-matrix.json');inv=load('i4/invariants.json');named=load('i4/named-suites.json');stress=load('i2/result.json');server=load('i2/measurement-03/server.json');geo=load('i2/measurement-03/geometry.json');browser=load('i2/stress-02/browser-matrix/result.json');comparison=load('i3/disposition.json')
assert baseline['status']=='PASS_BASELINE_EQUIVALENCE';assert all(d['status']=='PASS' for d in [portable,reg,parity,matrix,inv,named,stress,server,geo,browser])
known='Accepted aggregate 151/162 with the same eleven failure names; shared 22/23 with F22; P08 remains UNKNOWN; historical L5/NZ1 timing observations; external Google Fonts network/TLS failures; software SwiftShader misses 16.7 ms with no hardware GPU certification; inherited full-quality two-client airborne-capture limitation (Reduced detail passes the unchanged assertion); 24-active aftermath CPU/payload limit.'
table=lambda headers,rows:'| '+' | '.join(headers)+' |\n|'+ '|'.join(['---']*len(headers))+'|\n'+''.join('| '+' | '.join(str(v).replace('|','/') for v in r)+' |\n' for r in rows)
put('REPORT',f'''# Stage I — full regression, performance and package

**{status}**

Accepted Stage H commit: `692eebd338cc42347d437b0c0a2dcc9d7217ac34`; tree: `1cd5430b61aac7f994da29f4879621a638c49526`; immutable ZIP SHA-256: `037feeeaeb16c354c11228458c31f986cfce594cfeaf8e93472d21b919ef9d5d` (69,071,771 bytes). Stage H human QA is PASS under the supplied acceptance authority.

Final remote commit and tree are recorded in the external publication receipt accompanying this archive.

Stage I activates real `s_world25d` and `perf_world25d`, completes Z18 and Z32, and certifies all seven named suites from a fresh complete source extraction in a path containing spaces. The final machine-readable matrix contains 32 PASS rows and the invariant audit contains 20 PASS preservation/correctness rows, each tied to executing evidence and source boundaries. All owner contributions are aggregated; historical dormant/reference matrices remain unchanged as historical evidence.

No production runtime change was necessary. Existing-file changes are limited to the two named test entry points and package test commands. New work consists of test orchestration, adversarial/property checks, measurement probes, evidence and release tooling. The only repairs were to new test fixture bounds, snapshot readiness and unavailable external memory probing. Every failed/slow attempt remains preserved.

Z18 uses the actual move.js motor and world-motion path, radius 15, exact recovery threshold 36, walk/run/exhaustion/recovery and deep carpet. Normal/deep 1,560-tick traces match at 15/30/60/120/144/240/360 FPS and jitter; retained traversal schedules and flat control pass. Z32 includes twice-reproducible AI/sim/entities, actual flat/spatial server delivery, private-route rejection, actual redirect execution, browser loading, every named suite and final Git blob/mode/manifest/CRC verification.

Frozen parity: **46 traces / 35,098 records, zero tolerance**, frozen references unchanged and Level 0 map byte-identical. Flat served menu/gameplay screenshots, state, RNG and RAF schedules match accepted H. The retained stack reproduces inherited failures by exact name; every other retained suite passes. See TEST_SUMMARY, BASELINE_FAILURES and PARITY.

Bounded stress covers 4/16/64 dense same-XY colliders, real ramp/stair/drop/crawl, four occupied surfaces and connected real brains, hostile/latent real wire traffic, 1/3/24 aftermaths, three-room 60-second churn/death/disposal, active 64-Hound/64-Smiler ceiling and eight production viewport/quality/NV/zoom configurations. These are measured workloads on the recorded execution host, not deployment capacity promises. Correctness remains enabled throughout.

Known limitations: {known}

Node: {portable['runtime']}. Browser: {browser['browser']}. GPU: {browser['gpu']}. Host CPU and memory samples are in STRESS/PERFORMANCE and raw JSON. Only this Node/browser environment is certified; the product's existing Node >=18 declaration is not a claim that every Node version was tested.

Main modified or merged: **NO**. Production 2.5D Level 0 conversion begun: **NO**. Part 3 begun: **NO**. Human QA: **PENDING**. The I5 finalizer enforces the exact remotely verified source tree, unchanged portable-validated code, exact changed-file ledger and externally stored publication identity. Stop after delivery.
''')
put('TEST_SUMMARY','# Stage I test summary\n\nAll timing-sensitive runs were serial. Counts retain each original suite’s meaning.\n\n'+table(['Retained suite','Disposition','Passed / total','Seconds','Raw evidence'],[(r['suite'],r['disposition'],str(r['counts']['passed'])+' / '+str(r['counts']['total']),round(r['seconds'],3),r['evidence']) for r in baseline['rows']])+'\nNavigation is a descriptive benchmark, not a counted assertion suite. Legacy physics has 53 groups covering 240 scenarios.\n\n'+table(['Named final suite','Disposition','Runtime','Seconds','Evidence'],[(r['suite'],r['disposition'],r['runtime'],round(r['seconds'],3),r['evidence']) for r in named['rows']])+'\n'+table(['Retained spatial/integration command','Exit','Seconds'],[(' '.join(r['command']),r['exitCode'],round(r['seconds'],3)) for r in reg['checks']])+'\nFresh extraction independently runs all seven named suites plus six builds, HTTP, redirect, FPS and camera. Named owners execute retained B/C/E/F/G/H kernels; the separate integration run covers D prototype/browser, H traversal, physical picking/light independence and frozen/flat parity.\n')
failures=next(r for r in baseline['rows'] if r['suite']=='npm-test')['failureNames']
put('BASELINE_FAILURES','# Stage I inherited failures and preserved attempts\n\nFresh accepted H and Stage I both return 151/162 aggregate and 22/23 shared, with exact failure-name equality. P08 remains UNKNOWN as a behavior conclusion even though its aggregate row is among the eleven inherited failing assertions.\n\n'+''.join('- '+n+'\n' for n in failures)+f'''\nNo old assertion or threshold was relaxed. Historical L5/NZ1 observations remain in accepted evidence. The original H perf-light miss remains preserved; I4 retained performance results are listed in TEST_SUMMARY.

Stage I raw attempts:

- `i1/world-01`: new large fixture exceeded its declared minimum bounds; only those test bounds were corrected. `world-02` passes.
- `i1/perf-01`: default browser executable missing; the standard install returned truncated ZIPs. The existing compatible Chromium was selected through the documented environment option. `perf-02` passes; no product path was embedded.
- `i2/stress-01/server-soak.json.failure.json`: new harness accessed the recreated client snapshot before arrival. First-snapshot readiness was added after external preservation; the original assertions pass in `stress-02` and `measurement-03`.
- `i2/memory-evidence-audit.json`: host /proc RSS reads produced no samples, explicitly marked incomplete evidence. Test-only server process telemetry supplies 73 samples in `measurement-03`; zero samples are never presented as zero memory use.
- `i3/parent-comparison-01`: flat candidate run 1 p99 0.503586 ms / worst 53.990695 ms and first 24-active candidate p99 87.362694 ms remain raw slow observations. Three flat pairs and two aftermath pairs, plus exact runtime-byte equality, do not establish a new regression. The second 24-active pair is 57.830375 / 57.790630 ms.

Carried limitations: {known}

All prior A–H evidence remains in the source archive. A historical failed attempt stays failed; a later success is recorded separately with its provenance.
''')
put('PARITY',f'''# Stage I frozen and flat parity

PASS: {parity['traces']} traces, {parity['records']:,} records, tolerance {parity['tolerance']}. Motor, real AI, shared death, navigation and network captures were rerun with the retained Stage A capture tools. Frozen reference hashes were compared before/after; none changed. Level 0 export is **{parity['map']}**.

Command: `python dev/stage_h/run_parity.py dev/stage_i/evidence/i4/regression-01/parity`. Every per-trace comparison and capture is retained there; no first divergent tick exists in the passing comparisons.

`node dev/stage_h/browser_flat.js . <accepted-H-extraction> <output>` serves both actual production packages in Chromium. Menu/gameplay pixel hashes, complete captured state, RNG and explicit 50 Hz RAF callback schedule match exactly. Evidence: `dev/stage_i/evidence/i4/regression-01/browser-flat/result.json` and four PNGs.

Final world/property gates also cover eight render schedules, physical rotation/mirror, Z translation, stable-ID canonical permutation, tolerance boundaries and diagnostic iteration fallback. H light/view pairs preserve brain decisions/RNG under cutaway/quality/NV/IR changes. G physical replay/sample schedule and F duplicate/reconnect identities execute through the named suites. This is objective tested parity, not human game-feel approval.
''')
put('FINAL_MATRIX','# Stage I final Z01–Z32 acceptance matrix\n\nEvery row is backed by a final named execution from the complete fresh extraction. Cross-stage contributions are explicitly linked. Z32’s exact final archive identity is verified by the external I5 receipt.\n\n'+table(['ID','Owner stage(s)','Scenario','Executing suite / command','Runtime','Disposition','Evidence'],[(r['id'],r['ownerStages'],r['scenario'],r['executingSuite']+' / '+r['command'],r['runtime'],r['disposition'],'; '.join(r['evidence'])) for r in matrix['rows']])+'\nMachine-readable version: `dev/stage_i/evidence/i4/final-matrix.json` (also delivered as 25D_STAGE_I_FINAL_MATRIX.json).\n')
put('INVARIANTS','# Stage I I-01–I-20 invariant audit\n\nPASS means the stated invariant/preservation obligation is established by the listed executing gates. It does not relabel inherited legacy failures as passing. In particular I-09 certifies accepted canon/tuning preservation, with F22 and P08 disclosed separately.\n\n'+table(['Invariant','Requirement','Disposition','Source boundaries','Executing evidence'],[(r['id'],r['requirement'],r['disposition'],'; '.join(r['sourceBoundaries']),'; '.join(r['evidence'])) for r in inv['rows']])+'\nEach machine-readable row also records exact commands/runtime and qualifications: `dev/stage_i/evidence/i4/invariants.json`. I-20 is enforced again by the finalizer’s pending-human-QA status.\n')
soak,ceiling=server['rows'];frames=[r for r in browser['checks'] if 'case' in r]
perfdirs=list((ev/'i4/portable-01/perf_world25d-raw').glob('perf_world25d-*'));assert len(perfdirs)==1;normal=json.loads((perfdirs[0]/'eight-client.json').read_text());aftermath=json.loads((perfdirs[0]/'aftermath-1-3-24.log').read_text().splitlines()[-1])
put('PERFORMANCE',f'''# Stage I performance evidence

CPU: {server['host']['cpu']}; Node {server['host']['node']}; platform {server['host']['platform']}/{server['host']['arch']}. Browser {browser['browser']}; {browser['gpu']}. Timings are wall-clock metadata, never simulation input. No hardware GPU or hosting-plan capacity certification.

Normal eight-client director room: **PASS** unchanged p99 <8 ms threshold; p50 {normal['cpu']['median']:.3f}, p95 {normal['cpu']['p95']:.3f}, p99 {normal['cpu']['p99']:.3f}, worst {normal['cpu']['max']:.3f} ms over {normal['cpu']['samples']} measured steps. Actual population: {normal['entities']} director entities. Queues/history/wake validation limits remain 90/90/15.

Active shared aftermath (four physical substeps retained):

'''+table(['Active aftermaths','p50 ms','p95 ms','p99 ms','Worst ms','Peak snapshot bytes','Peak nominal bytes/client/s','Disposition'],[(r['count'],round(r['activeTickMs']['p50'],3),round(r['activeTickMs']['p95'],3),round(r['activeTickMs']['p99'],3),round(r['activeTickMs']['worst'],3),r['snapshotBytes']['worst'],r['nominal20HzPeakBytesPerClientSecond'],'KNOWN LIMITATION' if r['count']==24 else 'BOUNDED MEASUREMENT') for r in aftermath['results']])+f'''
All cases settle through real physics; sleeping query deltas are zero. Frame/record caps stay asserted. The 24-active CPU/payload limit is reproduced in parent controls, not passed against the normal-room threshold.

Active 128-entity admin stress: p50 {ceiling['cpu']['median']:.3f}, p95 {ceiling['cpu']['p95']:.3f}, p99 {ceiling['cpu']['p99']:.3f}, worst {ceiling['cpu']['max']:.3f} ms; {ceiling['advancedTicks']} ticks over {ceiling['seconds']:.2f} seconds; {ceiling['bytesPerSecond']:.0f} measured bytes/client/s; largest frame {ceiling['maxFrameBytes']} bytes. **BOUNDED MEASUREMENT**, not the ordinary-room threshold. An extra spawn is rejected. The initial uninstrumented run measured 7.54 ms p99; telemetry repeat 14.02 ms p99. Both raw measurements remain.

Production browser completed/drained frame samples (three per case; too few for a population percentile):

'''+table(['Profile','Viewport / DPR','CPU submission ms','Drained frames ms','New resource MiB','Draw calls','Occluders'],[(r['case']['id'],f"{r['case']['w']}×{r['case']['h']} / {r['case']['dpr']}",round(r['stats']['cpuMs'],2),'/'.join(str(round(t,1)) for t in r['drainedFrameMs']),round(r['stats']['newResourceBytes']/1048576,2),r['stats']['drawCalls'],r['stats']['occluders']) for r in frames])+f'''
**KNOWN LIMITATION: 16.7 ms is not met on SwiftShader.** CPU submission is not completed GPU frame time. Every case preserves the physical mask and all 32 occluders; target cap remains 4,194,304 pixels. The inherited full-quality two-client fall capture can miss airborne motion; existing Reduced detail passes its unchanged assertion. Hardware performance requires human testing.

Flat parent controls: median-of-three candidate/parent ratios {comparison['candidateParentRatios']['median']:.4f} (median) and {comparison['candidateParentRatios']['p99']:.4f} (p99), within the 10%/20% investigation bands. Slow outliers remain in BASELINE_FAILURES. Runtime bytes are identical; no correctness-reducing optimization was made. Existing legacy performance gates retain their thresholds and final dispositions in TEST_SUMMARY.
''')
put('STRESS',f'''# Stage I bounded stress matrix

PASS for the measured workloads. These results do not establish arbitrary population, map complexity, indefinite uptime or deployment capacity.

'''+table(['Family','Actual workload','Evidence','Disposition'],[(k,v,'dev/stage_i/evidence/i2/'+stress['finalEvidence'][k],'PASS / BOUNDED MEASUREMENT') for k,v in [('geometry','4/16/64 same-XY stacks, 500 sweeps each; local support/clearance; real ramp/stair/drop/crawl'),('navFourSurfaces','1/2/4 occupied surfaces, 2/4/8 real entities and players, two seeds'),('navConnected','Four connected occupied surfaces, 660 fixed ticks, actual paths/brains/sensors'),('authorityNetwork','Real latency 20–250 ms, jitter/duplicates/stale reports, one-second interruption, hostile claims, reconnect/lifecycle'),('aftermath','1/3/24 active aftermaths through sleeping; real shared kernel and payloads'),('serverSoak','Three rooms, eight initial clients, 60 seconds, death, three reconnects and disposal/recreation; separate live 64+64 admin ceiling'),('browserMatrix','Eight real production viewport/DPR/UI/quality/NV/zoom cases, two-client independence, aftermath/beam/overlay masks')]])+f'''
Dense geometry records actual candidate and conservative-advance counters via counters-only source instrumentation. Representative sweeps are exactly compared against the uninstrumented module. Local queries retain one Z-filtered narrow-phase candidate at every tested stack density. All real motion samples stay nonpenetrating; explicit iteration-limit safety is separately tested by s_world25d.

Navigation records occupied-sheet node/edge allocation, route and physical-proof cache statistics, search budgets, sensor rays/acoustic expansions and evidence maxima. Identity/evidence/sound/lead/habit/hypothesis/support-alternative bounds remain 16/4/8/6/6/3/4. These measurements run the existing brains, not fixture bots.

The server soak records real socket bytes, frame/interarrival distributions, rolling 600-step CPU statistics, authority limits, lifecycle churn and explicit fresh epoch after room disposal. Actual process telemetry has {len(server['telemetry']['samples'])} one-second memory/event-loop samples. During the 60-second room segment RSS begins at {soak['rssStart']} and ends at {soak['rssEnd']} bytes, maximum {soak['rssBytes']['worst']}; cache warmup/churn is included. No long-term leak claim is made. Raw per-second history is retained, including garbage-collection variability.

The active admin ceiling retains AI thinking and physical motion. The 24-active aftermath and software GPU cases remain known limits; their correctness is not bypassed. See PERFORMANCE for actual timings, bytes and classifications. Failed first-snapshot and incomplete memory attempts remain alongside successful repeats.
''')
put('PORTABILITY',f'''# Stage I portability / Z32

PASS: complete staged-source ZIP extracted to `{portable['cleanPath']}`. The destination contains spaces and no Git checkout. {portable['sourceFiles']} source files were verified against staged Git blobs before execution; archive CRC passed. The final I5 publication separately verifies every exact final source blob, mode, manifest entry and fresh extraction.

Two full rounds of `bash dev/build_ai.sh`, `bash dev/build_sim.sh`, `bash dev/build_ents.sh` reproduce these hashes:

'''+table(['Generated output','SHA-256'],portable['buildHashes'].items())+'''
All seven named 2.5D suites execute from this extracted package. The tests also run FPS/camera, normal `node server.js` in both flat/spatial host modes, `node redirect.js` with an actual 302/path-preserving request, required public runtime modules with HTTP 200 and byte identity, malformed paths, and private server/dev modules with expected rejection. Production Playwright browsers load the extracted runtime and validate script/GL/resource behavior. Required test dependencies are documented in dev/stage_i/README.md; the product never depends on the originating workspace path.

The named perf_world25d gate performs an additional fresh package-relative extraction/build/HTTP exercise. Final publication refuses any changed or newly added code path after full portable validation. Test/output paths in evidence identify where execution happened; they are not application dependencies. Product Node >=18 remains a declaration; observed engineering runtime is Node v24.19.0 with Chromium 151 / SwiftShader.
''')
put('HUMAN_QA',f'''# Stage I human-QA handoff

**{status}**

You remain the final gameplay/design authority. Automated certification covers the tested invariants and measured workloads; it does not decide fairness, fear, readability, camera comfort or game feel.

Extract THE_FAR_BACKROOMS_STAGE_I_FINAL.zip, open a terminal in `thefarbackrooms-level0`, and run:

```bash
node server.js 3000
```

Open `http://localhost:3000/` for ordinary flat Level 0. The default remains flat. Check familiar movement/stamina, camera, Hound/Smiler behavior, visible/IR equipment, multiplayer, death and persistent aftermath.

For the accepted synthetic spatial QA fixture:

```bash
node -e "require('fs').writeFileSync('stage-i-world.json',JSON.stringify(require('./dev/stage_e/fixture').fixture(),null,2))"
TFB_WORLD="$PWD/stage-i-world.json" ADMIN_PASSCODE="your-local-test-passcode" node server.js 3000
```

Open `http://localhost:3000/?room=stage-i-qa` in two independent browser profiles. For exact authenticated QA placement, the inherited `25D_STAGE_H_HUMAN_QA.md` console helper remains valid; its old stage/status wording is superseded by this handoff. Lower pose: x160/y160/z0, support:ground-north. Upper pose: x160/y160/z180, support:upper-west. Existing QA commands allow physical placement, freeze/resume and all eight death previews; no production map conversion is supplied.

'''+table(['Area','Human check'],[('Motion','Walk/sprint/exhaust/recover, deep carpet, ramp/stairs/reversal, crouch/crawl/slide/vault, ledge departure and underside collisions.'),('Visibility / camera','Same XY above/below in two clients; independent cutaway; no hidden body/hand/eye/gear/beam/blood/debug/map fragment through slabs; unchanged awareness at all aspect/DPR/UI settings.'),('Perception / canon','Visible light versus real openings/slabs, gaze timing, Hound/Smiler behavior, uncertain hearing, IR/NV blindness of AI; preserve accepted behavior.'),('Authority','Ordinary multiplayer movement, brief packet interruption/reconnect, new world/life, revive restrictions, no stale pose or corpse attachment.'),('Aftermath','All eight variants on ramp/stair/ledge; victim disconnect, late join during fall/after sleep, independent hand/gear support, one persistent physical aftermath.'),('Hardware performance','Record actual GPU/browser and full/reduced quality; explicitly assess two-client falling motion, high DPR/4K/NV zoom, ordinary room and active aftermath load.'),('Flat control','Compare familiar Level 0 feel, appearance, movement/resources, entities and deaths against accepted H.')])+f'''
Known limitations requiring visibility in QA: {known}

For a discrepancy record source commit, browser/GPU, viewport/DPR/UI/detail/NV/zoom, client count, world placement and exact steps, with screenshot/video when useful. The measured 60-second soak and admin ceiling are not an uptime or capacity promise. Main was not modified/merged; production 2.5D Level 0 and Part 3 were not begun. Stop here pending your QA.
''')
print('Wrote ten final source reports; checkpoint log retained, exact changed-file audit follows.')
