#!/usr/bin/env python3
"""Write final H reports only from completed acceptance evidence."""
import pathlib, json, re, subprocess

root = pathlib.Path(__file__).resolve().parents[2]
ev = root/'dev/stage_h/evidence/h5'
read = lambda p: json.loads(p.read_text())
current = read(ev/'retained-01/baseline-tests.json')
accepted = {r['id']:r for r in read(root/'dev/stage_g/evidence/g5/retained/baseline-tests.json')}
accepted.update({r['id']:r for r in read(root/'dev/stage_g/evidence/g5/isolated/baseline-tests.json')})
parent = {r['id']:r for r in read(ev/'regression-01/parent-baseline/baseline-tests.json')}
isolated = read(ev/'light-isolated-01/results.json')
assert len(isolated) == 4 and all(r['exitCode'] == 0 for r in isolated)
names = lambda r: [re.sub(r'\s+\[\d+ms\]$','',s.removeprefix('FAIL ')) for s in r['failureLines']]
comparison = []
for row in current:
    old = accepted[row['id']]
    effective = row
    if row['id'] == 'perf-light':
        effective = {**row,'result':'PASS','failureLines':[],'counts':{**row['counts'],'passed':1,'total':1}}
    assert effective['result'] == old['result'], row['id']
    assert effective['counts']['passed'] == old['counts']['passed'] and effective['counts']['total'] == old['counts']['total'], row['id']
    assert names(effective) == names(old), row['id']
    comparison.append({'suite':row['id'],'acceptedResult':old['result'],'initialHResult':row['result'],
        'finalResult':effective['result'],'counts':effective['counts'],'sameFailureNames':True})
for name,row in parent.items():
    actual = next(r for r in current if r['id']==name)
    assert names(row) == names(actual) and row['counts'] == actual['counts'], name
baseline = {'status':'PASS_BASELINE_EQUIVALENCE','comparisons':comparison,
    'freshAcceptedParentAggregateAndSharedMatch':True,
    'initialLightTimingFailure':next(r for r in current if r['id']=='perf-light'),
    'isolatedLightComparisons':isolated,
    'classification':'Initial light timing FAIL retained; two unchanged H runs and two parent runs pass original limits. No runtime or threshold repair.'}
(ev/'baseline-comparison.json').write_text(json.dumps(baseline,indent=2)+'\n')
regression = read(ev/'regression-01/results.json')
portable = read(ev/'portable-01/result.json')
parity = read(ev/'regression-01/parity/result.json')
h4 = read(root/'dev/stage_h/evidence/h4/H4_COMPLETION.json')
assert len(regression)==19 and all(r['exitCode']==0 for r in regression)
assert portable['status']==parity['status']==h4['status']=='PASS'
assert parity['traces']==46 and parity['records']==35098 and parity['tolerance']==0
def write(name,text):
    (root/('25D_STAGE_H_'+name+'.md')).write_text(text.strip()+'\n')

