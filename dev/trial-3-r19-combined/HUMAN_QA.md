# Trial 3 R19 - the combined Human QA worksheet (S + N)

Trial 3 is **not owner-approved**.  Engineering checks are not a gameplay verdict; this sheet is yours.  The branch is
`trial-3-r19-combined-humanqa`: R18 with both R19 tracks - the Skin-Stealer's positioning before a chase (S) and the shared cornering fix
(N).  It exists for this sheet only; nothing is merged or deployed.  Each track alone is on its own branch with its own sheet
(`dev/trial-3-r19-positioning/HUMAN_QA.md`, `dev/trial-3-nani-corners/HUMAN_QA.md`) if a scene here needs telling apart.

## Start it (your machine, a private test)

```
git fetch origin
git checkout trial-3-r19-combined-humanqa              # (or: git worktree add ../r19-c origin/trial-3-r19-combined-humanqa)
npm run build:check                                     # the generated files are the sources' build (no change expected)
ADMIN_PASSCODE='<a new passcode of your own>' node server.js
```

Open the game in up to four browsers (or four people), join the same online room.  Admin: press the backtick key, sign in with your
passcode, `K` (panel open, not typing) shows the SKIN tab, `+ NEAR ME` spawns one Skin-Stealer (at most four; there is no organic spawn);
Hounds and Smilers come from the director as in R18.  `DEBUG` shows each creature's label - for the Skin-Stealer, new in R19, its last
positioning choice and why (`ps`).  Turn the overlay off for the real feel.  To make it hungry quickly, step away, WORLD SPEED 3x, then
back to 1x before you judge anything.  Never paste your passcode anywhere.

## The scenes (each: PASS / MIXED / NEEDS CHANGES / NOT CHECKED, and a line of what you saw)

**The Skin-Stealer's positioning (S)**

| # | scene | what R19 should show | verdict | notes |
|---|---|---|---|---|
| S-A | Let it see you at hunger ~.6-.7 in a lit hall, then **walk away** looking back | no vanishing on a long way round after a walker; it comes on, stares, gives chase, or lets you go - never the back-off bait for a walker |  |  |
| S-B | **Stand still** and watch it from ~450 px, its hunger high (~.85) | it comes on openly instead of disappearing for ~10 s round the block |  |  |
| S-C | The same at moderate hunger (~.7) | it may still go round you (R13-R18's flank) - does that still feel "clever but absent"? |  |  |
| S-D | Stand at a **junction** with a side passage, it coming from far down another hall, hungry | it angles toward your side way out before closing; bolt early the other way and you get away |  |  |
| S-E | Walk off **while** it is on its way round you, where it can see you go | it gives the way round up and comes on (or watches) - not the bait |  |  |
| S-F | Fool it: double back, hide silently, take the other door | it can be wrong; it recovers from evidence, never knows where you went |  |  |
| S-G | **Fresh sprint** in a straight line when it gives chase | you still pull away (285 vs its 270); stare, head snap, press, spring and kills as R18 |  |  |
| S-H | Four people: split up, group, sprint into each other | it takes real openings it can see; no switching to somebody it never saw |  |  |
| S-I | Make it vault a low prop mid-hunt, then make it fight or spring | it lands first, then acts (for your sign-off: up to 0.56 s committed to the vault) |  |  |

**Cornering, every species (N)**

| # | scene | what to look for | verdict | notes |
|---|---|---|---|---|
| N-A | A **Hound** chasing you round a broad 90 degree corner | less stop-and-pivot at the bend; still fast, still swinging wide - ferocious, not polished |  |  |
| N-B | A Hound round a **narrow** bend or doorway | still physically honest; never through the wall |  |  |
| N-C | A **Skin-Stealer** running a bend | its body turns without a robot pivot or shoulder scraping |  |  |
| N-D | A **Smiler**'s rush round a corner | the same Smiler: light and reactive rules unchanged |  |  |
| N-E | Vaults, crawls and tight gaps | unchanged |  |  |
| N-F | Walk far away and come back while they move | no visible jumps as they come back into view |  |  |

**Together (the pack's combined questions)**

| # | question | verdict | notes |
|---|---|---|---|
| C-A | Is the Skin-Stealer's new positioning physically expressed in good movement (its approach to your way out, its turn onto you)? |  |  |
| C-B | Is the chase at least as fun as R18's? |  |  |
| C-C | Do four-player sessions still feel fun - not too lethal, not too passive? |  |  |
| C-D | Do the Hound and the Smiler stay fair and distinct? |  |  |
| C-E | Anything slower, floaty, twitchy or unfair? |  |  |

**Owner verdict, combined:** PASS / MIXED / NEEDS CHANGES / NOT CHECKED  ____________

Overall Trial 3 approval is a separate decision of yours; a verdict here does not merge or deploy anything.
