# Trial 3 R9–R17 — design decisions

Every number here is PROPOSED and unapproved; Trial 3 is **not owner-approved**. Each decision names the owner's requirement it serves,
what was chosen, why, and what it deliberately does not do.

## R10 — the Skin-Stealer's heartbeat and sting, only while it is seen

**Requirement** (pack `04`, owner): the heartbeat and the sting when the local player actually sees the Skin-Stealer, only while it is in
sight; never because it is near, hunting or waiting unseen; the Hound/Smiler dread unchanged; a convincing disguise never betrayed; its
physical sounds stay.

**R10-1 What "seen" means: the renderer's own rules, not the server's.** A new module, `src/frameworks/spacious-audio/client/
skin.sight.js` (in `public/assets/skinstealer.js`), decides on the page, every frame, for each mirrored Skin-Stealer:
- *on screen*: its body (30 px round its centre) inside the window with this frame's camera and zoom (the `cam` and `sc` the game hands
  the dread hook; the camera shake of a few px is ignored);
- *in the sight mask*: the creatures layer is masked by `visibilityPolygon(player, 700)`, cast with the bundle's `rayDistance` (walls and
  pillars). The module casts the same function (`__api.Uc`) from the player to the body's centre and to points 18 px either side across
  the line of sight (the drawn body is ~42 px wide), each within 700 px;
- *readable*: the darkness overlay hides what is not lit for this player. The client's own legibility function `exposureAt`
  (`__api.Ul`: the near aura, this player's torch with its LOS, the lamps with their flicker, night vision and IR, the range fade) must be
  at least **.25** at a point that is in the mask. Measured values: a lamp-lit body at 260 px .60; torch-lit at 260 px .39; the dark .04;
  .25 sits well above darkness and below anything a player would call clearly lit.
A body counts as seen when at least one of its three points is in the mask and readable. Nothing here asks the server; the server's
`seenNow`, its distance and its sounds are never used.

**R10-2 A disguise is never given away.** A Skin-Stealer whose snapshot carries a borrowed look (`dg`) is not a candidate at all. When the
skin drops (its wind-up, a run, the time up) it is an ordinary candidate from that frame: a seen one gets the onset and, if armed, the
sting. A separate "suspicion" mechanic was not added (the pack leaves that to an explicit owner review).

**R10-3 A glimpse is not a sighting.** A sighting is *confirmed* after **0.12 s** of being seen without a break; a body flickering at a wall
edge confirms nothing. Once confirmed, the envelope `ks` rises to its target within ~0.1 s; the target is `0.35 + 0.65 × (1 − d/700)` (a
seen one is never quieter than the floor). Out of sight, `ks` falls linearly to 0 in **0.5 s** (the release) — no seconds of tracking.

**R10-4 The sting.** Once per confirmed sighting, for a Skin-Stealer that is *armed*; it is disarmed by its sting and armed again only
after **2.5 s** fully out of sight; at most one Skin-Stealer sting every **8 s** for all of them (no multi-creature spam). Within 1.2 s of
the established `k` sting it is not played (one sting, not two). Every rule advances with the frame's `dt`: no timer of its own, no random
draw.

**R10-5 Integration: one heartbeat, the rest untouched.** `src/core/client/mp.frame.js` asks `window.__skin.sight(t, {cam, sc, W, H, run})`
once a frame and beats the heartbeat on `max(k, ks)`; the drone, the vignette, the shake, the light flicker and the Hound/Smiler sting stay
on `k` alone. With `ks` 0 the hook's code path is R8's: the node test V12 runs R8's `mp.frame.js` (a fixture checked against its git blob)
and this one through 40 s of a Hound and two Smilers, frame by frame, and every output is identical with no Skin-Stealer and with one
behind a wall. The heartbeat's shared timer means that *after* a Skin-Stealer has been seen, the next Hound beat may fall up to one beat
period earlier or later than it would have — the only lasting difference, and only after a real sighting.

**R10-6 Audio only.** The owner asked for the heartbeat and the sting; no vignette, shake or flicker is driven by the Skin-Stealer (those
would also change what reduced-motion players see). Volumes are the established heartbeat's, scaled by `ks`; SOUND OFF silences it (the
thump's own check; a sting goes through the master gain, 0 when off — both observed in the browser, V10). `run` false (dead, spectating,
menu, paused) means no cue.

