# Trial 3 — Skin-Stealer: balance table

**Status: PROPOSED, not owner-approved.** Every value is a named constant in `src/frameworks/nani/server/ai.skinstealer.js`
(`SK` table) or in `dphys.js` (`CFG.SkinStealer`, `DURS.SkinStealer`), derived from the P9 player and monster numbers below. The
owner's QA decides pacing; the table is updated at each checkpoint that changes a value.

**Where the final values are (T8):** the sections "As built after T3", "after T4", "after T5" and "after T6" below hold the values the
code has now, a later section overriding an earlier one (T4's `runFrom` 200 px/s replaces T3's 150 in the stamina drain row, for
instance); the T0 table shows the first proposals, kept for the record of what changed and why.  Server cost: `CHECKPOINTS.md` T7.

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

## As built after T3 (the `SK` table in `ai.skinstealer.js`; still PROPOSED, not owner-approved)

Where a value differs from the T0 proposal above, the T0 line is superseded by this one.

| Name | Value | Notes |
|---|---|---|
| `hungerAtSpawn` / `hungerRate` / `band` | 0.45–0.65 / 0.0016 /s / .2 .4 .6 .8 | as proposed |
| `stamExh` / `stamBack` / `stamLow` | 8 / 40 / 25 | under 25 it runs at its fatigued speed (180 px/s) |
| `drainRun` (pro rata over 150 px/s) / `regenWalk` / `regenStill` | 14 / 6 / 11 per s | |
| `watch` | 2–6 s × (0.7 + 0.6 × PATIENCE) | |
| `near` / `exposed` | 260 px / light 0.45 on its own body | |
| `hide` | 140–520 px | retreat distance; the bait takes the nearest hidden spot round a corner |
| `leave` / `leaveMax` / `cooldown` | 1200–2200 px / 45 s / 30–60 s (12 s starving) | |
| `budgetEnc` | 25 + 45 × hunger real seconds with one person | |
| `rethink` | a new plan must score 1.3 × the current one | |
| `retreatHold` | 1 s out of sight before it decides (lie in wait, or go about its business) | T2 drafted 4 s |
| `approachStop` | 150 px | until T4's pounce |
| `lure` / `lureMax` | 4 + 12 × hunger × PATIENCE s / 22 s | T0 proposed 5 + 9 × hunger × PATIENCE |
| `predictLook` / `predictTurns` / `predictMargin` | 1500 px / 2 guesses / 0.8 s | T0 proposed 900 px to the first junction |
| `interceptMax` / `interceptWait` | 26 s (+ up to 8 s while it hears them coming) / 4–9 s × (0.7 + 0.6 × PATIENCE) | |
| `searchMax` / `searchLook` | 16 s / 2–4 s listening | |
| `heardFresh` / `heardMin` | 2.5 s / sound intensity 0.12 | |
| `chaseFrom` / `chaseMax` / `chaseLose` | 420 px / 7 s / the gap 140 px past the closest it got | T0 proposed a 4 + 8 × hunger s budget |
| "fleeing" | moving away > 200 px/s, or > 110 px/s within 4 s of eye contact | someone who walks on is stalked, not chased |

## As built after T4 (the strike and the kill; still PROPOSED)

| Name | Value | Notes |
|---|---|---|
| `pounceRange` | 55-185 px | and only a leap that can reach them: start distance + their seen speed away x (wind-up + leap) - (its radius + 16) <= 0.85 x 430 x 0.36 |
| `pounceWind` / `pounceSpeed` / `pounceDur` | 0.22 s / 430 px/s / 0.36 s | as proposed; its speed falls to 0.7x over the leap, so a full leap covers about 130 px |
| `pounceCost` | 22 stamina per leap, hit or miss | the leap itself is not also charged as running |
| `pounceCool` / `recoverMiss` / `recoverWall` | 2-3 s / 0.9-1.3 s / 1.1 s | as proposed |
| contact | centres within its radius (24) + 18 px, nothing solid between | lethal only at contact |
| `grabReach` / `grabWind` | 46 px / 0.12 s | anybody in arm's reach of a hungry one |
| shadowing pace | their speed + 30 px/s, up to 200 px/s | new at T4 |
| `runFrom` | 200 px/s (T3: 150) | a brisk walk costs no stamina |
| capture | always quick; never "play" | |
| death variants (weights) | A 1.6 (0.5 after a landed pounce); B 2.6 after a landed pounce (0.15 otherwise); C 0.35 + 1.9 winded + 1.4 cornered + 1.4 starving | G.I.B.'s history rule still avoids a third identical death in a row |
| death lengths A / B / C | 3.2 / 3.4 / 3.5 s | as proposed; the server's commitment uses the same (a facts check binds both) |
| the snap | A 0.58 s, B 0.9 s; twist 7.5 / 6.5 rad/s | C has no snap (two bites at 0.45 and 0.95 s, the legs go at 0.95 s) |
| `killMeal` / `feedRate` / `feedTime` | -0.35 / -0.03 per s / 18-35 s | as proposed; disturbed (seen within 520 px, or watched) it leaves |

## As built after T5 (presentation; PROPOSED, nothing here changes what it does)

| Name | Value | Notes |
|---|---|---|
| footfall | every half stride (96 / 118 / 150 px strides by speed); heard to 950 px (full to 120 px) | a wall between: half as loud, muffled (as every entity sound) |
| stalking footfall (creep, approach) | 0.45 of the level; heard to 520 px (full to 80 px) | quieter, never silent |
| the wind-up's tell / the leap / a miss's skid | heard to 700 / 800 / 700 px | the tell sounds as the 0.22 s wind-up begins, before the leap starts |
| feeding | every 0.8-1.5 s, heard to 520 px | |
| breath while still | at most every 25-45 s, only within 260 px | never a proximity cue |
| art | skin 0xbcab9a (shadow 0x7f6c5e, light 0xdfd1bf); leg 5.4 / 4 px, arm 5 / 3.8 px | interim; shaded by BR-RoLE's light sample, black in the dark |

## As built after T6 (deception; PROPOSED)

| Name | Value | Notes |
|---|---|---|
| `skinFeed` | 8 s at its meal | before it can wear the skin; disturbed sooner, none.  A meal now lasts at least this long |
| `disguiseTime` | 240-420 s | hunger rises about 0.1 a minute, so a fed one in a skin is satiated at first and hungry again within its time |
| speed in a skin | 150 px/s (`speeds.disguise`) | a person walks at 172: it is a little slow, and a walker can leave it behind |
| `mingleStop` / `stare` / `mingleStrike` | 170 px / 3-7 s (x 0.7..1.3 PATIENCE) / 120 px | it stands, stares, then (hungry, >= 0.4) closes in; it springs only from 120 px in a skin (185 out of one) |
| chase in a skin | very hungry (>= 0.6), the person fleeing | it drops the skin to run |
| `hearSpeech` / `heardMax` / `heardTtl` / `heardUses` | 576 px / 4 lines / 90 s / 2 repeats each | the players' own speech radius |
| `sayGap` / `sayEnc` / `sayLure` | 10-18 s / 3 an encounter / 1.5 s into a wait | it calls from hiding only when very hungry (>= 0.6) and unseen |
| `sayWords` / `echo` | 6 words / 35 % | its echo of a heard line: the opening words, lower case, sometimes the last word again |
| server bucket | 1 line / 6 s per entity | B++'s speech.js, whatever the AI asks |
| entity voice | pitch -4..+2 semitones, pace 78-92 % (seeded per creature) | `voice.js`'s `mimic`: low, breathy, sliding down |
