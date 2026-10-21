# Trial 3 predator refinement — R0 audit

Trial 3, and the B1–B5 behaviour refinement it is built on, are **not owner-approved**; the owner's status is NEEDS MAJOR REFINEMENT.
Everything below was read at the verified starting commit `4518f93dff82e5ee8bfc8abb67dc0ecb4f77959a` and reproduced on the real
simulation before any change. Line numbers are in `src/frameworks/nani/server/ai.skinstealer.js` at that commit unless a file is named.

## 1. Refs before branching (GitHub, 2026-10-21 04:55 UTC)

| Ref | Head | Tree | As expected |
|---|---|---|---|
| `trial-3-behavior-refinement` (starting point) | `4518f93dff82e5ee8bfc8abb67dc0ecb4f77959a` | `28815b06019ed38aff8c083e93b1ba7056da3d67` | yes; parent `e85c740` |
| `trial-3-skin-stealer` (original Trial 3) | `020b5b533a3ab1e8edaaa7dd6a02bf29070421fc` | `26234cd` | yes |
| `pre-trial3-final-polish` (P9) | `1ff9374babc034eafed4c7c26dc941f46fc55908` | `d6b71b8` | yes |
| `main` | `7781e1ac34aa09970df57fae3fc107a873fa2731` | | yes |
| `stage-3h-engine-modernization`, `stage-3h`, `stage-3e-0-bplusplus`, `post-3h-trials-1-2-4`, `trial-4-rgb-chat-accessibility`, `post-trial4-review-polish`, `post-trial4-chat-voice-polish` | `4beba2f`, `22751bb`, `143b63f`, `58fcf5b`, `518b990`, `1a89863`, `63805e9` | | yes |
| `trial-3-predator-refinement` | did not exist (GitHub: branch not found) | | created here from `4518f93` |

All 38 remote heads are recorded in `inventory/remote_heads_before.json`; `tools/verify_remote_pr.py` checks after every push that this
branch is one straight line from `4518f93`, that each ref above is at its head, and that no other branch moved or appeared. The pack was
checked against its own manifest (all 16 files match their SHA-256).

## 2. What the owner reports, reproduced (`tools/repro_r0.js`, 8 seeds each; `evidence/r0_repro_baseline.*`)

| Scenario | Baseline result |
|---|---|
| **W** a lit person 450 px off in the long hall keeps facing it, 45 s | hunger .05 / .2 / .5: it leaves at once (0.1 s) in 8 / 8. Hunger .75 / .95 / 1.0: **8 / 8 back off out of sight, wait round a corner, then leave** (13–18 s); never approaches; closest 336–347 px; 0 kills |
| **C** the same watcher for 120 s at hunger .95 | 0 kills in 8; it approached for 0 % of the time; 1–2 departures each |
| **U** the same person facing away (unaware) | hunger .05–.5: it leaves at once, **even at .5 with an unaware person** (the hall is lit). Hunger ≥ .75: it approaches and kills 8 / 8 (closest 1–38 px) |
| **L** seen once (walking north past a gap in the dark south-west), then out of sight, light off, **running on** (audible) at hunger .95 | after the last sighting it heard 6–10 footsteps (all anonymous) in 6 runs; **in only 2 of them did its plan change within a quarter second of a sound**; 6 of the 7 runs that hunted ended "it left; it roams again" |
| **F** the same, the person doubles back west, then runs east past it unseen 10 s later | 7 / 8 ended in a departure (6 of them after an interception that failed); in 0 / 8 did a footstep change what it did; one kill (seed 1, it saw them again) |
| **R** the straight race at hunger .95 | 8 / 8 lost the race at 3.5–4 s (closest 300 px: the race is fair) and **8 / 8 then left** (or roamed) — no search, no second attempt |

## 3. The code paths that explain each failure

1. **Eye contact is a near-universal repellent** (`skDecide`, lines 785–792). Watched and at least mildly hungry, `retreat` scores
   `.45 + .6h + .2 × INTELLIGENCE` (1.18 at h .95) while `approach` is multiplied by `.35` (≥ .8 hunger) or `0` (below): 0.44 at .95.
   Retreat therefore always wins when watched. `skLost` (432–437) turns the finished retreat into `lure` (h ≥ .4) or nothing; the lure
   lasts `4 + 12 × h × PATIENCE` s and ends "the bait failed" → `skLeave` (886), cooldown 12 s at starving (308).
2. **"Hungry" leaves people in light even when they are unaware**: `leave = (1 − h) × 1.1 + .2 × CAUTION` (.69 at .5) beats
   `approach = 1.6h − .25 × CAUTION − .1 (lit)` (.53 at .5). Hunger below about .6 in a lit place means no hunt at all.
