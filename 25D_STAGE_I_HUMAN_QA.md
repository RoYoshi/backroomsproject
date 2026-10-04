# Stage I human-QA handoff

**2.5D IMPLEMENTATION COMPLETE — HUMAN QA PENDING**

You remain the final gameplay/design authority. Automated certification covers the tested invariants and measured workloads; it does not decide fairness, fear, readability, camera comfort or game feel.

Extract THE_FAR_BACKROOMS_STAGE_I_FINAL.zip, open a terminal in `thefarbackrooms-level0`, and run:

```bash
node server.js 3000
```

Open `http://localhost:3000/` for ordinary flat Level 0. The default remains flat. Check familiar movement/stamina, camera, Hound/Smiler behavior, visible/IR equipment, multiplayer, death and persistent aftermath.

For the accepted synthetic spatial QA fixture:

```bash
node -e "require('fs').writeFileSync('stage-i-world.json',JSON.stringify(require('./dev/stage_e/fixture').fixture(),null,2))"
TFB_WORLD="$PWD/stage-i-world.json" ADMIN_PASSCODE="your-local-test-passcode" node server.js 3000
```

Open `http://localhost:3000/?room=stage-i-qa` in two independent browser profiles. For exact authenticated QA placement, the inherited `25D_STAGE_H_HUMAN_QA.md` console helper remains valid; its old stage/status wording is superseded by this handoff. Lower pose: x160/y160/z0, support:ground-north. Upper pose: x160/y160/z180, support:upper-west. Existing QA commands allow physical placement, freeze/resume and all eight death previews; no production map conversion is supplied.

| Area | Human check |
|---|---|
| Motion | Walk/sprint/exhaust/recover, deep carpet, ramp/stairs/reversal, crouch/crawl/slide/vault, ledge departure and underside collisions. |
| Visibility / camera | Same XY above/below in two clients; independent cutaway; no hidden body/hand/eye/gear/beam/blood/debug/map fragment through slabs; unchanged awareness at all aspect/DPR/UI settings. |
| Perception / canon | Visible light versus real openings/slabs, gaze timing, Hound/Smiler behavior, uncertain hearing, IR/NV blindness of AI; preserve accepted behavior. |
| Authority | Ordinary multiplayer movement, brief packet interruption/reconnect, new world/life, revive restrictions, no stale pose or corpse attachment. |
| Aftermath | All eight variants on ramp/stair/ledge; victim disconnect, late join during fall/after sleep, independent hand/gear support, one persistent physical aftermath. |
| Hardware performance | Record actual GPU/browser and full/reduced quality; explicitly assess two-client falling motion, high DPR/4K/NV zoom, ordinary room and active aftermath load. |
| Flat control | Compare familiar Level 0 feel, appearance, movement/resources, entities and deaths against accepted H. |

Known limitations requiring visibility in QA: Accepted aggregate 151/162 with the same eleven failure names; shared 22/23 with F22; P08 remains UNKNOWN; historical L5/NZ1 timing observations; external Google Fonts network/TLS failures; software SwiftShader misses 16.7 ms with no hardware GPU certification; inherited full-quality two-client airborne-capture limitation (Reduced detail passes the unchanged assertion); 24-active aftermath CPU/payload limit; accepted spatial presentation capacities of 64 solids, eight planes per solid (at most six footprint vertices), 128 light emitters, 64 lamp-failure records, and a 4,194,304-pixel render target.

For a discrepancy record source commit, browser/GPU, viewport/DPR/UI/detail/NV/zoom, client count, world placement and exact steps, with screenshot/video when useful. The measured 60-second soak and admin ceiling are not an uptime or capacity promise. Main was not modified/merged; production 2.5D Level 0 and Part 3 were not begun. Stop here pending your QA.
