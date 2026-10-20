# Trial 3 — Skin-Stealer: report

**Status: ENGINEERING COMPLETE — AWAITING OWNER HUMAN QA.**  Nothing is merged, deployed or spawned in the normal world; no
protected branch moved.  Stopped here for the owner's Human QA (`HUMAN_QA.md`).

- **Repository / branch:** `RoYoshi/backroomsproject`, `trial-3-skin-stealer` (new at T0; fast-forward pushes only, never forced).
- **Parent:** P9 `pre-trial3-final-polish` `1ff9374babc034eafed4c7c26dc941f46fc55908`, tree `d6b71b88e2baaec0cce1eb8a222ccc66ad1a1aef`.
- **Head:** T8 `384bae2ee710b12d207a366e948d08111e465964` (tree `b958989beb916e1d984267fc08d3299fe65820a5`, parent T7 `026c239`)
  adds the reports, the evidence and one small page-script fix (`CHECKPOINTS.md` T8); one receipt commit after it adds only T8's
  GitHub read-back and secret scan.  A commit cannot carry its own hash: that receipt's hash and tree are in the handoff message,
  read back from GitHub after the push.

## What was built

A third server species, the Skin-Stealer, through the game's own owners - not a recoloured Hound, not a Smiler with other numbers.
Admin-only: it exists only when an admin makes one (the SKIN tab, shown after K); the world, the director and RESPAWN ALL never do.

| The pack's defining behaviour | As built | Shown by |
|---|---|---|
| Continuous hunger | One variable 0..1, about +0.1 a minute near or far, falling only by eating; it moves thresholds, effort and risk - never what it knows | SK10 |
| Finite stamina | Drained by running (14/s at full run) and by every leap (22), regained walking or still; exhausted under 8, itself again over 40 | SK11, SK30 |
| Deliberate non-engagement | It decides between watching, backing off, approaching and leaving from what it perceives; satiated it leaves (8/8); a crowd makes it leave (6/6); it leaves a person alone for 30-60 s after; its time with any one person is bounded and never refilled | SK12, SK13, SK16, SK17, SK25 |
| Legitimate, evidence-based tracking | Only its sight, its hearing (walls muffle; a voice is a sound too), light it notices and its memory; an unsensed person changes nothing it does (identical tick for tick with the person in two other places) | SK15, SK20, SK23, SK24 |
| Clever route prediction | From its last record of you it walks your heading through the level, guesses the turns (a seeded error its intelligence shrinks and starvation grows), goes round by another way and waits out of sight; it can be wrong, waits in vain and gives up | SK20, SK23 |
| Bait | Seen while hungry (0.4 or more) it backs out of sight and may lie in wait there; very hungry (0.6 or more) it backs slowly, in view, round a corner - the bait - and waits; nobody follows, it gives up and leaves | SK21 |
| Loses a straight race, wins a bad turn | Its run is 255 px/s against a rested sprint of 285: a fresh runner on a straight wins, a winded one does not; a chase is short (7 s at most) | SK22 |
| Human disguise | Earned only at a kill: G.I.B.'s aftermath hands it the victim's validated look; worn when its meal ends if it fed at least 8 s, for 240-420 s; drawn as the page's own wanderer with tells (no light, nothing in its hands, no name, in no player list, stiff arms, slow walk, long stares); it walks up openly and stares; the wind-up or a run drops it | SK42, SK43, SK44, browser t6, t7 |
| Locally observed speech imitation | Only lines B++ accepted, from within 576 px, kept 90 s at most (4 lines); repeated as the opening words in lower case, sometimes echoing its last word, from hiding when very hungry (0.6 or more) or while it stares; generic calls only when it heard nothing; its own entity packet (`eheard`), never a person's id as its speaker (it names the person it echoes, so their mute applies); muted with its own entry and with the person it echoes | SK40, SK41, chat_server unit_entity, speech_mutants, browser t6, t7 |
| Fast, physically credible lethal grapples | A 0.22 s crouched wind-up (the tell), a committed 430 px/s leap it cannot steer, lethal only on body contact with nothing solid between; a miss leaves it recovering 0.9-1.3 s and unable to leap again for 2-3 s; arm's reach is a grab; the kill is one of three physical deaths (A grip and neck break, B pounce into a neck break, C hold and bite at the neck), 3.2-3.5 s, the same for the victim, every spectator and the server's corpse; it then feeds by the body | SK30-SK35, browser t4 |

## How it is integrated

- **N.A.N.I.** (`ai.skinstealer.js`, a new part of the built `ai.js`): its species object with its own hooks; the engine's two-species
  branches ask a species hook first; three engine seams for T6 (`hearSpeech`, `skinFrom`, `voiceOut`) that only a species with such
  hooks answers.  The Hound and the Smiler run the same code in the same order.
