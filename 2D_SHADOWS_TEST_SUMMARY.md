# THE FAR BACKROOMS — 2D Lighting & Shadows: test summary

Every result below is generated from the logs in `dev/shadows/evidence/sh4/` (the final tree) by `dev/shadows/report/mk_test_summary.py`. Nothing is typed by hand. Measured values are copied in full; a `|` inside one is escaped for the table.

## Required focused tests → where they are covered

| required by the prompt | tests | result |
|---|---|---|
| dominant direction | S05 | **PASS** |
| correct shadow-away-from-light orientation | S05, S06, C01, C02, C06, C14 | **PASS** |
| stable caster ordering | S11, C10, C16 | **PASS** |
| wall adjacency | S02, S03 | **PASS** |
| flashlight rotation | S06, C07, C15 | **PASS** |
| lamp flicker response | C03, C04 | **PASS** |
| blackout | C05, B02 | **PASS** |
| no NaN / infinite geometry | S10, C09 | **PASS** |
| culling / caps | S04, S09, C08, C16, C19 | **PASS** |
| Low / Medium / High | S09, S14, C11, B05 | **PASS** |
| Smiler concealment preservation | S07, B07, B03 | **PASS** |
| no presentation-to-AI data path | S12, S15, S16, B04 | **PASS** |
| (also) nothing revealed that the player cannot see | S08, B03 | **PASS** |

## Unit tests — `node dev/shadows/test_shadows.js`: **35/35 PASS**

The module runs in a Node VM with the real level geometry, ray query, lamp list and equipment light model extracted verbatim from the shipped bundle, the real `light.js` and `world.js`, and a recording mock of the Pixi classes (it keeps polygon arrays by reference and canvas pixels, as Pixi does).