**R10-7 Not changed.** The Skin-Stealer's physical sounds (`skin.audio.js`: footfalls even when unseen, wind-up, leap, skid, feeding,
breath) are untouched: a hidden sprint can be heard where the game's acoustics carry it, with no dread cue.

## R11 — always attentive, hungry-opportunistic, with events and a belief it can explain

**Requirement** (pack `02`, owner): its reasoning is odd and it is not attentive; it must be *always attentive* (it notices people at any
hunger), *responsive* (a change in what it perceives is answered at once), *opportunistic* (hungry, it takes the chance rather than
standing watching), with a belief built only from what it saw, heard and remembers (C01–C15). The pack orders behaviour first; the covert
movement itself (moving out of a person's view) is R13 and the body R14.

**R11-1 A mind beside the decision, from its senses only.** A new server part, `src/frameworks/nani/server/ai.skin.mind.js` (in
`generated/server/ai.js`, built before `ai.skinstealer.js`), runs once per think (10 Hz near, the established cadence) before the decision
and keeps `e.mind`. It decides nothing; the decision reads it. It reads only `e.seenNow`, the records of people it sees (`e.mem.p`, their
`visual`, `light`), its own sounds list and its own strike tally — never a player's real place for anybody it does not see. With no
Skin-Stealer in the world nothing of it runs: **C15** hashes every snapshot of 30 s of the director's Hounds and Smilers with four players
(three seeds) and they are R8's byte for byte (`fixtures/c15_r8.json`, made on `f378049` by `tools/c15_hashes.js`).

**R11-2 "They could see me" by the rules of the player's screen.** R8's only notion of being observed was eye contact (a person *facing*
it within .35 rad). A player's screen shows everything in their sight mask that is lit enough, whichever way they face — the owner's
complaint was exactly a creature crossing the view of a player who was not looking straight at it. `skExposedTo(eng, observer, x, y)`
mirrors R10's client rule on the server's copy of the level: within 700 px, a clear line (`geo.los`) to the body's centre or a point 18 px
either side, and the client's `exposureAt` terms (`skLegible`: the near aura, the observer's torch as the creature sees it pointed, the
level's lamps with their failures and blackouts, the range fade) at least .25. The observer is a person it *sees* (their place, facing and
light as it sees them). For a person it does *not* see, `skObsOf` builds an observer from a belief (place only, facing unknown, so a torch
is assumed able to point at it) — "I suspect they could see me", distinct from "they saw me" and from "I do not know where they are". R11
only records these; R13 is where it moves by them.

**R11-3 Events with a response time.** On each think it compares what it perceives with its last think and records an event: `sight` (a
person newly in its sight), `lost`, `exposed` / `hidden` (it came into / left a seen person's view), `turned` (a seen person turned to
face it), `reach`, `winded` (a seen quarry exhausted or below 25 stamina), `sound` (anonymous unless the established hearing named it),
`miss`, `wall`. The first decision that weighs an event answers it, with the seconds it took: a change of plan (`changed`), or a decision
that weighed it and deliberately kept its plan (`kept`, `skMindKept`: a plan that goes on without a sighting — intercept, search, lure,
listen, a flank under way — or a plan still clearly the best). The answer is the decision's, not the movement's: a creature that
keeps its intercept after losing sight of its quarry has answered. Measured (C14): 22 sight/loss events, median 0.12 s (one think),
90 % 0.7 s — the slow tail is R4's deliberate `lostGrace` (.6 s: a glimpse lost for a moment during an approach or chase is not yet lost),
kept unchanged. C11: a person who shows up elsewhere while it waits at a wrong guess is answered in 0.12 s in every seed.

