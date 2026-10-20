# Trial 3 — Skin-Stealer: design decisions (T0)

Each decision states what was chosen, what it rests on in the P9 source, and the alternative that was not taken. Numbers are named
here and proposed in `BALANCE_TABLE.md`; none of them is owner-approved.

## D1. One more species, not a variant of another

- Engine kind `skinstealer`; species name on the wire and in kill records `SkinStealer`; act table `KACT`; snapshot list `ss`.
- A new N.A.N.I. part, `src/frameworks/nani/server/ai.skinstealer.js`, added to the `generated/server/ai.js` recipe after
  `ai.smiler.js`, with its own `@part` header. It reuses the shared perception, memory, navigation and capture parts; it does not
  call any Hound or Smiler behaviour function.
- **Spawn: admin only.** `resetWorld` and the director are not touched; a test proves neither ever makes one. Admin cap proposed 4.
- **Wire compatibility:** the `ss` list is added to the snapshot only when at least one Skin-Stealer exists. A world without one sends
  exactly the bytes P9 sends, so the stored golden traces stay valid. Old pages ignore the key.
- Rejected: drawing it through the Smiler or Hound slots, or reusing a Hound brain with new numbers (the pack forbids a reskin, and
  the engine's `else` branches would silently treat it as a Smiler).

## D2. Evidence law: it predicts, it does not know

- Inputs: its own sight (`visualObservation`: range, FOV, light, posture, walls), the sound bus (`hearEvent`), visible light
  (`lightSense`), its attributed memory (`estimate()` is the only "where are they now" it has), anonymous leads, its own hunger,
  stamina and recent outcomes, the level's static geometry, and (D9) lines of speech it physically heard.
- It never reads `eng.byId`, `eng.pl` or a player's position for a decision. The only spatial lookup of players is the existing
  physical-contact check (`eng.nearPlayers` within ~60 px of its own body, during a pounce that has already reached that spot), the
  same rule the Hound's lunge follows.
- Light on its own body (`geo.lightLevel` at its own position) is something it can feel; it uses it to judge whether it is exposed.
- Hunger changes thresholds, effort and risk. It never adds range, accuracy or knowledge.

## D3. Hunger and stamina are state of the animal, not of a behaviour

- `e.hunger` in [0, 1], one continuous variable: rises slowly with time, falls while feeding and at a kill. Bands only label it
  (satiated < .2 < mild < .4 < hungry < .6 < very hungry < .8 < starving). No meter is ever sent to players.
- `e.stam` in [0, 100], separate: drained by running and by every pounce (hit or miss), regained only while walking or still; below
  a floor it is exhausted and can only walk until it has recovered past a higher mark. A state change never touches either value.
- Per-encounter budgets (pursuit seconds, lure seconds, total seconds with one person) are spent and not refilled by switching plans;
  when spent it leaves and keeps away from that person for a cooldown. This is what stops it pinning a passage forever. As built:
  the encounter budget counts real seconds (25 + 45 x hunger), every plan has its own end (SK25 checks each one over long sessions),
  a chase ends by its own rules (D4) and a lure by its own wait.
- (T3) Two optional engine hooks keep the animal honest without touching another species: `sp.farTick` (a far one stays hungry) and
  `sp.still` (a deliberate hold is not mistaken for being stuck by the engine's watchdog, which otherwise counts any 6 s without
  26 px of movement for a non-Hound).

## D4. Behaviour: a small arbitrated plan set on the shared state framework

- States used (from `S`): ROAMING, WATCHING, STALKING, CAUTIOUS (lying in wait), SEARCHING (intercept / search), HUNTING (a short
  committed chase), ATTACKING (the pounce), FEEDING, RETREATING, DISAPPEARING (leaving the area).
- Acts (`KACT`): watch, back, leave, wait, lure, intercept, search, listen, approach, creep, chase, wind, pounce, recover, feed, mimic,
  rest, pace.
- On each think it scores a bounded set of options from its evidence: leave, watch, retreat out of sight, lie in wait round the
  corner, approach under cover, intercept a predicted route, chase briefly, pounce. Each option needs its own minimum evidence; a
  seeded draw decides between close scores, so two Skin-Stealers in the same spot do not act alike.
- **Real non-engagement:** satiated, observed by more than one person, exposed in light, exhausted, or out of budget → it really
  leaves (a goal 1200–2200 px away, preferring dark floor away from the people it perceives) and ignores that person for a cooldown.
  Only a person who walks into arm's reach of a hungry one can still be pounced on.
- **Bait (as built at T3):** seen (eye contact) while very hungry and not too close, it backs away slowly, still facing them, to the
  nearest spot hidden from the person, from the line they would follow and from where it stood - just round a corner - and lies
  in wait there without moving, facing the corner. Footsteps coming nearer keep it there a little longer (never past 22 s). If they
  walk toward it unaware it holds still (the ambush; T4 springs it); if nobody comes, the bait failed and it leaves (SK21: 8/8).
- **A lost straight race (as built at T3):** it gives chase only when hungry, rested, close (< 420 px), alone with the person, and
  the person is running from it (moving away faster than 200 px/s, or faster than 110 px/s within 4 s of meeting its eyes) or is
  winded. Somebody who simply walks on has not noticed it: it stalks them instead. A chase ends when the gap has grown 140 px beyond
  the closest it got (losing the race), when its stamina drops under 25, or after 7 s; it then leaves with a cooldown (SK22).
- **Hearing (T3):** with nobody in view and nothing else to do, a fresh, real sound (a person's, never another creature's) that it
  has not gone after yet sends a hungry one to look there, quietly; it listens and gives up (SK24). A quiet person is not heard.

## D5. Prediction and interception (revised at T3, as built)

- Level 0 is mostly open rooms with pillars and low walls rather than corridors, so the first design (find the next junction, pick
  an exit) degenerated in practice. As built (`skPredict`): from the last record (place and heading, seen or heard) it walks the
  heading through the level **by walkability** (sight passes over low walls; feet do not), up to 1500 px; where something blocks
  the way it guesses which side they take - the turn that best keeps the heading, plus a seeded error that INTELLIGENCE shrinks
  and starvation grows - at most two guesses. No observed-habit bias is used (the intelligence module's habits were not wired in;
  noted, not claimed).
- On that guessed route it takes the **first point it can reach before them**: their speed from the record, the record's age, its
  own run speed and its **real route length** (at most four routes worked out), with 0.8 s to spare. Beside that point it picks a
  spot out of sight of anybody coming along the route, preferring dark floor. If it cannot get ahead of them it does not try.
- It runs there (a race to be first; it slows for the last 160 px to arrive quietly) by a route that keeps off their own trail, then
  waits facing the way they would come. Footsteps heard on the way may correct the guess once. If it then hears somebody pass close
  by in the dark (anonymous footsteps count: it is the evidence it has), it follows the sound; if it sees them, its ordinary
  decision takes over (stalk, chase, retreat). If nobody comes it says it guessed wrong and searches once (hungry) or leaves.
- The tests (SK20, SK23): the same record with the real person anywhere (or nowhere) gives the same guess; at a fork the guess varies
  with the seed (16 seeds: 10 / 5 / 1); two runs that differ only in where the unseen person goes produce the same Skin-Stealer until
  its own evidence differs; it meets the person who keeps to their way and waits in vain for the one who doubles back.

## D6. The attack: a short committed pounce, a fast finisher (revised at T4, as built)

- **When:** from approach, chase, lure, interception or search - never while watching, retreating, leaving or feeding - with the
  person its plan is about in sight 55-185 px away, a clear line, hungry (>= .4), not exhausted, its stamina >= 22 and no cooldown.
  Only a leap that can reach them is taken: from what it sees of their motion (moving away, they gain during the wind-up and the
  leap), so against a person walking away it must be within ~70-90 px, against a still one ~170 px. It aims where it believes they
  will be at the moment it reaches them, with a seeded error that INTELLIGENCE shrinks. At striking distance it does not stop to
  think (the strike check runs before the decision on its think).
- **The strike:** a 0.22 s crouched wind-up (the tell: act `wind`, readable on every screen), then a committed straight leap at
  430 px/s for up to 0.36 s (about 110-150 px) that it cannot steer, with swept collision. Every leap costs 22 stamina, hit or miss
  (the leap itself is not also charged as running). **Lethal only on contact:** a body its own body has reached (centres within
  its radius + 18 px) with nothing solid between - the one place it reads where a person really is, as the pack allows, and only
  once its own leap has physically arrived there. A wall stops the leap (1.1 s stunned); passing the person is a miss (0.9-1.3 s
  standing, recovering; 2-3 s before another leap). A miss is real counterplay: SK31's dodger gets away in 6/6.
- **The grab:** anybody who walks into arm's reach (46 px, a clear line) of a hungry one is taken after a 0.12 s grab - whatever it
  was doing, even leaving (D4's "only somebody who walks into arm's reach of a hungry one is not left alone").
- **Shadowing (found at T4):** a stalker at 90 px/s could never reach an unaware walker; a moving person is now shadowed at their own
  pace + 30 px/s (up to 200 px/s, a long-legged walk that costs no stamina; T3 counted anything over 150 px/s as running).
- **Capture:** always quick (`capture.quick = 1`; `capture.noPlay`: the admin's forced "play" is ignored for this species - SK33).
- **Death variants** (server-chosen by weight, physical, replayed identically everywhere): **A** a grip from close by and the neck
  (heaviest for a grab), **B** the leap carries them down, then the neck (heaviest for a landed pounce), **C** held and bitten at the
  neck (heaviest for a winded or cornered victim, or a starving Skin-Stealer). Blood, as built: the physics marks blood at each of the
  plan's blows - A one (at the snap), B two (the landing, the snap), C two bites; the Hound's deaths have four and the Smiler's three.
  Its wounds on the body (gore.js): finger bruises at either side of the neck, a dark throat, a small bite.
- **After the kill:** it stays on the body for the death's length (the Hound's commitment mechanism, with its own lengths 3.2 / 3.4 /
  3.5 s), its plan over; then the meal (hunger -0.35) and it feeds beside the body (-0.03 /s, 18-35 s, far from everyone too) only
  while undisturbed: seen within 520 px or watched, it leaves. It never moves the body.
- Not built at T4: a sound for the wind-up and footfalls (T5, its presentation and audio).

## D7. G.I.B.: the new killer everywhere a death is decided or drawn (as built at T4)

- `dphys.js`: `CFG.SkinStealer` (A, B, C), `DURS.SkinStealer` (3.2 / 3.4 / 3.5 s), a `PLAN` branch (no drag; A one blow, B two, C two
  bites), and its one event, the **snap** (A at 0.58 s, B at 0.9 s): the victim's resistance is zero from that instant, the body turns
  with the twist, the hands drop, the light (A) or the hat goes. Physically it is a grappler like the Hound (the Hound's solid-contact,
  grip and ease-off physics, its own numbers), so `hound` is true for it inside the step and `sk` marks the few lines that are its own.
  `begin` and `prepare` name it as its own killer (they turned every non-Smiler into a Hound). The Hound's and the Smiler's 144
  deaths of SK34 are bit for bit P9's (sha256 of every number `dphys.simulate` gives, against P9's own `dphys.js`).
- `death_srv.js`: the replay message names it (`c`), the death's length is its own (`durOf`), its deaths are warmed at load.
- `aftermath.js`: one line beside the Hound's (which the gate's mutant still finds as it was) places it where its death left it.
- `ai.capture.js`: commitment is species-driven (`capture.commit`, `capture.commitDur`); `chooseMode` respects `capture.noPlay`;
  `previewKill` gives it A-C. The Hound's values are the same; the facts check follows the renamed fallback and binds the new lengths
  in both places (`skinstealer-kill-time`).
