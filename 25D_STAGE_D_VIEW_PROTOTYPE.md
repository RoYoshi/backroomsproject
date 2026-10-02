# Stage D spatial view prototype

Run `node server.js`, then open `/stage_d.html`. The normal `/` route is unchanged Level 0. The scene selector covers lower/upper spaces, stairs, ramp, wall/window, crawl roof and balcony/drop. Cutaway, quality and two-view controls are local presentation controls. Fixture placements are static reference poses; full interactive traversal/gameplay presentation is not integrated here.

## Projection and real depth

`screenX = scale × (x − cameraX)`

`screenY = scale × ((y − cameraY) − elevationScale × (z − cameraZ))`

Spatial elevationScale is 0.5; projection helpers support flat 0. Camera depth is the dot product along normalized `(0, elevationScale, 1)`, stored/tested in a 24-bit depth attachment. It is not sprite Y or a floor index. Static geometry is triangulated from actual convex footprints and affine lower/upper planes, including ramp slope, slab thickness and individual treads.

Existing actor art uses alpha-tested camera-facing proxy quads anchored in XYZ; interpolated proxy world points participate in physical visibility and depth. This is a render proxy, not a replacement body/collider or anatomy system. Its silhouette is the shipped rounded body/two hands/backpack art. The original class is used only for static constructor/rebuild output with explicit appearance arguments. Its game-bound animation/death methods are not invoked.

## Physical visibility and camera obstruction

The shipped Pixi bundle exposes its WebGL2 context but no ready-made local-eye cubemap visibility pass. The minimal extension uses exact bounded convex segment clipping per receiver fragment, over a 10×32 RGBA32F data texture containing every physical solid's bounds and planes. **This is not a claim that WebGL2 lacks cubemaps.** It is the master prompt's permitted bounded equivalent for this early fixture, with its cost explicitly measured.

All 32 physical occluders remain active regardless of view fades, draw culling or quality. Broad-phase ray AABB rejection skips only geometrically irrelevant candidates. Full horizontal, vertical and oblique rays use the same solid planes as the Stage C definition. Other occluders expand by 0.005 world units conservatively at thin edges. A receiver's own surface has a bounded 0.03-unit endpoint tolerance, not an always-visible actor exception. CPU reference cases cross-check the unchanged Stage C raycast.

Physically hidden actor/annotation fragments are rejected. Physically hidden **opaque static faces still write black color and actual camera depth**. This prevents an invisible face from becoming an unauthorized camera cutaway. Visible faces use simple diagnostic shading; full gameplay light/IR integration is deliberately absent. GPU results never feed AI or server sensing.

## Local cutaway

Each `LocalView` holds its own world epoch, continuous focus/space list and ordered group states. Only declared `cutawayEligible` groups can change; the fixture declares `view:upper-slabs`. Candidate obstruction uses the physical camera ray from the focus mass, independent of floor identity. Four-unit retention at an active boundary prevents rapid toggling. Enter/restore rates are 0.15 / 0.25 seconds, advanced from presentation time only. Slow frames can complete a fade rather than stretching it through a 0.1-second clamp. Physical LOS is evaluated immediately at every draw.

The actual fade is stable 4×4 screen-door coverage, avoiding transparent draw-order leaks. Camera faces can disappear, while their physical planes remain fully present. Epoch changes reset local state. Two canvases have separate GL targets and fades over the same frozen model/snapshot.

## Pipeline and ownership

1. Validate/compile the immutable Stage C definition through existing geometry, then create owned presentation data. No caller freeze/mutation.
2. Reuse the exact shipped Pixi runtime and original player graphics to create the canvas/context and art textures.
3. Allocate one reusable RGBA8 + DEPTH_COMPONENT24 spatial target per active view; upload static face VBO and all-solid ray data once.
4. Render faces/proxies with actual XYZ depth, physical visibility, canonical XY culling and local eligible-group fades. Last-submitted annotations use this same pass.
5. Blit the composed color to the Pixi-owned canvas. The diagnostic HTML panel contains no hidden world actor rendering.

The isolated spatial pass owns its context after Pixi art extraction; it does not interleave arbitrary Pixi draws with unsynchronized GL state caches. Sampler bindings, unpack state, depth/blend/scissor/stencil and framebuffer state are explicit. Future full presentation integration must preserve this ownership boundary or synchronize renderer state deliberately. No production Canvas overlay has been broadly migrated in Stage D.

## Camera and resource limits

| Logical viewport | DPR | Logical XY envelope | Full / reduced target |
|---|---:|---|---|
| 1920×1080 | 1 | 1536.000×864.000 | 1920×1080 / 960×540 |
| 1920×1080 | 2 | 1536.000×864.000 | 2730×1536 / 1365×768 |
| 3840×2160 | 1 | 1536.000×864.000 | 2730×1536 / 1365×768 |
| 3440×1440 | 1 | 1536.000×642.977 | 3165×1325 / 1582×662 |
| 1080×1920 | 1 | 486.000×864.000 | 1080×1920 / 540×960 |


Candidate anchors and individual world fragments obey canonical XY scope even if elevated geometry projects back inside the screen. All potentially blocking solids remain in physical truth. DPR and reduced quality affect raster sampling only; cap/fades/Z/FPS cannot widen awareness. 4,194,304 target pixels per view is a presentation-memory cap, so high DPR/4K can reach that cap before native pixel resolution.

The fixture has 32 solids / 384 static triangles and 15 nominal two-triangle actor proxies. The recorded scene submits 45 draws plus one color blit (two passes); some actor candidates are culled. The ray data texture is 5,120 bytes. New managed target/buffer/art estimates exclude driver overhead and retained Pixi pools; default canvas color storage is listed separately in JSON. A maximum-size view needs approximately 32 MiB for color/depth, plus about 16 MiB default color and small static resources. Two-view aggregate cost scales accordingly.

| Viewport | Quality | Target | Completed frame median / p95 | Drained RAF median / p95 | New resource estimate |
|---|---:|---|---:|---:|---:|
| 1280×720 DPR 1 | 1 | 1280×720 | 212.9 / 236.1 ms | 216.6 / 250.0 ms | 7.15 MiB |
| 1280×720 DPR 1 | 0.5 | 640×360 | 52.7 / 61.7 ms | 50.1 / 66.8 ms | 1.88 MiB |
| 1920×1080 DPR 1 | 1 | 1920×1080 | 475.4 / 523.7 ms | 500.0 / 583.3 ms | 15.94 MiB |
| 1920×1080 DPR 1 | 0.5 | 960×540 | 126.1 / 140.6 ms | 133.3 / 150.0 ms | 4.07 MiB |


These software-GPU results miss 16.7 ms. Hardware-reference validation and broad-content scalability remain open. Reduced quality keeps identical physical occluders and rays; it does not hide correctness failures. Capacity above 64 solids or 8 planes throws explicitly. There is no silent truncation or distance-based physical reach reduction.

Prototype picking is limited to tested projection inversion onto an explicitly supplied plane; no production picking/aim migration was attempted. Stage E/F/G/H systems remain untouched.
