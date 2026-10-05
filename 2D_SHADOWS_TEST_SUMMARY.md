# THE FAR BACKROOMS — 2D Lighting & Shadows: test summary

**Status: `2D LIGHTING & SHADOWS — VISIBILITY CORRECTION ENGINEERING COMPLETE — HUMAN QA PENDING`**

Every result below is generated from the evidence in `dev/shadows/evidence/sh6/` (the final tree) and `sh5/` (the visibility captures) by `dev/shadows/report/mk_test_summary.py`. Nothing is typed by hand. Measured values are copied in full; a `|` inside one is escaped for the table.

## Required by the visibility-correction pack (section 9)

| required by the correction pack | tests | result |
|---|---|---|
| stronger but bounded alpha | V01, V02, V04, V05, V06, V08 | **PASS** |
| finite geometry | S10, C09 | **PASS** |
| smooth flashlight movement | S06, C07, C15 | **PASS** |
| beam / range containment | V02, C18 | **PASS** |
| flicker / blackout | C03, C04, C05, B02 | **PASS** |
| quality ordering | V03, C11, S14 | **PASS** |
| no Smiler shadow | S07, V06, B07 | **PASS** |
| baked-shadow thinning | V07, C12 | **PASS** |
| stable ordering / caps | S11, C10, C16, C08, C19 | **PASS** |
| darkness-overlay identity | B02 | **PASS** |

## Required by the original stage prompt

| required by the stage prompt | tests | result |
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

**Where the unit and browser results come from.** They are the logs in `dev/shadows/evidence/sh5/`. SH6 changed no runtime file, and no test file: `assets/shadows-2d.js` and `index.html` are byte-identical to SH5, and so are the test scripts. The planned SH6 reruns were stopped by instruction before they ran. The SH5 results therefore stand for the final tree, and they were not repeated.

## Unit tests — `node dev/shadows/test_shadows.js`: **43/43 PASS**

The module runs in a Node VM with the real level geometry, ray query, lamp list and equipment light model extracted verbatim from the shipped bundle, the real `light.js` and `world.js`, and a recording mock of the Pixi classes (it keeps polygon arrays by reference and canvas pixels, as Pixi does). V01–V08 are new in SH5: what each shadow class draws, composed as Pixi composes it, with lower bounds (visible) and upper bounds (never near-black).