- **G.I.B.**: its three deaths in the shared physics (`dphys.js`), the server's replay and fallback (`death_srv.js`), the aftermath's
  killer placement and the victim's look (`aftermath.js`), wounds (`gore.js`), the death scene and replays drawing its attacker.
- **B++**: the snapshot's `ss` list (only while one exists, so a world without one is byte-identical to P9), interpolation, the
  session handing `eheard` to the chat; nearby speech's entity hook and entity speech (`speech.js`).
- **BR-R / BR-RoLE**: its procedural body and kill poses in a new page script (`assets/skinstealer.js`), drawn in the bundle's
  sight-masked creatures layer, shaded by BR-RoLE's light sample, cast as BR-RoLE actors; the skin as the page's wanderer avatar.
- **F.R.O.N.T.**: chat bubbles, mutes and screen-reader lines for an entity's line; the entity voice in `voice.js`.
- **Spacious Audio**: procedural sounds through the game's own audio (its deaths, the snap, footfalls, the tell, the leap, feeding).
- **OVERSEER**: the SKIN tab and its previews; its own DEBUG block.  **W.A.R.D.**: every entity line passes `cleanText` again.
- No TypeScript (compiled client) change: the gate proves the bundle is still the shipped program.

## What is gated, not faked (`CAPABILITY_MATRIX.md` §6, `DEFERRED.md`)

- **The victim's flashlight / a carried light:** H.A.N.D.S. is input bindings only and P.O.C.K.E.T. has no item-id transfer; a
  monster light would be a second emitter while the real light lies by the corpse.  Not built.
- **Dragging or hiding the corpse:** no server-authoritative corpse interaction.  It only chooses where it kills and stays by the body.
- **Crawlspaces in a skin:** no LogicZ; the collider is the same in both forms and it cannot crawl.
- **An unearned, generic human disguise:** not built - the disguise is earned at a kill.  An owner decision.
- **Organic population:** admin-only until the owner approves its ecology.
- None of these is simulated; the deception that ships is the earned skin and the heard words.

## Verification

