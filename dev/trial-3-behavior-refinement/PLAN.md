# Trial 3 behaviour refinement — plan (written at B0, before any game change)

**Rule:** it may choose not to hunt you; it may not behave as if it has not noticed you when it really has. Every new reaction is
driven by what it sees now (`e.seenNow` and the seen record's body), or by a sound it really heard; never by where an unsensed person is.

## The mechanism (all of it in `src/frameworks/nani/server/ai.skinstealer.js`)

**1. Awareness, separate from hunting.** A small map `e.aw`: one record per person it has *seen* close by (at most 4; a record nobody has
renewed for 30 s, or of a person who is gone, dead or held, is dropped). Each think it is fed from `all` — everyone it sees now,
**including** people on its hunt cooldown — never from `seen` (cause 2 of the audit). The hunt cooldown `e.left` stays exactly as it is:
it still stops it hunting that person; it no longer stops it noticing them.

**2. Pressure: what that person is doing to it.** Per record, a number that fades (e-folding about 8 s) and grows only from what it
sees, each kind with a ceiling so that presence alone can never escalate:

| Evidence (while seen) | Grows | Ceiling |
|---|---|---|
| in its personal space (under 200 px; more the closer, more if coming at it, less if going away) | per second | 0.35 (enough to be noticed, never a warning) |
| crowding (under 90 px) | per second | 0.65 |
| circling: their own motion **relative to it** round it, more than 230° one way, then each further half-turn | per event | 1.2 |
| tailing: moving with it, beside or behind, within 220 px, for more than 3 s while it walks | per second | 0.9 |
| in its way: ahead of it, in its lane, within 150 px while it walks | per second | 0.9 |
| pressing after a warning: still within 160 px and not backing off | per second | 1.2 |

Passing once cannot circle it (a straight pass sweeps less than 180°); walking beside it once does not last 3 s; standing in view far
off adds nothing. A sound adds no pressure to anybody: it cannot tell who made it unless it sees them.

**3. Reactions, layered over the plan (no plan is dropped for them).** At most one at a time, each with a fixed length and a gap:

* **look** (pressure 0.12): it stops, turns to face them and holds still (`watch`) for 0.8–1.6 s, then goes on; no sooner than every
  3–5 s for the same person. While it walks with a noticed person in sight it also turns its head to keep them in view (`e.head`, which
  the engine's sight already centres its field of view on: the creature looks; it learns nothing it does not see).
* **look at a sound**: a fresh sound (footsteps, a voice) within 420 px while it roams or leaves turns it toward where it heard it — the
  fuzzy position of the sound, no name — at most every 4 s. Hungry and roaming, `skListen` still sends it to search, as now.
* **warn** (pressure 0.45, and noticed for at least 3 s): it stops, faces them, hunches (`creep`, state `PROVOKED`) and backs away
  slowly for 1.2–1.8 s; then it turns away on another route away from them. Not more often than every 4 s after a warning ends.

The departure (`leave`) runs through all of this: its goal and its own time limit stay; the time spent reacting is added back (bounded).

**4. Defence: a satiated creature can kill, but only like this.** All of: it has warned this person; at least 1 s has passed since that
warning ended (and no more than 15 s); pressure ≥ 0.8; it sees them now, within 110 px, with a clear line; they are not backing away;
it is not exhausted and has the stamina; neither its pounce cooldown, nor 25 s since it last defended against this person, nor 10 s
since it last defended at all, holds it back. Then it chooses, from its own seeded stream: **withdraw** (it goes, quickly, 180 px/s,
away from them) or **strike**. Cornered (no open way away from them), its odds of striking rise; each earlier withdrawal from the same
person raises them; caution lowers them; hunger raises them a little (it never decides whether it may defend).
The strike is the existing one with its own numbers: a crouched **wind-up of 0.5 s** (the same tell as the pounce, `wind`: the click
and the breath), aimed where it believes they will be, then a committed lunge of about 70 px that only the provoker can be caught by,
lethal only on physical contact through `skStrikeStep`, the engine's capture, one of the three kills, G.I.B.'s corpse. A miss: the
existing recovery and pounce cooldown, then it leaves. Hunger is never changed to allow it; the hungry grab and pounce are untouched.

**5. A very hungry departure can be reconsidered** — after at least 4 s of it, only on fresh sight of somebody it may hunt (not on its
cooldown list), never after a lost race, never from hunger rising alone.

**6. Debug.** `skDebug` adds the top awareness record (person, pressure, tier, the last reason, seen or heard and how long ago), the
reaction in progress and why a departure was kept or interrupted, and counts (looks, warnings, withdrawals, defences, hits, misses).
The admin overlay (`ents.debug.js`, debug mode only) gets one more line. Nothing new goes in the snapshot except what the existing
fields already carry: its state (`PROVOKED`), its act and its head.

## Checkpoints

| | Content | Tests |
|---|---|---|
| B0 | this audit, plan, proposed balance; `tools/repro_b0.js`; the remote verifier; baseline `npm test` | no game change |
| B1 | awareness records, look, look at a sound, the head turn, departures that notice; debug | new `dev/tests/s_skinbehave.js` BR01–BR07; SK suite |
| B2 | pressure kinds, ceilings, fading, tiers, warning, alternate route; very hungry reconsideration | BR09, BR11–BR14, BR20 |
| B3 | defence (withdraw / strike) with its own wind-up, lunge and cooldowns | BR08, BR10, BR15, BR16 (and BR17, BR19) |
| B4 | regression: SK + BR, `npm test` against B0's failures, humanqa, build and static checks, fast gate, browser, P9 equivalence, 0/1/4 performance against Trial 3 | BR18 |
| B5 | reports, owner QA sheet, final read-back | |

## Files expected to change

`ai.skinstealer.js` (and its build output `generated/server/ai.js`); `ents.debug.js` (one debug line; output `public/ents.js`);
`dev/tests/s_skinbehave.js` (new) and `dev/tests/run.js` (one name); `dev/tools/gate/declared_changes.json`; generated docs if the
build's checks require them; `dev/trial-3-behavior-refinement/`. Not expected: `ai.senses.js`, `ai.engine.js`, `ai.capture.js`, any
client art or sound, the Hound, the Smiler, chat, speech, G.I.B. If one of these turns out to be needed, it is stated in
`CHECKPOINTS.md` with the reason before it is changed.

## Risks and how they are checked

* **Thrashing** between reactions and the plan: fixed lengths, gaps, at most one reaction; BR04 counts plan changes.
* **False provocation** (a pass, a parallel walk, a bystander): ceilings per kind; BR01, BR11, BR12.
* **Cheating**: every input is a seen body or a heard sound; BR06 / BR07 compare against an absent person, tick for tick.
* **A kill loop**: one defence per person per 25 s, one at all per 10 s, a warning before each, records that fade; BR13 runs 3 minutes.
* **Hound / Smiler and P9 parity**: nothing shared changes; B4 re-runs the P9 equivalence and the zero-Skin-Stealer checks.