write('REPORT', '''# THE FAR BACKROOMS — 2.5D Stage H report

**2.5D STAGE H ENGINEERING COMPLETE — HUMAN QA PENDING**

Final remote commit and tree are recorded in the external publication receipt accompanying this archive.

Accepted Stage G parent: `7fb4dafef92040571209403358e536ccb1105509`.
Accepted tree: `eee7f43a74aeb4d0e7ef38effdfc7516eee5e8cf`. Stage G human QA: PASS under the supplied authority. No truncated parent ZIP was used. Branch: `stage-h`. Main was not modified or merged. **Stage I begun: NO.**

Stage H integrates physical A–G state into the existing production Pixi 8.21.0 client. The host-selected spatial world is served through the real `/` page, with `world_config.js`, `world_view.js` and `spatial_client.js` injected before the application module. Normal flat Level 0 remains the retained path. No replacement renderer, new Level 0 layout, AI tuning, physical solver or protocol-authority redesign was introduced.

| Acceptance | Disposition | Evidence |
|---|---|---|
| Z14-H | PASS | Actual visible emitters, LOW/HIGH IR, hidden slab negatives, visible positives, detached light and paired monster decisions/RNG |
| Z29 | PASS | Two real production clients above/below the same XY, independent view state and equal physical world identity |
| Z30 | PASS, 8/8 | 16:9, 16:10, ultrawide, high DPR, 4K, UI 0.5–2, full/reduced quality, NV and 2×/4× zoom |
| view25d | PASS, 2/2 | Real H2/H3/H4 browser orchestration; repeated after clean ZIP extraction |
| network25d | PASS, 5/5 | Retained real Stage F protocol/authority/latency/lifecycle gates; repeated after extraction |
| physics25d | PASS, 5/5 | Retained real Stage G kernel, variants, lifecycle and aftermath gates; repeated after extraction |

Live local/peer/entity poses and corpse body, two independent hands, gear, hat, replay, decals and trails consume authoritative/interpolated XYZ and identities. The spatial pass keeps all physical occluders active regardless of local eligible cutaway. Hidden actors, eyes/faces, aftermath, detached beams, labels and secondary Canvas/DOM world layers produce zero leaked pixels in the negative fixtures, with visible positive controls. Hidden Smiler camcorder interference is zero. One client's camera/cutaway/quality/NV does not alter the other client's view or physical pose.

Spatial picking intersects the camera ray with visible physical faces and actor cylinders, checks physical eye visibility and camera obstruction, selects the nearest valid hit and otherwise uses the eye plane. Actual mouse input reaches the existing fixed-tick stream. Hit point, physical distance and pitch agree across all eight configurations. The accepted CAMERA-P01 cap remains 1536×864 world units at 1920×1080 / 1.25; aspect ratio crops, DPR changes detail, and existing zoom reduces the footprint. Flat aim is retained.

Visible and IR presentation use actual emitter/receiver XYZ and physical channel geometry. IR stays connection-only and absent from monster evidence. Physical presentation audio consumes existing support/contact events without adding AI events or simulation RNG. Equal-observation Hound/Smiler decisions and RNG remain identical under local presentation changes.

H4 recovery preserved the original picking/view implementation without runtime edits. H5 found one reproducibility defect: spatial audio existed in generated `ents.js` but not its maintained source. The raw failed clean build was preserved and pushed before copying exactly those existing lines into `dev/ents_src/30_audio.js`. Rebuilding now reproduces the already-tested runtime byte for byte; no runtime behavior was changed by that repair.

Frozen parity passes all 46 traces / 35,098 records at zero tolerance; reference files are unchanged and the Level 0 map is byte-identical. Actual flat menu/gameplay screenshots, state, RNG and explicit RAF schedules match the accepted G page exactly. All retained spatial and functional regressions pass except the same eleven aggregate failures (151/162) and shared F22 (22/23); P08 remains UNKNOWN. Fresh parent aggregate/shared runs reproduce the same failure names. No frozen references or thresholds were relaxed.

An initial retained light performance run missed the strict 0.25 ms average / 2 ms p99 limits (0.250 / 2.131). It remains a recorded FAIL. Two isolated unchanged H runs passed (0.192 / 0.965 and 0.202 / 1.311), as did their parent controls (0.191 / 0.874 and 0.180 / 0.868). This observation did not justify a runtime change. Historical L5/NZ1 timing caveats and Stage G's 24-active aftermath CPU/payload limitation remain disclosed.

Browser evidence uses Chromium 151 / ANGLE SwiftShader software rendering. The 16.7 ms presentation target is NOT met; raw CPU, drained-frame, memory, draw and occluder measurements are retained in BROWSER_EVIDENCE. No hardware GPU or Stage I capacity/release certification is claimed. External Google Fonts network/TLS failures remain an environment limitation; local resources, script and GL gates pass.

H0–H4 and substantial recovery/H5 work were externally checkpointed. H5 validates all named gates from a fresh ZIP extraction in a path containing spaces, two independent rebuilds, actual flat/spatial HTTP module bytes and private-path rejection. The finalizer requires a clean, remotely verified source commit, exact changed-file audit, unchanged portable-validated code, matching Git blobs/modes, ZIP CRC and fresh final extraction. The exact source folder and finalized publication reports are separate to avoid self-referential Git/ZIP hashes. Human gameplay/design QA remains distinct and pending. Work stops at Stage H.
''')

