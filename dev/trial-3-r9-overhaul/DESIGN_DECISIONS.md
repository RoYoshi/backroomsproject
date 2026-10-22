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
