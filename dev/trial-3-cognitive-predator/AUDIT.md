# Trial 3 cognitive predator refinement — C0 audit (no game change)

Trial 3, B1–B5, the R predator refinement and this work are **not owner-approved**. **R8 failed the owner's Human QA** ("still incredibly
passive... not really smart... needs to be more fast thinking and responsive"). This audit measures R8 before anything is changed.

## Starting point (verified)

* Branch `trial-3-cognitive-predator-refinement`, created from `trial-3-predator-refinement` at
  `f378049a825e53eafc626a637b8c43397e4072f0` — GitHub read back: tree `a6d72690727a58dbab6e770dfda64a1d9dbf70f3`, parent
  `62a887e65e47e4a67f242a17c22faea098c8e702`, the pack's values. The new branch did not exist on the remote before.
* Protected heads unchanged at the start: `main` `7781e1a`, P9 `1ff9374`, `trial-3-skin-stealer` `020b5b5`, `trial-3-behavior-refinement`
  `4518f93`, `trial-3-predator-refinement` R8 `f378049` (now read-only). Every remote head before the first push:
  `inventory/remote_heads_before.json` (39 branches). Each push is read back by `tools/verify_remote_cp.py` (this branch's copy of R8's
  tool: the base is R8 and R8 is protected).

## How it was measured

* **`tools/c0_audit.js`** — R8's real server simulation (`dev/harness.js`) through scenes built from the owner's tests, 6 seeds each.
  For each stimulus the creature can legitimately sense, the tool measures from the first tick it really has the evidence: **orient**
  (facing within 0.5 rad, or turned 0.3 rad toward it), **choice** (a new plan or a hunt begun, against the plan it had *before* the
  evidence), **move** (moving over 40 px/s in a hunting plan, or springing); and over a run the longest **idle while seen** (still, hungry,
  seeing a living person, no strike), the plan timeline with R8's own reasons, kills, closest approach. It reads the creature only to
  report; it never feeds anything back. `evidence/c0_audit_r8.*`.
* **`tools/cog_browser.js`** — the same situations in real pages against a real server (headless Chromium): a page stares at it; a page
  runs circles round a pillar; two pages (a watcher, an unaware walker). The admin spawn's own hunger (.45–.65) — the band the owner meets
  first. `evidence/c0_browser_r8.*`, `c0_shots/`.
* R8's own decision scores (`e.dbg.decide`) were printed for the moments quoted in `OWNER_FAILURE_REPRO.md`.

## Results on R8 (6 seeds per row; the full lines: `evidence/c0_audit_r8.txt`)