| id | test | result | measured |
|---|---|---|---|
| S01 | attaches right above the carpet, under the level art; mp hook chained | **PASS** | index 1, mp ret mp-ret |
| S02 | wall adjacency: every wall/floor boundary edge is covered by exactly one grounding strip of the right side | **PASS** | 1492 boundary edges, 483 merged strips (3.09 edges/strip), missing/double 0, stray 0 |
| S03 | grounding strips lie on floor only (never inside a wall cell) and outer corners are closed | **PASS** | 847 quads, 364 corner blobs, samples inside walls 0 |
| S04 | grounding is static (built once) and camera-culled by chunk | **PASS** | chunks 24, visible at spawn [[0,1],[1,1],[0,2],[1,2]], after moving [[4,0],[4,1]], builds 1 |
| S05 | dominant direction: light.js points toward the light; the entity shadow points away from it | **PASS** | sample dir -1.000,0.000 lamp 0.405; shadow {"x":680.34,"y":2832,"sx":79.34,"sy":36.8,"rot":0,"a":0.42} |
| S06 | the local flashlight casts a lit hound's shadow away from the player; rotating the aim off it fades it smoothly (no pop) | **PASS** | start alpha 0.354 end 0.000 max frame step 0.0247 |
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
| C01 | lamp shadows of props fall away from the lamp (every prop-shadow polygon centroid is on the far side of the prop) | **PASS** | 5 lamps, 12 prop-shadow polygons, min dot 3864.8 |
| C02 | lamp wall penumbrae: apex on a convex wall/pillar corner, extend away from the lamp, only where the lamp's light reaches (no double black) | **PASS** | 232 penumbra polygons from 25 lamps; off-corner 0, pointing back 0, over the umbra 0 |
| C03 | lamp flicker: a lamp's shadow strength follows the overlay's own lamp power every frame (failures dim it, never brighter than nominal) | **PASS** | alphas ["1.000","1.000","1.000","1.000","0.531"] failing x.25 ["0.250","0.250","0.250","0.250","0.133"] failed: 0 visible; NV x1.5 ["1.000","1.000","1.000","1.000","0.531"] |
| C04 | dim fixtures (index % 13 == 0) flicker their shadows with the overlay formula .13 + .06·max(0, sin(11t + i)), relative to their brightest state | **PASS** | lamp #0 alpha 0.684..0.999, alpha / formula constant to 0.0e+0 |
| C05 | blackout removes every lamp shadow at once; carried-light shadows stay | **PASS** | lamp layers 5 -> 0; carried prop polys 4 -> 4 |
| C06 | your own light: props cast moving shadows away from the beam | **PASS** | 4 prop polygons, all beyond the prop: true; lights 1 |
| C07 | flashlight rotation: sweeping the aim across a prop changes its shadow smoothly (no frame-to-frame pop) | **PASS** | shadow mass max 30564, ends 5736/17008, worst step 5.5% |
| C08 | caps and culling: lamps <= tier cap and only those in view; dynamic polygons <= budget; peers <= cap | **PASS** | {"low":{"lamps":2,"cap":2,"inView":true,"dyn":0,"budget":40,"lights":3,"lightCap":3},"medium":{"lamps":5,"cap":5,"inView":true,"dyn":5,"budget":300,"lights":8,"lightCap":8},"high":{"lamps":9,"cap":9,"inView":true,"dyn":21,"budget":700,"lights":14,"lightCap":14}} |
| C09 | no NaN / Infinity in any lamp or carried-light polygon, and every polygon owns its point array (Pixi keeps references) | **PASS** | 39987 polygons checked; shared point arrays 0; disabled='' |
| C10 | stable ordering: the same scene and light state build identical lamp and carried geometry | **PASS** | 4 lamp caches, 7 prop + 0 penumbra polygons |
| C11 | LOW / MEDIUM / HIGH: fidelity grows with the tier (lamps, samples, penumbra wedges), LOW keeps every kind of shadow; OFF draws nothing | **PASS** | {"off":{"lamps":0,"lampWalls":0,"lampPolys":0,"props":0,"pen":0,"propPolys":0,"root":false},"low":{"lamps":2,"lampWalls":16,"lampPolys":22,"props":1,"pen":0,"propPolys":2,"root":true},"medium":{"lamps":5,"lampWalls":45,"lampPolys":61,"props":1,"pen":0,"propPolys":4,"root":true},"high":{"lamps":7,"lampWalls":80,"lampPolys":100,"props":1,"pen":0,"propPolys":5,"root":true}} |
| C12 | baked prop shadows are detected: a prop lit from the side of its baked drop shadow gets a thinner dynamic shadow | **PASS** | alpha sum lit from NW (shadow onto the baked side) 0.100 vs from SE 0.195 |
| C13 | other wanderers' lights: bounded, cast prop shadows and pillar penumbrae, never from a dead or switched-off light | **PASS** | lights 1, penumbra polygons 4 (from pillar corners 4), bad 0/0/0, polys 4/300 |
| C14 | your light's penumbrae: from convex corners in the beam, on the lit side of the edge the overlay already cuts, away from you | **PASS** | polygons per scene [8,4,0,4,3]; off-corner 0, pointing back 0, over the umbra 0 |
| C15 | no popping: along an orbit of a pillar, a walk past wall corners and a 10 s run through the pillar hall (sprint speed, light swinging), no caster's shadow jumps by a third of its own peak in one frame (LOW / MEDIUM / HIGH) | **PASS** | {"low":{"orbit":{"peak":794,"casters":5,"total":10.4,"caster":13.7},"walk":{"peak":661,"casters":2,"total":16.6,"caster":16.6},"hall":{"peak":1312,"casters":12,"total":10.8,"caster":28}},"medium":{"orbit":{"peak":641,"casters":5,"total":10.2,"caster":13.5},"walk":{"peak":519,"casters":2,"total":17.1,"caster":17.1},"hall":{"peak":1076,"casters":13,"total":13.8,"caster":27.1}},"high":{"orbit":{"peak":627,"casters":5,"total":10.2,"caster":13.5},"walk":{"peak":508,"casters":2,"total":16.8,"caster":16.8},"hall":{"peak":1053,"casters":13,"total":13.8,"caster":27.2}}} (peak mass; worst one-frame change, % of the peak: total / single caster) |
| C16 | carried-light casters are capped per light and ranked by the light reaching them: settled, at most the cap; while the beam swings, a caster leaving the cap fades out (never more than twice the cap) | **PASS** | {"low":{"at":[7850,1700],"cand":8,"pen":2,"cap":4,"swingPen":5,"props":0,"propCap":3,"swingProps":0},"medium":{"at":[7850,1700],"cand":8,"pen":3,"cap":8,"swingPen":6,"props":0,"propCap":6,"swingProps":0},"high":{"at":[7850,1700],"cand":8,"pen":3,"cap":12,"swingPen":6,"props":0,"propCap":10,"swingProps":0}} |
| C17 | light textures are the overlay's own light (sat-mapped): the lamp gradient, each equipment's glow + nested arcs, placed at the light and turned with the aim | **PASS** | {"lamp":0.002,"flashlight":{"worst":0.002,"nonzeroWhereNoLight":0},"headlamp":{"worst":0.002,"nonzeroWhereNoLight":0},"lantern":{"worst":0.002,"nonzeroWhereNoLight":0}} (largest \|texel - overlay formula at that texel\|, 8-bit texture) |
| C18 | a carried light's shadows take away only that light: zero outside its beam and range, strongest on the axis | **PASS** | samples in the beam 101 (max alpha 0.439), outside it 225 (any shadow there: 0) |
| C19 | bounded work: in steady state the ray queries per frame stay under a ceiling computed from the tier caps alone (never from the map), and at most `builds` lamp caches are built per frame | **PASS** | {"low":{"worstRayQueriesPerFrame":24,"ceiling":136,"at":[7860,1150],"lampBuildsPerFrameMax":1,"builds":1},"medium":{"worstRayQueriesPerFrame":25,"ceiling":768,"at":[3545,3422],"lampBuildsPerFrameMax":1,"builds":1},"high":{"worstRayQueriesPerFrame":30,"ceiling":2040,"at":[3545,3422],"lampBuildsPerFrameMax":2,"builds":2}} (entity shadows are capped separately, S09) |
| V01 | grounding reads at every wall base and fades softly to nothing across its width (no outline): strong at the base, about a third at mid-width, none at the far edge | **PASS** | strip width 50-50 px; base 0.553,0.553, mid-width 0.215,0.224, far edge <= 0.000, corner blobs <= 0.549 |
| V02 | your flashlight across a counter: its shadow is the strongest dynamic cue (removes 50-85 % of the beam behind the counter at MEDIUM), never near-black, nothing outside the beam | **PASS** | behind the counter (150-260 px from you) [0.72,0.711,0.694,0.659]; strongest anywhere 0.726; samples outside the beam 0 |
| V03 | quality changes softness and coverage, not darkness: the same flashlight shadow at LOW / MEDIUM / HIGH is within .1 of MEDIUM, and LOW is clearly visible | **PASS** | {"low":{"at180":0.7,"polys":2},"medium":{"at180":0.711,"polys":4},"high":{"at180":0.712,"polys":5}} |
| V04 | lamp shadows are visible in an ordinary lit room: next to the toppled shelf the lamps take away 35-80 % of their light (restrained, never black) | **PASS** | strongest 0.687, 2253 samples darker than 5 % (mean 0.266), 5 lamps |
| V05 | penumbrae beside a pillar in your beam are visible on the lit side (inner wedge 30-85 %) and never near-black | **PASS** | 6 penumbra polygons, strongest a quarter of the way out 0.430, strongest anywhere along a wedge 0.461 |
| V06 | entity shadows are stronger but stay soft and partial: a hound lit by your flashlight gets alpha .25-.5, the player at most .45; never a Smiler | **PASS** | hound 0.3542, player [], near the smiler 0 |
| V07 | baked-shadow thinning still holds at the new strength: the counter lit from its baked side gets at most ~2/3 of the shadow it gets from the other side | **PASS** | shadow mass lit from the NW (onto the baked side) 16772, from the SE 25171 (ratio 0.67) |
| V08 | the strongest place in the busiest scenes stays partial: everything drawn at one spot (grounding, lamps, your light) never removes more than 85 % of the light | **PASS** | strongest composed darkening per scene (Pillar Hall, counter, shelf under lamps, spawn): [0.548,0.724,0.735,0.599] |

