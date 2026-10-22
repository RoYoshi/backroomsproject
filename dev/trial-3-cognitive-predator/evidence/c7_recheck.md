<!-- The independent reviewer's re-check of the C7 fixes at 9a8373a, verbatim except that absolute machine paths are replaced. -->
# C7 re-check of HEAD 9a8373a (fixes in 91de3eb) — engineering evidence, not owner acceptance

Same rules as the C7 review: read-only in the repository, scripts in `REVIEW`, targeted tests only.
- `REVIEW` = <REVIEW>
- New outputs are in `REVIEW/out2/`.

**Scope.** `git diff d708f42 9a8373a`, outside `dev/`, changes only the species file, `generated/server/ai.js` and the manifest. The generated diff lines equal the source diff lines.

**Tests run here.** `ONLY='^C(19|20|21|22|06|13|17) ' node dev/tests/run.js s_skincognitive.js` → 7/7 PASS. C19: 23 vs 100 stamina, same creature 24/24. C20: 0 pounces. C21: 0 of 19 hunted anyway. C22: longest still 6.4–8.3 s. C17: leaves at 14–29 s.

**Answers**

1. **F1 — the author's premise is sound, and F1 is closed.**
   - Every page receives each person's stamina (`src/core/server/loop.js:34`, `mv[2]`; `gib/client/mp.deaths.js` `peerMv`).
   - Every page draws a person under 22 heaving (`br-r/client/move.poses.js:23`).
   - So the creature's `r.stamina < SK.windedSeen` (22; ai.skinstealer.js:1185) reads exactly what a viewer sees.
   - Caveat for the owner: that cue is faint, a 1.4 % width pulse (the exhausted cue is about 2.8 % plus a hat bob).
   - No new hidden read found. The inherited ones are unchanged and minor:
     - the R3 freeze reads live facing on every tick (:1402, at most 0.1 s ahead of sensing);
     - light felt on its body includes unseen people's torches;
     - the engine's tier depends on true player distance.

2a. **F2 is correct, and it creates no new immunity compared with R8.**
   - `skCompany` gates the spring at :862.
   - Probe `exp_pairs.js` (two unaware walkers in file past the creature, .7/.95, 8 seeds; outputs `out2/pairs_*.txt`):

     | Pair | Runs with a kill, HEAD | Runs with a kill, R8 |
     |---|---|---|
     | 100 px apart | 0/8, 1/8 | 0/8, 1/8 |
     | 400 px apart | 3/8, 3/8 | 4/8, 3/8 |
     | Single walker (control) | 6/8, 3/8 | 6/8, 3/8 |

   - A pair that stays within 450 px is never sprung at, at any hunger (a grab at arm's reach still happens). That is R8's lone-ambusher outcome; state it to the owner as a design choice.

2b. **F3 is correct, and I found no bypass.**
   - Probe `exp_bold3.js` (C21's 72 runs, 60 s, plus a variant where the passer walks back past it; `out2/bold3_new.txt`): 19 passed over in each variant.
   - 0 were hunted or killed while the draw still said "pass over". After the let-go the creature only watches when it sees them again (about 86 s in total) or leaves; the sound → listen → search path never starts a hunt on them.
   - Residual hypothesis, a NIT: the draw is re-made whenever its attention moves to another person (a new encounter record).

2c. **F4 is fixed for the stand-off only. The symptom remains — MAJOR, still open.**
   - Probe `exp_stare3.js` / `exp_stare5.js` (watcher never looks away; lit hall at 450 and 300 px, plus the south-west; .45–.7; 6 seeds; 120 s; `out2/stare3_*`, `out2/stare5_*`).
   - HEAD has a stretch of 20 s or more standing still in the watcher's view in **19/108 runs (47–107 s each)**; R8 has 16/108.
   - `exp_stare4.js` traces show two causes, both inherited holds that ignore being in plain view:
     - **A flank that "arrived" in their sight:** reason "at P101's side, out of their sight" while seen, held 82–109 s until the effort budget ran out (hall450 .45 s2, .6 s2, .62 s3, .7 s5). The arrived flank keeps re-winning the decision (:1222).
     - **A C2 bait that "arrived round the corner" while still seen:** held 66–79 s (hall300 .6 s2; sw .6 s6, .62 s4, .65 s1; R8 has 0 such holds in the south-west). :1232 drops an arrived retreat only when it is *not* watched. Arrival also counts a route that ran out short of the spot (:1390).
   - C22 measures only C17's scene, so its title ("it is not a statue") overgeneralizes.
   - Required fix: an arrived flank or retreat that is still seen and watched for longer than a beat takes its next answer.
   - Regression test: `exp_stare5.js` should find 0 such stretches over 20 s.

3. **F5 — the pooled count is fair.**
   - `tools/c7_pool.py`, run on the nine pass files, reproduces `evidence/c7b_browser_pool.txt` exactly (R8 11/27, C6 20/31, fixed 14/23).
   - Its exclusions (setup miss; tool faults by pass and scene, fixed in the header; decoy hider with 2 or more skips) are applied evenly.
   - Caveats:
     - v1 and v2 logged no skips, so v2's decoys (R8 3/3 kills, C6 2/3) are unscreened.
     - The fixed build's decoy n is 2.
     - The stated limit (n cannot separate "smarter" from "deadlier") is right.

4. **Still open for handoff.**
   - No BLOCKER.
   - **One MAJOR:** the remaining motionless holds in plain view (2c). They are the owner's "passive" complaint and are not fixed outside the stand-off.
   - **Performance, MINOR and documented, not blocking:**
     - The "four pressed" pair's p99 was higher on this build in 3 of 4 matrices (+9, +53, +14 %; −19 % once) with the mean unchanged (±5 %), always within budget and the tool's tolerance.
     - The fixed build's red runs are 1 and then 2, against R8's 3 and 3.
     - Worth a profile of the per-think stand-off and press work (`skAim`/`directOk`, `skCompany` in `skStrike`, `skCircle`) before release.
   - **Everything else from C7** (F6–F13) is dispositioned as stated.
