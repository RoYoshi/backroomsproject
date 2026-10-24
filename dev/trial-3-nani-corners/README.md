# Trial 3 R19, N track - the shared N.A.N.I. cornering

Trial 3 is **not owner-approved**.  Branch `trial-3-nani-cornering-qol`, from the R18 receipt `01e5d97` (not from the S track).  Isolated
engineering for the owner's Human QA: no merge, no deployment.

| document | what |
|---|---|
| `AUDIT.md` | the starting point verified, R18's tests, the follower as it is, the measurement, the defect found, the allowed change |
| `DESIGN_DECISIONS.md` | the one hunk, why this form, the two forms rejected, the locks taught exactly the hunk |
| `CHANGELOG.md` | each checkpoint: commit and files |
| `REGRESSION.md` | every suite, the new NC01-NC04, the pack's N01-N18, changed measurements |
| `BROWSER_AND_MEDIA.md` | a Hound sent round corners in the real game, R18 and this branch |
| `PERFORMANCE.md` | the 60 Hz step against R18 |
| `SECURITY_AND_SCOPE.md` | changed paths, data read, secrets, protected refs |
| `HUMAN_QA.md` | the owner's worksheet |
| `REMOTE_RECEIPTS.md` | every push read back from GitHub |
| `DEFERRED.md` | seen and not changed; out of scope |

Tools (`tools/`): `corner_audit.js` (every species round 40 seeded routes, from rest and from speed), `corner_plot.py` (a run drawn),
`corner_browser.js` (a Hound sent round corners by the admin's own navigation command, recorded by the page), `fresh_seeds.js` (the
review's probe: R18's follower against this one on fresh routes), `pursuit_outcomes.js` / `pursuit_compare.py` / `pursuit_chaos.py`
(the owner's "never weaker": game outcomes of seeded chases on any tree, paired, with a 1 px control), `verify_remote_r19.py`.

```
npm run build:check
ADMIN_PASSCODE=<synthetic> npm test                    # 334/347 here: the 13 failures R18 already has
node dev/tests/run.js s_nanicorner.js                  # NC01-NC04: before and after on the same routes
node dev/trial-3-nani-corners/tools/corner_audit.js --dir . --routes 40 --seed 7 --out A.json --trace T.json --traceRoutes 23,26
python3 -I dev/trial-3-nani-corners/tools/corner_plot.py T.json plots --route 23 --kind hound --pace chase
node dev/trial-3-nani-corners/tools/pursuit_outcomes.js --dir <tree> --n 60 --loopSeeds 6 --out <tree>.json   # each of R18 and this tree
python3 -I dev/trial-3-nani-corners/tools/pursuit_compare.py R18.json N.json
```