## Browser checks — `node dev/shadows/browser_shadows.js` (real client, shipped `node server.js`): **9/9 PASS**

| id | check | result | measured |
|---|---|---|---|
| B01 | the module loads from assets/, attaches right above the carpet, and adds no page or console error | **PASS** | version shadows-2d 1.1, quality medium, layer 1, errors [], 404s ["/camera_policy.js","/timing_policy.js"] |
| B02 | the darkness overlay is byte-identical at OFF / LOW / MEDIUM / HIGH (lamps on and in a blackout) | **PASS** | lit off:c1410c7f low:c1410c7f medium:c1410c7f high:c1410c7f off:c1410c7f · blackout off:acfa63f6 low:acfa63f6 medium:acfa63f6 high:acfa63f6 off:acfa63f6 (staged: {"h":0,"s":0}) |
| B03 | hound / smiler / player views are untouched at every quality (position, alpha, tint, visibility) | **PASS** | 129 creature views compared over 10 captures; hound 1255,2723, smiler 1080,2424 |
| B07 | Smiler concealment: no shadow is drawn for a smiler at any quality, lit or blackout | **PASS** | smilers in view 1; entity shadows drawn 1 |
| B04 | the network is untouched: the client sends the same messages with shadows OFF and HIGH | **PASS** | 8 / 8 messages, distinct 1 / 1 |
| B09 | WebGL draws the light-weighted cast shadows: the floor in a prop's shadow inside the beam darkens at HIGH and comes back at OFF; the lit floor before the prop does not change | **PASS** | [{"q":"off","inShadow":40.93,"beforeProp":31.13},{"q":"high","inShadow":23.2,"beforeProp":29.79},{"q":"off","inShadow":40.93,"beforeProp":31.13}] |
| B06 | the shadow debug view is admin-only: it appears with DEBUG MODE, disappears without it, and a non-admin never gets it | **PASS** | before false, debug-on button true, canvas true, bob false, after false |
| B05 | SETTINGS > CUSTOMIZE > SHADOWS switches quality and is remembered on this device (reload keeps it; another device keeps its own) | **PASS** | buttons ["off","low","medium","high"], after click ["low","low"], other device medium, after reload low |
| B08 | no page error, console error or module warning on any of the three clients | **PASS** | [] |

