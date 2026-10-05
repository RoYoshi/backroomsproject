# SH0 — immutable parent / baseline freeze

Stage: **THE FAR BACKROOMS — 2D LIGHTING & SHADOWS VISUAL PASS ONLY**. SH0 contains no implementation: tooling and evidence only.

## Parent and branch

| item | value |
|---|---|
| repository | `RoYoshi/backroomsproject` |
| immutable parent | `f2805bb904c158df17c5c75c3d0d4681049bc246` (`v23.3.6`, package `23.3.6-hqa-search-polish`) |
| parent tree | `8cc77595fe6e88c425e2f8abd243f3463af44a18` |
| verified | commit and tree match the pack exactly: **True** (local `git rev-parse`; GitHub API before branching) |
| branch | `lighting-shadows-2d` — did not exist on GitHub (API 404) before this stage; created from exactly the parent |
| `main` | not touched |

## Gameplay freeze manifest

`parent_manifest.json`: every tracked file of the parent (230 files) with git mode, blob id, SHA-256, size and protection class
(docs 26, frozen 194, mixed 1, presentation 1, protected 8).
`dev/shadows/freeze.py verify` compares any later revision or extracted package with it and fails on any change to a protected or frozen file.

Special-protection files and the other files this stage must keep in view:

| file | class | git blob | SHA-256 | bytes |
|---|---|---|---|---|
| `ai.js` | protected | `0b76d2b279125e8b0237fd79ccf404bb4339cdae` | `3fc194703a09e27e572f015eaf5465e1582a50df197e20ec45ff23bec4ad1731` | 206697 |
| `assets/index-DKbV5Nv9.js` | frozen | `944994903536160326418a65557d06864c3b02d0` | `f9b7d1a525b9b2b9e80d6152d2e45e8f4f2305364a2bcdf11754f8da8dded06f` | 329567 |
| `camera_policy.js` | protected | `f6600cc2b3afa453c439d1f3d35c016bfe12de80` | `4572e5cac1ba29c4398d71b30133ac677cc961290d28e875a68da0be48c3cf88` | 1976 |
| `death_srv.js` | protected | `b99fe3e0b1f74d5f73b903a2b27832209a04d8ff` | `a930d71cf4dced9e269ca4b14390398e2ea726646ef9a24116736a0875f5df90` | 2891 |
| `dphys.js` | protected | `61b63da44ce7948526a900a2a3b947eaff117f04` | `631e32d14e817545c505a27ec47e9b32d81fcbd63429341050ffd1b004a1e815` | 37734 |
| `ents.js` | frozen | `9b8ad72ec82dd724a3008fc462ee80ba0164d63c` | `0299d77769588f8b3a6b02c1c27af27cbac54e5f52c1815077e87980256bfc28` | 75640 |
| `hud.js` | frozen | `eecf486f344f9481349fe4805e2d7e427372027e` | `11e71745201a84c21eb51173197c9fc63ee486972412beb574cc1cdc42f6586d` | 10642 |
| `index.html` | presentation | `007e0b564c9efe0f03072479bc1d839eb2941a5f` | `62051f3cd6283056f994523f9c28b689768e58175be6a42a31b289c74e12342a` | 8949 |
| `light.js` | frozen | `0511277e61842e9f6e7cf54452f400c581345b48` | `ca2b6f7afa20473ffb6f0a3af82e2f301368b87026ba99a62911fb1f247bc072` | 5624 |
| `move.js` | protected | `48f4b179e22c481aa90ec0ffe87ef344b9212235` | `5d415dfde394f9c2482dcfb48ff4e36706abf7396da92ae93c45d0a2fab7394d` | 22025 |
| `mp.js` | protected | `001ce04249cb4fbde1ac7c31ee8b484a72ce8e49` | `8bcbfb0357e4a0a1d53b73c693ba6281766ae49488c88efacf6986b6df6c6e61` | 72712 |
| `package.json` | frozen | `cc45e7b22c6dcbdb5845337732ade57646adf87a` | `06dbee5d4e731a8b6e2c165043c55cc52f98f92f38035b4c62e1d89ec9b55b22` | 505 |
| `server.js` | protected | `32a0fc97e3d4f96d5efb5d0d26c01252fa25fe03` | `e23359644f3078abc9a8a1fa993807d9174e3cc352c0f135dc39ebd126b8aec1` | 30299 |
| `sim.js` | protected | `f5ada5da6d8e389203f7b77d5d2bbef7955d6598` | `1c96653dbf51c535c05fe8ba2536c567f5fc9881c2777a5a6ef5e6307867f321` | 28580 |
| `timing_policy.js` | frozen | `c170518a51f4e0fce80a498ec7128bf29f6ac1fa` | `f1d1bb25cc6de53e7d4de2ac7103565e023fa10f8dfcfcdef26b22b155471069` | 1634 |
| `world.js` | mixed | `0870bae479cee4ef163b37088ac311c029372023` | `ec179a5b385dcf8752a22816a7168f6a09c1764617a8a9cda831a2d05fabbb5d` | 18770 |

## Baseline retained suites (pristine `git archive` of the parent)

