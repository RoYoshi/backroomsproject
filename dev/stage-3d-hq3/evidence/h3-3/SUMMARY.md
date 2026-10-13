# H3-3: the focused checks on the final game code

Every run below used the H3-2 commit `c5602aa` (tree `f77100d`), exported with `git archive`. H3-3 itself adds no game change: only these checks, the documents and the packaging tool. `steps.txt` lists every run with its exit status.

| Check | Tool | Result |
|---|---|---|
| The ordinary 30 s cooldown; a refused NEW RUN makes nothing anywhere | HQ2's `proto_lab.js nr_e02` (real server) | 7/7. Presses 1 s, 10 s and 29.9 s after an approval are refused with the wait and change nothing. Bob sees no replay and no extra corpse. A flood of 100 presses is bounded and refused. The press at 30 s is approved |
| UNLIMITED NEW RUN skips only the cooldown; replacement | `nr_free_unit.js` | 4/4. With `free`, state, dead and held are refused exactly as without it, and a refused `newRun` changes nothing. ON plus an old world number is refused (`epoch`). ON while dead is refused (`dead`). A gibbed corpse (6 pieces) is replaced by an ordinary hound death's corpse: one record, Hound, no pieces. The first run, before U2c existed, is `nr_free_unit_v1.*` (3/3) |
| A world reset during a gibbing | HQ2's `reset_epoch.py --case boom` (4 pages) | 10/10. The reset is answered for everyone. On every page the pieces, stain, corpse and dying light are gone once the page has taken it in. Alice stays in her run menu, then SPAWN works. A late joiner sees nothing of the old world. Delayed old messages are dropped. Nobody's NEW RUN is answered and nothing explodes |
| The blast on three pages, light ON (flashlight) | HQ2's `boom_browser.py` | 7/7. One blast and one Boom corpse. The replay equals the server's run: hands, light and hat within 1 px (the body anchor is fixed; the pieces are checked by `gib_browser`). A chunk struck the wall, so the same wallpaper stain is on all three screens. The light, as each page computed it: full through its 3.1 s hold, fading over 1.5 s, exactly 0 after, one timeline (spread 0.013 s). The sound is heard once on each page that played the blast and never by the late joiner |
| The same, light OFF, camcorder | HQ2's `boom_browser.py --kind camcorder --light-off` | 7/7. The blast and its corpse carry no light (`lo` 0), and no page ever lights it |
| Collision smoke: head-on in a hall | HQ2's `col_browser.py --case head` | 5/5. The server never lets them closer than contact (37 px at the least; contact is 35.29 px). Her page predicts it with no correction, stops at contact and ends where the server has her. He is never moved |
| The gibs on two screens and a late joiner, on the final game code (H3-2 restored `mp.js`'s layout) | `gib_browser.py` | 5/5. One approved NEW RUN, one blast, one corpse of 6 pieces. No whole torso in any replay or corpse view. The farthest piece is 18 px out at 0.02 s, 26 px at 0.05 s, 49 px at 0.15 s and 102 px at 0.4 s. The three records are the same, and the last replay frames match them within 1 px. The late joiner sees the remains with no blast and no sound |

**Contact sheets** (labelled crops of the real screenshots, `dev/stage-3d-hq3/contact_sheet.py`):
- `hq3_gibs_two_browsers.png`: Bob at 0.05 s, 0.15 s and settled; Carol joining later.
- `hq3_admin_toggle.png`: OFF, ON, OFF, the approval while ON, the refusal after OFF, and Bob's passcode prompt.

**The secret scan** (`secret_scan.json`, `secret_scan.log`, `secret_scan_note.txt`) scanned 4,459 files with the owner's address as an extra literal. Self-test 21/21. No finding in any file HQ3 added or changed. Its one finding is HQ2's documented false positive in `dev/stage-3d-hq2/evidence/h2-5/video/main/film.mp4` (compressed picture data), which HQ3 does not touch; it is the reason the tool exits 1.