| id | test | result | measured |
|---|---|---|---|
| S01 | attaches right above the carpet, under the level art; mp hook chained | **PASS** | index 1, mp ret mp-ret |
| S02 | wall adjacency: every wall/floor boundary edge is covered by exactly one grounding strip of the right side | **PASS** | 1492 boundary edges, 483 merged strips (3.09 edges/strip), missing/double 0, stray 0 |
| S03 | grounding strips lie on floor only (never inside a wall cell) and outer corners are closed | **PASS** | 847 quads, 364 corner blobs, samples inside walls 0 |
| S04 | grounding is static (built once) and camera-culled by chunk | **PASS** | chunks 24, visible at spawn [[0,1],[1,1],[0,2],[1,2]], after moving [[4,0]], builds 1 |
| S05 | dominant direction: light.js points toward the light; the entity shadow points away from it | **PASS** | sample dir -1.000,0.000 lamp 0.405; shadow {"x":671.44,"y":2832,"sx":70.44,"sy":36.8,"rot":0,"a":0.3} |
| S06 | the local flashlight casts a lit hound's shadow away from the player; rotating the aim off it fades it smoothly (no pop) | **PASS** | start alpha 0.253 end 0.000 max frame step 0.0176 |
| S07 | Smilers never get a shadow (no implied body), even fully lit in the beam | **PASS** | 0 shadows near the smiler |
| S08 | nothing is revealed: a lit hound the player cannot see (behind a wall) gets no shadow; in sight it does | **PASS** | hidden-hound shadows 0; in-sight 2 |
| S09 | caps: entity shadows never exceed the quality budget; OFF draws nothing | **PASS** | {"off":{"n":0,"cap":0,"rootVisible":false},"low":{"n":6,"cap":6,"rootVisible":true},"medium":{"n":12,"cap":12,"rootVisible":true},"high":{"n":20,"cap":20,"rootVisible":true}} |
| S10 | no NaN / Infinity in anything drawn, whatever the inputs (random positions, zero dt, huge dt, NaN entity) | **PASS** | 0 shadows in the last frame; disabled='' |
| S11 | stable ordering / determinism: the same scene and light state give identical geometry | **PASS** | 12 shadows |
| S12 | read-only: drawing shadows never changes an entity, the player, the lamps or the light foundation | **PASS** | unchanged |
| S13 | failure isolation: an internal error switches the module off and the game hook keeps working | **PASS** | disabled='frame error', warn 1 |
| S14 | quality: URL > remembered > device default; LOW is a real tier (grounding + capped light shadows) | **PASS** | url high, touch low, desktop medium |
| S15 | no presentation-to-AI data path (static): the server never loads or reads the shadow module; the module never talks to the network | **PASS** | server refs [], network [], writes into game objects [] |
| S16 | the shipped server serves the module without any server change (assets/ is already whitelisted) | **PASS** | /^\/(index\.html\|world\.js\|move\.js\|ents\.js\|mp\.js\|hud\.js\|… |
| C01 | lamp shadows of props fall away from the lamp (every prop-shadow polygon centroid is on the far side of the prop) | **PASS** | 5 lamps, 12 prop-shadow polygons, min dot 1869.9 |
| C02 | lamp wall penumbrae: apex on a convex wall/pillar corner, extend away from the lamp, only where the lamp's light reaches (no double black) | **PASS** | 232 penumbra polygons from 25 lamps; off-corner 0, pointing back 0, over the umbra 0 |
| C03 | lamp flicker: a lamp's shadow strength follows the overlay's own lamp power every frame (failures dim it, never brighter than nominal) | **PASS** | alphas ["1.000","1.000","1.000","1.000","0.531"] failing x.25 ["0.250","0.250","0.250","0.250","0.133"] failed: 0 visible; NV x1.5 ["1.000","1.000","1.000","1.000","0.531"] |
| C04 | dim fixtures (index % 13 == 0) flicker their shadows with the overlay formula .13 + .06·max(0, sin(11t + i)), relative to their brightest state | **PASS** | lamp #0 alpha 0.684..0.999, alpha / formula constant to 0.0e+0 |
| C05 | blackout removes every lamp shadow at once; carried-light shadows stay | **PASS** | lamp layers 5 -> 0; carried prop polys 4 -> 4 |
| C06 | your own light: props cast moving shadows away from the beam | **PASS** | 4 prop polygons, all beyond the prop: true; lights 1 |
| C07 | flashlight rotation: sweeping the aim across a prop changes its shadow smoothly (no frame-to-frame pop) | **PASS** | shadow mass max 15239, ends 3890/8371, worst step 6.0% |
| C08 | caps and culling: lamps <= tier cap and only those in view; dynamic polygons <= budget; peers <= cap | **PASS** | {"low":{"lamps":2,"cap":2,"inView":true,"dyn":0,"budget":40,"lights":3,"lightCap":3},"medium":{"lamps":5,"cap":5,"inView":true,"dyn":4,"budget":300,"lights":8,"lightCap":8},"high":{"lamps":9,"cap":9,"inView":true,"dyn":19,"budget":700,"lights":14,"lightCap":14}} |
| C09 | no NaN / Infinity in any lamp or carried-light polygon, and every polygon owns its point array (Pixi keeps references) | **PASS** | 39978 polygons checked; shared point arrays 0; disabled='' |
| C10 | stable ordering: the same scene and light state build identical lamp and carried geometry | **PASS** | 4 lamp caches, 7 prop + 0 penumbra polygons |
| C11 | LOW / MEDIUM / HIGH: fidelity grows with the tier (lamps, samples, penumbra wedges), LOW keeps every kind of shadow; OFF draws nothing | **PASS** | {"off":{"lamps":0,"lampWalls":0,"lampPolys":0,"props":0,"pen":0,"propPolys":0,"root":false},"low":{"lamps":2,"lampWalls":16,"lampPolys":22,"props":1,"pen":0,"propPolys":2,"root":true},"medium":{"lamps":5,"lampWalls":45,"lampPolys":61,"props":1,"pen":0,"propPolys":4,"root":true},"high":{"lamps":7,"lampWalls":80,"lampPolys":100,"props":1,"pen":0,"propPolys":5,"root":true}} |
| C12 | baked prop shadows are detected: a prop lit from the side of its baked drop shadow gets a thinner dynamic shadow | **PASS** | alpha sum lit from NW (shadow onto the baked side) 0.080 vs from SE 0.147 |
| C13 | other wanderers' lights: bounded, cast prop shadows and pillar penumbrae, never from a dead or switched-off light | **PASS** | lights 1, penumbra polygons 4 (from pillar corners 4), bad 0/0/0, polys 4/300 |
| C14 | your light's penumbrae: from convex corners in the beam, on the lit side of the edge the overlay already cuts, away from you | **PASS** | polygons per scene [8,4,0,4,3]; off-corner 0, pointing back 0, over the umbra 0 |
| C15 | no popping: along an orbit of a pillar, a walk past wall corners and a 10 s run through the pillar hall (sprint speed, light swinging), no caster's shadow jumps by a third of its own peak in one frame (LOW / MEDIUM / HIGH) | **PASS** | {"low":{"orbit":{"peak":266,"casters":5,"total":10.3,"caster":13.3},"walk":{"peak":215,"casters":2,"total":16.9,"caster":16.9},"hall":{"peak":429,"casters":12,"total":10.4,"caster":28.1}},"medium":{"orbit":{"peak":201,"casters":5,"total":10,"caster":13.2},"walk":{"peak":160,"casters":2,"total":17.5,"caster":17.5},"hall":{"peak":332,"casters":13,"total":14.2,"caster":26.9}},"high":{"orbit":{"peak":195,"casters":5,"total":9.9,"caster":13.2},"walk":{"peak":155,"casters":2,"total":17.5,"caster":17.5},"hall":{"peak":322,"casters":13,"total":14.5,"caster":26.9}}} (peak mass; worst one-frame change, % of the peak: total / single caster) |
| C16 | carried-light casters are capped per light and ranked by the light reaching them: settled, at most the cap; while the beam swings, a caster leaving the cap fades out (never more than twice the cap) | **PASS** | {"low":{"at":[7850,1700],"cand":8,"pen":2,"cap":4,"swingPen":5,"props":0,"propCap":3,"swingProps":0},"medium":{"at":[7850,1700],"cand":8,"pen":3,"cap":8,"swingPen":6,"props":0,"propCap":6,"swingProps":0},"high":{"at":[7850,1700],"cand":8,"pen":3,"cap":12,"swingPen":6,"props":0,"propCap":10,"swingProps":0}} |
| C17 | light textures are the overlay's own light (sat-mapped): the lamp gradient, each equipment's glow + nested arcs, placed at the light and turned with the aim | **PASS** | {"lamp":0.002,"flashlight":{"worst":0.002,"nonzeroWhereNoLight":0},"headlamp":{"worst":0.002,"nonzeroWhereNoLight":0},"lantern":{"worst":0.002,"nonzeroWhereNoLight":0}} (largest \|texel - overlay formula at that texel\|, 8-bit texture) |
| C18 | a carried light's shadows take away only that light: zero outside its beam and range, strongest on the axis | **PASS** | samples in the beam 105 (max alpha 0.224), outside it 218 (any shadow there: 0) |
| C19 | bounded work: in steady state the ray queries per frame stay under a ceiling computed from the tier caps alone (never from the map), and at most `builds` lamp caches are built per frame | **PASS** | {"low":{"worstRayQueriesPerFrame":24,"ceiling":136,"at":[7860,1150],"lampBuildsPerFrameMax":1,"builds":1},"medium":{"worstRayQueriesPerFrame":25,"ceiling":768,"at":[3545,3422],"lampBuildsPerFrameMax":1,"builds":1},"high":{"worstRayQueriesPerFrame":30,"ceiling":2040,"at":[3545,3422],"lampBuildsPerFrameMax":2,"builds":2}} (entity shadows are capped separately, S09) |

## Browser checks — `node dev/shadows/browser_shadows.js` (real client, shipped `node server.js`): **9/9 PASS**

| id | check | result | measured |
|---|---|---|---|
| B01 | the module loads from assets/, attaches right above the carpet, and adds no page or console error | **PASS** | version shadows-2d 1.0, quality medium, layer 1, errors [], 404s ["/camera_policy.js","/timing_policy.js"] |
| B02 | the darkness overlay is byte-identical at OFF / LOW / MEDIUM / HIGH (lamps on and in a blackout) | **PASS** | lit off:e5507431 low:e5507431 medium:e5507431 high:e5507431 off:e5507431 · blackout off:148b5f85 low:148b5f85 medium:148b5f85 high:148b5f85 off:148b5f85 (staged: {"h":0,"s":0}) |
| B03 | hound / smiler / player views are untouched at every quality (position, alpha, tint, visibility) | **PASS** | 129 creature views compared over 10 captures; hound 414,3608, smiler 1320,3912 |
| B07 | Smiler concealment: no shadow is drawn for a smiler at any quality, lit or blackout | **PASS** | smilers in view 1; entity shadows drawn 1 |
| B04 | the network is untouched: the client sends the same messages with shadows OFF and HIGH | **PASS** | 8 / 8 messages, distinct 1 / 1 |
| B09 | WebGL draws the light-weighted cast shadows: the floor in a prop's shadow inside the beam darkens at HIGH and comes back at OFF; the lit floor before the prop does not change | **PASS** | [{"q":"off","inShadow":39.79,"beforeProp":31.13},{"q":"high","inShadow":29.11,"beforeProp":31.13},{"q":"off","inShadow":39.79,"beforeProp":31.13}] |
| B06 | the shadow debug view is admin-only: it appears with DEBUG MODE, disappears without it, and a non-admin never gets it | **PASS** | before false, debug-on button true, canvas true, bob false, after false |
| B05 | SETTINGS > CUSTOMIZE > SHADOWS switches quality and is remembered on this device (reload keeps it; another device keeps its own) | **PASS** | buttons ["off","low","medium","high"], after click ["low","low"], other device medium, after reload low |
| B08 | no page error, console error or module warning on any of the three clients | **PASS** | [] |

## Retained v23.3.6 gameplay suites — final tree vs the immutable parent

`python3 dev/shadows/run_retained.py run` ran the unmodified v23.3.6 suites on the final tree; `compare` checked each suite against the SH0 baseline of the parent (`evidence/sh0/retained-parent/`): same verdict, same counts, same set of failing assertion names, same error messages. The parent has known failures of its own (npm-test 151/162, browser-play, browser-light 13/15, browser-admin 54/56, the two descriptive suites); a candidate must reproduce them exactly and fail nothing new.

**19 of 21 suites reproduce the baseline exactly.** The two others are diagnosed below.

| suite | baseline | candidate | same verdict | same counts | same failing set | same error messages |
|---|---|---|---|---|---|---|
| server-boot | PASS 1/1 | PASS 1/1 | yes | yes | yes | yes |
| npm-test | FAIL 151/162 | FAIL 151/162 | yes | yes | yes | yes |
| humanqa | PASS 6/6 | PASS 6/6 | yes | yes | yes | yes |
| entity-look | PASS 4/4 | PASS 4/4 | yes | yes | yes | yes |
| camera | PASS 12/12 | PASS 12/12 | yes | yes | yes | yes |
| fps | PASS 10/10 | PASS 10/10 | yes | yes | yes | yes |
| physics | PASS 53/53 | PASS 53/53 | yes | yes | yes | yes |
| interpolation | PASS 3/3 | PASS 3/3 | yes | yes | yes | yes |
| live | PASS 17/17 | PASS 17/17 | yes | yes | yes | yes |
| audit-net | PASS 17/17 | PASS 17/17 | yes | yes | yes | yes |
| audit-net2 | PASS 11/11 | PASS 11/11 | yes | yes | yes | yes |
| ir-net | PASS 4/4 | PASS 4/4 | yes | yes | yes | yes |
| browser-move | PASS 14/14 | PASS 14/14 | yes | yes | yes | yes |
| browser-play | FAIL 0/1 | FAIL 0/1 | yes | yes | yes | yes |
| browser-light | FAIL 13/15 | FAIL 13/15 | yes | yes | yes | yes |
| browser-ir | PASS 1/1 | BLOCKED None/None | **NO** | **NO** | yes | yes |
| browser-admin | FAIL 54/56 | FAIL 52/56 | yes | **NO** | **NO** | yes |
| browser-lifecycle | PASS 1/1 | PASS 1/1 | yes | yes | yes | yes |
| browser-smiler2d | PASS 2/2 | PASS 2/2 | yes | yes | yes | yes |
| browser-chase | FAIL 0/1 | FAIL 0/1 | yes | yes | yes | yes |
| browser-nav | FAIL 0/1 | FAIL 0/1 | yes | yes | yes | yes |

**Differences:**
- browser-ir: baseline PASS 1/1 [] [] vs candidate BLOCKED None/None [] []
- browser-admin: baseline FAIL 54/56 ['T10 no script errors on either page', 'T8 debug mode: overlay on, entity data, server timings, event log and ping arrive'] ['Failed to load resource: the server responded with a status of # (Not Found)'] vs candidate FAIL 52/56 ['T10 no script errors on either page', "T5 hound A: the death starts on the victim's screen with the variant asked for", 'T5 hound A: the other player sees the same death replay', 'T8 debug mode: overlay on, entity data, server timings, event log and ping arrive'] ['Failed to load resource: the server responded with a status of # (Not Found)']

### The two differences, diagnosed: not the module

The container was restarted during the SH3 work, after SH2 was pushed, and the same work has run slower since. The SH0 baseline, SH1 and SH2 ran before the restart. Since then the same suites take longer: npm-test 284 s (SH2, before the restart: 224 s), and the **parent's own** browser-ir 361 s (SH0: 218 s).

Both differing suites were therefore run again after the restart, back to back, alternating a pristine export of the parent `f2805bb` and the final tree. The suites are unchanged; only the runner's own safety deadlines were multiplied by 3 (`--timeout-scale 3`, recorded in each run's metadata). Each run records which export it used (`meta.game`), and `retained-diag/EXPORTS.txt` shows the two exports were exactly `f2805bb` and the SH3 commit. Evidence: `dev/shadows/evidence/sh4/retained-diag/`.

