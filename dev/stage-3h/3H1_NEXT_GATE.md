# Stage 3H1: the next gate

**Status: STAGE 3H1 AUDIT CANDIDATE. Awaiting the user's authorization for the first surgical runtime checkpoint.**

**BASELINE/AUDIT COMPLETE — FUTURE REFACTOR NOT AUTHORIZED.** Stage 3H is not complete. No H2 work has started.

## 1. What the user is asked to review

3H1 changed no runtime file, so there is no game to replay. Pack file 09 asks the user to review four things instead:

| What | Where |
|---|---|
| The baseline lock | `3H1_SOURCE_PARITY_BASELINE.md`: what is frozen, its SHA-256s, what it cannot see |
| The dependency map | `3H1_DEPENDENCY_OWNERSHIP_MAP.md` and `3H1_FRAMEWORK_REGISTRY.md` |
| The known risks | `../devlog4dev/3H_FINDINGS.md`; the security items sent privately |
| The first extraction candidate | `3H1_EXTRACTION_CANDIDATES.md` (H2-0, then C-1) |

**To check that the game is untouched:**
- `python3 -I dev/stage-3h/tools/h1_scope_check.py --rev stage-3h` must print `SCOPE CHECK: PASS`. It compares all 189 production files with B++ by content.
- To run the game from this branch: `ADMIN_PASSCODE=<your passcode> node server.js 8000`. It is the B++ game, byte for byte.

## 2. The choices

### A. Authorize H2-0 only: the development gate (recommended first)

**What it touches:** only `dev/stage-3h/`.
- one gate command over the B++ baselines;
- a B++ protocol contract v2;
- working B++ copies of `raw_live.js` and `live_wire.js`;
- the scope and build checks, with a mode that allows exactly the files a step names;
- the existing mutants wired in, and the one NEW RUN case no golden reaches yet (`held`).

**No runtime file changes, so no Human QA is needed.** It ends with a report and a STOP. Details: `3H1_EXTRACTION_CANDIDATES.md` §2.

### B. Authorize H2-0 and then C-1: the first runtime checkpoint

**C-1.** Move the NEW RUN decision (`nrIntent`, `NR_GAP`) from `server.js` into `server/newrun.js`, unchanged. It is pinned byte for byte by the golden `bpp_new_run`, and H2-0 adds the one refusal that golden does not reach (`held`).

**What it would deliver:**
- one commit changing `server.js` and adding `server/newrun.js`;
- the gate's report, with every golden identical;
- a small server-only overlay matched to the exact parent, plus a full revert to B++;
- a one-page PASS / NEEDS FIX / REVERT form.

**The Human QA:**
- NEW RUN alive;
- NEW RUN again within 30 s (the wait);
- NEW RUN after an admin world reset;
- an admin's UNLIMITED NEW RUN;
- a second page watching the blast.

It then stops for the user's verdict.

### C. Something else

**Changing the order.** Another first candidate, or no runtime step at all. The NO-GO list in `3H1_EXTRACTION_CANDIDATES.md` §5 says which areas a refactor should not touch, and why.

**A behaviour change from the recommendations.** For example, R-004 (WAV serving) or R-005 (dread volume) in `../devlog4dev/3H_RECOMMENDATIONS.md`. That is not a 3H refactor: it needs its own authorization, its own build and QA.

## 3. The B++ follow-up rule (pack file 12)

**If the wider B++ multiplayer QA finds a confirmed regression:**
1. record the exact reproduction (platform, approximate frame rate, ping, participants, steps);
2. every runtime 3H step pauses; the 3H1 audit stays valid, since it changed nothing;
3. the fix goes on its own explicitly authorized B++ correction checkpoint, without rewriting `stage-3e-0-bplusplus`;
4. Stage 3H moves to a new parent only after that correction is independently verified and the user says so. The 3H1 baselines are then re-recorded on the new parent and labelled as such.

**Two B++ behaviours are already known and pinned.** If the session shows them, they are the stated caveats, not new regressions:
- an admin's own GOTO flickering back for a moment for others (F-019);
- a player sent back after a placement when their connection stalls about a second (F-020).

## 4. What will not happen without a new instruction

- any edit to runtime JS, HTML, CSS, assets, packages, configuration, tests or deployment;
- any change to `main`, `stage-3e-0-bplusplus` or any other branch than `stage-3h`;
- any force push or merge;
- Stage 3E entity art, audio, items, multi-level content or Stage 4 LogicZ.
