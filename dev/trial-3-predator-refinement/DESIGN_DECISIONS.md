# Trial 3 predator refinement — design decisions

Trial 3 is **not owner-approved**; neither is anything here. Each decision says what was chosen, why, and what was rejected. The code is
`src/frameworks/nani/server/ai.skinstealer.js` (the species; its header has a paragraph per checkpoint) and the Skin-Stealer's page script
(`src/frameworks/nani/client/skin.head.js`, `src/frameworks/br-r/client/skin.body.js`); the admin overlay has one more line.

## The motive: a hunt above the plans (R1)

**Chosen.** `e.hunt` — the quarry (a person it has *seen*), a belief (a place, a heading, an uncertainty, how and when it knows), a
confidence that falls without evidence (10 s when barely hungry to 30 s when starving), and its flanks, guesses and failed places. Trial
3's plans (watch, retreat, approach, chase, lure, intercept, search, leave) stay the executors; when one ends the hunt chooses the next
step instead of "leave" or "roam", and gives up for a stated reason.
**Why.** The audit (`AUDIT.md` §3) found the motive died with each plan: every timer ended in a departure and nothing read the memory
again until the person was seen. A persistent intent with an explicit, decaying confidence gives commitment *and* a natural end.
**Rejected.** Longer timers on each plan (pinning without evidence); a global "rage" meter (behaviour without a reason the overlay can
state).

## Effort that cannot be reset (R1)

**Chosen.** 30 + 90 × hunger seconds per person, carried across its departures and halving every 90 s.
**Why.** Trial 3's budget restarted when it left and came back: "leave, return, leave" pinned nobody but also never committed. Carrying
it makes a long hunt possible for a starving one while still finite — no infinite pinning (pack 03).

## Eye contact is information (R1, R3)

**Chosen.** Smooth weights in hunger. Mildly hungry, being watched still sends it away; hungry, it **flanks** (a spot at the person's side
they cannot see, reached under cover) or backs off as bait; starving — or very hungry once its flanks and bait have failed, or where there
is no way round — it **comes on openly**. Which answer a hunt prefers is drawn once per hunt from its own seeded stream. More than one
person in view it still holds back (a lone ambusher). A flank goes on to its spot even if it turns its back on them (R3), and a place with
no way round is remembered for 10 s (R3, R4).
**Why.** The owner: "Don't like being stared and just walk away". Being looked at changes *how* it hunts, not *whether*.
**Rejected.** Ignoring eye contact (no longer a stalker); a faster approach (the race must stay fair).

## The lost race (R1)

**Chosen.** Top speeds and the race rule unchanged: a fresh runner wins. A hungry one that loses stops running, may not give chase again
for 10 s, and keeps to the trail at its free walking pace (200 px/s, under the stamina-costing pace).
**Why.** "A fresh runner still wins the straight race; after losing, the creature may search on evidence rather than go home." The
measured consequence — a runner who then stops in the open is reached — is listed in `DEFERRED.md` for the owner.

## Listening and belief, never identity (R2)

**Chosen.** The engine names a sound only while the person is seen; out of sight every footstep is anonymous. The hunt asks of each new
body sound whether its quarry *could* be there by now (within both uncertainties plus 260 px a second since its last evidence) and if so
moves its belief to that fuzzy place. A creature's sound is never taken; nobody is named; the engine's records are untouched.
**Why.** "Anonymous fuzzy sounds only, never identity attachment." The consistency test is what an animal would do — and it is fooled,
fairly, by somebody else's noise in the right place.
**Rejected.** Attaching anonymous sounds to the engine's person record (identity leak); following every sound (no reasoning).

## Guesses that can be wrong (R2)

**Chosen.** From the belief only: Trial 3's interception (its route walk factored out as `skRoute`, same draws), a point along the predicted
way, the other way at the same first turn, the believed place, the last place. A failed place (60 s, at most 4) and a failed turn are not
tried again unless newer evidence came; each failure costs confidence; a seeded element lets it pick wrong. 2–4 guesses per hunt.
**Why.** "Predict and ambush imperfectly. It must be able to guess wrong, revise on new evidence, record failed sites, and never loop."
**Rejected.** Many hypotheses with path costs each think (CPU: candidate generation runs only when a step ends; ≤ 4 route plans).

## Revision and curiosity (R2)

A fitting sound away from the current guess revises an interception (or turns it into a look) and moves a search; at most 3 per hunt.
Roaming and hungry, a sound makes it **stop and listen first**; a second fitting sound or a strong first sends it to look. A faint single
sound is let go. The listen gets the engine's own hearing bonus for the act `listen` — no new sense.

## Stalking (R3)

Coming at somebody unaware, it **freezes** when their facing turns its way before eye contact, for up to 3 s (hungry) – 1.2 s (starving).
Waiting at an interception its head sweeps. These are the tells pack 06 asks for, driven by the server's act and head angle.

## Dithering (R4)

Three measured fixes (`tools/thrash_pr.js`): no one-tick "hold its ground" when there is no flank spot; a glimpse lost for under 0.6 s
does not end an approach; it settles 0.6 s at a flank spot. No timer was added to hide a real decision.

## Presence and size (R4, R5)

**Poses** come only from the act and the head angle the page already receives (no protocol change): listening half crouched and still,
its head turned exactly as the server says (no random tilt then); lying in wait low; searching low; closing in with a lean.
**Size**: one `BODY_SCALE` (1.3, the pack's 1.2–1.35) set on every undisguised view; a minimal pose correction so it reads from above
(legs foreshortened under the hips, arms close, arms low until the strike). **The collider is unchanged** (radius 24): a larger drawing over
the same body favours the player; nothing reaches farther. The disguise stays the page's Wanderer avatar at a player's size.
**Rejected.** A larger collider (would change navigation, doorways, the pounce and fairness); new art (out of scope).

## What it reads (unchanged laws)

Its own sight (`e.seenNow`, the engine's field of view, light and line of sight), its own hearing (`e.mem.sounds`), its own records, the
level's static shape (walls, lamps) — never where a person really is. The tests prove it with paired runs: two worlds whose person goes
different unsensed ways are the same creature tick for tick until it senses a difference (PR08, PR11, PR13; Trial 3's SK15, SK23).

## Shared code

`ai.head.js`, `ai.senses.js`, `ai.intelligence.js`, `ai.engine.js`, `ai.capture.js`, `ai.entity.js`, `ai.hound.js`, `ai.smiler.js` are
byte for byte the starting commit's (PR25), and the Hound and the Smiler are P9's tick for tick (`evidence/r6_equiv_p9.txt`). No stop-and-
ask condition (pack 11) was met: no faster speed, no larger reach, no shared engine or protocol change, no unseen-player knowledge.