| run | suite | verdict | passed / total | seconds | failing assertions |
|---|---|---|---|---|---|
| SH0 baseline: parent, before the restart | browser-ir | PASS | 1 / 1 | 218 | — |
| SH0 baseline: parent, before the restart | browser-admin | FAIL | 54 / 56 | 228 | exactly the baseline's: T8, T10 |
| SH4 main run: final tree, default deadlines | browser-ir | BLOCKED | — / — | 400 | runner safety deadline 400s reached |
| SH4 main run: final tree, default deadlines | browser-admin | FAIL | 52 / 56 | 287 | the baseline's T8, T10 + 2 more (T5 ×2), the first: “T5 hound A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 1: parent (`parent-1`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 361 | — |
| same machine, run 1: parent (`parent-1`), deadlines ×3 | browser-admin | FAIL | 37 / 56 | 496 | the baseline's T8, T10 + 17 more (T5 ×16, T6 ×1), the first: “T5 hound C: the death starts on the victim's screen with the variant asked for” |
| same machine, run 2: final tree (`final-1`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 384 | — |
| same machine, run 2: final tree (`final-1`), deadlines ×3 | browser-admin | FAIL | 54 / 56 | 298 | exactly the baseline's: T8, T10 |
| same machine, run 3: parent (`parent-2`), deadlines ×3 | browser-admin | FAIL | 50 / 56 | 337 | the baseline's T8, T10 + 4 more (T5 ×4), the first: “T5 smiler A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 4: final tree (`final-2`), deadlines ×3 | browser-admin | FAIL | 40 / 56 | 430 | the baseline's T8, T10 + 14 more (T5 ×13, T6 ×1), the first: “T5 hound C: the death starts on the victim's screen with the variant asked for” |

- **browser-ir** passes on both trees on this machine (parent 361 s, final tree 384 s). In the main run the suite was stopped by the runner's own 400 s safety deadline, which is not part of the suite. It was not a failed assertion.
- **browser-admin**: its T5 death-preview sequence is timing-sensitive on this machine. When one preview does not start within the suite's 9 s window, that preview fails, and the next ones then see the previous death and fail in a cascade (T5, then T6). **The parent itself** failed 17 and 4 extra assertions in its two runs here; the final tree failed 0 and 14 in its two, and 2 in the main run. Every extra failure, on either tree, is T5 or T6. In run 2 the final tree reproduced the baseline exactly (54/56, the parent's own T8 and T10).
- **Verdict:** no difference attributable to the shadow module. The suites that decide gameplay (movement, physics, camera, FPS independence, interpolation, AI, networking) are identical, and several of their logs are byte-identical (below).

