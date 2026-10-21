# Trial 3 cognitive predator refinement — checkpoints

Branch `trial-3-cognitive-predator-refinement`, created from R8 `f378049a825e53eafc626a637b8c43397e4072f0` (tree
`a6d72690727a58dbab6e770dfda64a1d9dbf70f3`) — the predator refinement the owner rejected in Human QA. Nothing here is owner-approved.
Pushed only fast-forward, never forced. After each push `tools/verify_remote_cp.py` reads the branch back from GitHub (SHA, tree,
parent, one straight line from `f378049`, every protected ref — R8 now among them — and every other branch unchanged) into
`evidence/remote/`; the secret scan runs before and after each push (`evidence/scans/`). A commit cannot name its own hash: each row is
filled in by the next checkpoint.

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| C0 diagnosis, no game change | `cc8c8f2ba5a2473e496fca2259d0d85a93edeeb3` | `f9f46d96797dd2e954d8a45d0faf9f4359a2bfaf` | `f378049` | read back from GitHub (`evidence/remote/c0.json`: ok); scans before and after clean |
| C1 what changed, interrupts, reaction | `54b59846d0c884a766cc5504ef4b5a9e352971d8` | `eb397a1d6c4129492c6e1fd09c880e8df05f4d01` | `cc8c8f2` | read back from GitHub (`evidence/remote/c1.json`: ok); scans before and after clean |
| C2 the choice: stand-off, whom, the bait as an ambush | `892d9934f43bb16e048abf45159b6115fe4fae26` | `420d6d94e1f77cc9395fc612b5804e939aa59d49` | `54b5984` | read back from GitHub (`evidence/remote/c2.json`: ok); scans before and after clean |
| C3 what it learns from what it sees; the lost race | `caed6cdd10007bdf538a2e41675d0424b5b092a4` | `96974c49cb966510e995cf5d7ff6666310e58470` | `892d993` | read back from GitHub (`evidence/remote/c3.json`: ok); scans before and after clean |
| C4 the hunger gradient | `93fe6caf271e3b4a238f86216cafcbac5e73e5dc` | `e4676d8b2feb63a15a1e5623b7b7b093fae7165d` | `caed6cd` | read back from GitHub (`evidence/remote/c4.json`: ok); scans before and after clean |
| C5 multiplayer, fairness, regression | `776e85368237ccb424c9a5b7df377442647b9b40` | `4e4eae1f7fc8b62a00978f4eff3521914b0dee79` | `93fe6ca` | read back from GitHub (`evidence/remote/c5.json`: ok); scans before and after clean |
| C6a real pages, R8 against this build | `5f8bdfef9d942d9d06391a8ca00ddf44584b95e3` | `6076701fd6a6b09375969fcabbdf2f6d60e86911` | `776e853` | read back from GitHub (`evidence/remote/c6a.json`: ok); scans before and after clean |
| C6b performance, the gate, the earlier browser checks | `d708f426e4f1d1224596693a6d8b57bf07b24f9f` | `8d4843b37ea3a80a364c0d6fc9c546c05d7228df` | `5f8bdfe` | read back from GitHub (`evidence/remote/c6b.json`: ok); scans before and after clean |
| C7a the independent review and its fixes | `91de3eb153807c66f6a2bf3e71876669e7f4f346` | `64afa401f5c9b899981912fd4194c2dd711cdb19` | `d708f42` | read back from GitHub (`evidence/remote/c7a.json`: ok); scans before and after clean |
| C7b the fixed build, re-run in full | (this commit: `evidence/remote/c7b.json` arrives with C8) | | `91de3eb` | |

## C0 — diagnosis first (no game change)

