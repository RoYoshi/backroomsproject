# C-2 rollback: the death aftermath and the NEW RUN blast back into server.js

C-2 changes exactly two production files: `server.js` (67 lines out, 1 comment line moved back above `moveTo`, a 4-line note, one
require, and the C-1 note's and require's wording) and the new `server/aftermath.js`. `server/newrun.js` (C-1) is untouched.

**To undo C-2 alone** (back to C-1), from the repository root on `stage-3h`:

```
git revert --no-edit <the C-2 commit>
```

or, by hand, to the bytes of C-1 (`91a785f`):

```
git checkout 91a785f -- server.js
git rm server/aftermath.js
```

`sha256sum server.js` must then print `a7349908d2abe8c7109d69d4247687879aab6a987cd4dd84077c4ce6934fa11b` (C-1's `server.js`).

**To undo C-1 and C-2 together** (back to B++'s server side):

```
git checkout 3559e65 -- server.js
git rm server/aftermath.js server/newrun.js
```

`sha256sum server.js` must then print `0424cbc1942a301a3bca01f681f0618a090479815e131bb2e1ee2ea569d8fb2d` (B++'s `server.js`, 143b63f).
After either, `python3 -I -B dev/stage-3h/tools/h1_scope_check.py --worktree --allow-prod <what is still changed>` must pass.

**At C-2:** `server.js` `dbabc050ebc2222f97ac073d931a40030809ad9567cce20a8165c664d19edefe`, `server/aftermath.js`
`dd9f4555237dd0a1da696fb03bdf433b607ca2eddce767de4a04bb68e27b4586`, `server/newrun.js` (unchanged since C-1)
`356c9e1f4d45d5de26be9510fdcf8df0a574a97f7dcb7206e5be0002195fb53e`.

Only `server.js` requires the module. `server/newrun.js` is given `boomStart` by `server.js`, which now takes it from the aftermath
module: undoing C-2 alone puts `boomStart` back in `server.js` as the function C-1's require line passes.
