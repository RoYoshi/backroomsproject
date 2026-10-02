# Stage C human QA — pending

Independent engineering review and the user's subjective approval are still required. Stage B was approved; that does not approve Stage C or CAMERA-P01.

Start the extracted game with `node server.js` (or existing Render compatibility `node redirect.js`). No new Level 0 geometry or Stage D renderer is present.

- [ ] Compare Stage B's 1.18 camera with this 1.25 candidate at 1920x1080. Is player/world size appropriate? Is awareness too restricted?
- [ ] Repeat at 4K, 3440x1440 ultrawide, portrait, DPR 2/3 and high refresh. Confirm no extra world visibility, cropping surprises or jitter.
- [ ] Walk/sprint/stop/turn, run out of stamina, recover, cross deep carpet, crouch/crawl, slide and vault in Level 0. Confirm familiar control and no new snagging/collision/audio regressions.
- [ ] Check Hound/Smiler encounters, capture, death replay, persistent corpse/equipment and multiplayer reconnect/respawn. No behavior change is intended.
- [ ] Engineering review the synthetic stacked/ramp/stair/drop/clearance traces, continuous XYZ, volume fit, interruption and diagnostics.
- [ ] Where a reviewer has a suitable physical fixture harness, assess ramp/step/fall behavior and ensure camera scale never follows elevation.

Spatial fixtures are currently headless engineering tests using the real move.js motor. This package intentionally has no playable spatial-view prototype. Subjective spatial visual/motion review that needs elevated rendering remains inaccessible until separately authorized Stage D tooling; do not check those items as passed from deterministic tests.

Automated browser rendering could not be performed here (supported executable absent). HTTP/VM policy checks do not substitute for the above review.

Record hardware, viewport, DPR, refresh rate, browser, specific scenario and any clip/video for findings. Do not approve Stage D/E/F/G/H/I implicitly by reviewing this package.
