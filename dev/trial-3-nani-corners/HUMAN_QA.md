# Trial 3 R19, N track - the owner's Human QA worksheet

Trial 3 is **not owner-approved**.  Engineering checks are not a gameplay verdict; this sheet is yours.  The branch is
`trial-3-nani-cornering-qol` (N only: R18 + the shared cornering fix).  For S and N together, use the QA-only branch
`trial-3-r19-combined-humanqa`.

## Start it (your machine, a private test)

```
git fetch origin
git checkout trial-3-nani-cornering-qol                 # (or: git worktree add ../r19-n origin/trial-3-nani-cornering-qol)
npm run build:check
ADMIN_PASSCODE='<a new passcode of your own>' node server.js
```

Admin as usual (backtick, sign in, `K` for the SKIN tab, `+ NEAR ME`, at most four; Hounds and Smilers come from the director as in R18).
Watch with the overlay off first.  Never paste your passcode anywhere.

## What changed, in one line

A creature that cuts the inside of a bend at speed and goes past the corner's waypoint no longer turns back for it - the "stop, pivot, go"
at a corner is eased (in the measured routes the Hound's pivoting at chase pace fell from 0.40 to 0.12 s over 40 routes; most bends were
never affected).  Nothing else about how any species moves changed: speeds, turn rates, braking, overshoot, collision, vaults, crawls.  Its
tighter line grazes a corner a little more often (a few more slides along a wall corner per 40 routes; no more wall contacts).

## The scenes (PASS / MIXED / NEEDS CHANGES / NOT CHECKED)

| # | scene | what to look for | verdict | notes |
|---|---|---|---|---|
| N-A | A **Hound** chasing you round a broad 90 degree corner | no stop-and-pivot at the bend; still fast, still swinging wide - ferocious, not polished |  |  |
| N-B | A Hound round a **narrow** bend or doorway | still physically honest: it may slow or turn sharply where the room is tight; never through the wall |  |  |
| N-C | A **Skin-Stealer** running a bend (give it a run) | its body turns without a robot pivot or shoulder scraping |  |  |
| N-D | A **Smiler**'s rush round a corner | the same Smiler: its light and reactive rules unchanged, its bends smoother if anything |  |  |
| N-E | Vaults, crawls and tight gaps (a Hound under a table, anyone over a counter) | unchanged |  |  |
| N-F | Walk far away and come back while they move | no visible jumps as they come back into view |  |  |
| N-G | Anything slower, floaty, twitchy or unfair? | your call |  |  |

**N-track questions (the pack's):** Does each species take corners more naturally?  Are narrow bends still physically honest?  Does the
Hound feel ferocious?  Does the Skin-Stealer's body turn without shoulder scraping or robot pivots?  Did anything become slower, floaty,
twitchy or unfair?

**Owner verdict, N track:** PASS / MIXED / NEEDS CHANGES / NOT CHECKED  ____________

Overall Trial 3 approval is a separate decision of yours; a verdict here does not merge or deploy anything.