Changed: only `dev/trial-3-cognitive-predator/` — `AUDIT.md`, `OWNER_FAILURE_REPRO.md`, this file, `tools/c0_audit.js` (R8's
simulation through the owner's situations, latency and choice measured), `tools/cog_browser.js` (the same in real pages),
`tools/verify_remote_cp.py`, `inventory/remote_heads_before.json`, `evidence/`. The runtime is R8's.

| Run | Result |
|---|---|
| `tools/c0_audit.js` on R8 (`evidence/c0_audit_r8.*`; 12 scenes, 6 seeds) | watched at .45–.55: 0 kills, no purposeful movement in 12 of 18 runs (retreat → 9–10 s blind lure → leave); a cliff to 6 / 6 kills at .8; two people → leave in 0.02–0.42 s; a lost race → 12.7–12.9 s trailing; a close circler faced after 2.2 s (p50). First decisions themselves are fast (0 s), see `AUDIT.md` |
| `tools/cog_browser.js` on R8 (`evidence/c0_browser_r8.*`, `c0_shots/`; three scenes × 2 real-page tries, admin spawn hunger .50–.65) | the watching page never struck in the 4 valid tries (one try took the unaware walker); circle #2 left 83 % of the time; 2 tries were setup misses (the creature never saw the page), kept and labelled |
| R8's decision scores at the quoted moments | `OWNER_FAILURE_REPRO.md` (BD1 retreat 1.29 / leave 1.04 / approach .08; BD2 leave 1.09 at 210 px after a flank) |

**Seven reproducible bad decisions** (`OWNER_FAILURE_REPRO.md`, with seeds) and four honest controls. The architecture for C1–C4 is in
`AUDIT.md` (perception events, interrupts, a small tactical choice for a seen quarry, commitment unchanged; species file only).

## C1 — what changed, what interrupts a plan, how fast it reacts

Changed: `src/frameworks/nani/server/ai.skinstealer.js` only in the game (built into `generated/server/ai.js`; the manifest), its
declared-change note (`dev/tools/gate/declared_changes.json`), the new suite `dev/tests/s_skincognitive.js` (added to `dev/tests/run.js`'s
list), `BALANCE_TABLE.md` (every C1 value, UNAPPROVED), and `tools/cog_browser.js` (the watcher put in front of it on lamp-lit floor first;
when it first saw each page recorded, and a try in which it saw none labelled a setup miss). Hounds, Smilers, the engine, sensors, movement,
the wire and OVERSEER: untouched.

What it does now (all values in `BALANCE_TABLE.md`):
* **A hungry bait is a short wait, not a blind one.** From .4 hunger the wait round a corner is 2.5–4.5 s (R8: 9–10 s), then it looks
  again; heard going away, the wait ends at once and the hunt goes on; at its end a hunt with confidence goes on (R8: only very hungry).
* **A departure is thought over** from .45 hunger (R8 .6), after 3–1.2 s, twice a second — below .6 only for somebody it sees not watching it.
* **An opening is used**: a watcher who looks away for longer than its beat (.35–.12 s by hunger) is acted on past the rethink
  hysteresis; **a twitch is not an opening** — a look away shorter than the beat changes no plan (R8 flipped plans on a 0.1 s glance).
* **Listening ends on the sound it waits for** (no sooner than 0.3 s in: in C04 0.35 s, at the next footstep; R8 listened its full
  1.3–1.9 s), and a close sound is turned to at 3.6 rad/s.
* **Its eyes stay on what it freezes for** (head, then body), and **somebody in sight is re-aimed at on every think** by a straight line,
  a little ahead of their seen motion (none on a lost race's trail); R8 ran on to where they had been for up to 1.5 s.
* A bounded QA record of what changed and what it did (`e.cog`), never sent to players, never read by a decision.

| Run | Result |
|---|---|
| `s_skincognitive.js` on R8 (`evidence/c1_before_r8.txt`) | **C01 FAIL** (faced 0.83 s p50, worst 1.3 s), **C04 FAIL** (lures 11.7 s; listens to the end of their time; 3 flickers on twitches) |
| species suites `s_skinstealer` + `s_skinbehave` + `s_skinpredator` + `s_skincognitive` (`evidence/c1_suites.txt`) | **85 / 85 PASS** (R8's 83 + C01, C04). C01: faced 0.07 s p50, worst 0.1 s; the unsensed person in the dark behind it, in two places: the same creature tick for tick, never sensed (4 / 4). C04: 12 lures, longest 4.2 s, none followed by a departure while its hunt lived; 4 / 4 listens ended 0.35 s in; twitches: 0 choices, 0 flickers |
| `tools/c0_audit.js` on C1 (`evidence/c1_audit.*`, the same 12 scenes and seeds as R8's) | watched at .45 / .5 / .55: **it moves with purpose in every run** (R8: never in 5 / 4 / 3 of 6) — but still **0 kills at .45–.65** (it backs off, waits 2.5–4.5 s, looks round the corner, backs off again: the choice itself is C2's). A circler 170 px off faced in **0.17 s p50, 0.32 s worst** (R8 2.18 / 3.5 s), killed 6 / 6. A crossing runner faced in 0.03 s (R8 0.47). **Worse:** the crossing runner at .5 is killed 1 / 6 (R8 3 / 6) and the pillar circler at .55 5 / 6 (R8 6 / 6) — closing faster, it meets R8's rule that a runner is left below .6 hunger (chase only from .6) sooner; that rule is C2's |
| static checks (`evidence/c1_checks.txt`) | build check, parts, modules, facts, window contract, docs, API contract, scope: all PASS |
| `tools/cog_browser.js` on C1 (`evidence/c1_browser.*`, `c1_shots/` at 1 and 16 s; admin spawn hunger .47–.64) | **no setup misses** now (it saw the page in all 6 tries, 0.9–2.1 s in). watched #1 (.48): approach, retreat, lure 3.9 s, listen, search, flank, approach, leave — no strike, closest 140 px; watched #2: it took the page at 17.5 s. crowd #1 / #2 (.64 / .59): **leave** at once, 59 / 93 % of the time ("more than one of them"); circle #1 / #2 (.47 / .51): **leave** after 0.8–5 s, 61 / 83 % (a runner below .6 is left). The decisions the owner rejected are still there: C1 changed how fast it notices and acts, not what it chooses |

**Honest summary of C1:** reaction is fixed where it was slow (frozen eyes, aiming, listening, twitches, blind waits) and every C1 test fails on
R8 and passes here; the choices — backing off when watched at .45–.65, leaving a group, leaving a runner below .6 — are unchanged and
C2's work. One measured regression, explained above (X at .5, C at .55), is expected to be undone by C2's rule change and is re-measured there.

## C2 — the choice: a stand-off with a purpose, whom to go for, a bait that is an ambush

Changed: the species file only in the game (every value in `BALANCE_TABLE.md` C2, UNAPPROVED), its declared-change note, five new
scenarios (`s_skincognitive.js` C02, C03, C08, C09, C13), four R8-era scenarios adapted (below, each with its reason in the file), and
`tools/cog_browser.js` (a watcher it has not seen after 3 s walks toward it, as a player would - C0 / C1 setup misses).

What it does now:
* **Watched, hungry: a stand-off with a purpose** instead of R8's retreat → blind wait → departure. It holds its ground or steps into the
  dark at the edge of the light, keeping them in view; the moment nobody it sees is looking at it (for a beat) it closes in; their eyes back,
  it freezes; very hungry, it creeps in under their eyes too. A stand-off that gained ground goes on from closer; one that gained nothing
  gives way to going round them, the bait or coming on - or, hungry and alone with them, to another stand-off from another dark spot.
* **"Seen in the light" and company are reasons for care, not departure** from hungry up; **people together are never come at** (a lone
  ambusher, judged by who it has seen with them in the last 4 s, so one who steps behind a pillar does not make the other "alone"); it
  watches a group from the dark, then leaves; one apart from the others may be taken.
* **Whom**: the better chance it sees (not watching it, apart, near), kept unless another is 1.5 × better — R8 took the nearest.
* **A hungry one may give chase** (R8 only from .6): the same short gamble, the same lost race.
* **The bait is an ambush or nothing**: a spot somebody following first sees from within its reach (200 px), or its next answer at once
  (that place remembered for 10 s); it waits on the spot itself.

R8-era scenarios adapted (the protective intent kept or strengthened; nothing weakened):
* **SK17** (two people → it leaves): the scene runs 25 s instead of 15 (it now watches a pair from the dark first); the assertion now also
  requires that it **never** comes at them (no approach, chase, flank, spring or kill) — 6 / 6.
* **SK21, SK41** (the bait; its lines from hiding): the scene moved from the south-west gap to the lit hall — the gap has no spot that gives an
  ambush near where it is seen (C08), so it no longer baits there; the hall's corner into the side room does. SK41's "lay in wait" is a wait
  lasting past the moment it calls out (C1's interrupts end some waits in a tenth of a second). Every T3 rule asserted as before
  (hidden, still, the wait ends, the follower comes round within 43–49 px; lines only from hiding, gaps, at most 3).
* **PR29** (a departure kept keeps its cooldown): waits up to 25 s for the departure from a pair (the stand-off first); a departure that
  reaches its goal and roams on with the person still left counts as kept. 6 / 6.
* Random draws: the stand-off reuses the watch's draw, so every other random choice is R8's — PR08's and PR19's seeds behave as before.

| Run | Result |
|---|---|
| `s_skincognitive.js` on R8 (`evidence/c2_before_r8.txt`) | C01, C04, **C02, C08, C13 FAIL**; C03 and C09 pass on R8 too — they guard what R8 already did right (very hungry, it tries more than one answer and never stalls; its route searches are bounded) and C2 must not break it |
| species suites (`evidence/c2_suites.txt`) | **90 / 90 PASS** (83 R8-era, four adapted as above; C01–C04, C08, C09, C13). C02: watched by somebody who looks away now and then, at .5 / .55 / .62 it closes in **208 px (p50) in each look away, moving within 0.8 s 13 / 13, stopping within 0.4 s when their eyes come back 8 / 8**, never just backing off or leaving; a watcher who never looks away: **0 / 12 killed**. C13: the unaware one apart taken in 15 / 18 (R8 3 / 18), at most 1 switch, no effort lost, the one only heard never named |
| `tools/c0_audit.js` (`evidence/c2_audit.*`; kills R8 / C1 / C2 per 6 runs) | watched .45 0/0/0, **.5 0/0/1, .55 0/0/1, .65 0/0/6**, .8 and .95 6/6/6; crossing runner .5 3/1/3, .65 2/4/4; **pillar circler .55 6/5/3** (a chase on a circler is judged a lost race below .6 → a departure: C3's work); watcher + walker **.55 2/2/5**, .7 1/1/1, **.9 4/4/6**; passer-by, fork, circles round it, the straight race (0: the fresh runner wins), the lure with nothing heard (0): unchanged |
| static checks (`evidence/c2_checks.txt`) | all PASS |
| `tools/cog_browser.js` (`evidence/c2_browser.*`, `c2_shots/`; admin spawn hunger .45–.62) | **no setup misses**. watched #1 (.45): a stand-off 86 % of the time, closest 272 px, no strike (the page never looked away); watched #2 (.61): stand-off and short advances, closest 172 px; crowd #1: it took the watcher at 15.1 s (the walker never came into its view); crowd #2: watched the pair, then left; **circle #1 / #2 (.59 / .62): the circling page was killed at 16.7 / 16.3 s** (C1: left 61 / 83 % of the time) |

**Honest summary of C2:** the owner's watched, crowd and circle scenes now end in pressure and, when earned, a kill; a watcher who keeps it
in sight still survives below .6. Open: the pillar circler at .55 in the simulation (3 / 6, R8 6 / 6) and the lost race (12.8 s
trailing, unchanged) are C3's.

## C3 — what it learns from what it sees them do; the lost race

Changed: the species file only in the game (`BALANCE_TABLE.md` C3, UNAPPROVED), its declared-change note, three new scenarios (C05, C06,
C10), one R8-era scenario adapted (PR20, below).

What it does now:
* **It keeps what it saw its quarry do** (their places, while it sees them, 10 s; nothing filled in behind a wall). **Somebody it has seen
  go a full turn round something** (arcs it actually saw; a fitted circle 90–420 px) **is going round, not running from it** - and it
  **cuts across** to a point ahead of them that it can reach first by a straight run, and waits there crouched. **Seeing them go the
  other way undoes the guess at once** (it starts learning again); laps it did not see teach it nothing.
* **The lost race, very hungry: a choice at once** - a way round that gets it ahead of them (R8's own route prediction; only when it really
  arrives first), else **3 s on their trail** (R8: 12.7–12.9 s), then it stops and watches where they go while it can see them, listens,
  and takes its hunt's guesses; its step stands while they keep running (no fresh approach on their heels). PR27's law kept: the gap they
  won never shrinks while they move.
* **A runner it will not chase** (below .6, or out of its chase range), before any lost race: a stand-off that keeps them in view rather
  than a departure - they may be going round.

R8-era scenario adapted: **PR20** ("a runner who escapes and later stops in its view is hunted again"): it no longer trails the runner to
the hall's end, so in 2 of 6 runs the runner who stops 1400 px on is beyond its sight when they stop; the law is judged where the evidence
came - in every run in which it saw them again it hunted them again (4 / 4, at least four required); the out-of-sight, silent half is
unchanged (8 / 8 let go). Its trade-off is in the owner's hands: a short trail loses some runners who stop far off.

| Run | Result |
|---|---|
| `s_skincognitive.js` C05 / C06 / C10 on R8 (`evidence/c3_before_r8.txt`) | **C06 FAIL** (no cut-off: R8 never took them for going round), **C10 FAIL** (on their trail 11.1–13.3 s); C05 passes on R8 too - R8 already guessed a way on at once; it guards that |
| species suites (`evidence/c3_suites.txt`) | **93 / 93 PASS**. C06: it took them for going round in 9 of 12 runs (the rest met before a full turn), cut across in 9 / 9, they came to its cut-off (150 px) 9 / 9, met 12 / 12; first guessed only after 6.5–9.8 rad of arcs seen (never under a turn); turning back as it cut across: it thought again on seeing it 8 / 8, fooled 1 / 8 on the small pillar; unseen laps: nothing learned. C10: a fresh runner never caught while running 12 / 12, the gap never shrinking; 3 s on their trail in all 12 (R8 11–13 s). C05: the same until its senses differed 8 / 8, a guess ahead 0.58–2.1 s after it lost them |
| `tools/c0_audit.js` (`evidence/c3_audit.*`; kills R8 / C2 / C3) | **pillar circler at .55: 6 / 3 / 6**; the straight race: still 0 kills, **trailing 3 s** (R8 12.7–12.9 s); every other scene as at C2 |
| static checks (`evidence/c3_checks.txt`) | all PASS |
| `tools/cog_browser.js` (`evidence/c3_browser.*`, `c3_shots/`; and `c3_circle.*`, three more circle tries after the cut-off was weighted above a held stand-off) | watched #1 (.49): a stand-off 85 %, closest 232 px, no strike; watched #2 (.50): it took the page at 9.6 s; crowd #1: it took the walker (apart, unaware) at 6.6 s; crowd #2: a setup miss (labelled); circle: killed at 17.6 / 17.9 s (first run) and 16.8 / 19.5 s (`c3_circle`; one cut-off at 18.6 s), one left after 17.5 s. In real pages the circling page is often taken for watching it (its facing follows the mouse, not its running), which holds the hungry creature in a stand-off: C6 gives the page a natural gaze |

## C4 — the hunger gradient

Changed: the species file only in the game (`BALANCE_TABLE.md` C4, UNAPPROVED), its declared-change note, a new scenario (C12), C02 judged
on the runs in which it took its chance (below).

What it does now: from .4 to .55 hunger it goes for somebody it sees only sometimes (.4 at .4, about .7 at .47, always from .55) - drawn once
per encounter from its own random stream, so nothing else it chooses moves; passed over, a mildly hungry one watches them a while and goes.
A hunt already under way is always taken up. Satiated and mild never hunt or spring (unchanged rules); very hungry always goes for them;
starving is quicker about it. No pose or art change: the evidence never showed one was needed.

**C02 adapted (C2's own scenario):** at .5 the creature now takes its chance in most but not all encounters (C12's gradient); C02 is about
what it does when it does, so it now requires that it went for them in at least three runs in four and holds every such run to all its
criteria. On this build it went for them in 18 / 18, so nothing was excused.

| Run | Result |
|---|---|
| C02, C12 on R8 (`evidence/c4_before_r8.txt`) | **both FAIL** (R8 at .65 killed only .36 of the time in C12's scenes - the flip from passive to lethal came at .75–.8) |
| species suites (`evidence/c4_suites.txt`) | **94 / 94 PASS**. C12: went for them at .1 / .3 / .45 / .55 / .65 / .75 / .85 / .95 = 0 / 0 / .71 / 1 / 1 / 1 / 1 / 1, killed 0 / 0 / .64 / .93 / .93 / .93 / 1 / 1; satiated and mild looked at them 100 %, a mild one watched a while in 31 %; time to a kill 13–14 s very hungry, about 7 s starving |
| `tools/c0_audit.js` (`evidence/c4_audit.*`) | as at C3, except the passer-by at .45: 2 / 6 killed (C3 3 / 6) - it now passes some people over at .45 |
| static checks (`evidence/c4_checks.txt`) | all PASS |

## C5 — multiplayer, fairness and regression

Changed: **no game code** - the species file and the build are C4's, byte for byte. Seven new scenarios (C07, C11, C14, C15, C16, C17, C18)
and a second half of C10 ((b): no race, a sprinter's lead); two new tools (`tools/c6_browser.js` for C6's real pages, `tools/c5_sprint_diag.js`).
A guard was built, measured and **dropped** (`BALANCE_TABLE.md` C5): it widened R7's won-lead law to every way of following somebody who
sprinted off, but no scene showed the erosion it was meant to stop. The full runs made with it are kept (`evidence/c5_*_guard.*`: 248 / 261,
the same 13 inherited failures; P9 6 / 6).

What pack 08's C5 asks, and where it is shown on this build:
* **unseen paired worlds**: C01 (an unsensed person in two places: the same creature, tick for tick), C05 (two hidden routes: the same until its
  senses differ), R8's SK15;
* **anonymous sound decoys**: C07 - B's running drew it in 7 / 8, **B was never named before it saw them** (0 ticks), its hunt of the quiet A
  ended in silence (or turned to B once it saw them) 8 / 8;
* **two people in view**: C13 (C2) and C14 (four of them, eight people at once: sightings kept at most 71 of a bound of 102, its QA record at
  most 24, nothing in a wall, route searches 0.19 per creature per second, p95 0.75);
* **no cheated identity, nothing new on the wire**: C07, C16 (every snapshot entry R8's eight fields and R8's codes, through stand-offs, cut-offs
  and openings);
* **R7's effort and sprint laws**: C10 (a fresh runner wins: never caught while running 12 / 12, the gap never closing after the loss; (b) a
  lead made with no race kept 12 / 12), C17 (every stand-off ends within its effort budget; the effort spent never goes down), PR27;
* **fair strikes in the new tactics**: C11 - 15 springs from a stand-off, an approach and a cut-off, each with its whole wind-up, at somebody it
  saw, its stamina paid; 15 kills, each on contact; a step aside at the tell missed 4 / 4;
* **disguise and G.I.B.**: R8's SK34, SK35 and the disguise scenarios, unchanged and passing;
* **Hound and Smiler parity**: C15 (no game file but the species' differs from R8's; with no Skin-Stealer its tick never runs), PR25, and the
  six-seed P9 equivalence;
* **latency as a person feels it** (pack C18): C18, R8 against this build, below.

**Seen in C17, for the owner:** a watcher who never looks away and never moves is safe for C02's 30 s, but not for ever. Its hunger rises
(about .1 a minute): a creature spawned at .55 is past .6 after about 30 s, and from .6 the stand-off presses in under their eyes (a crouched
creep, a few px/s at first, `SK.pressFrom`), springing from about 170 px - with its whole wind-up, in their sight. In 120 s, 6 of the 12 such
watchers died: four at 69–71 s that way, two at 21 s after it went round them out of their sight (a flank) and came at them from there; the
rest were left within its budget. A step aside at the tell makes the spring miss (C11, 4 / 4). Whether standing and staring should stay safe longer is
the owner's call (`HUMAN_QA.md`).

| Run | Result |
|---|---|
| the C5 scenarios on R8 (`evidence/c5_before_r8.txt`) | **C10 FAIL** (13 s on their trail; its (b) passes on R8), **C18 FAIL** (faced a walker p50 0.87 s, p95 1.87 s; moved in on a turned back within 1 s in 4 / 12). C07 and C11 pass on R8 - they guard what R8 already did (anonymity, fair springs). C14, C16 and C17 fail on R8 only because R8 has none of the records and plans they measure (no stand-off, no cut-off, no QA record): no comparison |
| C18 on this build (`evidence/c5_suites.txt`) | faced a walker p50 0.05 / p95 0.1 / worst 0.1 s (R8 0.87 / 1.87 / 1.87); moved in on a back turned for 2.5 s within 1 s in 9 / 12, p50 0.87 s (R8 4 / 12); lost round a corner, its next step 0.58 s (R8 the same); **where faster is worse** - 0.15 s glances away, shorter than its beat: it dropped what it was doing on 2 of 68 (3 %; R8 3 of 69), so it waits. Moving off after a sighting: p50 1.4 s on both - it freezes while somebody walking at it faces it (R3's freeze, kept) |
| species suites, inside npm test (`evidence/c5_suites.txt`) | **101 / 101 PASS** (C4's 94, and C07, C11, C14, C15, C16, C17, C18) |
| `npm test` (`evidence/c5_npm_test.txt`, `c5_npm_compare.txt`) | 250 / 263; **13 failures, each on R8's inherited list by its whole name** (P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18 memory, L9, 2F F13, 2F F22); none new, none fixed. Older suites also have tests named C01-C08, C13, C15-C18: names are compared whole |
| `npm run test:humanqa` (`evidence/c5_humanqa.txt`) | 5 / 6, X03 inherited |
| P9 equivalence, six seeds × 120 s, no Skin-Stealer (`evidence/c5_equiv_p9.txt`) | **PASS** - 6 / 6 identical tick for tick (7200 snapshots) |
| `tools/c5_sprint_diag.js` (`evidence/c5_sprint_diag.txt`) | 40 sprint-away runs: no lead shrank on R8, here, or with the guard; here and with the guard the same creature tick for tick |
| static checks (`evidence/c5_checks.txt`) | all PASS |

## C6a — real pages, R8 against this build

Changed: no game code (the species file and the build are C4's). `tools/c6_browser.js` (the pack's four real-page scenes and a fresh
runner), `tools/c6_summary.py`.

**How:** one real server per build (R8's tree, `git archive f378049`, and this one), headless Chromium; every person is a real page moved by
its own keys and mouse (W A S D, Shift, C, F; the facing by the mouse), every key and aim logged with its time (`run.inputs`), each page's
place ten times a second, the creature from the admin debug the server sends (its plan, its reason) and the snapshot - read only to report.
The admin panel sets the scene (freeze, the Hounds and Smilers removed, one Skin-Stealer put near: its hunger is the admin spawn's own,
.45–.65, so each try is a different creature). Screenshots at 1, 10, 20 and 30 s (`evidence/c6_shots/`, JPEG). Three tries per scene and
build; a try in which it never saw a page is a **setup miss**, kept and not counted.

**Two earlier passes were faulty and are kept** (`evidence/c6_browser_v1*`, `c6_browser_v2*`; `c6_browser_summary.txt` lists every try):
in v1 the escaping page and A's way to the pillar steered straight at their goal and stuck on walls (an "escape" there was a page stuck
350 px from it); in v2 they followed the level's own routes, but the pillar's page still caught on the pillar. The final tool steers at a
point ahead on a clear 200 px ring and on the level's routes, moves on when a wall holds it up (logged as `skip`), and runs Chromium
without background timer throttling. Only the final pass is compared below; it ran R8 and this build with the same tool.

| Scene (pack) | R8 (valid tries) | This build (valid tries) |
|---|---|---|
| **B-C1** watched, the page turns its back at 8 s and 18 s for 2.5 s | 2 (1 setup miss): approach → retreat → approach → retreat → leave, closest 236 px; one approach head-on while watched → a kill at 14.2 s. In the first look-away R8 closed 474 → 439 and 436 → 306 px | **3 / 3: a stand-off, then it used the look-away** - closed 416 → 289, 275 → 38 (struck at 10.0 s, 2 s into it) and 201 → 156 px (struck 10.5 s); killed at 12.4 / 10.8 / 11.0 s, each spring with its whole wind-up |
| **B-C2** a glimpse at the fork, torch off, a crouched double-back | 2 (1 miss): intercept → listen → search → **leave** (fooled, the earned wrong guess); listen → search → a kill at 7.0 s | 2 (1 miss): watch → approach → listen → search on a footstep **heard** (walking, before the double-back) → found at 95 px → killed 7.2 s; one sprung on at 4.8 s from about 160 px, as the double-back began (it had come on at up to 200 px/s while the page walked north and turned its torch off). **No earned wrong guess in this pass**; *the earlier v2 pass had two (C7, F5)*; the simulation shows them (C05: a guess ahead on the way they went; the double-back is then the other way) |
| **B-C3** A seen, then hides crouched, torchless; B, unseen, runs a lane | 2 (1 miss): approach → **retreat → lure → leave** both times; A alive | **3 / 3 A killed** (12.1, 14.6, 10.0 s). B's running made it stop and listen in 2 (anonymous: B never named before it saw B, at 11.8 s in one), then it went back to A. In 2 of the 3 A's page was held up on its way to the pillar (8 and 2 skips; it moved 84 and 319 px) |
| **B-C4** circling the pillar, turning back, then running off | 3: approach / watch / approach / retreat → chase → a kill at 10.8 s; **a dither** - approach 5 times, watch 3, retreat 3 in 16 s - → lure → leave; watch → approach → leave at 5 s | **3 / 3 a cut-off** (at 13.0, 7.4, 11.1 s, after watching them go round; the page turned back as it cut across) → chase / a spring → killed at 16.5, 11.5, 23.0 s (the last after the page, running off, was held up by a wall). Its first springs missed (5.5, 8.3, 5.6 s): the circler got away by going round |
| **fresh runner**: seen, then sprints away down the hall (route away from it), hides round the far corner | 3: approach → leave within 4.7–8.2 s, every time; all alive | **never caught while running (3 / 3)**. It stood off, listened, searched the way they went: **one escape** (it gave up at 25.2 s); two hiders found round that corner, 31.4 and 35.6 s in, one on its way out after giving up |

**Earned kill:** e.g. B-C1 #2 - it waits in a stand-off 275 px off; the page turns its back at 8.0 s; it closes to 38 px and springs at 10.0 s
(its wind-up visible), the page dies at 10.8 s (`c6_shots/c6_lookaway_2_10s.jpg`). **Escape:** the fresh runner #2 - seen at 2.1 s, runs
from 409 px at 4.5 s, never closer than 335 px; it listens, searches the hall's west end, gives up at 25.2 s.

**What this pass says, and does not.** Against R8 the owner's complaint is visible in R8's own runs (retreat → lure → leave with a hungry
creature and a person in plain view; a dither at the pillar) and absent from this build's: it holds them in view, presses in when they look
away, cuts across a circle it has watched, and does not let a fresh runner's lead shrink. It is also **much deadlier**: 13 of 14 valid
tries ended in a kill (R8: 3 of 12) - *corrected at C7 (the review's F5); this said 12 of 14 and 3 of 11; and it rests on one pass:
the pooled count over every valid pass is in C7*. Every kill was a spring with its whole wind-up at somebody in its sight, after a look-away, a dodge
that failed, a found hider, or within reach - no page was caught on a straight run. Whether .45–.65 should be this dangerous is the owner's
call (`HUMAN_QA.md`). The scenes are scripted pages, not a person: a page does not dodge at the tell or choose where to hide.

## C6b — performance, the fast gate, the earlier browser checks

Changed: no game code. `DESIGN_DECISIONS.md` (drafted; final at C8). R8's tree for every comparison is `git archive f378049`.

| Run | Result |
|---|---|
| `perf_pr.js --base <R8> --rounds 3 --secs 60` (`evidence/c6_perf.*`) | **PASS** (0 violations). Medians R8 → this build: no Skin-Stealer 0.185 → 0.200 ms (+8 %, within the tolerance: the same code, i.e. the noise), one 0.217 → 0.212 ms (p99 2.35 → 1.95), four 0.327 → 0.310 (p99 3.64 → 3.81), four pressed 0.337 → 0.286 (p99 4.36 → 3.55), four starving 0.311 → 0.318 (p99 4.14 → 3.75). **Red runs** (p99 over the 4.175 ms sub-budget): R8 four (4.26, 4.36, 4.59, 4.20 - *the fourth added at C7, F10*), this build two - **round 2 four-starving 6.06 ms** (mean 0.429) and round 2 four 4.28 |
| the same matrix again, because of that red run (`evidence/c6_perf_run2.*`) | **PASS** (0 violations). Medians: none 0.178 → 0.180, one 0.193 → 0.196 (**p99 1.25 → 1.98, +59 %: judged against the 60 Hz budget only**, as the tool does for one; the runs 1.21 / 1.25 / 1.91 against 1.63 / 2.10 / 1.98 ms), four 0.290 → 0.242 (p99 3.46 → 1.98), four pressed 0.283 → 0.256 (p99 2.88 → 3.14), four starving 0.285 → 0.270 (p99 3.60 → 2.87). Red runs: none on either build (R8's highest p99 4.02, this build's 3.15) |
| `perf_pr.js --soak 600` (`evidence/c6_soak.*`) | **PASS**: 600 s, four starving, eight players wandering: mean 0.164 ms, p99 1.03, worst 14.8 ms; records at most 1 per creature, 0 violations |
| route searches (C14, `evidence/c5_suites.txt`) | four of them, eight people, 90 s: 0.19 per creature per second, p95 0.75, the busiest second 1.75; PR24 (R8's count) passes |
| the fast gate (`evidence/c6_gate.txt`) | **PASS, 21 / 21 steps** (build, port, lineage, parts, modules, contracts, docs, scope, the B++ goldens, session, sim, page, protocol, mutants, raw, quick suites, bundle, chat). The full tier not run: no shared scope (C15) |
| B1–B5's `behave_browser.js` (`evidence/c6_behave_browser.*`) | **9 / 9** |
| R8's `predator_browser.js`, this build (`evidence/c6_predator_browser.*`, `_run2.*`) and R8 (`_r8.*`) | this build **6 / 7 twice; `pr_listened_then_looked` not exercised** (by the tool's own rule): in the attempts where it reacted to the footsteps behind the wall the first plan the page recorded was `search` (it went to look) - its listen now ends at the next footstep (C1; C04 (b): within 0.25 s), shorter than the page's sampling; in the others it never reacted (where the spot fell). Heard not named, quiet never named, hunt on sight, the HUNT line, the snapshot's fields, no page error: pass. R8 7 / 7 |
| Trial 3's `skin_browser.js`, the whole tool (`evidence/c6_skin_browser_full_run*.txt`) | **crashed twice, at different places**: run 1 in t4 (the victim page's capture overlay was over the admin panel's unlock button - the page was held when the tool wanted to unlock), run 2 in t7 (no Skin-Stealer in the page's list when the tool read it after 45 s at double speed). Kept as they ran |
| the same tool section by section (`evidence/c6_skin_browser/`) | this build **40 / 40** (t1 10, t4 10, t5 5, t5d 2, t6 6, t7 7); R8 **37 / 40** (t6 3 / 6: its listener was never placed, `sAt` null - the setup miss R8's own R6 run recorded) |

## C7 — the independent adversarial review, and its fixes

**The review.** A separate agent with a fresh context (it had not seen this work being made) read the owner's verdict, the pack, the code
against R8, the documents, one failed R8 trace and the fixed traces, and tried to break the claims with its own experiments (13 scripts on
the real simulation, R8 and this build). Its report is kept verbatim (`evidence/c7_review.md`; only absolute machine paths replaced), its
scripts and their outputs in `evidence/c7_review/` (`out/` as it ran them, `out_after_fix/` on the fixed build). Its verdict on d708f42:
**not ready for owner handoff** - one blocker, four majors. It found the scope clean, no new perception leak (24 / 24 paired invisible
worlds identical through stand-offs, openings and cut-offs), PR27 / PR28 intact (including a no-race lead beyond C10's range), a real
dodge (a step aside up to about 0.35–0.40 s after the wind-up begins escapes), no replanning storm, the circling inference honest.

| Finding | Severity | Disposition | Proof |
|---|---|---|---|
| F1 the chase reads a seen person's exact stamina (`r.stamina < 25`, R8's line, used here from .4) | BLOCKER | **fixed, in part disputed.** Stamina is not hidden from a viewer in this game: the server sends every person's stamina and exhaustion to every page (`src/core/server/loop.js`, `mv`) and every page draws them heaving when exhausted or under 22 (`src/frameworks/br-r/client/move.poses.js`). The reviewer's pair (15 against 100) differs because 15 is drawn heaving. What was wrong is R8's 25: three points finer than anyone can see. Now `SK.windedSeen` 22 | C19 (new): 23 against 100 the same creature 24 / 24 (before the fix 9 / 24, R8 18 / 24); 15 against 100 still differs (drawn) |
| F2 springs at two people together from the group stand-off | MAJOR | **fixed**: no pounce at somebody with company (`skCompany`); a grab at arm's reach stays (contact; R8's rule) | C20 (new): pounces 0 / 24 (before 14 / 24; R8 0); grabs 3 / 24 when they walked into its reach |
| F3 C4's hunger draw bypassed: a passed-over person hunted as soon as they leave view | MAJOR | **fixed**: the encounter remembers the draw's answer; out of view, a passed-over person is let go | C21 (new): hunted all the same 0 of 19 (before 15–16); 1 taken up after its hunger rose past the same draw (the review's own rule) |
| F4 stared down: 44–63 s standing still in the watcher's view, renewing the same stand-off | MAJOR | **fixed**: one renewal a hunt, and only from a new spot it walks to (`SK.standAgain`); otherwise its next answer | C22 (new, movement-based - the review's point that C02 / C17 judged a label): longest still in view 6–8 s (before 44–63 s); it goes at 14–29 s or got beside them unseen (3 / 12) |
| F5 the real-page comparison miscounted (13 / 14 vs 3 / 12, not 12 / 14 vs 3 / 11) and from one pass | MAJOR | **fixed in the documents**: C6a corrected in place (marked); the pooled count over every valid pass, with n, and the fixed build's own pass, below | below |
| F6 C06's "a turn back can fool it" passes while every reverser dies | MINOR | **retitled**: C06 now says what it measures - a reversal undoes the guess at once, but on this pillar (its ring inside its spring's reach from the cut point) it catches them anyway; a reversal that saves you needs a bigger loop. An owner-visible limitation (`HUMAN_QA.md`, `DEFERRED.md`) | C06 title and note |
| F7 PR20's bar lowered (a runner who stops far off is lost more often) | MINOR | **owner decision, kept documented** (C3): the price of 3 s on the trail instead of 13 s | `DEFERRED.md`, `HUMAN_QA.md` part 7 |
| F8 `pr_listened_then_looked` not exercised in the real pages | MINOR | **documented** (C6b): the listen now ends at the next footstep (C04 (b)); R8's tool samples slower than that. Not changed: R8's tool is R8's evidence | `DEFERRED.md` |
| F9 real-page traces too coarse for sub-second claims | MINOR | **documented**: the sub-second latencies are the simulation's (C01, C18); the real pages show ordering and outcome only | `HUMAN_QA.md`, `DEFERRED.md` |
| F10 R8 had four red p99 runs in the first matrix, not three; the soak barely exercises the new tactics | NIT | **fixed** (C6b corrected in place); the soak's limit stated - C14 is the stress evidence for the new tactics | `PERFORMANCE.md` |
| F11 the trail-end watch's 8 s overwritten by a drawn 1.4–7.8 s (an extra draw) | NIT | **fixed**: a watch given its time keeps it | code |
| F12 documents vs code (stand-off from .4 not "mild"; pressing visible from about .65; "under cover" only without a straight line) | NIT | **fixed** in `DESIGN_DECISIONS.md` and `BALANCE_TABLE.md` | — |
| F13 a twitch holds every plan change for up to one beat | NIT | **kept by design** (C1: a glance shorter than the beat is not evidence); noted | — |

Changed (C7a): the species file (`BALANCE_TABLE.md` C7, UNAPPROVED; its declared-change note), four new scenarios (C19–C22, each from the
review's own experiment), C06's title (F6; its checks unchanged), `DESIGN_DECISIONS.md` (F12, the C7 section), `HUMAN_QA.md` (drafted), the
review and its kit.

| Run | Result |
|---|---|
| C19–C22 on the reviewed build's game code (`git archive 93fe6ca`, the same game as d708f42) and on R8 (`evidence/c7_before_fix.txt`) | **all four FAIL on the reviewed build** (C19 9 / 24 the same; C20 14 pounces at .55 / .7; C21 15 hunted all the same; C22 longest still 44–63 s). On R8: C19 FAIL (R8's 25: 18 / 24), C20 and C22 pass (R8 leaves in 7–17 s), C21 does not apply (no draw: nothing passed over) |
| species suites on the fixed build (`evidence/c7_suites.txt`) | **105 / 105 PASS** (C5's 101 and C19–C22). C06 ran under its old title (retitled after; nothing it checks changed) |
| `tools/c0_audit.js` (`evidence/c7_audit.*`) | as at C4 but: watched at .5 / .55 and the lure-runner scene, the longest idle in view **8.0–8.2 s** (C4: 18.9–39.9 s), the plans now end in `leave` after a stand-off; the passer-by at .45 1 / 6 killed (C4 2 / 6: one passed over is now let go); every other scene's kills unchanged |
| the review's four experiments again (`evidence/c7_review/out_after_fix/`) | stamina 15 / 100 still differs (drawn heaving - see F1); group: no pounce, 3 grabs in reach; passed over: 1 of 19 taken up, after its hunger rose past the draw; stared down: in view 11–35 s, then it goes or got beside them unseen |
| static checks (`evidence/c7_checks.txt`) | all PASS |

## C7b — the fixed build, re-run in full

Changed: no game code (C7a's). `tools/c7_pool.py` (the review's F5: every pass pooled, with n, and every try left out and why).
Everything the review asked to re-run after its fixes, on the fixed build:

| Run | Result |
|---|---|
| `npm test` (`evidence/c7b_npm_test.txt`, `c7b_npm_compare.txt`) | **254 / 267; 13 failures, each on R8's inherited list by its whole name**; none new, none fixed |
| `npm run test:humanqa` (`evidence/c7b_humanqa.txt`) | 5 / 6, X03 inherited |
| P9 equivalence, six seeds × 120 s (`evidence/c7b_equiv_p9.txt`) | **PASS** - 6 / 6 identical tick for tick |
| the fast gate (`evidence/c7b_gate.txt`) | **PASS, 21 / 21** |
| `tools/c6_browser.js`, two passes of three tries a scene (`evidence/c7b_browser_p1.*`, `_p2.*`; shots `c7b_shots/`) | per scene, pooled with R8's and the pre-fix build's every valid pass (`evidence/c7b_browser_pool.txt`): watched page turning its back **R8 4 / 7 kills, before the fix 8 / 9, fixed 6 / 6**; the fork's double-back R8 3 / 6, 4 / 7, **2 / 4 - fooled twice** (it searched the way it saw them go, listened, gave up); the decoy R8 3 / 5, 3 / 4, 1 / 2 (three tries out: A held up by a wall); the pillar R8 1 / 3, 3 / 3, 4 / 5 (**no cut-off in this pass**: stand-offs and a flank reached them first; the simulation's cut-offs are unchanged, C06 9 / 9); the fresh runner R8 0 / 6, 2 / 8, **1 / 6** (never caught running; the one killed had hidden round the corner it searched). **All: R8 11 / 27, before the fix 20 / 31, fixed 14 / 23.** n is small; this cannot separate "smarter" from "deadlier" - it says the fixed build is deadlier than R8 where a page looks away, circles, or hides near where it ran, and no deadlier where the page runs and keeps going |
| B1–B5's `behave_browser.js` (`evidence/c7b_behave_browser.*`) | **9 / 9** |
| R8's `predator_browser.js` (`evidence/c7b_predator_browser.*`) | 6 / 7; `pr_listened_then_looked` not exercised (as at C6b: `DEFERRED.md`) |
| Trial 3's `skin_browser.js`, section by section (`evidence/c7b_skin_browser/`) | **40 / 40** (t1 10, t4 10, t5 5, t5d 2, t6 6, t7 7) |
| `perf_pr.js` against R8, three interleaved rounds (`evidence/c7b_perf.*`) | **PASS** (0 violations). Medians R8 → fixed: none 0.169 → 0.187 (+11 %, the same code: noise), one 0.201 → 0.208 (p99 1.24 → 1.93), four 0.286 → 0.257 (p99 3.42 → 3.09), **four pressed 0.279 → 0.291 (p99 2.50 → 3.83, +53 %: within the tool's tolerance by its spread, i.e. borderline)**, four starving 0.280 → 0.275 (p99 4.21 → 2.87). Red runs: R8 three (4.31, 4.21, 4.24), fixed one (4.25, four pressed, round 1) |
| the same matrix again, because the pressed pair was borderline (`evidence/c7b_perf_run2.*`) | **PASS** (0 violations). none 0.175 → 0.190, one 0.199 → 0.214 (p99 1.94 → 2.53), four 0.307 → 0.267 (p99 4.16 → 2.61), **four pressed 0.294 → 0.295 (p99 3.22 → 3.66, +14 %)**, four starving 0.300 → 0.276 (p99 4.19 → 3.75). Red runs: R8 three (4.27, 4.29, 4.19), fixed two (4.29 four pressed, 4.23 four starving). **Across all four matrices the pressed pair's p99 was higher on this build three times (+9, +53, +14 %) and lower once (−19 %), its mean the same (±5 %)**: within the 60 Hz budget and the tool's tolerance every time, but a tendency, stated in `PERFORMANCE.md` |
| `perf_pr.js --soak 600` (`evidence/c7b_soak.*`) | **PASS**: mean 0.158 ms, p99 0.83, worst 12.9 ms; 0 violations |
