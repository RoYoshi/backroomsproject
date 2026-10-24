# Trial 3 R19, S track - the Skin-Stealer's positioning before a chase

Trial 3 is **not owner-approved**.  Branch `trial-3-r19-prechase-positioning`, from the R18 receipt `01e5d97`.  Isolated engineering for
the owner's Human QA: no merge, no deployment, no organic spawn (admin only, at most four).

| document | what |
|---|---|
| `AUDIT.md` | the starting point verified, R18's tests, the source map, what was reproduced, the allowed change |
| `DESIGN_DECISIONS.md` | old and new behaviour, the reckonings and their defaults, what was rejected and why |
| `CHANGELOG.md` | each checkpoint: commit and files |
| `REGRESSION.md` | every suite, the new SR01-SR06, the pack's S01-S30 mapped to evidence, changed measurements |
| `BROWSER_AND_MEDIA.md` | the real-page scenes on R18 and this branch |
| `PERFORMANCE.md` | the 60 Hz step and its counts against R18 |
| `SECURITY_AND_SCOPE.md` | changed paths, data read, admin-only debug, secrets, protected refs |
| `HUMAN_QA.md` | the owner's worksheet: how to run it and what to look for |
| `REMOTE_RECEIPTS.md` | every push read back from GitHub |
| `DEFERRED.md` | what was seen and not changed, what is out of scope |

Tools (`tools/`): `prechase_sim.js` (ordinary play, two people, hours of it), `scene_r19.js` (the hall, junction and escape scenes on any
tree), `r19_browser.js` (Scene B and the junction in the real game: a page moved by its own keys and mouse), `verify_remote_r19.py` (the
readback).  Evidence: `evidence/S0/` (R18), `evidence/S3/` (this branch).

```
npm run build:check                                   # the generated files are the parts' build
ADMIN_PASSCODE=<synthetic> npm test                    # 335/348 here: the 13 failures R18 already has
node dev/tests/run.js s_skinr19.js                     # SR01-SR06
node dev/trial-3-r19-positioning/tools/scene_r19.js hall . stand .85
node dev/trial-3-r19-positioning/tools/prechase_sim.js --mins 180 --seeds 12 --hunger .7 --log 1 --out P.json
```