table = '\n'.join('| '+r['suite']+' | '+r['finalResult']+' | '+str(r['counts']['passed'])+'/'+str(r['counts']['total'])+' |' for r in comparison)
commands = '\n'.join('| '+r['name']+' | PASS | `'+ ' '.join(r['command']).replace(str(root),'.')+'` |' for r in regression)
write('TEST_SUMMARY', '''# Stage H test summary

Node v24.19.0; Chromium 151.0.7922.34 / ANGLE SwiftShader. All raw runs remain under `dev/stage_h/evidence`. Retained suites were serial, including network timing and performance.

| Retained suite | Final disposition | Passed/total |
|---|---|---:|
'''+table+'''

`None/None` is the descriptive navigation benchmark, not a counted assertion suite. Physics has 53 groups covering 240 scenarios. Aggregate/shared failures are inherited and compared by exact names. The initial perf-light FAIL remains in `h5/retained-01`; the table's final PASS refers to both isolated unchanged candidate runs in `h5/light-isolated-01`.

| H5 regression | Result | Command |
|---|---|---|
'''+commands+'''

Fresh extraction checks in `h5/portable-01`: two AI/simulation/entity builds reproduce exactly; real physics25d 5/5, network25d 5/5 and view25d 2/2 pass; flat/spatial HTTP, FPS and camera gates pass. The complete named view gate covers Z29/Z30 and H-Z14 with actual server, production Pixi, multiple clients, screenshots, pixels, GPU and error checks. H1 traversal rerun covers real keyboard ramp and peer fall interpolation. H4 physical picking and paired decision/RNG checks also pass. Package acceptance does not substitute for human gameplay QA.
''')
fails = names(next(r for r in current if r['id']=='npm-test'))
write('BASELINE_FAILURES', '''# Stage H baseline failures and preserved failed attempts

Accepted G and final H aggregate are both **151/162**; shared is **22/23** with F22. Fresh parent runs match exact failure names. P08 remains UNKNOWN; it is not certified by this stage.

'''+ '\n'.join('- '+n for n in fails)+'''

`h5/baseline-comparison.json` records every retained comparison. `h5/retained-01` preserves the initial light-load timing FAIL at 0.250 ms average / 2.131 ms p99. Two serial parent/H pairs then passed the unchanged 0.25/2 ms thresholds: G 0.191/0.874, H 0.192/0.965; G 0.180/0.868, H 0.202/1.311. The first failure is not erased or reclassified as a passing run; it was not reproduced in the two isolated H runs. No performance limit was changed.

H5 clean-build attempt `build-01` failed because maintained audio source lacked H3's generated edits. Its hashes and exact diff were pushed before repair. `build-02` and both portable rebuilds pass after synchronizing only those lines. Generated runtime bytes remain the same as H4.

Earlier H0–H3 raw failures remain in their original directories: flat capture clock/RNG alignment, startup/handshake/GL state, opaque backgrounds, a 72-pixel hidden Hound leak, software queue/startup delays and premature positive-control captures. Their focused repair/rerun histories are documented in H0–H3 status files. H4 recovery preserves missing-browser launch and truncated installation failures before using the existing Chromium executable. No runtime defect was found in the preserved H4 picking/view code.

The software GPU does not meet the 16.7 ms frame target. Hardware certification is unestablished. External Google Fonts network/TLS failures, historical L5/NZ1 observations and the accepted Stage G 24-active aftermath CPU/payload excess remain limitations. Stage I is not begun.
''')
write('PARITY', '''# Stage H frozen and flat parity

**PASS: 46 traces / 35,098 records, tolerance 0.** Motor, AI, all eight death traces, navigation and network records match the frozen Stage A captures. Source-hash metadata differences identify changed files and are not simulation-record differences. Frozen gzip/index files are not regenerated or modified. Evidence: `dev/stage_h/evidence/h5/regression-01/parity/result.json` and every individual capture/diff log.

Level 0 export is BYTE IDENTICAL to the frozen Stage B map gzip. AI, simulation, death kernel, shared geometry/motion, protocol/history, level data and camera/timing policies are byte-identical to the accepted G tree; the exact staged audit lists these invariants.

Actual served flat production menu and gameplay PNG hashes, physical pose, camera scale, started state, RNG and explicit equal RAF delivery schedule match the exact accepted G source. Evidence: `h5/regression-01/browser-flat/result.json`. Native audio time is bound to the harness clock in both captures; product audio is untouched by the harness. Flat mode does not load the spatial view path. This is automated image/state equality, not human feel certification.

All generated builds reproduce exact hashes before/after, including both clean-extraction rebuilds. H5's maintained audio repair changes no generated runtime bytes. Real fixed-tick FPS and camera fairness tests pass in the source and portable package.
''')
write('PRESENTATION', '''# Stage H production presentation

The real server selects a validated spatial definition via `TFB_WORLD`. Its production `/` page loads the world definition, shared geometry/motion/protocol/history, `world_view.js` and `spatial_client.js`, then the retained application. `spatial_client.js` binds the existing Pixi renderer, procedural player/Hound/Smiler art, accepted C motor and F/G authoritative histories. It creates no second gameplay application.

Authoritative/interpolated XYZ and support/lifecycle identities drive local player, peers, Hounds, Smilers, corpse body, two hands, loose light/hat, canonical attacker replay, vanish, decals/trails and lamps. Decals use their actual face and local basis. No client death kernel or client corpse/outcome is run for spatial aftermath. The real caught UI completes from server duration; late/settled physical records remain authoritative.

Each frame resets the Pixi/raw-WebGL boundary, detaches sampled textures before texture updates and restores transparent clear state. An owned depth target composes exact bounded physical convex-ray masks with camera depth. All physical occluders remain present even when an eligible local group fades. A single GPU fence bounds outstanding submissions; input stays on the retained fixed-tick loop. Forced acceptance captures drain completed work.

Planar world canvases/DOM layers (`mp`, `light`, `peerTip`, `aiDebug`, `glitchFx`) are suppressed in spatial mode. Their revealing content is represented in the masked pass. Labels require a physically observable owner and depth/physical masking; admin world lists filter hidden actors. Hidden Smiler effects cannot call camcorder interference. Ordinary screen HUD remains the current UI.

Existing physical support/contact events drive narrow presentation audio with acoustic attenuation/bearing. No source-floor pitch cue, new AI event or simulation RNG is added. Unsupported cosmetic footsteps are suppressed without altering the motor. Maintained `30_audio.js` now reproduces generated `ents.js` exactly.

Flat Level 0 retains its accepted renderer, antialiasing, movement, aim, camera, lighting, audio and lifecycle paths. No map conversion, art redesign, anatomy, branding overhaul or replacement renderer was made. Exact regression evidence is in TEST_SUMMARY and PARITY.
''')
write('VIEW', '''# Stage H view, cutaway and physical picking

**Z29 PASS; Z30 8/8 PASS; real view25d 2/2 PASS.** Source and fresh extracted package both launch actual production clients. Equal world hashes/epochs and physical poses persist while each client independently changes camera, focus, eligible cutaway, quality and NV. Lower/upper clients at the same XY remain independently masked.

The accepted Stage D local state keeps eligible-group-only deterministic fade, 0.15 s enter / 0.25 s restore and boundary hysteresis. It changes camera composition only. Opaque non-eligible geometry blocks camera depth; faded geometry remains in physical eye and light/IR queries. No interaction is granted by fading.

Spatial input constructs the camera ray, intersects physical faces and actor cylinders, rejects out-of-footprint/hidden/camera-occluded candidates, selects the nearest valid hit and otherwise intersects the plane through the real eye. It computes physical yaw/pitch for existing fixed ticks. The matrix moves the actual mouse and checks transmitted accepted input, rather than relying only on direct pick calls. All eight cases agree on world hit point, distance and pitch; hidden actor and opaque slab rejection, eye-plane fallback and immutable geometry pass focused checks. Flat aim is unchanged.

The current accepted CAMERA-P01 value is 1.25 at 1920×1080, giving a maximum 1536×864 XY footprint. The architecture's older 1.18 example is not restored. Aspect ratio crops one axis; DPR and quality only alter resolution/detail; existing 2×/4× zoom narrows the footprint. Matrix UI scales span 0.5–2. All 32 fixture occluders remain in full/reduced modes, and targets stay within 4,194,304 pixels. The existing explicit capacity bound is 64 solids / 8 convex planes; exceeding it fails rather than dropping physical occluders.

Hidden Hound/Smiler eyes/faces, body/hands, gear/hat, decals/trails/replays and detached beams produce zero hidden pixels, with positive visible controls. Canvas/Pixi/DOM world layers and labels share the policy; hidden camcorder interference is zero. Per-case physical hit, masks, controls, footprint, draw/resource costs and screenshots are retained in H4_COMPLETION and the raw browser directories. Human QA must still judge readability and feel.
''')
write('LIGHTING', '''# Stage H lighting, IR and physical audio

**H portion of Z14 PASS.** Real production browser tests use actual flashlight, headlamp and lantern emitters at authoritative/interpolated XYZ. Upper-floor light and IR contributions beneath the intact slab are zero; same-floor positives change pixels. OFF removes the emitter and leaves no fake aura. Receiver height and the true slab/opening geometry determine visibility; local fade does not remove material.

Camcorder LOW/HIGH IR is a separate physical channel. IR contributes zero with the sensor disabled and is visible with NV enabled in authoritative blackout; upper-floor IR remains masked below the slab. Existing zoom and bloom use the actual spatial emitter/ray path. Detached Stage G light/beam uses its independent physical origin/orientation. Body, hands, gear, hat, replay and contact-face effects remain depth/visibility masked.

`test_lighting.js` compares actual production CPU presentation values to accepted E light truth for flashlight/headlamp/lantern on same and hidden floors. It also checks IR separation and immutable geometry. Equal legitimate observations preserve Hound/Smiler decisions and RNG through 900-tick IR pairs and 360-tick independent view/quality/NV/zoom/camera pairs. These toggles do not feed sensor evidence or collision/navigation.

Only existing physical impact and support events are presented acoustically. The accepted sound propagation supplies attenuation and bearing; no new event, exact hidden floor cue or simulation RNG is introduced. The raw H3 browser checks verify canonical caught/death completion and physical impact audio with zero client death-kernel/outcome calls. These checks run again through the portable real view25d gate after the maintained-source build repair.
''')
perf = '\n'.join('| '+r['case']['id']+' | '+f"{r['cpuMs']:.2f}"+' | '+('/'.join(f'{v:.1f}' for v in r['drainedFrameMs']))+' | '+f"{r['newResourceBytes']/1048576:.2f}"+' | '+str(r['drawCalls'])+' |' for r in h4['cases'])
write('BROWSER_EVIDENCE', '''# Stage H browser, GPU and performance evidence

Browser: **'''+h4['browser']+'''**. GPU: **'''+h4['gpu']+'''**. This is software SwiftShader evidence on the execution host, not hardware GPU or final capacity certification.

H4_COMPLETE source gate: `dev/stage_h/evidence/h4/view25d-recovery-01/gate.log` (2/2). Its browser directories retain H2 two-client masks/independence, H3 visible/IR/canonical aftermath/lifecycle, and H4 eight viewport/quality/zoom configurations, screenshots and machine-readable state. `H4_COMPLETION.json` summarizes exact picks, pixels, targets, occluders, draw/packet counts, CPU/cutaway timings and resource estimates. `h5/portable-01/view25d-raw` repeats the complete gate from clean extraction. H5 also repeats Stage D core/extended, real H1 ramp/fall and exact flat G/H captures.

| H4 configuration | Last CPU submission (ms) | Three drained frames (ms) | New resource estimate (MiB) | Draw calls |
|---|---:|---|---:|---:|
'''+perf+'''

The **16.7 ms frame target is NOT met** on this software GPU. Forced drained samples include completed GPU/readback work; CPU submission time alone is not FPS. Counts and memory are fixture measurements, not a capacity promise. Actor texture and default-color estimates are separately recorded in JSON; driver overhead is not measured. There are 32 physical occluders in every matrix case and at most 4,194,304 target pixels. Reduced quality changes target resolution only, preserving masks and world knowledge. No hardware-only result is inferred.

All final local HTTP, script and GL checks pass. External Google Fonts network/TLS failures are an inherited environment limitation. Timeouts and failed screenshots from earlier attempts remain in their original directories; no failed run has been relabeled PASS. The H4 default-browser launch/install failure and H5 build/light timing failures are explicitly retained. Initial retained light-load and isolated comparison metrics are listed in BASELINE_FAILURES.

Stage G's recorded 24-active aftermath p99 50.402 ms and peak 439,626-byte update remain unresolved capacity limits, outside H's presentation integration. Stage I is NOT begun. Human QA remains necessary for camera comfort, readability, fear, traversal/death feel and actual hardware performance.
''')
write('HUMAN_QA', '''# Stage H human-QA handoff

**Engineering complete. HUMAN QA PENDING.** The user is the final gameplay/design authority. Stage I is not begun and main was not modified or merged.

Extract `THE_FAR_BACKROOMS_STAGE_H_FINAL.zip` and open a terminal in `thefarbackrooms-level0`. Node >=18 is the product declaration; engineering evidence used Node v24.19.0. Normal Level 0: `node server.js 3000`, then open `http://localhost:3000/`. Verify familiar movement, camera, lighting, Hound/Smiler behavior, multiplayer and death feel.

For the authorized spatial QA fixture, create its world file:

```bash
node -e "require('fs').writeFileSync('stage-h-world.json',JSON.stringify(require('./dev/stage_e/fixture').fixture(),null,2))"
```

Choose a local admin passcode, then launch on Linux/macOS:

```bash
TFB_WORLD="$PWD/stage-h-world.json" ADMIN_PASSCODE="your-local-test-passcode" node server.js 3000
```

Open `http://localhost:3000/?room=stage-h-qa` in two separate browser profiles/private sessions. This uses the REAL production page and accepted fixture; Stage H does not supply a new stacked Level 0 layout. The default runtime deliberately remains flat.

For precise placements in a local QA session, open the browser console after entering the room. Capture the page's next real outbound socket call, then authenticate using your chosen passcode:

```javascript
await new Promise(resolve => {
  const send = WebSocket.prototype.send;
  WebSocket.prototype.send = function (...args) {
    WebSocket.prototype.send = send;
    window.stageHQASocket = this;
    send.apply(this, args);
    resolve();
  };
});
stageHQASocket.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.t === 'admin' || m.t === 'ares') console.log(m);
});
__net.testAuth('your-local-test-passcode');
```

Confirm the logged admin response has `ok: true`. Define this console-only helper; it uses the existing authenticated epoch/life/ack command path, pausing local input while proposals drain:

```javascript
window.stageHCommand = async function (command) {
  const paused = __api.paused();
  if (!paused) document.querySelector('#help').click();
  await new Promise(r => setTimeout(r, 300));
  const p = __net.spatialState().pose;
  const reply = new Promise(resolve => {
    const listener = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'ares') {
        stageHQASocket.removeEventListener('message', listener);
        resolve(m);
      }
    };
    stageHQASocket.addEventListener('message', listener);
  });
  stageHQASocket.send(JSON.stringify({t:'a', ...command,
    worldEpoch:p.worldEpoch, life:p.generation, ack:p.discontinuity}));
  const result = await reply;
  if (!paused) __api.unpause();
  if (!result.ok) throw Error(result.msg);
  return result;
};
await stageHCommand({c:'spatial-tp',pose:{x:160,y:160,z:180,support:'support:upper-west'}});
```

Use `{x:160,y:160,z:0,support:'support:ground-north'}` for the lower client. Optional existing QA commands include `{c:'freeze',on:1}`, `{c:'spatial-entity',kind:'hound',pose:{x:220,y:160,z:0,support:'support:ground-north'}}` and `{c:'preview',k:'hound',var:'B'}`. Resume monster thinking with `{c:'freeze',on:0}`. These are local QA tools, not new gameplay permissions; do not change physics to obtain a placement.

| Area | Human checks |
|---|---|
| Traversal | Ramp/stair ascent, departure and fall are readable and continuous; no floor snap or slab passage. |
| Two clients | Same XY above/below; each cutaway is independent. Changing one view cannot reveal state to the other. |
| Cutaway | Only eligible overhead groups fade; boundary movement avoids flicker and does not make material physically disappear. |
| Leaks | Hide Hounds/Smilers, eyes/faces, corpse/hands, gear/hat, decals/trails/replays and beams behind slabs/walls. Any revealing fragment is FAIL. |
| Light/IR | Flashlight/headlamp/lantern through real openings versus intact slabs; OFF has no aura; LOW/HIGH NV and detached light agree with physical XYZ. |
| Aim | Nearest physically visible face/actor is selected; hidden same-screen targets stay rejected; fade grants no reach through geometry. |
| View options | 16:9/16:10/ultrawide, high DPR, UI 0.5–2, full/reduced detail, NV and 2×/4× zoom. No extra world knowledge. |
| Art and aftermath | Rounded player body and two hands retained; canonical corpse/equipment/replay depth and caught UI feel coherent. |
| Flat control | Accepted G feel, timing, camera, map, lighting and deaths remain familiar. |

Settings → Customize → World View controls local cutaway and full/reduced detail. Hardware performance needs your browser/GPU observations: the engineering SwiftShader run misses 16.7 ms and does not certify a smooth hardware profile. Known aggregate eleven failures/shared F22/P08 UNKNOWN and Stage G's active-aftermath capacity limit remain disclosed.

For each discrepancy record source commit, browser/GPU, viewport/DPR, UI/detail/NV/zoom, client count, world placement and exact steps, plus screenshot/video if useful. Automated gates prove the tested invariants; they do not decide readability, fear, camera comfort or death feel. Stop at H pending your QA.
''')
print('Wrote ten final Stage H reports and exact baseline comparison')
