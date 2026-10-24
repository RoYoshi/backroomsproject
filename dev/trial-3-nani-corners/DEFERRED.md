# Trial 3 R19, N track - deferred and not done

Trial 3 is **not owner-approved**.

## Seen in the audit, not changed (with reasons)

- **Wall skimming at walking pace.**  At roam/approach/walk paces every species' body passes within 0.24-0.8 px of walls on most routes
  (25-29 of 40 for the Hound's and the Smiler's walk) and the carrot slides round a clipped corner 650-870 ticks per 40 routes: the
  carrot's line test at collider + 0.5 px is R8's design for narrow halls.  No body enters a wall (contacts at those paces 5-15 per 40
  routes, no hard bonks).  A wider margin would move every species' walking line everywhere - a bigger change than this QoL; left for the
  owner to ask for if the skim shows on screen.
- **Corner braking's model** (`cornerSpeed`: room 115 px for a Hound, 80 px for the others; braking 2.2 x acceleration, late) is each
  species' character; two variants were measured worse (DESIGN_DECISIONS N1-c, N1-d).  The Hound still swings wide and dips its speed
  before a hard bend (route 23: to ~150 px/s for a moment, where R18 went to 29 and pivoted).
- **Far tier**: `coarseMove` and the tier switch untouched.  One R8-R18 behaviour seen in R19's simulations (the S track's
  `prechase_sim.js --log 1`): a body whose tier goes far mid-vault is left over the vaulted prop; the engine's watchdog sets it back on open
  floor when it is next simulated (seen only at the mid tier, 1900+ px from every player).  A fix belongs here (the shared engine) but
  changes every species' tier switch; it needs the owner's word.
- **Render heading**: the page draws the server's heading; nothing on the client changed (no orientation easing added).
- **Lap chases are chaotic** (the owner's "never weaker" study): a creature started 1 px off changes about a quarter of lap chases round a
  wall island, by up to 35 s, on R18 itself.  Where the hunk acted in a lap the outcome moved the same way - mostly 0.05-0.13 s sooner,
  twice ~11 s later (one lap scene), and NV05's one Hound lap 2.7 -> 7.4 s.  Recorded, not "fixed": no systematic loss was found, and
  turning the hunk off for a species would bring back the stop at the bend.  A per-species opt-out (one flag read in the hunk) is the
  fallback if the owner's play finds a species weaker (HUMAN_QA N-H).
- **Real-page single tries vary** (the owner's threat and focused scenes): F2 and S5 failed on N's first pass; repeated, F2 is a coin-toss
  on R18 too, and S5 on the server gives the same answers on every tree (BROWSER_AND_MEDIA).

## Not in this track

Any species' AI (the Hound's, the Smiler's, the Skin-Stealer's decisions: the S track has its own branch), the Hound's future primal blind
pursuit, OVERSEER v2, Red Rooms, HANDS/POCKET, corpse dragging, global difficulty, unrelated technical debt; any merge or deployment.