- Client: the bundle's own death of the victim takes the server's kill record (kind `SkinStealer`) as it does any other; ents.js's
  `attackSmiler` (which the bundle calls for every non-Hound killer) hands its attacker to `skinstealer.js`, which hides the view it
  was given and draws its own, posed from the death's physics; G.I.B.'s replay of another player's death takes its attacker from
  `skinstealer.js` (with the same `attackPose` call the Hound's view answers); the real creature's mirrored view is hidden while its
  kill plays on that screen; `sfx.js` and ents.js's death voice hand its death's sound to `skinstealer.js` (procedural).
- Evidence (browser, real server, two pages): the victim's death and the spectator's replay name it, its attacker is drawn on both,
  both get the same corpse (cause `SkinStealer`), and a victim whose page closes mid-death still gets exactly one corpse - the
  server's (`skin_browser.js` t4). Headless: the replay message, the length, the server's corpse and the killer's placement (SK35).
- Exactly one corpse per player and its dropped light are G.I.B.'s unchanged behaviour.
- Rejected: drawing its kills with the Hound's death and recoloured art (the pack forbids it).

## D8. Disguise: earned at a kill, never generic, never a player (as built at T6)

As built: G.I.B.'s aftermath, when a death this Skin-Stealer caused ends, hands the engine the victim's validated look
(`eng.skinFrom`); the engine re-checks it (four drawn fields) and keeps it pending; it is worn only if the creature then feeds 8 s
(`SK.skinFeed`; a meal now lasts at least that long), for 240-420 s.  In it the creature does not retreat when seen: it walks up
openly (plan `mingle`, at most 150 px/s), stands and stares 3-7 s (x PATIENCE), may say a line, then - hungry - walks right up and
springs only from 120 px (the wind-up drops the skin), or - not hungry - walks on, still in the skin.  A very hungry one drops the
skin to run after somebody who flees.  The snapshot carries the look (`dg`, only while worn); the page draws the ordinary wanderer
avatar with its tells.  The bullets below are the T0 decision, kept.

- Granted only when this entity has killed a person: the server already holds that person's validated look (`fields.cleanLook`); it
  is copied as `hat|texture|hands|main` with `backpack` forced to `none`. Nothing else is copied: no name, no colour of light, no
  equipment, no id.
- It is worn after the death has played out, for a limited time; it drops at a pounce (the wind-up reveals it), at the end of its
  time, when the entity is removed and when the world resets.
- On screen it is the ordinary wanderer avatar, under the same sight mask and darkness as everyone, with tells: no light and nothing
  in its hands, no name and no hover label, stiff unswinging hands, a slightly wrong walking pace, and long still stares.
- It is never a session: it cannot speak through `say`, cannot be listed as a player, is never in the peers list.
- A generic human disguise for a Skin-Stealer that has not killed is **not** implemented; it would be an unearned mechanic. It is
  offered as an owner decision.

## D9. Speech: heard locally, repeated as an entity (as built at T6)

As built: as designed below, with these specifics.  The hook is B++'s `ON_HEARD` (server.js's `onHeard`), called once per accepted
line after every rule; server.js hands it to the room's engine (`eng.hearSpeech`), and gives each world's engine its voice
(`eng.voiceOut` = `speech.entitySay`).  The creature also hears a voice as a sound (the engine's own hearing).  It speaks from hiding
when it lies in wait, very hungry (`SK.band[2]`, 0.6), unseen, 1.5 s into the wait; and when it stares in a borrowed skin.  Its words: the
opening (at most six) words of a line it heard, in lower case, sometimes with its last word again ("wait for me... me"),
preferring the words of the person whose skin it wears, then anybody else's, then the person's own; with nothing heard, one of the
generic calls.  At most one line every 10-18 s and three an encounter; the server's bucket allows one every 6 s per entity.  Its
own seeded stream chooses its words, so speaking never moves its other choices.  The packet is `{t:'eheard', e, text, seq, v:{h,s},
o}`; the page's entity voice is `voice.js`'s `mimic`, which no person can choose or send.  `docs/architecture/CHAT.md` records the
contract as connected (the pack's finite memory replaces the earlier draft's "immediate reaction only").

- Input: `speech.js` keeps every rule it has. After a line is accepted and delivered, an injected `onHeard` callback hands the room's
  sim `{speaker id, server position, text}`; the sim gives it only to Skin-Stealers in that room within 576 px of the speaker at that
  moment. Each keeps at most 4 lines for at most 90 s, cleared when it is removed or the world resets. Lines are never logged,
  never sent to the debug overlay (only counts and ages), never used to model a person. The lounge never reaches it.
- Output: a new server packet `{t:'eheard', e: entity id, text, seq, v: {h, s}, o: origin speaker id or 0}` built by B++
  (`speech.entitySay`): the text passes W.A.R.D.'s `cleanText` again, it goes only to living players of the same room within 576 px
  of the entity, with a per-entity token bucket, a per-encounter cap and the slow-socket skip. It never carries a session id as its
  speaker, so it can never be taken for a person's authenticated line.
- Client: `chat.js` draws it as a bubble over the entity's drawn position (or an edge hint), typed out; a screen reader hears
  "A voice nearby says: …". It is muted by its own entry in the mute list and also whenever the origin speaker is muted (a mute
  cannot be bypassed by an echo). `voice.js` speaks it with an entity-only preset no player can choose or send.
- Fallback lines: a small curated set of generic calls ("hello?", "is someone there?", "over here", "wait for me", "can you help
  me?", "i'm lost", "this way") that imply no knowledge of any event; used only when it has heard nothing.

## D10. What is gated, and how it is reported

Item theft, a carried light, corpse dragging, crawlspace passage while disguised, organic population: see `CAPABILITY_MATRIX.md`
§6 and `DEFERRED.md`. None is faked: no second light, no moved or hidden corpse, no shrunken collider.

## D11. Presentation

- **No TypeScript change** (revised at T1, after reading the gate's port and bundle steps: the compiled client is proven to be the B++
  shipped program). The Skin-Stealer's page side is a new composed script, `public/assets/skinstealer.js` (N.A.N.I.'s mirror and
  BR-R's art as module parts; Spacious Audio's sounds join at T5), loaded after `mp.js`. It reaches the game only through seams the
  bundle already calls: the creatures layer (`__api.layer()`: the sight mask and the darkness), the death's plan / physics / attacker
  hook (`__ents.deathPlan`, `__dphys`, `__ents.attackSmiler`, which the bundle calls with the death for every non-Hound killer), the
  sounds (`__sfx`), the light sample (`__light`). Existing scripts (`mp.js`, `ents.js`) gain only guarded branches inside existing
  functions, so B++'s client and page scenes keep their traces and their coverage.
- True form: procedural, articulated: a tall thin upright body, long arms (foreshortened when they hang), a small head held forward
  on a thin neck, folds of loose skin; a low crouch for the wind-up; a reach for the finishers. Shaded by BR-RoLE's light sample like
  the Hound. No light of its own. Interim art for the owner's QA.
- BR-RoLE (as built at T5): every view `skinstealer.js` marks `__skin` (the living creature, its kill's attacker) is an actor of its
  own kind `skin` (a tall, narrow body seen from above, the Hound's light handling); a disguise is a wanderer avatar and casts like
  one. Both only when the local player can see the spot (the existing rule), so no shadow leaks a body behind a wall.
- Audio (as built at T5): procedural, restrained, placed like every entity sound (distance, pan, a wall's low-pass): long padded
  footfalls by stride, quieter and heard less far while it stalks; the wind-up's dry clicks and sharp breath (the tell); the leap; a
  miss's skid; its eating; a breath while it holds still, only within 260 px and at most every 25-45 s (never a proximity cue); its
  deaths' grab or landing, the cut-short breath, the bites and the snap (T4). No new sound files.
- Art (as built at T5): sallow, bloodless skin instead of grey, heavier limbs; checked in a gallery of its acts and deaths at three
  quality tiers and three screen sizes. Still interim art for the owner's QA.
- The stronger heartbeat / danger filter and the Red Rooms are not touched.

## D13. The server side reaches the new behaviour without new sim keys

The gate's sim step compares this tree's sim object with B++'s, keys included. So speech heard by an entity, an earned disguise and
entity speech go through N.A.N.I.'s own engine object (`sim.engine`: `hearSpeech`, `skinFrom`, `drainVoices`), called by the
server's wiring (`speech.js`'s injected `onHeard`, the room's `onDeath`, the loop), never through a new member of the sim.

## D12. Verification strategy

- New unit suite `dev/tests/s_skinstealer.js` (seeded, headless, real sim and real movement model): spawn rules, hunger and stamina,
  non-engagement, bait success and failure, straight race vs corner, prediction fairness, pounce hit / miss / wall, capture, kill
  record, commitment, disguise lifecycle, speech locality and spoofing, world reset.
- Death parity: server fallback vs screen replay, headless.
- Targeted existing suites after each checkpoint (`npm test`, the human-QA suite, `parts`, `modules`, `facts`, `docs`, `build:check`,
  `chat_server`); the fast gate at T1 (wire change) and at T7; no repeated full gate.
- Performance: per-tick average / p95 / p99 / worst and snapshot bytes, P9 against Trial 3 on the same machine, with 0, 1 and 4
  Skin-Stealers and 8 bot players.
- Browser checks (Chromium, headless) for drawing, disguise, bubbles and deaths, recorded as evidence; anything not seen on a real
  screen with real speakers is marked NOT TESTED for the owner's QA.