### Logs compared with the parent's byte for byte (`dev/shadows/log_identity.py`)

`byte-identical` is the whole file. The other levels strip per-test durations, or compare only the PASS / FAIL lines. A browser suite that prints a single JSON line with timings and positions always reads `differs` here; the comparison above decides those.

```
audit-net          PASS/FAIL lines identical  (17 result lines)
audit-net2         PASS/FAIL lines identical  (11 result lines)
browser-admin      differs  (47 of 59 lines equal after removing durations)
browser-chase      differs  (0 of 1 lines equal after removing durations)
browser-ir         differs  (0 of 1 lines equal after removing durations)
browser-lifecycle  differs  (0 of 1 lines equal after removing durations)
browser-light      differs  (18 of 24 lines equal after removing durations)
browser-move       byte-identical
browser-nav        differs  (0 of 1 lines equal after removing durations)
browser-play       differs  (0 of 1 lines equal after removing durations)
browser-smiler2d   PASS/FAIL lines identical  (2 result lines)
camera             byte-identical
entity-look        identical except timings
fps                byte-identical
humanqa            identical except timings
interpolation      byte-identical
ir-net             byte-identical
live               PASS/FAIL lines identical  (17 result lines)
npm-test           PASS/FAIL lines identical  (162 result lines)
physics            byte-identical
server-boot        PASS/FAIL lines identical  (1 result lines)

summary: 7 differs, 6 PASS/FAIL lines identical, 6 byte-identical, 2 identical except timings
```

