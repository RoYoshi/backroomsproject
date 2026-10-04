# Part 3B camera and depth projection

## Foundation

The physical simulation, network XYZ, aim/light/eye origin and canonical camera policy remain unchanged. Only `world_view.js` and `spatial_client.js` are runtime presentation changes.

The camera owns a per-client critically damped elevation state. Its constant-target update is analytic, using angular frequency 24/s. Lag is bounded to 28 world units. A changed epoch/life/discontinuity, connection state or wall-clock gap over 250 ms snaps state safely. XY remains the physical camera center.

Depth uses homogeneous denominator `w = clamp(1 - (z - cameraZ)/3600, 1/1.06, 1/0.94)`. Layer scale is `1/w`, so a floor 180 units below the camera reads at 95.238% reference scale. All scales remain within 94–106%. The accepted oblique vertical coefficient remains 0.5. This creates restrained relative parallax and layer scale without perspective-camera rotation.

The projection has three regions. Geometry crossing either clamp plane is split at that exact Z plane; WebGL perspective-correct interpolation therefore recovers physical fragment coordinates for unchanged eye/light rays. Physical solids remain complete even when not submitted for camera drawing.

The inverse at known Z multiplies screen displacement by the same denominator. Camera picking follows the resulting three connected linear ray segments and retains physical eye visibility and camera-depth rejection. Actor ordering is deterministic, independent of input submission order. A cutaway does not remove physical ray occluders.

## Admission

`camera_policy.js` is byte-identical to Part 3A. World admission uses the original max-axis camera footprint, including zoom. Actor centers outside it are rejected before drawing. Geometry fragments are clipped using physical XY against the same footprint, after depth projection. DPR changes render resolution only; quality changes target resolution only. UI scale is not a world-admission input.

## Motion refinement (P3B2)

Live player/peer art consumes a separate rendered-elevation spring (40/s, maximum 8 units or 14% of body height, whichever is smaller). Physical packet XYZ/support remain exact. Positive visual lag is swept against physical clearance so the head cannot pass an underside. Fragment visibility subtracts the visual offset before querying the physical body, and picking returns physical target coordinates after intersecting the rendered location. Aftermath does not inherit this living-actor lag.

Both camera and actor springs use an analytic response to a linearly moving target. Local presentation advances on every animation call, including when the GPU submission fence skips a draw; only the last drawn camera is used for screen picking. There is no render-FPS input to simulation.

Landing adds at most 1.25 units of body settle over 180 ms, with zero value/velocity at both ends. It does not move the physical eye, hitbox, light or collision origin. There is no additional hand animation or camera shake. Epoch, life, authoritative discontinuity, reconnect state, large positional discontinuity and long idle gaps reinitialize safely.

Production physical replay covered stairs up/down, reversal and sideways departure, both ramps and falls at +180→0 and 0→−96. The +180 test begins in a clearance-valid airborne pose over the bottom of the production stairwell; it does not add a new ledge or modify Level 0 physics. The lower test walks off the existing depression rim. Six schedules (30/60/120/144/240 Hz and jitter) differ by at most 1.592 units in rendered elevation and 1.512 units in camera elevation on these trajectories. Settled endpoints agree within 0.01 units.

## Validation status

P3B1 focused deterministic and served-browser evidence is under `dev/part3b/evidence/p3b1`. P3B2 motion/offset-picking evidence and actual keyboard traversal captures are under `dev/part3b/evidence/p3b2`. Human camera comfort and perceived depth remain pending.