## Shadow visibility, SH4 → SH5 (`dev/shadows/evidence/sh5/visibility/`)

The same staged scenes at the same frozen instants, each tier compared pixel by pixel with its own OFF capture (`visibility_metrics.js`). Only pixels the player can see something on count. Each cell is p90 / p99 of the darkening, then the share of lit pixels darkened by at least 10 % / 25 %. These are diagnostics: whether the shadows are noticeable is for human QA.

| scene | SH4 MEDIUM | SH5 LOW | **SH5 MEDIUM** | SH5 HIGH | SH5 strongest pixel (MEDIUM) | darkness overlay across tiers (Δ mean alpha) |
|---|---|---|---|---|---|---|
| room | 0.00 / 0.23 / 2.8 % / 0.8 % | 0.03 / 0.43 / 6.7 % / 3.5 % | **0.04 / 0.43 / 7.4 % / 3.6 %** | 0.04 / 0.43 / 7.4 % / 3.5 % | 0.57 | unchanged |
| props | 0.33 / 0.35 / 41.9 % / 37.5 % | 0.54 / 0.57 / 41.5 % / 41.4 % | **0.55 / 0.58 / 42.1 % / 41.6 %** | 0.55 / 0.58 / 42.3 % / 41.5 % | 0.70 | unchanged |
| shelf | 0.15 / 0.39 / 13.5 % / 3.6 % | 0.27 / 0.61 / 17.6 % / 10.9 % | **0.32 / 0.62 / 22.6 % / 13.8 %** | 0.32 / 0.62 / 22.7 % / 13.8 % | 0.70 | unchanged |
| shelfdark | 0.08 / 0.26 / 8.8 % / 1.3 % | 0.14 / 0.44 / 13.7 % / 5.9 % | **0.23 / 0.44 / 18.1 % / 8.8 %** | 0.23 / 0.44 / 18.2 % / 8.8 % | 0.70 | unchanged |
| pillarlit | 0.00 / 0.08 / 0.8 % / 0.2 % | 0.00 / 0.24 / 2.6 % / 0.9 % | **0.00 / 0.24 / 2.1 % / 1.0 %** | 0.00 / 0.24 / 2.2 % / 1.0 % | 0.57 | unchanged |
| pillarsweep | 0.00 / 0.04 / 0.6 % / 0.2 % | 0.00 / 0.21 / 2.0 % / 0.8 % | **0.00 / 0.22 / 1.8 % / 0.9 %** | 0.00 / 0.21 / 1.8 % / 0.9 % | 0.57 | unchanged |
| damp | 0.00 / 0.29 / 4.9 % / 1.5 % | 0.08 / 0.43 / 8.5 % / 4.2 % | **0.14 / 0.48 / 11.6 % / 6.0 %** | 0.14 / 0.48 / 11.6 % / 6.0 % | 0.57 | unchanged |
| houndbo | 0.06 / 0.46 / 6.2 % / 2.8 % | 0.16 / 0.43 / 14.9 % / 4.2 % | **0.15 / 0.36 / 14.3 % / 3.4 %** | 0.16 / 0.41 / 14.7 % / 3.8 % | 0.81 | unchanged |
| hound | 0.06 / 0.41 / 5.3 % / 2.2 % | 0.09 / 0.39 / 9.1 % / 3.9 % | **0.10 / 0.42 / 10.1 % / 4.5 %** | 0.10 / 0.42 / 10.1 % / 4.6 % | 0.91 | unchanged |

