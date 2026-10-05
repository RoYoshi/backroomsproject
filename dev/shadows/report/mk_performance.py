#!/usr/bin/env python3
"""2D_SHADOWS_PERFORMANCE.md: fixed text + tables and figures computed from the committed evidence (no number typed by hand).

  mk_performance.py REPO OUT [STAGE]

STAGE (default sh6) holds the final matrix: bench-parent/, bench-candidate/, bench_compare.md (summarize.py compare),
build_probe.json and, when present, bench-ab/ (repeated rounds of the props scene).  sh5/perf/ holds the repeated
mobile-like A/B and the overlay-tint probe; sh3/ the SH3 profile finding.
"""
import json, re, sys
from pathlib import Path
REPO, OUT = Path(sys.argv[1]), Path(sys.argv[2]); STAGE = sys.argv[3] if len(sys.argv) > 3 else 'sh6'
E = REPO / 'dev/shadows/evidence'; S = E / STAGE
pc = lambda d: f'{d:+.0f}'.replace('-', '−')

sec, cur = {}, None
for line in (S / 'bench_compare.md').read_text().splitlines():
    if line.startswith('#### '): cur = line[5:].strip(); sec[cur] = []; continue
    if cur is not None: sec[cur].append(line)
def table(prefix):
    k = next(k for k in sec if k.startswith(prefix)); return '\n'.join(l for l in sec[k] if l.startswith('|'))

P = json.loads((S / 'bench-parent/bench.json').read_text())['runs']; C = json.loads((S / 'bench-candidate/bench.json').read_text())['runs']
key = lambda r: (r['profile'], r['scene']); par = {key(r): r for r in P}
cand = {}
for r in C: cand.setdefault(key(r), {})[r['tier']] = r
TIERS = ['low', 'medium', 'high']
sh = lambda r: r['shadows'] if isinstance(r.get('shadows'), dict) else None
# the module's own time
def span(profiles):
    v = [sh(t)['buildMs'] for k, d in cand.items() if k[0] in profiles for n, t in d.items() if n in TIERS and sh(t)]
    return min(x['mean'] for x in v), max(x['mean'] for x in v), max(x['p95'] for x in v)
dLo, dHi, dP95 = span({'16x9', 'hidpi'}); mLo, mHi, mP95 = span({'mobile'})
missing = [f"`{k[0]} {k[1]}` {', '.join(t.upper() for t in ['off'] + TIERS if t not in d)}" for k, d in cand.items() if any(t not in d for t in ['off'] + TIERS)]
MISSING = ('**Not measured.** The candidate run of the matrix ended before its last cells, ' + '; '.join(missing) + ', without an error message, after the queued follow-up runs were stopped by instruction. It was not restarted. Those cells read "—" in every table below; every figure in this report comes from the cells that completed.') if missing else ''
game_mobile = [t['rafCpuMsPerFrame']['mean'] for k, d in cand.items() if k[0] == 'mobile' for n, t in d.items()] + [r['rafCpuMsPerFrame']['mean'] for k, r in par.items() if k[0] == 'mobile']
# draw calls
gl_same = all(abs(t['webglDrawCallsPerFrame']['mean'] - par[k]['webglDrawCallsPerFrame']['mean']) < .01 for k, d in cand.items() if k in par for t in d.values())
gl = {k: (par[k]['webglDrawCallsPerFrame']['mean'], {n: t['webglDrawCallsPerFrame']['mean'] for n, t in d.items()}) for k, d in cand.items() if k in par}
gl_diff = [(k, b, d) for k, (b, d) in gl.items() if any(abs(v - b) >= .01 for v in d.values())]
gl_flat = all(max(d.values()) - min(d.values()) < .01 for k, b, d in gl_diff)
gl_off = all(abs(d.get('off', b) - b) >= .01 for k, b, d in gl_diff)
GL = ('identical to the baseline at every tier in every scene' if gl_same else
      f"identical to the baseline in {len(gl) - len(gl_diff)} of {len(gl)} scenes. In the other {len(gl_diff)} (" + ', '.join(f'`{k[0]} {k[1]}` {b:.0f} → {list(d.values())[0]:.0f}' for k, b, d in gl_diff) + ')'
      + (', the candidate draws the same at every tier, OFF included' if gl_flat and gl_off else ', see the table')
      + (". OFF draws nothing, so the module does not make that difference. At SH3 both trees drew 8 and 14 in these scenes. Why the baseline run drew two more here was not investigated at SH6, by instruction" if gl_flat and gl_off else ''))
