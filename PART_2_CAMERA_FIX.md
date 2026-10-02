# THE FAR BACKROOMS — Camera Fairness Fix

**Build:** `23.3.2-hqa-camera`  
**Baseline:** `23.3.1-hqa-hotfix`

## Finding

The prior renderer used a fixed desktop camera scale of 1.18. Because world-space view size was approximately `viewportPixels / scale`, a larger browser viewport could display more of Level 0. Resolution and ultrawide aspect ratio therefore affected tactical screen space.

## Fix

The established 1920×1080 / 1.18 framing is now the canonical maximum gameplay view.

`baseScale = max(viewportWidth / canonicalWorldWidth, viewportHeight / canonicalWorldHeight)`

This guarantees that neither visible world width nor visible world height exceeds the canonical envelope. Same-aspect resolutions receive the same world FOV. Unusual aspect ratios crop rather than gaining additional awareness.

The policy affects world rendering only. CSS HUD layout remains responsive to the real viewport.

## Preservation

No changes to:

- server simulation or tick rate
- player speed/movement
- Hound/Smiler behavior
- entity perception
- navigation/collision
- light evidence semantics
- network snapshots/interpolation
- camcorder zoom ratios
- death simulation

## Human check

Test at multiple browser sizes and confirm that world framing remains equivalent at 16:9, mouse/light alignment remains correct after resize, and ultrawide does not expose extra world.