## Retained v23.3.6 gameplay suites — final tree vs the immutable parent

`python3 dev/shadows/run_retained.py run` ran the unmodified v23.3.6 suites on the final tree (the runner's own safety deadlines ×3, recorded in the run's metadata: this machine needs it; see SH4). `compare` checked each suite against the SH0 baseline of the parent (`evidence/sh0/retained-parent/`): same verdict, same counts, same set of failing assertion names, same error messages. The parent has known failures of its own (npm-test 151/162, browser-play, browser-light 13/15, browser-admin 54/56, the two descriptive suites); a candidate must reproduce them exactly and fail nothing new.

**19 of 21 suites reproduce the baseline exactly.** The others (browser-ir, browser-admin) are diagnosed below.

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
| browser-ir | PASS 1/1 | FAIL None/None | **NO** | **NO** | yes | **NO** |
| browser-admin | FAIL 54/56 | FAIL 38/56 | yes | **NO** | **NO** | yes |
| browser-lifecycle | PASS 1/1 | PASS 1/1 | yes | yes | yes | yes |
| browser-smiler2d | PASS 2/2 | PASS 2/2 | yes | yes | yes | yes |
| browser-chase | FAIL 0/1 | FAIL 0/1 | yes | yes | yes | yes |
| browser-nav | FAIL 0/1 | FAIL 0/1 | yes | yes | yes | yes |

