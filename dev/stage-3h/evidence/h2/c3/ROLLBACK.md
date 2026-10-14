# C-3 rollback: NEW RUN's button and run-menu words back into mp.js

C-3 changes three production files: `mp.js` (12 lines out, one declaration loses `nrTold`, one line reads the helper, a 2-line
note), `index.html` (one script tag, right after `glitch.js`) and the new `assets/net-newrun.js`. The server side (C-1, C-2) is
untouched by it.

**To undo C-3 alone** (back to the C-2 game), from the repository root on `stage-3h`:

```
git revert --no-edit <the C-3 commit>
```

or, by hand, to the bytes before it (`d24b64e`, whose `mp.js` and `index.html` are B++'s own):

```
git checkout d24b64e -- mp.js index.html
git rm assets/net-newrun.js
```

**Check after the rollback:** `sha256sum mp.js index.html` must print
`b338e5aa87f37bd3a436d584233a6b9e0b554f118d8d99e316dfe7bee0494653` (mp.js) and
`ea756260589054f9fd787c8c1037fb1a8123c174059ae660c100f8c5c76b5db6` (index.html), B++'s (143b63f); `assets/net-newrun.js` must be gone.

**Undo all three files together.** `mp.js` reads `window.__mpLib.newrun` when it starts, and only `index.html` loads the helper.
Restoring `mp.js` without `index.html` is safe, because B++'s `mp.js` does not read the helper. Restoring `index.html` without
`mp.js` is not safe: the multiplayer layer would fail to start.

**At C-3:**

| File | SHA-256 |
|---|---|
| `mp.js` | `5288f3e2c4d77da9dd70a216d1986d6ef70f3ccb5ee1b734b605610e5fc3691e` |
| `index.html` | `5a14ab498f1b7053684dfb2d31fdbaa6a8b03ed3b99369bb3a3304efec2b125b` |
| `assets/net-newrun.js` | `6775d5a18ae489f518c42a7eb3a698c152d1333da1e463044ae2bdbea23619a4` |

**A deployment detail.** Code is served `no-store`, so a browser loads the new `index.html` and the helper together. A browser that
somehow had the C-3 `mp.js` without the helper would lose the multiplayer layer. That is the same exposure Stage 3H0's
`net-wire.js` and `net-interp.js` already have.
