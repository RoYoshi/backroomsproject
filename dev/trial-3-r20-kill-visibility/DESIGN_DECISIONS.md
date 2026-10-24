# Trial 3 R20, kill visibility (the owner's addendum): design decisions

Trial 3 is **not owner-approved**.  This branch is `trial-3-r20-kill-visibility`, based on R19 combined `2f11eae`, kept apart from the
strategic-hunter and N.A.N.I. tracks and merged into `trial-3-r20-combined-humanqa` only after them (the addendum: "a separate isolated
rendering branch").  The addendum's rule: this is a bug fix, not a redesign of R20.

## The defect, as the real pages showed it (REPORT.md, `evidence/A`)

The owner saw two Skin-Stealers on screen; one killed, and the other went invisible.  On R19 combined, real pages showed this on every
frame of every Skin-Stealer kill with a second Skin-Stealer within 260 px:
- the victim's page;
- a spectator's page;
- every variant, A, B, C and D (the Rend);
- the two creatures swapped;
- four Skin-Stealers with two victims at once;
- a page whose replay arrived mid-kill.

**The cause: identity by distance.**  The page hid "the killer" by a distance test, in two places.

1. **`skin.kill.js` (the Skin-Stealer).**  Its `hidden` hook told the body module to hide every mirrored Skin-Stealer within 260 px of the
   death's source: our own death's `D.source`, and every replay's `f.jl.source`.  `skin.body.js` then set the view `visible = false`.  The
   killer is at the source, so it was hidden, and so was everything else near it.  The view was not made transparent (its alpha stayed 1);
   it was not drawn at all.
2. **`mp.deaths.js` (the replays of the Hound and the Smiler).**  It hid the single Hound, and the single Smiler, nearest the attacker's
   place within 240 px.  This was tested rather than assumed (RV05); it is found, not fixed here (below).
   - A spectator's page hid the bystander Hound in "two Hounds, one kills", and drew the killer twice: its mirror and the replay's
     attacker.  The killer's mirrored view lags its lunge, and the server's preview set the killer down a step from the victim, so the
     pack-mate was the nearer.
   - The victim's own Hound death was right: it uses the kill record's id (`markKiller`).
   - The Smiler was right in the runs, but it uses the same nearest-within-240 rule, so it can fail the same way (RV07c).

**What the page had.**
- **The server's kill record knew the killer** (`sim.feed.js`: `p.kill.e`, the entity id).  The victim's page received it (`mk`), but the
  bundle takes `window.__kill` away as its death begins, so the death object the hook reads has no id.
- **The replay message had no id at all** (`death_srv.js` `fxFor`).

## The fix: the killing Skin-Stealer by the server's id, never by distance

| where | change |
|---|---|
| `src/frameworks/gib/server/death_srv.js` `fxFor` | a **Skin-Stealer's** replay message carries `e`, the kill record's entity id, after `c`; it is sent only when it is a positive safe integer.  A late joiner gets the same message with its `el` (`aftermath.js` `aftSend`, unchanged).  A Hound's or a Smiler's message is B++'s, key for key |
| `src/frameworks/nani/client/mp.monsters.js` | `announceKill` also keeps the record's `{ k, e, de }` on the Skin-Stealer script's own object (`window.__skin.killBy`) for the death's whole length.  The bundle takes `window.__kill` away as its death begins.  `clearKill` (a new life, a new connection, a new world) clears it.  There is no new window name: the page's globals are B++'s (cli_golden).  `sSlot` is exported for the replays |
| `src/frameworks/gib/client/mp.deaths.js` `startFx` | `f.eid` from the message.  A replay naming its killer hides that one: a Hound's slot holding it, a Smiler's slot holding it.  A replay naming none - every Hound and Smiler message the server sends - keeps R19's nearest-within-240 |
| `src/frameworks/br-r/client/skin.kill.js` `hidden` | our own Skin-Stealer death hides the mirrored view whose id is `killBy.e`; a replay hides the one whose id is its `f.eid`; with no id, none |

**What is kept.**
- The killer's own view is still hidden while its kill plays.  Its death's attacker is drawn instead: exactly one attacker per kill on
  every page (RV01).
- Every mirror comes back at the end of each death, on a revive, a reconnect, a new world (`clearKill`, `endAllFx`, as before).
- Unchanged:
  - the server's authority, the kill path, gameplay, kill physics, gore, audio, the spawn rules (admin-only, cap four);
  - occlusion, light, disguise, corpses;
  - the page's cost: one comparison per creature per frame where R19 made a distance test;
  - every Hound and Smiler message and page path.

**Compatibility.**  Only a Skin-Stealer's replay message changes, by one number.  A page that ignores it is R19's page.  A Skin-Stealer
message without it (an older server) hides none: it never guesses by distance, and at worst draws the killer twice for one death.  The
B++ protocol contract and the golden traces have no Skin-Stealer in them: they are unchanged and pass.

**Found, not fixed (the owner's call: REPORT.md RV05).**
- **A spectator's replay of a Hound kill** can hide a pack-mate instead of the killer: reproduced on real pages, on R19 and on this branch
  alike.  The fix is the same id in a Hound's (and a Smiler's) message, which changes the B++ protocol contract and its golden traces.
- **Own deaths.**  For a Hound kill whose killer this page does not mirror, the victim's page hides the nearest Hound (`markKiller`'s
  fallback).  For a Smiler kill in the same case, the bundle takes the nearest Smiler slot.  Neither was seen in the runs.  Both are left
  as R19's.

## The tests

**`dev/tests/s_r20rv.js` (RV07, in the suite).**  This tree's page code and R19's, side by side, in a VM with the game around them stubbed.
R19's fails each check; this tree passes:

| check | what it shows |
|---|---|
| RV07a | our own death: only the killer hidden |
| RV07b | replays (one, two at once among four, none with an id, one done): only each replay's killer |
| RV07c | a replay naming its killer, with a pack-mate nearer: the killer's slot (R19: the pack-mate's); a Smiler's the same; a Skin-Stealer's kill hides neither; a Hound's message as sent today is handled exactly as R19 |
| RV07d | a Skin-Stealer's message carries the id (R19: none); a Hound's and a Smiler's are B++'s; the kept id outlives the bundle's taking of `__kill` and adds no window name |

**`tools/rv_browser.js` (the real pages).**  This is RV01-RV06's evidence: R19 and this tree on the same scenes.