**Differences:**
- browser-ir: baseline PASS 1/1 [] [] vs candidate FAIL None/None [] ['ZeroDivisionError: float division by zero']
- browser-admin: baseline FAIL 54/56 ['T10 no script errors on either page', 'T8 debug mode: overlay on, entity data, server timings, event log and ping arrive'] ['Failed to load resource: the server responded with a status of # (Not Found)'] vs candidate FAIL 38/56 ['T10 no script errors on either page', "T5 hound A: the death starts on the victim's screen with the variant asked for", 'T5 hound A: the other player sees the same death replay', "T5 hound C: the death starts on the victim's screen with the variant asked for", 'T5 hound C: the other player sees the same death replay', 'T5 smiler A: auto-revive, then back to where it happened', "T5 smiler A: the death starts on the victim's screen with the variant asked for", 'T5 smiler B: auto-revive, then back to where it happened', "T5 smiler B: the death starts on the victim's screen with the variant asked for", 'T5 smiler B: the other player sees the same death replay', 'T5 smiler C: auto-revive, then back to where it happened', "T5 smiler C: the death starts on the victim's screen with the variant asked for", 'T5 smiler C: the other player sees the same death replay', 'T5 smiler D: auto-revive, then back to where it happened', "T5 smiler D: the death starts on the victim's screen with the variant asked for", 'T5 smiler D: the other player sees the same death replay', 'T6 a preview that cannot be done says why and changes nothing', 'T8 debug mode: overlay on, entity data, server timings, event log and ping arrive'] ['Failed to load resource: the server responded with a status of # (Not Found)']

### The differences, diagnosed on the same machine

