# Trial 3 behaviour refinement — behaviour decisions

Trial 3 is **not owner-approved**, and neither is this refinement. Everything below is an engineering choice made to meet the pack's
contract (`02_BEHAVIOR_CONTRACT.md`) and the owner's one approved decision. Each choice is a proposal for the owner to judge in play;
the numbers are in `BALANCE_TABLE.md`.

## The rule everything follows

> It can choose not to hunt you. It cannot act as if it has not noticed you when it has real evidence.

Hunting and noticing are now two separate things in the code:

* **Hunting** is Trial 3's, unchanged: hunger, the bands, the hunt cooldown (`e.left`), the encounter budget, the race, the bait, the
  guess, the grab and the pounce. Nothing in this refinement makes it hunt anyone it would not have hunted before.
* **Noticing** is new: a small per-person awareness record (`e.aw`, at most 4) fed only from what it sees now (`e.seenNow` and that
  person's seen body: place and motion) and from sounds it really heard. People on its hunt cooldown are noticed like anyone else; the
  cooldown still stops it hunting them.

The audit (`AUDIT.md` §3–4) found the two causes of the owner's report: a running departure returned before the creature looked at
anything, and the cooldown list was removed from what it could react to at all. Both are gone, and nothing else about hunting changed.

## Ignore, look, warn, defend: what decides between them

| What it perceives | What it does | Why this, not more |
|---|---|---|
| Somebody far off in view, or behind a wall, or out of its field of view (no eyes in the back of its head) | nothing | Presence is not provocation. Behind a wall it has no evidence; BR06 / BR07 check that such a person changes nothing, tick for tick |
| A sound close by (footsteps, a voice) | while it roams or leaves, it turns to look **where it heard it** (the sound's own fuzzy place) | A sound gives no name: it cannot tell who made it unless it sees them, so no pressure is put on anybody |
| Somebody passing once, walking beside it once, a single brush past | at most a look | Each kind of pressure has its own ceiling; passing cannot add up to a warning (BR01, BR11) |
| Somebody seen close by, repeatedly | a **look**: it stops, faces them, holds still 0.8–1.6 s, then carries on its way; while walking, its head follows them | The pack's acknowledgment: it may keep leaving, but visibly knows they are there |
| Circling it, following it as it walks, moving into its way, crowding it | pressure grows; at 0.45 (and after at least 3 s of noticing them) a **warning** | Combined over time, not one point measurement. Each kind is capped so that one trick alone cannot escalate past its share |
| Still pressing in within 15 s after a warning | more pressure; another warning no sooner than 4 s later | The warning is a real chance to stop |
| Warned, still within reach (110 px), seen, with a clear way between them, not backing off, pressure 0.8+ | **defence**: withdraw or strike (below) | The owner's approved decision: defensive force, not hunting |

**The warning** is meant to be readable from above: it stops, turns to face them, hunches (`creep`, state `PROVOKED`) and backs away
slowly for 1.2–1.8 s, then takes another route away from them (while leaving, a different departure goal; while roaming, it leaves). A
0.12 s tell would not do, so the warning lasts more than a second and is followed by a separate 0.5 s wind-up if it ever strikes.

**Backing off works.** Pressure fades all the time (halving in about 5.5 s, counted over the whole time since it last saw them), so a
person who stops harassing it is soon below the level at which it would even look (BR09: 0.07–0.09 fifteen seconds after backing off).
Nothing follows them: a warning and a defence never start a hunt.

## The defence

The owner decided: a fully satiated Skin-Stealer may eventually kill someone who persistently harasses, crowds, follows or corners it;
defensive, not hunger-driven; repeated provocation, a readable warning, current threat evidence and physical contact required; brief
accidental proximity safe. Built as follows (`skDefend`, `PLAN.md` §4):

* **Repeated provocation:** pressure 0.8+, which presence alone (capped at 0.35) and crowding alone (0.65) cannot reach.
* **A readable warning first:** only against a person it has warned, 1–15 s after that warning ended.
* **Current evidence:** seen on this think, within 110 px, a clear walking line between them (BR10: never across a corner or a low
  obstacle), not moving away from it faster than 60 px/s.
* **Physical contact:** a 0.5 s crouched wind-up (the pounce's own tell, its click and breath), then a committed 70 px lunge that cannot
  steer and can catch only that person. The kill is the existing capture, death and corpse path: one of Trial 3's three deaths
  (mostly the neck break), one corpse, the dropped light, the kill named Skin-Stealer (BR16).
* **It may still withdraw.** Each time the conditions hold, it chooses from its own seeded stream: withdraw (it goes, at its tired run,
  180 px/s, which a fresh runner can follow) or strike. Its odds of striking are 0.35, more when cornered (fewer than 2 of 7 ways away
  from them are open), more for each time it has already withdrawn from that person, a little more when hungrier, less when tired.
  So a persistent harasser is eventually struck at; a single close moment is not.
* **No kill loop:** 25 s before it defends against the same person again, 10 s before it defends against anybody, a fresh warning
  before each, the defence's own stamina cost (18), the pounce's recovery and cooldown after a miss, after which it leaves them.
* **A miss is a real escape:** breaking sideways at the wind-up made it miss in 8 of 8 runs (BR15); it recovers for about a second and
  then leaves.

## Hunger and the defence

Hunger never decides whether it may defend; it only nudges the odds (+0.3 × hunger). Hunger is never set or faked to reuse the hunt:
BR08 starts at exactly 0 and checks that hunger only ever rose with time. Hunting aggression (the hungry grab within arm's reach, the
pounce at the person it is hunting) is Trial 3's and unchanged; the debug overlay shows the two apart (PLAN / WHY for the hunt, AWARE and
DEFENCE for this). A satiated creature with nobody provoking it still never attacks.

## Where it does not react, on purpose

* **In a skin** (an earned disguise): no look, no warning, no defence. Being looked at and approached is the point of the disguise;
  reacting would give it away (BR17). Trial 3's disguise behaviour is unchanged.
* **During Trial 3's own engaged plans** (watching, backing away, baiting, guessing, chasing, searching, feeding): these already react
  to the person; the new reactions run only while it roams or leaves. Pressure is still kept in the record while it does these.
* **After losing a race:** a departure after a lost sprint is never reconsidered because the runner stays in view (the contract's special
  case). Somebody who then comes back and presses in on it is handled like anybody else (warning, then perhaps defence).
* **A very hungry departure** (hunger 0.6+) can be reconsidered only after 4 s of it, only on fresh sight of somebody it may hunt, at most
  once a second, never from hunger rising while nobody is sensed (BR14).

## What it never uses

No `eng.byId` / player lookups, no exact positions of unperceived people, no stale last-known positions, no chat or mute packets. Every
input is a seen body this think or a heard sound. The one use of a person's true position is Trial 3's existing final physical contact
check of a strike already decided from perception. (`eng.byId` appears only to drop records of people who have left the game.)

## Not changed

Hound and Smiler (identical to P9 tick for tick on six seeds); senses, engine, capture, G.I.B.; the art, sounds, death animations and the
snapshot format (the warning uses an existing state and act); speech imitation and the disguise; hunger, stamina, speeds and every
Trial 3 balance value. See `DEFERRED.md` for what this pass deliberately does not do.