**R11-4 Always attentive.** (a) Its head turns to the person it notices most among those it sees, at any hunger, up to 760 px: whoever
meets its eyes, then whoever could see it, then whoever comes toward it, then the nearest — a look with the head; its way goes on. B1's
own tracking of whoever it has noticed close by keeps priority, and a departure keeps B1's tracking only (no new gaze while leaving).
(b) A person it has just seen (within 1.5 s of first sight), beyond its personal space, who meets its eyes within 480 px or comes its way
within 360 px: it stops and looks at them once (.35–.55 s), whatever it then decides. Satiated and leaving, it does not stop: its head
turns back over its shoulder to them (up to 1.5 rad) for 1.4 s as it goes, and the distances are ×1.6 (it costs it nothing). C02: a
satiated one (.1) turned 57° away from a person watching it at 450 px faces them or turns its head to them within 0.1 s (6 seeds), and
the same for a person who walks up from 520 px to 300; it never hunts them. Closer than its personal space, B1's established looks and
warnings are unchanged (all of `s_skinbehave.js` passes untouched).

**R11-5 Hungry, it takes the chance.** (a) A look at somebody (`watch`) is an assessment, not a vigil: its length is ×(1 − .7 ×
sm(.35, .6, hunger)) — unchanged when satiated, 30 % of R8's from .6. C14: hungry (.75) with a lone person in view it never watched more
than 3 s at a stretch (measured 0 s: it acted on its first think). (b) Being lit and watched sent away anybody short of starving in R8
(`.5 × (1 − hs)`); now only the not-yet-hungry (`.5 × (1 − hm)`): a hungry one finds another way (a flank, an approach, the retreat that
baits) instead of leaving. C01: hungry (.6 / .75), watched or unaware, the first hunt step follows the very think it first saw them (lag
0 s in 16 runs). C03: starving (.95), watched in the north corridor with no way round, it comes on openly within 0.1 s and never leaves.
The fairness locks are untouched: run 255 against the player's 285, the same wind-up, reach and stamina.

