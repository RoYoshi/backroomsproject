# Trial 3 R20 - the combined Human QA worksheet

Trial 3 is **not owner-approved**.  Engineering checks are not a gameplay verdict; this sheet is yours.  The branch is
`trial-3-r20-combined-humanqa`: R19 combined with all three R20 parts.

| part | what it is | its own branch |
|---|---|---|
| the N track | the open-air STUCK fixed at its two causes, and the opt-in head swivel | `trial-3-r20-nani-head-watchdog` |
| the S track | the strategic hunter | `trial-3-r20-strategic-ambush` |
| the kill-visibility fix | your addendum | `trial-3-r20-kill-visibility` |

Each branch has its own notes, if a scene here needs telling apart.  Nothing is merged or deployed.  Every value is a proposal (`SK20` in
`ai.skinstealer.js`, `HEAD_SWIVEL` in its caps).

## Start it (your machine, a private test)

```
git fetch origin
git checkout trial-3-r20-combined-humanqa              # (or: git worktree add ../r20-c origin/trial-3-r20-combined-humanqa)
npm run build:check                                     # the generated files are the sources' build (no change expected)
ADMIN_PASSCODE='<a new passcode of your own>' node server.js
```

Open the game in up to four browsers (or four people), in the same online room.
- **Admin:** press backtick and sign in with your passcode.  `K` (panel open, not typing) shows the SKIN tab.
- **Spawning:** `+ NEAR ME` spawns one Skin-Stealer, four at most; there is no organic spawn.  Hounds and Smilers come from the director
  as in R19.  The DEATHS tab plays a chosen kill.
- **Debug:** `DEBUG` shows each creature's label: its plan, why, its fatigue belief (`fat`), and the red `STUCK` when its stuck timer is
  over .15 s.  Turn the overlay off for the real feel.
- **Hunger:** to make it hungry quickly, step away, set WORLD SPEED 3x, then back to 1x before you judge anything.

Never paste your passcode anywhere.

## The scenes (each: PASS / MIXED / NEEDS CHANGES / NOT CHECKED, and a line of what you saw)

**The open-air STUCK (the N track, W1/W2)**

| # | scene | what R20 should show | verdict | notes |
|---|---|---|---|---|
| W-A | DEBUG on: let a Skin-Stealer roam, turn round, wait at corners, feed, go there and back | no red `STUCK` on open floor; no "stuck: the watchdog cleared its route" and the turn-away that followed (your "retreat") |  |  |
| W-B | Stand in a narrow doorway it wants to pass, or make it walk into a prop | `STUCK` may show *here*: real obstruction is still caught and recovered (side-step, new route), never a teleport |  |  |
| W-C | A Hound and a Smiler turning round | no `STUCK` flicker at their turns; otherwise exactly R19 |  |  |

**The strategic hunter (the S track)**

| # | scene | what R20 should show | verdict | notes |
|---|---|---|---|---|
| S-A | Walk a long route in the dark past where it lurks, hungry (~.7) | sometimes it is **waiting where you will come out** - beside the way, out of sight - and springs as you pass (0.22 s wind-up) |  |  |
| S-B | Walk toward it in the dark, unaware of it | it may simply wait where it stands and take you as you arrive |  |  |
| S-C | Let it see you far off, walking on | it may go ahead to a spot beside your way, at a walk, and wait |  |  |
| S-D | Take another corridor than the one it guessed | it can be wrong: it waits in vain, then searches what it last heard |  |  |
| S-E | Watch it at hunger .6 and .85 in a lit hall | attentive, credible, **less** headlong running; still a threat |  |  |
| S-F | Sprint straight away from it when it chases (fresh: 285 against its 270) | you get away; its run is ~15 % shorter before it tires (7.1 s against 8.4) |  |  |
| S-G | Fake being winded (stop, walk slowly) or sprint long with breath to spare | its belief can be wrong (DEBUG `fat`); it never reads your meter |  |  |
| S-H | Walk 600 px from it, then crouch, then run | it hears a walk about as far as you hear its walk (~680 px); **crouching is as quiet as in R19**; walls muffle |  |  |
| S-I | Four people: split up, cluster | it goes after what it saw or heard; an unseen person is never named from a sound |  |  |
| S-J | R18/R19's head snaps, stares, flanks worth taking | still there |  |  |

**The head swivel (the N track, W3)**

| # | scene | what R20 should show | verdict | notes |
|---|---|---|---|---|
| H-A | Watch it walk a route with bends, nobody in its view | its head leads into each bend a moment before its body turns (up to ~50 degrees, less at a run), then straightens |  |  |
| H-B | Stand just round a corner it is about to take | it sees you only when the line opens: the head turned at the wall shows it nothing behind it |  |  |
| H-C | Stand beside it as it looks one way, then the other | the head you see is where it looks: if its head is turned away from you, you are out of that side of its view |  |  |
| H-D | Its snaps at a sound, its stare at you | unchanged: fast, whole, spooky |  |  |
| H-E | A Hound's and a Smiler's heads | exactly R19's |  |  |

**Kill visibility (your addendum)**

| # | scene | what R20 should show | verdict | notes |
|---|---|---|---|---|
| K-A | Two Skin-Stealers close together; one kills you (DEATHS tab or a real kill) | the other stays drawn, opaque, the whole time; the killer appears once (its attack), never twice |  |  |
| K-B | The same, seen from a second player | the same |  |  |
| K-C | Each kill variant, the Rend (D) too; four Skin-Stealers, two kills at once | the same each time |  |  |
| K-D | A player joining or reconnecting while a kill plays | the same (this machine could not join inside a 3.5 s kill: please try it) |  |  |
| K-E | Two Hounds together, one kills a player, seen by **another** player | known, not fixed: the spectator's page may hide the other Hound instead (R19's rule; the fix changes the B++ protocol: your call) |  |  |
| K-F | A Hound's or a Smiler's kill beside a Skin-Stealer | the Skin-Stealer stays drawn |  |  |

**The Hound and the Smiler**

| # | scene | what to look for | verdict | notes |
|---|---|---|---|---|
| M-A | Hound chases, lunges, pack, corners | exactly R19 (the simulation study: identical in every one of 1,044 seeded chases) |  |  |
| M-B | Smiler lurks, rushes, light rules | exactly R19 |  |  |

## Your judgment

- Does it feel **cleverer and more terrifying because it is waiting for you where you will go**?  ______
- Is the shorter run the right trade (fewer long open chases, more ambush)?  ______
- Hearing: too sharp, right, too dull?  ______
- Anything that felt like cheating (it knew where you were without seeing or hearing you)?  ______

Overall: PASS / MIXED / NEEDS CHANGES / NOT CHECKED - ______