The verdict comparison was run at every checkpoint: SH1 and SH2 reproduced all 21 suites exactly (before the restart), then SH4 as above. `log_identity.py` gives the same levels for the SH1 and SH2 logs as for SH4's (`sh4/retained/log_identity_sh1.txt`, `log_identity_sh2.txt`). The evidence is in `dev/shadows/evidence/sh1/retained/`, `sh2/retained/` and `sh4/retained*`.

## Gameplay freeze

`python3 dev/shadows/freeze.py verify` against the SH0 manifest of every parent file:

```
candidate {'dir': '<SH4 staged tree export>'}: 229/230 parent files byte-identical; 1 changed; 0 removed; 252 added
IDENTICAL ai.js
IDENTICAL sim.js
IDENTICAL move.js
IDENTICAL server.js
IDENTICAL mp.js
IDENTICAL death_srv.js
IDENTICAL dphys.js
IDENTICAL camera_policy.js
CHANGED [presentation] index.html
FREEZE OK
```

## Reproduce

```
git archive f2805bb904c158df17c5c75c3d0d4681049bc246 | tar -x -C /tmp/parent
node dev/shadows/test_shadows.js
node dev/shadows/browser_shadows.js --game .
python3 dev/shadows/run_retained.py run --game . --out /tmp/retained-final
python3 dev/shadows/run_retained.py compare --base dev/shadows/evidence/sh0/retained-parent/retained.json --cand /tmp/retained-final/retained.json
python3 dev/shadows/run_retained.py run --game /tmp/parent --out /tmp/parent-diag --only browser-admin,browser-ir --timeout-scale 3
python3 dev/shadows/log_identity.py dev/shadows/evidence/sh0/retained-parent /tmp/retained-final
python3 dev/shadows/freeze.py verify --manifest dev/shadows/evidence/sh0/parent_manifest.json --rev HEAD
```