**R11-6 A belief it can explain.** Its hunt (R1–R2's `e.hunt`) keeps a short log of its evidence (12 lines): `seen` (a new sighting, then
every 2 s in sight), `heard` (a sound that fitted where they could be; anonymous, its type), `inferred` (each guess it acts on: intercept,
route, the other way, belief, last place) and `disproved` (a place it found empty). The admin overlay (OVERSEER's `ents.debug.js`, debug
mode only, never drawn for players) shows `MIND` — for each person it sees whether they could see it, how long since they could, how long
since they met its eyes — its last events with how and how fast it answered, and (selected) the evidence log. Everything in it is the
creature's own; the overlay's omniscient QA layers are not read by the AI (C09: while it cannot sense a person, nothing it keeps —
belief, observations, events, debug — holds where they really are; the snapshot's fields are still `a,ac,h,i,s,v,x,y`). C05: footsteps
behind a wall it never saw are anonymous events; no record, plan or hunt names that person. C06: another player's running can mislead
it (its belief moved toward B in 5 of 6 runs) and B is never named. C07: a person seen once who crouches out of sight and stays silent is
given up for a stated reason at 19–22 s and the hunt never comes back without new evidence (7 of 8 seeds had the glimpse; in one the
person never came into its sight, reported, not counted). C08: two worlds the same to its senses give the same creature, tick for tick.
C10: confidence only falls without evidence; failed places are forgotten after their time.

**R11-7 Not changed here.** The exposed crossing itself (R9-01) is R13's: R11 knows when it is in a person's view but does not yet move
by it, so `s_skinr9.js` still fails as on R8 (expected; reported, not registered in `run.js`). Its route hypotheses are R12's. The
established hearing, strike, fairness numbers and the Hound/Smiler code are untouched.

**R11-8 Its cost, measured separately** (`perf_pr.js`, 3 rounds × 60 s, 8 players, R8 `f378049` against R11; `evidence/r11/perf_*`).
Run both ways round (each tree once in the "base" slot), because R9's A/A run (R8 against itself) already showed the second slot
+15 % slower without any Skin-Stealer. R8 → R11: one, four, four pressed and four starving all within the 60 Hz budget and no worse
than the base (means −1 % … +4 %, p99 −14 % … +0.2 %); without a Skin-Stealer +16 % against a tight base spread, so that line of the
tool reads FAIL — the same second-slot bias as the A/A run, in the one case where none of R11's code runs (C15: every snapshot is
R8's). R11 → R8 (swapped): without a Skin-Stealer the same cost (R8 5 % faster, inside the tolerance); four starving R8 +8 % mean /
+50 % p99 *slower* than R11, which that line reads as a failure of R8. Neither order separates the trees beyond the run-to-run noise;
every run kept the 60 Hz budget with no invariant violation. R16 repeats this with more rounds in both orders.

## R12 — inference: the ways a quarry could have gone, held as hypotheses

**Requirement** (pack `02` "belief and imperfect prediction", `03`; checkpoint R12): legitimate inference, multiple route hypotheses,
time-, cost- and uncertainty-aware candidate reasoning; wrong-turn, anonymous-audio and evidence-equivalence checks; no oracle; capped
CPU. R8 guessed a way with one seeded walk; "the other way" existed only once the first had failed.

**R12-1 The ways, listed from its own evidence.** A new server part, `src/frameworks/nani/server/ai.skin.infer.js`. From where it last had
them and the heading it saw (never where they are), it walks the heading until the way is blocked; there it tries 16 directions, groups
adjacent open ones into openings (an opening wider than 135° is split), takes each opening's direction nearest the heading, and walks each
on (at later blocks the turn that keeps the heading best — no draw). With "they stopped or hid near where it last had them" it holds at
most four ways. Prior of a way: `exp(cos turn)` — R8's own measure of how people keep their heading (its walk scored turns by `cos` plus
its seeded error) — so two 68° turns are .39 each, the 135° way back .13, the stop .08 (more when they were slow or their steps stopped).
Measured (C21): two to four ways at every first guess, probabilities summing to one, the likeliest the one nearest the heading, every
segment on walkable floor, and the very same ways whichever way the person really went.

**R12-2 Anchored on a sighting.** The ways are listed when it last saw them and kept while sounds and empty places weigh them; listed
again only from a newer sighting, or — once evidence has ruled out every one — from its newest evidence. (A first version re-listed them
from every sound: each listing started at the sound, so no sound could ever tell the ways apart.) At most one listing every 0.4 s; a
listing is a few hundred line tests and no route search. R12-B: in eight seen-and-lost hunts one or two listings in 30 s each, at most
four ways held, the interception's real-route checks (`geo.path`) never more than four per interception weighed.

**R12-3 Evidence moves them.** *An empty place* it searched or waited at, on a way's own stretch (at least 200 px past its fork — at the
fork an empty place says nothing about which way they took), DISPROVES that way: its weight ×0.1, kept with the reason, never erased —
the record of what the wrong guess cost. *A fresh sound it takes for theirs* (R2's existing fit test decides that, before anything
here) re-weighs every way by how well it explains the sound: the way's nearest point a person could have reached by then (40–320 px/s
from the anchor), a Gaussian spread of 90 px plus half the sound's own fuzz; a way under 0.2 of the best is REJECTED, the sound named.
Then the belief moves to the sound as in R2. C22: a person running east or north-west after the glimpse — of 12 runs, 7 had sounds taken
for theirs while ways were held; in all 7 the sounds re-weighed them (a way rejected or one gaining at least .15), and each time a next
guess followed it went to the side it heard (3/3); the same moves crouched rejected nothing. C20: a person who doubles back unheard — in
9 of 12 runs its bet was wrong; in all 9 the way was disproved with its reason, the next guess went to another way or its belief, no
place twice, and the hunt ended within its guesses ("no sign … it gives up").