3. **It does not listen once it loses sight.** The engine names a sound only while the person is seen (`ai.intelligence.js`
   `identifySound`, 42–53: `seenAt` within .12 s). After line of sight is lost every footstep is anonymous (`e.hear` with `pid` null,
   an anonymous lead). But the hunting code follows only *named* sounds: the interception's correction (`r.heardAt > P.hAt`, 893) and
   the search's "fresher footsteps" (928) can never fire for somebody out of sight; `skListen` (448–457) runs only with **no plan**;
   `skHeardNear` (409–415) uses anonymous sounds only within 320 px of a waiting spot. The sounds exist; nothing uses them.
4. **A lost race ends the encounter**: `skAct` chase (870–871) → `skLeave(...).race = true`: a 1200–2200 px departure and a cooldown;
   B2 then forbids reconsidering a lost-race departure (749). No search, no shadowing, no return when the runner tires.
5. **Hard timers end hunts that still have live evidence**: the encounter budget `25 + 45h` s (291, 768, 820) counts waiting and
   searching too; `lureMax` 22, `interceptMax` 26, `searchMax` 16 + 2–4 s listening; each ends in `skLeave` or a return to roaming
   (`e.plan = null`), and with it the target and the encounter (`skLeave` 309). The memory of the person survives in `e.mem.p`, but no
   code reads it again until the person is *seen* again — the "alive" feeling stops at each timer.
6. **One guess, no second**: `skPredict` (346–391) returns one route (one seeded turn choice); a failed interception becomes a search of
   the *last known* place (921) or a departure. No alternative route, no memory of a failed spot, no use of a later sound.
7. **The departure cooldown hides fresh evidence**: `e.left` removes the person from what it may consider (753: `seen` excludes them);
   a very hungry departure can be thought over only on fresh *sight* of somebody **not** on that list (749).
8. **What it does is mostly invisible**: roaming pauses are `listen` with the body still; a hunt that loses sight goes straight to a
   route; there is no pause to listen, no head sweep, no creeping into a suspect corridor.

What is sound and kept: the senses (`ai.senses.js`: real field of view, line of sight, light, posture; fuzzy hearing with uncertainty;
memory confidence decay), the strike (wind-up, committed leap, contact-only kill, stamina cost, recovery), the race fairness (run 255
against a fresh sprint of 285; `chaseLose`), the disguise and speech, B1–B5's awareness / provocation / defence, the admin-only spawn.

## 4. Size on the page (`tools/scale_browser.js`, real server and Chromium; `evidence/r0_scale_before.*`, `r0_shots/`)

Measured in the page's own creatures layer, same camera, no debug overlay:

| Figure | Drawn size (local bounds, world px) | Collider |
|---|---|---|
| Skin-Stealer, undisguised | 49.6 × 61.5 (a 25 px torso; thin splayed limbs) | radius 24 (48 across) |
| Wanderer (a player) | 39.5 × 59.4 including hands and light; its body a solid disc about 38 px across | the player's |
| Hound | 86.2 × 162.5 | the Hound's |

The Skin-Stealer's outline is a little larger than a Wanderer's, but its mass is a thin 25 px torso with spread limbs, against the
Wanderer's solid 38 px disc: on screen it reads as the smaller figure (`r0_shots/scale_before_1280.png`), which is what the owner sees.
The renderer has no scale factor at all (`skin.body.js` `draw`: position and rotation only). The disguised form is the page's own
Wanderer avatar (`skinView`) and must stay that size.

## 5. Baseline tests (this tree, before any change)

| Run | Result |
|---|---|
| `npm test` | 202 / 215; the 13 failures are the inherited P9 ones, name for name as at B0 (`evidence/r0_npm_test.txt`, `r0_inherited_failures.txt`): P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18, L9, 2F F13, 2F F22. SK 34 / 34, BR 19 / 19 |
| `npm run test:humanqa` | 5 / 6; X03 fails as on P9 (`evidence/r0_humanqa.txt`) |

## 6. Constraints that shape the design

* Only `ai.skinstealer.js` (the species) and the Skin-Stealer's own page script may change. `ai.senses.js`, `ai.engine.js`,
  `ai.intelligence.js`, `ai.capture.js` are shared with the Hound and the Smiler and stay byte-identical (P9 equivalence).
* Anonymous sounds may steer it to a *place*; they may not name a person. A species-local belief ("my quarry is probably where that
  sound was") is allowed; the engine's attributed record (`e.mem.p`) is not touched by it.
* Top speeds and the strike's numbers stay; the race stays winnable by a fresh runner.
* No new act codes or snapshot fields are needed: `listen`, `creep`, `watch`, `wait`, `approach`, `search`, `intercept` and the head
  angle `h` (already sent) carry the new tells.
* The level's static shape (walls, junctions, lamps) is knowledge the creature may use (as in Trial 3); where a person really is, is not.
