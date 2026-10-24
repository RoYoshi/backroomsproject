# Trial 3 R19 - the combined QA branch (S + N)

Trial 3 is **not owner-approved**.  Branch `trial-3-r19-combined-humanqa`: **for the owner's Human QA only**.  It is R19's two isolated
tracks put together - the S track's positioning (`trial-3-r19-prechase-positioning`, tip `f0c95ff`) and the N track's shared cornering
(`trial-3-nani-cornering-qol`, tip `451f1d6`) - by one merge commit (`9c7e3de`) of their tips, both of which descend in one straight line
from the R18 receipt `01e5d97`.  Nothing here is merged anywhere, deployed, or spawned organically.  Each track's own reports are in its
own folder, unchanged here: `dev/trial-3-r19-positioning/` (S) and `dev/trial-3-nani-corners/` (N).

| document | what |
|---|---|
| `HUMAN_QA.md` | the owner's worksheet: both tracks' scenes and the pack's combined questions |
| `REGRESSION.md` | the full suite, both new suites, the locks, the scenes and the real-page runs on this tree |
| `REMOTE_RECEIPTS.md` | every push of this branch read back from GitHub |

## What the merge had to resolve

| file | how |
|---|---|
| `dev/tests/run.js` | both tracks added a suite to the same default list: both kept (`s_skinr19.js`, `s_nanicorner.js`) and both notes |
| `generated/BUILD_MANIFEST.json` | rebuilt from the merged parts with `npm run build`; `npm run build:check` PASS; `generated/server/ai.js` merged clean and is exactly the parts' build |

The two tracks touch different game sources (S: `ai.skinstealer.js`, `ai.skin.move.js`; N: `ai.entity.js`), so the game code merged
without a conflict: each of those files here is byte for byte its track's.

```
npm run build:check
ADMIN_PASSCODE=<synthetic> npm test                    # the 13 failures R18 already has, nothing new
node dev/tests/run.js s_skinr19.js s_nanicorner.js     # both tracks' suites on the combined tree
```
