# Stage 3D: the eight death variants

The same eight deaths as before 3D:
- **Hound A–D** and **Smiler A–D**, chosen by the server with unchanged rules and weights (`ai.js`, `STAGE_3D_D0_AUDIT.md` §3);
- the same knock and drag limits, blow times, lengths, blackouts and release triggers (`dphys.js` `PLAN` and `CFG`, unchanged);
- one rounded body and two circular hands; no limb, no rig, no dismemberment.

What 3D changed is how each one ends, where its blood goes, who sees and hears it, and who decides the corpse.

## Choice (unchanged)

| Variant | When the server picks it |
|---|---|
| Hound A | facing the hound (weight 1.5, else .55) |
| Hound B | from behind or running (.95 × 1.25 × 1.25) |
| Hound C | a wall behind the victim along the attack line (1.7, else never) |
| Hound D | exhausted, stamina under 22 (3.2 × 1.3 from behind, else × .6) |
| Smiler A | the common one (3; 1 in a dead end) |
| Smiler B | cornered in a dead end (3; .4 elsewhere) |
| Smiler C, D | admin death lab only |

A recent repeat is damped (× .35 / .6 / .8). A third identical death in a row gets × .06.

## Before and after, per variant

**Columns:**
- the plan and its length are unchanged;
- the physics columns are `phys_matrix.js` over the same 690 runs on the real map: D0 on the parent, D2 and D6 on 3D (`evidence/d6/phys_matrix_d6.json`: every one of the 690 runs ends exactly as at D2; only the event log is shorter since the review's correction, the jaw letting go once: at most 13 events per death, where D2 logged up to 281);
- "wall marks": runs whose blood marks a wall where the body struck it.

| Variant | Knock / drag, blows, length | Asleep by (median s) | Never asleep (of runs) | Moved after "asleep" | Body travel (median px) | Wall marks | Deepest overlap with a wall (px) |
|---|---|---|---|---|---|---|---|
| Hound A | 46 / 40; .2 .62 1.05 1.55; 4.5 s | 4.02 → **3.15** | 30 of 96 → **0** | 12.3 px → **0** | 32 → 47 | – → 3 of 96 | 0.04 → 0 |
| Hound B | 12 / 140; .3 .85 1.5 2.1; 4.7 s | 4.10 → **3.22** | 59 of 96 → **0** | 2.7 px → **0** | 75 → 75 | – → 0 | 0.19 → 0.19 |
| Hound C | wall − 17 / 0; .2 .21 .8 1.4; 4.3 s | 4.00 → **2.92** | 6 of 18 → **0** | 10.2 px → **0** | 69 → 82 | 18 of 18 (scripted, at the ray point) → **18 of 18** (at the real contact) | 0.05 → 0 |
| Hound D | 24 / 26; .45 .95 1.55; 4.5 s | 3.52 → **2.92** | 32 of 96 → **0** | 12.2 px → **0** | 16 → 30 | – → 0 | 0.03 → 0.01 |
| Smiler A | 34 / 86; default blows .24 .74 1.2 1.7; 3.95 s | 4.15 → **3.70** | 46 of 96 → **0** | 2.2 px → **0** | 30 → 30 | – → 0 | 0 → 0 |
| Smiler B | 0 / 0; .7 1.2 1.7; 3.85 s | 2.53 → 2.53 | 0 → 0 | 1.4 px → **0** | 1 → 1 | – → 0 | 0.11 → 0.11 |
| Smiler C | 18 / 36; .55 1.1 1.6; 3.95 s | 4.02 → **3.35** | 46 of 96 → **0** | 2.8 px → **0** | 38 → 38 | – → 5 of 96 | 0 → 0 |
| Smiler D | 26 / 70; .6 1.2 1.8; 3.95 s | 4.02 → **3.37** | 46 of 96 → **0** | 2.8 px → **0** | 32 → 32 | – → 1 of 96 | 0 → 0 |

**Every run, before and after:**
- finite;
- the same end state at 30 / 60 / 120 / 240 Hz;
- no tunnelling (largest body step per physics step 2.44 px).

**Why three hounds now travel further.**
- In the parent, after the hound eased off, its grip kept towing the body after it at a constant 5–6 px/s until the death ended. That is the "creep" the audit found, and it pulled the body back toward the retreating hound.
- Since D1 the jaw lets go when the hound eases off (`back[0]`). The body stays where the blows left it.

The knock and drag limits, which are the variant-defining distances, are unchanged.

## What each one looks, sounds and ends like now (for human QA)

Common to all eight since 3D:
- **The body comes to rest and stays there.** No twitching hands, no slow slide at the end.
- **Blood stays on the floor.** Pools stop at walls and pillars, and spatter never lands on a wall top, pillar or prop. Blood lands where the jaws were at each blow.
- **A hard body–wall impact leaves a smear** at the foot of that wall, with spray thrown back onto the floor, wherever it happened (any variant).
- **The corpse is the death's last frame,** then dries: it darkens in about 5 s and the pool under the torso spreads over about 18 s.
- **Victim and spectators see the same death,** to within a pixel, and the same corpse (the server's).
- **Spectators see the victim's light tumble and land,** and hear the death from where they stand.
- **The death sound's blows fall on the physics' blows.** The wall impact, the light landing and the hat landing have their own sounds.
- **Reduced motion:** the death's camera shake is a quarter as strong. The 1.4× zoom is unchanged.

| Variant | Expected on screen |
|---|---|
| Hound A | Lunge, knockback, four blows with spin. The light flies at the 2nd blow, the hat at the 3rd. The hound eases off; the body stays put. |
| Hound B | Short knock, then dragged up to 140 px along the floor; the hands brace and slip. A smear follows the drag path. The light and hat go when the drag starts. |
| Hound C | Driven into the wall behind (only chosen with a wall there). A smear along the wall's foot exactly where the body struck, spray back onto the floor. The light and hat go at the impact. Double blow at .2 / .21 s, audible as such. |
| Hound D | The exhausted death: little knock, little spin, collapse from .05 s, the light dropped at .3 s, the hat stays on. Blows at .45 .95 1.55. |
| Smiler A | Still and close; a shove at .32 s, then the body is drawn in (2.03–3.12 s) while it fades a little. The light is released as it is drawn. |
| Smiler B | Cornered: everything goes black from .05 to 1.6 s; the body falls where it stood. Blows .7 1.2 1.7. |
| Smiler C | The lights fail (a short dark .02–.9 s); a shove, drawn in 1.7–2.7 s. Admin death lab only. |
| Smiler D | A stronger pull, drawn in 1.6–3.0 s. Admin death lab only. |

**Contact sheets.** For each variant, `dev/stage-3d/evidence/d6/film/sheet_<variant>.jpg` shows parent and 3D block by block: victim row over spectator row, every frame labelled with its time. The x-ray sheets (`film_xray/`) show the attacker. D1, D2 and D4 kept their own sheets.
