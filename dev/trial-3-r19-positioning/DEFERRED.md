# Trial 3 R19, S track - deferred and not done

Trial 3 is **not owner-approved**.

## Seen, not changed here (with evidence)

- **A body left over a vaulted prop when its tier goes far mid-vault** (R8-R18 engine behaviour, ai.engine.js `onTier` clears the vault).
  `prechase_sim.js --log 1`: 2 times in 108 h of the S tree's ordinary play (OVER lines "stuck: the watchdog cleared its route", 68-70
  px), none in 108 h of R18's - each at the **mid** tier, i.e. 1900+ px from every player, and recovered by the engine's watchdog (it sets
  the body back on the nearest open cell).  The mechanism is shared by every species and lives in the shared engine (the N track's
  territory, locked for the S track); S's carried-through vault keeps the body on the vault's line until it lands, so a far switch inside
  that 0.56 s leaves it over the prop where R18's open vault had often already moved it off (R18 instead set 22 vaults down late in the
  same hours).  A narrow fix (finish or undo the vault when the tier goes far) is an engine change for the owner to authorize.
- **A 12-20 px step at the mid tier at one spot (2949-2969, 3672-3720)**: in R18's runs (2 in 108 h, and one 5 px step elsewhere) and,
  before the second review's fixes, in S's (2); none in the final S runs; a roaming creature far from everybody, pre-existing.
- **The moderately hungry flank against somebody standing** (~10 s in the lit hall at .7) is kept - R13-R18's tactic, held by C17-C19,
  PR06, PR19, X05, X07.  Whether it still reads as "clever but absent" at .7 is the owner's call (HUMAN_QA S-C); `SK.detour` is the knob.
- **The contest** applies only to somebody standing (60 px/s or less): leading a walker or a runner would change R18's chase, which the
  owner asked to keep.
- **A stale way round is noticed only when it sees them** (by design: no knowledge of unseen people).  Out of its sight it goes on, and
  arrives as R18 did (rush, or wait, then listen and search).  The first S1's arrival rule for this (S1-3, `flankMovedOn`) was withdrawn
  after the review: nothing reached it in 36 h of simulated play or a targeted search (DESIGN_DECISIONS S1-3).
- **A way round begun on the think before somebody sets off** (SR01: 2 of 16 walking-off runs; R18 9) is dropped on the next think when
  they are seen moving (S1-2) - a 0.1 s start of a back-off; recorded, not hidden.
- **After a way round given up because they ran off, no way round near that place for 10 s** (it is remembered as a mover's refusal, as
  "no way round here" has always been remembered, `SK.noFlank`, or until they are 200 px on): somebody who bolts briefly and then stands
  still close by gets its open approach, its stare or its chase - not a second way round at once.  The second review asked whether this
  could stop a fair way round; by design it can, for those 10 s; recorded, not changed.
- **Ignored openings**: one "lit person within 500 px, hungry, not about them" in 36 h of S at .55 (R18 none; none in either tree at .7);
  not traced further.
- **Closing on somebody walking away is 0.5-1.4 s slower in the median** in ordinary play (it stares or comes on openly where R18 began a
  way round); as often within 200 px (43 % against 41 %).  `SK.escalate` (R18's standoff) is the knob if the owner wants it
  quicker; not changed here.

## Not in this track (the pack's out-of-scope list)

The shared locomotion (N track, its own branch), the Hound's future primal blind pursuit, OVERSEER v2, Red Rooms, HANDS/POCKET, corpse
dragging, global difficulty, unrelated technical debt; the Skin-Stealer's art and its death variants (judged separately); organic spawning
(none: admin only, at most four); any merge or deployment.
