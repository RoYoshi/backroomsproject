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
| C1 what changed, interrupts, reaction | (this commit: `evidence/remote/c1.json` arrives with C2) | | `cc8c8f2` | |

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
