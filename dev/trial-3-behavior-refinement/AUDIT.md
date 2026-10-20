# Trial 3 behaviour refinement — B0 audit

Trial 3 is **not owner-approved**. This pass changes only how the Skin-Stealer reacts to people it really perceives. Everything here
was read at the verified Trial 3 head `020b5b533a3ab1e8edaaa7dd6a02bf29070421fc` and reproduced on the real simulation.

## 1. Refs before branching (read from GitHub, 2026-10-20 23:03 UTC)

| Ref | Head | Tree | As expected |
|---|---|---|---|
| `trial-3-skin-stealer` (parent of this branch) | `020b5b533a3ab1e8edaaa7dd6a02bf29070421fc` | `26234cdcd68b59727c68bbd21662b980d8d28bbe` | yes; its parent `384bae2` (T8) |
| `pre-trial3-final-polish` (P9, accepted) | `1ff9374babc034eafed4c7c26dc941f46fc55908` | `d6b71b88e2baaec0cce1eb8a222ccc66ad1a1aef` | yes |
| `main` | `7781e1ac34aa09970df57fae3fc107a873fa2731` | | yes |
| `stage-3h-engine-modernization` (C5d) | `4beba2f36deaf17473ad3b955eeefdd6fcfbd90b` | `677d4eb` | yes |
| `stage-3h` | `22751bbc39c91f3e54e3305638b2ef2c9dd12c68` | `d44c4ba` | yes |
| `stage-3e-0-bplusplus` (B++) | `143b63ff42b88c6780c5043e0f61d64100f81f40` | `b25c26e` | yes |
| `post-3h-trials-1-2-4` | `58fcf5b9ab8a115ea266f0e39d16bed49c0cdfa5` | | yes |
| `trial-4-rgb-chat-accessibility` | `518b99021b601963cfe0ee79e9bfd2cccd2f3748` | `72e60eb` | yes |
| `post-trial4-review-polish` | `1a89863286d218c8b67ccc5456ee08bbf8c15066` | `ddc6385` | yes |
| `post-trial4-chat-voice-polish` (C5) | `63805e98867c3677261307b8cd597f63592b8c45` | `60e4452` | yes |
| `trial-3-behavior-refinement` | did not exist (GitHub: branch not found) | | created here from `020b5b5` |

Every one of the 37 remote heads is recorded in `inventory/remote_heads_before.json`; `tools/verify_remote_br.py` checks after each push
that this branch is one straight line from `020b5b5`, that each ref above is at its head (and tree where given), and that no other branch
moved or appeared.

## 2. Where the Skin-Stealer decides (ai.skinstealer.js at 020b5b5)

Each engine step (`ai.engine.js` `eng.step`): the tier is checked every 0.4–0.55 s; near, the entity *senses* and *thinks* every 0.1 s
(`sense`: `updateVision` fills `e.seenNow` and the records `e.mem.p`; sounds arrive through `hearEvent` at any time). Then the species tick:

| Order | Code (line) | What it does |
|---|---|---|
| 1 | `skinTick` 768 → `skBody` 182 | hunger and stamina, every tick |
| 2 | commit / capture 770–771 | on its kill: nothing else |
| 3 | `skStrikeStep` 772 | a strike in progress is carried through |
| 4 | `skStrike` 773 (think) | **before deciding**: a grab of anybody within arm's reach (46 px), or a pounce at the plan's person |
| 5 | `skDecide` 774 (think) | the decision (below) |
| 6 | `skAct` 775 | carries the plan out (`skRoam` when there is none) |

`skDecide` (520): clears expired hunt cooldowns (`e.left`), then **returns at once while a departure is running** (523), builds `all`
(every person it sees now, `skSeen` 200) and `seen` (`all` minus anyone on its hunt cooldown, 525), handles feeding, and then either
`skUnseen` (nobody in `seen`) or weighs leave / watch / retreat / approach / chase for the nearest one.

## 3. The causes of the owner's report

Reproduced with `tools/repro_b0.js` on this tree (`evidence/b0_repro_trial3.txt`, `.json`): 6 seeds each, sampled 10 times a second,
every sample recording whether the person was **seen** (in `e.seenNow`) or **heard by name**.

1. **The departure is blind (line 523).** `if (P && P.k === 'leave' && now < P.until && …) return;` comes before `skSeen`. While it
   leaves (up to 45 s, `SK.leaveMax`) nothing it sees or hears is looked at. *Orbit (a lit person running circles 130 px off):* 40–84
   samples per seed seen within 200 px while leaving; it stopped and faced them in 0–4 samples (those few are its own listening pauses
   while roaming); one departure goal per run. *Tail (walking 70 px behind it, inside the 110 px in which it sees all round):* 145–307
   samples seen while leaving; it never stopped or faced them.
