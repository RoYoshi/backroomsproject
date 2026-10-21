# Trial 3 behaviour refinement — owner Human QA (10–20 minutes)

**Status: NEEDS CHANGES until you have played it** (the default of `07_OWNER_QA_AND_STOP_RULES.md`). Nothing here is owner-approved:
not Trial 3, not this refinement, not its numbers (`BALANCE_TABLE.md`), not the art (still the interim T5 figure).

**What to run:** branch `trial-3-behavior-refinement` at the hash in the handoff message (a commit cannot name its own hash).

```
git fetch origin trial-3-behavior-refinement
git checkout --detach origin/trial-3-behavior-refinement
git log -1 --format=%H       # compare with the handoff
npm run build:check          # should say PASS (44 outputs)
ADMIN_PASSCODE=<a passcode of your own> node server.js
```

Open `http://localhost:8000`, start an online run. Two tabs (or two browsers) for parts 4, 7 and 8. **Mark what you saw**; skipped =
NOT CHECKED. Each meeting is the creature's own seeded choice: if something does not happen, try again or spawn another.

**Setup.** Press **`** (backquote), unlock with your passcode, press **K** with the panel open (not in a text field): the **SKIN** tab
appears. **+ NEAR ME** puts one near you. **DEBUG** tab → overlay on, and **ENTITY LABELS: FULL** (in COMPACT the new lines are not
drawn). Its lilac label now has two more lines:

* `AWARE P<n> <pressure> <noticed | provoked | threatened> (<why>) seen <s>s ago, <d>px, warned <k>x   REACT look|warn <s>s: <why>   LEAVE: <why kept / given up>`
  — the person it has noticed most. *why* is what it saw them do: *close by*, *crowding it*, *circling it*, *following it*,
  *in its way*, *pressing in after its warning*. It appears only for somebody it has actually seen; the tier shows `-` until it has
  noticed them (pressure 0.12).
* `DEFENCE P<n> struck | withdrew <s>s ago (odds <x>, cornered)` — after it defended itself.

HUNGER, PLAN and WHY are Trial 3's lines (the hunt). Try each part once **without** the overlay too: the point is how it reads.

## The focused test

1. **ROAM — it notices you.** Light on. Walk round it at a few metres, crossing in front of it, more than once. Expected: it stops
   and turns to face you for about a second (a *look*), then goes on; while it walks its head keeps turning toward you. Running round it,
   sooner. It does **not** notice you behind a wall or while you are behind its back and silent; footsteps behind it make it turn toward
   the noise, not toward you by name.
2. **LEAVE — it is not blind while leaving.** Wait for PLAN `leave` (DISAPPEARING; it often follows a meeting). Follow close behind it,
   cut across its way, run circles round it. Expected: it may keep leaving, but it looks at you, and if you keep at it, it **warns**
   you: stops, faces you, hunches and backs away slowly for 1–2 s, then takes another way out. One brush past: at most a look; it
   carries on leaving.
3. **BACK OFF.** After a warning, walk away or break its sight. Expected: the pressure number falls (well under 0.12 within about 15 s);
   it does not follow you, hunt you or come back for you because of it.
4. **SATIATED — defence, not hunger.** There is **no hunger slider**; a real kill lowers its hunger. Tab A: stand by it, SKIN tab →
   **NECK BREAK** (the preview plays the death on you through the real kill path, by the nearest Skin-Stealer). It feeds on tab A's body;
   HUNGER drops (a kill takes 0.35, feeding about 0.03 a second). **Within 8 s**, bring tab B into its view to disturb the meal (fed
   longer than 8 s undisturbed it would earn tab A's skin, and in a skin it does not react: part 8). HUNGER should now be in its lowest
   band, under 0.2 (a second preview death after tab A respawns takes it lower). With tab B, keep very close (AWARE's distance under about 100 px),
   facing it, following it as it moves, cornering it if you can. Expected: looks, then a warning, then — if you persist — a **defence**: either
   it withdraws (goes off at a trot) or it crouches for half a second (the pounce's click and breath) and lunges a short way. Only body
   contact kills; it is one of Trial 3's deaths, one corpse, your light dropped beside it. Step sideways during the crouch: it misses,
   recovers about a second and leaves you. A determined presser was killed after 7.5 s at the earliest in the tests; often it takes
   longer, and sometimes it only withdraws. (In the simulation, somebody who stays within 60 px of it for a minute: its first decision
   typically comes about 7.5 s in and is a strike about one time in three; otherwise it withdraws and can decide again 25 s later, more likely to
   strike. 157 of 200 such runs ended in a kill within the minute.)
5. **BRIEF CONTACT IS SAFE.** With a satiated one, walk straight past it once, close, without stopping. Expected: at most a look. No
   warning, no defence. (A **hungry** one still grabs anybody in arm's reach: that is Trial 3's hunt, unchanged.)
6. **WALL.** Provoke it, then stand across a wall corner or a low obstacle from it, close. Expected: no strike through or across it.
7. **TWO PLAYERS.** Tab B harasses it; tab A stands still nearby in its view. Expected: only B is warned or attacked; A gets at most a
   look (AWARE shows whom it means). After a defence it does not turn on A.
8. **IN A SKIN.** Let it feed undisturbed on a preview death until it wears tab A's look (after a preview kill about 8–12 s of feeding;
   Trial 3's sheet says 20–35 s for a meal from higher hunger). Circle it
   with tab B. Expected: no look, no warning, no defence — it walks up openly as before; its lines are its own.
9. **BASELINE.** Without a Skin-Stealer the game is P9's (Hound, Smiler, chat, credits, the red-only death, sounds). With one, the
   Hound and the Smiler behave as before. No new screen flashing.
10. **LOOK AND FEEL.** Does it seem cunning and aware rather than a robot on rails or an aggro-chaser? Is the warning readable from
    above, and is the half-second crouch a fair tell? Too quick to kill a presser, or too forgiving? (The numbers that set this are listed
    under "For the owner to judge first" in `BALANCE_TABLE.md`.)

The deterministic version of part 4 (hunger exactly 0, eight seeds) is BR08 in `node dev/tests/run.js s_skinbehave.js`;
`node dev/trial-3-behavior-refinement/tools/br_dump.js --only BR08` writes every run's record, and `--wide 200` runs the same pressing over
200 seeds.

## Optional

Trial 3's full sheet (`dev/trial-3-skin-stealer/HUMAN_QA.md`, 45–60 minutes) still applies unchanged to everything this pass did not touch.

## Your decision

* **NEEDS CHANGES** — with the reproduction, the hash, what you expected and what you saw (a screenshot or video helps).
* **ACCEPT** — only if you say so after playing; it authorizes no merge and no deploy.
* **BLOCKED / DECISION NEEDED** — if the behaviour you want needs something listed in `DEFERRED.md`.
* **ROLL BACK** — leave this branch unused; Trial 3 (`trial-3-skin-stealer`, `020b5b5`) and P9 are untouched.
