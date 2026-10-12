# D6 corrections

## 1. Drying corpses were redrawn off screen (gore.js)

**Found.** The first D6 browser run (`perf_death_d6_attempt1.json`, kept) put the Hound C death 10–16 % over the parent in the same session (frame-time median, worst round).

**Cause.** That window starts a few seconds after the Hound A death, whose corpse is still drying. Since D3, the drying ticker redrew a young corpse on every visible step of its colour and torso pool (about 45 redraws in its first 25 s), and refreshed its texture, whether or not the corpse was on screen. On a software renderer each redraw costs about a frame.

**Change.**
- A drying corpse is redrawn only while its view is visible; one that was off screen catches up in one redraw when it comes back.
- The steps are coarser (colour in 30 steps, the torso pool in 16), about 29 redraws in all.
- What a corpse looks like at any age is unchanged.

**The job.** The D6 job was stopped (by process id) during the soak test that followed, two minutes in. The checks before it ran on the unchanged files: their results stand.

**Re-run on the corrected tree:**
- the browser performance, interleaved with the parent (`perf_ab/`);
- the soak, the corpse checks and the film;
- every check that loads `gore.js`: `gore_geo`, golden3d (a served file), `corpse_check`.

## 2. Wall-mark geometry worked out every redraw (gore.js)

**Found.** The interleaved A/B (`perf_ab/attempt1/`: parent and corrected tree alternately, 2 × 2 rounds) still put the Hound C death's worst round 19–29 % over the parent. The medians were within +5–7 %; the first round of each run was the high one, for both trees.

**Cause.** One cost added by 3D that every frame of a wall death paid: each redraw of the live blood rebuilt each wall mark from scratch. That is about 60 floor tests for its spray and the smear's run along the wall.

**Change.** A mark at full size is now worked out once and kept (`markPlan`, the last 128). It draws exactly the same points: `gore_geo_test` gives the same 2,251,617 and 2,805,291 points, 0 on anything solid.

**Re-run.** The A/B was run again, 3 × 2 rounds each (`perf_ab/`).

## 3. An independent review of the D6 tree

**How.** A separate agent that had not built 3D read the D6 working tree, the evidence and the documents, ran its own Node checks and changed nothing. Its findings, most severe first, and what was done:

| # | Finding | Done |
|---|---|---|
| 1 | The working tree was not what was committed; the D6 QA2 probes had overwritten 25 tracked images of `dev/stage-3c-qa2/evidence/` and left new files there; a `__pycache__` | Stage 3C-QA2's evidence restored (`git checkout`, new files removed); the probes now write to `evidence/d6/qa2/shots_b1…3` (`--shots`), and the run records that stage-3c-qa2 is untouched; `__pycache__` removed before committing; D6 is committed before packaging |
| 2 | The documents cited `summary.json` and film sheets that did not exist yet; the film had been stopped | The whole D6 run again on the corrected tree, the film included, then `summarize_d6.py`; the documents give that run's numbers |
| 3 | `dphys.js`: once the hound let go, its jaw took hold again on the next step and let go again, about 250 `release` events per Hound A death (the parent's run logged 7). The body was unaffected, but the blood and sound read every event | An `S.released` flag: the jaw lets go once |
| 4 | `server.js`: the NEW RUN light record took its light (kind, colour, on/off) from the message, and is not tied to the vanish | The light's kind, colour and parts, whether it was on and the player's look now come from the server's own state. Tying it to the vanish is left for later (the report's limits): it would change what a player sees in the known 30 s NEW RUN cooldown mismatch, which 3D leaves untouched |
| 5 | `server.js`: the server's whole physical death (5–10 ms median, 22 ms worst, in the D6 run before the review) ran in one tick at the death's end; several at once could stack past the 25 ms wake | `death_srv.begin / step / corpse` (`dphys.prepare / advance / finish`): prepared at the kill, advanced each tick to the death's current time, finished at its end. Same run, same corpse (parity and `death_net` unchanged) |
| 6 | `mp.js`: the hidden own corpse (`'r' + id`) survived a reconnect, so the player would never see its old corpse | Cleared when the connection closes and when `hi` gives another id |
| 7 | Wrong numbers in the documents: the parent's light 106 px (it was 34 px; 106 px was the D2 build), the death lengths, the server's corpse timings, "< 0.6 px", "4× faster" | Corrected from the evidence files; `STAGE_3D_D0_AUDIT.md`'s "37–95 ms" corrected to what its own file says |
| 8 | The 384 B corpse is one sample, not a bound: a long name makes a record longer | Stated as one sample; what 3D adds to every record is named (`de`, `ag`, up to two wall marks) |
| 9 | Four human-QA rows could not be done as written | Rewritten (`STAGE_3D_HUMAN_QA.md` G2, D2, D6, D7) |
| 10 | `golden3d.js` dropped every snapshot's whole entity list, so monsters that killed nobody were never compared; and a follow-on after the hand-back is unbounded | The entity lists are kept and only the monsters that made a kill are left out (the A/A and D6 runs pass with it). The follow-on's bound is stated in the tool, `STAGE_3D_REGRESSION_AND_EQUIVALENCE.md` and the summary (only `deaths` may have one) |
| 11 | `cli_golden3d.js` dropped the whole hidden-corpse field `hb` | Only the scene's own corpse is taken out; every other hidden corpse must match |
| minor | A late joiner's replay played every earlier wall, light and hat sound in its first frame | Events more than 0.25 s old are skipped |
| minor | Corpse culling had no hysteresis at the screen edge | A 64 px margin before a corpse is culled again |
| minor | `assets/net-wire.js`'s change was not listed here | It is: a corpse record's `born` is added only when the server sent its age (`ag`); before, a record without one got `born: undefined` |
| minor | `sfx.js`: a custom death sample would not be muffled behind walls | Left as is: the game ships no custom death sample; noted |
| minor | The A/B windows hold about 7 frames each; +9 % idle is at the noise floor | Noted in `STAGE_3D_PERFORMANCE.md` |

**Checked by the review and found correct:** the unchanged files; the six bundle hooks; the same `npm test` and `test_shadows` failures as the parent; 0 against 4,568 blood points on solid; the A/B medians; `death_net` 16/16; the contract counts; BR-RoLE and camera fairness; Smiler's phases not cut off by sleep; the supersession of the old checks. Secrets: none; the default admin passcode only in `server.js` line 10 (before 3D, not in the diff).

**Re-run.** Everything in D6 (`steps.txt`, after "the review's corrections").
