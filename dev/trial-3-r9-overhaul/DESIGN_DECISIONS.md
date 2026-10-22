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

## R13 — a covert way that is one: the withdrawal, the hidden run, caught on the way, and honest open moves

**Requirement** (pack `03`, the owner's report; checkpoint R13: C16–C27, browser scenes reproducing and correcting the complaint). R9 found
the causes (R9_AUDIT H1–H4, H7): an exposed transit to a hidden endpoint, no re-check on the way, "unwatched" meaning only eye contact, no
hidden sprint, the observer frozen at plan time.

**R13-1 Seen means their screen.** In the decision a person "sees it" when they meet its eyes (R8's eye contact) *or* it is in their view by
the rules of their own screen (R11's mind: sight mask, clear line, readable light — whichever way they face). Every tactic that hides from
them now hides from their view: the flank is chosen when it is seen either way; an approach it is not seen making must be covert or is
open. Eye contact keeps its own meaning where it had one: B1–B3's looks, warnings and defence, the bait (an answer to a look), and a
not-yet-hungry one sent away by a look in the light.

**R13-2 The covert way** (new part `src/frameworks/nani/server/ai.skin.cover.js`; see its head). The views it knows of are the people it sees,
saw within 1.5 s, or heard since from a place (their light able to point anywhere), and footsteps it cannot name heard within 1 s; for its
quarry with none of these, a view from its belief (a suspicion). From a start in somebody's view it first makes a WITHDRAWAL: straight
away from them (bearing within 0.4 rad, farther from them all the way, never toward or across anybody), at most 240 px, to the first
point none of them can see. From there an A* on the level's own grid treats every cell anybody it is sure of could see — its body with
34 px to spare across their line of sight — as impassable; a cell only suspected costs 260 more. The way found is walked every 24 px and
tested again with the true body rule; it is COVERT only if after the withdrawal no point is in a view it is sure of, at most 144 px lie in
a view it only suspects, it has no vault, and it is at most 2,200 px; otherwise it is refused with the reason (`no_exit`, `no_cover`,
`route_exposed`, `route_suspected`, `too_long`). The cost is never lowered until an exposed way wins. It follows the way with its own
steering (a 40 px look-ahead: no corner cut into a view; no re-planning with a softer cost — stuck, it asks for a new covert way or ends
the move). C17: in R9-01's scene its flanks take covert ways of 1,706–1,750 px for spots 411–458 px away (3.8–3.9 × their distance; R8
refused anything over 2.6 ×); 0 ticks in view after the withdrawal.

**R13-3 Out of view first, then the run.** The withdrawal is made at its walk (`stalk`, 90 px/s, act `back`); hidden, it runs at its run
(255 px/s, under the rested player's 285, stamina spent by the established rule; act `intercept`) — at once if it started hidden, after
96 px otherwise — and slows to a walk (`creep`) for the last 220 px to arrive quietly. While hidden it looks back over its shoulder every
1.4 s (0.4 s, up to 1.3 rad): its sight follows its head, so it can see somebody stepping in behind it. C19: six of six watched-hall
flanks withdrew first (2.2 s; nearer them 0 ticks, faster than a walk 0), then ran hidden 4.5–4.6 s — at a run in their view 0 ticks.

**R13-4 Caught on the way (SURPRISE COMPROMISED).** Every think of a covert move asks whether anybody it knows of can see it now (seen, a
moment ago, or heard from a place that could). If so it never goes on as if unseen: once per move it may duck back out of their view along
a new covert way to the same place (a withdrawal first); otherwise, very hungry and near, it comes on openly (committed: carried through
until they flee); hungry, it stands off where they can see it; less, it goes. The place is remembered as having no way round for 10 s.
C18: the watcher runs to where they can see its covert way — in eight of eight runs it knew 0.33 s after they moved (it heard them), and
was afterwards on a covert way in their view 0 or 8 px (one think).

**R13-5 Modes are never mislabeled.** Every move carries its mode, in the debug, the overlay (`MOVE`) and the page's act: COVERT (a flank;
an approach along a covert way to an ambush point; an interception whose way and waiting spot are covert), OPEN (an approach in somebody's
view — upright, `pace`; a rush from cover — `chase`; an interception that cannot be hidden; keeping to a runner's trail), FEINT (the bait,
meant to be seen), WITHDRAW. An open approach not yet in anybody's view stalks crouched; the moment somebody it knows of could see it, it
walks upright. R9-01 (now in `run.js`): 12 runs, 10 with a covert way, 0 px in the person's sight on a covert way; withdrawals seen
132–138 px, none nearer them or across their front.

**R13-6 The decision, re-weighed.** The flank is not chosen round somebody running off (a chase is). An approach in their view but not
met by their eyes weighs `.55 + .6 × hs` (R8's unaware 1.0, watched `.15 + 1.1 × hs`) — so a covert way round is preferred where there is
one; an open approach under way is carried (weight 2) until they meet its eyes (unless it committed after being caught) or flee; within a
leap (≤ 245 px) of a lone person who is not looking at it, a hungry one takes the chance (+1.5; never during a chase or a flight). An
approach it is not seen making goes along a covert way to an ambush point within its spring (out of their view — behind something, or
in the dark where it can watch them unseen, preferred); with none, it comes on openly only very hungry (or at a runner or a winded one),
else it flanks from where it is or holds. If they move 150 px from where its ambush point was chosen it follows them openly instead.

**R13-7 From cover.** At its flank spot or ambush point: a nearer covert spot within its spring if there is one; else, very hungry and
within 360 px of where it believes them (seen, or its hunt still ≥ .3 sure), it BREAKS COVER AND RUSHES — open, at its run, carried 2.2 s
toward where they were; else it waits in AMBUSH (a new plan kind, not the bait's lure: still, facing where they would come, springing
when they do; very hungry, 3–6 s), and after a second such wait it hunts on (its guesses) or goes. A wait out of their view is not drawn
out by merely seeing them from it. In R9-01's scene (W .75) this now reads: withdrawal → hidden run round the hall → at their side →
rush → spring (with its wind-up) at 11.8 s.

**R13-8 Interceptions.** The waiting spot must be hidden from four points of the way they would come (R8: one); the way to it is a covert
way against everybody it knows of and the quarry's view from its belief; with both, the interception is COVERT and followed as such;
otherwise it is OPEN (R8's route off their trail, so labelled). C24: tired (stamina 20: its tired run 180), it aims farther ahead
(720→1,056 px, 1,488 px → none) or not at all; every interception it makes it expects to reach first by its own route (slack 0.17–0.52 s).
C25: in nine decisions where the interception was reckoned too late or too old it went to its route, its belief, or nothing — never the
interception.

**R13-9 Bookkeeping, not tactics.** A strike answers the events it was waiting on (its think stops while a strike is carried through: R11's
latency would otherwise count the leap as silence); somebody who comes into its reach while it waits counts as having come (the bait and
the ambush both). R13's new searches for spots draw from their own stream (`skinstealer-cover`): R8's draws, and so R8's statistical
scenes, do not move.

**R13-10 What the suites now say.** All of `s_skinstealer` 34/34, `s_skinbehave` 19/19, `s_skinpredator` 30/30, `s_skinsight` 9/9,
`s_skinmind` 15/15, `s_skinroute` 15/15 (C16–C27 added), `s_skinr9` 1/1. C16: watched where every way to a hidden spot crosses their view
(the hall at x 3,500), it never begins a covert move, records `no_cover` / `no_spot`, and answers with the bait, an open approach or a
standoff. C26: rested (.75) and starving (.95), a fresh runner on the open hall is never neared closer than 351 px, its top speed 255,
900+ px apart after 12 s. C27: 19,200 ticks of these moves, never inside a wall; 12 springs, every one with its whole wind-up; 11 kills,
body to body, nothing solid between. R13-A: covert-way searches average 0.03 a creature-second (at most 3 in any second).

**R13-11 Tests changed, and why** (each assertion's invariant kept; listed in `REGRESSION.md` at R17):
- `s_skinpredator.js` PR07 — its claim "no way round the watcher" is about the narrow corridor; after the watcher breaks away and runs
  out into the hall, R13 may find a genuine covert way round there (R8's 2.6 × limit refused it). Flank ticks are now counted while the
  watcher is in the corridor. Everything else unchanged.
- PR17 — "approaching" now accepts R13's honest acts: hidden `approach`/`creep`, a covert way's `back` and `intercept`, open `pace` and
  `chase`; listening is still judged exactly as before; 12 seeds instead of 8 (its first approach now often goes on a covert way, so
  fewer runs pause to listen), five with both phases still required.
- `s_skinstealer.js` SK21, SK41 — the bait must be judged where the bait is the answer to being seen. At 600 px in that dark gap the
  person cannot make it out (legibility .23 even at 300 px in their beam) and R13 goes round under cover to an ambush point instead of
  creeping into their beam until it met their eyes (as R8 did). Both scenes now start it 265 px away, in the beam, met by their eyes and
  beyond `SK.near` — every T3/T6 rule they check is unchanged.
- `s_skinroute.js` C22 (R12's own) — 20 runs instead of 12 (more of them now end in a kill before a second guess), and "the side it
  heard" includes a look at the very place it heard them.

**R13-12 The real page after** (`evidence/r13/browser/`: `r9_browser.js --scene flankwatch`, four tries, the page's own view measured on
the page). The owner's scene (R9-01: a lit person in the long hall, a Skin-Stealer 450 px east): in three tries it backs straight out of
their sight (105–116 px of that withdrawal seen, by design: it was seen, and backing away is what it does about it), then goes round
under cover — 1,423–1,427 px of covert way with **0 of 23–25 samples in the page's view** — and breaks cover at their side, labelled
`approach:open` ("no cover nearer - it breaks cover and rushes"). In the fourth (hunger .75) it answers with the bait — `bait:feint`, a
move meant to be seen — creeps 66 px under cover unseen (0/2), is caught, and comes on openly ("its surprise is spoiled"). R8 in the same
scene crossed the person's view on its "flank" (R9: 71–100 % of its transit samples in view). The video (try 3) and its contact sheet
show the withdrawal and then an empty, watched hall.

**R13-13 Cost — and a fix found by measuring it.** The first R13 measurement (`evidence/r13/perf/*_before_search_fix.txt`) passed the
perf tool's criteria (mean and p99 within the 60 Hz budget) but its **worst** steps were 30–105 ms against R8's 10–17: a covert-way
search that finds nothing (watched from all round) spent its whole A* budget (3,500 nodes, ~30 ms) and a flank asked for up to three.
Profiled (a copy of the built `ai.js` with timing wrappers; not committed): the time was the A* itself and its view tests, not the rest of
the think. Three changes, none of which changes a covert way it takes:
- a cell no way short enough could pass through (straight distance from the search's start plus to its goal over the longest way it would
  accept — `SKC.coverMax`, or a flank's own limit, now passed in) is never searched: an accepted way is found exactly as before; a search
  for a way it could not have taken ends early. (A way whose cheapest route was too long, where a shorter acceptable one existed, is now
  found — before, it was refused as `too_long`.)
- one cost memo for every search to the same views (a flank's three tries share it): a cell's cost depends only on the views;
- the line of sight is tested before legibility (most cells it tests are behind a wall).
Counted on the suites' 986 covert searches, every one that found a way expanded ≤ 390 nodes; on the real level (perf scenes) successful
searches touch up to ~2,900 cells, which is why the node budget itself was **not** cut (cutting it to 800 would have lost 7 of 10 real
covert ways). After the fix, the same perf matrix, five rounds, both orders (`evidence/r13/perf/`): worst steps of the R13 tree 14–36 ms
in one order and 10–23 ms in the other (R8 9–25); means: no Skin-Stealer the same cost (+10.5 % / −9.8 %, within tolerance); one +/−5.5 %;
four +10.7 % / +13.9 %; four starving +19.4 % / +14.1 %; four with every player pressing one +32.8 % / +30.3 % (0.30 ms against 0.23: 1.8 %
of a 60 Hz step). p99 in that pressing scene 3.7–4.4 ms against R8's 2.3–6.1 — at the tool's own 25 % line in one order (4.27 ms), under it
in the other; seeded runs of the same scene with the AI instrumented put R13's p99 above R8's in one seed and below in two (4.81/4.42,
3.78/4.08, 4.41/4.52): within the scene's spread, not a measured regression. The tool's verdict: PASS in both orders. All suites were
re-run after the fix (the counts in R13-10 are the fixed tree's) and the real page (R13-12) is the fixed tree's.

**R13-14 Known limits** (to `DEFERRED.md` at R17): an approach across a low wall it cannot pass can still stand off at the wall (R12's
latent R8 deadlock: no grab across it, no spring under 55 px; replans are now rate-limited, the standing is not solved); exposure to a
person it only believes is there is a soft cost, not a wall — a covert way may cross where it believes they could see, within
`SKC.suspectMax` (144 px); it cannot see behind itself except in its glances back on a covert way; a covert way is planned on the 48 px
grid and only then audited point by point — a way the audit refuses is not repaired, it is dropped (an open move or another choice
follows, labelled).

## R14 — its body drawn for the camera the game has (client drawing only)

**Requirement** (pack `05`, owner): a body redesigned for the actual top-down view, not a frontal figure flattened onto the floor;
imposing beside Wanderers; readable heading, head focus, stalking, sprinting and grappling from every heading; no squatting frog, no raised
hands; collider, reach and disguise size unchanged; lighting, darkness, occlusion, culling and replay consistency kept; a report with
**visual approval pending**. The report is `R14_TOPDOWN_ART_REPORT.md`; the decisions:

**R14-1 A skeleton seen from above, not a sprite turned.** `skin.body.js` poses a three-dimensional skeleton (`rig()`: hips, a spine that
leans, shoulders, a long neck, the skull; two-bone IK for arms and legs with poles that bend knees forward and elbows back) and projects it
straight down. Standing, it is a wide bony shoulder line and a small skull; the more it leans the more of its long back the camera sees.
Every number is a proportion of one anatomy (`AN`), not a per-pose drawing.

**R14-2 Its size stays the owner's choice.** `BODY_SCALE` is still 1.3 (R5's, unapproved). The anatomy itself makes it read bigger
(shoulders 1.3× a Wanderer's body, 2.6 m straightened; stooped as it stands, its crown at 166 px), as do its reach and stride. Height is
never drawn as a perspective trick (pack 05 §7).

**R14-3 The pose says only what the server says.** The act picks a posture (`POSE`: crouch, lean, hands to the floor, coiled, drawn back,
reaching, off the ground, head down); the real velocity (in its own frame) drives the stride, its direction and the lean; a sharp stop
brakes; the server's head turns the skull on the neck. Nothing is random: tics and hair are seeded by the entity's id (two pages draw the
same body; D01).

**R14-4 Still and hidden means compact, and centred.** The figure is centred on its server position (between the front of its skull and
the back of its hips), still postures keep within 40 px of the centre (coiled: hands tucked under the shoulders, the head drawn in), and
the shadow never leaves its own reach by more than 10 px nor moves toward a near wall. The real page's edge test still finds a coiled
figure 18–30 px behind a view's edge showing a hand or its head (as R8's did, at 12–36 px): the server counts a body hidden when its centre
and 18 px either side are out of view — that margin, not the drawing, is the lever (R16).

**R14-5 Kills grip where the victim is.** `skin.kill.js` gives the attacker the living body's skeleton and sets its grip from the death's
own physics: as far ahead as the victim's body really is and as high as their neck at that moment (A: until the snap; B: down at once;
C: as the legs go), the jaw open at C's bites. The death's timing is G.I.B.'s (`dphys.js` CFG), unchanged.

**R14-6 The skin's fold.** Putting the skin on, the body fades and shrinks into the page's own Wanderer avatar over about a quarter of a
second; dropping it (to strike, to run), the body is back within about a tenth of a second (G05: 67 ms to 90 %) — the wind-up's tell is
never hidden by the transition. The avatar is never scaled.

**R14-7 Cost no higher in shapes.** 55–56 fills and strokes a frame per creature (R8's figure: about 55): strokes of one style share a path,
the trunk is one outline drawn three times (outline, flank, lit back). A still figure is not redrawn while what it would draw is unchanged
(a key of its joints to a quarter of a unit); only its head's turn, a property, moves.

**R14-8 Tests changed, and why** (listed in `REGRESSION.md` at R17): `s_skinpredator.js` PR23 counted the mentions of `BODY_SCALE` as its
proxy for "one source of the drawing scale"; R14 uses the constant in more places (the stride in floor px, the shadow's reach, a kill's
grip, the skin's fold). PR23 now checks the invariant itself — one definition, and no view scaled by a number of its own; every other
check in it is unchanged. New: `s_skinbody.js` (G01–G06, M01, K01, D01, P01, S01) in `run.js`.

**R14-9 What the suites say.** `s_skinbody` 11/11 (new), every other Skin-Stealer suite as at R13, Human QA hotfix 5/6 (X03 inherited),
`npm test` 283/296 with the same 13 inherited failures. The real page: the gallery (12 acts × 8 headings), places, the view's edge and
the deaths A–C, beside R8's (`evidence/r14/`); the measured edge leak and the drawing cost are in the report (§6, §7).

## R15 — Execution D, the Rend, through G.I.B.

**Requirement** (pack `06`, a co-developer's idea the owner put in scope): a fourth, optional kill — the creature tears its victim in
two — only after a capture that was already lethal, never a new way to catch anybody; rare and only where it fits; two persistent major
segments in G.I.B.'s own shared physics, the same on the victim's screen, every spectator's, a late joiner's and in the server's fallback;
its own sound and posture; Hound A–D, Smiler A–D, NEW RUN's blast and the Skin-Stealer's A–C unchanged; no protocol rewrite; a full shared
regression. Or `R15 BLOCKED` with a plan. It was not blocked: G.I.B. already had everything a two-piece body needs (Stage 3D HQ3's gibs: a
seeded breakup, loose pieces with their own physics, a corpse record naming them, the corpse drawn from the record alone).

**R15-1 The Rend is a variant of the same kill, never a new attack.** Nothing about catching anybody changed: the same contact (`killNow`
after the capture), the same commit, the same reach, the same wind-up. D is one more item in the Skin-Stealer's own `capture.variants`:
weight 0.3 (0.5 starving) only for a **grab** (never the end of a leap), only **hungry** (`SK.band[2]`), only with **room for the two
halves** (rays from the victim, 72 px clear either side of the line of the pull); anywhere else its weight is nothing, the item is
filtered out, and the draw is exactly A–C's own (G08: 400/400 identical picks). The recent-kills rule (`pickVariant`) keeps it from
repeating. Its death lasts 3.6 s (`commitDur.D`, `DURS.SkinStealer.D`). How rare: in the most favourable case there is (a starving
creature, a standing victim in the open hall, a grab) 6 of 30 real kills were D, the rest A–C; a leap, a wall at the victim's side or
hunger under `band[2]` make it impossible. (A first draft weighed it 0.45 / 0.7: 8 of 30 in that case — too common for "rare"; lowered.)
Its tell (G08's "clear tell"): from the grip it plants itself with both hands on the victim's sides at their chest — a posture no other
kill has — for most of a second before the pull.

**R15-2 One physics, two halves.** `dphys.js` (G.I.B.'s shared 240 Hz physics, the single truth for every screen and the server): D holds
the victim as A does (the grip, the pin); at 1.05 s `rend()` turns the body into two halves — `rendShapes(gs)`: the Wanderer's round body
cut along a ragged line at the angle the pull came from, in gibShapes' own form — each thrown to its own side of the line of the pull with
the hand on that side, the light and the hat thrown, blood where it tore; from then on the halves and the hands are loose bodies stepped by
the same `gibBody` as a NEW RUN's pieces, and the attacker eases off as in A–C. The whole body is hidden from that moment (`jl.body.alpha` 0:
the bundle's own death and every replay read it).

**R15-3 The record: no new field.** The corpse carries `gs`, `gb`, `gh` exactly as a NEW RUN's does; `gs` is the breakup's seed with the
cut's angle in its low 6 bits (64 steps), so the seed alone rebuilds the two outlines (`shapesOf(cause, gs)`). The server's corpse
(`death_srv.corpse`) already copied `remains().gibs`; `remains()` and the light's carrier now count a rend's halves as they count a NEW
RUN's pieces.

**R15-4 The wire: one condition widened, backward compatible.** `net-wire.js` kept pieces only for a NEW RUN (`c === 'Boom'`, 1–8); it now
also keeps them for a Skin-Stealer's corpse with **exactly two** (G13). An older page given such a record drops the pieces and draws a
whole corpse; nothing else changes shape or size (two more short arrays on that one corpse).

**R15-5 Every screen draws the halves from the same physics.** A spectator's replay (`mp.deaths.js`) adds the halves the moment the
physics rends; the victim's own screen draws them in the Skin-Stealer's kill module (`skin.kill.js`, the page's own `gore.gibs` in the
victim's look) while the bundle hides the whole body; a corpse anywhere (a late joiner, a reload) draws them from its record
(`gore.js`, `shapesOf`). The attacker: planted, both hands on the victim's sides at their chest; at the rend each hand goes with its half
for a moment, then lets go.

**R15-6 Its sound.** At the rend, once per death and where it happened (the audio module's own `rend()`, placed by distance and walls as
the others): a wet tearing pull, a heavy split, the halves landing. A spectator's death sound knows D by its own blow times (never taken
for A).

**R15-7 The shared changes, each the smallest that works** (and the regression that proves the rest unchanged):
- `dphys.js` (G.I.B.): `CFG.SkinStealer.D`, `DURS.SkinStealer.D`, `PLAN('SkinStealer', 'D')`, `prepare()` no longer refusing it,
  `rendShapes` / `rendSeed` / `shapesOf` / `rend` / `stepRent`, and the rent case beside the blast's in `frame` (alpha, the headlamp),
  `gibRecord` and `remains`. G12: R8's `dphys.js` (fixture, its git blob checked) and this one give **the same every 1/60 s of all
  Hound A–D and Smiler A–D deaths and the Skin-Stealer's A–C (22 deaths), open and by a wall, and the same corpse**; a NEW RUN's blast and
  breakup identical; `SK34` (144 Hound/Smiler deaths bit for bit P9's) unchanged.
- `ai.capture.js` (shared capture): the one clause that refused the Skin-Stealer's D in `previewKill` is gone (S15: 4518f93's file with
  that one line is this one). PR25 checks exactly that, and that every other shared file is byte for byte 4518f93's (R15-9).
- `admin.js` (OVERSEER): the same `preview` command, A–D now allowed for the Skin-Stealer (no new command, no new auth); its DEATHS tab
  gains the D button.
- `net-wire.js` (B++): R15-4. `gore.js`, `mp.deaths.js` (G.I.B. client): R15-5.
- `declared_changes.json` (the scope gate's list of runtime changes since B++): `assets/net-wire.js` declared; the R15 reasons added to
  `dphys.js`, `gore.js`, `mp.js`, `ai.js` and the admin module's entries.

**R15-8 On real pages** (`tools/r9_browser.js --scene rend`, `evidence/r15/`): two runs (one with screenshots and the victim's video, one
without), each playing D, then A as the control, then D with the victim's page closed half a second in — each through the admin's DEATHS
preview, the real capture and kill path, whose kill record says `D` and `SkinStealer` on every page. Every time: the victim's own
screen hides the whole body from the rend on (the bundle's body alpha 0, the physics rent) and draws the two halves; a spectator's replay
draws the halves from about a second after its first frame (the physics rends at 1.05 s), never the whole body after them (0 frames), and
never more than one Skin-Stealer on the page (the replay's attacker; the live one hidden while its kill plays — G13's half on the page); the rend's tone once on
each page that saw it, none for A; the corpse the spectator, the victim and a late joiner hold is one record (cause, seed, both halves'
places and turns, both hands) and this death's (its age); with the victim gone, the server's fallback made the corpse — number for number
the first D's at the same place (the same inputs, the same physics). The deaths A–D side by side on a spectator's page
(`deaths_r15_A_to_D_spectator.jpg`): A–C as at R14, D's halves to either side. No page errors. The first run found the tear's sound
missing on a page drawing only a few frames a second (SwiftShader, screenshots): it played only on a frame within 0.4 s of the tear; it
now plays on the first frame that finds the body rent within a second of it (a page that hitched still hears it; one arriving later does
not).

**R15-9 Tests changed, and why** (each to the invariant it stood for; listed in `REGRESSION.md` at R17):
- `s_skinpredator.js` PR25 required eight shared files byte for byte 4518f93's. Its invariant is that the Hound's and the Smiler's code and
  the shared engine are theirs. `ai.capture.js` now differs by the one line R15-7 names, whose removed clause
  (`!(e.kind === 'skinstealer' && variant === 'D')`) was true for every other creature — the expression is the same for them. PR25 now
  accepts 4518f93's file with exactly that line replaced and nothing else; the other seven files are still compared byte for byte. The
  independent reason: pack `06` requires the Skin-Stealer's D preview in `previewKill` once every path exists.
- `s_skinstealer.js` SK33 said "every real kill is one of A-C" — the guard against a variant the Skin-Stealer had no death for. It now
  accepts D only from a grab (the attacker within grab reach + 6 px of the victim at the kill). Its 18 kills: R14 `{B 7, A 2, C 9}`, R15
  `{B 7, A 2, C 8, D 1}` — still 18 kills, B and A as before, one that was C now a D where D fitted. Its other checks are unchanged.
- New: `s_skinrend.js` (G08–G13, S15) in `run.js`.

**R15-10 Limits.** The halves are drawn by G.I.B.'s own piece renderer (`gore.gibs`: the body's colour from the look, its round edge, the raw cut) — the
same look as a NEW RUN's pieces, not a new effects engine; at the camera's height they read as the two halves of the round body, not as an
anatomical cross-section. The admin's D preview places the creature as the other previews do and does not apply the room rule (a
natural D does): beside a wall the physics keeps the halves, the hands, the light and the hat out of it (G11). A page older than R15 drops
the halves of such a record and draws a whole corpse. Browser numbers are SwiftShader's.

**R15-11 What the suites say.** `s_skinrend` 7/7 (new); every other Skin-Stealer suite passes (`s_skinstealer` 34/34 with SK33 adapted,
`s_skinpredator` 30/30 with PR25 adapted, `s_skinbody` 11/11 and the rest as at R14); Human QA hotfix 5/6 (X03 inherited); `npm test`
290/303 with the same 13 inherited failures (the 7 more are `s_skinrend`'s). `parts`, `modules`, `facts`, `window_contract`, the docs
(`CONTRACTS.md`'s `window.__gore` row regenerated: `assets/skinstealer.js` now reads it), the scope gate and `build:check` pass. The
cost of the server's choice is two rays when a grab kills; the client draws the halves only while a Rend plays. The full gate, the shared
performance and an independent review are R16's.

## R16 — regression, adversarial QA, stress, review

**R16-1 The adversarial QA (pack `07`, X01–X10).** `s_skinadv.js` runs X01–X09 on the real server simulation; nothing sets a decision of
the creature, people are moved and turned as players would - abruptly and against what it expects. What a person can see is the test-only
oracle (`qa_sight.js`); where a check reads where a person really is, that is the test's own script.
- X01 the still watcher (a lit person standing, gazing down the hall, the creature 450 / 620 px off, hunger .55 / .8 / .95; 12 runs): it
  never moved in their sight on a covert way (0 px in all 12), a hungry one never stood in their light longer than 0.2 s doing nothing.
- X02 one glimpse, then the silent opposite fork; X04 the course changed while it is behind a wall; X06 the person crouches into the dark
  and stays still, here or 250 px on: in each, two worlds the same to its senses give the same creature - its place, plan, ways, bets and
  guesses - tick for tick until it senses a difference (what it sees of them, or a sound). The comparison also stops where the shared
  engine's level of detail differs (an entity more than 1900 px from every player thinks every .35 s instead of every .1 s,
  `ai.entity.js` `tierOf`, decided by distances): that changes WHEN it thinks, never what it knows; it is the shared engine's, the
  Hound's and the Smiler's too, and left as it is (PR25). X06: it never came within 60 px of the hidden person without having sensed them,
  and gave the hunt up (or found them by sensing) in time.
- X03 the person doubles back: the same until it senses the turn; then its belief is within 350 px of them (or it sees them) within 0.1 s.
- X05 two people in different corridors: the one it never saw is never named, its hunt never passes to them on footsteps, one switch at
  most. X07 the person turns round every four seconds to catch it crossing cover: 0 px of covert movement in their sight (8 runs).
- X08 every interception it began (16) is to a spot on its own floor its own route reaches, with time in hand (slack 0.02–0.35 s).
- X09 four of them (hungers .3 / .6 / .8 / .95) and three people whose input changes every 1.5 s: no NaN, never in a wall, never over its
  speed, every kill after its wind-up (the strike's own clock), plans begun at most 0.35 / s by any one of them, memory bounded (sounds 8,
  mind events 24 at most), the cap of four kept.
- On R8 the same suite (`evidence/r16/tests/s_skinadv_on_r8.txt`): X01 and X07 fail as the owner reported (259–611 px of a covert move in
  the person's sight); X05, X06, X08, X09 cannot run there (R8 has no mind, no interception slack); X02–X04 pass on R8 too.
- X10 on real pages (`r9_browser.js --scene rend --stress 1`, `evidence/r16/browser/`): the spectator's page slowed four times (CPU) with
  200 ms added to its network (1.4–2.2 frames a second under SwiftShader), and a page that enters while the Rend plays (0.7 s and 0.97 s
  in), once with the victim's page closed half a second in: every page drew the two halves and never the whole body after them, never
  more than one Skin-Stealer, and holds the same corpse; the joiner's replay picked the death up where it was.

**R16-2 Found: the tear's sound on a slow page.** At under two frames a second the spectator's first frame after the tear came more than a
second after it, and R15's rule (a frame within a second of the tear) let it pass in silence. The sound now plays on the first frame that
finds the body rent if this page was watching the death before the tear, however slowly its frames come; a page that arrives later hears
it only within a second of the tear (`skin.kill.js`). X10 then heard it once on every page that watched.

**R16-3 What the extra performance counts are.** `perf_pr.js` times the 60 Hz step; `perf_r16.js` adds what the pack asks for besides: the
Skin-Stealer's own think time, its route searches (and those over 1 ms) and lines of sight per second, garbage collections and their
pauses, the heap's growth, the entity part of the snapshot. (There are no retransmissions in the sim to count: the wire is a WebSocket
over TCP.) The numbers are R16's final measurement, with the independent review's fixes in.

**R16-4 The independent review** (a separate agent given the code from R8 to R15 and the pack, not this record; read-only, its own copy
for running anything; `evidence/r16/review/REVIEW_FINDINGS.md`). Its findings, most severe first, and what was done:
1. **The Rend's victim saw a whole body on their own screen** (high): the victim's own corpse is made from `dphys.remains()` (the bundle's
   `completeDeath`), which named the halves only inside `.gibs`, so `gore.js` drew it whole; everyone else (the server's record) saw two
   halves. Fixed in the shared physics, for a rend only: `remains()` also names `gs`, `gb`, `gh` at the top (every other death's remains
   unchanged - G12). New G14; the real-page Rend scene now also reads the corpse the victim's page itself draws (`__api.bodyList()`).
2. **Other people's lights** (medium): the warning and the creature's model of who can see it counted only that person's own light and the
   lamps, while the screen draws every wanderer's torch. The page's warning now also counts another wanderer's light on the creature
   (BR-RoLE's `__light.sample` peers, through exposureAt's own range fade and scale); the creature's model of a watcher's view counts the
   torches of the people it sees now (`skWatchers` gives them to each view; never the light of anybody it does not see); the QA oracle
   counts every other living player's light. New F01. Not done: the camcorder's night vision and infrared stay outside the creature's
   model by Part 2C's design (the AI is structurally blind to IR) - a camcorder user may make it out where it believes itself unseen
   (`DEFERRED.md`).
3. **A failed search for an ambush point was not remembered** (medium-low, cost): at hunger .4-.6 the covert search could run on most
   thinks (26 searches in 10 s in one scene). It is remembered as a failed flank is (`SK.noFlank`, 10 s or until they move 200 px); the
   nested flank search remembers too. New F03 (at most 1 search in 10 s across 48 scenes).
4. **Tests** (medium): PR17 kept "at least 5" when R13 went from 8 seeds to 12 - now 7 of 12 (R8's share); C14 counted a kept plan as an
   answer - the answers that changed its plan are now held to the same latency bars on their own (13 of 26, median 0.12 s); G08's name said
   "never two in a row", which the recent-kills rule does not promise - it now says what it does (a second D in a row is made rarer, x .35);
   S15 needed git history - it falls back to the blob recorded at R15; P01's bar was 140 shapes (the measured figure is 55-56) - now 70. PR07,
   SK21, SK41 (changed at R13 with their reasons) and R9-01's 48 px tolerance are as they were; their reasons are in `REGRESSION.md`.
5. **Low**: a Hound/Smiler sting just after a Skin-Stealer's played twice - now one (new V13; with no Skin-Stealer every output is R8's,
   V12); at a few frames a second one frame's glimpse confirmed a sighting - a sighting now needs two frames as well as 0.12 s (new F04);
   a waiting spot was hidden at its centre and 18 px - the still body as drawn reaches 18-30 px out (R14-4), so a waiting spot now hides
   its centre and 30 px either side (`skBodyInSight`, `skSpotExposed`; moving, the body is audited as before; new F02); an open
   interception ran with the hidden run's act - it now runs with the open run's (chase), from its first tick (pack 03: the act marks an
   open commitment; new F05); the light's kind of somebody seen a moment ago was read live - it is now kept from when it saw them.
   Not changed: an older cached page draws a Rend's corpse whole (graceful, R15-4).

**R16-5 Tests changed in R16, and why** (`REGRESSION.md`): R9-01's exposure measure (and the same measure in `s_skinadv.js`) allows the
braking of a withdrawal begun while moving their way: within its first 0.3 s, up to 10 px closer in all (its acceleration, 760 px/s², stops
its 90 px/s pace in about 5 px; the sample that holds the switch also holds the last of the move before it). The invariant - never a covert
way in their sight but a withdrawal straight out of it - is unchanged, and so is the bearing test. The independent reason: R16's waiting
spots changed one run's sequence so that it was seen mid-search and backed out (traced: -4.7 px in the sample of the switch, -0.3 px
braking, then away). On R8, R9-01 still fails (230-478 px of covert movement in sight) and so do X01 and X07. PR17, C14, G08's name, S15,
P01: R16-4.

**R16-6 The checks again, on R16b** (`evidence/r16/tests/r16b_*`, `evidence/r16/browser/`):
- Suites: every Skin-Stealer suite passes - `s_skinstealer` 34/34, `s_skinbehave` 19/19, `s_skinpredator` 30/30, `s_skinsight` 10/10,
  `s_skinmind` 15/15, `s_skinroute` 15/15, `s_skinr9` 1/1, `s_skinbody` 11/11, `s_skinrend` 8/8, `s_skinadv` 9/9, `s_skinr16` 5/5.
  `npm test` 306/319 with the same 13 inherited failures; Human QA hotfix 5/6 (X03 inherited); the static checks, the docs, the scope
  gate and `build:check` pass.
- Real pages:
  - sight-only warning (`--scene sight`): 12/12;
  - the owner's watched hall (`--scene flankwatch`, four tries): every covert transit 0 px in the page's view;
  - the Rend (`--scene rend`): the victim's own drawn corpse is the server's two halves; the page joining while the Rend plays, and the
    stressed spectator (X10), still pass;
  - the deaths A-D side by side;
  - `predator_browser.js` 7/7.
- `skin_browser.js` (Trial 3's own tool, not run at R10-R15) found two of its own pins out of date:
  - the script's API (R10 added `sight` / `sightLog`, R14 `anatomy`);
  - the SKIN tab's preview buttons (R15 added D, as pack `06` asks).

  Both pins are updated (`REGRESSION.md`). With them its sections t1-t6 pass, t4 on its second try: one run's admin unlock was blocked by
  the game's own "caught" overlay, a Hound catching the page during its setup. Its t7 (four real pages at once, one a phone) did not
  finish here: three pages render, the fourth never boots within 100 minutes on two CPUs with SwiftShader. The tool writes nothing until
  it ends, so that run's t1-t6 results were lost and were run again on their own. R8's t7 does not finish here either
  (`skin_browser_r8_t7.txt`: the same wait for the fourth page, 25 minutes): an environment limit, not a regression.
- The performance comparison against R8 and the full gate are run on the final R16 tree, after the owner's additional refinement
  (R16c on).

## R16d — plan interruption and preemption, hunger-dependent aggression (the owner's October 22 refinement, §1 and §2)

**R16d-1 The policy** (`src/frameworks/nani/server/ai.skin.preempt.js`, read on every think - 10 Hz near - whatever its route's progress).
The owner: a Skin-Stealer that newly sees a viable player must not walk on along an unrelated route; it must reassess at once, without
dropping a tactic that still makes sense and without replanning on every flicker. `AP_AUDIT.md` found the causes: a person it had left
was invisible to its hunting for 30-60 s whatever its hunger (E), and a departure went on past new prey (F).
- **Classes.**
  - Committed: its wind-up, leap and recovery, a capture, a kill playing. Never cut - they are physics and fairness. (They also return
    before the decision runs: P04.)
  - Low priority: roaming and a roam's pause, a departure, a search or a listen about a sound nobody was named for. Cut by any
    significant event.
  - Tactical: approach, flank, intercept, lure, ambush, chase, retreat, watch, a hunt's search or listen, a walk in a skin. Kept while the
    decision's own weighing (with its hysteresis, `SK.rethink`) says they still make sense; given up when they no longer do.
  - A departure with a reason sight does not change - a fast one after a missed defence, one after a lost race, one while exhausted -
    is kept, and the log says so.
- **Events.** A viable person newly seen: first seen, or seen again after `SKP.regain` (1.2 s) out of sight. Viable means one it may hunt
  now (`skMayHunt`, R16d-2). And the quarry of a lure or an ambush seen going away from it (over 60 px/s, as it perceives them) for
  `SKP.awayFor` (1.5 s) of watching: only the time it watched them counts, not a spell out of its sight.
- **Answers.** A low-priority plan is ended on the think the event is perceived, its route, pause and any look cleared, and the decision
  runs on that same think. A tactical plan is flagged: the decision weighs the newcomer (it always weighs the nearest person it may hunt),
  and a lure or ambush keep rule no longer holds once the wait has lost its point.
- **No loops.** Each person forces at most one reassessment every `SKP.again` (0.6 s); a person flickering at the edge of its view is not
  new again until 1.2 s out of sight. Nothing in the policy touches its memory, its hunt or its beliefs - only which plan runs.
- **Evidence.** Every interruption is logged: `e.dbg.preempt` (when, the plan it cut or kept, its class, why - "P2 seen: its roaming gives
  way", "P2 is going away from its ambush: the wait has lost its point", "P2 seen: its departure goes on (its defence missed)") and its
  mind's events (`preempt`). The decision's own record now carries its time (`e.dbg.decide.at`).

**R16d-2 Hunger** (the owner's §2: aggression that rises with hunger, never by impossible senses, speed, reach or stamina).

| Hunger | Leaves a person it gave up on | May take them up again on fresh sight | Roaming | Pause at a roam goal (R8: 1.5-5 s) | Gives chase from |
|---|---|---|---|---|---|
| under .4 (fed) | 30-60 s (R8) | never (R8) | the dark (R8) | R8's under .3; x (1 - .8 hm) from .3 | no chase (R8) |
| .4-.6 | 15 s | after 10 s | where it last perceived prey, else the dark | x (1 - .8 hm) | no chase (R8: from .6) |
| .6-.8 | 8 s | after 6 s | the same | x 0.2 | 420 px x (1 + .4 hs) |
| .8 and over | 4 s (R8: 12 s) | after 3 s | the same, up to 1.4 x its roam pace (147 px/s at most, under `SK.runFrom` 200: no stamina, never a run; a player walks at 172) | x 0.2 | up to 588 px |

(hm and hs are R1's smooth hunger measures: hm 0 below .3 to 1 from .6; hs 0 below .55 to 1 from .95.)
- Taking a person up again needs sight of them - never hunger alone - and effort left for them (`skMayHunt`: under 85 % of its budget).
  Each new encounter spends that budget, so leave-and-return cannot cycle for long.
- Prowling (`skPatrolGoal`) reads only its own memory: the last place it saw somebody it may hunt, or the place it heard them, or a sound
  it holds, within `SK.patrolFresh` (90 s), not a place it has already prowled to; never anybody it has left or sees now (the decision
  answers those). Never a person's real place (P07, P08).
- What hunger does not change: its run speed (0.89 x a fresh sprint), its reach, its wind-ups, its stamina, its senses. A fresh runner
  still wins the straight race, rested and starving alike (C26).

**R16d-3 A watch keeps through a glimpse lost for a moment.** P09 (a person flickering in and out of its sight) found a watch that ended
the moment the person left its view for a tick: it turned to an interception ("lost P101: it guesses their way"), was back to a watch on
the next tick, and so on - three flips within a second. R8 shows the same pattern with a search. R4's `SK.lostGrace` (0.6 s: a glimpse
lost for a moment is not yet lost) already held an approach and a chase; it now holds a watch too. After it: no flips in 9 runs.

**R16d-4 Measured** (`tools/repro_ap.js`, the same probes as `AP_AUDIT.md`; `evidence/r16d/repro_r16d.*` against
`evidence/r16c/repro_r16b.*`):

| Probe | R16b (R8 the same) | R16d |
|---|---|---|
| F. A departure under way, a new person crosses 420 px in front | below .6, 5 of 6 never reconsider; at .65, 2.3-3.7 s later | 9 of 9 reconsider on the think they are first seen. It may still choose to go (8 of 9 were leaving at the probe's end: the decision's own weighing, mild hunger) |
| E. Someone it left, seen again (the probe's own scene: the creature roams off, so sight is brief) | never taken up (0 of 9) | taken up in 4 of 9, at 7.1-10.2 s; the others had them in sight for under its refractory |
| P01. The same, with the person kept in plain view 500 px ahead | - | fed: never (in sight 19.5 s); .45: at 10.0-10.1 s; .65 / .75: at 6.0-6.1 s; .95: at 3.0 s - each within 0.1 s of its refractory |
| G. Roaming, nobody about, a minute | standing 8.7-13.2 s, starving included | fed (.3): 10.7-11.1 s (as R8); .7: 2.9-3.7 s; .95: 3.0-4.7 s |
| P03. Roaming on a long route, a person appears ahead, in its periphery, or one it left 12 s before | (A: already at once on R8 for a person it may hunt) | weighed on the think it first sees them in 12 of 12, 0-22 px walked on |
| P05. A lure or an ambush whose quarry walks away in its sight | kept until its own time ran out | reassessed after 1.4-1.5 s of watching them go; kept, and sprung, when they came toward it |

B (heard, not seen), A at 85 degrees (its periphery), C (circled) and V (its range) are unchanged: they are R16e's and R16f's.

**R16d-5 Tests and checks** (`evidence/r16d/`):
- `s_skinap.js` (new, in `run.js`): P01-P09 pass. P04: a strike begun is carried through unchanged with a second person walking into view
  during its wind-up (6 runs, 3 kills and 3 misses with their recovery; 0 cuts while it lasted). P06: the policy on its own records -
  flickering every other think, 1 reassessment in 10 s; back after 1.3 s out of sight, one per reappearance, never two within 0.6 s.
  P08: two worlds differing only in where an unsensed person crouches are the same to it, tick for tick, for 40 s of hungry prowling
  (6 runs). P09: no plan flips back and forth within a second in 9 runs of a person flickering in and out of its sight.
- Every other Skin-Stealer suite passes unchanged: `s_skinstealer` 34/34, `s_skinbehave` 19/19, `s_skinpredator` 30/30 (C26: the fair race
  in `s_skinroute` 15/15), `s_skinsight` 10/10, `s_skinmind` 15/15, `s_skinr9` 1/1, `s_skinbody` 11/11, `s_skinrend` 8/8, `s_skinadv` 9/9,
  `s_skinr16` 5/5. No existing test was changed.
- `npm test`: 315/328 - the 9 new P tests pass and the same 13 inherited failures as R10's record (`evidence/r16d/r16d_fails.txt`); Human
  QA hotfix 5/6 (X03 inherited); the static checks, the docs, the scope gate (R16d's reason declared on `ai.js`) and `build:check` pass.
- What R16d leaves to R16e-R16g: the head does not yet snap to a sound or to movement at its edge under a plan, its periphery is still
  blind (A at 85 degrees), it goes to a sound rather than to where it could see (B), it cannot step sideways or back (C), and its range is
  R8's (V).
