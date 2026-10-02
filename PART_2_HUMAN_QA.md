# THE FAR BACKROOMS — Final Part 2 Human QA

Use the admin/debug tools and test these in normal gameplay conditions.

## Hound

1. **Pre-pursuit gaze** — Let a Hound enter/notice you while you are already staring at it. It should hesitate/creep briefly instead of instantly hard-committing.
2. **Committed pursuit** — Make it commit to a real chase, then turn and stare at it. It must keep pursuing; gaze must not freeze or slow the committed chase.
3. **Run trigger** — Establish the pre-pursuit stare, then run. Pursuit should commit.
4. **Close orbit** — While it is pursuing, walk tight circles around it. It should plant/reorient and eventually catch or properly line up an attack. It should no longer be indefinitely orbit-locked.
5. **Normal chase** — At medium/far range it should retain broad physical turns and should not look like an instant-aim turret.

## Smiler

6. **Long gaze** — Stand still and hold the Smiler's eyes for 20–30 seconds. The encounter should become increasingly active through creep/drift rather than settling into a comfortable frozen equilibrium.
7. **Slow retreat** — Back away slowly while keeping eye contact. This must remain the reliable controlled escape behavior.
8. **Light + gaze** — Keep a visible flashlight/headlamp/lantern ON while maintaining gaze. Visible-light agitation must still eventually overcome the hold and provoke the established chase behavior.
9. **Do not invent proximity aggression** — Simply being near and perfectly still must not create a generic timer-based attack. Panic/retreat, loud-noise, and existing light rules still matter.

## QOL

10. **Light OFF** — Switch flashlight, headlamp, and lantern off. The little 52 px light pool around the player should disappear completely.
11. **Light ON** — Switch them back on. Their normal source glow/beam/pool should return.
12. **Camcorder** — It should not emit the old visible carried-light aura.
13. **Corpse hover** — Hover a dead remote player's persistent corpse/avatar state; the status should say `DEAD`, not `DOWN`.

## Stress/admin

14. Use `+10 HOUNDS` repeatedly. Confirm counts can rise well beyond 3, up to the 64 admin ceiling.
15. Use `+10 SMILERS` repeatedly. Confirm counts can rise well beyond 5, up to the 64 admin ceiling.
16. Try a mixed high-count room. Look for missing entities, invisible entities, slot reuse errors, NaNs, server stalls, or major snapshot hitching.
17. `RESPAWN ALL` should return the world to its normal small population; the raised ceiling must not make 64 monsters normal gameplay.

## Camera / fairness

18. **Camera fairness — resolution** — Compare 1280×720, 1920×1080, 2560×1440, and 3840×2160 browser viewports. At the same 16:9 aspect ratio they should show essentially the same amount of world; higher resolution should only look sharper.
19. **Camera fairness — ultrawide** — Resize to an ultrawide aspect ratio. It must not reveal additional world beyond the canonical gameplay envelope; one axis may crop instead.
20. **Aim/lighting after resize** — Resize the browser during play and verify mouse aiming, flashlight direction, multiplayer overlays, LOS mask, camcorder zoom, and death camera stay aligned.

## Lock decision

If all items above feel correct and no new regression appears, mark the package:

**PART 2 COMPLETE — LOCKED**

Then archive the ZIP + SHA before beginning 2.5D work.