| Check | Result (latest run) |
|---|---|
| `npm test` | 183 / 196 - every one of the 34 Skin-Stealer scenarios (SK01-SK44) passes; the 13 failures are exactly P9's own, identical at every checkpoint |
| `npm run test:humanqa` | 5 / 6, X03 as on P9 |
| fast modernization gate, 21 steps | PASS 21 / 21 at T1, T4, T5 and T6 (B++'s server, session, sim, page, client and bundle traces; the build, port, lineage, contracts, docs and scope checks; the chat step 88 / 88 at T1-T5 and 100 / 100 at T6 with the entity layer, its 14 mutants caught each time) |
| targeted full-tier gate steps for the changed areas | cli_mutants, live_wire, bpp_checks, browsers, workflow, menu, suites, perf: PASS 8 / 8.  contact_lab: FAIL on one image by one level - and the same on P9 itself; B++'s own capture of that image changes from run to run here, and this tree's images were pixel-identical to P9's (`CHECKPOINTS.md` T8, `evidence/t8/contact_lab.txt`) |
| `chat_server.js` / `chat_browser.js` / `chat_voice_browser.js` (no mutants) | 100 / 100, 40 / 40, 69 / 69 |
| `tools/speech_mutants.js` | the entity speech layer 12 / 12; 10 of 10 mutants caught |
| `tools/skin_browser.js` (real server, headless Chromium; t1, t4, t5, t5d, t6, t7) | on the final tree **40 / 40**, and t7 alone 4 / 4 in a row before it (`evidence/t8/browser_t8_final.json`, `t7_repeats.txt`).  Getting there, t7 failed 4 times in 12 runs: twice the phone was checked the instant the desktop showed the line (the desktop had it); twice the creature never came - once traced roaming away from a test player put far off its facing, once (the first run) untraced with the same placement.  The test now waits for the phone and puts the player where it looks (`CHECKPOINTS.md` T8).  Earlier: 10 / 10 at T1, 20 / 20 at T4, 27 / 27 at T5, 32 / 33 + 10 / 10 at T6, 7 / 7 at T7 |
| `tools/equiv_p9.js` | the Hound and the Smiler identical to P9 at every snapshot (every 6th tick, the server's snapshot rate): 6 seeds x 120 s, 7200 comparisons, 37 kills; self-test 3 / 3 |
| `tools/perf_t3.js` | without a Skin-Stealer the same cost as P9 (0.1355 vs 0.136 ms a step); with one 0.174 ms; with four 0.243 ms mean, 2.96 ms p99 (of 16.7 ms); the snapshot's entities +74 B with one, +281 B with four; a 10-minute soak with four: no invariant broken |
| secret scan | CLEAN before and after every push T0-T8 (`evidence/scans/`; T8's after-push record arrives with the receipt commit, whose own scan is in the handoff) |
| remote verification | every checkpoint read back from GitHub: SHA, tree, parent chain from P9, every protected branch at its frozen head, no other branch moved (`evidence/remote/t0.json` ... `t8.json`; `t8.json` arrives in one last receipt commit after T8, itself read back in the handoff) |

**Not run, and why.** The multi-hour full gate as a whole (the pack says not to repeat it without a concrete reason): its fast tier
ran four times (T1, T4, T5, T6), and its remaining steps that touch what changed ran on their own at T8 (about 1 h 15 min); `chat_browser` and `chat_voice` ran without
their mutants (their mutants test P9's chat code, which keeps its behaviour - the two checks pass unchanged) and `rgb` not at all (no
RGB code changed).  No real GPU, phone, speakers, screen reader or network lag: how it looks, sounds and feels on real devices is
NOT TESTED and is the owner's QA.  The P9 ↔ Trial 3 performance comparison is server-side (the sim step and the snapshot's bytes);
the page's frame cost was not measured on a real GPU (the browser checks run software rendering).

## Balance

Every number is a proposal for the owner's QA, named and testable (`BALANCE_TABLE.md`): hunger rate 0.0016/s; stamina 100, run drain
14/s, exhausted under 8; speeds roam 105, creep 62, stalk 90, in a skin 150, run 255, tired 180 px/s; vision 760 px; leap from 55-185
px (120 in a skin), wind-up 0.22 s, 430 px/s for 0.36 s, 22 stamina, 2-3 s before the next; grab 46 px; kills 3.2 / 3.4 / 3.5 s; a
meal 18-35 s (at least 8); encounter budget 25 + 45 x hunger s; cooldown 30-60 s; lure 4 + 12 x hunger x patience s (22 at most);
an interception 26 s to get there, then a short wait (about half a minute in all); chase 7 s at most; skin 240-420 s; speech 4 lines, 90 s, one line every 10-18 s, 3 an encounter.

## Known limits and risks

- **The wire names every creature.** Like every monster since P9, the snapshot's `ss` list reaches every page in the room; a modified
  client could tell the skin from a person.  Only a server-side visibility filter for all entities would close this (deferred).
- **The echo names its origin.** `eheard` carries the id of the person whose words it repeats, so a page's mute of that person also
  silences the echo; a listener's page therefore learns that this person spoke near the creature in the last 90 s.  The alternative
  is moving mutes to the server (an owner decision).
- **The engine's level of detail reads the true nearest-player distance** (P9 behaviour for all three species; it sets how often a
  creature thinks, not what it knows).  Recorded, not changed (`DEFERRED.md`).
- **Art is interim** (procedural, restrained); the kill and living sounds are procedural placeholders.
- **The soak's record** (four creatures among eight scripted players who never react: 3 kills, no lure or chase) says nothing about
  play against people - the scripted players wander and the Hounds take most of them.
- **Found and fixed at T8:** from T5 to T7 the page script, on its first frame with the sound on, drew 44 100 values from the page's
  shared `Math.random` even with no Skin-Stealer in the world.  Fixed: without one its frame does nothing, and its noise is its own.
- Inherited and unchanged: the built-in fallback admin passcode when `ADMIN_PASSCODE` is unset, and the admin lockout keyed on a
  forgeable forwarded address.  Every test here used a synthetic passcode.

## Owner decisions

1. Accept, ask for changes, or roll back Trial 3 (`HUMAN_QA.md`).
2. The balance table (every value is proposed).
3. Whether an unearned, generic disguise should exist, and when.
4. Flashlight theft, corpse dragging and crawlspace passage wait for H.A.N.D.S. / P.O.C.K.E.T. item ids, corpse interaction and LogicZ.
5. Organic spawning: ecology, numbers, director caps - admin-only until then.
6. Mutes on the server (to drop the echo's origin id), and a server-side visibility filter for entities - both separate stages.
7. Only after acceptance may a separate post-Trial-3 Red Rooms / heartbeat stage be planned.

## Rollback

Trial 3 lives only on `trial-3-skin-stealer`.  Rolling back is ignoring or deleting that branch; P9 (`pre-trial3-final-polish`,
`1ff9374`) and every other protected branch are untouched and verified at every checkpoint.  Within the branch, every checkpoint is a
single fast-forward commit and can be checked out on its own (`CHECKPOINTS.md`).

## Documents

`PLAN.md` · `CAPABILITY_MATRIX.md` · `DESIGN_DECISIONS.md` · `BALANCE_TABLE.md` · `CHANGED_FILES.md` · `CHECKPOINTS.md` ·
`HUMAN_QA.md` · `DEFERRED.md` · `evidence/` (per checkpoint, and `evidence/remote/` for every push).
