# Stage D actual browser evidence

Actual served files were rendered by **Chromium headless shell 151.0.7922.34**, controlled with **Playwright 1.62.1**, on Node v24.19.0. Exposed GPU: **ANGLE / Vulkan / SwiftShader (Subzero)**, a software renderer. The official direct Chrome-for-Testing artifact succeeded after CDN mirrors returned an unavailable-page response; browser launch and artifact provenance are recorded. No browser executable is packaged.

This report describes real WebGL output, not VM or HTTP-only success. Diagnostic HTML controls are hidden in spatial screenshots so they do not cover the geometry. Pixel tests read the actual composed spatial target; screenshots capture the served canvas/page.

## Pixel and composition assertions

| Browser assertion | Evidence |
|---|---|
| Lower observer, roof fully cut away, upper actor plus final annotation hidden | Removing upper art and adding its last-drawn marker changes **0 pixels** |
| Upper observer cannot see the lower actor through slab | Exact output hash equality with/without lower art/marker |
| Physical visibility independent of cutaway | Shared geometry ray returns the same slab blocker before/after fade |
| Unseen opaque roof retains camera obstruction | Sample is black before eligible cutaway; local original art appears after cutaway |
| Real stairwell admits valid cross-elevation view | Observer root Z 132 / eye Z 182 sees upper-root Z 180 actor; target removal changes pixels and CPU LOS is clear |
| Narrow wall clips the original silhouette | Front 1,026 changed pixels; partial 786; deeper partial 585, with visible side portions preserved |
| Full physical wall blocker | Hidden actor and final annotation produce no output difference |
| Real face depth | Twelve static frames with reversed world/actor submission order give one output hash |
| Resizing | First/second resized frames match, both views retain geometry, no GL error |
| Independent views | Same model/snapshot references; lower fade 1, upper fade 0; unchanged content/snapshot hashes |

See `dev/stage_d/evidence/browser-core.json` and screenshots `core-lower.png`, `core-upper.png`, `core-two-views.png`, `core-stairs.png`, `core-ramp.png`, `core-wall.png`, `core-crawl.png`, `core-balcony.png`.

## Fairness and fade

| Logical viewport | DPR | Logical XY envelope | Full / reduced target |
|---|---:|---|---|
| 1920×1080 | 1 | 1536.000×864.000 | 1920×1080 / 960×540 |
| 1920×1080 | 2 | 1536.000×864.000 | 2730×1536 / 1365×768 |
| 3840×2160 | 1 | 1536.000×864.000 | 2730×1536 / 1365×768 |
| 3440×1440 | 1 | 1536.000×642.977 | 3165×1325 / 1582×662 |
| 1080×1920 | 1 | 486.000×864.000 | 1080×1920 / 540×960 |


Every row was actually rendered at both qualities. A probe outside canonical XY was physically visible and projected into the viewport, yet contributed zero pixels; moving it inside the cap changed pixels. Thus the test does not pass merely because a wall happened to hide the outside probe. Hidden cross-floor actor/annotation equality remains exact at both qualities.

Twenty-one fade samples show no transient cross-floor/overlay reveal. A 120-frame camera-boundary perturbation retained one stable output hash. Spatial screenshots for each viewport/DPR are saved as `viewport-...png`. These are objective stability checks, not a subjective flicker/readability approval.

## Flat compatibility

`browser-flat.json` records byte-identical parent/Stage D menu and active-gameplay screenshots. The production page remains on its original renderer and does not load TFB_VIEW. The browser harness uses the real SOLO fallback, a seed and controlled clock; this is not a claim about every multiplayer presentation state. Unmodified multiplayer audits passed separately.

## Performance and evidence limits

| Viewport | Quality | Target | Completed frame median / p95 | Drained RAF median / p95 | New resource estimate |
|---|---:|---|---:|---:|---:|
| 1280×720 DPR 1 | 1 | 1280×720 | 212.9 / 236.1 ms | 216.6 / 250.0 ms | 7.15 MiB |
| 1280×720 DPR 1 | 0.5 | 640×360 | 52.7 / 61.7 ms | 50.1 / 66.8 ms | 1.88 MiB |
| 1920×1080 DPR 1 | 1 | 1920×1080 | 475.4 / 523.7 ms | 500.0 / 583.3 ms | 15.94 MiB |
| 1920×1080 DPR 1 | 0.5 | 960×540 | 126.1 / 140.6 ms | 133.3 / 150.0 ms | 4.07 MiB |


`browser-performance.json` is the authoritative completed-frame measurement: synchronous 1×1 readback drains each render, including CPU/GPU/readback overhead, followed by drained RAF intervals. Earlier enqueue-only timings are retained as explicitly superseded development evidence. The software profile misses the 16.7 ms target; unavailable hardware performance is unverified.

Static screenshots were visually inspected for actual flat game output, spatial separation, original player silhouette, wall clipping and independent views. This does not replace the user's human gameplay QA. Scene placements are static presentation fixtures; full gameplay traversal/animation/lighting/aftermath/UI integration is outside Stage D.
