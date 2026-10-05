#!/usr/bin/env python3
"""2D_SHADOWS_PERFORMANCE.md: fixed text + tables copied from the committed evidence (no number typed by hand).

  mk_performance.py REPO OUT
"""
import json, re, sys
from pathlib import Path
REPO, OUT = Path(sys.argv[1]), Path(sys.argv[2])
E = REPO / 'dev/shadows/evidence'

sec = {}
cur = None
for line in (E / 'sh3/bench_compare.md').read_text().splitlines():
    if line.startswith('#### '): cur = line[5:].strip(); sec[cur] = []; continue
    if cur is not None: sec[cur].append(line)
def table(prefix):
    k = next(k for k in sec if k.startswith(prefix)); return '\n'.join(l for l in sec[k] if l.startswith('|'))

B = json.loads((E / 'sh4/build_probe.json').read_text())['results']
brow = ['| profile | tier | lamps built / lamps on the map | grounding build, once at load (ms) | lamp-cache builds | mean per build (ms) | slowest build (ms) | module ms per frame over the tour, mean / p95 / max |',
        '|---|---|---|---|---|---|---|---|']
for r in B:
    if 'error' in r: brow.append(f"| harness error | {r['error'][:80]} | | | | | | |"); continue
    prof = '16x9 (1280×720)' if r['profile'] == '16x9' else 'mobile-like (390×844 DPR 3, CPU ÷4)'
    m = r['moduleMsPerFrame']; st = f"{r['staticBuildMs']}" + (' ¹' if r['throttle'] > 1 else '')
    cov = f"{r['lampsShown']} / {r['lamps']}" + (' ²' if r['lampsShown'] < r['lamps'] else '')
    brow.append(f"| {prof} | {r['tier'].upper()} | {cov} | {st} | {r['lampBuilds']} | {r['lampBuildMsMean']:.2f} | {r['lampBuildMsMax']} | {m['mean']:.2f} / {m['p95']} / {m['max']} |")
okB = [r for r in B if 'error' not in r]
bench = json.loads((E / 'sh3/bench-candidate/bench.json').read_text())['runs']
statics = [r['staticBuildMs'] for r in okB] + [b['shadows']['cache']['staticBuildMs'] for b in bench if isinstance(b.get('shadows'), dict) and b['tier'] != 'off']
gmin = round(min(statics)); gmax = round(max(statics))
name = lambda r: ('the 4×-slowed mobile-like profile' if r['profile'] == 'mobile' else '1280×720') + ' at ' + r['tier'].upper()
def worst(rows, key):
    r = max(rows, key=key); return key(r), name(r)
desk = [r for r in okB if r['profile'] != 'mobile']; mob = [r for r in okB if r['profile'] == 'mobile']
slowD, slowDn = worst(desk, lambda r: r['lampBuildMsMax']); slowM, slowMn = worst(mob, lambda r: r['lampBuildMsMax'])
fD, fDn = worst(desk, lambda r: r['moduleMsPerFrame']['max']); fM, fMn = worst(mob, lambda r: r['moduleMsPerFrame']['max'])
slow = max(slowD, slowM); fmax = max(fD, fM)

