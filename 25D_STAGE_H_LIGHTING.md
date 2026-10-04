# Stage H lighting, IR and physical audio

**H portion of Z14 PASS.** Real production browser tests use actual flashlight, headlamp and lantern emitters at authoritative/interpolated XYZ. Upper-floor light and IR contributions beneath the intact slab are zero; same-floor positives change pixels. OFF removes the emitter and leaves no fake aura. Receiver height and the true slab/opening geometry determine visibility; local fade does not remove material.

Camcorder LOW/HIGH IR is a separate physical channel. IR contributes zero with the sensor disabled and is visible with NV enabled in authoritative blackout; upper-floor IR remains masked below the slab. Existing zoom and bloom use the actual spatial emitter/ray path. Detached Stage G light/beam uses its independent physical origin/orientation. Body, hands, gear, hat, replay and contact-face effects remain depth/visibility masked.

`test_lighting.js` compares actual production CPU presentation values to accepted E light truth for flashlight/headlamp/lantern on same and hidden floors. It also checks IR separation and immutable geometry. Equal legitimate observations preserve Hound/Smiler decisions and RNG through 900-tick IR pairs and 360-tick independent view/quality/NV/zoom/camera pairs. These toggles do not feed sensor evidence or collision/navigation.

Only existing physical impact and support events are presented acoustically. The accepted sound propagation supplies attenuation and bearing; no new event, exact hidden floor cue or simulation RNG is introduced. The raw H3 browser checks verify canonical caught/death completion and physical impact audio with zero client death-kernel/outcome calls. These checks run again through the portable real view25d gate after the maintained-source build repair.
