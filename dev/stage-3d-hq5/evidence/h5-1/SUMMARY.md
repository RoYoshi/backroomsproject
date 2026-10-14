# H5-1: the contact, prototype and checkpoint

**The change:** `assets/br-role.js` only, now `br-role 1.2-candidate`. The design is in `../h5-0/AUDIT.md`.
- `actorShadows()` gives every light in a living Wanderer's `cands` a contact. It goes on that light's own cast job if it has one, and otherwise into a contact-only list (`cacts`).
- `castActors()` builds the contact in the same pooled canvas as the cast, centred on the body. Where the same light's cast already darkens the floor, it keeps only what the cast does not take. The silhouette is cut out of both.
- `contactLamp()` handles a lamp that is drawn into the half-resolution core buffer. It leaves a hole of whole pixels there and adds that region back at full resolution with her contact taken out.
- `carried()` takes the contact-only list in its own scratch.
- DEV only: `dev.contact(gain)` and `dev.contacts()`.

## Same-scene before and after

`contact_lab.py`, HQ4 against HQ5. The pictures are real page captures at normal zoom (DPR 1) with the clock frozen; MEDIUM unless a row says otherwise. All numbers: `lab_report.json` (the whole lab run: these scenes and the H5-2 ones).

| | Result |
|---|---|
| One fixture 100 px away, 4 headings (`sheet_geometry.png`) | **Her body: 0 pixels changed. Outside 31 px: 0 changed.** The edge and the floor up to ~26 px darken by at most 15 levels. In the light buffer, the contact takes at most .11 just past the edge (19-20 px), falling to 0 by 26 px. At the cast's side it takes about .01 more than the cast (not doubled) |
| Hands at a walk's swing extremes (±3 px), each heading | The contact job is identical: same centre, light, strength and nudge. HQ4's cast jobs are equal to HQ5's |
| Right under the fixture, 0 and 90 deg (`sheet_under_lamp.png`) | HQ4 has no job for her here. HQ5 gives an even ring: .125 taken just past the edge, gone by 26 px. Her body changes by at most 1 level and only by rounding: the hole region is redrawn at full resolution. Outside, at most 2 levels at the hole's edge |
| The hole's exactness (gain 1e-4, so the hole runs but takes nothing, against gain 0) | At most 2 levels, on 859 of 3,721 sampled points |
| HQ5 with the contact off in the same frame (DEV gain 0) | **Identical to HQ4, pixel for pixel**, and its light buffer is identical too, at every heading and under the lamp |
| Diagnostic (`geo_000_diagnostic_x3.png`) | Gain 3, DEV only, to show where the contact falls: round her foot, merging into the cast's root |

The shipped strength (`CONTACT.a` .3, reach 9 px) is faint by intent. It is one constant if the user wants it stronger or fainter.
