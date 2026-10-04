# Part 3B camera and depth projection

## Foundation

The physical simulation, network XYZ, aim/light/eye origin and canonical camera policy remain unchanged. Only `world_view.js` and `spatial_client.js` are runtime presentation changes.

The camera owns a per-client critically damped elevation state. Its constant-target update is analytic, using angular frequency 24/s. Lag is bounded to 28 world units. A changed epoch/life/discontinuity, connection state or wall-clock gap over 250 ms snaps state safely. XY remains the physical camera center.

Depth uses homogeneous denominator `w = clamp(1 - (z - cameraZ)/3600, 1/1.06, 1/0.94)`. Layer scale is `1/w`, so a floor 180 units below the camera reads at 95.238% reference scale. All scales remain within 94–106%. The accepted oblique vertical coefficient remains 0.5. This creates restrained relative parallax and layer scale without perspective-camera rotation.

The projection has three regions. Geometry crossing either clamp plane is split at that exact Z plane; WebGL perspective-correct interpolation therefore recovers physical fragment coordinates for unchanged eye/light rays. Physical solids remain complete even when not submitted for camera drawing.

The inverse at known Z multiplies screen displacement by the same denominator. Camera picking follows the resulting three connected linear ray segments and retains physical eye visibility and camera-depth rejection. Actor ordering is deterministic, independent of input submission order. A cutaway does not remove physical ray occluders.

## Admission

`camera_policy.js` is byte-identical to Part 3A. World admission uses the original max-axis camera footprint, including zoom. Actor centers outside it are rejected before drawing. Geometry fragments are clipped using physical XY against the same footprint, after depth projection. DPR changes render resolution only; quality changes target resolution only. UI scale is not a world-admission input.

## Validation status

P3B1 focused deterministic and served-browser evidence is under `dev/part3b/evidence/p3b1`. Movement presentation refinement belongs to P3B2. Human camera comfort and perceived depth remain pending.
