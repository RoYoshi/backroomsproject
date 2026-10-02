# Part 2 HQA Hotfix — Test Summary

## Fresh targeted results

- `npm run test:humanqa` — **4/4 PASS**
  - 64 Hounds and 64 Smilers individually; 128 mixed entities reachable.
  - 64 client render slots per species and +10 admin batching present.
  - dead hover reads `DEAD`; OFF carried-light aura absent.
  - visible light still beats sustained Smiler gaze in 7/8 seeded encounters.
- `node dev/tests/run.js s_hound2e.js` — **18/18 PASS**
  - includes new HQA H14 pursuit/gaze rule.
  - includes new HQA H18 close-range walking-orbit regression.
- `node dev/tests/run.js s_smiler.js` — **16/17 PASS**
  - only `SM01` red: 6/8 light-carrier chase sample vs 80% sample gate. `SM01` was already one of the documented historical Stage 2F red assertions.
- `node dev/tests/run.js s_shared2f.js` — **22/23 PASS**
  - only `F22` red: old exact-file hash guard detects the intentional hotfix edits. This is expected and is retained rather than weakened.
- `s_capture.js` — **8/8 PASS**
- `s_system.js` — **10/10 PASS**
- `s_admin.js` — **5/5 PASS**
- `s_commit.js` — **4/4 PASS**
- `s_audit.js` — **9/9 PASS**
- `s_evidence.js` — **10/10 PASS**
- `s_ir.js` — **3/3 PASS**
- `s_percept.js` — **10/12**, with historical `P01` and `P07` red.
- `s_hound.js` — **13/14**, with historical `H07` red.
- `s_chase.js` — **13/17**, with historical `C1`, `C4`, `C5`, `C18` red.

The historical reds above match the known Stage 2F sampling/legacy-assertion set; no threshold was lowered merely to make the suite green.

## Build/syntax

- `dev/build_ai.sh` completed and rebuilt `ai.js`.
- `dev/build_sim.sh` completed and rebuilt `sim.js`.
- `node --check` passed for `server.js`, `mp.js`, `ai.js`, `sim.js`, and the shipped browser bundle.
- `node server.js` reached normal startup (`The Far Backrooms → http://localhost:8000`).

## Stress sanity

A direct 64-Hound + 64-Smiler simulation construction succeeded. The serialized entity snapshot for 128 entities was ~12 KB in the no-player stress sanity run. This is not a production capacity benchmark; the raised cap is an admin stress ceiling, not a new normal-population target.

## Browser/human status

No automated result can determine whether the new close pivot and Smiler pressure *feel* right. Final human gameplay QA is still required before locking Part 2.
