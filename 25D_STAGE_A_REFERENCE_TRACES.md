# Stage A reference traces

46 deterministic gzip JSON traces; 35,098 bounded semantic records. Compressed and semantic SHA-256 values, byte counts and record counts are in the five `dev/stage_a/traces/*-index.json` files. `verify_stage_a.js --regenerate` recreates all captures in fresh processes and requires byte-identical files.

## Format and comparison

`tfb-reference-v1` includes locked baseline name/ZIP hash, Node/platform/architecture, explicit seed or per-world seeds, scenario, 60 Hz sampling clock, source path/hash, deterministic inputs and limitations. Records are canonical-key JSON; nonfinite legacy values have an explicit `$number` representation. Floating values are not rounded into wire quantization. Gzip header/output is deterministic on the recorded runtime. Indices hash both compressed bytes and full uncompressed JSON.

Default comparison is exact. Future justified cross-engine short-fixture comparisons may use 1e-5 world-unit tolerance; no bitwise cross-engine promise is made. Discrete states/events/identities still require exact agreement. The diff command prints FIRST DIVERGENT TICK, record index, world and changed fields, exits 1 on divergence, and reports metadata differences separately. A deliberate tick-2 negative control proves it fails.

## Coverage and limitations

- Motor: real move.js via the existing VM adapter; 12 scenarios, each at 15/30/60/120/144/240/360 FPS plus deterministic jitter. Full precision reference at 60 FPS and exact record hashes/final states for all schedules. Includes acceleration/deceleration, crawl, slide, vault, deep carpet, exhaustion and crossing recovery threshold 36. The existing adapter uses radius 15 and actual collision. Bot key-state/facing and absent rendering/audio/network remain approximations.
- AI: existing unmodified scenario functions and real simulation. At most two stepped entity worlds per scenario are retained; normally these are the first two. SM01 instead retains the first seed pair that actually reaches lit PROVOKED/ATTACKING and dark WATCHING (seed 1003), selected after the full unchanged scenario runs. The full original scenario assertions/seeds still run. Hound acquisition, gaze hesitation/commitment, prediction/search/give-up, orbit, anonymous evidence and IR; Smiler dark/light, gaze, lost target and hidden-position/IR pairs; light OFF, camcorder/no visible aura, observation replay and anonymous source-ID invariance. A retained assertion failure (SM01) is in the trace metadata, not hidden. Source scenarios fully define fixture inputs, including explicit isolation overrides.
- AI records contain beliefs/observations and safe semantic identities; no hidden true player position is added to AI. RNG streams are opaque closures: no state accessor exists, so seeds are recorded and no extra random draw is consumed. Look heading is explicitly presentation snapshot data; physical heading/position retain full precision.
- Death: all Hound/Smiler A–D through death_srv/production dphys; actual kernel context/seed/plan, body, independent hands, hat/light, impacts and settle states at 60 Hz with 240 Hz substep indices. Final replay remains equal DP.simulate fallback remains. No spatial Z is invented; hand `z` in the legacy kernel is a damping ratio. Playback ends at the existing plan duration; no extra future corpse simulation is implied.
- Navigation: 80 real detour path queries, a normal path, an unreachable goal and an explicit crawl cell; 1,486 verified diagonal transitions, 9 vault links and crawl capability. Three actual navGo motor routes retain 1,080 ticks of smoothing/route-commitment state. These are existing flat routes, not synthetic spatial routing. Full arrival coverage remains in the legacy NV01 suite.
- Network: literal mp.js entity interpolation/epoch reset callback, 20 Hz synthetic packets, deterministic jitter/reordering, old x5000/time60 → new x1000/time1, slot/offset clearing and disconnect/reconnect. Literal remote peer smoothing/pose extraction is a separate 60 FPS presentation trace: the existing easing is per frame and no equality claim is made for it. Lifecycle trace calls real join/respawn/vanish/forfeit and capture logic; real wire authority/replay/corpse checks remain in audit_net/live logs. Synthetic arrival times are not a WebSocket implementation. Existing reset heuristics are frozen, not redesigned for Stage F.

No wall-clock samples influence deterministic captures. Execution durations exist only in nondeterministic test/benchmark metadata. AI fixture bounds and deliberate captures are test inputs, not behavior tuning.