Run: node v22.22.2, Python 3.11.15, Playwright 1.56.0, 2 vCPU, Linux-6.18.44-fc-v70-x86_64-with-glibc2.39; 2026-10-05T03:20:14Z → 2026-10-05T03:42:41Z

| suite | covers | result | counts | failing assertions (names) | error messages |
|---|---|---|---|---|---|
| `server-boot` | server boot; which client files the shipped server serves | **PASS** | 1/1 | — | — |
| `npm-test` | default scenario suites: percept, hound, smiler, capture, system, admin, commit, nav, chase, audit, evidence, ir, hound2e, shared2f | **FAIL** | 151/162 | P01 noticing distance: run > walk > crouch (resting hound, corridor); P07 exhausted breathing is audible only close by; P08 memory: the last known position is used, then goes stale; the hound gives up and goes back to roaming; H07 hound state coverage: every state of the framework is reached by emergent play (no scripting of state changes); SM01 light: a light carrier it can see is chased after a wind-up; the same person without a light is watched, not chased; NV09 N a runner through 3+ rooms (real AI): caught every time, no ramming, little touching, no repath storm; C1 losing sight does not erase memory: 3 s after the prey vanishes the hound still has it (confidence, position, heading) and is still after it; C4 noise gives the prey away: a prey that has slipped away quietly and then breaks into a run is re-acquired by ear at once (no new detection wait); C5 silent hiding can succeed, and good decisions beat bad ones: out of sight, going quiet and moving on gets away far more often than hiding right where it lost you; C18 memory eventually decays: when the prey gets away, the hound gives up for a stated reason and its confidence has run out; 2F F22 species physical/canon parameter preservation | — |
| `humanqa` | human-QA hotfix suite | **PASS** | 6/6 | — | — |
| `entity-look` | entity look | **PASS** | 4/4 | — | — |
| `camera` | camera fairness | **PASS** | 12/12 | — | — |
| `fps` | FPS-independent gameplay | **PASS** | 10/10 | — | — |
| `physics` | death physics (dphys.js) | **PASS** | 53/53 | — | — |
| `interpolation` | network snapshot interpolation (mp.js, extracted verbatim) | **PASS** | 3/3 | — | — |
| `live` | server boot + real WebSocket protocol, kill flow, admin gating | **PASS** | 17/17 | — | — |
| `audit-net` | networking audit remediation | **PASS** | 17/17 | — | — |
| `audit-net2` | networking exploit sequences | **PASS** | 11/11 | — | — |
| `ir-net` | IR on the wire | **PASS** | 4/4 | — | — |
| `browser-move` | movement in the real client (move.js through the shipped page) | **PASS** | 14/14 | — | — |
| `browser-play` | ordinary player moves; server never corrects | **FAIL** | 0/1 | ok | Failed to load resource: the server responded with a status of # (Not Found) |
| `browser-light` | entity visibility vs lighting in the real client | **FAIL** | 13/15 | ...and its shade changes smoothly (no per-frame pop); no runtime errors (both clients) | Failed to load resource: the server responded with a status of # (Not Found) |
| `browser-ir` | IR / darkness layer measured on the #light canvas | **PASS** | 1/1 | — | — |
| `browser-admin` | admin panel / death preview / pause | **FAIL** | 54/56 | T8 debug mode: overlay on, entity data, server timings, event log and ping arrive; T10 no script errors on either page | Failed to load resource: the server responded with a status of # (Not Found) |
| `browser-lifecycle` | lifecycle buttons for an ordinary player | **PASS** | 1/1 | — | — |
| `browser-smiler2d` | Smiler 2D presentation + debug feed | **PASS** | 2/2 | — | — |
| `browser-chase` | search/crawl debug layers, a hunt (descriptive) | **FAIL** | 0/1 | page errors: Failed to load resource: the server responded with a status of # (Not Found) | Failed to load resource: the server responded with a status of # (Not Found) |
| `browser-nav` | navigation overlay, remote hound drawing (descriptive) | **FAIL** | 0/1 | page errors: Failed to load resource: the server responded with a status of # (Not Found) | Failed to load resource: the server responded with a status of # (Not Found) |


Determinism check: `npm-test` re-run on the same pristine parent (`retained-parent-rerun/`) printed **identical PASS/FAIL lines** (151/162, same 11 names); only wall-clock timing notes differ.

## Pre-existing conditions recorded at the parent (not repaired — out of scope, protected files)

