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
| C2 the choice: stand-off, whom, the bait as an ambush | (this commit: `evidence/remote/c2.json` arrives with C3) | | `54b5984` | |

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