c2 = {k: (par[k]['canvas2dCallsPerFrame']['mean'], {n: t['canvas2dCallsPerFrame']['mean'] for n, t in d.items()}) for k, d in cand.items() if k in par}
c2_same = [k for k, (b, d) in c2.items() if all(abs(v - b) < .5 for v in d.values())]
c2_diff = [(k, b, d) for k, (b, d) in c2.items() if k not in c2_same]
def c2_line(k, b, d):
    flat = max(d.values()) - min(d.values()) < 1.5; off_differs = abs(d.get('off', b) - b) >= .5
    st_b, st_c = par[k].get('state') or {}, (cand[k].get('off') or {}).get('state') or {}
    where = '' if (st_b.get('x'), st_b.get('y')) == (st_c.get('x'), st_c.get('y')) else f" The wanderer stood somewhere else in the two runs: ({st_b.get('x')}, {st_b.get('y')}) for the baseline, ({st_c.get('x')}, {st_c.get('y')}) for the candidate (`state` in the bench JSON)."
    return f"- `{k[0]} {k[1]}`: baseline {b:.0f}, candidate " + ' / '.join(f'{v:.0f}' for v in d.values()) + f" ({'flat across the tiers' if flat else 'varies across the tiers'}; {'OFF, which draws nothing, differs too' if off_differs else 'OFF matches the baseline'})." + where
# noise band and cells outside it
fps_rows = [(k[0], k[1], par[k]['fps'], d['off']['fps'], *[d[t]['fps'] for t in TIERS]) for k, d in cand.items() if k in par and all(t in d for t in ['off'] + TIERS)]
rel = lambda a, b: 100 * (a / b - 1)
band = [rel(r[3], r[2]) for r in fps_rows]; lo, hi = min(band), max(band)
outside = [(p, s, t, rel(v, off)) for p, s, base, off, *tv in fps_rows for t, v in zip(('LOW', 'MEDIUM', 'HIGH'), tv) if not lo <= rel(v, off) <= hi]
_top = sorted(outside, key=lambda x: x[3])[:4]
fmt_out = (f"{len(outside)} of {3 * len(fps_rows)}; the largest: " + '; '.join(f'`{p} {s}` {t} {pc(d)} %' for p, s, t, d in _top)) if outside else 'none'
dyn = {t: max((sh(d[t])['dynamicPolys']['max'] for d in cand.values() if t in d and sh(d[t])), default=0) for t in TIERS}
budget = {t: max((sh(d[t])['dynamicPolys']['budget'] for d in cand.values() if t in d and sh(d[t])), default=0) for t in TIERS}
# build probe
BP = S / 'build_probe.json' if (S / 'build_probe.json').exists() else E / 'sh4/build_probe.json'   # not re-run at SH6 (stopped by instruction): SH4's tour of module 1.0
B = json.loads(BP.read_text())['results']; okB = [r for r in B if 'error' not in r]
brow = ['| profile | tier | lamps built / lamps on the map | grounding build, once at load (ms) | lamp-cache builds | mean per build (ms) | slowest build (ms) | module ms per frame over the tour, mean / p95 / max |', '|---|---|---|---|---|---|---|---|']
for r in B:
    if 'error' in r: brow.append(f"| harness error | {r['error'][:80]} | | | | | | |"); continue
    prof = '16x9 (1280×720)' if r['profile'] == '16x9' else 'mobile-like (390×844 DPR 3, CPU ÷4)'; m = r['moduleMsPerFrame']
    brow.append(f"| {prof} | {r['tier'].upper()} | {r['lampsShown']} / {r['lamps']}{' ²' if r['lampsShown'] < r['lamps'] else ''} | {r['staticBuildMs']}{' ¹' if r['throttle'] > 1 else ''} | {r['lampBuilds']} | {r['lampBuildMsMean']:.2f} | {r['lampBuildMsMax']} | {m['mean']:.2f} / {m['p95']} / {m['max']} |")