1. **The shipped server does not serve `camera_policy.js` or `timing_policy.js`.** `server.js` whitelists client files with a fixed regex that omits both; `index.html` requests them, they 404, and the bundle runs its built-in fallbacks (`__cameraPolicy` absent → camera scale `innerWidth<700 ? .85 : 1.18`; `window.TFB_TIMING` absent → the bundle's own 60 Hz fixed-step constants). This is the build the user replayed through `node server.js` / `run_linux.sh` / `run_windows.bat` and approved. Both 404s appear as console errors, which is why `browser-play`, `browser-light` ("no runtime errors"), `browser-admin` T10, `browser-chase` and `browser-nav` are red here. Consequence for this stage: the shadow module must live where the server already serves files (`assets/`), so `server.js` stays byte-identical.
2. **Headless software rendering runs the real client at ~1–4 fps** (SwiftShader, 2 vCPU). `browser-play` (server/client gap 130 px vs <80 at 4 fps), `browser-admin` T8 (debug ping ~880 ms) and `browser-light` ("shade changes smoothly", largest per-frame step at 4 fps) fail for this environmental reason at the parent.
3. **Historical scenario reds at the parent:** P01, P07, P08, H07, SM01, NV09, C1, C4, C5, C18, F22 (deterministic, see above).
4. Informational: `light.js` `sample()` gives every lamp `.43 × flicker`, while the overlay (`drawLight`) dims lamps with index % 13 == 0 and applies the camcorder's NV lamp gain. Presentation only; recorded so shadow intensity follows what the overlay actually draws.

## Baseline scene captures (`scene_bench.js` on the pristine parent; shipped `node server.js`)

Run: v23.3.6 parent f2805bb (pristine git archive); Chromium 141.0.7390.37; node v22.22.2; 4 s per scene; renderer ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)

| profile | scene | tier | fps | rAF CPU ms/frame mean (p95) | frame interval ms p50 / p95 | WebGL draws/frame | 2D calls/frame | CDP script ms/frame | shadow build ms mean / p95 / max | lights | casters cand/active | primitives | screenshot |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 16x9 | room | baseline | 4.25 | 3.32 (5.50) | 249.9 / 266.8 | 8.0 | 60.0 | 3.97 | — | — | — | — | `16x9-room-baseline.jpg` |
| 16x9 | props | baseline | 3.75 | 3.97 (9.00) | 266.7 / 316.6 | 8.0 | 60.0 | 5.10 | — | — | — | — | `16x9-props-baseline.jpg` |
| 16x9 | dense | baseline | 4.00 | 2.68 (3.20) | 266.6 / 283.2 | 8.0 | 58.0 | 3.50 | — | — | — | — | `16x9-dense-baseline.jpg` |
| 16x9 | sweep | baseline | 3.75 | 2.91 (4.90) | 283.3 / 300.0 | 8.0 | 58.0 | 4.17 | — | — | — | — | `16x9-sweep-baseline.jpg` |
| 16x9 | peers | baseline | 3.75 | 5.11 (7.80) | 266.6 / 300.0 | 14.0 | 141.0 | 5.80 | — | — | — | — | `16x9-peers-baseline.jpg` |
| 16x9 | blackout | baseline | 4.50 | 2.87 (5.40) | 233.3 / 250.0 | 8.0 | 46.0 | 3.48 | — | — | — | — | `16x9-blackout-baseline.jpg` |
| 16x9 | flicker | baseline | 4.00 | 2.81 (2.90) | 250.0 / 266.7 | 8.0 | 54.0 | 3.49 | — | — | — | — | `16x9-flicker-baseline.jpg` |
| 16x9 | entities | baseline | 4.00 | 5.74 (8.80) | 250.0 / 300.0 | 14.0 | 74.0 | 7.11 | — | — | — | — | `16x9-entities-baseline.jpg` |
| hidpi | room | baseline | 1.00 | 6.25 (8.90) | 1350.0 / 1516.5 | 10.0 | 51.0 | 10.34 | — | — | — | — | `hidpi-room-baseline.jpg` |
| hidpi | sweep | baseline | 1.00 | 7.55 (9.90) | 1299.9 / 1516.7 | 10.0 | 51.0 | 12.72 | — | — | — | — | `hidpi-sweep-baseline.jpg` |
| hidpi | peers | baseline | 0.75 | 9.60 (13.40) | 1449.9 / 1449.9 | 16.0 | 132.0 | 18.28 | — | — | — | — | `hidpi-peers-baseline.jpg` |
| mobile | room | baseline | 3.00 | 3.20 (4.50) | 333.3 / 416.7 | 8.0 | 60.0 | 6.71 | — | — | — | — | `mobile-room-baseline.jpg` |
| mobile | sweep | baseline | 3.25 | 3.81 (5.70) | 316.7 / 349.9 | 8.0 | 58.0 | 4.48 | — | — | — | — | `mobile-sweep-baseline.jpg` |
| mobile | peers | baseline | 2.75 | 4.55 (6.50) | 366.7 / 433.3 | 14.0 | 141.0 | 6.12 | — | — | — | — | `mobile-peers-baseline.jpg` |
| 16x9 | entities | baseline | 3.75 | 7.15 (12.10) | 266.7 / 316.7 | 14.0 | 66.0 | 8.87 | — | — | — | — | `16x9-entities-baseline.jpg` |


The second `entities` row (`bench-parent-entities/`) uses the reworked placement (wanderer ~230 px from a placed hound, god mode); the first is kept as recorded. Where the bench page requested files the server 404s: only `/camera_policy.js` and `/timing_policy.js` (item 1). Frame rates are SwiftShader software rendering on a 2-vCPU container: evidence for relative cost, not hardware certification.

## Next

SH1 (static/contact grounding) starts only after this commit is pushed and its remote SHA/tree are verified.
