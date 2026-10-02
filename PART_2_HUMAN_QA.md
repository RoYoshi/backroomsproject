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

## FPS equality

21. **60 vs 240 Hz** — Cover the same route at 60 FPS and 240 FPS. Real elapsed travel time must be effectively identical; 240 FPS should only look/respond smoother.
22. **Low-FPS catch-up** — Brief frame drops should not permanently slow the player's simulation. Recovery may hitch visually, but movement must remain real-time rather than frame-count driven.

## Entity presentation

23. **Hound head/body separation** — Watch a Hound notice something off-axis. Its head should acquire the point of interest before/independently of the body; it should read as an animal rather than a tank turret.
24. **Hound search glance** — Break line of sight around a corner. At the last-seen area, its visible head should favor the direction it actually saw you travelling before scanning alternatives.
25. **Smiler facing** — The visible face may rotate toward its perceived/remembered point of interest, but must not imply a body/neck or track hidden live coordinates.

## Lost-target intelligence

26. **Corner continuation** — Let a Hound clearly see you moving toward/around a corner, then break LOS. It should reach the legitimate last-known area and initially investigate routes consistent with your observed motion rather than immediately reversing for no reason.
27. **Can still be fooled** — After breaking LOS, deliberately double back or choose an unexpected branch. The Hound may guess wrong. It must not magically know your hidden route.
28. **New evidence matters** — If you make a legitimate loud movement while hidden, the Hound may revise its hypothesis based on that heard evidence.
29. **Finite search** — Stay silent and successfully hide. The Hound must eventually lose confidence/search alternatives/give up; this improvement is prediction, not wallhacks.

## Lock decision

If all items above feel correct and no new regression appears, mark the package:

**PART 2 COMPLETE — LOCKED**

Then archive the ZIP + SHA before beginning 2.5D work.