desk = [r for r in okB if r['profile'] != 'mobile']; mob = [r for r in okB if r['profile'] == 'mobile']
wr = lambda rows, f: max(rows, key=f)
slowD, slowM = wr(desk, lambda r: r['lampBuildMsMax']), wr(mob, lambda r: r['lampBuildMsMax'])
fD, fM = wr(desk, lambda r: r['moduleMsPerFrame']['max']), wr(mob, lambda r: r['moduleMsPerFrame']['max'])
statics = [r['staticBuildMs'] for r in okB] + [sh(t)['cache']['staticBuildMs'] for d in cand.values() for n, t in d.items() if n in TIERS and sh(t)]
partial = [r for r in okB if r['lampsShown'] < r['lamps']]
# SH4 build probe, for the before / after
B4 = {(r['profile'], r['tier']): r for r in json.loads((E / 'sh4/build_probe.json').read_text())['results'] if 'error' not in r}
cmp_build = '\n'.join(f"| {r['profile']} {r['tier'].upper()} | {B4[(r['profile'], r['tier'])]['lampBuildMsMean']:.2f} / {B4[(r['profile'], r['tier'])]['lampBuildMsMax']} | {r['lampBuildMsMean']:.2f} / {r['lampBuildMsMax']} |" for r in okB if (r['profile'], r['tier']) in B4)
# repeated rounds: SH5 mobile-like A/B, and the props A/B when present
ab_mobile = (E / 'sh5/perf/ab_mobile_dense.md').read_text().strip()
def ab_means(d):
    by = {}
    for r in json.loads((E / 'sh5/perf' / d / 'bench.json').read_text())['runs']: by.setdefault(r['tier'], []).append(r['fps'])
    return {t: sum(v) / len(v) for t, v in by.items()}
m4, m5 = ab_means('ab-mobile-sh4'), ab_means('ab-mobile-sh5'); low4, low5 = rel(m4['low'], m4['off']), rel(m5['low'], m5['off'])
ab_props = (S / 'bench-ab/ab_props.md').read_text().strip() if (S / 'bench-ab/ab_props.md').exists() else None
tint = json.loads((E / 'sh5/perf/tint_probe.json').read_text()); surv = [v for v in tint['survives'] if v > 0]