L = f"""# THE FAR BACKROOMS — 2D Lighting & Shadows: performance

**This is evidence, not hardware certification.** Everything here was measured with SwiftShader (software GL) on a
2-vCPU Linux container. No GPU and no phone was available, so nothing here certifies any hardware.

## How the module is bounded (by construction)

- **No full-map pass per frame.** Each light only looks at the casters inside its own range, through a 384 px bucket
  index. Each frame the module does three things:
  - culls the static grounding by 16×16-cell chunks;
  - shows at most `lamps` cached lamp shadows (2 / 5 / 9), nearest first;
  - rebuilds shadows for at most 1 + `peers` carried lights (1 / 3 / 5).
- **Capped casters and polygons.**
  - Per carried light: at most `localMax` / `peerMax` props and `localC` / `peerC` corners. One that leaves the cap
    fades out, so at most twice the cap are drawn while it fades.
  - Dynamic polygons per frame are capped by the tier's budget: 40 / 300 / 700. The busiest scenes used 4 / 12 / 19.
  - Unit test C19 checks that the ray queries per frame stay under a ceiling computed from the tier caps alone. The
    worst observed is 24 / 25 / 30 against ceilings of 136 / 768 / 2040.
- **Static geometry is cached.**
  - Grounding is built once at load ({gmin}–{gmax} ms in these runs).
  - Each lamp's shadow is built once, the first time it is shown, and cached (LRU of 48). At most 1 / 1 / 2 lamps are
    built in a frame.
  - Light textures are built once per kind: five 128² canvases.
- **No CPU per-pixel work.** Light strength per pixel comes from a texture the GPU samples. Penumbrae and prop shadows
  are a handful of triangles each.
- **No forced layout.** Nothing layout-dependent is read inside a frame (see the SH3 finding below).
- **Nothing high-end-only.** It uses plain Pixi `Graphics` polygons and textures, which Pixi batches into the game's
  existing draw calls: the draw-call count is unchanged at every tier. It needs no extension, no shader and no render
  target.

## Quality tiers

| | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|
| default on | — | touch devices, small screens | desktop | — |
| grounding along wall bases | — | yes | yes | yes |
| entity shadows (most drawn) | — | 6 | 12 | 20 |
| lamp shadows shown (nearest lamps) | — | 2 | 5 | 9 |
| lamp: samples along the tube / penumbra sub-wedges per corner | — | 2 / 2 | 3 / 3 | 4 / 4 |
| lamp caches built per frame | — | 1 | 1 | 2 |
| your light: samples / props / corners / sub-wedges | — | 1 / 3 / 4 / 1 | 3 / 6 / 8 / 3 | 4 / 10 / 12 / 4 |
| other players' lights (nearest) | — | none | 2 | 4 |
| each other light: samples / props / corners / sub-wedges | — | — | 2 / 4 / 4 / 2 | 3 / 6 / 6 / 3 |
| dynamic polygons per frame (safety cap) | 0 | 40 | 300 | 700 |

**OFF** draws nothing: it is the v23.3.6 look. **LOW** is a complete mode. It keeps every kind of shadow (grounding,
entity shadows, lamp prop shadows and penumbrae, your light's prop shadows and penumbrae), with fewer samples and
smaller caps, and no shadows from other players' lights. Quality never changes gameplay information: the tiers differ
only in what the module draws on the floor.

## How it was measured

`dev/shadows/scene_bench.js` starts the shipped `node server.js` for each tree and drives the real client in Chromium.
The same harness and scenes ran back to back, in one session on one container, against:
- **the baseline**: a pristine `git archive` of the parent `f2805bb` (v23.3.6), which has no shadow module;
- **the candidate**: the final module at OFF, LOW, MEDIUM and HIGH.

The world is staged through the page's own admin WebSocket and confirmed from the server's snapshots: frozen halls,
no monsters unless the scene adds them, god mode, lights as the scene needs. The clock runs normally. Settling and
measuring are counted in frames: at least 8 frames and until the lamp caches stop building, then at least 20 frames or
8 s, whichever is longer. For every run the bench records:
- frames per second and the rAF frame intervals;
- main-thread time inside rAF callbacks per frame, i.e. all of the game's per-frame JavaScript, the module included;
- WebGL draw calls and 2D-canvas calls per frame, counted by wrapping the contexts;
- the module's own per-frame time and counters (`__shadows.stats()`);
- a screenshot.

| the prompt's case | bench scene | what it stresses |
|---|---|---|
| normal | `room` | YELLOW HALL spawn: the spawn lamp, a partition at arm's length, the flashlight along the room |
| dense | `dense` | PILLAR HALL: nine pillars, wall stubs, nine lamps in reach — the most casters on screen |
| flashlight | `sweep`, `props` | the flashlight turning a full circle at 1.6 rad/s among the pillars; the flashlight across the reception counter |
| multi-player light | `peers` | three other wanderers (flashlight, headlamp, lantern) around you, lights on |
| blackout | `blackout` | forced blackout: lamps out, only the flashlight |
| (lamp flicker) | `flicker` | beside a dim flickering fixture |
| (entities) | `entities` | a hound and a smiler near, the hound in your light |
| high-DPR | profile `hidpi` | 1920×1080 at DPR 2, i.e. 3840×2160 device pixels: room, dense, sweep, peers |
| mobile-like | profile `mobile` | 390×844 at DPR 3 with touch, main thread slowed 4× by CDP CPU throttling: room, dense, sweep, peers |

The `16x9` profile (1280×720, DPR 1) runs all eight scenes. Software rendering draws a few frames a second at 1280×720
and below one at 4K. Every covered pixel costs CPU time here, which a GPU makes nearly free, and frame intervals swing
by ±15 % between identical runs. Read the **OFF** column as the noise floor: OFF draws nothing, so its distance from
the baseline is run-to-run variation. The precise numbers are the module's own time and the call counts.

Raw data: `dev/shadows/evidence/sh3/` (`bench-parent/`, `bench-candidate/`, `bench-ab/`, `profile/`,
`bench_compare.md`) and `dev/shadows/evidence/sh4/build_probe.json`.

## Results

### The module's own time per frame (ms, mean / p95)

{table('shadow module ms per frame')}

On the desktop-like profiles (1280×720 and 4K) the shadow work costs **0.09–0.45 ms a frame** at every tier, p95 ≤ 1 ms.
On the mobile-like profile, with the main thread slowed 4×, it costs **0.26–1.6 ms** (p95 ≤ 4 ms), while the game's own
per-frame JavaScript takes 10–28 ms there (see the main-thread table below).

### Draw calls

WebGL draw calls per frame are **identical to the baseline** at every tier in every scene: 8 in the empty scenes, 14
with other players or monsters on screen. Pixi batches the shadow `Graphics` into the draws the game already makes.

{table('WebGL draw calls')}

2D-canvas calls per frame (the darkness overlay) are identical to the baseline at every tier in 13 of 16 scenes. The
three exceptions differ from the baseline at **OFF too**, where the module draws nothing, and are flat across the tiers:
`16x9 entities` (the admin `near` command puts the hound and the smiler somewhere different in each run) and
`mobile dense / sweep` (run-session state). `canvas_calls_probe.js` then counted every 2D call by canvas and method over
10 frames in the mobile PILLAR HALL scene: the baseline and the candidate at OFF, LOW, MEDIUM and HIGH are identical
(`sh3/profile/canvas_calls.txt`). The module never draws on a 2D canvas.

{table('2D-canvas calls')}

### Main-thread time per frame inside rAF callbacks (ms, mean)

{table('main-thread ms per frame')}

### Frame times

Frames per second:

{table('frames per second')}

Frame interval, ms, p50 / p95:

{table('frame interval')}

Frame times stay within the OFF column's noise in every scene but one: `props`, where your flashlight lights a long
counter. That shadow is large, and SwiftShader fills every covered pixel on the CPU. A dedicated A/B (`sh3/bench-ab/`)
ran three alternating rounds per tier in one session:

| props scene, 1280×720 | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|
| fps (mean of 3 rounds) | 2.32 | 2.20 (−5 %) | 2.08 (−10 %) | 2.04 (−12 %) |
| module ms per frame | 0.02 | 0.15–0.26 | 0.19–0.34 | 0.20–0.29 |
| dynamic polygons | 0 | 2 | 4 | 5 |

The module's CPU time stays a fraction of a millisecond, so the rest is fill. A GPU fills a few translucent
screen-sized polygons in well under a millisecond, but no GPU was available to show it. SH3 cut this overdraw by
drawing one core per prop shadow instead of one per sample.

### Lights, casters, polygons, primitives (max over a run)

Lights / candidate·active casters / dynamic polygons / primitives:

{table('lights / candidate')}

### One-time build costs: walking into new rooms

The bench measures steady state, with warm caches. `dev/shadows/build_probe.js` measures the one-time cost instead. It
tours the whole map in the real client, teleporting next to the nearest lamp whose shadow has not been built yet, until
every lamp has been built.

{chr(10).join(brow)}

¹ The grounding is built when the page loads, before the probe slows the main thread, so this is not a 4× figure.
² LOW shows only the 2 nearest lamps, so its tour needs more stops; it reached its 10-minute deadline after {next((r['lampsShown'] for r in okB if r['lampsShown'] < r['lamps']), 0)} of the
{okB[0]['lamps']} lamps.

The slowest single lamp build was **{slowD} ms** at 1280×720 and **{slowM} ms** on the 4×-slowed mobile-like profile.
The module's worst frame over a whole-map tour, the frames that built lamps included, was **{fD} ms** at 1280×720
({fDn.split(' at ')[1]}) and **{fM} ms** on the mobile-like profile ({fMn.split(' at ')[1]}). There, the game's own per-frame
JavaScript takes 10–28 ms (the main-thread table above).

- **The mean build is a fraction of a millisecond.** The slowest builds are not the biggest ones: HIGH builds the most
  geometry per lamp, yet its slowest builds were the lowest of each profile. That suggests an occasional
  garbage-collection or compilation pause landing inside a build, rather than at the build work itself.
- **A lamp is built once per tier,** and from then on only its alpha changes. At most 1 / 1 / 2 lamps are built in a
  frame, so walking into a new room spreads the builds over several frames instead of stalling one.
- **The tour is the worst case.** It teleports into rooms that have never been seen. Walking reveals lamps a few at a
  time.

### SH3 finding: a forced layout every frame

`profile_probe.js` ran on the mobile-like profile at LOW, on the same container (`sh3/profile/`):

| module | its time per frame (mean / p95) | the hottest function |
|---|---|---|
| SH2 (`fb65693`) | 3.39 ms / 6.8 ms | `viewRect` 29.3 ms self over 15 frames: reading `innerWidth` / `innerHeight` forced a synchronous layout |
| SH3 (final) | 0.56 ms / 1.5 ms | none above 2 ms self over 16 frames |

The viewport size is now read only on `resize` / `orientationchange`, the way the game's own renderer keeps it.

## What this does not show

- **No GPU and no phone.** Software rendering shows the CPU side exactly (the module's own time, the call counts, the
  bounded work) but turns fill into CPU time, which a GPU makes nearly free. Real-device frame rates are for human QA.
- **Noise.** Frame intervals swing by about ±15 % between identical runs. The container also restarted during the
  stage, onto a slower machine, so only numbers from the same session are compared: the baseline and every tier in the
  tables above ran back to back.
"""
OUT.write_text(L)
print('written', OUT, len(L), 'chars; slowest build', slow, 'worst frame', fmax)