Both differing suites were run again on this machine, back to back, alternating a pristine export of the parent `f2805bb` and the final tree, with the suites unchanged (the runner's deadlines ×3, recorded). Each run records which export it used (`meta.game`; `retained-diag/EXPORTS.txt` checks the exports against the commits).

| run | suite | verdict | passed / total | seconds | failing assertions |
|---|---|---|---|---|---|
| SH0 baseline: parent, before the restart | browser-ir | PASS | 1 / 1 | 218 | — |
| SH0 baseline: parent, before the restart | browser-admin | FAIL | 54 / 56 | 228 | exactly the baseline's: T8, T10 |
| SH6 main run: final tree, deadlines ×3 | browser-ir | FAIL | — / — | 268 | no verdict printed: ZeroDivisionError: float division by zero |
| SH6 main run: final tree, deadlines ×3 | browser-admin | FAIL | 38 / 56 | 453 | the baseline's T8, T10 + 16 more (T5 ×15, T6 ×1), the first: “T5 hound A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 1: parent (`parent-1`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 356 | — |
| same machine, run 1: parent (`parent-1`), deadlines ×3 | browser-admin | FAIL | 40 / 56 | 407 | the baseline's T8, T10 + 14 more (T5 ×13, T6 ×1), the first: “T5 hound A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 2: final tree (`final-1`), deadlines ×3 | browser-ir | FAIL | 0 / 1 | 422 | 2 more (R5 ×1, R7 ×1), the first: “R5” |
| same machine, run 2: final tree (`final-1`), deadlines ×3 | browser-admin | FAIL | 42 / 56 | 413 | the baseline's T8, T10 + 12 more (T5 ×11, T6 ×1), the first: “T5 smiler A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 3: parent (`parent-2`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 342 | — |
| same machine, run 3: parent (`parent-2`), deadlines ×3 | browser-admin | FAIL | 54 / 56 | 290 | exactly the baseline's: T8, T10 |
| same machine, run 4: final tree (`final-2`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 406 | — |
| same machine, run 4: final tree (`final-2`), deadlines ×3 | browser-admin | FAIL | 43 / 56 | 418 | the baseline's T8, T10 + 11 more (T5 ×10, T6 ×1), the first: “T5 smiler A: the death starts on the victim's screen with the variant asked for” |
| parent slowed by a calibrated background load (`parent-load-1`), deadlines ×3 | browser-ir | FAIL | 0 / 1 | 443 | 1 more (R7 ×1), the first: “R7” |
| parent slowed by a calibrated background load (`parent-load-2`), deadlines ×3 | browser-ir | FAIL | 0 / 1 | 440 | 1 more (R7 ×1), the first: “R7” |
| parent slowed by a calibrated background load (`parent-load-3`), deadlines ×3 | browser-ir | FAIL | 0 / 1 | 495 | 2 more (R5 ×1, R7 ×1), the first: “R5” |

- **browser-ir**: the main run ended without a verdict (ZeroDivisionError: float division by zero). Same machine, normal speed: parent `parent-1` PASS (356 s), `parent-2` PASS (342 s); final tree `final-1` FAIL R5, R7 (422 s), `final-2` PASS (406 s). Two of its checks depend on how fast frames come: R5 reads the camcorder's overheat lock 0.7 game-seconds after setting the heat, and R7 reads a second player's darkness after fixed real-time waits (`dev/tests/ir_test.py`). In that view (`frame_probe.js`, 1900×900, the suite's own corridor, three alternating rounds) the parent draws 1.30 fps; at MEDIUM SH4 1.15 (−12 %), the final module (SH5, 1.1) 1.16 (−11 %), a reverted lamp-overdraw experiment 1.15 (−12 %). A calibrated one-core background load (`cpu_load.js`) slows the parent from 1.34 to 1.26 fps at 20/100, 1.20 fps at 40/100 (transcribed from console output; the file says so); the loaded suite runs used 45/100. Slowed that way, the **unmodified parent** fails the same checks with the same readings: `parent-load-1` FAIL R7 (443 s), `parent-load-2` FAIL R7 (440 s), `parent-load-3` FAIL R5, R7 (495 s). So the final tree's failures are this suite's sensitivity to frame time under software rendering on this machine, which the shadow module's fill cost reaches, as SH4's did; they are not a gameplay difference.
- **browser-admin**: extra failures beyond the parent's own T8 and T10: main run 16; parent at normal speed `parent-1` 14, `parent-2` 0; final tree `final-1` 12, `final-2` 11. All of them are T5 ×49, T6 ×4. Its T5 death-preview sequence is timing-sensitive on this machine for the parent too: when one preview does not start within the suite's 9 s window, the next ones see the previous death and fail in a cascade (T5, then T6). SH4 found the same (`sh4/retained-diag/`). The parent reproduced its own baseline exactly in `parent-2`; the final tree did not in these runs (at SH4 the final tree did: `sh4/retained-diag/final-1`, 54/56).

- **Verdict:** no gameplay difference found. The suites that decide gameplay (movement, physics, camera, FPS independence, interpolation, AI, networking) reproduce the parent, and several of their logs are byte-identical (below). **One item stays open:** browser-admin's T5 / T6 cascade happened in every final-tree run here and in one of the parent's two. The same timing sensitivity is the likely cause, but this was not proven before the follow-up runs were stopped by instruction; it is listed for human QA on real hardware.

### Logs compared with the parent's byte for byte (`dev/shadows/log_identity.py`)

`byte-identical` is the whole file. The other levels strip per-test durations, or compare only the PASS / FAIL lines. A browser suite that prints a single JSON line with timings and positions always reads `differs` here; the comparison above decides those.

```
audit-net          PASS/FAIL lines identical  (17 result lines)
audit-net2         PASS/FAIL lines identical  (11 result lines)
browser-admin      differs  (32 of 59 lines equal after removing durations)
browser-chase      differs  (0 of 1 lines equal after removing durations)
browser-ir         differs  (0 of 16 lines equal after removing durations)
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

The verdict comparison was run at every checkpoint: SH1 and SH2 reproduced all 21 suites exactly (before the container restart), SH4 19 of 21 with the two others diagnosed as the machine (`sh4/`), and the final tree as above.

## Gameplay freeze

`python3 dev/shadows/freeze.py verify` against the SH0 manifest of every parent file (229 of 230 byte-identical; the one changed file is `index.html`, the SH1 script tag):

```
candidate {'dir': '<SH6 staged tree export>'}: 229/230 parent files byte-identical; 1 changed; 0 removed; 375 added
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
node dev/shadows/shots.js --game . --out /tmp/shots --scenes room,props,shelf,shelfdark,pillarlit,pillarsweep,damp,houndbo,hound
node dev/shadows/visibility_metrics.js /tmp/shots
python3 dev/shadows/run_retained.py run --game . --out /tmp/retained-final --timeout-scale 3
python3 dev/shadows/run_retained.py compare --base dev/shadows/evidence/sh0/retained-parent/retained.json --cand /tmp/retained-final/retained.json
python3 dev/shadows/run_retained.py run --game /tmp/parent --out /tmp/parent-diag --only browser-admin,browser-ir --timeout-scale 3
python3 dev/shadows/log_identity.py dev/shadows/evidence/sh0/retained-parent /tmp/retained-final
python3 dev/shadows/freeze.py verify --manifest dev/shadows/evidence/sh0/parent_manifest.json --rev HEAD
```