2. **The hunt cooldown hides the person from everything (525).** `seen = all.filter(r => !e.left.has(r.id))`: once it has left
   somebody, for 30–60 s it does not consider them at all, so after the departure it roams past them. *Orbit:* 3–58 samples per seed seen
   within 200 px while roaming with them on the cooldown list; *tail:* 3–140.
3. **Only a hungry one can ever touch anybody (399).** `skStrike` begins `if (e.exh || e.hunger < SK.band[1] || …) return false;` — under
   0.4 hunger it has no physical response at all. *Touch (hunger 0, a person standing in arm's reach for about 13 s, seen in every
   sample):* no strike, no kill, plans roam / leave only. Keeping a first touch safe is right; having no response however long it lasts
   is the gap.
4. **The departure follows its route (738).** `case 'leave'` re-plans only when the route is lost and walks at its roam speed; nothing
   in it looks at people.
5. **A satiated one leaves on first sight, every time.** In the weighing, `leave` is `(1 − hunger) × 1.1 + 0.8` under 0.2 hunger plus
   caution — about 1.9 against at most 0.9 for anything else — so a satiated creature goes straight from roam to leave (seed 1: left at
   0.0 s), sets the cooldown of cause 2, and the cycle of causes 1 and 2 repeats. This is the intended non-engagement; what is missing
   is any acknowledgement inside it.
6. **A satiated one ignores sounds.** `skListen` (593) runs only at hunger ≥ 0.4; under it, footsteps it hears change nothing.

## 4. What is legitimately not perceived

`ai.senses.js` `visualObservation`: it sees a person only within its field of view (2.5 rad, centred on `e.ang + e.head`) **or** within
110 px all round, with a clear line (`geo.sees`) and within a range set by the light on them, their posture and their motion (a lightless
crouched person in this dim hall: about 165 px). A sound names a person only while that person is seen at that moment
(`identifySound`); otherwise it is an anonymous lead with a fuzzy position. So:

* *Behind a wall (`W`, wall A of the dark south-west, a lightless person crouch-walking on the far side):* seen 0, heard by name 0, no
  anonymous sound; its path identical, tick for tick, to the same seed with nobody there, in 6 of 6 seeds. This is the blind case the
  fix must leave alone.
* *Behind it in the open (`B`, crouch-following 170 px behind):* this is **not** reliably blind — it turns as it walks, and the follower
  was seen in 5 of 6 seeds. Two of those runs were nonetheless identical to the run without them: seen and ignored.
* The engine's level of detail reads the true nearest-player distance (P9 behaviour for every species, `DEFERRED.md` of Trial 3): one
  `W` seed differed only because the nearest player changed its tier. The comparisons hold the tier fixed; this pass does not change it.

## 5. Who owns physical contact and the kill

* **Authorization** is the species': `skStrike` (a grab within `SK.grabReach` 46 px of a hungry one, or a pounce at the plan's seen
  person 55–185 px off) → `skSpring` (sets `e.pounce`: wind-up, then a committed leap).
* **Contact** is physics: `skStrikeStep` moves the body with swept collision (`moveCollide`) and takes the first living, uncaught player
  whose body its own has reached (`e.r + 18`) with a clear line (`geo.lineClear`). This, and the arm's-reach grab, are the only places
  it reads where a person really is (`eng.nearPlayers`), and only once a strike is under way or a body is already touching it.
* **The kill** is the engine's: `beginCapture` → `killNow` (always quick: `capture.noPlay`), variant A/B/C from `SKIN.capture.variants`,
  the commitment for the death's length, then `afterKill` → `skFeedBegin`.
* **The corpse** is G.I.B.'s: the server's aftermath (`gib/server/aftermath.js`) makes it at the end of the death, keyed by player id
  (never two), independent of the victim's connection.

Other reads of the truth in the species, all housekeeping: `eng.byId.has` to drop cooldowns, lines and records of people who left
(522, 526); `tgtGone`; `skWatched` → `facedBy(eng.playerById(r.id))`, which answers only for a record that is seen now (eye contact is
part of seeing someone). Nothing else.

## 6. Tests that guard it today

`dev/tests/s_skinstealer.js`, 34 scenarios (SK01–SK44), all passing on this head. Those this pass must keep: SK12 / SK13 (a satiated one
leaves and stays away), SK15 (an unsensed person changes nothing), SK16 (the encounter budget), SK17 (two people: it leaves), SK18
(navigation), SK21 (the bait), SK22 (a fresh runner wins the race), SK23 (interception and its evidence law), SK24 (hearing), SK25
(every plan ends), SK30–SK35 (the strike, counterplay, contact through walls, the three deaths, G.I.B.), SK40–SK44 (ears, lines, skin).
None of them puts a person close to a creature that is leaving, or crowds a satiated one; nothing tested causes 1–4.

Baseline on this head: see `CHECKPOINTS.md` B0 (the whole `npm test`, its inherited failures by name).