L = f"""# THE FAR BACKROOMS — 2D Lighting & Shadows: performance

**This is evidence, not hardware certification.** Everything here was measured with SwiftShader (software GL) on a
2-vCPU Linux container. No GPU and no phone was available, so nothing here certifies any hardware.

This report covers the final module (`shadows-2d 1.1`, after the SH5 visibility correction). The correction changed
strengths and the size of some shapes, not the number of shapes: the casters, caps, samples, budgets and tiers are
SH4's.

## How the module is bounded (by construction)

- **No full-map pass per frame.** Each light only looks at the casters inside its own range, through a 384 px bucket
  index. Each frame the module does three things:
  - culls the static grounding by 16×16-cell chunks;
  - shows at most `lamps` cached lamp shadows (2 / 5 / 9), nearest first;
  - rebuilds shadows for at most 1 + `peers` carried lights (1 / 3 / 5).
- **Capped casters and polygons.**
  - Per carried light: at most `localMax` / `peerMax` props and `localC` / `peerC` corners. One that leaves the cap
    fades out, so at most twice the cap are drawn while it fades.
  - Dynamic polygons per frame are capped by the tier's budget: {budget['low']} / {budget['medium']} / {budget['high']}. The busiest scenes of the matrix used {dyn['low']} / {dyn['medium']} / {dyn['high']}.
  - Unit test C19 checks that the ray queries per frame stay under a ceiling computed from the tier caps alone.
- **Static geometry is cached.**
  - Grounding is built once at load ({round(min(statics))}–{round(max(statics))} ms in these runs).
  - Each lamp's shadow is built once, the first time it is shown, and cached (LRU of 48). At most 1 / 1 / 2 lamps are
    built in a frame.
  - Light textures are built once per kind.
- **No CPU per-pixel work.** Light strength per pixel comes from a texture the GPU samples. Penumbrae and prop shadows
  are a handful of triangles each.
- **No forced layout.** Nothing layout-dependent is read inside a frame (the SH3 finding below).
- **Nothing high-end-only.** It uses plain Pixi `Graphics` polygons and textures, which Pixi batches into the game's
  existing draw calls. It needs no extension, no shader and no render target.

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

**OFF** draws nothing: it is the v23.3.6 look. Since SH5, LOW, MEDIUM and HIGH are equally strong (unit test V03).
Their differences are softness (samples), coverage (lamps, other players' lights) and caps. Quality never changes
gameplay information.

## How it was measured

`dev/shadows/scene_bench.js` starts the shipped `node server.js` for each tree and drives the real client in Chromium.
The same harness and scenes ran back to back, in one session on one container, against:
- **the baseline**: a pristine `git archive` of the parent `f2805bb` (v23.3.6), which has no shadow module;
- **the candidate**: the final module at OFF, LOW, MEDIUM and HIGH.

The world is staged through the page's own admin WebSocket: frozen halls, no monsters unless the scene adds them, god
mode, lights as the scene needs. The clock runs normally. Settling and measuring are counted in frames.

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

Software rendering draws a few frames a second at 1280×720 and below one at 4K. Every covered pixel costs CPU time
here, which a GPU makes nearly free. Read the **OFF** column as the noise floor: OFF draws nothing, so its distance from
the baseline is run-to-run variation. Across these scenes, OFF's frames per second are {pc(lo)} % to {pc(hi)} % off the
baseline's.

Raw data:
- `dev/shadows/evidence/{STAGE}/`: `bench-parent/`, `bench-candidate/`, `bench_compare.md`{', `build_probe.json`' if BP.parent == S else ''}{' and `bench-ab/`' if ab_props else ''};
- `sh5/perf/`: the repeated mobile-like A/B and the overlay-tint probe;
- `sh3/`: the SH3 profiles and the SH3 matrix of module 1.0.

## Results

{MISSING}

### The module's own time per frame (ms, mean / p95)

{table('shadow module ms per frame')}

- **Desktop-like profiles** (1280×720 and 4K): the shadow work costs **{dLo:.2f}–{dHi:.2f} ms a frame** at LOW,
  MEDIUM and HIGH, with p95 ≤ {dP95:g} ms.
- **Mobile-like profile**, main thread slowed 4×: **{mLo:.2f}–{mHi:.2f} ms**, with p95 ≤ {mP95:g} ms. The game's own
  per-frame JavaScript there takes {min(game_mobile):.0f}–{max(game_mobile):.0f} ms (the main-thread table below).

### Draw calls

WebGL draw calls per frame are {GL}. Within each scene the count does not change from OFF to HIGH: Pixi batches the
shadow `Graphics` into the draws the game already makes.

{table('WebGL draw calls')}

The module's shapes are Pixi `Graphics` in the game's WebGL scene. It never touches the game's 2D canvases, the
darkness overlay included: the overlay's pixels are byte-identical at every quality (browser check B02). Its own small
2D canvases build its textures once each, and hold the admin-only debug view.

2D-canvas calls per frame match the baseline at every tier in {len(c2_same)} of {len(c2)} scenes.{'' if not c2_diff else ' The others:'}
{chr(10).join(c2_line(*x) for x in c2_diff)}
{'A difference that OFF shows too cannot come from the module, which draws nothing at OFF. `canvas_calls_probe.js` counted every 2D call by canvas and by method in the mobile PILLAR HALL scene at SH3: the baseline and every tier were identical (`sh3/profile/canvas_calls.txt`).' if c2_diff else ''}

{table('2D-canvas calls')}

### Main-thread time per frame inside rAF callbacks (ms, mean)

{table('main-thread ms per frame')}

### Frame times

Frames per second:

{table('frames per second')}

Frame interval, ms, p50 / p95:

{table('frame interval')}

Measured against OFF, the tier cells outside OFF's own noise band ({pc(lo)} % to {pc(hi)} %) are: {fmt_out}. The band comes from one round of each tree, and here OFF ran as fast as or faster than
the baseline in every scene, so the band sits entirely above zero and most tier cells fall outside it. These single rounds
are indicative only. A single round of a cell can fall outside the band by chance, so cells were measured again in
repeated, alternating rounds where time allowed:

**The mobile-like PILLAR HALL** (`sh5/perf/ab_mobile_dense.md`). The SH4 report left a one-off −14 % at LOW unrepeated.
Three rounds per tree and tier, back to back:

{ab_mobile}

The −14 % did not reproduce: LOW against OFF is {f'{low4:+.1f}'.replace('-', '−')} % for SH4 and {f'{low5:+.1f}'.replace('-', '−')} % for the final module. The difference
is fill: the same polygons covering more pixels, which software rendering pays for on the CPU.
""" + (f"""
**The reception counter in your flashlight, 1280×720** (`{STAGE}/bench-ab/`). This is the largest flashlight shadow.
Three rounds per tier:

{ab_props}
""" if ab_props else f"""
**The reception counter in your flashlight, 1280×720** (`16x9 props`), the largest flashlight shadow, shows the largest
single-round drop above. **Its repeated A/B was planned for SH6 but not run**: the follow-up runs were stopped by
instruction. It remains a limitation; step 2 of the human-QA tour plays that view.
""") + f"""
### Lights, casters, polygons, primitives (max over a run)

Lights / candidate·active casters / dynamic polygons / primitives:

{table('lights / candidate')}

### How much of a shadow reaches the screen

The overlay paints a carried light's colour tint over its beam, above the floor. `tint_probe.js` measured that in the
real client: {min(surv) * 100:.0f}–{max(surv) * 100:.0f} % of what the module draws in your beam reaches the screen
(`sh5/perf/tint_probe.json`). This is why the SH5 strengths are set where they are. It is not a cost: the probe changes
no work.

### One-time build costs: walking into new rooms

The bench measures steady state, with warm caches. `dev/shadows/build_probe.js` tours the whole map in the real client,
teleporting next to the nearest lamp whose shadow has not been built yet.
{'' if BP.parent == S else '''
**Not re-measured for the final module.** The SH6 re-run of this probe was stopped by instruction before it ran. The
table below is SH4's tour of module 1.0 (`sh4/build_probe.json`). The SH5 correction kept the lamp-shadow build path
and its polygon counts, but made lamp prop shadows larger (presentation height 240 → 180 px). A lamp's first build
may therefore cost somewhat more than shown. Treat this as a pending item: watch for a hitch on entering a new room
on a slow phone.
'''}

{chr(10).join(brow)}

¹ The grounding is built when the page loads, before the probe slows the main thread, so this is not a 4× figure.
{f"² LOW shows only the 2 nearest lamps, so its tour needs more stops; it reached its deadline after {partial[0]['lampsShown']} of the {partial[0]['lamps']} lamps." if partial else ''}

{'' if BP.parent != S else 'Each lamp build, mean / slowest (ms), SH4 → final:' + chr(10) + chr(10) + '| profile / tier | SH4 (1.0) | final (1.1) |' + chr(10) + '|---|---|---|' + chr(10) + cmp_build + chr(10)}
- **Slowest single lamp build:** {slowD['lampBuildMsMax']} ms at 1280×720 and {slowM['lampBuildMsMax']} ms on the 4×-slowed
  mobile-like profile.
- **The module's worst frame over a whole-map tour,** the frames that built lamps included: {fD['moduleMsPerFrame']['max']} ms
  at 1280×720 ({fD['tier'].upper()}) and {fM['moduleMsPerFrame']['max']} ms on the mobile-like profile
  ({fM['tier'].upper()}).
- **A lamp is built once per tier.** From then on only its alpha changes. At most 1 / 1 / 2 lamps are built in a frame.
- **The tour is the worst case.** It teleports into rooms that have never been seen; walking reveals lamps a few at a
  time.

### SH3 finding: a forced layout every frame (kept)

`profile_probe.js` ran on the mobile-like profile at LOW (`sh3/profile/`):

| module | its time per frame (mean / p95) | the hottest function |
|---|---|---|
| SH2 (`fb65693`) | 3.39 ms / 6.8 ms | `viewRect` 29.3 ms self over 15 frames: reading `innerWidth` / `innerHeight` forced a synchronous layout |
| SH3 | 0.56 ms / 1.5 ms | none above 2 ms self over 16 frames |

The viewport size is read only on `resize` / `orientationchange`. The SH5 correction kept this: it changed constants
and the prop-shadow composition, not the frame loop.

## What this does not show

- **No GPU and no phone.** Software rendering shows the CPU side exactly (the module's own time, the call counts, the
  bounded work) but turns fill into CPU time, which a GPU makes nearly free. Real-device frame rates are for human QA.
- **Noise.** Between the baseline and OFF, which show the same picture, frames per second differ by {pc(lo)} % to {pc(hi)} %
  across scenes. Only numbers from one session are compared: the baseline and every tier in each table ran back to
  back.
"""
OUT.write_text(L)
print('written', OUT, len(L), 'chars; outside band:', fmt_out)
