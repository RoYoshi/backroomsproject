# CAMERA-P01 controlled candidate

Old canonical scale: 1.18. Candidate: 1.25. Reason: user requested a slightly closer camera after passing Stage B human QA.

The only gameplay camera policy change is `REF_SCALE` in camera_policy.js. It is independently revertible to 1.18, together with the explicit canonical expectation in dev/tests/s_camera_fairness.js. No physical module imports this policy. Existing production resize code remains byte-identical and consumes baseScale(width,height).

At 1920x1080 the world envelope changes from approximately 1627.119 x 915.254 to 1536 x 864 world units. Scale increases about 5.93%; each visible axis decreases 5.6%. This is a candidate for human judgment, not a claimed improvement in feel.

Verified: same awareness at 4K; 3440x1440 ultrawide crops the other axis; portrait and the existing small-screen scale floor remain normalized; DPR 1/2/3 changes no logical view; render schedules and Z context change no scale. 315 pure-policy context cases plus actual HTTP bytes/literal app resize execution in a VM. No dynamic/threat/speed/entity/room/ramp/fall/cinematic zoom was added.

Browser rendering is BLOCKED by missing browser executable. Human comparison at 1080p/4K/ultrawide/high-DPR/high-refresh remains pending. If too restricted, the user can reject this isolated candidate without reverting Stage C physics.