| Scene (hunger) | Kills / runs | First sighting: no purposeful move at all | Typical plans (R8's own) |
|---|---|---|---|
| W watched, standing, 45 s (.45 / .5 / .55) | 0 / 6 each | 5 / 4 / 3 of 6 | retreat → lure (9–10 s blind) → leave; or flank → approach → leave "seen in the light" |
| W watched (.65) | 0 / 6 | 0 | flank → approach → retreat → lure (10 s) → listen → search → leave |
| W watched (.8 / .95) | 6 / 6 each | 0 | flank → approach → kill; approach → kill |
| X crossing runner, turns back (.5 / .65) | 3 / 6, 2 / 6 | 0 | approach → listen → search…; turn-back answered in 0.35 s p50 (choice), 0.23 s (move) |
| C circling a pillar 500 px off (.55 / .75 / .95) | 6 / 6 each | 0 | approach (→ watch) → approach / chase → kill |
| L two unaware people, then one alone (.5 / .7) | 0 / 6 each | — | leave "more than one of them" at 0.02–0.1 s; the one left alone never looked at again |
| U lure, the person runs off 730 px away (.5 / .55) | 0 / 6 each | — | retreat → lure → leave (nothing heard: an honest control) |
| R the straight race (.75 / .95) | 0 / 6 each | — | chase → **12.7–12.9 s trailing** → listen → search |
| M a watcher and an unaware walker (.55 / .7 / .9) | 2 / 6, 1 / 6, 4 / 6 | — | flank → leave "more than one" (0.35 s later); at .9 the nearest (the watcher) taken |
| F a glimpse at a fork (.75) | 3 / 6 | — | approach → (sight lost) listen 0.58 s → intercept / search |
| P a passer-by in the light (.45 / .55) | 3 / 6 each | 0 | ignored in 3 of 6 at both |
| O circles round the creature itself, 170 px (.5) | 6 / 6 | 0 | listen → (faces them after **2.2 s p50**, 3.5 s worst) → approach → kill |

Latency on R8 (all scenes): the first choice is made on the think of the first sighting (0 s); orientation 0–0.5 s except O; a
chosen hunting move starts in 0.05 s. **Idle while seen** never exceeds 1.3 s except one M run (5.2 s): R8 does not stand idle in view —
it **goes away** (out of sight, or a departure).

**Real pages** (`evidence/c0_browser_r8.*`, admin spawn hunger .50–.65, 35 s each, two tries per scene): in the four tries where the
creature saw the page it **never struck the watching page**: watched #1 (.54) approach / retreat / lure / leave, closest 189 px;
circle #1 (.58) approach / watch / retreat / intercept / leave, closest 404 px; circle #2 (.50) **leave 83 % of the time**; crowd #1 (.54)
it took the unaware walker (a kill, then fed) while the watcher stood 220 px off. **Two tries were setup misses, not gameplay:**
watched #2 and crowd #2 — the creature never made any decision about a page (plan `roam` throughout); the page had been put where it
could not see it (the tool did not check). `cog_browser.js` is fixed at C1 to put the page in the lit hall and record when the creature
first sees it; both misses are kept in the evidence as they ran.

## Diagnosis

The pack asks to separate reaction, reasoning and presentation failures.

**Reaction — mostly not the problem.** R8 decides on the same think as the first sighting (choice 0 s in every scene), faces the person
within 0–0.5 s, and moves at once when it has chosen to move (0.05 s). A crossing runner who turns back is answered in 0.35 s (p50). The
near tier thinks every 0.1 s and that is fast enough. One real reaction fault: **a person running circles close round it is faced only
after 2.2 s (p50)** because a heard sound first puts it into a slow `listen` (BD7).

**Reasoning — the main problem.** In the hunger band an admin spawn gives (.45–.65):
1. **Being watched leaves only passive answers.** Coming on while watched is multiplied by `.15 + 1.1 x hs` (`hs` = 0 below .55): at .5
   the scores are retreat 1.29, leave 1.04, watch .88, flank .82, approach .08 (BD1). Retreat takes it out of sight, the lure then waits
   blind 9–10 s for a person who has no reason to follow, and it leaves. In 45 s of a person standing and staring, at .45–.55 it usually
   never moves toward them at all.
2. **"Seen in the light" is a reason to leave** (`.5 x (1 - hs)` on leave when lit and watched), even after a successful flank that put it
   210 px from them (BD2, BD5).
3. **Two people in view: leave** (`+.7` per extra person on leave, `x .35` on approach), and only `seen[0]` (the nearest) is ever
   considered (BD3).
4. **The lost race is followed by ~13 s of trailing** at .85 of the runner's speed with nothing else considered (BD4).
5. **Timers hold passive plans:** the lure (4 + 12 x hunger x patience s; 9–10 s here), a departure (up to 45 s, reconsidered only at
   ≥ .6 hunger, after 4 s, once a second), the watch (2–7 s). The bait spot is chosen for being out of sight, not for giving an
   interception.

**Presentation — secondary.** Its movement shows what it decides (backing away, waiting, leaving); the decisions are what read as
passive. No art or pose change is warranted by this evidence (pack 04: `BODY_SCALE` 1.3 stays).

## Architecture chosen (C1–C4), inside the species file

The pack's four loops (`02`), built from what R8 already has (`e.hunt`, plans, sight records, sound belief, `skPredict`, routes,
seeded streams) — no new module system, no engine change.

* **A. What changed (perception → events).** On each think, from its own records only: a new sighting, a sighting lost, eye contact
  begun / ended (the person's facing is part of seeing them — R8's `skWatched`), the person turning back / speeding up / stopping,
  a fitting sound, a tactic proved impossible. Small, deduplicated, kept in a bounded per-creature record for QA (`e.cog`), never sent
  to players.
* **B. Interrupts.** An event that defeats the premise of the plan under way ends it at once (an opening while it holds a stand-off; the
  person it waits for walking away audibly; a sighting during a sound-listen); cosmetic changes never do. R8's hysteresis
  (`SK.rethink`) stays for low-value flicker.
* **C. A small tactical choice for a seen quarry, from hungry upward.** Instead of retreat → blind lure → leave: a **stand-off with a
  purpose** (hold, or move to a darker vantage that keeps them in view at a similar distance, facing them; **advance when they look
  away**, freeze when their eyes come back — a watcher holds it, an inattentive one is closed on), a **flank** (R8's, kept), **pressure**
  (coming on while watched, from very hungry, or close by with a viable reach), a **bait** only where the corner gives an interception
  (then a short wait and a peek, never 9 s blind), **leave** at low hunger or when it is genuinely hopeless. **Two people**: no attack on
  a group, but a hungry one shadows it from a vantage and takes the one who becomes the better chance (unaware, apart). **A lost race**:
  a choice within a second — a different way round when its own route can beat them there (R8's `skPredict` timing), a few seconds of
  trailing to see where they go, or break off — PR27's lead law kept.
* **D. Commitment.** `e.hunt` and R7's carried effort unchanged; timers become ceilings rather than the reason a plan ends; every exit
  states a reason.
* **C3 later:** a person seen going round the same obstacle again (laps observed, never inferred behind a wall) gives a fading guess of
  where they come out; a cut-off the other way round, which a reversal defeats.

**CPU envelope.** All of this runs on the existing 10 Hz think; candidate places are scored by straight lines and the level's own lamp
field, and only the best one or two get a real route (as R8's flank does); PR24 counts every route it searches.

**Fairness laws unchanged** (and re-proved at C5): speeds, stamina, the wind-up, contact, sight and hearing rules, the fresh runner's win
(PR27), carried effort (PR28), admin-only, cap 4.
