# Trial 3 R19, S track - the owner's Human QA worksheet

Trial 3 is **not owner-approved**.  Engineering checks are not a gameplay verdict; this sheet is yours.  The branch is
`trial-3-r19-prechase-positioning` (S only: R18 + the Skin-Stealer's positioning before a chase).  For S and N together, use the QA-only
branch `trial-3-r19-combined-humanqa` and its own sheet (`dev/trial-3-nani-corners/HUMAN_QA.md` covers N alone).

## Start it (your machine, a private test)

```
git fetch origin
git checkout trial-3-r19-prechase-positioning          # (or: git worktree add ../r19-s origin/trial-3-r19-prechase-positioning)
npm run build:check                                     # the generated files are the sources' build (no change expected)
ADMIN_PASSCODE='<a new passcode of your own>' node server.js
```

Open the game in up to four browsers (or four people), join the same online room.  Admin: press the backtick key, sign in with your
passcode, `K` (panel open, not typing) shows the SKIN tab, `+ NEAR ME` spawns one (at most four; there is no organic spawn).  `DEBUG` shows
each creature's label: its plan, hunger and - new in R19 - its last positioning choice and why (`ps`), e.g. "its way round P101 would take
10.2 s (against 1.7 s coming on; it may spend 6.2 s more): approach".  Turn the overlay off for the real feel.  To make it hungry
quickly, step away, WORLD SPEED 3x, then back to 1x before you judge anything.  Never paste your passcode anywhere.

## The scenes (each: PASS / MIXED / NEEDS CHANGES / NOT CHECKED, and a line of what you saw)

| # | scene | what R19 should show | R18 for comparison | verdict | notes |
|---|---|---|---|---|---|
| S-A | Let it see you at its hunger ~.6-.7 in a lit hall, then **walk away** looking back | it does not vanish on a long way round after somebody walking off; it comes on, stares, gives chase, or lets you go - never the "back off round a corner" bait for a walker | began a way round, dropped it a moment later, or baited and vanished ~9 s |  |  |
| S-B | **Stand still** and watch it from ~450 px in the lit hall, its hunger high (~.85) | it does not disappear for ~10 s round the block; it comes on openly (the press you liked) | went round in most tries (7 s out of sight) |  |  |
| S-C | The same at moderate hunger (~.7) | it may still go round you (R13-R18's flank) - the owner's choice whether that still feels "clever but absent" |  same |  |  |
| S-D | Stand at a **junction** with a side passage, it coming from far down another hall, hungry | it angles toward your side way out before closing (not straight at you); if you bolt early the other way, you get away | straight at you |  |  |
| S-E | Walk off **while** it is on its way round you, where it can still see you go | it gives the way round up and comes on (or watches) - not the bait; out of its sight it carries on as R18 did | went on to its spot and waited ~10 s |  |  |
| S-F | Fool it: double back, hide silently, take the other door | it can be wrong; it recovers from evidence, never knows where you went |  |  |  |
| S-G | **Fresh sprint** in a straight line when it gives chase | you still pull away (285 vs its 270); its chase, stare, head snap, press, spring and kills unchanged | the R18 chase |  |  |
| S-H | Four people: split up, group, sprint into each other | it takes real openings it can see; no switching to somebody it never saw |  |  |  |
| S-I | Make it vault a low prop (a counter) mid-hunt, then make it fight or spring | it lands first, then acts - never slides through a wall | could pass through things after an interrupted vault (rare) |  |  |
| S-J | **Never weaker** (your addendum): is it anywhere less of a threat than R18 - slower to come, more hesitant, fewer openings taken? | no: on 348 seeded chases it caught 305 to R18's 304 and attacked 374 times to 367 (REGRESSION "Never weaker") | the baseline |  |  |

**For your decision (fairness):** at the junction, a hungry one 550 px off now heads for your side passage first - in the simulation
that way out went from 8/8 escapes (R18) to 0/8, while sprinting the other way along the hall still escaped 8/8 (S-D).  Whether one
exit being closed and the other open is fair enough is yours to judge; `SK.contestFrom` / `SK.contestOff` are the knobs, and the contest
applies only to somebody standing.

**For your sign-off (a deliberate change you may not want):** a vault, once begun, is now carried through like a strike - for up to its
vault time (0.56 s) it neither thinks nor springs.  R8-R18 let a decision move the body mid-vault (through the prop, rarely 830 px at once
when the follower next ran).  If the short commitment feels wrong in play (S-I), the alternative is to end the vault early at a clear point
instead - an engine-side change for you to authorize.

**S-track questions (the pack's):** Does it choose a meaningful position before a chase?  Does it take openings promptly without becoming a
mindless Hound?  Does the old stare feel more menacing through action?  Does a skilled player fool it sometimes?  Do bad detours still
occur?  Does a straight sprint escape when fair?

**Owner verdict, S track:** PASS / MIXED / NEEDS CHANGES / NOT CHECKED  ____________

Overall Trial 3 approval is a separate decision of yours; a verdict here does not merge or deploy anything.
