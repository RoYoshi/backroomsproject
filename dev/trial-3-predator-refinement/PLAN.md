# Trial 3 predator refinement — plan (written at R0, before any game change)

**Goal:** the same creature, with the same senses and body, that behaves like an animal that *wants* to eat and *thinks* about how:
a starving one keeps after a person it has real evidence of — watched or not — by stalking, flanking, listening, guessing and
ambushing, and can be wrong; a satiated one stays curious, aware and defensive but does not hunt. Everything stays inside the species
(`ai.skinstealer.js`) and its page script; the shared engine, the Hound and the Smiler do not change.

## 1. The hunt: one persistent intent (`e.hunt`), above the plans

Trial 3's plans (`watch`, `retreat`, `approach`, `chase`, `lure`, `intercept`, `search`, `leave`) stay as the *executors*. What is
missing is the motive that outlives them. A hunt is begun when it decides to engage a person it has **seen**, and keeps:

* the quarry (a person identified by sight, as before), and a **belief** about where they are: position, heading, uncertainty, the
  time and kind of the last evidence (`seen`, `heard`, `guessed`);
* **confidence**, which falls without evidence (more slowly the hungrier it is) — a person out of sight and unheard long enough is
  given up even by a starving one;
* **effort** spent, against a budget that grows with hunger (the old encounter budget, made longer and carried across departures so
  that leaving and coming back cannot reset it);
* this encounter's **failed guesses** (at most 4 places, forgotten after 60 s) and its tries, so it does not wait twice at the same
  empty corner.

When a plan ends, the hunt decides the next step from the belief instead of "leave" or "roam": listen, search, try the next guess, or
give up for a stated reason (no evidence, effort spent, exhausted, more than one of them, satiated). The engine's own records are
untouched by it.

## 2. Hunger and eye contact (R1)

The decision weights become smooth functions of hunger (bands stay as labels). Being watched is information, not a repellent:

| Hunger | Watched (eye contact) | Unaware person |
|---|---|---|
| < .2 | leaves (as now) | leaves (as now) |
| .2–.4 | holds, backs off out of sight, or leaves | approaches in the dark; leaves in light |
| .4–.6 | breaks line of sight to **flank** (a hidden spot to the side, no farther than it is now), or backs off and baits | approaches |
| .6–.8 | flanks, holds a standoff, sometimes comes on openly | approaches, shadows |
| .8–1 | **comes on openly** or flanks; rarely backs off | approaches, shadows |

A flank is a short move under cover (seen and lit cells cost more) to a spot the person cannot see; from there it approaches as it
would an unaware person. Flanks per hunt are capped. The strike is unchanged (wind-up, committed leap, contact only) and may come from a
flank or an open approach — being looked at no longer vetoes an opportunity, and the person sees the wind-up.

**Losing the race** no longer ends the hunt for a hungry one: it stops running (it cannot outrun a fresh runner — top speeds unchanged),
may not give chase again for a while (`chaseRest`), and keeps to the trail at its free walking pace, or goes to listen and guess when
they are out of sight.

## 3. Listening and belief (R2)

The engine names a sound only while the person is seen; out of sight every footstep is anonymous. The hunt therefore asks of each new
anonymous body sound: *is it where my quarry could be by now?* (inside the belief's uncertainty grown by their possible speed). If so
it moves the **belief** to the sound's own fuzzy place, firms it up and, from two such sounds, a heading. It names nobody: a different
person making noise there would fool it (a fair deception). A sound far from the belief is a separate curiosity (below).

* **Losing sight** — it first stops and **listens** (act `listen`, which the engine's hearing already rewards; its head sweeps):
  shorter when starving. Then it follows the evidence.
* **Hypotheses** (at most 3 at a time): the route it predicts from the belief (Trial 3's `skPredict`, its seeded error kept), the
  **other branch** at the first junction on that route, and a sweep of the last place it had them. Each is scored for how plausible it is,
  whether it can get there first, cover, and failed places nearby; the pick has a seeded element. A failed one is recorded; the next is
  tried while confidence lasts; then it gives up.
* **During an interception or a search** a consistent sound far from its guess makes it revise (at most twice), toward the sound or a
  new route from it. No sound, no revision: a quiet person who doubled back has fooled it.
* **Roaming**, a sound turns it to listen first; a weak single sound with nothing after it is dropped as misleading; a strong one or a
  second one is investigated (creeping the last stretch). Anonymous throughout.

## 4. Stalking and ambush (R3)

* Approaching an unaware person it **freezes** when they turn its way (before eye contact), and creeps the last stretch.
* Interception spots stay beside the predicted route, out of sight of the way they come; it waits listening (head sweeps), and a sound
  of them coming keeps it there; a wrong guess is recorded and leads to the next hypothesis or a search, not straight to a departure.

## 5. Presence (R4)

No new act or state codes, no snapshot change: `listen` (still, head sweeping — `e.head` is already sent), `creep` (crouched, still
or slow), `watch` (a standoff), `approach` (crouched, moving under cover), `intercept` / `wait`, `chase`, `wind`. The admin overlay gets
one more line, HUNT (quarry, phase, confidence, the last evidence and its age, effort, the current guess, failed guesses).

## 6. Size (R5)

One explicit scale for the undisguised drawing (proposed 1.3×, in the pack's 1.2–1.35 range) in the page script's head, used by the
living view and by the attacker drawn in its kills; a minimal pose correction for a readable top-down silhouette (legs under the
body, arms closer, a forward lean, the head held forward) — not a redesign. The disguise stays the page's own Wanderer avatar. The
collider (radius 24) is **not** enlarged: a larger drawing over the same body is in the player's favour (nothing reaches farther than it
did) and leaves navigation, corridors, the pounce and the corpse as they are; the screenshots check walls and doorways.

## 7. Tests and evidence

New `dev/tests/s_skinpredator.js` with PR01–PR26 (`08_SCENARIO_TEST_MATRIX.md`), each on the real simulation over several seeds,
including the wrong guesses and the fooled cases. `tools/repro_r0.js` re-run at each checkpoint gives the before/after tables. The 34
Trial 3 scenarios and the 19 B1–B5 scenarios keep running; any assertion that contradicts the owner's new instruction (for example
"eye contact stops it" at .62 hunger) is changed only with the reason written next to it and listed in `CHECKPOINTS.md`.

## 8. Checkpoints

| | Work | Before the push |
|---|---|---|
| R0 | this audit and plan; the reproduction, size and read-back tools; baseline tests | no game change |
| R1 | the hunt object, effort and carry-over, hunger / eye-contact weights, flanking, the lost race | PR01–PR05, PR18–PR20; SK + BR |
| R2 | belief from sounds, listening, hypotheses, failed places, revision, roaming curiosity | PR08–PR16; the no-clairvoyance comparisons |
| R3 | stalking freezes, interception waits and revisions, recovery after failures | PR05–PR11, PR17, PR19–PR21 |
| R4 | poses through acts and the head, debug, thrash fixes, balance | PR01–PR22 |
| R5 | size and pose on the page | PR23, browser screenshots |
| R6 | multiplayer, parity, stress, performance, fast gate | PR22–PR26, `npm test`, equivalence, 0/1/4 benchmarks |
| R7 | independent review, fixes | the review's receipt |
| R8 | reports, Human QA sheet, receipts | read-back of the final commit |

## 9. Stop and ask

If any of this needs a change to the shared engine, senses, capture or snapshot, a faster top speed, a larger reach, or the player's
own movement, it stops and asks instead.
