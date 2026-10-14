# C-1 rollback: NEW RUN's decision back into server.js

C-1 changes exactly two production files: `server.js` (26 lines out, 4 in) and the new `server/newrun.js`. No other production file
differs from B++ at this checkpoint (`gate_fast/scope.json`).

**To undo C-1 alone** (from the repository root, on `stage-3h`):

```
git revert --no-edit <the C-1 commit>
```

or, by hand, to the bytes of the checkpoint before it (H2-0, `3559e65`, whose `server.js` is B++'s own):

```
git checkout 3559e65 -- server.js
git rm server/newrun.js
```

**Check after the rollback:** `sha256sum server.js` must print
`0424cbc1942a301a3bca01f681f0618a090479815e131bb2e1ee2ea569d8fb2d` (B++'s `server.js`, 143b63f), `server/newrun.js` must be gone, and
`python3 -I -B dev/stage-3h/tools/h1_scope_check.py --worktree` must pass with no production file changed.

**At C-1:** `server.js` SHA-256 `a7349908d2abe8c7109d69d4247687879aab6a987cd4dd84077c4ce6934fa11b`, `server/newrun.js` SHA-256
`356c9e1f4d45d5de26be9510fdcf8df0a574a97f7dcb7206e5be0002195fb53e`.

Nothing else depends on the module: only `server.js` requires it, and no client file, test or tool loads it (the gate's mutants find
their text wherever it lives). A deployment that serves the game with `node server.js` needs the `server/` folder, as it already did
for Stage 3H0's four modules.
