# Trial 3 — Skin-Stealer: balance table

**Status: PROPOSED, not owner-approved.** Every value is a named constant in `src/frameworks/nani/server/ai.skinstealer.js`
(`SK` table) or in `dphys.js` (`CFG.SkinStealer`, `DURS.SkinStealer`), derived from the P9 player and monster numbers below. The
owner's QA decides pacing; the table is updated at each checkpoint that changes a value.

## Reference numbers in P9 (read from the source)

| Source | Value |
|---|---|
| Player walk / run / crouch / crawl / exhausted walk (`world.move.js`) | 172 / 285 / 92 / 54 / 148 px/s |
| Player run when stamina is low | 172 + 113 × (.42 + .58 × stamina/32): 219 px/s at 0 |
| Player stamina: run drain / regen still, walk / recovery mark | 10.5 /s; 24, 9 /s; 36 |
| Player radius | 15 px |
| Hound: radius / chase / lunge speed / lunge reach / lunge range | 26 / 292 px/s / ~537 px/s / ~221 px / 96–330 px |
| Smiler: radius / rush / chase | 23 / 300 / 255 px/s |
| Hound death lengths (A–D) | 4.5 / 4.7 / 4.3 / 4.5 s |
| Nearby speech radius | 576 px |
| Tiers | near < 1900 px, mid < 3800 px |

## Proposed Skin-Stealer constants (T0; revised at T2–T4 from measured runs)

| Name | Proposed | Why |
|---|---|---|
| `radius` / `clearance` | 24 / 21 px | an upright lanky body between the Smiler (23) and the Hound (26); fits what they fit |
| `speeds.roam` | 105 px/s | unhurried, ~0.6 × a player's walk |
| `speeds.creep` | 62 px/s | between a player's crouch and crawl |
| `speeds.stalk` | 90 px/s | |
| `speeds.disguise` | 150 px/s | ~0.87 × a player's walk: a tell |
| `speeds.run` | 255 px/s | 0.89 × a fresh sprint (285): it loses a straight race to a rested runner and gains on a winded one (≤ 219) |
| `speeds.fatigued` | 180 px/s | 0.7 × its run |
| `pounce.speed` / `wind` / `dur` | 430 px/s / 0.22 s / 0.36 s | a short burst (1.5 × a sprint, below the Hound's ~537); reach ≈ 170 px |
| `pounce.range` | 55–185 px | it springs only from close by |
| `pounce.cost` | 22 stamina, hit or miss | four quick pounces exhaust it |
| `pounce.cooldown` (after a miss) | 2.0–3.0 s | |
| `recover` (miss / wall) | 0.9–1.3 s / 1.1 s | the window to get away |
| `stamina` max / exhausted below / recovered at | 100 / 8 / 40 | |
| `stamina` drain running / regen walking / regen still | 14 /s / 6 /s / 11 /s | about 7 s of running from full |
| `hunger` rise | 0.0016 /s (~0.1 a minute) | satiated to hungry in about 4 minutes |
| `hunger` at a kill / while feeding | −0.35 / −0.03 /s | |
| `hunger` bands | .2 / .4 / .6 / .8 | |
| `hunger` when an admin spawns one | 0.45–0.65 (seeded) | |
| `vision` | range 760 px, FOV 2.5 rad, not a dark-seer, floor 90 px | darkness really hides a lightless person |
| traits (mean; ±0.12 per individual) | INTELLIGENCE .8, PATIENCE .75, CAUTION .7, AGGRESSION .45, HUNGER .6, HEARING .7, VISION .55, MEMORY .7, CURIOSITY .55, PERSISTENCE .45, SOCIAL .1, SADISM .1, TERRITORIALITY .3, LIGHT_SENS .5 | a patient, cautious, clever animal |
| `budget.chase` | 4 + 8 × hunger s per encounter | |
| `budget.lure` | 5 + 9 × hunger × PATIENCE s per wait | |
| `budget.encounter` | 25 + 45 × hunger s with one person | |
| `cooldown.disengage` | 30–60 s (12 s when starving) | |
| `intercept.look` / `ambush` | ≤ 900 px ahead / 140–220 px past the junction | |
| `disguise.duration` | 150–300 s | |
| `speech` | ≤ 4 heard lines, kept ≤ 90 s; 1 line per ≥ 14 s; ≤ 3 per encounter | |
| `feed.time` | 18–35 s | |
| `ADMIN_MAX_SKINSTEALERS` | 4 | |
| death lengths A / B / C | 3.2 / 3.4 / 3.5 s | a fast finisher; the body has settled by then |
