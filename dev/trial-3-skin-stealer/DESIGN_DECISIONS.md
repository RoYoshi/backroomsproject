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
  when spent it leaves and keeps away from that person for a cooldown. This is what stops it pinning a passage forever.

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
- **Bait:** seen and hungry, it backs out of the person's line of sight to a spot just past a corner and waits. It holds only while
  its evidence says someone is coming (footsteps getting nearer, a beam sweeping in, a sighting); with no such evidence the plan
  fails when its wait runs out and it leaves.
- **A lost straight race:** a chase is abandoned when the person it sees is pulling away along a long open line (its own estimate of
  their speed against its sustained speed), and always when the chase budget is spent. It wins at corners and at arm's reach.

## D5. Prediction and interception

- From the last record (position and heading, seen or heard), it walks along the heading over the static grid to the first junction
  or the end of the hall (bounded: ≤ 900 px, a few rays per step), lists that junction's exits, and picks one weighted by how well it
  continues the heading, by an observed habit if there is one (`habitBias`), and by a seeded error that shrinks with INTELLIGENCE.
- It then routes to a point a little past that exit, with a route cost that keeps it off the person's own trail when another way
  exists (so it comes round the other side), at run speed while stamina allows.
- If it arrives and nothing is there it listens and looks briefly, its confidence decays, and it leaves. It never re-reads where the
  person actually went.
- A test records the goal it chose and runs the same seed twice with the hidden person taking different turns: the goal is identical;
  the outcomes differ.

## D6. The attack: a short committed pounce, a fast finisher

- Pounce: a visible wind-up (a crouch and a click cue), then a straight committed leap along the aimed line with swept collision. A
  wall stops it (recovery); passing the person is a miss (recovery, cooldown, stamina spent). Contact within ~16 px of its body
  during the leap starts a capture.
- Capture is always quick (`capture.quick = 1`; the admin's forced "play" is ignored for this species: `capture.noPlay`). No
  playful loop, no release.
- Death variants (server-chosen, physical, replayed identically everywhere): **A** grab and neck break (it reached the person at
  close range), **B** pounce into a pin and neck break (the leap carried it in fast), **C** neck bite (an exhausted or cornered
  victim, or a starving Skin-Stealer). A and B draw no blood; C draws a small, restrained amount. No variant is gratuitous.
- After the kill it stays on the body for the death's length (the Hound's commitment mechanism, with its own lengths), then feeds
  only while unobserved; seen while feeding, it leaves.

## D7. G.I.B.: the new killer everywhere a death is decided or drawn

- `dphys.js` gets `CFG.SkinStealer` (A, B, C), `DURS.SkinStealer`, a `PLAN` branch, and accepts the kind in `begin` / `prepare`.
  Existing Hound / Smiler steps keep the same code in the same order with the same random draws, so their deaths, replays and
  corpses do not change.
- `death_srv.js` warms the third kind, sends it in `fxFor` (no more "anything else is a Hound"), validates its variants and length.
- `aftermath.js` places the Skin-Stealer where its death left it, as it does a Hound.
- Victim (`death.ts`), spectators (`mp.deaths.js`) and the server fallback all run `dphys` with the same inputs; a parity test runs
  the server path and the screen path headless and compares the corpse and the attacker's end pose.
- Exactly one corpse per player and its dropped light are unchanged G.I.B. behaviour.
- Rejected: drawing its kills with the Hound's death and recoloured art (the pack forbids it).

## D8. Disguise: earned at a kill, never generic, never a player

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

## D9. Speech: heard locally, repeated as an entity

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
- BR-RoLE: a `__stealer` actor with its own silhouette; a disguise is a wanderer avatar and casts like one. Both only when the local
  player can see the spot (the existing rule), so no shadow leaks a body behind a wall.
- Audio: procedural, restrained: soft clicks, a wet breath, a scrape for the wind-up, the finisher. Positional and muffled through
  walls like the other entities. No new sound files.
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