**R12-4 Its bet stays R8's walk; the ways label, weigh and veto.** `skGuess` still makes R8's candidates in R8's order with R8's draws —
the interception on its walk of their way, where they would be along that walk, the other way at its first turn, its belief, the place
it last had them — and R12 then labels each with the way it lies on (`skHypOf`: the way whose own stretch passes within 200 px), adds
`0.3 × ln(p/p_max)` (at most −0.6) to its score, refuses a candidate on a ruled-out way (reason `disproved`), and adds, after R8's draws,
a guess along a likely way none of them lies on (`way`, at least p .06). The interception made at the moment it loses sight, and its
correction on hearing them elsewhere, are labelled and refused the same way. *Why not bet among the ways directly:* a first version bet
on `argmax(ln p + R8's error)`; it is equivalent in distribution but consumed the streams differently, and every later draw moved — R8's
statistical scenes shifted (PR11 heard the runner in 3 of 8 runs instead of 6, PR24 ran into a latent re-planning storm). Keeping R8's
walk keeps PR09's property (its first guess at wall B differs between seeds — sometimes wrong either way) by construction.

**R12-5 Time, cost and uncertainty.** An interception is weighed only within 4 s of its newest evidence (else `evidence_stale`) and only
where its real route beats them (R8's check: at most four `geo.path` routes; the slack is now recorded; else `late_to_intercept`). Every
candidate's travel time `T = 1.2 × distance / run speed` costs `0.02 × T`, and one whose uncertainty on arrival (`belief u + 90 px/s × T`)
exceeds 900 px loses 0.2: a near, sure guess beats a far, vague one of the same worth. These change which candidate wins, never the draws.

**R12-6 Reasons for what it did not do.** Each guess records its rejected rivals: `evidence_stale`, `no_heading`, `late_to_intercept`,
`disproved`, `unlikely`, `no_floor`, `on_a_way`, `less_likely` (R12-A: 27 rivals over 13 guesses, four kinds, none outside the
vocabulary; never an interception on evidence older than 4 s). The hunt's evidence log gains the way and its probability for each
inference; the admin overlay shows `WAYS` (each way, its likelihood, the one its guess lies on, ruled-out marks) and, for the selected
creature, why each was ruled out and the rejected rivals. `evidence/r12/trace_r12.txt` follows three hunts line by line.

**R12-7 Evidence equivalence and no oracle.** C23: a person who silently takes one way or another — alone, and with a never-seen second
person running the same lane in both worlds — its ways, bets, rejected rivals and every decision are identical tick for tick until it
senses a difference (eight pairs). C09 (R11's) now also covers the ways (the debug holds them): while it cannot sense a person nothing it
keeps holds their true place. C05/C06 still hold: footsteps it cannot attribute name nobody; a second player's running can mislead it.

**R12-8 Found on the way.** In one PR24 hunt R12's changed choices led an approach to a person pressed against a low wall 47 px away: it
could neither reach nor grab across the wall (the reach test is a walk test) and, inside its stopping distance with the person still
pushing, re-planned a used-up route on every think (173 route searches in 20 s, PR24's bound broken). The re-planning is now at most
twice a second inside the stopping distance (unchanged beyond it); the deadlock itself — it should go round or wait — is a physical
legality question for R13 (C27).

**R12-9 Cost** (`evidence/r12/perf_*`). Three rounds R8 → R12 read +20 % mean with one creature and +21 % with four pressed (FAIL against
the base on those two lines); the same three rounds swapped (R12 in the base slot) read R8 11–12 % *faster* on the same lines; five
rounds R8 → R12 then read −3.7 % (one), −5.3 % (four), +10.3 % (four pressed), +3 % (four starving), and five rounds R8 → R11 +5.1 %,
−0.5 %, +9.2 %, −9.5 % — PASS both. The one consistent signal is about +10 % mean (≈ 0.02 ms a step) with four creatures pressed by
eight players, present at R11 already: the mind's per-think exposure test for every person in sight (a CPU profile of that run: the
mind 1.1 % of all samples, inside the Skin-Stealer's 16.5 %). Every run stays far inside the 60 Hz budget (means ≤ 0.27 ms, p99 ≤ 3.8 ms)
with no invariant violation. R16 measures again with more rounds.
