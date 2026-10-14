# C-4 rollback: the fluorescent hum back into mp.js

C-4 changes three production files: `mp.js` (98 lines out, one line reads the helper, a 2-line note), `index.html` (one script tag,
after `net-newrun.js`) and the new `assets/mp-hum.js`.

**To undo C-4 alone** (back to the C-3 game), from the repository root on `stage-3h`:

```
git revert --no-edit <the C-4 commit>
```

or, by hand, to the bytes of C-3 (`3e140ef`; `d66b891` has the same production files):

```
git checkout 3e140ef -- mp.js index.html
git rm assets/mp-hum.js
```

`sha256sum mp.js index.html` must then print `5288f3e2c4d77da9dd70a216d1986d6ef70f3ccb5ee1b734b605610e5fc3691e` (C-3's mp.js) and
`5a14ab498f1b7053684dfb2d31fdbaa6a8b03ed3b99369bb3a3304efec2b125b` (C-3's index.html).

**To undo C-3 and C-4 together** (back to B++'s client): `git checkout d24b64e -- mp.js index.html` and
`git rm assets/mp-hum.js assets/net-newrun.js`; the SHA-256 are then B++'s: mp.js `b338e5aa…0494653`, index.html `ea756260…6b5db6`
(evidence/h2/c3/ROLLBACK.md has them in full).

As with C-3: restore `mp.js` and `index.html` together. The C-4 `mp.js` reads `window.__mpLib.hum` when it starts, so it needs the
`index.html` that loads the helper.

**At C-4:**

| File | SHA-256 |
|---|---|
| `mp.js` | `9243aafb1e17a66d9ca03936c3e10b70341ec99732fafec588a44b0fe3075be4` |
| `index.html` | `ca02fd163bee6c2f9460f7f4e2af0c9cfa90b01f28c2a3d2db5f427913c428cf` |
| `assets/mp-hum.js` | `7b5ae65f0370bcd39c42c9b7b24a6ffc8a9f82959ab0236fb54f68679906e791` |
