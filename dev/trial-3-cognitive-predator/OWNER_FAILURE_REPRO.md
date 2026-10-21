# Trial 3 cognitive predator — the owner's failure, reproduced on R8 (C0)

**R8 (`trial-3-predator-refinement` at `f378049`) failed the owner's Human QA:** *"It's still incredibly passive and not as threatening as
I like... Not really smart either, and it needs to be more fast thinking and responsive."* This file names concrete, reproducible moments
on R8 where the Skin-Stealer chose badly or did nothing useful. Each is from R8's real server simulation
(`tools/c0_audit.js`, `evidence/c0_audit_r8.*`) or a real page (`tools/cog_browser.js`, `evidence/c0_browser_r8.*`), with its seed.
Nothing here is invented: the scores quoted are R8's own (`e.dbg.decide`), printed on the same seeds.

Seeds: `c0_audit.js` scene `W` runs `World(seed + 9100)`, `M` `World(seed + 9700)`, `L` `World(seed + 9400)`, `R` `World(seed + 9600)`,
`O` `World(seed + 9950)`; the person's script is in the tool. To see any one: `node dev/trial-3-cognitive-predator/tools/c0_audit.js
--only W --seeds 1` (the JSON's `tl` is the plan timeline).

## What R8 does well (not the problem)

* **Its first reaction is fast.** On the first think after a sighting it has already chosen (`choice` 0 s at every hunger, every scene),
  it faces the person (`orient` 0–0.5 s; the exception is BD7) and, when the choice is a hunting move, it moves (`move` 0.05 s).
* **It reacts quickly to a crossing runner** (scene `X`: turn-back seen → new plan p50 0.35 s, moving p50 0.23 s) and it **kills somebody
  circling a pillar** in its view at every hunger tried (scene `C`, .55 / .75 / .95: 6 / 6 each).
* **At .8 and above, a watcher dies** (scene `W`: 6 / 6 at .8 and .95).

So the owner's "passive" is not slow sensing. It is **what it chooses** in the hunger band the admin spawn gives (.45–.65) and the
**timers that hold a passive choice** once made.

## The bad decisions

### BD1 — watched at .45–.55, it backs out of sight, waits blind, and leaves (scene W, every seed)
* **Scene:** a lit person 450 px off in the long hall stands and keeps facing it. Hunger .5, seed 1.
* **Sensed:** the person, seen, watching it, in the light, from the first think.
* **R8 did:** `0.08 retreat` "seen by P101: it backs out of sight" → `5.2 lure` "it waits round the corner for them to follow" →
  `14.4 leave` "nobody came: it gives up" (a departure to 35 s). 45 s: no kill, no purposeful movement toward the person at all (at .45
  and .5, 5 and 4 of 6 runs never once moved with purpose; `W h=0.45/0.5 move none 5/4`).
* **Its scores at the first think:** retreat 1.29, leave 1.04, watch .88, flank .82, **approach .08**. Being watched multiplies coming on
  by `.15 + 1.1 x hs` (`hs` is 0 below .55 hunger): nothing a hungry creature can do while watched scores near the two passive answers.
* **Better, and feasible:** keep the person in sight from a less exposed spot (out of the lamp, at the same distance) and **use the
  moment they look away**; or go round them (it can: at .55 it does). Backing out of sight throws away the only evidence it has.
* **Why the lure fails as a tactic:** the "bait" spot is scored for being out of sight, never for whether somebody following would come
  within its reach; then it waits 9 s blind. A person who simply stands there has beaten it.
* **Repair (C1/C2):** while watched, a hungry creature holds a *stand-off with a purpose* — a vantage that keeps them in view — and its
  reaction to their looking away is immediate (the opening). The bait counts only when its spot gives an interception; a short wait
  then a peek, never 9 s blind.
* **Trade-off / negative counterpart:** at low hunger (< .4) leaving stays right; a person who keeps watching must still not be killed by
  a timer (it has to earn its opening).

### BD2 — a flank that worked is thrown away: "seen in the light" (scene W .55, seed 1)
* **R8 did:** `0.08 flank` → `3.70 approach` from the side, unseen, to 209 px of the person → `6.15 leave` "seen in the light".
* **Sensed at 6.15 s:** the person turned and saw it, 210 px away, in the light.
* **Its scores:** **leave 1.09**, retreat .93, watch .45, approach .10. The light-and-watched bonus to leaving (`.5 x (1 - hs)`) decides it.
  It had spent 6 s getting beside them and was 25 px outside its pounce range.
* **Better:** from 210 px, with stamina: press (a few creeping steps into reach, its wind-up shown) or hold beside them in the dark and
  wait for their glance to move; a hungry predator does not walk 20 s away from prey it has just outflanked.
* **Repair (C2):** "seen" changes how it comes on, not whether: being lit and watched makes it seek darkness or freeze, not depart, from
  hungry upward. **Negative counterpart:** the wind-up and the miss stay exactly as they are (PR07, PR21).

### BD3 — two people in view: it gives up at once (scenes M and L, every seed)
* **Scene M** (hunger .7, seed 1): a watcher 450 px off, and a second person 650 px off walking slowly, facing away.
  **R8:** `0.07 flank` then `0.42 leave` "more than one of them (2)" for 19 s — a plan begun and dropped in 0.35 s, and the unaware walker
  never considered (hunted 0 s in 17 of 18 runs at .55 / .7 / .9; at .9 it took the *nearest*, the watcher).
* **Scene L** (hunger .5 and .7): two unaware people facing away 400 px off → `0.02 leave` "more than one of them (2)" in every run; 2 s
  later one of them leaves the game — the other is alone, unaware, lit, and it is walking away, never to look again for 20 s.
* **Why:** `leave` gets `+ .7` per extra person and `approach` `x .35`; `skDecide` considers only `seen[0]`, the nearest.
* **Better:** a lone ambusher does not attack a group — but a hungry one **shadows** it from cover and waits for somebody to be alone,
  and it weighs who is the better chance (unaware, isolated) rather than who is nearest.
* **Repair (C2):** a "group" answer: observe from a vantage, bounded in time, target chosen by opportunity; R7's carried effort kept.

### BD4 — the lost race: 13 s of trailing behind (scene R, every seed, .75 and .95)
* **R8 did:** loses the race at 4.1–4.4 s, then `approach (shadow)` at .85 of the runner's speed for **12.7–12.9 s** until the runner
  turns out of sight; then listen, search. 0 kills (the race is fair — PR27).
* **Better:** at the moment the race is lost, *choose*: a different way round if one gets ahead of them (from the heading it saw), a
  place to listen or wait, or break off. A long slow follow is a resigned Hound, not a thinker.
* **Repair (C3):** a lost-race decision within a second; trailing only while it still gathers information (a few seconds); PR27's lead
  law kept to exhaustion and beyond.

### BD5 — watched at .65: long blind waits and a "seen in the light" exit (scene W .65, seed 2)
* **R8 did:** `0.02 retreat` (bait) → `2.47 lure` → **10 s waiting round the corner** while the person stands where they were →
  `12.6 listen` → `13.8 search` → `14.3 flank` → `17.5 approach` → `19.3 leave` "seen in the light". No kill at .65 in 6 runs.
* **Better:** the same as BD1/BD2: no 10 s blind wait with nobody coming; at .65 a flank that reaches them presses home.

### BD6 — in a real page: it sits in plain view "waiting round the corner" (browser, R8, hunger .54–.6)
* **Real page** (`evidence/c0_browser_r8.*`, `c0_shots/`, watched #1, hunger .54): a page stares at it from 450 px. It comes on in
  short stretches (approach 46 % of the 35 s) and backs off twice (retreat 25 %), waits "round the corner" while **still in the page's
  view** most of that time (out of view 2.2 s in all), then leaves (26 %); closest 189 px, no strike. Timeline: `1.0 approach`, `8.4
  retreat`, `13.6 approach`, `18.6 retreat`, `22.0 lure`, `22.3 approach`, `26.9 leave`.
* **Repair:** C1/C2 above; the bait spot must really be out of the person's sight and give an interception, or not be used.

### BD7 — slow to face somebody running circles round it (scene O, hunger .5)
* **R8:** a person running circles 170 px round it: it **faces them only after 2.2 s (p50; worst 3.5 s)**, because the first thing it
  does is stand and listen, turned to the sound, at a slow turn rate (`listen` turns at 2.2 rad/s; the person goes round at 1.7 rad/s).
  It still kills them in every run (approach once it has them).
* **Better:** a person *seen* close by and moving fast is the most salient thing there is: it should be faced on the next think.
* **Repair (C1):** a sighting interrupts a sound-listen at once; turn rate toward a close, fast, seen person raised within the
  creature's existing turning ability.

## Honest controls (R8 is right here, and must stay right)

* **U — nothing heard is nothing known.** Waiting round the corner, the person runs away 730+ px off: it hears nothing (no sound reaches
  it at that range) and its wait ends by its timer. No new rule may make it "know" they left.
* **R — the fresh runner wins** (PR27 to exhaustion). Any new lost-race tactic must keep that.
* **P — a passer-by at .45 in the light** is approached in 3 of 6 runs and ignored in 3: some restraint at the low end of hungry is
  correct (pack 04: "sometimes").
* **Satiated** (B1–B5, PR01/PR02): unchanged; R8 passes them.