| File under dev/stage_a/traces | Scenario | Records |
|---|---|---|
| motor-idle.json.gz | motor/idle | 120 |
| motor-walk.json.gz | motor/walk | 180 |
| motor-sprint.json.gz | motor/sprint | 180 |
| motor-acceleration-deceleration.json.gz | motor/acceleration-deceleration | 180 |
| motor-crouch.json.gz | motor/crouch | 120 |
| motor-crawl.json.gz | motor/crawl | 60 |
| motor-slide.json.gz | motor/slide | 180 |
| motor-exhaustion.json.gz | motor/exhaustion | 960 |
| motor-recovery.json.gz | motor/recovery | 240 |
| motor-recovery-threshold.json.gz | motor/recovery-threshold | 30 |
| motor-vault.json.gz | motor/vault | 180 |
| motor-deep-carpet.json.gz | motor/deep-carpet | 180 |
| ai-s_hound2e-2E-H1.json.gz | 2E H1 identified human with flashlight warrants pursuit | 30 |
| ai-s_hound2e-2E-HQA-H14.json.gz | 2E/HQA H14 eye contact delays pre-pursuit commitment but never suppresses an already committed chase | 100 |
| ai-s_hound2e-2E-H6.json.gz | 2E H6 hidden corner branches cannot change prediction | 756 |
| ai-s_hound2e-2E-H10.json.gz | 2E H10 failed search reduces confidence and ends within finite budget | 4215 |
| ai-s_hound2e-2E-HQA-H18.json.gz | 2E/HQA H18 close-range walking orbit is not an indefinite safe zone | 428 |
| ai-s_hound2e-2E-H3.json.gz | 2E H3 hidden carrier: anonymous light investigation; replay cannot back-project | 33 |
| ai-s_hound2e-2E-H7.json.gz | 2E H7 fresh hidden running after loss causes anonymous investigation (2F attribution) | 9 |
| ai-s_hound2e-2E-H15.json.gz | 2E H15 flashlight off stops new light observations without deleting an identified human | 39 |
| ai-s_hound2e-2E-H5.json.gz | 2E H5 IR OFF vs HIGH: identical complete decisions each tick | 2160 |
| ai-s_smiler-SM01.json.gz | SM01 light: a light carrier it can see is chased after a wind-up; the same person without a light is watched, not chased | 1764 |
| ai-s_smiler-SM03.json.gz | SM03 eye contact: watched, it holds; backing away slowly while watching it gets you let go (it withdraws, no strike) | 3600 |
| ai-s_smiler-SM04.json.gz | SM04 no hidden position: an unsensed player moved elsewhere changes nothing the Smiler does (tick by tick) | 852 |
| ai-s_smiler-SM05.json.gz | SM05 lost player: it goes where it last had them (with an uncertainty), not where they really went | 844 |
| ai-s_smiler-SM08.json.gz | SM08 infrared OFF vs HIGH: identical Smiler decisions (camcorders raised, infrared written everywhere a client could put it) | 2400 |
| ai-s_evidence-E4.json.gz | E4 light off: no new light evidence, but what it already has stays (and fades like any memory) | 7860 |
| ai-s_evidence-E5.json.gz | E5 hidden-position invariance: an unsensed player moved elsewhere changes nothing the hound does | 1440 |
| ai-s_evidence-E6.json.gz | E6 observation replay: the carrier somewhere else, the same observations replayed -> the same leads and decisions (no back-projection) | 532 |
| ai-s_evidence-E7.json.gz | E7 the camcorder emits no visible light: no beam, no light evidence, no glare bonus - its raised state is presentation only | 360 |
| ai-s_shared2f-2F-F01.json.gz | 2F F01 unseen footstep is anonymous, uncertain, no raw origin/identity | 36 |
| ai-s_shared2f-2F-F04.json.gz | 2F F04 private sound source ID cannot change observations or decisions | 396 |
| ai-s_shared2f-2F-F09.json.gz | 2F F09 hidden branch invariance including anonymous sound/light conflict | 402 |
| ai-s_shared2f-2F-F20.json.gz | 2F F20 IR OFF/HIGH is tick-identical for both species | 600 |
| death-Hound-A.json.gz | death/Hound/A | 271 |
| death-Hound-B.json.gz | death/Hound/B | 283 |
| death-Hound-C.json.gz | death/Hound/C | 259 |
| death-Hound-D.json.gz | death/Hound/D | 271 |
| death-Smiler-A.json.gz | death/Smiler/A | 238 |
| death-Smiler-B.json.gz | death/Smiler/B | 232 |
| death-Smiler-C.json.gz | death/Smiler/C | 238 |
| death-Smiler-D.json.gz | death/Smiler/D | 238 |
| navigation-level0.json.gz | navigation/Level0-routes | 1163 |
| network-interpolation.json.gz | network/entity-interpolation-and-reset | 243 |
| network-peer-pose.json.gz | network/peer-render-pose | 180 |
| network-lifecycle.json.gz | network/authoritative-lifecycle | 16 |

Run commands and exact assumptions: `dev/stage_a/README.md`. The immutable full-tree manifest also pins transitive runtime dependencies; the single source hash in each trace identifies its primary implementation.
