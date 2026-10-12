# HQ1-1: blood on the wallpaper

## What changed

- **`gore.js`** (`window.__gore.wallStains`): each hard wall contact of a death is stamped onto the papered face it struck, through the Level 0 remaster's decal receiver (`window.__l0v.surfaces.stamp`).
  - The contacts are the physics' own: `dphys.marks` while a death plays, the corpse record's wall marks (seeds 512–543) afterwards. No position is invented.
  - The face is found from the contact and its normal. It must be a wallpaper face whose outward normal faces the contact (dot ≥ 0.6), on its line (within 4 px), and not within 6 px of a run's end. Pillars, props and floor never match. A face that does not resolve is recorded as `noface` and nothing is drawn.
  - The stain is one of 36 looks (12 shapes × 3 sizes), seeded from the death id and the contact. It is a dark crimson and maroon splash at the struck height, with spray along the wall and 4–6 thin runs down to the crease.
  - It becomes part of the wall's own art: clipped to the face, baked into the remaster's chunks, lit by BR-RoLE exactly like the wallpaper under it. It is never a light of its own.
  - The floor marks are unchanged.
- **`mp.js`**: a few times a second (every 0.12 s) it tells gore.js which contacts this screen shows. These come from our own death while it plays, every replay, and every corpse; our own corpse is matched by our own death id. One stain is kept per impact: the same death id within 8 px is the same impact, so a replay hands over to its corpse without a second stamp. A stain is removed when nothing has wanted it for 0.5 s.
- **`assets/net-wire.js`**: the corpse record keeps the server's death id `de`.
- With the remaster off or not built, nothing is stamped and nothing is drawn in its place. There is no screen-space stain and no painting on the wall top.

## Gates (`STAGE_3D_HQ1_AUDIT.md`)

| Gate | Result | Evidence |
|---|---|---|
| W1 wallpaper stain, faces S/N/E/W, victim / spectator / late joiner | **Met.** Blood-coloured pixels in the band box, from impact on: S 173–287, N 222–493, E 337–408, W 184–428. MEDIUM 154–388, HIGH 158–394. Before the death: 0. Above the band (the wall top): 0 in every picture. RED (D7): 0 everywhere | `stain_metric.json`; `faces/`, `tiers/`; `*_sheet.jpg`; `*_band.png` (box outlined) |
| W2 face resolution on the real map | **Met**, 100 % at LOW and HIGH. 419 face centres; 838 at 40° and 838 at 55° (accepted and rejected as they should be); 838 run ends rejected; 419 points 6 px inside the wall; 1,532 diagonals; 36 pillars; 44 props; 1,200 floor points | `wall_faces_low.json`, `wall_faces_high.json` |
| W3 lifecycle | **Met except one known D7 behaviour.** Steps 1–7 and 8a pass: one stamp per impact through replay → corpse; the late joiner rebuilds it; idle 10 s, no new stamp; a second death removes the first; a revive mid-death leaves none; a reconnect rebuilds exactly one; a world reset clears the other screens. **8b not met:** after an admin world reset, the victim's own screen keeps her stain. D7 keeps the victim's own local corpse through a world reset, and the stain follows the corpse that screen still shows | `wall_lifecycle.json` |
| W3 cache regeneration (added) | **Met.** A full level rebuild, a tier rebuild to HIGH and back, and a chunk-cache eviction: the stain stays (one stain, one receiver mark, no second stamp, 185–194 blood pixels on the band) | `rebuild/wall_rebuild.json` and its pictures |
| W4 floor blood unchanged | **Met.** `gore_geo`: 508 deaths, 2,251,617 live points and 2,805,291 corpse points, 0 on solid. These are the same counts as D6/D7 (`dev/stage-3d/evidence/d6/gore_geo_d6.json`) | `gore_geo.json` |
| W5 remaster off | **Met.** No stamp, no error; 0 blood pixels on the band. Floor marks as at D7 | `special/remaster_off_S*` |
| W6 cost | **Met.** A stamp costs at most 3.7 ms on the victim's and spectator's screens and 7.5 ms on a late joiner's (SwiftShader). Idle: the stamp counter does not move. There is no per-frame stamping | the `receiverAtCorpse` and `lateJoiner` stats in each capture |

## Also shown

- **Corner** (`special/corner*`): a contact 17 px from an inner corner resolves to the struck face. The stain runs into the corner's shadow and stops at the end of the run. The band box counts 85–91 pixels because half of the box lies past the corner. The stain is plainly visible in the pictures.
- **Pillar** (`special/pillar*`): a pillar has no papered face, so the result is `noface` and no stain. The 3–13 counted pixels are floor spray inside the box.
- **Behind the wall** (`special/behind_S*`): a spectator on the far side of the struck wall sees no stain (0), because the line of sight hides that face. The victim, in front of it, sees it.
- **Late joiners** joined 39.7–49.8 s after the death (78.8 s with the remaster off).

## Known limitations (reported, not hidden)

1. **Gate W3 is not met on the victim's own screen after a world reset** (lifecycle 8b). This follows D7's handling of the victim's own local corpse: `bodies()` replaces only the server's records. HQ1 does not change corpse authority.
2. **A page waiting at the name prompt** already shows the stain. When it presses ENTER, its corpse list is rebuilt once, giving one extra stamp and one removal (2–8 ms, once). Every late-join capture shows `stamps 2, removed 1`, with one stain at the end. There is no churn after that.
3. A face may hold at most 12 marks, a room 48 and the level 160 (the receiver's own caps; the oldest is dropped first). Deaths at most leave 3 per corpse.

## Harness attempts (not game behaviour)

- `try/`: the runs that tuned the stain's size and look before the formal evidence (`try/README.md`).
- `attempts/high_preview_not_shown/`: a smiler killed Alice while the harness was removing the monsters. The server then committed the preview death, but her page never showed it. `wall_capture.py` now stands her up and tries once more. The rerun did not need it.
- `attempts/remaster_off_second_real_death/`: after the preview death, a real hound came back and killed Alice again (`de=2`), so the corpse and late-joiner pictures show that second death. The harness now clears the monsters and gives Alice god mode after the corpse pictures.
- `steps.txt` lists every step of the evidence job, including the two reruns.

`remote_hq1-0.json`: the remote verification of HQ1-0, run after its push.

Housekeeping: HQ1-0 had committed a compiled Python cache by mistake (`dev/stage-3d/__pycache__/lib3d.cpython-311.pyc`, the synthetic-passcode test library; the secret scan finds nothing in it). HQ1-1 removes it from the repository. The evidence jobs now run with `PYTHONDONTWRITEBYTECODE=1`.

`secret_scan.json`: every file changed since the Stage 3H0 parent, scanned before this commit. Result: clean.
